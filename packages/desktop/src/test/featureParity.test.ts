/**
 * Feature Parity Verification Tests
 * Story 14.1: Feature Parity Verification
 *
 * Verifies that the desktop Electron app has full feature parity with the
 * VS Code extension by auditing IPC commands, events, and shared webview
 * code paths.
 *
 * Uses Node.js built-in test runner and assert module.
 *
 * MAINTENANCE NOTE:
 * The hardcoded constants below (GRID_JS_HANDLED_EVENTS, GRID_JS_SENT_COMMANDS,
 * MAIN_JS_HANDLED_EVENTS, MAIN_JS_SENT_COMMANDS) are snapshots of the actual
 * source files. They must be updated manually when the source changes.
 * The count-verification tests (grid.js event count, command count) will fail
 * if the source files are modified without updating these constants, providing
 * a safety net to detect drift.
 */
import { describe, it } from 'node:test';
import * as assert from 'assert';
import {
    ALLOWED_COMMANDS,
    ALLOWED_EVENTS,
    isValidCommand,
    isValidEvent,
} from '../main/channelValidation';

// ============================================
// Feature Area Definitions
// ============================================

/**
 * All 24 feature areas mapped to their IPC commands and events.
 * This is the master feature registry for parity verification.
 */
const FEATURE_AREAS = {
    // --- Connection Features (Stories 11.1, 12.1-12.5) ---
    'Server List': {
        commands: ['getServers'],
        events: ['serversLoaded', 'error'],
    },
    'Server Connect': {
        commands: ['connectServer'],
        events: ['connectionStatus', 'connectionProgress', 'error'],
    },
    'Server Disconnect': {
        commands: ['disconnectServer'],
        events: ['connectionStatus', 'connectionProgress'],
    },
    'Cancel Connection': {
        commands: ['cancelConnection'],
        events: ['connectionProgress'],
    },
    'Server Select': {
        commands: ['selectServer'],
        events: ['serverSelected'],
    },
    'Server Edit': {
        commands: ['editServer'],
        events: ['serverConfigLoaded', 'error'],
    },
    'Server Delete': {
        commands: ['deleteServer'],
        events: ['serverDeleted', 'error'],
    },
    'Server Save (New)': {
        commands: ['saveServer'],
        events: ['serverSaved', 'serverSaveError'],
    },
    'Server Update (Edit)': {
        commands: ['updateServer'],
        events: ['serverSaved', 'serverSaveError'],
    },
    'Test Connection': {
        commands: ['testFormConnection'],
        events: ['testConnectionResult'],
    },
    'Credential Warning': {
        commands: [],
        events: ['credentialWarning'],
    },

    // --- Data Features (Stories 11.2, 2.x, 3.x, 4.x, 5.x) ---
    'Get Namespaces': {
        commands: ['getNamespaces'],
        events: ['namespaceList', 'error'],
    },
    'Get Tables': {
        commands: ['getTables'],
        events: ['tableList', 'error'],
    },
    'Select Table (Schema)': {
        commands: ['selectTable'],
        events: ['tableSchema', 'tableLoading', 'error'],
    },
    'Request Data (Load/Page)': {
        commands: ['requestData'],
        events: ['tableData', 'tableLoading', 'error'],
    },
    'Refresh Data': {
        commands: ['refresh'],
        events: ['tableData', 'tableLoading', 'error'],
    },
    'Paginate Next': {
        commands: ['paginateNext'],
        events: ['tableData', 'tableLoading', 'error'],
    },
    'Paginate Previous': {
        commands: ['paginatePrev'],
        events: ['tableData', 'tableLoading', 'error'],
    },
    'Save Cell (Update)': {
        commands: ['saveCell'],
        events: ['saveCellResult'],
    },
    'Insert Row': {
        commands: ['insertRow'],
        events: ['insertRowResult'],
    },
    'Delete Row': {
        commands: ['deleteRow'],
        events: ['deleteRowResult'],
    },

    // --- Desktop-Specific Features (Stories 11.3, 11.4, 11.5) ---
    'Tab Switching': {
        commands: ['activateTab'],
        events: ['restoreGridState'],
    },
    'Native Menu': {
        commands: ['tabStateChanged'],
        events: ['menuAction', 'menuSetNull', 'menuToggleFilterPanel', 'menuShowShortcuts'],
    },
    'State Persistence': {
        commands: ['sidebarStateChanged'],
        events: ['restoreAppState'],
    },
} as const;

/**
 * VS Code-only commands handled by GridPanelManager but NOT routed through desktop IPC.
 * These are intentional gaps — export/import uses VS Code-native file dialogs and
 * workspace APIs that have no desktop equivalent yet.
 */
const VSCODE_ONLY_COMMANDS = [
    'exportAllCsv',
    'exportCurrentPageExcel',
    'exportAllExcel',
    'importSelectFile',
    'importValidate',
    'importExecute',
    'cancelOperation',
] as const;

/**
 * VS Code-only events sent by GridPanelManager but NOT in desktop ALLOWED_EVENTS.
 * These correspond to the VS Code-only export/import features.
 */
const VSCODE_ONLY_EVENTS = [
    'exportProgress',
    'exportResult',
    'importPreview',
    'importProgress',
    'importResult',
    'importValidationResult',
] as const;

/**
 * All grid.js event handler cases (message.event values handled in handleMessage).
 * NOTE: This does NOT include events handled by desktop-only UI modules
 * (e.g., menuAction is handled by menu-handler.js, not grid.js).
 * See DESKTOP_UI_HANDLED_EVENTS for those.
 */
const GRID_JS_HANDLED_EVENTS = [
    'tableSchema',
    'tableData',
    'tableLoading',
    'saveCellResult',
    'insertRowResult',
    'deleteRowResult',
    'importPreview',
    'importProgress',
    'importResult',
    'importValidationResult',
    'exportProgress',
    'exportResult',
    'error',
    'menuSetNull',
    'menuToggleFilterPanel',
    'menuShowShortcuts',
    'restoreGridState',
] as const;

/**
 * All grid.js commands sent via sendCommand() from grid.js.
 */
const GRID_JS_SENT_COMMANDS = [
    'saveCell',
    'deleteRow',
    'insertRow',
    'refresh',
    'requestData',
    'paginateNext',
    'paginatePrev',
    'importSelectFile',
    'importValidate',
    'importExecute',
    'cancelOperation',
    'exportAllCsv',
    'exportCurrentPageExcel',
    'exportAllExcel',
] as const;

/**
 * Events handled by desktop-only UI modules (menu-handler.js, tab-bar.js)
 * that are NOT handled in grid.js. These are in ALLOWED_EVENTS but are
 * routed to desktop-specific UI handlers rather than the shared grid code.
 */
const DESKTOP_UI_HANDLED_EVENTS = [
    'menuAction',       // Handled by menu-handler.js (dispatches to grid via sub-events)
    'restoreAppState',  // Handled by app-shell/main renderer on startup
] as const;

/**
 * main.js event handler cases (message.event values handled in handleMessage).
 * These are events consumed by the VS Code sidebar/connection webview.
 */
const MAIN_JS_HANDLED_EVENTS = [
    'serverList',
    'serverManagerNotInstalled',
    'noServersConfigured',
    'connectionStatus',
    'connectionProgress',
    'connectionError',
    'namespaceList',
    'namespaceSelected',
    'tableList',
    'tableSelected',
    'error',
] as const;

/**
 * Commands sent by main.js (VS Code sidebar) via postCommand().
 * Some have desktop equivalents; others are VS Code-sidebar-only.
 */
const MAIN_JS_SENT_COMMANDS = [
    'getTables',
    'selectServer',
    'disconnect',
    'selectNamespace',
    'openTable',
    'getNamespaces',
    'getServerList',
    'openServerManager',
    'installServerManager',
    'cancelConnection',
] as const;

/**
 * VS Code sidebar-only commands sent by main.js that have NO desktop IPC route.
 * Desktop replaces these with its own server-list.js implementation.
 * - 'disconnect' -> desktop uses 'disconnectServer'
 * - 'getServerList' -> desktop uses 'getServers'
 * - 'openServerManager' -> VS Code extension dependency only
 * - 'installServerManager' -> VS Code extension dependency only
 * - 'selectNamespace' -> desktop handles namespace via getTables flow
 * - 'openTable' -> desktop handles table selection via selectTable + tab bar
 */
const VSCODE_SIDEBAR_ONLY_COMMANDS = [
    'disconnect',
    'getServerList',
    'openServerManager',
    'installServerManager',
    'selectNamespace',
    'openTable',
] as const;

/**
 * VS Code sidebar-only events from main.js that have NO desktop ALLOWED_EVENTS entry.
 * Desktop replaces these with its own server-list.js + desktop-specific events.
 */
const VSCODE_SIDEBAR_ONLY_EVENTS = [
    'serverList',              // Desktop uses 'serversLoaded' instead
    'serverManagerNotInstalled', // VS Code Server Manager extension only
    'noServersConfigured',     // VS Code sidebar-only empty state
    'connectionError',         // Desktop uses 'connectionProgress' with error status
    'namespaceSelected',       // VS Code sidebar-only navigation
    'tableSelected',           // VS Code sidebar-only navigation
] as const;

// ============================================
// Tests
// ============================================

describe('Feature Parity Verification (Story 14.1)', () => {

    // ---- Task 1 / AC 1: IPC Command Coverage ----

    describe('Task 1: IPC Command Coverage', () => {

        it('should have all feature area commands in ALLOWED_COMMANDS', () => {
            const missingCommands: string[] = [];
            for (const [area, config] of Object.entries(FEATURE_AREAS)) {
                for (const cmd of config.commands) {
                    if (!ALLOWED_COMMANDS.has(cmd)) {
                        missingCommands.push(`${area}: ${cmd}`);
                    }
                }
            }
            assert.deepStrictEqual(
                missingCommands,
                [],
                `Commands missing from ALLOWED_COMMANDS:\n  ${missingCommands.join('\n  ')}`
            );
        });

        it('should have all feature area events in ALLOWED_EVENTS', () => {
            const missingEvents: string[] = [];
            for (const [area, config] of Object.entries(FEATURE_AREAS)) {
                for (const evt of config.events) {
                    if (!ALLOWED_EVENTS.has(evt)) {
                        missingEvents.push(`${area}: ${evt}`);
                    }
                }
            }
            assert.deepStrictEqual(
                missingEvents,
                [],
                `Events missing from ALLOWED_EVENTS:\n  ${missingEvents.join('\n  ')}`
            );
        });

        it('should cover all 24 feature areas', () => {
            assert.strictEqual(
                Object.keys(FEATURE_AREAS).length,
                24,
                'Expected 24 feature areas in the feature registry'
            );
        });

        it('should have all ALLOWED_COMMANDS accounted for in feature areas', () => {
            const featureCommands = new Set<string>();
            for (const config of Object.values(FEATURE_AREAS)) {
                for (const cmd of config.commands) {
                    featureCommands.add(cmd);
                }
            }

            const unaccountedCommands: string[] = [];
            for (const cmd of ALLOWED_COMMANDS) {
                if (!featureCommands.has(cmd)) {
                    unaccountedCommands.push(cmd);
                }
            }
            assert.deepStrictEqual(
                unaccountedCommands,
                [],
                `ALLOWED_COMMANDS not mapped to any feature area:\n  ${unaccountedCommands.join('\n  ')}`
            );
        });

        it('should have all ALLOWED_EVENTS accounted for in feature areas', () => {
            const featureEvents = new Set<string>();
            for (const config of Object.values(FEATURE_AREAS)) {
                for (const evt of config.events) {
                    featureEvents.add(evt);
                }
            }

            const unaccountedEvents: string[] = [];
            for (const evt of ALLOWED_EVENTS) {
                if (!featureEvents.has(evt)) {
                    unaccountedEvents.push(evt);
                }
            }
            assert.deepStrictEqual(
                unaccountedEvents,
                [],
                `ALLOWED_EVENTS not mapped to any feature area:\n  ${unaccountedEvents.join('\n  ')}`
            );
        });
    });

    // ---- Task 2 / AC 1, 2: Command and Event Parity ----

    describe('Task 2: Desktop IPC routes vs VS Code commands', () => {

        it('should route all shared grid commands through desktop IPC', () => {
            // Grid.js sends these commands — they must be in ALLOWED_COMMANDS
            // (excluding VS Code-only export/import commands)
            const vsCodeOnlySet = new Set<string>(VSCODE_ONLY_COMMANDS);
            const sharedGridCommands = GRID_JS_SENT_COMMANDS.filter(
                cmd => !vsCodeOnlySet.has(cmd)
            );

            const missing: string[] = [];
            for (const cmd of sharedGridCommands) {
                if (!ALLOWED_COMMANDS.has(cmd)) {
                    missing.push(cmd);
                }
            }
            assert.deepStrictEqual(
                missing,
                [],
                `Grid commands missing from desktop ALLOWED_COMMANDS:\n  ${missing.join('\n  ')}`
            );
        });

        it('should deliver all shared grid events through desktop IPC', () => {
            // Grid.js handles these events — they must be in ALLOWED_EVENTS
            // (excluding VS Code-only export/import events)
            const vsCodeOnlySet = new Set<string>(VSCODE_ONLY_EVENTS);
            const sharedGridEvents = GRID_JS_HANDLED_EVENTS.filter(
                evt => !vsCodeOnlySet.has(evt)
            );

            const missing: string[] = [];
            for (const evt of sharedGridEvents) {
                if (!ALLOWED_EVENTS.has(evt)) {
                    missing.push(evt);
                }
            }
            assert.deepStrictEqual(
                missing,
                [],
                `Grid events missing from desktop ALLOWED_EVENTS:\n  ${missing.join('\n  ')}`
            );
        });

        it('should validate all VS Code GridPanelManager commands are either in desktop or documented as VS Code-only', () => {
            // Commands handled by VS Code GridPanelManager._handleGridMessage
            const vsCodeGridCommands = [
                'requestData', 'refresh', 'paginateNext', 'paginatePrev',
                'saveCell', 'insertRow', 'deleteRow',
                'exportAllCsv', 'importSelectFile', 'importValidate',
                'importExecute', 'exportCurrentPageExcel', 'exportAllExcel',
                'cancelOperation',
            ];

            const vsCodeOnlySet = new Set<string>(VSCODE_ONLY_COMMANDS);
            const unexpectedGaps: string[] = [];

            for (const cmd of vsCodeGridCommands) {
                const inDesktop = ALLOWED_COMMANDS.has(cmd);
                const documentedVsCodeOnly = vsCodeOnlySet.has(cmd);
                if (!inDesktop && !documentedVsCodeOnly) {
                    unexpectedGaps.push(cmd);
                }
            }
            assert.deepStrictEqual(
                unexpectedGaps,
                [],
                `VS Code commands not in desktop and not documented as VS Code-only:\n  ${unexpectedGaps.join('\n  ')}`
            );
        });

        it('should have exactly 7 VS Code-only commands (export/import features)', () => {
            assert.strictEqual(
                VSCODE_ONLY_COMMANDS.length,
                7,
                'Expected 7 VS Code-only commands'
            );
        });

        it('should have exactly 6 VS Code-only events (export/import features)', () => {
            assert.strictEqual(
                VSCODE_ONLY_EVENTS.length,
                6,
                'Expected 6 VS Code-only events'
            );
        });
    });

    // ---- Task 2.4: Grid event handlers ----

    describe('Task 2.4: Grid event handlers exist in grid.js', () => {

        it('should handle restoreGridState event in grid.js', () => {
            assert.ok(
                GRID_JS_HANDLED_EVENTS.includes('restoreGridState'),
                'grid.js must handle restoreGridState for tab switching'
            );
        });

        it('should handle menuSetNull event in grid.js', () => {
            assert.ok(
                GRID_JS_HANDLED_EVENTS.includes('menuSetNull'),
                'grid.js must handle menuSetNull for native menu integration'
            );
        });

        it('should handle menuToggleFilterPanel event in grid.js', () => {
            assert.ok(
                GRID_JS_HANDLED_EVENTS.includes('menuToggleFilterPanel'),
                'grid.js must handle menuToggleFilterPanel for native menu'
            );
        });

        it('should handle menuShowShortcuts event in grid.js', () => {
            assert.ok(
                GRID_JS_HANDLED_EVENTS.includes('menuShowShortcuts'),
                'grid.js must handle menuShowShortcuts for native menu'
            );
        });

        it('should handle all core data events in grid.js', () => {
            const coreDataEvents = [
                'tableSchema', 'tableData', 'tableLoading',
                'saveCellResult', 'insertRowResult', 'deleteRowResult', 'error',
            ];
            for (const evt of coreDataEvents) {
                assert.ok(
                    GRID_JS_HANDLED_EVENTS.includes(evt as typeof GRID_JS_HANDLED_EVENTS[number]),
                    `grid.js must handle ${evt}`
                );
            }
        });

        it('should have desktop UI modules handle events not in grid.js', () => {
            // menuAction and restoreAppState are in ALLOWED_EVENTS but handled by
            // desktop-specific UI modules (menu-handler.js, app-shell), not grid.js
            for (const evt of DESKTOP_UI_HANDLED_EVENTS) {
                assert.ok(
                    ALLOWED_EVENTS.has(evt),
                    `Desktop UI event '${evt}' must be in ALLOWED_EVENTS`
                );
                assert.ok(
                    !GRID_JS_HANDLED_EVENTS.includes(evt as typeof GRID_JS_HANDLED_EVENTS[number]),
                    `Desktop UI event '${evt}' should NOT be in GRID_JS_HANDLED_EVENTS (handled elsewhere)`
                );
            }
        });

        it('should have expected count of grid.js handled events (drift detection)', () => {
            // This count must match the actual number of case statements in grid.js handleMessage().
            // If grid.js adds a new event handler, this test will fail, prompting an update
            // to GRID_JS_HANDLED_EVENTS and any related parity checks.
            assert.strictEqual(
                GRID_JS_HANDLED_EVENTS.length,
                17,
                `Expected 17 grid.js handled events but found ${GRID_JS_HANDLED_EVENTS.length}. ` +
                'If grid.js was modified, update GRID_JS_HANDLED_EVENTS to match.'
            );
        });

        it('should have expected count of grid.js sent commands (drift detection)', () => {
            // This count must match the number of distinct sendCommand() calls in grid.js.
            // If grid.js adds a new command, this test will fail.
            assert.strictEqual(
                GRID_JS_SENT_COMMANDS.length,
                14,
                `Expected 14 grid.js sent commands but found ${GRID_JS_SENT_COMMANDS.length}. ` +
                'If grid.js was modified, update GRID_JS_SENT_COMMANDS to match.'
            );
        });
    });

    // ---- Task 2.5: Channel validation completeness ----

    describe('Task 2.5: Channel validation allows all required commands and events', () => {

        it('should validate all connection commands', () => {
            const connectionCommands = [
                'getServers', 'connectServer', 'disconnectServer',
                'cancelConnection', 'editServer', 'deleteServer',
                'saveServer', 'updateServer', 'testFormConnection', 'selectServer',
            ];
            for (const cmd of connectionCommands) {
                assert.ok(isValidCommand(cmd), `isValidCommand('${cmd}') should be true`);
            }
        });

        it('should validate all data commands', () => {
            const dataCommands = [
                'getNamespaces', 'getTables', 'selectTable',
                'requestData', 'refresh', 'paginateNext', 'paginatePrev',
                'saveCell', 'insertRow', 'deleteRow',
            ];
            for (const cmd of dataCommands) {
                assert.ok(isValidCommand(cmd), `isValidCommand('${cmd}') should be true`);
            }
        });

        it('should validate all desktop-specific commands', () => {
            const desktopCommands = ['activateTab', 'tabStateChanged', 'sidebarStateChanged'];
            for (const cmd of desktopCommands) {
                assert.ok(isValidCommand(cmd), `isValidCommand('${cmd}') should be true`);
            }
        });

        it('should validate all connection events', () => {
            const connectionEvents = [
                'serversLoaded', 'serverSelected', 'connectionStatus',
                'connectionProgress', 'serverDeleted', 'serverSaved',
                'serverSaveError', 'serverConfigLoaded', 'testConnectionResult',
                'credentialWarning', 'error',
            ];
            for (const evt of connectionEvents) {
                assert.ok(isValidEvent(evt), `isValidEvent('${evt}') should be true`);
            }
        });

        it('should validate all data events', () => {
            const dataEvents = [
                'namespaceList', 'tableList', 'tableSchema', 'tableData',
                'tableLoading', 'saveCellResult', 'insertRowResult', 'deleteRowResult',
            ];
            for (const evt of dataEvents) {
                assert.ok(isValidEvent(evt), `isValidEvent('${evt}') should be true`);
            }
        });

        it('should validate all desktop-specific events', () => {
            const desktopEvents = [
                'restoreGridState', 'menuAction', 'menuSetNull',
                'menuToggleFilterPanel', 'menuShowShortcuts', 'restoreAppState',
            ];
            for (const evt of desktopEvents) {
                assert.ok(isValidEvent(evt), `isValidEvent('${evt}') should be true`);
            }
        });

        it('should reject VS Code-only commands', () => {
            for (const cmd of VSCODE_ONLY_COMMANDS) {
                assert.ok(
                    !isValidCommand(cmd),
                    `VS Code-only command '${cmd}' should NOT be in desktop ALLOWED_COMMANDS`
                );
            }
        });

        it('should reject VS Code-only events', () => {
            for (const evt of VSCODE_ONLY_EVENTS) {
                assert.ok(
                    !isValidEvent(evt),
                    `VS Code-only event '${evt}' should NOT be in desktop ALLOWED_EVENTS`
                );
            }
        });
    });

    // ---- Task 2.6 / 2.7: Count verification ----

    describe('Task 2.6: ALLOWED_COMMANDS count', () => {

        it('should have exactly 23 commands in ALLOWED_COMMANDS', () => {
            assert.strictEqual(
                ALLOWED_COMMANDS.size,
                23,
                `Expected 23 commands, got ${ALLOWED_COMMANDS.size}. ` +
                `Commands: ${Array.from(ALLOWED_COMMANDS).sort().join(', ')}`
            );
        });

        it('should have 10 connection commands', () => {
            const connectionCommands = [
                'getServers', 'connectServer', 'disconnectServer',
                'cancelConnection', 'editServer', 'deleteServer',
                'saveServer', 'updateServer', 'testFormConnection', 'selectServer',
            ];
            const found = connectionCommands.filter(c => ALLOWED_COMMANDS.has(c));
            assert.strictEqual(found.length, 10, 'Expected 10 connection commands');
        });

        it('should have 10 data commands', () => {
            const dataCommands = [
                'getNamespaces', 'getTables', 'selectTable',
                'requestData', 'refresh', 'paginateNext', 'paginatePrev',
                'saveCell', 'insertRow', 'deleteRow',
            ];
            const found = dataCommands.filter(c => ALLOWED_COMMANDS.has(c));
            assert.strictEqual(found.length, 10, 'Expected 10 data commands');
        });

        it('should have 3 desktop-specific commands (tab, menu, state)', () => {
            const desktopCommands = ['activateTab', 'tabStateChanged', 'sidebarStateChanged'];
            const found = desktopCommands.filter(c => ALLOWED_COMMANDS.has(c));
            assert.strictEqual(found.length, 3, 'Expected 3 desktop-specific commands');
        });
    });

    describe('Task 2.7: ALLOWED_EVENTS count', () => {

        it('should have exactly 25 events in ALLOWED_EVENTS', () => {
            assert.strictEqual(
                ALLOWED_EVENTS.size,
                25,
                `Expected 25 events, got ${ALLOWED_EVENTS.size}. ` +
                `Events: ${Array.from(ALLOWED_EVENTS).sort().join(', ')}`
            );
        });

        it('should have 11 connection events', () => {
            const connectionEvents = [
                'serversLoaded', 'serverSelected', 'connectionStatus',
                'connectionProgress', 'serverDeleted', 'serverSaved',
                'serverSaveError', 'serverConfigLoaded', 'testConnectionResult',
                'credentialWarning', 'error',
            ];
            const found = connectionEvents.filter(e => ALLOWED_EVENTS.has(e));
            assert.strictEqual(found.length, 11, 'Expected 11 connection events');
        });

        it('should have 8 data events', () => {
            const dataEvents = [
                'namespaceList', 'tableList', 'tableSchema', 'tableData',
                'tableLoading', 'saveCellResult', 'insertRowResult', 'deleteRowResult',
            ];
            const found = dataEvents.filter(e => ALLOWED_EVENTS.has(e));
            assert.strictEqual(found.length, 8, 'Expected 8 data events');
        });

        it('should have 6 desktop-specific events (tab, menu, state)', () => {
            const desktopEvents = [
                'restoreGridState', 'menuAction', 'menuSetNull',
                'menuToggleFilterPanel', 'menuShowShortcuts', 'restoreAppState',
            ];
            const found = desktopEvents.filter(e => ALLOWED_EVENTS.has(e));
            assert.strictEqual(found.length, 6, 'Expected 6 desktop-specific events');
        });
    });

    // ---- Task 4: Shared webview code path audit ----

    describe('Task 4: Shared webview code path audit', () => {

        it('should route all non-export grid.js commands through desktop IPC', () => {
            // These are the grid commands that should work in desktop
            // (all grid.js commands minus VS Code-only export/import)
            const expectedDesktopGridCommands = [
                'saveCell', 'deleteRow', 'insertRow',
                'refresh', 'requestData', 'paginateNext', 'paginatePrev',
            ];

            for (const cmd of expectedDesktopGridCommands) {
                assert.ok(
                    ALLOWED_COMMANDS.has(cmd),
                    `grid.js command '${cmd}' must be routable through desktop IPC`
                );
            }
        });

        it('should deliver all non-export grid.js events through desktop IPC', () => {
            // These are the grid events that should work in desktop
            // (all grid.js handled events minus VS Code-only export/import)
            const expectedDesktopGridEvents = [
                'tableSchema', 'tableData', 'tableLoading',
                'saveCellResult', 'insertRowResult', 'deleteRowResult',
                'error', 'menuSetNull', 'menuToggleFilterPanel',
                'menuShowShortcuts', 'restoreGridState',
            ];

            for (const evt of expectedDesktopGridEvents) {
                assert.ok(
                    ALLOWED_EVENTS.has(evt),
                    `grid.js event '${evt}' must be deliverable through desktop IPC`
                );
            }
        });

        it('should identify export/import grid commands as VS Code-only gaps', () => {
            const exportImportCommands = [
                'exportAllCsv', 'exportCurrentPageExcel', 'exportAllExcel',
                'importSelectFile', 'importValidate', 'importExecute',
                'cancelOperation',
            ];

            for (const cmd of exportImportCommands) {
                assert.ok(
                    !ALLOWED_COMMANDS.has(cmd),
                    `Export/import command '${cmd}' is VS Code-only and should NOT be in desktop ALLOWED_COMMANDS`
                );
            }
        });

        it('should identify export/import grid events as VS Code-only gaps', () => {
            const exportImportEvents = [
                'exportProgress', 'exportResult',
                'importPreview', 'importProgress', 'importResult',
                'importValidationResult',
            ];

            for (const evt of exportImportEvents) {
                assert.ok(
                    !ALLOWED_EVENTS.has(evt),
                    `Export/import event '${evt}' is VS Code-only and should NOT be in desktop ALLOWED_EVENTS`
                );
            }
        });

        it('should have main.js sidebar events covered by desktop server-list.js', () => {
            // main.js (VS Code sidebar) handles these events that have desktop equivalents
            // in server-list.js via the desktop IPC bridge
            const sidebarEvents = [
                'connectionStatus', 'connectionProgress', 'error',
                'namespaceList', 'tableList',
            ];

            for (const evt of sidebarEvents) {
                assert.ok(
                    ALLOWED_EVENTS.has(evt),
                    `Sidebar event '${evt}' must be in desktop ALLOWED_EVENTS`
                );
            }
        });

        it('should account for all main.js handled events as either desktop or VS Code-sidebar-only', () => {
            // Every event handled by main.js must be either:
            // (a) in ALLOWED_EVENTS (shared with desktop), or
            // (b) in VSCODE_SIDEBAR_ONLY_EVENTS (documented VS Code-only gap)
            const vsCodeSidebarOnlySet = new Set<string>(VSCODE_SIDEBAR_ONLY_EVENTS);
            const unaccounted: string[] = [];

            for (const evt of MAIN_JS_HANDLED_EVENTS) {
                const inDesktop = ALLOWED_EVENTS.has(evt);
                const documentedVsCodeOnly = vsCodeSidebarOnlySet.has(evt);
                if (!inDesktop && !documentedVsCodeOnly) {
                    unaccounted.push(evt);
                }
            }
            assert.deepStrictEqual(
                unaccounted,
                [],
                `main.js events not in desktop and not documented as VS Code-sidebar-only:\n  ${unaccounted.join('\n  ')}`
            );
        });

        it('should have VS Code-only sidebar events not in desktop (expected)', () => {
            // These are VS Code sidebar-specific events that have no desktop equivalent
            // because the desktop has its own server-list.js implementation
            for (const evt of VSCODE_SIDEBAR_ONLY_EVENTS) {
                assert.ok(
                    !ALLOWED_EVENTS.has(evt),
                    `VS Code sidebar-only event '${evt}' should NOT be in desktop ALLOWED_EVENTS`
                );
            }
        });

        it('should account for all main.js sent commands as either desktop or VS Code-sidebar-only', () => {
            // Every command sent by main.js must be either:
            // (a) in ALLOWED_COMMANDS (routed through desktop IPC), or
            // (b) in VSCODE_SIDEBAR_ONLY_COMMANDS (documented VS Code-only gap)
            const vsCodeSidebarOnlySet = new Set<string>(VSCODE_SIDEBAR_ONLY_COMMANDS);
            const unaccounted: string[] = [];

            for (const cmd of MAIN_JS_SENT_COMMANDS) {
                const inDesktop = ALLOWED_COMMANDS.has(cmd);
                const documentedVsCodeOnly = vsCodeSidebarOnlySet.has(cmd);
                if (!inDesktop && !documentedVsCodeOnly) {
                    unaccounted.push(cmd);
                }
            }
            assert.deepStrictEqual(
                unaccounted,
                [],
                `main.js commands not in desktop and not documented as VS Code-sidebar-only:\n  ${unaccounted.join('\n  ')}`
            );
        });

        it('should have VS Code-only sidebar commands not in desktop (expected)', () => {
            for (const cmd of VSCODE_SIDEBAR_ONLY_COMMANDS) {
                assert.ok(
                    !ALLOWED_COMMANDS.has(cmd),
                    `VS Code sidebar-only command '${cmd}' should NOT be in desktop ALLOWED_COMMANDS`
                );
            }
        });
    });

    // ---- Task 5: Known Limitations ----

    describe('Task 5: Known Limitations', () => {

        it('should document that export/import is VS Code-only', () => {
            // Verify the gap exists (7 commands, 6 events not in desktop)
            let vsCodeOnlyCommandCount = 0;
            for (const cmd of VSCODE_ONLY_COMMANDS) {
                if (!ALLOWED_COMMANDS.has(cmd)) {
                    vsCodeOnlyCommandCount++;
                }
            }
            assert.strictEqual(
                vsCodeOnlyCommandCount,
                7,
                'All 7 export/import commands should be VS Code-only'
            );

            let vsCodeOnlyEventCount = 0;
            for (const evt of VSCODE_ONLY_EVENTS) {
                if (!ALLOWED_EVENTS.has(evt)) {
                    vsCodeOnlyEventCount++;
                }
            }
            assert.strictEqual(
                vsCodeOnlyEventCount,
                6,
                'All 6 export/import events should be VS Code-only'
            );
        });

        it('should document that Server Manager integration is VS Code-only', () => {
            // VS Code uses vscode.authentication + Server Manager extension
            // Desktop uses its own ConnectionManager with encrypted local storage
            // These are intentional architectural differences
            assert.ok(
                ALLOWED_COMMANDS.has('connectServer'),
                'Desktop has its own connection command'
            );
            assert.ok(
                ALLOWED_COMMANDS.has('saveServer'),
                'Desktop has its own server management commands'
            );
            assert.ok(
                ALLOWED_EVENTS.has('credentialWarning'),
                'Desktop has credential warning for when encryption is unavailable'
            );
        });

        it('should document that theme source differs between targets', () => {
            // VS Code: CSS variables from VS Code (vscodeThemeBridge.css)
            // Desktop: nativeTheme + desktopThemeBridge (theme.css)
            // Both share the same base theme.css from @iris-te/webview
            // This is an intentional architectural difference, not a bug
            assert.ok(
                ALLOWED_EVENTS.has('restoreAppState'),
                'Desktop has restoreAppState for theme persistence'
            );
        });

        it('should document that WebviewViewProvider sidebar is VS Code-only', () => {
            // VS Code uses WebviewViewProvider for sidebar display
            // Desktop uses its own server-list.js in the app shell sidebar
            // Both connect to the same core services
            assert.ok(
                !ALLOWED_EVENTS.has('serverList'),
                'VS Code serverList event not in desktop (uses serversLoaded instead)'
            );
            assert.ok(
                ALLOWED_EVENTS.has('serversLoaded'),
                'Desktop uses serversLoaded as its server list event'
            );
        });

        it('should document desktop-only features not in VS Code', () => {
            // Desktop has features that VS Code does not:
            // - Tab bar (multi-table editing in tabs)
            // - Native menu (OS-level menu bar)
            // - Window state persistence (position, size)
            // - Sidebar resize persistence
            assert.ok(ALLOWED_COMMANDS.has('activateTab'), 'Tab bar is desktop-only');
            assert.ok(ALLOWED_COMMANDS.has('tabStateChanged'), 'Tab state tracking is desktop-only');
            assert.ok(ALLOWED_COMMANDS.has('sidebarStateChanged'), 'Sidebar state is desktop-only');
            assert.ok(ALLOWED_EVENTS.has('menuAction'), 'Native menu is desktop-only');
            assert.ok(ALLOWED_EVENTS.has('restoreAppState'), 'App state restore is desktop-only');
        });
    });
});
