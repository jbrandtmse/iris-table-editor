/**
 * Unit tests for IPC data command routing
 * Story 11.2: IPC Bridge
 *
 * Tests data command routing (getNamespaces, getTables, requestData, saveCell, etc.),
 * session guard behavior (commands without active session return error),
 * and the requireSession helper.
 *
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import { SessionManager } from '../main/SessionManager';
import { routeCommand, sendEvent, requireSession } from '../main/ipc';
import { AtelierApiService, QueryExecutor, TableMetadataService, ErrorCodes } from '@iris-te/core';
import type { IServerSpec, ITableSchema, IUserError } from '@iris-te/core';
import type { ConnectionManager } from '../main/ConnectionManager';
import type { ConnectionLifecycleManager } from '../main/ConnectionLifecycleManager';

// ============================================
// Mock BrowserWindow
// ============================================

interface SentEvent {
    channel: string;
    payload: unknown;
}

function createMockWindow(): {
    win: MockBrowserWindow;
    sentEvents: SentEvent[];
} {
    const sentEvents: SentEvent[] = [];
    const win = {
        isDestroyed: () => false,
        webContents: {
            send(channel: string, payload: unknown) {
                sentEvents.push({ channel, payload });
            },
        },
    };
    return { win: win as unknown as MockBrowserWindow, sentEvents };
}

type MockBrowserWindow = Parameters<typeof sendEvent>[0];

function findEvent(sentEvents: SentEvent[], eventName: string): SentEvent | undefined {
    return sentEvents.find(e => e.channel === `event:${eventName}`);
}

// ============================================
// Mock services
// ============================================

function createTestSpec(): IServerSpec {
    return {
        name: 'test-server',
        scheme: 'http',
        host: 'localhost',
        port: 52773,
        pathPrefix: '',
    };
}

function createTestSchema(): ITableSchema {
    return {
        tableName: 'SQLUser.TestTable',
        namespace: 'USER',
        columns: [
            { name: 'ID', dataType: 'INTEGER', nullable: false, readOnly: true },
            { name: 'Name', dataType: 'VARCHAR', nullable: true, maxLength: 50 },
            { name: 'Age', dataType: 'INTEGER', nullable: true },
        ],
    };
}

// Minimal stub for ConnectionManager and ConnectionLifecycleManager
// (data commands don't use them)
const stubConnMgr = {} as unknown as ConnectionManager;
const stubLifecycleMgr = {} as unknown as ConnectionLifecycleManager;

// ============================================
// Mock prototype methods for services
// ============================================

// Store originals for cleanup
const origGetNamespaces = TableMetadataService.prototype.getNamespaces;
const origGetTables = TableMetadataService.prototype.getTables;
const origGetTableSchema = TableMetadataService.prototype.getTableSchema;
const origGetTableData = QueryExecutor.prototype.getTableData;
const origUpdateCell = QueryExecutor.prototype.updateCell;
const origInsertRow = QueryExecutor.prototype.insertRow;
const origDeleteRow = QueryExecutor.prototype.deleteRow;

// Mock return values
let mockNamespacesResult: { success: boolean; namespaces?: string[]; error?: IUserError } = {
    success: true, namespaces: ['USER', 'SAMPLES', '%SYS'],
};
let mockTablesResult: { success: boolean; tables?: string[]; error?: IUserError } = {
    success: true, tables: ['SQLUser.Person', 'SQLUser.Employee'],
};
let mockSchemaResult: { success: boolean; schema?: ITableSchema; error?: IUserError } = {
    success: true, schema: createTestSchema(),
};
let mockTableDataResult: { success: boolean; rows?: Record<string, unknown>[]; totalRows?: number; error?: IUserError } = {
    success: true, rows: [{ ID: 1, Name: 'Alice', Age: 30 }], totalRows: 1,
};
let mockUpdateCellResult: { success: boolean; rowsAffected?: number; error?: IUserError } = {
    success: true, rowsAffected: 1,
};
let mockInsertRowResult: { success: boolean; error?: IUserError } = {
    success: true,
};
let mockDeleteRowResult: { success: boolean; error?: IUserError } = {
    success: true,
};

// ============================================
// Tests
// ============================================

describe('IPC Data Command Routing', () => {
    let session: SessionManager;

    beforeEach(() => {
        session = new SessionManager();

        // Reset mocks
        mockNamespacesResult = { success: true, namespaces: ['USER', 'SAMPLES', '%SYS'] };
        mockTablesResult = { success: true, tables: ['SQLUser.Person', 'SQLUser.Employee'] };
        mockSchemaResult = { success: true, schema: createTestSchema() };
        mockTableDataResult = { success: true, rows: [{ ID: 1, Name: 'Alice', Age: 30 }], totalRows: 1 };
        mockUpdateCellResult = { success: true, rowsAffected: 1 };
        mockInsertRowResult = { success: true };
        mockDeleteRowResult = { success: true };

        // Patch prototype methods
        TableMetadataService.prototype.getNamespaces = async function () {
            return mockNamespacesResult;
        };
        TableMetadataService.prototype.getTables = async function () {
            return mockTablesResult;
        };
        TableMetadataService.prototype.getTableSchema = async function () {
            return mockSchemaResult;
        };
        QueryExecutor.prototype.getTableData = async function () {
            return mockTableDataResult;
        };
        QueryExecutor.prototype.updateCell = async function () {
            return mockUpdateCellResult;
        };
        QueryExecutor.prototype.insertRow = async function () {
            return mockInsertRowResult;
        };
        QueryExecutor.prototype.deleteRow = async function () {
            return mockDeleteRowResult;
        };

        // Also patch AtelierApiService to avoid real HTTP calls
        AtelierApiService.prototype.setTimeout = function () { /* no-op */ };
    });

    afterEach(() => {
        // Restore originals
        TableMetadataService.prototype.getNamespaces = origGetNamespaces;
        TableMetadataService.prototype.getTables = origGetTables;
        TableMetadataService.prototype.getTableSchema = origGetTableSchema;
        QueryExecutor.prototype.getTableData = origGetTableData;
        QueryExecutor.prototype.updateCell = origUpdateCell;
        QueryExecutor.prototype.insertRow = origInsertRow;
        QueryExecutor.prototype.deleteRow = origDeleteRow;
    });

    // Helper to start a session
    function startTestSession(): void {
        session.startSession('test-server', createTestSpec(), '_SYSTEM', 'SYS');
    }

    // ============================================
    // Session Guard Tests (Task 7.4)
    // ============================================

    describe('session guard', () => {
        const dataCommands = [
            'getNamespaces',
            'getTables',
            'selectTable',
            'requestData',
            'refresh',
            'paginateNext',
            'paginatePrev',
            'saveCell',
            'insertRow',
            'deleteRow',
        ];

        for (const cmd of dataCommands) {
            it(`should return error for "${cmd}" without active session`, async () => {
                const { win, sentEvents } = createMockWindow();
                await routeCommand(cmd, {}, win, stubConnMgr, stubLifecycleMgr, session);

                const event = findEvent(sentEvents, 'error');
                assert.ok(event, `Expected error event for command "${cmd}"`);
                const payload = event.payload as { message: string };
                assert.ok(payload.message.includes('Not connected'));
            });
        }
    });

    // ============================================
    // requireSession helper
    // ============================================

    describe('requireSession', () => {
        it('should return null and send error when not connected', () => {
            const { win, sentEvents } = createMockWindow();
            const result = requireSession(session, win, 'testCommand');

            assert.strictEqual(result, null);
            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
            const payload = event.payload as { message: string; context: string };
            assert.ok(payload.message.includes('Not connected'));
            assert.strictEqual(payload.context, 'testCommand');
        });

        it('should return null and send error when sessionManager is undefined', () => {
            const { win, sentEvents } = createMockWindow();
            const result = requireSession(undefined, win, 'testCommand');

            assert.strictEqual(result, null);
            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
            const payload = event.payload as { message: string };
            assert.ok(payload.message.includes('Not connected'));
        });

        it('should return session info when connected', () => {
            startTestSession();
            const { win, sentEvents } = createMockWindow();
            const result = requireSession(session, win, 'testCommand');

            assert.ok(result);
            assert.strictEqual(result.spec.host, 'localhost');
            assert.strictEqual(result.username, '_SYSTEM');
            assert.strictEqual(result.password, 'SYS');
            assert.strictEqual(sentEvents.length, 0);
        });
    });

    // ============================================
    // getNamespaces (Task 7.3)
    // ============================================

    describe('getNamespaces', () => {
        it('should return namespace list via namespaceList event', async () => {
            startTestSession();
            const { win, sentEvents } = createMockWindow();

            await routeCommand('getNamespaces', {}, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'namespaceList');
            assert.ok(event);
            const payload = event.payload as { namespaces: string[] };
            assert.deepStrictEqual(payload.namespaces, ['USER', 'SAMPLES', '%SYS']);
        });

        it('should send error when service fails', async () => {
            startTestSession();
            mockNamespacesResult = {
                success: false,
                error: {
                    message: 'Connection timeout',
                    code: 'CONNECTION_TIMEOUT',
                    recoverable: true,
                    context: 'getNamespaces',
                },
            };
            const { win, sentEvents } = createMockWindow();

            await routeCommand('getNamespaces', {}, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
            const payload = event.payload as { message: string };
            assert.ok(payload.message.includes('Connection timeout'));
        });
    });

    // ============================================
    // getTables (Task 7.3)
    // ============================================

    describe('getTables', () => {
        it('should return table list via tableList event', async () => {
            startTestSession();
            const { win, sentEvents } = createMockWindow();

            await routeCommand('getTables', { namespace: 'USER' }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'tableList');
            assert.ok(event);
            const payload = event.payload as { tables: string[]; namespace: string };
            assert.deepStrictEqual(payload.tables, ['SQLUser.Person', 'SQLUser.Employee']);
            assert.strictEqual(payload.namespace, 'USER');
        });

        it('should set current namespace on SessionManager', async () => {
            startTestSession();
            const { win } = createMockWindow();

            await routeCommand('getTables', { namespace: 'SAMPLES' }, win, stubConnMgr, stubLifecycleMgr, session);

            assert.strictEqual(session.getCurrentNamespace(), 'SAMPLES');
        });

        it('should send error when no namespace provided', async () => {
            startTestSession();
            const { win, sentEvents } = createMockWindow();

            await routeCommand('getTables', {}, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
            const payload = event.payload as { message: string };
            assert.ok(payload.message.includes('No namespace'));
        });

        it('should send error when service fails', async () => {
            startTestSession();
            mockTablesResult = {
                success: false,
                error: {
                    message: 'Auth failed',
                    code: 'AUTH_FAILED',
                    recoverable: true,
                    context: 'getTables',
                },
            };
            const { win, sentEvents } = createMockWindow();

            await routeCommand('getTables', { namespace: 'USER' }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
        });
    });

    // ============================================
    // selectTable (Task 7.3)
    // ============================================

    describe('selectTable', () => {
        it('should return table schema via tableSchema event', async () => {
            startTestSession();
            const { win, sentEvents } = createMockWindow();

            await routeCommand('selectTable', { namespace: 'USER', tableName: 'SQLUser.TestTable' }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'tableSchema');
            assert.ok(event);
            const payload = event.payload as { tableName: string; namespace: string; serverName: string; columns: unknown[] };
            assert.strictEqual(payload.tableName, 'SQLUser.TestTable');
            assert.strictEqual(payload.namespace, 'USER');
            assert.strictEqual(payload.serverName, 'test-server');
            assert.strictEqual(payload.columns.length, 3);
        });

        it('should set table context on SessionManager', async () => {
            startTestSession();
            const { win } = createMockWindow();

            await routeCommand('selectTable', { namespace: 'USER', tableName: 'SQLUser.TestTable' }, win, stubConnMgr, stubLifecycleMgr, session);

            assert.strictEqual(session.getCurrentNamespace(), 'USER');
            assert.strictEqual(session.getCurrentTableName(), 'SQLUser.TestTable');
            assert.ok(session.getCurrentSchema());
        });

        it('should send error when missing namespace or table', async () => {
            startTestSession();
            const { win, sentEvents } = createMockWindow();

            await routeCommand('selectTable', { namespace: '', tableName: '' }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
            const payload = event.payload as { message: string };
            assert.ok(payload.message.includes('required'));
        });

        it('should send error when schema retrieval fails', async () => {
            startTestSession();
            mockSchemaResult = {
                success: false,
                error: {
                    message: 'Table not found',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: true,
                    context: 'getTableSchema',
                },
            };
            const { win, sentEvents } = createMockWindow();

            await routeCommand('selectTable', { namespace: 'USER', tableName: 'Bad.Table' }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
        });
    });

    // ============================================
    // requestData (Task 7.3)
    // ============================================

    describe('requestData', () => {
        beforeEach(() => {
            startTestSession();
            session.setNamespace('USER');
            session.setTable('SQLUser.TestTable', createTestSchema());
        });

        it('should return table data via tableData event', async () => {
            const { win, sentEvents } = createMockWindow();

            await routeCommand('requestData', { page: 1, pageSize: 50 }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'tableData');
            assert.ok(event);
            const payload = event.payload as { rows: unknown[]; totalRows: number; page: number; pageSize: number };
            assert.strictEqual(payload.rows.length, 1);
            assert.strictEqual(payload.totalRows, 1);
            assert.strictEqual(payload.page, 1);
            assert.strictEqual(payload.pageSize, 50);
        });

        it('should send error when no table selected', async () => {
            session.clearTable();
            const { win, sentEvents } = createMockWindow();

            await routeCommand('requestData', { page: 1, pageSize: 50 }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
            const payload = event.payload as { message: string };
            assert.ok(payload.message.includes('No table selected'));
        });

        it('should use default page size when not specified', async () => {
            const { win, sentEvents } = createMockWindow();

            await routeCommand('requestData', {}, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'tableData');
            assert.ok(event);
            const payload = event.payload as { pageSize: number };
            assert.strictEqual(payload.pageSize, 100);
        });

        it('should send error when data query fails', async () => {
            mockTableDataResult = {
                success: false,
                error: {
                    message: 'Query error',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: true,
                    context: 'getTableData',
                },
            };
            const { win, sentEvents } = createMockWindow();

            await routeCommand('requestData', { page: 1, pageSize: 50 }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
        });
    });

    // ============================================
    // refresh (Task 7.3)
    // ============================================

    describe('refresh', () => {
        beforeEach(() => {
            startTestSession();
            session.setNamespace('USER');
            session.setTable('SQLUser.TestTable', createTestSchema());
        });

        it('should return data for page 1', async () => {
            const { win, sentEvents } = createMockWindow();

            await routeCommand('refresh', {}, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'tableData');
            assert.ok(event);
            const payload = event.payload as { page: number; pageSize: number };
            assert.strictEqual(payload.page, 1);
            assert.strictEqual(payload.pageSize, 100);
        });

        it('should send error when no table selected', async () => {
            session.clearTable();
            const { win, sentEvents } = createMockWindow();

            await routeCommand('refresh', {}, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
        });
    });

    // ============================================
    // paginateNext / paginatePrev (Task 7.3)
    // ============================================

    describe('paginateNext', () => {
        beforeEach(() => {
            startTestSession();
            session.setNamespace('USER');
            session.setTable('SQLUser.TestTable', createTestSchema());
        });

        it('should advance to next page', async () => {
            const { win, sentEvents } = createMockWindow();

            await routeCommand('paginateNext', { currentPage: 1, pageSize: 50, direction: 'next' }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'tableData');
            assert.ok(event);
            const payload = event.payload as { page: number; pageSize: number };
            assert.strictEqual(payload.page, 2);
            assert.strictEqual(payload.pageSize, 50);
        });

        it('should send error when no table selected', async () => {
            session.clearTable();
            const { win, sentEvents } = createMockWindow();

            await routeCommand('paginateNext', { currentPage: 1, pageSize: 50, direction: 'next' }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
        });
    });

    describe('paginatePrev', () => {
        beforeEach(() => {
            startTestSession();
            session.setNamespace('USER');
            session.setTable('SQLUser.TestTable', createTestSchema());
        });

        it('should go back one page', async () => {
            const { win, sentEvents } = createMockWindow();

            await routeCommand('paginatePrev', { currentPage: 3, pageSize: 50, direction: 'prev' }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'tableData');
            assert.ok(event);
            const payload = event.payload as { page: number };
            assert.strictEqual(payload.page, 2);
        });

        it('should not go below page 1', async () => {
            const { win, sentEvents } = createMockWindow();

            await routeCommand('paginatePrev', { currentPage: 1, pageSize: 50, direction: 'prev' }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'tableData');
            assert.ok(event);
            const payload = event.payload as { page: number };
            assert.ok(payload.page >= 1);
        });
    });

    // ============================================
    // saveCell (Task 7.3)
    // ============================================

    describe('saveCell', () => {
        beforeEach(() => {
            startTestSession();
            session.setNamespace('USER');
            session.setTable('SQLUser.TestTable', createTestSchema());
        });

        it('should return saveCellResult on success', async () => {
            const { win, sentEvents } = createMockWindow();

            await routeCommand('saveCell', {
                rowIndex: 0,
                colIndex: 1,
                columnName: 'Name',
                oldValue: 'Alice',
                newValue: 'Bob',
                primaryKeyColumn: 'ID',
                primaryKeyValue: 1,
            }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'saveCellResult');
            assert.ok(event);
            const payload = event.payload as { success: boolean; rowIndex: number; colIndex: number; columnName: string; oldValue: unknown; newValue: unknown; primaryKeyValue: unknown };
            assert.strictEqual(payload.success, true);
            assert.strictEqual(payload.rowIndex, 0);
            assert.strictEqual(payload.colIndex, 1);
            assert.strictEqual(payload.columnName, 'Name');
            assert.strictEqual(payload.oldValue, 'Alice');
            assert.strictEqual(payload.newValue, 'Bob');
            assert.strictEqual(payload.primaryKeyValue, 1);
        });

        it('should return error in saveCellResult on failure', async () => {
            mockUpdateCellResult = {
                success: false,
                error: {
                    message: 'Constraint violation',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: true,
                    context: 'updateCell',
                },
            };
            const { win, sentEvents } = createMockWindow();

            await routeCommand('saveCell', {
                rowIndex: 0,
                colIndex: 1,
                columnName: 'Name',
                oldValue: 'Alice',
                newValue: 'Bob',
                primaryKeyColumn: 'ID',
                primaryKeyValue: 1,
            }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'saveCellResult');
            assert.ok(event);
            const payload = event.payload as { success: boolean; error?: { message: string; code: string } };
            assert.strictEqual(payload.success, false);
            assert.ok(payload.error);
            assert.ok(payload.error.message.includes('Constraint violation'));
        });

        it('should send error when no table selected', async () => {
            session.clearTable();
            const { win, sentEvents } = createMockWindow();

            await routeCommand('saveCell', {
                rowIndex: 0,
                colIndex: 1,
                columnName: 'Name',
                oldValue: 'Alice',
                newValue: 'Bob',
                primaryKeyColumn: 'ID',
                primaryKeyValue: 1,
            }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
        });
    });

    // ============================================
    // insertRow (Task 7.3)
    // ============================================

    describe('insertRow', () => {
        beforeEach(() => {
            startTestSession();
            session.setNamespace('USER');
            session.setTable('SQLUser.TestTable', createTestSchema());
        });

        it('should return insertRowResult on success', async () => {
            const { win, sentEvents } = createMockWindow();

            await routeCommand('insertRow', {
                newRowIndex: 0,
                columns: ['Name', 'Age'],
                values: ['Charlie', 25],
            }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'insertRowResult');
            assert.ok(event);
            const payload = event.payload as { success: boolean; newRowIndex: number };
            assert.strictEqual(payload.success, true);
            assert.strictEqual(payload.newRowIndex, 0);
        });

        it('should return error in insertRowResult on failure', async () => {
            mockInsertRowResult = {
                success: false,
                error: {
                    message: 'Duplicate key',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: true,
                    context: 'insertRow',
                },
            };
            const { win, sentEvents } = createMockWindow();

            await routeCommand('insertRow', {
                newRowIndex: 0,
                columns: ['Name'],
                values: ['Duplicate'],
            }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'insertRowResult');
            assert.ok(event);
            const payload = event.payload as { success: boolean; error?: { message: string } };
            assert.strictEqual(payload.success, false);
            assert.ok(payload.error);
        });

        it('should send error when no table selected', async () => {
            session.clearTable();
            const { win, sentEvents } = createMockWindow();

            await routeCommand('insertRow', {
                newRowIndex: 0,
                columns: ['Name'],
                values: ['Test'],
            }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
        });
    });

    // ============================================
    // deleteRow (Task 7.3)
    // ============================================

    describe('deleteRow', () => {
        beforeEach(() => {
            startTestSession();
            session.setNamespace('USER');
            session.setTable('SQLUser.TestTable', createTestSchema());
        });

        it('should return deleteRowResult on success', async () => {
            const { win, sentEvents } = createMockWindow();

            await routeCommand('deleteRow', {
                rowIndex: 2,
                primaryKeyColumn: 'ID',
                primaryKeyValue: 42,
            }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'deleteRowResult');
            assert.ok(event);
            const payload = event.payload as { success: boolean; rowIndex: number };
            assert.strictEqual(payload.success, true);
            assert.strictEqual(payload.rowIndex, 2);
        });

        it('should return error in deleteRowResult on failure', async () => {
            mockDeleteRowResult = {
                success: false,
                error: {
                    message: 'Row locked',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: true,
                    context: 'deleteRow',
                },
            };
            const { win, sentEvents } = createMockWindow();

            await routeCommand('deleteRow', {
                rowIndex: 2,
                primaryKeyColumn: 'ID',
                primaryKeyValue: 42,
            }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'deleteRowResult');
            assert.ok(event);
            const payload = event.payload as { success: boolean; error?: { message: string } };
            assert.strictEqual(payload.success, false);
            assert.ok(payload.error);
        });

        it('should send error when no table selected', async () => {
            session.clearTable();
            const { win, sentEvents } = createMockWindow();

            await routeCommand('deleteRow', {
                rowIndex: 2,
                primaryKeyColumn: 'ID',
                primaryKeyValue: 42,
            }, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
        });
    });

    // ============================================
    // Data commands with no sessionManager (Task 7.4)
    // ============================================

    describe('data commands without sessionManager param', () => {
        it('should send error when sessionManager is undefined', async () => {
            const { win, sentEvents } = createMockWindow();
            await routeCommand('getNamespaces', {}, win, stubConnMgr, stubLifecycleMgr);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
            const payload = event.payload as { message: string };
            assert.ok(payload.message.includes('Not connected'));
        });
    });
});
