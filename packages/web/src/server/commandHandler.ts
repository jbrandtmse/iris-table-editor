/**
 * WebSocket command handler - Routes commands to @iris-te/core services
 * Story 15.3: WebSocket Server - Task 3
 *
 * Similar to desktop/src/main/ipc.ts routeCommand() but adapted for
 * the web context where session data comes from SessionManager.
 *
 * Uses dependency injection for service factory to enable testing.
 */
import { AtelierApiService, QueryExecutor, TableMetadataService } from '@iris-te/core';
import type {
    IServerSpec,
    ITableSchema,
    IGetTablesPayload,
    ISelectTablePayload,
    IRequestDataPayload,
    IPaginatePayload,
    IRefreshPayload,
    ISaveCellPayload,
    IInsertRowPayload,
    IDeleteRowPayload,
} from '@iris-te/core';
import type { SessionData } from './sessionManager';

const LOG_PREFIX = '[IRIS-TE WS]';

/**
 * Default page size for data queries
 */
const DEFAULT_PAGE_SIZE = 100;

/**
 * Default API timeout for data operations (30 seconds)
 */
const DEFAULT_API_TIMEOUT = 30000;

/**
 * Per-connection state for table context (namespace, table, schema).
 * Each WebSocket connection maintains its own browsing context.
 */
export interface ConnectionContext {
    namespace: string | null;
    tableName: string | null;
    schema: ITableSchema | null;
}

/**
 * Factory function type for creating core service instances.
 * Injected for testability.
 */
export interface ServiceFactory {
    createServices(): {
        apiService: AtelierApiService;
        queryExecutor: QueryExecutor;
        metadataService: TableMetadataService;
    };
}

/**
 * Command result containing event name and payload to send back.
 */
export interface CommandResult {
    event: string;
    payload: unknown;
}

/**
 * Default service factory that creates real @iris-te/core service instances.
 */
export function createDefaultServiceFactory(): ServiceFactory {
    return {
        createServices() {
            const apiService = new AtelierApiService();
            apiService.setTimeout(DEFAULT_API_TIMEOUT);
            const queryExecutor = new QueryExecutor(apiService);
            const metadataService = new TableMetadataService(apiService);
            return { apiService, queryExecutor, metadataService };
        },
    };
}

/**
 * Build an IServerSpec from session data.
 */
function buildServerSpec(session: SessionData): IServerSpec {
    return {
        name: 'ws-session',
        scheme: session.useHTTPS ? 'https' : 'http',
        host: session.host,
        port: session.port,
        pathPrefix: session.pathPrefix || '',
    };
}

/**
 * Create an error result to send back to the client.
 */
function errorResult(message: string, code: string, context: string): CommandResult {
    return {
        event: 'error',
        payload: {
            message,
            code,
            recoverable: true,
            context,
        },
    };
}

/**
 * Handle a command from a WebSocket client.
 * Routes to the appropriate @iris-te/core service based on command name.
 *
 * @param command - Command name
 * @param payload - Command payload
 * @param session - Session data with connection details
 * @param context - Per-connection table browsing context (mutable)
 * @param services - Core service instances (from factory)
 * @returns CommandResult with event name and payload
 */
export async function handleCommand(
    command: string,
    payload: unknown,
    session: SessionData,
    context: ConnectionContext,
    services: {
        queryExecutor: QueryExecutor;
        metadataService: TableMetadataService;
    }
): Promise<CommandResult> {
    const spec = buildServerSpec(session);
    const { username, password } = session;

    switch (command) {
        case 'getNamespaces': {
            const result = await services.metadataService.getNamespaces(spec, username, password);
            if (result.success) {
                return { event: 'namespaceList', payload: { namespaces: result.namespaces || [] } };
            }
            return errorResult(
                result.error?.message || 'Failed to get namespaces',
                result.error?.code || 'UNKNOWN_ERROR',
                command
            );
        }

        case 'getTables': {
            const { namespace } = (payload || {}) as Partial<IGetTablesPayload>;
            if (!namespace) {
                return errorResult('No namespace provided', 'INVALID_INPUT', command);
            }
            context.namespace = namespace;

            const result = await services.metadataService.getTables(spec, namespace, username, password);
            if (result.success) {
                return { event: 'tableList', payload: { tables: result.tables || [], namespace } };
            }
            return errorResult(
                result.error?.message || 'Failed to get tables',
                result.error?.code || 'UNKNOWN_ERROR',
                command
            );
        }

        case 'selectTable': {
            const stPayload = (payload || {}) as Partial<ISelectTablePayload>;
            const { namespace: stNamespace, tableName: stTableName } = stPayload;
            if (!stNamespace || !stTableName) {
                return errorResult('Namespace and table name are required', 'INVALID_INPUT', command);
            }

            const schemaResult = await services.metadataService.getTableSchema(
                spec, stNamespace, stTableName, username, password
            );

            if (!schemaResult.success || !schemaResult.schema) {
                return errorResult(
                    schemaResult.error?.message || 'Failed to get table schema',
                    schemaResult.error?.code || 'UNKNOWN_ERROR',
                    command
                );
            }

            // Update connection context
            context.namespace = stNamespace;
            context.tableName = stTableName;
            context.schema = schemaResult.schema;

            // Load initial page of data
            const dataResult = await services.queryExecutor.getTableData(
                spec, stNamespace, stTableName, schemaResult.schema,
                DEFAULT_PAGE_SIZE, 0, username, password
            );

            if (dataResult.success) {
                return {
                    event: 'tableSelected',
                    payload: {
                        tableName: stTableName,
                        namespace: stNamespace,
                        columns: schemaResult.schema.columns,
                        rows: dataResult.rows || [],
                        totalRows: dataResult.totalRows || 0,
                        page: 0,
                        pageSize: DEFAULT_PAGE_SIZE,
                    },
                };
            }
            return errorResult(
                dataResult.error?.message || 'Failed to load table data',
                dataResult.error?.code || 'UNKNOWN_ERROR',
                command
            );
        }

        case 'requestData': {
            const reqPayload = (payload || {}) as Partial<IRequestDataPayload>;
            if (!context.namespace || !context.tableName || !context.schema) {
                return errorResult('No table selected', 'INVALID_INPUT', command);
            }

            const pageSize = reqPayload.pageSize || DEFAULT_PAGE_SIZE;
            const page = reqPayload.page ?? 0;
            const offset = page * pageSize;

            const result = await services.queryExecutor.getTableData(
                spec, context.namespace, context.tableName, context.schema,
                pageSize, offset, username, password,
                reqPayload.filters, reqPayload.sortColumn ?? null, reqPayload.sortDirection
            );

            if (result.success) {
                return {
                    event: 'tableData',
                    payload: {
                        rows: result.rows || [],
                        totalRows: result.totalRows || 0,
                        page,
                        pageSize,
                    },
                };
            }
            return errorResult(
                result.error?.message || 'Failed to load table data',
                result.error?.code || 'UNKNOWN_ERROR',
                command
            );
        }

        case 'paginate': {
            const pagPayload = (payload || {}) as Partial<IPaginatePayload>;
            if (!context.namespace || !context.tableName || !context.schema) {
                return errorResult('No table selected', 'INVALID_INPUT', command);
            }

            const pagPageSize = pagPayload.pageSize || DEFAULT_PAGE_SIZE;
            const newPage = pagPayload.direction === 'next'
                ? (pagPayload.currentPage || 0) + 1
                : Math.max(0, (pagPayload.currentPage || 0) - 1);
            const pagOffset = newPage * pagPageSize;

            const result = await services.queryExecutor.getTableData(
                spec, context.namespace, context.tableName, context.schema,
                pagPageSize, pagOffset, username, password,
                pagPayload.filters, pagPayload.sortColumn ?? null, pagPayload.sortDirection
            );

            if (result.success) {
                return {
                    event: 'tableData',
                    payload: {
                        rows: result.rows || [],
                        totalRows: result.totalRows || 0,
                        page: newPage,
                        pageSize: pagPageSize,
                    },
                };
            }
            return errorResult(
                result.error?.message || 'Failed to load page data',
                result.error?.code || 'UNKNOWN_ERROR',
                command
            );
        }

        case 'refreshData': {
            const refreshPayload = (payload || {}) as Partial<IRefreshPayload>;
            if (!context.namespace || !context.tableName || !context.schema) {
                return errorResult('No table selected', 'INVALID_INPUT', command);
            }

            const result = await services.queryExecutor.getTableData(
                spec, context.namespace, context.tableName, context.schema,
                DEFAULT_PAGE_SIZE, 0, username, password,
                refreshPayload.filters, refreshPayload.sortColumn ?? null, refreshPayload.sortDirection
            );

            if (result.success) {
                return {
                    event: 'tableData',
                    payload: {
                        rows: result.rows || [],
                        totalRows: result.totalRows || 0,
                        page: 0,
                        pageSize: DEFAULT_PAGE_SIZE,
                    },
                };
            }
            return errorResult(
                result.error?.message || 'Failed to refresh table data',
                result.error?.code || 'UNKNOWN_ERROR',
                command
            );
        }

        case 'updateRow': {
            const savePayload = (payload || {}) as Partial<ISaveCellPayload>;
            if (!context.namespace || !context.tableName) {
                return errorResult('No table selected', 'INVALID_INPUT', command);
            }
            if (!savePayload.columnName || !savePayload.primaryKeyColumn) {
                return errorResult('Missing column or primary key information', 'INVALID_INPUT', command);
            }

            const result = await services.queryExecutor.updateCell(
                spec, context.namespace, context.tableName,
                savePayload.columnName, savePayload.newValue,
                savePayload.primaryKeyColumn, savePayload.primaryKeyValue,
                username, password
            );

            return {
                event: 'saveCellResult',
                payload: {
                    success: result.success,
                    rowIndex: savePayload.rowIndex,
                    colIndex: savePayload.colIndex,
                    columnName: savePayload.columnName,
                    oldValue: savePayload.oldValue,
                    newValue: savePayload.newValue,
                    primaryKeyValue: savePayload.primaryKeyValue,
                    error: result.error ? {
                        message: result.error.message,
                        code: result.error.code,
                    } : undefined,
                },
            };
        }

        case 'insertRow': {
            const insertPayload = (payload || {}) as Partial<IInsertRowPayload>;
            if (!context.namespace || !context.tableName) {
                return errorResult('No table selected', 'INVALID_INPUT', command);
            }
            if (!insertPayload.columns || !insertPayload.values) {
                return errorResult('Missing columns or values', 'INVALID_INPUT', command);
            }

            const result = await services.queryExecutor.insertRow(
                spec, context.namespace, context.tableName,
                insertPayload.columns, insertPayload.values,
                username, password
            );

            return {
                event: 'insertRowResult',
                payload: {
                    success: result.success,
                    newRowIndex: insertPayload.newRowIndex,
                    error: result.error ? {
                        message: result.error.message,
                        code: result.error.code,
                    } : undefined,
                },
            };
        }

        case 'deleteRow': {
            const deletePayload = (payload || {}) as Partial<IDeleteRowPayload>;
            if (!context.namespace || !context.tableName) {
                return errorResult('No table selected', 'INVALID_INPUT', command);
            }
            if (!deletePayload.primaryKeyColumn) {
                return errorResult('Missing primary key information', 'INVALID_INPUT', command);
            }

            const result = await services.queryExecutor.deleteRow(
                spec, context.namespace, context.tableName,
                deletePayload.primaryKeyColumn, deletePayload.primaryKeyValue,
                username, password
            );

            return {
                event: 'deleteRowResult',
                payload: {
                    success: result.success,
                    rowIndex: deletePayload.rowIndex,
                    error: result.error ? {
                        message: result.error.message,
                        code: result.error.code,
                    } : undefined,
                },
            };
        }

        default: {
            console.warn(`${LOG_PREFIX} Unknown command: ${command}`);
            return errorResult(`Unknown command: ${command}`, 'UNKNOWN_COMMAND', 'commandHandler');
        }
    }
}
