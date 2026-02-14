/**
 * Unit tests for WebSocket command handler
 * Story 15.3: WebSocket Server - Task 7.7-7.9
 *
 * Tests command routing to core services and error handling.
 * Uses mocked service instances for isolation.
 * Uses Node.js built-in test runner.
 */
import { describe, it, beforeEach } from 'node:test';
import * as assert from 'assert';
import { handleCommand } from '../server/commandHandler';
import type { ConnectionContext } from '../server/commandHandler';
import type { SessionData } from '../server/sessionManager';
import type { QueryExecutor, TableMetadataService } from '@iris-te/core';

/** Partial mock types for testability */
type MockQueryExecutor = Pick<QueryExecutor, 'getTableData' | 'updateCell' | 'insertRow' | 'deleteRow'>;
type MockMetadataService = Pick<TableMetadataService, 'getNamespaces' | 'getTables' | 'getTableSchema'>;

interface MockServices {
    queryExecutor: MockQueryExecutor;
    metadataService: MockMetadataService;
}

/** Mock session data */
const mockSession: SessionData = {
    host: 'iris-test',
    port: 52773,
    namespace: 'USER',
    username: 'testuser',
    password: 'testpass',
    pathPrefix: '',
    useHTTPS: false,
    createdAt: Date.now(),
};

/** Default mock services */
function createMockServices(): MockServices {
    return {
        queryExecutor: {
            getTableData: async () => ({
                success: true,
                rows: [{ ID: 1, Name: 'Test' }],
                totalRows: 1,
            }),
            updateCell: async () => ({ success: true, rowsAffected: 1 }),
            insertRow: async () => ({ success: true }),
            deleteRow: async () => ({ success: true }),
        } as MockQueryExecutor,
        metadataService: {
            getNamespaces: async () => ({
                success: true,
                namespaces: ['USER', 'SAMPLES'],
            }),
            getTables: async () => ({
                success: true,
                tables: ['Sample.Person', 'Sample.Company'],
            }),
            getTableSchema: async () => ({
                success: true,
                schema: {
                    tableName: 'Sample.Person',
                    namespace: 'USER',
                    columns: [
                        { name: 'ID', dataType: 'INTEGER', nullable: false, readOnly: true },
                        { name: 'Name', dataType: 'VARCHAR', nullable: true },
                    ],
                },
            }),
        } as MockMetadataService,
    };
}

describe('CommandHandler', () => {
    let context: ConnectionContext;
    let services: MockServices;

    beforeEach(() => {
        context = {
            namespace: null,
            tableName: null,
            schema: null,
        };
        services = createMockServices();
    });

    // ============================================
    // Command Routing (Task 7.8)
    // ============================================

    describe('Command routing', () => {
        it('should route getNamespaces to metadataService.getNamespaces (Task 7.8)', async () => {
            let called = false;
            services.metadataService = {
                ...services.metadataService,
                getNamespaces: async () => {
                    called = true;
                    return { success: true, namespaces: ['USER'] };
                },
            };

            const result = await handleCommand('getNamespaces', {}, mockSession, context, services as never);

            assert.ok(called, 'Should have called metadataService.getNamespaces');
            assert.strictEqual(result.event, 'namespaceList');
            const payload = result.payload as { namespaces: string[] };
            assert.deepStrictEqual(payload.namespaces, ['USER']);
        });

        it('should route getTables to metadataService.getTables (Task 7.8)', async () => {
            let calledNamespace: string | undefined;
            services.metadataService = {
                ...services.metadataService,
                getTables: async (_spec: unknown, ns: string) => {
                    calledNamespace = ns;
                    return { success: true, tables: ['Sample.Person'] };
                },
            } as MockMetadataService;

            const result = await handleCommand('getTables', { namespace: 'USER' }, mockSession, context, services as never);

            assert.strictEqual(calledNamespace, 'USER');
            assert.strictEqual(result.event, 'tableList');
            const payload = result.payload as { tables: string[]; namespace: string };
            assert.deepStrictEqual(payload.tables, ['Sample.Person']);
            assert.strictEqual(payload.namespace, 'USER');
        });

        it('should route selectTable to metadataService.getTableSchema + queryExecutor.getTableData (Task 7.8)', async () => {
            let schemaCalled = false;
            let dataCalled = false;

            services.metadataService = {
                ...services.metadataService,
                getTableSchema: async () => {
                    schemaCalled = true;
                    return {
                        success: true,
                        schema: {
                            tableName: 'Sample.Person',
                            namespace: 'USER',
                            columns: [{ name: 'ID', dataType: 'INTEGER', nullable: false }],
                        },
                    };
                },
            } as MockMetadataService;

            services.queryExecutor = {
                ...services.queryExecutor,
                getTableData: async () => {
                    dataCalled = true;
                    return { success: true, rows: [{ ID: 1 }], totalRows: 1 };
                },
            } as MockQueryExecutor;

            const result = await handleCommand(
                'selectTable',
                { namespace: 'USER', tableName: 'Sample.Person' },
                mockSession, context, services as never
            );

            assert.ok(schemaCalled, 'Should have called getTableSchema');
            assert.ok(dataCalled, 'Should have called getTableData');
            assert.strictEqual(result.event, 'tableSelected');

            // Context should be updated
            assert.strictEqual(context.namespace, 'USER');
            assert.strictEqual(context.tableName, 'Sample.Person');
            assert.ok(context.schema, 'Schema should be set in context');
        });

        it('should route requestData to queryExecutor.getTableData (Task 7.8)', async () => {
            // Set up context first
            context.namespace = 'USER';
            context.tableName = 'Sample.Person';
            context.schema = {
                tableName: 'Sample.Person',
                namespace: 'USER',
                columns: [{ name: 'ID', dataType: 'INTEGER', nullable: false }],
            };

            let calledOffset: number | undefined;
            services.queryExecutor = {
                ...services.queryExecutor,
                getTableData: async (_s: unknown, _ns: unknown, _t: unknown, _sch: unknown, _ps: unknown, offset: number) => {
                    calledOffset = offset;
                    return { success: true, rows: [{ ID: 2 }], totalRows: 10 };
                },
            } as MockQueryExecutor;

            const result = await handleCommand(
                'requestData',
                { page: 1, pageSize: 5 },
                mockSession, context, services as never
            );

            assert.strictEqual(calledOffset, 5, 'Offset should be page * pageSize');
            assert.strictEqual(result.event, 'tableData');
        });

        it('should route paginate to queryExecutor.getTableData (Task 7.8)', async () => {
            context.namespace = 'USER';
            context.tableName = 'Sample.Person';
            context.schema = {
                tableName: 'Sample.Person',
                namespace: 'USER',
                columns: [{ name: 'ID', dataType: 'INTEGER', nullable: false }],
            };

            const result = await handleCommand(
                'paginate',
                { direction: 'next', currentPage: 0, pageSize: 10 },
                mockSession, context, services as never
            );

            assert.strictEqual(result.event, 'tableData');
            const payload = result.payload as { page: number };
            assert.strictEqual(payload.page, 1, 'Next page should be 1');
        });

        it('should route refreshData to queryExecutor.getTableData (Task 7.8)', async () => {
            context.namespace = 'USER';
            context.tableName = 'Sample.Person';
            context.schema = {
                tableName: 'Sample.Person',
                namespace: 'USER',
                columns: [{ name: 'ID', dataType: 'INTEGER', nullable: false }],
            };

            const result = await handleCommand(
                'refreshData',
                {},
                mockSession, context, services as never
            );

            assert.strictEqual(result.event, 'tableData');
            const payload = result.payload as { page: number };
            assert.strictEqual(payload.page, 0, 'Refresh should return to page 0');
        });

        it('should route updateRow to queryExecutor.updateCell (Task 7.8)', async () => {
            context.namespace = 'USER';
            context.tableName = 'Sample.Person';

            let updateCalled = false;
            services.queryExecutor = {
                ...services.queryExecutor,
                updateCell: async () => {
                    updateCalled = true;
                    return { success: true, rowsAffected: 1 };
                },
            } as MockQueryExecutor;

            const result = await handleCommand(
                'updateRow',
                {
                    rowIndex: 0,
                    colIndex: 1,
                    columnName: 'Name',
                    oldValue: 'Old',
                    newValue: 'New',
                    primaryKeyColumn: 'ID',
                    primaryKeyValue: 1,
                },
                mockSession, context, services as never
            );

            assert.ok(updateCalled, 'Should have called updateCell');
            assert.strictEqual(result.event, 'saveCellResult');
            const payload = result.payload as { success: boolean };
            assert.strictEqual(payload.success, true);
        });

        it('should route insertRow to queryExecutor.insertRow (Task 7.8)', async () => {
            context.namespace = 'USER';
            context.tableName = 'Sample.Person';

            let insertCalled = false;
            services.queryExecutor = {
                ...services.queryExecutor,
                insertRow: async () => {
                    insertCalled = true;
                    return { success: true };
                },
            } as MockQueryExecutor;

            const result = await handleCommand(
                'insertRow',
                {
                    newRowIndex: 0,
                    columns: ['Name'],
                    values: ['Test Person'],
                },
                mockSession, context, services as never
            );

            assert.ok(insertCalled, 'Should have called insertRow');
            assert.strictEqual(result.event, 'insertRowResult');
            const payload = result.payload as { success: boolean };
            assert.strictEqual(payload.success, true);
        });

        it('should route deleteRow to queryExecutor.deleteRow (Task 7.8)', async () => {
            context.namespace = 'USER';
            context.tableName = 'Sample.Person';

            let deleteCalled = false;
            services.queryExecutor = {
                ...services.queryExecutor,
                deleteRow: async () => {
                    deleteCalled = true;
                    return { success: true };
                },
            } as MockQueryExecutor;

            const result = await handleCommand(
                'deleteRow',
                {
                    rowIndex: 0,
                    primaryKeyColumn: 'ID',
                    primaryKeyValue: 1,
                },
                mockSession, context, services as never
            );

            assert.ok(deleteCalled, 'Should have called deleteRow');
            assert.strictEqual(result.event, 'deleteRowResult');
            const payload = result.payload as { success: boolean };
            assert.strictEqual(payload.success, true);
        });
    });

    // ============================================
    // Error Handling (Task 7.9)
    // ============================================

    describe('Error handling', () => {
        it('should return error event for unknown command (Task 7.9)', async () => {
            const result = await handleCommand('nonExistent', {}, mockSession, context, services as never);

            assert.strictEqual(result.event, 'error');
            const payload = result.payload as { code: string; message: string };
            assert.strictEqual(payload.code, 'UNKNOWN_COMMAND');
            assert.ok(payload.message.includes('Unknown command'));
        });

        it('should return error event when service fails (Task 7.9)', async () => {
            services.metadataService = {
                ...services.metadataService,
                getNamespaces: async () => ({
                    success: false,
                    error: { message: 'Connection timeout', code: 'CONNECTION_TIMEOUT', recoverable: true, context: 'getNamespaces' },
                }),
            } as MockMetadataService;

            const result = await handleCommand('getNamespaces', {}, mockSession, context, services as never);

            assert.strictEqual(result.event, 'error');
            const payload = result.payload as { message: string; code: string };
            assert.strictEqual(payload.message, 'Connection timeout');
        });

        it('should return error when getTables is called without namespace', async () => {
            const result = await handleCommand('getTables', {}, mockSession, context, services as never);

            assert.strictEqual(result.event, 'error');
            const payload = result.payload as { code: string };
            assert.strictEqual(payload.code, 'INVALID_INPUT');
        });

        it('should return error when requestData is called without table context', async () => {
            const result = await handleCommand(
                'requestData',
                { page: 0, pageSize: 10 },
                mockSession, context, services as never
            );

            assert.strictEqual(result.event, 'error');
            const payload = result.payload as { message: string };
            assert.ok(payload.message.includes('No table selected'));
        });

        it('should return error when updateRow is called without table context', async () => {
            const result = await handleCommand(
                'updateRow',
                { columnName: 'Name', newValue: 'Test', primaryKeyColumn: 'ID', primaryKeyValue: 1 },
                mockSession, context, services as never
            );

            assert.strictEqual(result.event, 'error');
            const payload = result.payload as { message: string };
            assert.ok(payload.message.includes('No table selected'));
        });

        it('should return error when selectTable is called without required fields', async () => {
            const result = await handleCommand(
                'selectTable',
                { namespace: 'USER' }, // missing tableName
                mockSession, context, services as never
            );

            assert.strictEqual(result.event, 'error');
            const payload = result.payload as { code: string };
            assert.strictEqual(payload.code, 'INVALID_INPUT');
        });

        it('should propagate service error details in response', async () => {
            services.queryExecutor = {
                ...services.queryExecutor,
                updateCell: async () => ({
                    success: false,
                    error: {
                        message: 'Column "BadCol" not found',
                        code: 'INVALID_INPUT',
                        recoverable: false,
                        context: 'updateCell',
                    },
                }),
            } as MockQueryExecutor;

            context.namespace = 'USER';
            context.tableName = 'Sample.Person';

            const result = await handleCommand(
                'updateRow',
                {
                    columnName: 'BadCol',
                    newValue: 'test',
                    primaryKeyColumn: 'ID',
                    primaryKeyValue: 1,
                },
                mockSession, context, services as never
            );

            assert.strictEqual(result.event, 'saveCellResult');
            const payload = result.payload as { success: boolean; error: { message: string; code: string } };
            assert.strictEqual(payload.success, false);
            assert.strictEqual(payload.error.message, 'Column "BadCol" not found');
            assert.strictEqual(payload.error.code, 'INVALID_INPUT');
        });
    });
});
