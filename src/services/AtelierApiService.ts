/**
 * HTTP client for InterSystems Atelier REST API
 * Handles connection testing and API communication
 */

import { IServerSpec } from '../models/IServerSpec';
import { IUserError, IFilterCriterion, SortDirection } from '../models/IMessages';
import { IColumnInfo, ITableSchema } from '../models/ITableSchema';
import { ITableRow } from '../models/ITableData';
import { ErrorHandler, ErrorCodes } from '../utils/ErrorHandler';
import { UrlBuilder } from '../utils/UrlBuilder';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Atelier API query response structure
 */
interface IAtelierQueryResponse {
    status: {
        errors: Array<{ error: string }>;
        summary?: string;
    };
    result?: {
        content?: unknown[];
    };
}

/**
 * Atelier API server descriptor response (root endpoint)
 * The actual data is nested inside result.content
 */
interface IAtelierServerDescriptor {
    status: {
        errors: Array<{ error: string }>;
        summary?: string;
    };
    result?: {
        content?: {
            api?: number;
            namespaces?: string[];
            version?: string;
        };
    };
}

/**
 * Regular expression for valid SQL identifiers
 * Allows: letters, numbers, underscore, dot (for schema.table), percent (for IRIS system tables like %Dictionary)
 * SECURITY: This is used to prevent SQL injection in dynamic queries
 */
const VALID_SQL_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_%$.]*$/;

/**
 * Service for communicating with InterSystems Atelier REST API
 */
export class AtelierApiService {
    private _timeout = 10000; // 10 second timeout

    /**
     * Validate and escape a SQL identifier (table name, column name)
     * SECURITY: Prevents SQL injection by validating identifier format
     * @param identifier - The identifier to validate
     * @param context - Context for error messages (e.g., 'table name', 'column name')
     * @returns The escaped identifier wrapped in delimited identifier quotes
     * @throws Error if identifier is invalid
     */
    private _validateAndEscapeIdentifier(identifier: string, context: string): string {
        if (!identifier || typeof identifier !== 'string') {
            throw new Error(`Invalid ${context}: identifier cannot be empty`);
        }

        // Trim whitespace
        const trimmed = identifier.trim();

        // Check against valid identifier pattern
        if (!VALID_SQL_IDENTIFIER.test(trimmed)) {
            throw new Error(`Invalid ${context}: "${identifier}" contains invalid characters`);
        }

        // For IRIS SQL, use double quotes as delimited identifiers
        // Double any existing quotes to escape them
        const escaped = trimmed.replace(/"/g, '""');
        return `"${escaped}"`;
    }

    /**
     * Validate a numeric value for use in SQL queries
     * SECURITY: Ensures only valid integers are used for pagination
     * @param value - The value to validate
     * @param context - Context for error messages
     * @returns The validated integer
     * @throws Error if value is not a valid non-negative integer
     */
    private _validateNumeric(value: number, context: string): number {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            throw new Error(`Invalid ${context}: must be a non-negative integer`);
        }
        return value;
    }

    /**
     * Parse a fully qualified table name into schema and table name components
     * Examples:
     *   "Ens_Lib.MessageHeader" -> { schemaName: "Ens_Lib", baseTableName: "MessageHeader" }
     *   "MessageHeader" -> { schemaName: "SQLUser", baseTableName: "MessageHeader" }
     * @param qualifiedName - The table name (may or may not include schema prefix)
     * @returns Object with schemaName and baseTableName
     */
    private _parseQualifiedTableName(qualifiedName: string): { schemaName: string; baseTableName: string } {
        const dotIndex = qualifiedName.indexOf('.');
        if (dotIndex > 0) {
            return {
                schemaName: qualifiedName.substring(0, dotIndex),
                baseTableName: qualifiedName.substring(dotIndex + 1)
            };
        }
        // No schema prefix - default to SQLUser (IRIS default schema)
        return {
            schemaName: 'SQLUser',
            baseTableName: qualifiedName
        };
    }

    /**
     * Build WHERE clause from filter criteria (Story 6.2)
     * Uses parameterized queries for security (prevents SQL injection)
     * Supports wildcards: * → %, ? → _ for LIKE patterns
     * @param filters - Array of column filter criteria
     * @param schema - Table schema for column validation
     * @returns Object with WHERE clause string and parameter values
     */
    private _buildFilterWhereClause(filters: IFilterCriterion[], schema: ITableSchema): { whereClause: string; filterParams: string[] } {
        if (!filters || filters.length === 0) {
            return { whereClause: '', filterParams: [] };
        }

        const validColumnNames = new Set(schema.columns.map(c => c.name));
        const conditions: string[] = [];
        const params: string[] = [];

        for (const filter of filters) {
            // Validate column exists (security: prevent probing for non-existent columns)
            if (!validColumnNames.has(filter.column)) {
                console.warn(`${LOG_PREFIX} Filter ignored: unknown column "${filter.column}"`);
                continue;
            }

            // Skip empty filter values
            const value = filter.value.trim();
            if (!value) {
                continue;
            }

            // Escape the column name
            const escapedColumn = this._validateAndEscapeIdentifier(filter.column, 'filter column');

            // Convert wildcards and determine if LIKE is needed
            // * → % (match any characters)
            // ? → _ (match single character)
            const hasWildcard = value.includes('*') || value.includes('?');

            if (hasWildcard) {
                // Convert to SQL LIKE pattern
                // First escape any existing % or _ in the value (they're literal in user input)
                let likePattern = value
                    .replace(/%/g, '\\%')
                    .replace(/_/g, '\\_');
                // Then convert our wildcards
                likePattern = likePattern
                    .replace(/\*/g, '%')
                    .replace(/\?/g, '_');

                conditions.push(`${escapedColumn} LIKE ? ESCAPE '\\'`);
                params.push(likePattern);
            } else {
                // Exact match (case-insensitive for strings)
                // Use LIKE with exact value for case-insensitive matching
                conditions.push(`${escapedColumn} LIKE ?`);
                params.push(value);
            }
        }

        if (conditions.length === 0) {
            return { whereClause: '', filterParams: [] };
        }

        // AND logic: all conditions must match (per AC #3)
        return {
            whereClause: `WHERE ${conditions.join(' AND ')}`,
            filterParams: params
        };
    }

    /**
     * Build ORDER BY clause from sort parameters (Story 6.4)
     * Validates column exists in schema to prevent SQL injection
     * @param sortColumn - Column to sort by (null for no sorting)
     * @param sortDirection - Sort direction ('asc', 'desc', or null)
     * @param schema - Table schema for column validation
     * @returns ORDER BY clause string (empty if no sorting)
     */
    private _buildOrderByClause(
        sortColumn: string | null,
        sortDirection: SortDirection,
        schema: ITableSchema
    ): string {
        // No sorting if column or direction is not specified
        if (!sortColumn || !sortDirection) {
            return '';
        }

        // Validate column exists in schema (security: prevent injection)
        const validColumnNames = new Set(schema.columns.map(c => c.name));
        if (!validColumnNames.has(sortColumn)) {
            console.warn(`${LOG_PREFIX} Sort ignored: unknown column "${sortColumn}"`);
            return '';
        }

        // Escape the column name
        const escapedColumn = this._validateAndEscapeIdentifier(sortColumn, 'sort column');

        // Validate direction (only 'asc' or 'desc' allowed)
        const direction = sortDirection.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

        return `ORDER BY ${escapedColumn} ${direction}`;
    }

    /**
     * Test connection to server by hitting the root Atelier endpoint
     * This endpoint returns server info and available namespaces without requiring a specific namespace
     * @param spec - Server specification
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Result with success flag and optional error
     */
    public async testConnection(
        spec: IServerSpec,
        username: string,
        password: string
    ): Promise<{ success: boolean; error?: IUserError }> {
        // Use root Atelier endpoint - doesn't require a namespace
        const url = UrlBuilder.buildBaseUrl(spec);
        const headers = this._buildAuthHeaders(username, password);

        console.debug(`${LOG_PREFIX} Testing connection to ${url}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'GET',
                headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                console.debug(`${LOG_PREFIX} Connection test failed: Authentication error`);
                return {
                    success: false,
                    error: {
                        message: 'Authentication failed. Please check your credentials.',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'testConnection'
                    }
                };
            }

            if (!response.ok) {
                console.debug(`${LOG_PREFIX} Connection test failed: HTTP ${response.status}`);
                return {
                    success: false,
                    error: {
                        message: `Server returned status ${response.status}`,
                        code: ErrorCodes.CONNECTION_FAILED,
                        recoverable: true,
                        context: 'testConnection'
                    }
                };
            }

            // Parse response body - root endpoint returns server descriptor
            const body = await response.json() as IAtelierServerDescriptor;

            // If we got here with a valid response, connection is successful
            const apiVersion = body.result?.content?.api;
            const namespaceCount = body.result?.content?.namespaces?.length || 0;
            console.debug(`${LOG_PREFIX} Connection test successful - API version: ${apiVersion}, namespaces: ${namespaceCount}`);
            return { success: true };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.debug(`${LOG_PREFIX} Connection test failed: Timeout`);
                return {
                    success: false,
                    error: {
                        message: 'Connection timed out. The server may be busy or unreachable.',
                        code: ErrorCodes.CONNECTION_TIMEOUT,
                        recoverable: true,
                        context: 'testConnection'
                    }
                };
            }

            // Network error
            console.debug(`${LOG_PREFIX} Connection test failed: Network error`, error);
            return {
                success: false,
                error: {
                    message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'testConnection'
                }
            };
        }
    }

    /**
     * Execute a SQL query against the server
     * @param spec - Server specification
     * @param namespace - Target namespace
     * @param username - Authentication username
     * @param password - Authentication password
     * @param query - SQL query string
     * @param parameters - Query parameters
     * @returns Query response or error
     */
    public async executeQuery(
        spec: IServerSpec,
        namespace: string,
        username: string,
        password: string,
        query: string,
        parameters: unknown[] = []
    ): Promise<{ success: boolean; data?: unknown[]; error?: IUserError }> {
        const url = UrlBuilder.buildQueryUrl(
            UrlBuilder.buildBaseUrl(spec),
            namespace
        );

        const headers = this._buildAuthHeaders(username, password);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query,
                    parameters
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                return {
                    success: false,
                    error: ErrorHandler.createError(ErrorCodes.AUTH_FAILED, 'executeQuery')
                };
            }

            if (!response.ok) {
                return {
                    success: false,
                    error: ErrorHandler.createError(
                        ErrorCodes.CONNECTION_FAILED,
                        'executeQuery',
                        `Server returned status ${response.status}`
                    )
                };
            }

            const body = await response.json() as IAtelierQueryResponse;

            // Check for Atelier errors
            if (body.status?.errors?.length > 0) {
                const error = ErrorHandler.parse(body, 'executeQuery');
                if (error) {
                    return { success: false, error };
                }
            }

            return {
                success: true,
                data: body.result?.content || []
            };

        } catch (error) {
            const parsedError = ErrorHandler.parse(error, 'executeQuery');
            return {
                success: false,
                error: parsedError || ErrorHandler.createError(ErrorCodes.UNKNOWN_ERROR, 'executeQuery')
            };
        }
    }

    /**
     * Get list of available namespaces from server
     * @param spec - Server specification
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Result with success flag, namespaces array, and optional error
     */
    public async getNamespaces(
        spec: IServerSpec,
        username: string,
        password: string
    ): Promise<{ success: boolean; namespaces?: string[]; error?: IUserError }> {
        // Use root endpoint - returns server descriptor with namespaces array
        const url = UrlBuilder.buildBaseUrl(spec);
        const headers = this._buildAuthHeaders(username, password);

        console.debug(`${LOG_PREFIX} Fetching namespaces from URL: ${url}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'GET',
                headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                console.debug(`${LOG_PREFIX} Get namespaces failed: Authentication error`);
                return {
                    success: false,
                    error: {
                        message: 'Authentication failed. Please check your credentials.',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'getNamespaces'
                    }
                };
            }

            if (!response.ok) {
                console.debug(`${LOG_PREFIX} Get namespaces failed: HTTP ${response.status}`);
                return {
                    success: false,
                    error: {
                        message: `Server returned status ${response.status}`,
                        code: ErrorCodes.CONNECTION_FAILED,
                        recoverable: true,
                        context: 'getNamespaces'
                    }
                };
            }

            // Parse response body
            const body = await response.json() as IAtelierServerDescriptor;

            console.debug(`${LOG_PREFIX} Namespace response:`, JSON.stringify(body));

            // Extract namespaces from result.content.namespaces
            const namespaces = body.result?.content?.namespaces || [];
            console.debug(`${LOG_PREFIX} Retrieved ${namespaces.length} namespaces`);
            return {
                success: true,
                namespaces
            };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.debug(`${LOG_PREFIX} Get namespaces failed: Timeout`);
                return {
                    success: false,
                    error: {
                        message: 'Connection timed out. The server may be busy or unreachable.',
                        code: ErrorCodes.CONNECTION_TIMEOUT,
                        recoverable: true,
                        context: 'getNamespaces'
                    }
                };
            }

            // Network error
            console.debug(`${LOG_PREFIX} Get namespaces failed: Network error`, error);
            return {
                success: false,
                error: {
                    message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'getNamespaces'
                }
            };
        }
    }

    /**
     * Get list of tables in a namespace
     * @param spec - Server specification
     * @param namespace - Target namespace
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Result with success flag, tables array, and optional error
     */
    public async getTables(
        spec: IServerSpec,
        namespace: string,
        username: string,
        password: string
    ): Promise<{ success: boolean; tables?: string[]; error?: IUserError }> {
        const url = UrlBuilder.buildQueryUrl(
            UrlBuilder.buildBaseUrl(spec),
            namespace
        );

        const headers = this._buildAuthHeaders(username, password);

        // Select both schema and table name to return fully qualified names
        // IRIS uses TABLE_SCHEMA for the schema prefix (e.g., 'Ens_Lib', 'SQLUser')
        const query = `
            SELECT TABLE_SCHEMA, TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME
        `;

        console.debug(`${LOG_PREFIX} Fetching tables from ${spec.host}:${spec.port}/${namespace}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query,
                    parameters: []
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                console.debug(`${LOG_PREFIX} Get tables failed: Authentication error`);
                return {
                    success: false,
                    error: {
                        message: 'Authentication failed. Please check your credentials.',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'getTables'
                    }
                };
            }

            if (!response.ok) {
                console.debug(`${LOG_PREFIX} Get tables failed: HTTP ${response.status}`);
                return {
                    success: false,
                    error: {
                        message: `Server returned status ${response.status}`,
                        code: ErrorCodes.CONNECTION_FAILED,
                        recoverable: true,
                        context: 'getTables'
                    }
                };
            }

            // Parse response body
            const body = await response.json() as IAtelierQueryResponse;

            // Check for Atelier errors
            if (body.status?.errors?.length > 0) {
                const error = ErrorHandler.parse(body, 'getTables');
                if (error) {
                    console.debug(`${LOG_PREFIX} Get tables failed: ${error.message}`);
                    return { success: false, error };
                }
            }

            // Extract fully qualified table names (SCHEMA.TABLE_NAME) from result
            // This ensures tables like Ens_Lib.MessageHeader and Temp.MessageHeader are distinct
            const tables = (body.result?.content || [])
                .map((row: unknown) => {
                    const r = row as { TABLE_SCHEMA: string; TABLE_NAME: string };
                    if (typeof r.TABLE_SCHEMA === 'string' && typeof r.TABLE_NAME === 'string') {
                        return `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`;
                    }
                    return null;
                })
                .filter((name): name is string => name !== null);

            console.debug(`${LOG_PREFIX} Retrieved ${tables.length} tables`);
            return {
                success: true,
                tables
            };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.debug(`${LOG_PREFIX} Get tables failed: Timeout`);
                return {
                    success: false,
                    error: {
                        message: 'Connection timed out. The server may be busy or unreachable.',
                        code: ErrorCodes.CONNECTION_TIMEOUT,
                        recoverable: true,
                        context: 'getTables'
                    }
                };
            }

            // Network error
            console.debug(`${LOG_PREFIX} Get tables failed: Network error`, error);
            return {
                success: false,
                error: {
                    message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'getTables'
                }
            };
        }
    }

    /**
     * Get table schema (column metadata) from INFORMATION_SCHEMA.COLUMNS
     * @param spec - Server specification
     * @param namespace - Target namespace
     * @param tableName - Name of the table to get schema for
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Result with success flag, schema, and optional error
     */
    public async getTableSchema(
        spec: IServerSpec,
        namespace: string,
        tableName: string,
        username: string,
        password: string
    ): Promise<{ success: boolean; schema?: ITableSchema; error?: IUserError }> {
        const url = UrlBuilder.buildQueryUrl(
            UrlBuilder.buildBaseUrl(spec),
            namespace
        );

        const headers = this._buildAuthHeaders(username, password);

        // Parse schema and table name from fully qualified name (e.g., "Ens_Lib.MessageHeader")
        const { schemaName, baseTableName } = this._parseQualifiedTableName(tableName);

        // Parameterized query to prevent SQL injection
        // Filter by both TABLE_SCHEMA and TABLE_NAME to get the correct table
        const query = `
            SELECT
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                CHARACTER_MAXIMUM_LENGTH,
                NUMERIC_PRECISION,
                NUMERIC_SCALE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `;

        console.debug(`${LOG_PREFIX} Fetching schema for table ${schemaName}.${baseTableName} in ${namespace}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query,
                    parameters: [schemaName, baseTableName]
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                console.debug(`${LOG_PREFIX} Get table schema failed: Authentication error`);
                return {
                    success: false,
                    error: {
                        message: 'Authentication failed. Please check your credentials.',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'getTableSchema'
                    }
                };
            }

            if (!response.ok) {
                console.debug(`${LOG_PREFIX} Get table schema failed: HTTP ${response.status}`);
                return {
                    success: false,
                    error: {
                        message: `Server returned status ${response.status}`,
                        code: ErrorCodes.CONNECTION_FAILED,
                        recoverable: true,
                        context: 'getTableSchema'
                    }
                };
            }

            // Parse response body
            const body = await response.json() as IAtelierQueryResponse;

            // Check for Atelier errors
            if (body.status?.errors?.length > 0) {
                const error = ErrorHandler.parse(body, 'getTableSchema');
                if (error) {
                    console.debug(`${LOG_PREFIX} Get table schema failed: ${error.message}`);
                    return { success: false, error };
                }
            }

            // Parse columns from response with runtime validation
            const columns: IColumnInfo[] = (body.result?.content || [])
                .filter((row: unknown) => {
                    // SECURITY: Validate that required fields exist and have correct types
                    if (!row || typeof row !== 'object') {
                        console.debug(`${LOG_PREFIX} Skipping invalid row: not an object`);
                        return false;
                    }
                    const r = row as Record<string, unknown>;
                    if (typeof r.COLUMN_NAME !== 'string' || !r.COLUMN_NAME) {
                        console.debug(`${LOG_PREFIX} Skipping row with invalid COLUMN_NAME`);
                        return false;
                    }
                    if (typeof r.DATA_TYPE !== 'string') {
                        console.debug(`${LOG_PREFIX} Skipping row with invalid DATA_TYPE for column ${r.COLUMN_NAME}`);
                        return false;
                    }
                    return true;
                })
                .map((row: unknown) => {
                    const r = row as {
                        COLUMN_NAME: string;
                        DATA_TYPE: string;
                        IS_NULLABLE: string;
                        CHARACTER_MAXIMUM_LENGTH?: number;
                        NUMERIC_PRECISION?: number;
                        NUMERIC_SCALE?: number;
                    };
                    const column: IColumnInfo = {
                        name: r.COLUMN_NAME,
                        dataType: r.DATA_TYPE,
                        nullable: r.IS_NULLABLE === 'YES'
                    };
                    if (r.CHARACTER_MAXIMUM_LENGTH !== undefined && r.CHARACTER_MAXIMUM_LENGTH !== null) {
                        column.maxLength = r.CHARACTER_MAXIMUM_LENGTH;
                    }
                    if (r.NUMERIC_PRECISION !== undefined && r.NUMERIC_PRECISION !== null) {
                        column.precision = r.NUMERIC_PRECISION;
                    }
                    if (r.NUMERIC_SCALE !== undefined && r.NUMERIC_SCALE !== null) {
                        column.scale = r.NUMERIC_SCALE;
                    }
                    return column;
                });

            const schema: ITableSchema = {
                tableName,
                namespace,
                columns
            };

            console.debug(`${LOG_PREFIX} Retrieved schema for ${tableName}: ${columns.length} columns`);
            return {
                success: true,
                schema
            };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.debug(`${LOG_PREFIX} Get table schema failed: Timeout`);
                return {
                    success: false,
                    error: {
                        message: 'Connection timed out. The server may be busy or unreachable.',
                        code: ErrorCodes.CONNECTION_TIMEOUT,
                        recoverable: true,
                        context: 'getTableSchema'
                    }
                };
            }

            // Network error
            console.debug(`${LOG_PREFIX} Get table schema failed: Network error`, error);
            return {
                success: false,
                error: {
                    message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'getTableSchema'
                }
            };
        }
    }

    /**
     * Get table data with pagination
     * @param spec - Server specification
     * @param namespace - Target namespace
     * @param tableName - Name of the table to get data from
     * @param schema - Table schema for column names
     * @param pageSize - Number of rows to fetch
     * @param offset - Row offset for pagination
     * @param username - Authentication username
     * @param password - Authentication password
     * @param filters - Story 6.2: Column filter criteria
     * @param sortColumn - Story 6.4: Column to sort by
     * @param sortDirection - Story 6.4: Sort direction (asc/desc/null)
     * @returns Result with success flag, rows, totalRows, and optional error
     */
    public async getTableData(
        spec: IServerSpec,
        namespace: string,
        tableName: string,
        schema: ITableSchema,
        pageSize: number,
        offset: number,
        username: string,
        password: string,
        filters: IFilterCriterion[] = [],
        sortColumn: string | null = null,
        sortDirection: SortDirection = null
    ): Promise<{ success: boolean; rows?: ITableRow[]; totalRows?: number; error?: IUserError }> {
        const url = UrlBuilder.buildQueryUrl(
            UrlBuilder.buildBaseUrl(spec),
            namespace
        );

        const headers = this._buildAuthHeaders(username, password);

        // SECURITY: Validate and escape all identifiers to prevent SQL injection
        let escapedTableName: string;
        let escapedColumnNames: string;
        let validatedPageSize: number;
        let validatedOffset: number;

        try {
            // Parse schema-qualified table name and escape each part separately
            // "Ens_Lib.MessageHeader" -> "Ens_Lib"."MessageHeader"
            const { schemaName, baseTableName } = this._parseQualifiedTableName(tableName);
            const escapedSchema = this._validateAndEscapeIdentifier(schemaName, 'schema name');
            const escapedBase = this._validateAndEscapeIdentifier(baseTableName, 'table name');
            escapedTableName = `${escapedSchema}.${escapedBase}`;
            escapedColumnNames = schema.columns
                .map(col => this._validateAndEscapeIdentifier(col.name, 'column name'))
                .join(', ');
            validatedPageSize = this._validateNumeric(pageSize, 'page size');
            validatedOffset = this._validateNumeric(offset, 'offset');
        } catch (validationError) {
            console.error(`${LOG_PREFIX} Validation error:`, validationError);
            return {
                success: false,
                error: {
                    message: validationError instanceof Error ? validationError.message : 'Invalid query parameters',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: false,
                    context: 'getTableData'
                }
            };
        }

        // Story 6.2: Build WHERE clause from filters
        // Using parameterized queries for security (prevent SQL injection)
        const { whereClause, filterParams } = this._buildFilterWhereClause(filters, schema);

        // Story 6.4: Build ORDER BY clause from sort parameters
        const orderByClause = this._buildOrderByClause(sortColumn, sortDirection, schema);

        // IRIS SQL pagination using %VID (virtual row ID for subquery results)
        // %VID is only available on the result set of a subquery, not inside it
        // NOTE: For very large tables (millions of rows), this offset-based pagination
        // may become slow. Consider cursor-based pagination for future optimization.
        let query: string;
        if (validatedOffset > 0) {
            // %VID is applied to the subquery result, filtered in outer WHERE
            // Story 6.2: Filter is applied in the inner query
            // Story 6.4: ORDER BY is applied in the inner query for correct pagination
            query = `
                SELECT TOP ${validatedPageSize} ${escapedColumnNames}
                FROM (
                    SELECT TOP ${validatedOffset + validatedPageSize} ${escapedColumnNames}
                    FROM ${escapedTableName}
                    ${whereClause}
                    ${orderByClause}
                )
                WHERE %VID > ${validatedOffset}
            `;
        } else {
            // Story 6.2: Filter is applied directly
            // Story 6.4: ORDER BY is applied directly
            query = `SELECT TOP ${validatedPageSize} ${escapedColumnNames} FROM ${escapedTableName} ${whereClause} ${orderByClause}`;
        }

        console.debug(`${LOG_PREFIX} Fetching data for table ${tableName} (page size: ${pageSize}, offset: ${offset}, filters: ${filters.length}, sort: ${sortColumn || 'none'})`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            // Execute data query
            // Story 6.2: Use parameterized query with filter values
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query,
                    parameters: filterParams
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                console.debug(`${LOG_PREFIX} Get table data failed: Authentication error`);
                return {
                    success: false,
                    error: {
                        message: 'Authentication failed. Please check your credentials.',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'getTableData'
                    }
                };
            }

            if (!response.ok) {
                console.debug(`${LOG_PREFIX} Get table data failed: HTTP ${response.status}`);
                return {
                    success: false,
                    error: {
                        message: `Server returned status ${response.status}`,
                        code: ErrorCodes.CONNECTION_FAILED,
                        recoverable: true,
                        context: 'getTableData'
                    }
                };
            }

            // Parse response body
            const body = await response.json() as IAtelierQueryResponse;

            // Check for Atelier errors
            if (body.status?.errors?.length > 0) {
                const error = ErrorHandler.parse(body, 'getTableData');
                if (error) {
                    console.debug(`${LOG_PREFIX} Get table data failed: ${error.message}`);
                    return { success: false, error };
                }
            }

            // Parse rows from response
            const rows: ITableRow[] = (body.result?.content || []) as ITableRow[];

            // Get total row count (separate query) - pass already-escaped table name
            // Story 6.2: Pass filters to count query for filtered row count
            const countResult = await this._getTableRowCount(url, headers, escapedTableName, whereClause, filterParams, controller.signal);

            console.debug(`${LOG_PREFIX} Retrieved ${rows.length} rows from ${tableName}`);
            return {
                success: true,
                rows,
                totalRows: countResult.totalRows
            };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.debug(`${LOG_PREFIX} Get table data failed: Timeout`);
                return {
                    success: false,
                    error: {
                        message: 'Connection timed out. The server may be busy or unreachable.',
                        code: ErrorCodes.CONNECTION_TIMEOUT,
                        recoverable: true,
                        context: 'getTableData'
                    }
                };
            }

            // Network error
            console.debug(`${LOG_PREFIX} Get table data failed: Network error`, error);
            return {
                success: false,
                error: {
                    message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'getTableData'
                }
            };
        }
    }

    /**
     * Get total row count for a table
     * @param url - Query endpoint URL
     * @param headers - Auth headers
     * @param escapedTableName - Already validated and escaped table name
     * @param whereClause - Story 6.2: Optional WHERE clause for filtering
     * @param filterParams - Story 6.2: Parameters for WHERE clause
     * @param signal - Abort signal
     * @returns Total row count or 0 on error
     */
    private async _getTableRowCount(
        url: string,
        headers: Record<string, string>,
        escapedTableName: string,
        whereClause: string,
        filterParams: string[],
        signal: AbortSignal
    ): Promise<{ totalRows: number }> {
        try {
            // SECURITY: tableName is already validated and escaped by caller
            // Story 6.2: Include WHERE clause for filtered count
            const countQuery = `SELECT COUNT(*) AS total FROM ${escapedTableName} ${whereClause}`;
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: countQuery,
                    parameters: filterParams
                }),
                signal
            });

            if (response.ok) {
                const body = await response.json() as IAtelierQueryResponse;
                const content = body.result?.content;
                if (content && content.length > 0) {
                    const row = content[0] as { total: number };
                    return { totalRows: row.total || 0 };
                }
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to get row count, returning 0`, error);
        }
        return { totalRows: 0 };
    }

    /**
     * Update a single cell value in a table
     * Story 3.3: Cell update with parameterized query
     * @param spec - Server specification
     * @param namespace - Target namespace
     * @param tableName - Name of the table
     * @param columnName - Name of the column to update
     * @param newValue - New value for the cell
     * @param primaryKeyColumn - Name of the primary key column (e.g., 'ID')
     * @param primaryKeyValue - Value of the primary key for the row
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Result with success flag and optional error
     */
    public async updateCell(
        spec: IServerSpec,
        namespace: string,
        tableName: string,
        columnName: string,
        newValue: unknown,
        primaryKeyColumn: string,
        primaryKeyValue: unknown,
        username: string,
        password: string
    ): Promise<{ success: boolean; rowsAffected?: number; error?: IUserError }> {
        const url = UrlBuilder.buildQueryUrl(
            UrlBuilder.buildBaseUrl(spec),
            namespace
        );

        const headers = this._buildAuthHeaders(username, password);

        // SECURITY: Validate and escape all identifiers to prevent SQL injection
        let escapedTableName: string;
        let escapedColumnName: string;
        let escapedPkColumn: string;

        try {
            // Parse schema-qualified table name and escape each part separately
            const { schemaName, baseTableName } = this._parseQualifiedTableName(tableName);
            const escapedSchema = this._validateAndEscapeIdentifier(schemaName, 'schema name');
            const escapedBase = this._validateAndEscapeIdentifier(baseTableName, 'table name');
            escapedTableName = `${escapedSchema}.${escapedBase}`;
            escapedColumnName = this._validateAndEscapeIdentifier(columnName, 'column name');
            escapedPkColumn = this._validateAndEscapeIdentifier(primaryKeyColumn, 'primary key column');
        } catch (validationError) {
            console.error(`${LOG_PREFIX} Validation error:`, validationError);
            return {
                success: false,
                error: {
                    message: validationError instanceof Error ? validationError.message : 'Invalid query parameters',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: false,
                    context: 'updateCell'
                }
            };
        }

        // SECURITY: Use parameterized query - values are NEVER interpolated into SQL
        const query = `UPDATE ${escapedTableName} SET ${escapedColumnName} = ? WHERE ${escapedPkColumn} = ?`;
        const parameters = [newValue, primaryKeyValue];

        console.debug(`${LOG_PREFIX} Updating cell: ${tableName}.${columnName} WHERE ${primaryKeyColumn}=${primaryKeyValue}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query,
                    parameters
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                console.debug(`${LOG_PREFIX} Update cell failed: Authentication error`);
                return {
                    success: false,
                    error: {
                        message: 'Authentication failed. Please check your credentials.',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'updateCell'
                    }
                };
            }

            if (!response.ok) {
                console.debug(`${LOG_PREFIX} Update cell failed: HTTP ${response.status}`);
                return {
                    success: false,
                    error: {
                        message: `Server returned status ${response.status}`,
                        code: ErrorCodes.CONNECTION_FAILED,
                        recoverable: true,
                        context: 'updateCell'
                    }
                };
            }

            // Parse response body
            const body = await response.json() as IAtelierQueryResponse;

            // Check for Atelier errors
            if (body.status?.errors?.length > 0) {
                const error = ErrorHandler.parse(body, 'updateCell');
                if (error) {
                    console.debug(`${LOG_PREFIX} Update cell failed: ${error.message}`);
                    return { success: false, error };
                }
            }

            // Success - IRIS doesn't return rowsAffected in standard response
            // but we assume 1 row was affected if no errors
            console.debug(`${LOG_PREFIX} Cell updated successfully`);
            return {
                success: true,
                rowsAffected: 1
            };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.debug(`${LOG_PREFIX} Update cell failed: Timeout`);
                return {
                    success: false,
                    error: {
                        message: 'Connection timed out. The server may be busy or unreachable.',
                        code: ErrorCodes.CONNECTION_TIMEOUT,
                        recoverable: true,
                        context: 'updateCell'
                    }
                };
            }

            // Network error
            console.debug(`${LOG_PREFIX} Update cell failed: Network error`, error);
            return {
                success: false,
                error: {
                    message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'updateCell'
                }
            };
        }
    }

    /**
     * Insert a new row into a table
     * Story 4.3: Row insertion with parameterized query
     * @param spec - Server specification
     * @param namespace - Target namespace
     * @param tableName - Name of the table
     * @param columns - Array of column names
     * @param values - Array of values (same order as columns)
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Result with success flag and optional error
     */
    public async insertRow(
        spec: IServerSpec,
        namespace: string,
        tableName: string,
        columns: string[],
        values: unknown[],
        username: string,
        password: string
    ): Promise<{ success: boolean; error?: IUserError }> {
        const url = UrlBuilder.buildQueryUrl(
            UrlBuilder.buildBaseUrl(spec),
            namespace
        );

        const headers = this._buildAuthHeaders(username, password);

        // SECURITY: Validate and escape all identifiers to prevent SQL injection
        let escapedTableName: string;
        let escapedColumnList: string;
        let placeholders: string;

        try {
            // Parse schema-qualified table name and escape each part separately
            const { schemaName, baseTableName } = this._parseQualifiedTableName(tableName);
            const escapedSchema = this._validateAndEscapeIdentifier(schemaName, 'schema name');
            const escapedBase = this._validateAndEscapeIdentifier(baseTableName, 'table name');
            escapedTableName = `${escapedSchema}.${escapedBase}`;

            // Escape each column name
            const escapedColumns = columns.map(col =>
                this._validateAndEscapeIdentifier(col, 'column name')
            );
            escapedColumnList = escapedColumns.join(', ');

            // Build placeholders for parameterized query
            placeholders = columns.map(() => '?').join(', ');
        } catch (validationError) {
            console.error(`${LOG_PREFIX} Validation error:`, validationError);
            return {
                success: false,
                error: {
                    message: validationError instanceof Error ? validationError.message : 'Invalid query parameters',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: false,
                    context: 'insertRow'
                }
            };
        }

        // SECURITY: Use parameterized query - values are NEVER interpolated into SQL
        const query = `INSERT INTO ${escapedTableName} (${escapedColumnList}) VALUES (${placeholders})`;

        console.debug(`${LOG_PREFIX} Inserting row into ${tableName} with ${columns.length} columns`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query,
                    parameters: values
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                console.debug(`${LOG_PREFIX} Insert row failed: Authentication error`);
                return {
                    success: false,
                    error: {
                        message: 'Authentication failed. Please check your credentials.',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'insertRow'
                    }
                };
            }

            if (!response.ok) {
                console.debug(`${LOG_PREFIX} Insert row failed: HTTP ${response.status}`);
                return {
                    success: false,
                    error: {
                        message: `Server returned status ${response.status}`,
                        code: ErrorCodes.CONNECTION_FAILED,
                        recoverable: true,
                        context: 'insertRow'
                    }
                };
            }

            // Parse response body
            const body = await response.json() as IAtelierQueryResponse;

            // Check for Atelier errors
            if (body.status?.errors?.length > 0) {
                const error = ErrorHandler.parse(body, 'insertRow');
                if (error) {
                    console.debug(`${LOG_PREFIX} Insert row failed: ${error.message}`);
                    return { success: false, error };
                }
            }

            console.debug(`${LOG_PREFIX} Row inserted successfully`);
            return { success: true };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.debug(`${LOG_PREFIX} Insert row failed: Timeout`);
                return {
                    success: false,
                    error: {
                        message: 'Connection timed out. The server may be busy or unreachable.',
                        code: ErrorCodes.CONNECTION_TIMEOUT,
                        recoverable: true,
                        context: 'insertRow'
                    }
                };
            }

            // Network error
            console.debug(`${LOG_PREFIX} Insert row failed: Network error`, error);
            return {
                success: false,
                error: {
                    message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'insertRow'
                }
            };
        }
    }

    /**
     * Delete a row from a table
     * Story 5.3: Row deletion with parameterized query
     * @param spec - Server specification
     * @param namespace - Target namespace
     * @param tableName - Name of the table
     * @param primaryKeyColumn - Name of the primary key column
     * @param primaryKeyValue - Value of the primary key
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Result with success flag and optional error
     */
    public async deleteRow(
        spec: IServerSpec,
        namespace: string,
        tableName: string,
        primaryKeyColumn: string,
        primaryKeyValue: unknown,
        username: string,
        password: string
    ): Promise<{ success: boolean; error?: IUserError }> {
        const url = UrlBuilder.buildQueryUrl(
            UrlBuilder.buildBaseUrl(spec),
            namespace
        );

        const headers = this._buildAuthHeaders(username, password);

        // SECURITY: Validate and escape all identifiers to prevent SQL injection
        let escapedTableName: string;
        let escapedPkColumn: string;

        try {
            // Parse schema-qualified table name and escape each part separately
            const { schemaName, baseTableName } = this._parseQualifiedTableName(tableName);
            const escapedSchema = this._validateAndEscapeIdentifier(schemaName, 'schema name');
            const escapedBase = this._validateAndEscapeIdentifier(baseTableName, 'table name');
            escapedTableName = `${escapedSchema}.${escapedBase}`;
            escapedPkColumn = this._validateAndEscapeIdentifier(primaryKeyColumn, 'primary key column');
        } catch (validationError) {
            console.error(`${LOG_PREFIX} Validation error:`, validationError);
            return {
                success: false,
                error: {
                    message: validationError instanceof Error ? validationError.message : 'Invalid query parameters',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: false,
                    context: 'deleteRow'
                }
            };
        }

        // SECURITY: Use parameterized query - values are NEVER interpolated into SQL
        const query = `DELETE FROM ${escapedTableName} WHERE ${escapedPkColumn} = ?`;
        const parameters = [primaryKeyValue];

        console.debug(`${LOG_PREFIX} Deleting row from ${tableName} WHERE ${primaryKeyColumn}=${primaryKeyValue}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query,
                    parameters
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                console.debug(`${LOG_PREFIX} Delete row failed: Authentication error`);
                return {
                    success: false,
                    error: {
                        message: 'Authentication failed. Please check your credentials.',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'deleteRow'
                    }
                };
            }

            if (!response.ok) {
                console.debug(`${LOG_PREFIX} Delete row failed: HTTP ${response.status}`);
                return {
                    success: false,
                    error: {
                        message: `Server returned status ${response.status}`,
                        code: ErrorCodes.CONNECTION_FAILED,
                        recoverable: true,
                        context: 'deleteRow'
                    }
                };
            }

            // Parse response body
            const body = await response.json() as IAtelierQueryResponse;

            // Check for Atelier errors (e.g., foreign key constraint violations)
            if (body.status?.errors?.length > 0) {
                const error = ErrorHandler.parse(body, 'deleteRow');
                if (error) {
                    console.debug(`${LOG_PREFIX} Delete row failed: ${error.message}`);
                    return { success: false, error };
                }
            }

            console.debug(`${LOG_PREFIX} Row deleted successfully`);
            return { success: true };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.debug(`${LOG_PREFIX} Delete row failed: Timeout`);
                return {
                    success: false,
                    error: {
                        message: 'Connection timed out. The server may be busy or unreachable.',
                        code: ErrorCodes.CONNECTION_TIMEOUT,
                        recoverable: true,
                        context: 'deleteRow'
                    }
                };
            }

            // Network error
            console.debug(`${LOG_PREFIX} Delete row failed: Network error`, error);
            return {
                success: false,
                error: {
                    message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'deleteRow'
                }
            };
        }
    }

    /**
     * Set the request timeout
     * @param timeout - Timeout in milliseconds
     */
    public setTimeout(timeout: number): void {
        this._timeout = timeout;
    }

    /**
     * Build HTTP headers with Basic Auth
     * SECURITY: Password is used here only, never stored
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Headers object with Authorization
     */
    private _buildAuthHeaders(username: string, password: string): Record<string, string> {
        const credentials = `${username}:${password}`;
        const encoded = Buffer.from(credentials).toString('base64');
        return {
            'Authorization': `Basic ${encoded}`,
            'Content-Type': 'application/json'
        };
    }
}
