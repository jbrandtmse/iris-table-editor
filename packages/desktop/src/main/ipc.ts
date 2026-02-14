/**
 * IPC handler registration for Electron main process
 * Story 11.1: Electron Bootstrap
 * Story 11.2: IPC Bridge — data command routing
 *
 * Routes commands from the renderer process to appropriate service methods.
 * Sends event responses back to the renderer via BrowserWindow.webContents.
 *
 * IPC channel design:
 * - Inbound: ipcMain.on('command', ...) — receives { command, payload } from renderer
 * - Outbound: win.webContents.send('event:{name}', payload) — sends events to renderer
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { ConnectionManager, ServerConfig } from './ConnectionManager';
import type { ConnectionLifecycleManager } from './ConnectionLifecycleManager';
import type { SessionManager } from './SessionManager';
import type {
    IDesktopSaveServerPayload,
    IDesktopUpdateServerPayload,
    IDesktopTestConnectionPayload,
    IDesktopServerNamePayload,
    IDesktopServerInfo,
    ISelectTablePayload,
    IGetTablesPayload,
    IRequestDataPayload,
    IPaginatePayload,
    IRefreshPayload,
    ISaveCellPayload,
    IInsertRowPayload,
    IDeleteRowPayload,
    IServerSpec,
} from '@iris-te/core';

const LOG_PREFIX = '[IRIS-TE IPC]';

/**
 * Command payload received from the renderer process.
 */
export interface IpcCommandMessage {
    command: string;
    payload: unknown;
}

/**
 * Send an event to the renderer process via BrowserWindow.
 * @param win - The target BrowserWindow
 * @param eventName - Event name (will be prefixed with 'event:')
 * @param payload - Event payload data
 */
export function sendEvent(win: BrowserWindow, eventName: string, payload: unknown): void {
    if (win.isDestroyed()) {
        console.warn(`${LOG_PREFIX} Cannot send event "${eventName}" — window is destroyed`);
        return;
    }
    win.webContents.send(`event:${eventName}`, payload);
}

/**
 * Send an error event to the renderer process.
 * @param win - The target BrowserWindow
 * @param message - User-friendly error message
 * @param context - Context where the error occurred (e.g., command name)
 */
function sendError(win: BrowserWindow, message: string, context: string): void {
    sendEvent(win, 'error', {
        message,
        code: 'IPC_ERROR',
        recoverable: true,
        context,
    });
}

/**
 * Convert a ServerConfig to IDesktopServerInfo for the renderer.
 */
function toServerInfo(config: ServerConfig): IDesktopServerInfo {
    return {
        name: config.name,
        hostname: config.hostname,
        port: config.port,
        description: config.description,
        ssl: config.ssl,
    };
}

/**
 * Default page size for data queries
 */
const DEFAULT_PAGE_SIZE = 100;

/**
 * Check if a session is active and return the session info needed for data operations.
 * Sends an error event if not connected.
 *
 * @param sessionManager - SessionManager instance
 * @param win - BrowserWindow for error events
 * @param context - Command name for error context
 * @returns Session info or null if not connected
 */
export function requireSession(
    sessionManager: SessionManager | undefined,
    win: BrowserWindow,
    context: string
): { spec: IServerSpec; username: string; password: string } | null {
    if (!sessionManager || !sessionManager.isActive()) {
        sendError(win, 'Not connected to a server', context);
        return null;
    }

    // isActive() guarantees these are non-null
    return {
        spec: sessionManager.getServerSpec()!,
        username: sessionManager.getUsername()!,
        password: sessionManager.getPassword()!,
    };
}

/**
 * Route a command to the appropriate service method.
 * Extracted as a standalone function for testability without Electron runtime.
 *
 * @param command - Command name from the renderer
 * @param payload - Command payload
 * @param win - The BrowserWindow to send events back to
 * @param connectionManager - ConnectionManager instance
 * @param lifecycleManager - ConnectionLifecycleManager instance
 * @param sessionManager - SessionManager instance for data commands
 */
export async function routeCommand(
    command: string,
    payload: unknown,
    win: BrowserWindow,
    connectionManager: ConnectionManager,
    lifecycleManager: ConnectionLifecycleManager,
    sessionManager?: SessionManager
): Promise<void> {
    switch (command) {
        case 'getServers': {
            const servers = connectionManager.getServers();
            const serverInfos: IDesktopServerInfo[] = servers.map(toServerInfo);
            sendEvent(win, 'serversLoaded', { servers: serverInfos });
            break;
        }

        case 'connectServer': {
            const { serverName } = payload as IDesktopServerNamePayload;
            if (!serverName) {
                sendError(win, 'No server name provided', 'connectServer');
                return;
            }
            // ConnectionLifecycleManager.connect() emits progress events via its callback
            await lifecycleManager.connect(serverName);
            break;
        }

        case 'disconnectServer': {
            lifecycleManager.disconnect();
            break;
        }

        case 'cancelConnection': {
            lifecycleManager.cancelConnection();
            break;
        }

        case 'deleteServer': {
            const { serverName } = payload as IDesktopServerNamePayload;
            if (!serverName) {
                sendError(win, 'No server name provided', 'deleteServer');
                return;
            }
            connectionManager.deleteServer(serverName);
            sendEvent(win, 'serverDeleted', { serverName });
            break;
        }

        case 'editServer': {
            const { serverName } = payload as IDesktopServerNamePayload;
            if (!serverName) {
                sendError(win, 'No server name provided', 'editServer');
                return;
            }
            const server = connectionManager.getServer(serverName);
            if (!server) {
                sendError(win, `Server "${serverName}" not found`, 'editServer');
                return;
            }
            sendEvent(win, 'serverConfigLoaded', {
                name: server.name,
                hostname: server.hostname,
                port: server.port,
                username: server.username,
                ssl: server.ssl,
                description: server.description,
                pathPrefix: server.pathPrefix,
            });
            break;
        }

        case 'saveServer': {
            const savePayload = payload as IDesktopSaveServerPayload;
            const config: ServerConfig = {
                name: savePayload.name,
                hostname: savePayload.hostname,
                port: savePayload.port,
                username: savePayload.username,
                ssl: savePayload.ssl,
                description: savePayload.description,
                pathPrefix: savePayload.pathPrefix,
                encryptedPassword: savePayload.password,
            };
            connectionManager.saveServer(config);
            sendEvent(win, 'serverSaved', { serverName: savePayload.name, mode: 'add' });
            break;
        }

        case 'updateServer': {
            const updatePayload = payload as IDesktopUpdateServerPayload;
            const updateConfig: ServerConfig = {
                name: updatePayload.name,
                hostname: updatePayload.hostname,
                port: updatePayload.port,
                username: updatePayload.username,
                ssl: updatePayload.ssl,
                description: updatePayload.description,
                pathPrefix: updatePayload.pathPrefix,
                encryptedPassword: updatePayload.password,
            };
            connectionManager.updateServer(updatePayload.originalName, updateConfig);
            sendEvent(win, 'serverSaved', { serverName: updatePayload.name, mode: 'edit' });
            break;
        }

        case 'testFormConnection': {
            const testPayload = payload as IDesktopTestConnectionPayload;
            const result = await connectionManager.testConnection({
                hostname: testPayload.hostname,
                port: testPayload.port,
                pathPrefix: testPayload.pathPrefix,
                ssl: testPayload.ssl,
                username: testPayload.username,
                password: testPayload.password,
            });
            sendEvent(win, 'testConnectionResult', result);
            break;
        }

        case 'selectServer': {
            const { serverName } = payload as IDesktopServerNamePayload;
            if (!serverName) {
                sendError(win, 'No server name provided', 'selectServer');
                return;
            }
            sendEvent(win, 'serverSelected', { serverName });
            break;
        }

        // ============================================
        // Data commands (Story 11.2)
        // ============================================

        case 'getNamespaces': {
            const session = requireSession(sessionManager, win, command);
            if (!session) { return; }

            const nsResult = await sessionManager!.getMetadataService()!.getNamespaces(
                session.spec, session.username, session.password
            );

            if (nsResult.success) {
                sendEvent(win, 'namespaceList', { namespaces: nsResult.namespaces || [] });
            } else {
                sendError(win, nsResult.error?.message || 'Failed to get namespaces', command);
            }
            break;
        }

        case 'getTables': {
            const session = requireSession(sessionManager, win, command);
            if (!session) { return; }

            const { namespace } = payload as IGetTablesPayload;
            if (!namespace) {
                sendError(win, 'No namespace provided', command);
                return;
            }

            sessionManager!.setNamespace(namespace);

            const tablesResult = await sessionManager!.getMetadataService()!.getTables(
                session.spec, namespace, session.username, session.password
            );

            if (tablesResult.success) {
                sendEvent(win, 'tableList', { tables: tablesResult.tables || [], namespace });
            } else {
                sendError(win, tablesResult.error?.message || 'Failed to get tables', command);
            }
            break;
        }

        case 'selectTable': {
            const session = requireSession(sessionManager, win, command);
            if (!session) { return; }

            const selectTablePayload = payload as ISelectTablePayload;
            const { namespace: stNamespace, tableName: stTableName } = selectTablePayload;
            if (!stNamespace || !stTableName) {
                sendError(win, 'Namespace and table name are required', command);
                return;
            }

            sendEvent(win, 'tableLoading', { loading: true, context: 'Loading table schema...' });
            const schemaResult = await sessionManager!.getMetadataService()!.getTableSchema(
                session.spec, stNamespace, stTableName, session.username, session.password
            );
            sendEvent(win, 'tableLoading', { loading: false, context: '' });

            if (schemaResult.success && schemaResult.schema) {
                sessionManager!.setNamespace(stNamespace);
                sessionManager!.setTable(stTableName, schemaResult.schema);
                sendEvent(win, 'tableSchema', {
                    tableName: stTableName,
                    namespace: stNamespace,
                    serverName: sessionManager!.getServerName() || '',
                    columns: schemaResult.schema.columns,
                });
            } else {
                sendError(win, schemaResult.error?.message || 'Failed to get table schema', command);
            }
            break;
        }

        case 'requestData': {
            const session = requireSession(sessionManager, win, command);
            if (!session) { return; }

            const reqPayload = payload as IRequestDataPayload;
            const reqNamespace = sessionManager!.getCurrentNamespace();
            const reqTableName = sessionManager!.getCurrentTableName();
            const reqSchema = sessionManager!.getCurrentSchema();

            if (!reqNamespace || !reqTableName || !reqSchema) {
                sendError(win, 'No table selected', command);
                return;
            }

            const pageSize = reqPayload.pageSize || DEFAULT_PAGE_SIZE;
            const page = reqPayload.page || 1;
            const offset = (page - 1) * pageSize;

            sendEvent(win, 'tableLoading', { loading: true, context: 'Loading table data...' });
            const dataResult = await sessionManager!.getQueryExecutor()!.getTableData(
                session.spec, reqNamespace, reqTableName, reqSchema,
                pageSize, offset, session.username, session.password,
                reqPayload.filters, reqPayload.sortColumn ?? null, reqPayload.sortDirection
            );
            sendEvent(win, 'tableLoading', { loading: false, context: '' });

            if (dataResult.success) {
                sendEvent(win, 'tableData', {
                    rows: dataResult.rows || [],
                    totalRows: dataResult.totalRows || 0,
                    page,
                    pageSize,
                });
            } else {
                sendError(win, dataResult.error?.message || 'Failed to load table data', command);
            }
            break;
        }

        case 'refresh': {
            const session = requireSession(sessionManager, win, command);
            if (!session) { return; }

            const refreshPayload = payload as IRefreshPayload;
            const refreshNamespace = sessionManager!.getCurrentNamespace();
            const refreshTableName = sessionManager!.getCurrentTableName();
            const refreshSchema = sessionManager!.getCurrentSchema();

            if (!refreshNamespace || !refreshTableName || !refreshSchema) {
                sendError(win, 'No table selected', command);
                return;
            }

            sendEvent(win, 'tableLoading', { loading: true, context: 'Refreshing table data...' });
            const refreshResult = await sessionManager!.getQueryExecutor()!.getTableData(
                session.spec, refreshNamespace, refreshTableName, refreshSchema,
                DEFAULT_PAGE_SIZE, 0, session.username, session.password,
                refreshPayload.filters, refreshPayload.sortColumn ?? null, refreshPayload.sortDirection
            );
            sendEvent(win, 'tableLoading', { loading: false, context: '' });

            if (refreshResult.success) {
                sendEvent(win, 'tableData', {
                    rows: refreshResult.rows || [],
                    totalRows: refreshResult.totalRows || 0,
                    page: 1,
                    pageSize: DEFAULT_PAGE_SIZE,
                });
            } else {
                sendError(win, refreshResult.error?.message || 'Failed to refresh table data', command);
            }
            break;
        }

        case 'paginateNext':
        case 'paginatePrev': {
            const session = requireSession(sessionManager, win, command);
            if (!session) { return; }

            const pagPayload = payload as IPaginatePayload;
            const pagNamespace = sessionManager!.getCurrentNamespace();
            const pagTableName = sessionManager!.getCurrentTableName();
            const pagSchema = sessionManager!.getCurrentSchema();

            if (!pagNamespace || !pagTableName || !pagSchema) {
                sendError(win, 'No table selected', command);
                return;
            }

            const pagPageSize = pagPayload.pageSize || DEFAULT_PAGE_SIZE;
            const newPage = command === 'paginateNext'
                ? pagPayload.currentPage + 1
                : Math.max(1, pagPayload.currentPage - 1);
            const pagOffset = (newPage - 1) * pagPageSize;

            sendEvent(win, 'tableLoading', { loading: true, context: 'Loading page...' });
            const pagResult = await sessionManager!.getQueryExecutor()!.getTableData(
                session.spec, pagNamespace, pagTableName, pagSchema,
                pagPageSize, pagOffset, session.username, session.password,
                pagPayload.filters, pagPayload.sortColumn ?? null, pagPayload.sortDirection
            );
            sendEvent(win, 'tableLoading', { loading: false, context: '' });

            if (pagResult.success) {
                sendEvent(win, 'tableData', {
                    rows: pagResult.rows || [],
                    totalRows: pagResult.totalRows || 0,
                    page: newPage,
                    pageSize: pagPageSize,
                });
            } else {
                sendError(win, pagResult.error?.message || 'Failed to load page data', command);
            }
            break;
        }

        case 'saveCell': {
            const session = requireSession(sessionManager, win, command);
            if (!session) { return; }

            const saveCellPayload = payload as ISaveCellPayload;
            const saveNamespace = sessionManager!.getCurrentNamespace();
            const saveTableName = sessionManager!.getCurrentTableName();

            if (!saveNamespace || !saveTableName) {
                sendError(win, 'No table selected', command);
                return;
            }

            const updateResult = await sessionManager!.getQueryExecutor()!.updateCell(
                session.spec, saveNamespace, saveTableName,
                saveCellPayload.columnName, saveCellPayload.newValue,
                saveCellPayload.primaryKeyColumn, saveCellPayload.primaryKeyValue,
                session.username, session.password
            );

            sendEvent(win, 'saveCellResult', {
                success: updateResult.success,
                rowIndex: saveCellPayload.rowIndex,
                colIndex: saveCellPayload.colIndex,
                columnName: saveCellPayload.columnName,
                oldValue: saveCellPayload.oldValue,
                newValue: saveCellPayload.newValue,
                primaryKeyValue: saveCellPayload.primaryKeyValue,
                error: updateResult.error ? {
                    message: updateResult.error.message,
                    code: updateResult.error.code,
                } : undefined,
            });
            break;
        }

        case 'insertRow': {
            const session = requireSession(sessionManager, win, command);
            if (!session) { return; }

            const insertPayload = payload as IInsertRowPayload;
            const insertNamespace = sessionManager!.getCurrentNamespace();
            const insertTableName = sessionManager!.getCurrentTableName();

            if (!insertNamespace || !insertTableName) {
                sendError(win, 'No table selected', command);
                return;
            }

            const insertResult = await sessionManager!.getQueryExecutor()!.insertRow(
                session.spec, insertNamespace, insertTableName,
                insertPayload.columns, insertPayload.values,
                session.username, session.password
            );

            sendEvent(win, 'insertRowResult', {
                success: insertResult.success,
                newRowIndex: insertPayload.newRowIndex,
                error: insertResult.error ? {
                    message: insertResult.error.message,
                    code: insertResult.error.code,
                } : undefined,
            });
            break;
        }

        case 'activateTab': {
            // Story 11.3: Update SessionManager context for tab switching.
            // No response event sent — this is a silent context update.
            const session = requireSession(sessionManager, win, command);
            if (!session) { return; }

            const activatePayload = payload as { namespace?: string; tableName?: string; schema?: unknown };
            if (activatePayload.namespace) {
                sessionManager!.setNamespace(activatePayload.namespace);
            }
            if (activatePayload.tableName && activatePayload.schema) {
                sessionManager!.setTable(
                    activatePayload.tableName,
                    activatePayload.schema as import('@iris-te/core').ITableSchema
                );
            }
            break;
        }

        case 'deleteRow': {
            const session = requireSession(sessionManager, win, command);
            if (!session) { return; }

            const deletePayload = payload as IDeleteRowPayload;
            const deleteNamespace = sessionManager!.getCurrentNamespace();
            const deleteTableName = sessionManager!.getCurrentTableName();

            if (!deleteNamespace || !deleteTableName) {
                sendError(win, 'No table selected', command);
                return;
            }

            const deleteResult = await sessionManager!.getQueryExecutor()!.deleteRow(
                session.spec, deleteNamespace, deleteTableName,
                deletePayload.primaryKeyColumn, deletePayload.primaryKeyValue,
                session.username, session.password
            );

            sendEvent(win, 'deleteRowResult', {
                success: deleteResult.success,
                rowIndex: deletePayload.rowIndex,
                error: deleteResult.error ? {
                    message: deleteResult.error.message,
                    code: deleteResult.error.code,
                } : undefined,
            });
            break;
        }

        default: {
            console.warn(`${LOG_PREFIX} Unknown command: ${command}`);
            sendError(win, `Unknown command: ${command}`, 'routeCommand');
            break;
        }
    }
}

/**
 * Register IPC handlers for the main process.
 * Listens on the 'command' channel and routes to service methods.
 *
 * @param win - The BrowserWindow to communicate with
 * @param connectionManager - ConnectionManager instance for server CRUD
 * @param lifecycleManager - ConnectionLifecycleManager for connect/disconnect
 * @param sessionManager - SessionManager for data commands (Story 11.2)
 */
export function registerIpcHandlers(
    win: BrowserWindow,
    connectionManager: ConnectionManager,
    lifecycleManager: ConnectionLifecycleManager,
    sessionManager?: SessionManager
): void {
    // Remove any previously registered 'command' listeners to avoid duplicates
    // when window is recreated (e.g., macOS activate). ipcMain.on is global,
    // not per-window, so re-calling registerIpcHandlers would stack listeners.
    ipcMain.removeAllListeners('command');

    ipcMain.on('command', async (_event, message: IpcCommandMessage) => {
        const { command, payload } = message;
        console.log(`${LOG_PREFIX} Received command: ${command}`);

        try {
            await routeCommand(command, payload, win, connectionManager, lifecycleManager, sessionManager);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`${LOG_PREFIX} Error handling command "${command}": ${errorMessage}`);
            sendError(win, errorMessage, command);
        }
    });

    console.log(`${LOG_PREFIX} IPC handlers registered`);
}
