/**
 * Column metadata information from INFORMATION_SCHEMA.COLUMNS
 * Per architecture.md schema interface requirements
 */
export interface IColumnInfo {
    /** Column name from COLUMN_NAME */
    name: string;
    /** SQL data type from DATA_TYPE (e.g., 'VARCHAR', 'INTEGER', 'TIMESTAMP') */
    dataType: string;
    /** Whether column allows NULL values (from IS_NULLABLE === 'YES') */
    nullable: boolean;
    /** Maximum character length for string types (from CHARACTER_MAXIMUM_LENGTH) */
    maxLength?: number;
    /** Numeric precision for numeric types (from NUMERIC_PRECISION) */
    precision?: number;
    /** Numeric scale for decimal types (from NUMERIC_SCALE) */
    scale?: number;
    /** Whether column is read-only (identity/auto-increment or computed/generated) */
    readOnly?: boolean;
}

/**
 * Table schema containing metadata about a database table
 * Per architecture.md schema interface requirements
 */
export interface ITableSchema {
    /** Table name */
    tableName: string;
    /** Namespace containing the table */
    namespace: string;
    /** Array of column information in ordinal position order */
    columns: IColumnInfo[];
}
