/**
 * SQL CRUD operations for IRIS Table Editor
 * Delegates to AtelierApiService for HTTP transport and SqlBuilder for query construction.
 */

import { IServerSpec } from '../models/IServerSpec';
import { IUserError, IFilterCriterion, SortDirection } from '../models/IMessages';
import { ITableSchema } from '../models/ITableSchema';
import { ITableRow } from '../models/ITableData';
import { ErrorCodes } from '../utils/ErrorHandler';
import {
    validateAndEscapeIdentifier,
    validateNumeric,
    escapeTableName,
    buildFilterWhereClause,
    buildOrderByClause
} from '../utils/SqlBuilder';
import { AtelierApiService } from './AtelierApiService';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Service for executing CRUD SQL operations against IRIS
 * Uses AtelierApiService for HTTP transport and SqlBuilder for query construction
 */
export class QueryExecutor {
    constructor(private readonly _apiService: AtelierApiService) {}

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
     * @param filters - Column filter criteria
     * @param sortColumn - Column to sort by
     * @param sortDirection - Sort direction (asc/desc/null)
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
        // SECURITY: Validate and escape all identifiers to prevent SQL injection
        let escapedTableName: string;
        let escapedColumnNames: string;
        let validatedPageSize: number;
        let validatedOffset: number;

        try {
            escapedTableName = escapeTableName(tableName);
            escapedColumnNames = schema.columns
                .map(col => validateAndEscapeIdentifier(col.name, 'column name'))
                .join(', ');
            validatedPageSize = validateNumeric(pageSize, 'page size');
            validatedOffset = validateNumeric(offset, 'offset');
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

        // Build WHERE clause from filters
        const { whereClause, filterParams } = buildFilterWhereClause(filters, schema);

        // Build ORDER BY clause from sort parameters
        const orderByClause = buildOrderByClause(sortColumn, sortDirection, schema);

        // IRIS SQL pagination using %VID (virtual row ID for subquery results)
        let query: string;
        if (validatedOffset > 0) {
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
            query = `SELECT TOP ${validatedPageSize} ${escapedColumnNames} FROM ${escapedTableName} ${whereClause} ${orderByClause}`;
        }

        console.debug(`${LOG_PREFIX} Fetching data for table ${tableName} (page size: ${pageSize}, offset: ${offset}, filters: ${filters.length}, sort: ${sortColumn || 'none'})`);

        const result = await this._apiService.executeQuery(
            spec,
            namespace,
            username,
            password,
            query,
            filterParams
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        const rows: ITableRow[] = (result.data || []) as ITableRow[];

        // Get total row count (separate query)
        const countResult = await this._getTableRowCount(
            spec, namespace, username, password,
            escapedTableName, whereClause, filterParams
        );

        console.debug(`${LOG_PREFIX} Retrieved ${rows.length} rows from ${tableName}`);
        return {
            success: true,
            rows,
            totalRows: countResult.totalRows
        };
    }

    /**
     * Update a single cell value in a table
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
        // SECURITY: Validate and escape all identifiers to prevent SQL injection
        let escapedTableName: string;
        let escapedColumnName: string;
        let escapedPkColumn: string;

        try {
            escapedTableName = escapeTableName(tableName);
            escapedColumnName = validateAndEscapeIdentifier(columnName, 'column name');
            escapedPkColumn = validateAndEscapeIdentifier(primaryKeyColumn, 'primary key column');
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

        const result = await this._apiService.executeQuery(
            spec,
            namespace,
            username,
            password,
            query,
            parameters
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        console.debug(`${LOG_PREFIX} Cell updated successfully`);
        return { success: true, rowsAffected: 1 };
    }

    /**
     * Insert a new row into a table
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
        // SECURITY: Validate and escape all identifiers to prevent SQL injection
        let escapedTableName: string;
        let escapedColumnList: string;
        let placeholders: string;

        try {
            escapedTableName = escapeTableName(tableName);

            // Escape each column name
            const escapedColumns = columns.map(col =>
                validateAndEscapeIdentifier(col, 'column name')
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

        const result = await this._apiService.executeQuery(
            spec,
            namespace,
            username,
            password,
            query,
            values
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        console.debug(`${LOG_PREFIX} Row inserted successfully`);
        return { success: true };
    }

    /**
     * Delete a row from a table
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
        // SECURITY: Validate and escape all identifiers to prevent SQL injection
        let escapedTableName: string;
        let escapedPkColumn: string;

        try {
            escapedTableName = escapeTableName(tableName);
            escapedPkColumn = validateAndEscapeIdentifier(primaryKeyColumn, 'primary key column');
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

        const result = await this._apiService.executeQuery(
            spec,
            namespace,
            username,
            password,
            query,
            parameters
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        console.debug(`${LOG_PREFIX} Row deleted successfully`);
        return { success: true };
    }

    /**
     * Get total row count for a table
     * @param spec - Server specification
     * @param namespace - Target namespace
     * @param username - Authentication username
     * @param password - Authentication password
     * @param escapedTableName - Already validated and escaped table name
     * @param whereClause - Optional WHERE clause for filtering
     * @param filterParams - Parameters for WHERE clause
     * @returns Total row count or 0 on error
     */
    private async _getTableRowCount(
        spec: IServerSpec,
        namespace: string,
        username: string,
        password: string,
        escapedTableName: string,
        whereClause: string,
        filterParams: string[]
    ): Promise<{ totalRows: number }> {
        try {
            // SECURITY: tableName is already validated and escaped by caller
            const countQuery = `SELECT COUNT(*) AS total FROM ${escapedTableName} ${whereClause}`;
            const result = await this._apiService.executeQuery(
                spec,
                namespace,
                username,
                password,
                countQuery,
                filterParams
            );

            if (result.success && result.data && result.data.length > 0) {
                const row = result.data[0] as { total: number };
                return { totalRows: row.total || 0 };
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to get row count, returning 0`, error);
        }
        return { totalRows: 0 };
    }
}
