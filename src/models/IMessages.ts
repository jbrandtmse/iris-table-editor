/**
 * Command/Event message types for webview-extension communication
 * Per architecture.md Command/Event Message Format
 */

import type { IColumnInfo } from './ITableSchema';

/**
 * Command message sent from webview to extension
 */
export interface ICommand<T = unknown> {
    command: string;
    payload: T;
}

/**
 * Event message sent from extension to webview
 */
export interface IEvent<T = unknown> {
    event: string;
    payload: T;
}

/**
 * Payload for server list event
 */
export interface IServerListPayload {
    servers: string[];
}

/**
 * Payload for error events
 */
export interface IErrorPayload {
    message: string;
    code: string;
    recoverable: boolean;
    context: string;
}

/**
 * User-facing error interface - re-exported from ErrorHandler for convenience
 * IMPORTANT: ErrorHandler.ts is the source of truth for IUserError
 */
export { IUserError, ErrorCode } from '../utils/ErrorHandler';

/**
 * Empty payload type for events with no data
 */
export type IEmptyPayload = Record<string, never>;

/**
 * Payload for selectServer command
 */
export interface ISelectServerPayload {
    serverName: string;
}

/**
 * Payload for disconnect command
 */
export type IDisconnectPayload = IEmptyPayload;

/**
 * Payload for connectionStatus event
 */
export interface IConnectionStatusPayload {
    connected: boolean;
    serverName: string | null;
    namespace?: string;  // May be populated later in Story 1.5
}

/**
 * Payload for connectionError event
 */
export interface IConnectionErrorPayload extends IErrorPayload {
    serverName: string;  // Which server failed
}

/**
 * Payload for getNamespaces command (no payload needed)
 */
export type IGetNamespacesPayload = IEmptyPayload;

/**
 * Payload for selectNamespace command
 */
export interface ISelectNamespacePayload {
    namespace: string;
}

/**
 * Payload for namespaceList event
 */
export interface INamespaceListPayload {
    namespaces: string[];
}

/**
 * Payload for namespaceSelected event
 */
export interface INamespaceSelectedPayload {
    namespace: string;
}

/**
 * Payload for getTables command
 */
export interface IGetTablesPayload {
    namespace: string;
}

/**
 * Payload for selectTable command
 */
export interface ISelectTablePayload {
    namespace: string;
    tableName: string;
}

/**
 * Payload for tableList event
 */
export interface ITableListPayload {
    tables: string[];
    namespace: string;
}

/**
 * Payload for tableSelected event
 */
export interface ITableSelectedPayload {
    tableName: string;
    namespace: string;
}

// Re-export types for grid webview
export type { ITableSchema, IColumnInfo } from './ITableSchema';
export type { ITableRow, ITableDataResult } from './ITableData';

/**
 * Payload for openTable command (from sidebar to extension)
 */
export interface IOpenTablePayload {
    namespace: string;
    tableName: string;
}

/**
 * Payload for tableSchema event (extension to grid webview)
 */
export interface ITableSchemaPayload {
    tableName: string;
    namespace: string;
    serverName: string;
    columns: IColumnInfo[];
}

/**
 * Payload for tableData event (extension to grid webview)
 */
export interface ITableDataPayload {
    rows: Record<string, unknown>[];
    totalRows: number;
    page: number;
    pageSize: number;
}

/**
 * Payload for tableLoading event (extension to grid webview)
 */
export interface ITableLoadingPayload {
    loading: boolean;
    context: string;
}

/**
 * Payload for requestData command (grid webview to extension)
 */
export interface IRequestDataPayload {
    page: number;
    pageSize: number;
}

/**
 * Payload for paginate command (grid webview to extension)
 * Story 2.2: Pagination support
 */
export interface IPaginatePayload {
    direction: 'next' | 'prev';
    currentPage: number;
    pageSize: number;
}

/**
 * Payload for saveCell command (grid webview to extension)
 * Story 3.3: Cell update support
 */
export interface ISaveCellPayload {
    rowIndex: number;
    colIndex: number;
    columnName: string;
    oldValue: unknown;
    newValue: unknown;
    primaryKeyColumn: string;
    primaryKeyValue: unknown;
}

/**
 * Payload for saveCellResult event (extension to grid webview)
 * Story 3.3: Cell update result
 */
export interface ISaveCellResultPayload {
    success: boolean;
    rowIndex: number;
    colIndex: number;
    columnName: string;
    oldValue: unknown;
    newValue: unknown;
    primaryKeyValue: unknown;
    error?: {
        message: string;
        code: string;
    };
}

/**
 * Payload for insertRow command (grid webview to extension)
 * Story 4.3: New row insertion
 */
export interface IInsertRowPayload {
    newRowIndex: number;       // Index in newRows array
    columns: string[];         // Column names
    values: unknown[];         // Column values (same order as columns)
}

/**
 * Payload for insertRowResult event (extension to grid webview)
 * Story 4.3: New row insertion result
 */
export interface IInsertRowResultPayload {
    success: boolean;
    newRowIndex: number;       // Original index in newRows array
    error?: {
        message: string;
        code: string;
    };
}

/**
 * Payload for deleteRow command (grid webview to extension)
 * Story 5.3: Row deletion
 */
export interface IDeleteRowPayload {
    rowIndex: number;              // Index of the row in the grid
    primaryKeyColumn: string;      // Name of the primary key column
    primaryKeyValue: unknown;      // Value of the primary key
}

/**
 * Payload for deleteRowResult event (extension to grid webview)
 * Story 5.3: Row deletion result
 */
export interface IDeleteRowResultPayload {
    success: boolean;
    rowIndex: number;              // Original row index for UI update
    error?: {
        message: string;
        code: string;
    };
}

/**
 * Server-related commands sent from webview to extension
 */
export type ServerCommand =
    | { command: 'getServerList'; payload: IEmptyPayload }
    | { command: 'selectServer'; payload: ISelectServerPayload }
    | { command: 'disconnect'; payload: IDisconnectPayload }
    | { command: 'openServerManager'; payload: IEmptyPayload }
    | { command: 'getNamespaces'; payload: IGetNamespacesPayload }
    | { command: 'selectNamespace'; payload: ISelectNamespacePayload }
    | { command: 'getTables'; payload: IGetTablesPayload }
    | { command: 'selectTable'; payload: ISelectTablePayload }
    | { command: 'openTable'; payload: IOpenTablePayload };

/**
 * Grid-related commands sent from grid webview to extension
 * Story 3.3: Added saveCell command
 * Story 4.3: Added insertRow command
 * Story 5.3: Added deleteRow command
 */
export type GridCommand =
    | { command: 'requestData'; payload: IRequestDataPayload }
    | { command: 'refresh'; payload: IEmptyPayload }
    | { command: 'paginateNext'; payload: IPaginatePayload }
    | { command: 'paginatePrev'; payload: IPaginatePayload }
    | { command: 'saveCell'; payload: ISaveCellPayload }
    | { command: 'insertRow'; payload: IInsertRowPayload }
    | { command: 'deleteRow'; payload: IDeleteRowPayload };

/**
 * Server-related events sent from extension to webview
 */
export type ServerEvent =
    | { event: 'serverList'; payload: IServerListPayload }
    | { event: 'serverManagerNotInstalled'; payload: IEmptyPayload }
    | { event: 'noServersConfigured'; payload: IEmptyPayload }
    | { event: 'connectionStatus'; payload: IConnectionStatusPayload }
    | { event: 'connectionError'; payload: IConnectionErrorPayload }
    | { event: 'namespaceList'; payload: INamespaceListPayload }
    | { event: 'namespaceSelected'; payload: INamespaceSelectedPayload }
    | { event: 'tableList'; payload: ITableListPayload }
    | { event: 'tableSelected'; payload: ITableSelectedPayload }
    | { event: 'error'; payload: IErrorPayload };

/**
 * Grid-related events sent from extension to grid webview
 * Story 3.3: Added saveCellResult event
 * Story 4.3: Added insertRowResult event
 * Story 5.3: Added deleteRowResult event
 */
export type GridEvent =
    | { event: 'tableSchema'; payload: ITableSchemaPayload }
    | { event: 'tableData'; payload: ITableDataPayload }
    | { event: 'tableLoading'; payload: ITableLoadingPayload }
    | { event: 'saveCellResult'; payload: ISaveCellResultPayload }
    | { event: 'insertRowResult'; payload: IInsertRowResultPayload }
    | { event: 'deleteRowResult'; payload: IDeleteRowResultPayload }
    | { event: 'error'; payload: IErrorPayload };
