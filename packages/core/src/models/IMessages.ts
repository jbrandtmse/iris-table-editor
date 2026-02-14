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
 * Payload for cancelConnection command (Story 1.7)
 */
export type ICancelConnectionPayload = IEmptyPayload;

/**
 * Payload for connectionProgress event (Story 1.7)
 * Reports connection lifecycle updates to the webview
 */
export interface IConnectionProgressPayload {
    status: 'connecting' | 'connected' | 'timeout' | 'cancelled' | 'error';
    serverName: string;
    message?: string;
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
 * Filter criteria for column filtering (Story 6.2)
 */
export interface IFilterCriterion {
    column: string;
    value: string;
}

/**
 * Sort direction type for column sorting (Story 6.4)
 */
export type SortDirection = 'asc' | 'desc' | null;

/**
 * Payload for requestData command (grid webview to extension)
 * Story 6.2: Added filters support
 * Story 6.4: Added sort support
 */
export interface IRequestDataPayload {
    page: number;
    pageSize: number;
    filters?: IFilterCriterion[];
    sortColumn?: string;
    sortDirection?: SortDirection;
}

/**
 * Payload for paginate command (grid webview to extension)
 * Story 2.2: Pagination support
 * Story 6.2: Added filters support
 * Story 6.4: Added sort support
 */
export interface IPaginatePayload {
    direction: 'next' | 'prev';
    currentPage: number;
    pageSize: number;
    filters?: IFilterCriterion[];
    sortColumn?: string;
    sortDirection?: SortDirection;
}

/**
 * Payload for refresh command (grid webview to extension)
 * Story 6.2: Added filters support
 * Story 6.4: Added sort support
 */
export interface IRefreshPayload {
    filters?: IFilterCriterion[];
    sortColumn?: string;
    sortDirection?: SortDirection;
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
    | { command: 'openTable'; payload: IOpenTablePayload }
    | { command: 'cancelConnection'; payload: ICancelConnectionPayload };

/**
 * Grid-related commands sent from grid webview to extension
 * Story 3.3: Added saveCell command
 * Story 4.3: Added insertRow command
 * Story 5.3: Added deleteRow command
 * Story 6.2: Added filter support to data commands
 */
export type GridCommand =
    | { command: 'requestData'; payload: IRequestDataPayload }
    | { command: 'refresh'; payload: IRefreshPayload }
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
    | { event: 'connectionProgress'; payload: IConnectionProgressPayload }
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

// ============================================
// Story 12.1: Desktop Connection Manager Messages
// ============================================

/**
 * Server info with connection details for desktop server list UI
 * Story 12.1: Server List UI
 */
export interface IDesktopServerInfo {
    name: string;
    hostname: string;
    port: number;
    description?: string;
    ssl: boolean;
    status?: 'connected' | 'disconnected';
}

/**
 * Payload for desktop serversLoaded event
 * Story 12.1: Server List UI
 */
export interface IDesktopServersLoadedPayload {
    servers: IDesktopServerInfo[];
}

/**
 * Payload for desktop serverDeleted event
 * Story 12.1: Server List UI
 */
export interface IDesktopServerDeletedPayload {
    serverName: string;
}

/**
 * Payload for desktop server commands that reference a server by name
 * Story 12.1: Server List UI
 */
export interface IDesktopServerNamePayload {
    serverName: string | null;
}

/**
 * Commands sent from desktop server list UI to host
 * Story 12.1: Server List UI
 * Story 12.2: Added saveServer, updateServer commands
 * Story 12.5: Added disconnectServer, cancelConnection commands
 */
export type DesktopConnectionCommand =
    | { command: 'getServers'; payload: IEmptyPayload }
    | { command: 'connectServer'; payload: IDesktopServerNamePayload }
    | { command: 'disconnectServer'; payload: IEmptyPayload }
    | { command: 'cancelConnection'; payload: IEmptyPayload }
    | { command: 'editServer'; payload: IDesktopServerNamePayload }
    | { command: 'deleteServer'; payload: IDesktopServerNamePayload }
    | { command: 'testConnection'; payload: IDesktopServerNamePayload }
    | { command: 'testFormConnection'; payload: IDesktopTestConnectionPayload }
    | { command: 'selectServer'; payload: IDesktopServerNamePayload }
    | { command: 'saveServer'; payload: IDesktopSaveServerPayload }
    | { command: 'updateServer'; payload: IDesktopUpdateServerPayload };

/**
 * Events sent from host to desktop server list UI
 * Story 12.1: Server List UI
 * Story 12.2: Added serverSaved, serverSaveError, serverConfigLoaded events
 * Story 12.5: Added connectionProgress event
 */
export type DesktopConnectionEvent =
    | { event: 'serversLoaded'; payload: IDesktopServersLoadedPayload }
    | { event: 'serverSelected'; payload: ISelectServerPayload }
    | { event: 'connectionStatus'; payload: IConnectionStatusPayload }
    | { event: 'connectionProgress'; payload: IDesktopConnectionProgressPayload }
    | { event: 'serverDeleted'; payload: IDesktopServerDeletedPayload }
    | { event: 'serverSaved'; payload: IDesktopServerSavedPayload }
    | { event: 'serverSaveError'; payload: IDesktopServerSaveErrorPayload }
    | { event: 'serverConfigLoaded'; payload: IDesktopServerConfigPayload }
    | { event: 'testConnectionResult'; payload: IDesktopTestConnectionResultPayload }
    | { event: 'credentialWarning'; payload: IDesktopCredentialWarningPayload }
    | { event: 'error'; payload: IErrorPayload };

// ============================================
// Story 12.5: Connection Lifecycle Messages
// ============================================

/**
 * Payload for desktop connectionProgress event
 * Reports connection lifecycle updates to the desktop server list UI
 * Story 12.5: Connection Lifecycle
 */
export interface IDesktopConnectionProgressPayload {
    status: 'connecting' | 'connected' | 'disconnected' | 'cancelled' | 'error';
    serverName: string;
    message?: string;
}

// ============================================
// Story 12.4: Credential Storage Messages
// ============================================

/**
 * Payload for credentialWarning event (when encryption is unavailable)
 * Story 12.4: Credential Storage
 */
export interface IDesktopCredentialWarningPayload {
    message: string;
}

// ============================================
// Story 12.3: Test Connection Messages
// ============================================

/**
 * Payload for testFormConnection command (test connection from form with unsaved config)
 * Story 12.3: Test Connection
 */
export interface IDesktopTestConnectionPayload {
    hostname: string;
    port: number;
    pathPrefix?: string;
    ssl: boolean;
    username: string;
    password: string;
}

/**
 * Payload for testConnectionResult event
 * Story 12.3: Test Connection
 */
export interface IDesktopTestConnectionResultPayload {
    success: boolean;
    message: string;
}

// ============================================
// Story 12.2: Server Form Messages
// ============================================

/**
 * Payload for saveServer command (new server)
 * Story 12.2: Server Form
 */
export interface IDesktopSaveServerPayload {
    name: string;
    hostname: string;
    port: number;
    username: string;
    password: string;
    ssl: boolean;
    description?: string;
    pathPrefix?: string;
}

/**
 * Payload for updateServer command (edit existing)
 * Story 12.2: Server Form
 */
export interface IDesktopUpdateServerPayload {
    /** Original server name (for lookup) */
    originalName: string;
    name: string;
    hostname: string;
    port: number;
    username: string;
    /** Empty string means keep existing password */
    password: string;
    ssl: boolean;
    description?: string;
    pathPrefix?: string;
}

/**
 * Payload for serverSaved event (success response)
 * Story 12.2: Server Form
 */
export interface IDesktopServerSavedPayload {
    serverName: string;
    mode: 'add' | 'edit';
}

/**
 * Payload for serverSaveError event (error response)
 * Story 12.2: Server Form
 */
export interface IDesktopServerSaveErrorPayload {
    message: string;
    field?: string;
}

/**
 * Payload for serverConfigLoaded event (server config for edit form)
 * Story 12.2: Server Form
 */
export interface IDesktopServerConfigPayload {
    name: string;
    hostname: string;
    port: number;
    username: string;
    ssl: boolean;
    description?: string;
    pathPrefix?: string;
}
