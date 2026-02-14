/**
 * Table metadata retrieval service for IRIS Table Editor
 * Handles namespace listing, table listing, and schema retrieval.
 * Delegates to AtelierApiService for HTTP transport.
 */

import { IServerSpec } from '../models/IServerSpec';
import { IUserError } from '../models/IMessages';
import { IColumnInfo, ITableSchema } from '../models/ITableSchema';
import { ErrorCodes } from '../utils/ErrorHandler';
import { UrlBuilder } from '../utils/UrlBuilder';
import { parseQualifiedTableName } from '../utils/SqlBuilder';
import { AtelierApiService, IAtelierServerDescriptor } from './AtelierApiService';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Service for retrieving table and namespace metadata from IRIS
 * Uses AtelierApiService for HTTP transport
 */
export class TableMetadataService {
    constructor(private readonly _apiService: AtelierApiService) {}

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

        console.debug(`${LOG_PREFIX} Fetching namespaces from URL: ${url}`);

        try {
            // Use raw fetch for root endpoint (not a query endpoint)
            const headers = this._apiService.buildAuthHeaders(username, password);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._apiService.getTimeout());

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
        const query = `
            SELECT TABLE_SCHEMA, TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME
        `;

        console.debug(`${LOG_PREFIX} Fetching tables from ${spec.host}:${spec.port}/${namespace}`);

        const result = await this._apiService.executeQuery(
            spec,
            namespace,
            username,
            password,
            query
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        // Extract fully qualified table names (SCHEMA.TABLE_NAME)
        const tables = (result.data || [])
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
        // Parse schema and table name from fully qualified name
        const { schemaName, baseTableName } = parseQualifiedTableName(tableName);

        // Parameterized query to prevent SQL injection
        const query = `
            SELECT
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                CHARACTER_MAXIMUM_LENGTH,
                NUMERIC_PRECISION,
                NUMERIC_SCALE,
                IS_IDENTITY,
                IS_GENERATED
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `;

        console.debug(`${LOG_PREFIX} Fetching schema for table ${schemaName}.${baseTableName} in ${namespace}`);

        const result = await this._apiService.executeQuery(
            spec,
            namespace,
            username,
            password,
            query,
            [schemaName, baseTableName]
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        // Parse columns from response with runtime validation
        const columns: IColumnInfo[] = (result.data || [])
            .filter((row: unknown) => {
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
                    IS_IDENTITY?: string;
                    IS_GENERATED?: string;
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
                if (r.IS_IDENTITY === 'YES' || r.IS_GENERATED === 'YES') {
                    column.readOnly = true;
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
    }
}
