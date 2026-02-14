/**
 * SQL query building utilities for IRIS Table Editor
 * Pure utility functions for identifier validation, query construction,
 * and filter/order clause building.
 *
 * SECURITY: All SQL generation uses parameterized queries with ? placeholders.
 * Identifiers are validated against a strict pattern to prevent SQL injection.
 */

import { IFilterCriterion, SortDirection } from '../models/IMessages';
import { ITableSchema } from '../models/ITableSchema';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Regular expression for valid SQL identifiers
 * Allows: letters, numbers, underscore, dot (for schema.table), percent (for IRIS system tables like %Dictionary)
 * SECURITY: This is used to prevent SQL injection in dynamic queries
 */
const VALID_SQL_IDENTIFIER = /^[a-zA-Z_%][a-zA-Z0-9_%$.]*$/;

/**
 * Validate and escape a SQL identifier (table name, column name)
 * SECURITY: Prevents SQL injection by validating identifier format
 * @param identifier - The identifier to validate
 * @param context - Context for error messages (e.g., 'table name', 'column name')
 * @returns The escaped identifier wrapped in delimited identifier quotes
 * @throws Error if identifier is invalid
 */
export function validateAndEscapeIdentifier(identifier: string, context: string): string {
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
export function validateNumeric(value: number, context: string): number {
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
export function parseQualifiedTableName(qualifiedName: string): { schemaName: string; baseTableName: string } {
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
 * Escape a qualified table name (schema.table) for use in SQL
 * @param tableName - Fully qualified or simple table name
 * @returns Escaped table name string like "Schema"."Table"
 */
export function escapeTableName(tableName: string): string {
    const { schemaName, baseTableName } = parseQualifiedTableName(tableName);
    const escapedSchema = validateAndEscapeIdentifier(schemaName, 'schema name');
    const escapedBase = validateAndEscapeIdentifier(baseTableName, 'table name');
    return `${escapedSchema}.${escapedBase}`;
}

/**
 * Build WHERE clause from filter criteria
 * Uses parameterized queries for security (prevents SQL injection)
 * Supports wildcards: * -> %, ? -> _ for LIKE patterns
 * @param filters - Array of column filter criteria
 * @param schema - Table schema for column validation
 * @returns Object with WHERE clause string and parameter values
 */
export function buildFilterWhereClause(filters: IFilterCriterion[], schema: ITableSchema): { whereClause: string; filterParams: string[] } {
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
        const escapedColumn = validateAndEscapeIdentifier(filter.column, 'filter column');

        // Convert wildcards and determine if LIKE is needed
        // * -> % (match any characters)
        // ? -> _ (match single character)
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

    // AND logic: all conditions must match
    return {
        whereClause: `WHERE ${conditions.join(' AND ')}`,
        filterParams: params
    };
}

/**
 * Build ORDER BY clause from sort parameters
 * Validates column exists in schema to prevent SQL injection
 * @param sortColumn - Column to sort by (null for no sorting)
 * @param sortDirection - Sort direction ('asc', 'desc', or null)
 * @param schema - Table schema for column validation
 * @returns ORDER BY clause string (empty if no sorting)
 */
export function buildOrderByClause(
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
    const escapedColumn = validateAndEscapeIdentifier(sortColumn, 'sort column');

    // Validate direction (only 'asc' or 'desc' allowed)
    const direction = sortDirection.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    return `ORDER BY ${escapedColumn} ${direction}`;
}
