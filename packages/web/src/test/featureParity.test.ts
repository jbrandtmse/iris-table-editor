/**
 * Feature Parity Verification Tests (Web)
 * Story 19.1: Verify all 24 feature parity checkpoints from Epic 14
 * are accounted for in the web target codebase.
 *
 * These are STRUCTURAL verification tests that read source files and
 * check for expected patterns. No live server or IRIS connection needed.
 *
 * Uses Node.js built-in test runner.
 */
import { describe, it } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Helper: Read source file contents
// ============================================

function readSource(relativePath: string): string {
    const fullPath = path.resolve(__dirname, '..', '..', relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
}

function readWebviewSource(relativePath: string): string {
    // Resolve @iris-te/webview package
    const webviewPkgPath = path.dirname(require.resolve('@iris-te/webview/package.json'));
    const fullPath = path.join(webviewPkgPath, relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
}

function fileExists(relativePath: string): boolean {
    const fullPath = path.resolve(__dirname, '..', '..', relativePath);
    return fs.existsSync(fullPath);
}

function webviewFileExists(relativePath: string): boolean {
    const webviewPkgPath = path.dirname(require.resolve('@iris-te/webview/package.json'));
    const fullPath = path.join(webviewPkgPath, relativePath);
    return fs.existsSync(fullPath);
}

// ============================================
// Task 1: Shared Webview Assets (Task 1.2)
// ============================================

describe('Feature Parity - Shared Webview Assets (Task 1.2)', () => {

    it('should have main.js in @iris-te/webview package', () => {
        assert.ok(
            webviewFileExists('src/main.js'),
            '@iris-te/webview should contain src/main.js'
        );
    });

    it('should have styles.css in @iris-te/webview package', () => {
        assert.ok(
            webviewFileExists('src/styles.css'),
            '@iris-te/webview should contain src/styles.css'
        );
    });

    it('should have grid.js in @iris-te/webview package', () => {
        assert.ok(
            webviewFileExists('src/grid.js'),
            '@iris-te/webview should contain src/grid.js'
        );
    });

    it('should have grid-styles.css in @iris-te/webview package', () => {
        assert.ok(
            webviewFileExists('src/grid-styles.css'),
            '@iris-te/webview should contain src/grid-styles.css'
        );
    });

    it('should have theme.css in @iris-te/webview package', () => {
        assert.ok(
            webviewFileExists('src/theme.css'),
            '@iris-te/webview should contain src/theme.css'
        );
    });

    it('should have webview.html in @iris-te/webview package', () => {
        assert.ok(
            webviewFileExists('src/webview.html'),
            '@iris-te/webview should contain src/webview.html'
        );
    });

    it('server.ts should serve webview assets from /webview/ path', () => {
        const serverSource = readSource('src/server/server.ts');
        assert.ok(
            serverSource.includes("'/webview'") && serverSource.includes('express.static'),
            'server.ts should serve @iris-te/webview assets at /webview/'
        );
    });

    it('server.ts should resolve @iris-te/webview package', () => {
        const serverSource = readSource('src/server/server.ts');
        assert.ok(
            serverSource.includes('@iris-te/webview/package.json'),
            'server.ts should resolve the @iris-te/webview package path'
        );
    });
});

// ============================================
// Task 1: Command Handler Completeness (Task 1.3)
// ============================================

describe('Feature Parity - Command Handler Completeness (Task 1.3)', () => {
    let commandHandlerSource: string;

    it('should load commandHandler.ts source', () => {
        commandHandlerSource = readSource('src/server/commandHandler.ts');
        assert.ok(commandHandlerSource.length > 0, 'commandHandler.ts should not be empty');
    });

    // Checkpoints 1-3: Grid display, column headers, pagination
    it('should handle selectTable command (checkpoints 1-3: grid, headers)', () => {
        assert.ok(
            commandHandlerSource.includes("case 'selectTable'"),
            'commandHandler should handle selectTable command'
        );
    });

    it('should handle paginate command (checkpoint 3: pagination)', () => {
        assert.ok(
            commandHandlerSource.includes("case 'paginate'"),
            'commandHandler should handle paginate command'
        );
    });

    it('should handle requestData command (data retrieval with sort/filter)', () => {
        assert.ok(
            commandHandlerSource.includes("case 'requestData'"),
            'commandHandler should handle requestData command'
        );
    });

    // Checkpoint 9: Row creation
    it('should handle insertRow command (checkpoint 9: row creation)', () => {
        assert.ok(
            commandHandlerSource.includes("case 'insertRow'"),
            'commandHandler should handle insertRow command'
        );
    });

    // Checkpoint 10: Row deletion
    it('should handle deleteRow command (checkpoint 10: row deletion)', () => {
        assert.ok(
            commandHandlerSource.includes("case 'deleteRow'"),
            'commandHandler should handle deleteRow command'
        );
    });

    // Checkpoint 11: Schema tree / namespace browsing
    it('should handle getNamespaces command (checkpoint 11: namespace browsing)', () => {
        assert.ok(
            commandHandlerSource.includes("case 'getNamespaces'"),
            'commandHandler should handle getNamespaces command'
        );
    });

    it('should handle getTables command (checkpoint 11: table browsing)', () => {
        assert.ok(
            commandHandlerSource.includes("case 'getTables'"),
            'commandHandler should handle getTables command'
        );
    });

    // Cell editing (checkpoints 4-7)
    it('should handle updateRow command (checkpoints 4-7: cell editing, save)', () => {
        assert.ok(
            commandHandlerSource.includes("case 'updateRow'"),
            'commandHandler should handle updateRow command'
        );
    });

    // Data refresh
    it('should handle refreshData command', () => {
        assert.ok(
            commandHandlerSource.includes("case 'refreshData'"),
            'commandHandler should handle refreshData command'
        );
    });

    // Sort/filter support in requestData
    it('should pass sortColumn and sortDirection to getTableData (checkpoint 14: sorting)', () => {
        assert.ok(
            commandHandlerSource.includes('sortColumn') && commandHandlerSource.includes('sortDirection'),
            'commandHandler should support sort parameters in requestData'
        );
    });

    it('should pass filters to getTableData (checkpoints 12-13: filtering)', () => {
        assert.ok(
            commandHandlerSource.includes('filters'),
            'commandHandler should support filter parameters in requestData'
        );
    });

    // Return events map to the correct response events
    it('should return tableSelected event from selectTable', () => {
        assert.ok(
            commandHandlerSource.includes("event: 'tableSelected'"),
            'selectTable should return tableSelected event'
        );
    });

    it('should return saveCellResult event from updateRow', () => {
        assert.ok(
            commandHandlerSource.includes("event: 'saveCellResult'"),
            'updateRow should return saveCellResult event'
        );
    });

    it('should return insertRowResult event from insertRow', () => {
        assert.ok(
            commandHandlerSource.includes("event: 'insertRowResult'"),
            'insertRow should return insertRowResult event'
        );
    });

    it('should return deleteRowResult event from deleteRow', () => {
        assert.ok(
            commandHandlerSource.includes("event: 'deleteRowResult'"),
            'deleteRow should return deleteRowResult event'
        );
    });

    it('should return error event for unknown commands', () => {
        assert.ok(
            commandHandlerSource.includes("'UNKNOWN_COMMAND'"),
            'commandHandler should return UNKNOWN_COMMAND error for unknown commands'
        );
    });
});

// ============================================
// Task 1: WebSocket Routing (Task 1.5)
// ============================================

describe('Feature Parity - WebSocket Routing (Task 1.5)', () => {
    let wsServerSource: string;

    it('should load wsServer.ts source', () => {
        wsServerSource = readSource('src/server/wsServer.ts');
        assert.ok(wsServerSource.length > 0, 'wsServer.ts should not be empty');
    });

    it('should import handleCommand from commandHandler', () => {
        assert.ok(
            wsServerSource.includes('handleCommand') && wsServerSource.includes('./commandHandler'),
            'wsServer should import handleCommand from commandHandler'
        );
    });

    it('should parse incoming JSON messages', () => {
        assert.ok(
            wsServerSource.includes('JSON.parse'),
            'wsServer should parse incoming WebSocket messages as JSON'
        );
    });

    it('should extract command and payload from messages', () => {
        assert.ok(
            wsServerSource.includes('message.command') && wsServerSource.includes('message.payload'),
            'wsServer should extract command and payload from parsed messages'
        );
    });

    it('should call handleCommand with command, payload, session, context, services', () => {
        assert.ok(
            wsServerSource.includes('handleCommand(command, payload, session, context, services)'),
            'wsServer should route messages to handleCommand with all required arguments'
        );
    });

    it('should send results back as JSON', () => {
        assert.ok(
            wsServerSource.includes('JSON.stringify(r)'),
            'wsServer should stringify command results before sending'
        );
    });

    it('should handle malformed JSON gracefully', () => {
        assert.ok(
            wsServerSource.includes('INVALID_JSON'),
            'wsServer should return INVALID_JSON error for malformed messages'
        );
    });

    it('should handle missing command field gracefully', () => {
        assert.ok(
            wsServerSource.includes('INVALID_MESSAGE'),
            'wsServer should return INVALID_MESSAGE error when command is missing'
        );
    });

    it('should handle command execution errors', () => {
        assert.ok(
            wsServerSource.includes('COMMAND_ERROR'),
            'wsServer should return COMMAND_ERROR when handleCommand throws'
        );
    });
});

// ============================================
// Task 1: API Proxy Coverage (Task 1.4)
// ============================================

describe('Feature Parity - API Proxy Coverage (Task 1.4)', () => {
    let apiProxySource: string;

    it('should load apiProxy.ts source', () => {
        apiProxySource = readSource('src/server/apiProxy.ts');
        assert.ok(apiProxySource.length > 0, 'apiProxy.ts should not be empty');
    });

    it('should proxy queries to /api/iris/query endpoint', () => {
        assert.ok(
            apiProxySource.includes('/api/iris/query'),
            'apiProxy should define POST /api/iris/query route'
        );
    });

    it('should use UrlBuilder.buildQueryUrl for Atelier /action/query', () => {
        assert.ok(
            apiProxySource.includes('UrlBuilder.buildQueryUrl'),
            'apiProxy should use UrlBuilder to build Atelier query URL'
        );
    });

    it('should build auth header from session credentials', () => {
        assert.ok(
            apiProxySource.includes('buildAuthHeader') && apiProxySource.includes('Authorization'),
            'apiProxy should build and inject Authorization header'
        );
    });

    it('should validate session before proxying', () => {
        assert.ok(
            apiProxySource.includes('sessionManager.validate'),
            'apiProxy should validate session on each query request'
        );
    });

    it('should forward query and parameters from request body', () => {
        assert.ok(
            apiProxySource.includes('req.body') &&
            apiProxySource.includes('query') &&
            apiProxySource.includes('parameters'),
            'apiProxy should forward query and parameters from the request body'
        );
    });

    it('should handle connect endpoint at /api/connect', () => {
        assert.ok(
            apiProxySource.includes('/api/connect'),
            'apiProxy should define POST /api/connect endpoint'
        );
    });

    it('should handle disconnect endpoint at /api/disconnect', () => {
        assert.ok(
            apiProxySource.includes('/api/disconnect'),
            'apiProxy should define POST /api/disconnect endpoint'
        );
    });

    it('should handle session status at /api/session', () => {
        assert.ok(
            apiProxySource.includes('/api/session'),
            'apiProxy should define GET /api/session endpoint'
        );
    });

    it('should handle timeout errors with appropriate status code', () => {
        assert.ok(
            apiProxySource.includes('AbortError') && apiProxySource.includes('504'),
            'apiProxy should classify timeout errors as 504'
        );
    });

    it('should handle network errors with appropriate status code', () => {
        assert.ok(
            apiProxySource.includes('ECONNREFUSED') && apiProxySource.includes('502'),
            'apiProxy should classify network errors as 502'
        );
    });
});

// ============================================
// Task 2: Bridge Interface (Tasks 2.1-2.3)
// ============================================

describe('Feature Parity - Bridge Interface (Task 2.1)', () => {
    let bridgeSource: string;

    it('should load WebMessageBridge.js source', () => {
        bridgeSource = readSource('public/WebMessageBridge.js');
        assert.ok(bridgeSource.length > 0, 'WebMessageBridge.js should not be empty');
    });

    it('should implement sendCommand method', () => {
        assert.ok(
            bridgeSource.includes('WebMessageBridge.prototype.sendCommand'),
            'WebMessageBridge should implement sendCommand'
        );
    });

    it('should implement onEvent method', () => {
        assert.ok(
            bridgeSource.includes('WebMessageBridge.prototype.onEvent'),
            'WebMessageBridge should implement onEvent'
        );
    });

    it('should implement offEvent method', () => {
        assert.ok(
            bridgeSource.includes('WebMessageBridge.prototype.offEvent'),
            'WebMessageBridge should implement offEvent'
        );
    });

    it('should implement getState method', () => {
        assert.ok(
            bridgeSource.includes('WebMessageBridge.prototype.getState'),
            'WebMessageBridge should implement getState'
        );
    });

    it('should implement setState method', () => {
        assert.ok(
            bridgeSource.includes('WebMessageBridge.prototype.setState'),
            'WebMessageBridge should implement setState'
        );
    });

    it('should implement destroy method for cleanup', () => {
        assert.ok(
            bridgeSource.includes('WebMessageBridge.prototype.destroy'),
            'WebMessageBridge should implement destroy for lifecycle cleanup'
        );
    });
});

describe('Feature Parity - Bridge Message Format (Task 2.2)', () => {
    let bridgeSource: string;

    it('should load bridge source', () => {
        bridgeSource = readSource('public/WebMessageBridge.js');
    });

    it('should serialize commands as { command, payload } JSON', () => {
        assert.ok(
            bridgeSource.includes('JSON.stringify({ command: command, payload: payload })'),
            'sendCommand should serialize messages as { command, payload }'
        );
    });

    it('should dispatch incoming events using event name and payload', () => {
        assert.ok(
            bridgeSource.includes('data.event') && bridgeSource.includes('data.payload'),
            'Bridge should extract event name and payload from incoming messages'
        );
    });

    it('should dispatch to handlers via _dispatch(event, payload)', () => {
        assert.ok(
            bridgeSource.includes("self._dispatch(data.event, data.payload)"),
            'Bridge should dispatch events to registered handlers'
        );
    });

    it('should use sessionStorage for state persistence', () => {
        assert.ok(
            bridgeSource.includes('sessionStorage.getItem') && bridgeSource.includes('sessionStorage.setItem'),
            'Bridge should use sessionStorage for getState/setState'
        );
    });

    it('should buffer messages when WebSocket is not open', () => {
        assert.ok(
            bridgeSource.includes('_pendingMessages') && bridgeSource.includes('_flushPendingMessages'),
            'Bridge should buffer commands when WebSocket is not yet open'
        );
    });
});

describe('Feature Parity - Connection Form Commands (Task 2.3)', () => {
    let connectionFormSource: string;

    it('should load connection-form.js source', () => {
        connectionFormSource = readSource('public/connection-form.js');
        assert.ok(connectionFormSource.length > 0, 'connection-form.js should not be empty');
    });

    it('should send connect request to /api/connect', () => {
        assert.ok(
            connectionFormSource.includes('/api/connect'),
            'Connection form should POST to /api/connect'
        );
    });

    it('should send disconnect request to /api/disconnect', () => {
        assert.ok(
            connectionFormSource.includes('/api/disconnect'),
            'Connection form should POST to /api/disconnect'
        );
    });

    it('should check session status via /api/session', () => {
        assert.ok(
            connectionFormSource.includes('/api/session'),
            'Connection form should GET /api/session to check status'
        );
    });

    it('should handle session expiry', () => {
        assert.ok(
            connectionFormSource.includes('handleSessionExpired'),
            'Connection form should handle session expiry events'
        );
    });

    it('should support test connection via /api/test-connection', () => {
        assert.ok(
            connectionFormSource.includes('/api/test-connection'),
            'Connection form should POST to /api/test-connection'
        );
    });
});

// ============================================
// Task 1: SPA Shell Integration (Task 1.6)
// ============================================

describe('Feature Parity - SPA Shell Integration (Task 1.6)', () => {
    let indexHtml: string;

    it('should load index.html', () => {
        indexHtml = readSource('public/index.html');
        assert.ok(indexHtml.length > 0, 'index.html should not be empty');
    });

    it('should include webview main.js script', () => {
        assert.ok(
            indexHtml.includes('/webview/main.js'),
            'SPA shell should load /webview/main.js'
        );
    });

    it('should include webview grid.js script', () => {
        assert.ok(
            indexHtml.includes('/webview/grid.js'),
            'SPA shell should load /webview/grid.js'
        );
    });

    it('should include webview styles.css', () => {
        assert.ok(
            indexHtml.includes('/webview/styles.css'),
            'SPA shell should load /webview/styles.css'
        );
    });

    it('should include webview theme.css', () => {
        assert.ok(
            indexHtml.includes('/webview/theme.css'),
            'SPA shell should load /webview/theme.css'
        );
    });

    it('should include webview grid-styles.css', () => {
        assert.ok(
            indexHtml.includes('/webview/grid-styles.css'),
            'SPA shell should load /webview/grid-styles.css'
        );
    });

    it('should include WebMessageBridge.js', () => {
        assert.ok(
            indexHtml.includes('WebMessageBridge.js'),
            'SPA shell should load WebMessageBridge.js'
        );
    });

    it('should load WebMessageBridge.js before webview/main.js', () => {
        const bridgePos = indexHtml.indexOf('WebMessageBridge.js');
        const mainPos = indexHtml.indexOf('/webview/main.js');
        assert.ok(bridgePos > 0 && mainPos > 0, 'Both scripts should exist');
        assert.ok(
            bridgePos < mainPos,
            'WebMessageBridge.js must load before /webview/main.js'
        );
    });

    it('should include .ite-container for webview rendering', () => {
        assert.ok(
            indexHtml.includes('ite-container'),
            'SPA shell should have .ite-container div'
        );
    });

    it('should include connected view with hidden attribute', () => {
        assert.ok(
            indexHtml.includes('connectedView') && indexHtml.includes('hidden'),
            'SPA shell should have connectedView div with hidden attribute'
        );
    });

    it('should include connection form view', () => {
        assert.ok(
            indexHtml.includes('connectionView') && indexHtml.includes('connectionForm'),
            'SPA shell should have connectionView with connectionForm'
        );
    });

    it('should include ARIA live region for accessibility', () => {
        assert.ok(
            indexHtml.includes('ite-live-region') && indexHtml.includes('aria-live'),
            'SPA shell should have ARIA live region for screen reader announcements'
        );
    });

    it('should include spa-router.js for client-side routing', () => {
        assert.ok(
            indexHtml.includes('spa-router.js'),
            'SPA shell should load spa-router.js'
        );
    });

    it('should include ws-reconnect.js for WebSocket connection', () => {
        assert.ok(
            indexHtml.includes('ws-reconnect.js'),
            'SPA shell should load ws-reconnect.js'
        );
    });
});

// ============================================
// Checkpoint Coverage: Client-Side Features in Shared Webview
// ============================================

describe('Feature Parity - Client-Side Features in Shared Webview', () => {
    let gridSource: string;
    let mainSource: string;

    it('should load grid.js and main.js sources', () => {
        gridSource = readWebviewSource('src/grid.js');
        mainSource = readWebviewSource('src/main.js');
        assert.ok(gridSource.length > 0, 'grid.js should not be empty');
        assert.ok(mainSource.length > 0, 'main.js should not be empty');
    });

    // Checkpoint 4: Cell selection
    it('checkpoint 4: grid.js should implement cell selection', () => {
        assert.ok(
            gridSource.includes('selectedCell'),
            'grid.js should track selectedCell state'
        );
    });

    // Checkpoint 5: Inline editing
    it('checkpoint 5: grid.js should implement inline cell editing', () => {
        assert.ok(
            gridSource.includes('editingCell'),
            'grid.js should track editingCell state for inline editing'
        );
    });

    // Checkpoint 6: Save
    it('checkpoint 6: grid.js should send saveCell command', () => {
        assert.ok(
            gridSource.includes("sendCommand('saveCell'"),
            'grid.js should send saveCell command for saving edits'
        );
    });

    // Checkpoint 7: Cancel editing
    it('checkpoint 7: grid.js should support edit cancellation', () => {
        assert.ok(
            gridSource.includes('editOriginalValue'),
            'grid.js should track editOriginalValue for cancel/restore'
        );
    });

    // Checkpoint 8: Visual feedback
    it('checkpoint 8: grid.js should track pending saves for visual feedback', () => {
        assert.ok(
            gridSource.includes('pendingSaves'),
            'grid.js should track pendingSaves for visual feedback'
        );
    });

    // Checkpoint 9: Row creation
    it('checkpoint 9: grid.js should send insertRow command', () => {
        assert.ok(
            gridSource.includes("sendCommand('insertRow'"),
            'grid.js should send insertRow command for new row creation'
        );
    });

    // Checkpoint 10: Row deletion
    it('checkpoint 10: grid.js should send deleteRow command', () => {
        assert.ok(
            gridSource.includes("sendCommand('deleteRow'"),
            'grid.js should send deleteRow command'
        );
    });

    // Checkpoint 11: Schema tree
    it('checkpoint 11: main.js should implement schema tree rendering', () => {
        assert.ok(
            mainSource.includes('parseTablesBySchema') && mainSource.includes('renderSchemaTree'),
            'main.js should implement schema tree with parseTablesBySchema'
        );
    });

    // Checkpoints 12-13: Column filtering / filter panel
    it('checkpoint 12-13: grid.js should implement filtering', () => {
        assert.ok(
            gridSource.includes('filters') && gridSource.includes('filtersEnabled'),
            'grid.js should support column filtering state'
        );
    });

    it('checkpoint 12-13: grid.js should support filter panel toggle', () => {
        assert.ok(
            gridSource.includes('menuToggleFilterPanel'),
            'grid.js should handle menuToggleFilterPanel event'
        );
    });

    // Checkpoint 14: Column sorting
    it('checkpoint 14: grid.js should support column sorting', () => {
        assert.ok(
            gridSource.includes('sortColumn') && gridSource.includes('sortDirection'),
            'grid.js should track sortColumn and sortDirection state'
        );
    });

    // Checkpoint 15: Boolean checkbox
    it('checkpoint 15: grid.js should handle boolean data types', () => {
        // Boolean checkboxes are rendered in grid cells for boolean columns
        assert.ok(
            gridSource.includes('checkbox') || gridSource.includes('boolean'),
            'grid.js should handle boolean data type rendering'
        );
    });

    // Checkpoint 16: Date picker
    it('checkpoint 16: grid.js should handle date data types', () => {
        assert.ok(
            gridSource.includes('date') || gridSource.includes('DATE'),
            'grid.js should handle date data type input'
        );
    });

    // Checkpoint 17: Time fields
    it('checkpoint 17: grid.js should handle time data types', () => {
        assert.ok(
            gridSource.includes('time') || gridSource.includes('TIME'),
            'grid.js should handle time data type input'
        );
    });

    // Checkpoint 18: Numeric fields
    it('checkpoint 18: grid.js should handle numeric data types', () => {
        assert.ok(
            gridSource.includes('number') || gridSource.includes('NUMERIC') || gridSource.includes('INTEGER'),
            'grid.js should handle numeric data type input'
        );
    });

    // Checkpoint 19: Null values
    it('checkpoint 19: grid.js should support null values', () => {
        assert.ok(
            gridSource.includes('null') && gridSource.includes('menuSetNull'),
            'grid.js should support setting null values via menuSetNull'
        );
    });

    // Checkpoint 20: Keyboard shortcuts
    it('checkpoint 20: grid.js should implement keyboard navigation', () => {
        assert.ok(
            gridSource.includes('ArrowUp') &&
            gridSource.includes('ArrowDown') &&
            gridSource.includes('ArrowLeft') &&
            gridSource.includes('ArrowRight'),
            'grid.js should handle arrow key navigation'
        );
    });

    it('checkpoint 20: grid.js should handle Enter/Escape for editing', () => {
        assert.ok(
            gridSource.includes("case 'Enter'") && gridSource.includes("case 'Escape'"),
            'grid.js should handle Enter and Escape keys'
        );
    });

    it('checkpoint 20: grid.js should handle Tab, Home, End, PageUp, PageDown', () => {
        assert.ok(
            gridSource.includes("case 'Tab'") &&
            gridSource.includes("case 'Home'") &&
            gridSource.includes("case 'End'") &&
            gridSource.includes("case 'PageUp'") &&
            gridSource.includes("case 'PageDown'"),
            'grid.js should handle extended keyboard shortcuts'
        );
    });

    it('checkpoint 20: grid.js should support keyboard shortcuts help', () => {
        assert.ok(
            gridSource.includes('menuShowShortcuts'),
            'grid.js should handle menuShowShortcuts event'
        );
    });

    // Checkpoints 21-24: Export/Import
    it('checkpoint 21: grid.js should send CSV export command', () => {
        assert.ok(
            gridSource.includes("sendCommand('exportAllCsv'"),
            'grid.js should send exportAllCsv command'
        );
    });

    it('checkpoint 22: grid.js should send Excel export command', () => {
        assert.ok(
            gridSource.includes("sendCommand('exportAllExcel'") ||
            gridSource.includes("sendCommand('exportCurrentPageExcel'"),
            'grid.js should send Excel export commands'
        );
    });

    it('checkpoint 23: grid.js should send CSV import command', () => {
        assert.ok(
            gridSource.includes("sendCommand('importSelectFile'") ||
            gridSource.includes("sendCommand('importExecute'") ||
            gridSource.includes("sendCommand('importValidate'"),
            'grid.js should send CSV import commands'
        );
    });

    it('checkpoint 24: grid.js should handle import results', () => {
        assert.ok(
            gridSource.includes("case 'importResult'") &&
            gridSource.includes("case 'importPreview'"),
            'grid.js should handle import result and preview events'
        );
    });

    it('checkpoint 22-24: grid.js should handle export results', () => {
        assert.ok(
            gridSource.includes("case 'exportResult'") &&
            gridSource.includes("case 'exportProgress'"),
            'grid.js should handle export result and progress events'
        );
    });
});

// ============================================
// Checkpoint Coverage: Server-Side Command/Event Mapping
// ============================================

describe('Feature Parity - Complete Command/Event Mapping', () => {

    it('should have all 9 server-side commands in commandHandler', () => {
        const source = readSource('src/server/commandHandler.ts');
        const expectedCommands = [
            'getNamespaces',
            'getTables',
            'selectTable',
            'requestData',
            'paginate',
            'refreshData',
            'updateRow',
            'insertRow',
            'deleteRow',
        ];
        for (const cmd of expectedCommands) {
            assert.ok(
                source.includes(`case '${cmd}'`),
                `commandHandler should handle '${cmd}' command`
            );
        }
    });

    it('should map commands to correct response events', () => {
        const source = readSource('src/server/commandHandler.ts');
        const eventMap: Record<string, string> = {
            getNamespaces: 'namespaceList',
            getTables: 'tableList',
            selectTable: 'tableSelected',
            requestData: 'tableData',
            paginate: 'tableData',
            refreshData: 'tableData',
            updateRow: 'saveCellResult',
            insertRow: 'insertRowResult',
            deleteRow: 'deleteRowResult',
        };
        for (const event of Object.values(eventMap)) {
            assert.ok(
                source.includes(`event: '${event}'`),
                `commandHandler should emit '${event}' event`
            );
        }
    });

    it('shared webview main.js should register event handlers for all expected events', () => {
        const source = readWebviewSource('src/main.js');
        const expectedEvents = [
            'serverList',
            'connectionStatus',
            'connectionProgress',
            'connectionError',
            'namespaceList',
            'namespaceSelected',
            'tableList',
            'tableSelected',
            'error',
        ];
        for (const evt of expectedEvents) {
            assert.ok(
                source.includes(`'${evt}'`),
                `main.js should handle '${evt}' event`
            );
        }
    });

    it('shared webview grid.js should register event handlers for grid events', () => {
        const source = readWebviewSource('src/grid.js');
        const expectedEvents = [
            'tableSchema',
            'tableData',
            'saveCellResult',
            'insertRowResult',
            'deleteRowResult',
            'importPreview',
            'importProgress',
            'importResult',
            'exportProgress',
            'exportResult',
            'error',
        ];
        for (const evt of expectedEvents) {
            assert.ok(
                source.includes(`'${evt}'`),
                `grid.js should handle '${evt}' event`
            );
        }
    });
});

// ============================================
// SPA Shell Serves Static Files
// ============================================

describe('Feature Parity - Static File Serving', () => {

    it('server.ts should serve public directory as static files', () => {
        const source = readSource('src/server/server.ts');
        assert.ok(
            source.includes('express.static(publicDir)'),
            'server.ts should serve public directory with express.static'
        );
    });

    it('server.ts should serve webview directory as static files at /webview/', () => {
        const source = readSource('src/server/server.ts');
        assert.ok(
            source.includes("'/webview'") && source.includes('express.static(webviewDir)'),
            'server.ts should serve webview directory at /webview/ path'
        );
    });

    it('server.ts should have SPA catch-all fallback to index.html', () => {
        const source = readSource('src/server/server.ts');
        assert.ok(
            source.includes(".get('*'") && source.includes('index.html'),
            'server.ts should have catch-all GET * route serving index.html'
        );
    });

    it('all required public files should exist', () => {
        const requiredFiles = [
            'public/index.html',
            'public/WebMessageBridge.js',
            'public/connection-form.js',
            'public/connection-form.css',
            'public/ws-reconnect.js',
            'public/spa-router.js',
        ];
        for (const file of requiredFiles) {
            assert.ok(fileExists(file), `${file} should exist in web package`);
        }
    });

    it('all required webview files should exist', () => {
        const requiredFiles = [
            'src/main.js',
            'src/grid.js',
            'src/styles.css',
            'src/grid-styles.css',
            'src/theme.css',
            'src/webview.html',
        ];
        for (const file of requiredFiles) {
            assert.ok(webviewFileExists(file), `${file} should exist in webview package`);
        }
    });
});
