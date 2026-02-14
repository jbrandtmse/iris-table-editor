/**
 * Table data interfaces for grid display
 * Per architecture.md data interface requirements
 */

/**
 * Single row of table data - key is column name, value is cell data
 */
export type ITableRow = Record<string, unknown>;

/**
 * Result of a table data query with pagination info
 */
export interface ITableDataResult {
    /** Array of row data */
    rows: ITableRow[];
    /** Total number of rows in the table (for pagination display) */
    totalRows: number;
    /** Current page number (0-indexed) */
    page: number;
    /** Number of rows per page */
    pageSize: number;
}
