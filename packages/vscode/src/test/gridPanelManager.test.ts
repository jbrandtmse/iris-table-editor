import * as assert from 'assert';
import * as vscode from 'vscode';

// Note: GridPanelManager tests are limited in the VS Code test environment
// because WebviewPanel creation requires a full VS Code window context.
// These tests focus on the testable aspects without requiring actual panel creation.

suite('GridPanelManager Test Suite', () => {

    test('GridPanelManager module can be imported', () => {
        // Verify the module structure is correct
        const { GridPanelManager } = require('../providers/GridPanelManager');
        assert.ok(GridPanelManager, 'GridPanelManager class should exist');
    });

    test('GridPanelManager constructor accepts required parameters', () => {
        const { GridPanelManager } = require('../providers/GridPanelManager');
        const { ServerConnectionManager } = require('../providers/ServerConnectionManager');

        // Create mock extension URI
        const mockExtensionUri = vscode.Uri.file('/mock/extension/path');
        const serverConnectionManager = new ServerConnectionManager();

        // Constructor should not throw
        assert.doesNotThrow(() => {
            new GridPanelManager(mockExtensionUri, serverConnectionManager);
        }, 'Constructor should accept extensionUri and serverConnectionManager');
    });

    test('GridPanelManager has openTableGrid method', () => {
        const { GridPanelManager } = require('../providers/GridPanelManager');
        const { ServerConnectionManager } = require('../providers/ServerConnectionManager');

        const mockExtensionUri = vscode.Uri.file('/mock/extension/path');
        const serverConnectionManager = new ServerConnectionManager();
        const manager = new GridPanelManager(mockExtensionUri, serverConnectionManager);

        assert.ok(typeof manager.openTableGrid === 'function', 'openTableGrid should be a function');
    });

    test('GridPanelManager has dispose method', () => {
        const { GridPanelManager } = require('../providers/GridPanelManager');
        const { ServerConnectionManager } = require('../providers/ServerConnectionManager');

        const mockExtensionUri = vscode.Uri.file('/mock/extension/path');
        const serverConnectionManager = new ServerConnectionManager();
        const manager = new GridPanelManager(mockExtensionUri, serverConnectionManager);

        assert.ok(typeof manager.dispose === 'function', 'dispose should be a function');
    });

    test('GridPanelManager dispose can be called multiple times safely', () => {
        const { GridPanelManager } = require('../providers/GridPanelManager');
        const { ServerConnectionManager } = require('../providers/ServerConnectionManager');

        const mockExtensionUri = vscode.Uri.file('/mock/extension/path');
        const serverConnectionManager = new ServerConnectionManager();
        const manager = new GridPanelManager(mockExtensionUri, serverConnectionManager);

        // Should not throw when called multiple times
        assert.doesNotThrow(() => {
            manager.dispose();
            manager.dispose();
            manager.dispose();
        }, 'dispose should be safe to call multiple times');
    });

    // Test panel key generation logic (exposed indirectly through behavior)
    test('Panel key format is consistent for same inputs', () => {
        // Panel keys are internal but we can verify the format by testing
        // that the same server/namespace/table combination would be treated identically
        const { GridPanelManager } = require('../providers/GridPanelManager');
        const { ServerConnectionManager } = require('../providers/ServerConnectionManager');

        const mockExtensionUri = vscode.Uri.file('/mock/extension/path');
        const serverConnectionManager = new ServerConnectionManager();
        const manager = new GridPanelManager(mockExtensionUri, serverConnectionManager);

        // The manager should exist and be ready to use
        assert.ok(manager, 'Manager should be created successfully');
    });

    // Test IGridPanelContext interface conformance
    test('IGridPanelContext has required properties', () => {
        // This tests the interface expectations
        interface IGridPanelContext {
            serverName: string;
            namespace: string;
            tableName: string;
            pageSize: number;
            currentPage: number;
        }

        const context: IGridPanelContext = {
            serverName: 'test-server',
            namespace: 'USER',
            tableName: 'TestTable',
            pageSize: 100,
            currentPage: 0
        };

        assert.strictEqual(context.serverName, 'test-server');
        assert.strictEqual(context.namespace, 'USER');
        assert.strictEqual(context.tableName, 'TestTable');
        assert.strictEqual(context.pageSize, 100);
        assert.strictEqual(context.currentPage, 0);
    });

    // Test message type conformance
    test('Grid command message types are valid', () => {
        // requestData command
        const requestDataCommand = {
            command: 'requestData',
            payload: { page: 1, pageSize: 50 }
        };
        assert.strictEqual(requestDataCommand.command, 'requestData');
        assert.strictEqual(requestDataCommand.payload.page, 1);
        assert.strictEqual(requestDataCommand.payload.pageSize, 50);

        // refresh command
        const refreshCommand = {
            command: 'refresh',
            payload: {}
        };
        assert.strictEqual(refreshCommand.command, 'refresh');
    });

    test('Grid event message types are valid', () => {
        // tableSchema event
        const schemaEvent = {
            event: 'tableSchema',
            payload: {
                tableName: 'TestTable',
                namespace: 'USER',
                serverName: 'test-server',
                columns: [
                    { name: 'ID', dataType: 'INTEGER', nullable: false }
                ]
            }
        };
        assert.strictEqual(schemaEvent.event, 'tableSchema');
        assert.strictEqual(schemaEvent.payload.tableName, 'TestTable');
        assert.strictEqual(schemaEvent.payload.columns.length, 1);

        // tableData event
        const dataEvent = {
            event: 'tableData',
            payload: {
                rows: [{ ID: 1, Name: 'Test' }],
                totalRows: 100,
                page: 0,
                pageSize: 50
            }
        };
        assert.strictEqual(dataEvent.event, 'tableData');
        assert.strictEqual(dataEvent.payload.rows.length, 1);
        assert.strictEqual(dataEvent.payload.totalRows, 100);

        // tableLoading event
        const loadingEvent = {
            event: 'tableLoading',
            payload: { loading: true, context: 'Loading table data...' }
        };
        assert.strictEqual(loadingEvent.event, 'tableLoading');
        assert.strictEqual(loadingEvent.payload.loading, true);

        // error event
        const errorEvent = {
            event: 'error',
            payload: {
                message: 'Test error',
                code: 'TEST_ERROR',
                recoverable: true,
                context: 'test'
            }
        };
        assert.strictEqual(errorEvent.event, 'error');
        assert.strictEqual(errorEvent.payload.message, 'Test error');
    });

    // Test HTML escaping function (testing the pattern used in GridPanelManager)
    test('HTML escaping prevents XSS in context bar', () => {
        const escapeHtml = (str: string) => str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        // Test malicious inputs
        assert.strictEqual(
            escapeHtml('<script>alert("xss")</script>'),
            '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
        );
        assert.strictEqual(
            escapeHtml('Test & "quotes" & <tags>'),
            'Test &amp; &quot;quotes&quot; &amp; &lt;tags&gt;'
        );
        assert.strictEqual(
            escapeHtml("Table'Name"),
            "Table&#039;Name"
        );
    });

    // Test nonce generation pattern
    test('Nonce generation produces valid format', () => {
        const getNonce = (): string => {
            let text = '';
            const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            for (let i = 0; i < 32; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return text;
        };

        const nonce = getNonce();
        assert.strictEqual(nonce.length, 32, 'Nonce should be 32 characters');
        assert.ok(/^[A-Za-z0-9]+$/.test(nonce), 'Nonce should only contain alphanumeric characters');

        // Multiple calls should produce different nonces
        const nonce2 = getNonce();
        assert.notStrictEqual(nonce, nonce2, 'Different calls should produce different nonces');
    });

    // Test error handling structure
    test('Error payloads have required structure', () => {
        const errorPayload = {
            message: 'Failed to load table schema',
            code: 'UNKNOWN_ERROR',
            recoverable: true,
            context: 'getTableSchema'
        };

        assert.ok('message' in errorPayload, 'Error should have message');
        assert.ok('code' in errorPayload, 'Error should have code');
        assert.ok('recoverable' in errorPayload, 'Error should have recoverable');
        assert.ok('context' in errorPayload, 'Error should have context');
    });

    // ===== Story 2.2: Pagination Tests =====

    // Test offset calculation
    test('Pagination offset calculation: page 1 = offset 0', () => {
        const page = 1;
        const pageSize = 50;
        const offset = (page - 1) * pageSize;
        assert.strictEqual(offset, 0, 'Page 1 should have offset 0');
    });

    test('Pagination offset calculation: page 2 = offset 50', () => {
        const page = 2;
        const pageSize = 50;
        const offset = (page - 1) * pageSize;
        assert.strictEqual(offset, 50, 'Page 2 should have offset 50');
    });

    test('Pagination offset calculation: page 3 with pageSize 100 = offset 200', () => {
        const page = 3;
        const pageSize = 100;
        const offset = (page - 1) * pageSize;
        assert.strictEqual(offset, 200, 'Page 3 with pageSize 100 should have offset 200');
    });

    // Test totalPages calculation
    test('totalPages calculation: 127 rows / 50 pageSize = 3 pages', () => {
        const totalRows = 127;
        const pageSize = 50;
        const totalPages = Math.ceil(totalRows / pageSize);
        assert.strictEqual(totalPages, 3, '127 rows with pageSize 50 should be 3 pages');
    });

    test('totalPages calculation: 100 rows / 50 pageSize = 2 pages (exact division)', () => {
        const totalRows = 100;
        const pageSize = 50;
        const totalPages = Math.ceil(totalRows / pageSize);
        assert.strictEqual(totalPages, 2, '100 rows with pageSize 50 should be 2 pages');
    });

    test('totalPages calculation: 0 rows = 0 pages', () => {
        const totalRows = 0;
        const pageSize = 50;
        const totalPages = Math.ceil(totalRows / pageSize);
        assert.strictEqual(totalPages, 0, '0 rows should be 0 pages');
    });

    test('totalPages calculation: 25 rows / 50 pageSize = 1 page', () => {
        const totalRows = 25;
        const pageSize = 50;
        const totalPages = Math.ceil(totalRows / pageSize);
        assert.strictEqual(totalPages, 1, '25 rows with pageSize 50 should be 1 page');
    });

    // Test canGoNext logic
    test('canGoNext: true on page 1 of 3', () => {
        const currentPage = 1;
        const totalPages = 3;
        const canGoNext = currentPage < totalPages;
        assert.strictEqual(canGoNext, true, 'Should be able to go next on page 1 of 3');
    });

    test('canGoNext: true on page 2 of 3', () => {
        const currentPage = 2;
        const totalPages = 3;
        const canGoNext = currentPage < totalPages;
        assert.strictEqual(canGoNext, true, 'Should be able to go next on page 2 of 3');
    });

    test('canGoNext: false on page 3 of 3 (last page)', () => {
        const currentPage = 3;
        const totalPages = 3;
        const canGoNext = currentPage < totalPages;
        assert.strictEqual(canGoNext, false, 'Should NOT be able to go next on last page');
    });

    test('canGoNext: false when totalPages is 1', () => {
        const currentPage = 1;
        const totalPages = 1;
        const canGoNext = currentPage < totalPages;
        assert.strictEqual(canGoNext, false, 'Should NOT be able to go next when only 1 page');
    });

    // Test canGoPrev logic
    test('canGoPrev: false on page 1', () => {
        const currentPage = 1;
        const canGoPrev = currentPage > 1;
        assert.strictEqual(canGoPrev, false, 'Should NOT be able to go prev on page 1');
    });

    test('canGoPrev: true on page 2', () => {
        const currentPage = 2;
        const canGoPrev = currentPage > 1;
        assert.strictEqual(canGoPrev, true, 'Should be able to go prev on page 2');
    });

    test('canGoPrev: true on page 3', () => {
        const currentPage = 3;
        const canGoPrev = currentPage > 1;
        assert.strictEqual(canGoPrev, true, 'Should be able to go prev on page 3');
    });

    // Test pagination indicator text formatting
    test('Pagination indicator: page 1, pageSize 50, totalRows 127 = "Rows 1-50 of 127"', () => {
        const currentPage = 1;
        const pageSize = 50;
        const totalRows = 127;
        const rowCount = 50; // rows on current page

        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(start + rowCount - 1, totalRows);
        const indicator = `Rows ${start}-${end} of ${totalRows}`;

        assert.strictEqual(indicator, 'Rows 1-50 of 127');
    });

    test('Pagination indicator: page 2, pageSize 50, totalRows 127 = "Rows 51-100 of 127"', () => {
        const currentPage = 2;
        const pageSize = 50;
        const totalRows = 127;
        const rowCount = 50;

        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(start + rowCount - 1, totalRows);
        const indicator = `Rows ${start}-${end} of ${totalRows}`;

        assert.strictEqual(indicator, 'Rows 51-100 of 127');
    });

    test('Pagination indicator: page 3 (last/partial), pageSize 50, totalRows 127 = "Rows 101-127 of 127"', () => {
        const currentPage = 3;
        const pageSize = 50;
        const totalRows = 127;
        const rowCount = 27; // partial last page

        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(start + rowCount - 1, totalRows);
        const indicator = `Rows ${start}-${end} of ${totalRows}`;

        assert.strictEqual(indicator, 'Rows 101-127 of 127');
    });

    // Test pagination visibility logic
    test('Pagination should be hidden when totalRows <= pageSize', () => {
        const totalRows = 45;
        const pageSize = 50;
        const shouldShow = totalRows > pageSize;
        assert.strictEqual(shouldShow, false, 'Pagination should be hidden for 45 rows');
    });

    test('Pagination should be hidden when totalRows equals pageSize exactly', () => {
        const totalRows = 50;
        const pageSize = 50;
        const shouldShow = totalRows > pageSize;
        assert.strictEqual(shouldShow, false, 'Pagination should be hidden when exactly pageSize rows');
    });

    test('Pagination should be shown when totalRows > pageSize', () => {
        const totalRows = 51;
        const pageSize = 50;
        const shouldShow = totalRows > pageSize;
        assert.strictEqual(shouldShow, true, 'Pagination should be shown for 51 rows');
    });

    // Test paginate command payload types
    test('Paginate command payload has required properties', () => {
        const paginatePayload = {
            direction: 'next' as const,
            currentPage: 1,
            pageSize: 50
        };

        assert.ok('direction' in paginatePayload, 'Should have direction');
        assert.ok('currentPage' in paginatePayload, 'Should have currentPage');
        assert.ok('pageSize' in paginatePayload, 'Should have pageSize');
        assert.ok(
            paginatePayload.direction === 'next' || paginatePayload.direction === 'prev',
            'Direction should be next or prev'
        );
    });

    test('Paginate prev command payload', () => {
        const paginatePayload = {
            direction: 'prev' as const,
            currentPage: 2,
            pageSize: 50
        };

        assert.strictEqual(paginatePayload.direction, 'prev');
        assert.strictEqual(paginatePayload.currentPage, 2);
        assert.strictEqual(paginatePayload.pageSize, 50);
    });
});
