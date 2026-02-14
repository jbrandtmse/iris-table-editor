/**
 * Unit tests for channel validation in the preload bridge
 * Story 11.2: IPC Bridge
 *
 * Tests the ALLOWED_COMMANDS and ALLOWED_EVENTS sets and the
 * isValidCommand/isValidEvent validation functions.
 * We test the validation functions directly, not contextBridge.
 *
 * Uses Node.js built-in test runner and assert module.
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
// Command Validation Tests (Task 7.5)
// ============================================

describe('Channel Validation', () => {
    describe('ALLOWED_COMMANDS', () => {
        it('should include all connection commands', () => {
            const connectionCommands = [
                'getServers',
                'connectServer',
                'disconnectServer',
                'cancelConnection',
                'editServer',
                'deleteServer',
                'saveServer',
                'updateServer',
                'testFormConnection',
                'selectServer',
            ];

            for (const cmd of connectionCommands) {
                assert.ok(ALLOWED_COMMANDS.has(cmd), `Missing connection command: ${cmd}`);
            }
        });

        it('should include all data commands', () => {
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
                assert.ok(ALLOWED_COMMANDS.has(cmd), `Missing data command: ${cmd}`);
            }
        });

        it('should include all tab commands (Story 11.3)', () => {
            const tabCommands = [
                'activateTab',
            ];

            for (const cmd of tabCommands) {
                assert.ok(ALLOWED_COMMANDS.has(cmd), `Missing tab command: ${cmd}`);
            }
        });

        it('should include all menu commands (Story 11.4)', () => {
            const menuCommands = [
                'tabStateChanged',
            ];

            for (const cmd of menuCommands) {
                assert.ok(ALLOWED_COMMANDS.has(cmd), `Missing menu command: ${cmd}`);
            }
        });

        it('should include all state persistence commands (Story 11.5)', () => {
            const statePersistenceCommands = [
                'sidebarStateChanged',
            ];

            for (const cmd of statePersistenceCommands) {
                assert.ok(ALLOWED_COMMANDS.has(cmd), `Missing state persistence command: ${cmd}`);
            }
        });

        it('should have exactly 23 commands', () => {
            assert.strictEqual(ALLOWED_COMMANDS.size, 23);
        });
    });

    describe('ALLOWED_EVENTS', () => {
        it('should include all connection events', () => {
            const connectionEvents = [
                'serversLoaded',
                'serverSelected',
                'connectionStatus',
                'connectionProgress',
                'serverDeleted',
                'serverSaved',
                'serverSaveError',
                'serverConfigLoaded',
                'testConnectionResult',
                'credentialWarning',
                'error',
            ];

            for (const evt of connectionEvents) {
                assert.ok(ALLOWED_EVENTS.has(evt), `Missing connection event: ${evt}`);
            }
        });

        it('should include all data events', () => {
            const dataEvents = [
                'namespaceList',
                'tableList',
                'tableSchema',
                'tableData',
                'tableLoading',
                'saveCellResult',
                'insertRowResult',
                'deleteRowResult',
            ];

            for (const evt of dataEvents) {
                assert.ok(ALLOWED_EVENTS.has(evt), `Missing data event: ${evt}`);
            }
        });

        it('should include all tab events (Story 11.3)', () => {
            const tabEvents = [
                'restoreGridState',
            ];

            for (const evt of tabEvents) {
                assert.ok(ALLOWED_EVENTS.has(evt), `Missing tab event: ${evt}`);
            }
        });

        it('should include all menu events (Story 11.4)', () => {
            const menuEvents = [
                'menuAction',
                'menuSetNull',
                'menuToggleFilterPanel',
                'menuShowShortcuts',
            ];

            for (const evt of menuEvents) {
                assert.ok(ALLOWED_EVENTS.has(evt), `Missing menu event: ${evt}`);
            }
        });

        it('should include all state persistence events (Story 11.5)', () => {
            const statePersistenceEvents = [
                'restoreAppState',
            ];

            for (const evt of statePersistenceEvents) {
                assert.ok(ALLOWED_EVENTS.has(evt), `Missing state persistence event: ${evt}`);
            }
        });

        it('should have exactly 25 events', () => {
            assert.strictEqual(ALLOWED_EVENTS.size, 25);
        });
    });

    describe('isValidCommand', () => {
        it('should return true for valid commands', () => {
            assert.strictEqual(isValidCommand('getServers'), true);
            assert.strictEqual(isValidCommand('connectServer'), true);
            assert.strictEqual(isValidCommand('getNamespaces'), true);
            assert.strictEqual(isValidCommand('requestData'), true);
            assert.strictEqual(isValidCommand('saveCell'), true);
            assert.strictEqual(isValidCommand('deleteRow'), true);
            assert.strictEqual(isValidCommand('activateTab'), true);
            assert.strictEqual(isValidCommand('tabStateChanged'), true);
            assert.strictEqual(isValidCommand('sidebarStateChanged'), true);
        });

        it('should return false for invalid commands', () => {
            assert.strictEqual(isValidCommand('invalidCommand'), false);
            assert.strictEqual(isValidCommand(''), false);
            assert.strictEqual(isValidCommand('getservers'), false); // case-sensitive
            assert.strictEqual(isValidCommand('GETSERVERS'), false);
            assert.strictEqual(isValidCommand('executeSQL'), false);
            assert.strictEqual(isValidCommand('shell'), false);
        });

        it('should be case-sensitive', () => {
            assert.strictEqual(isValidCommand('getServers'), true);
            assert.strictEqual(isValidCommand('GetServers'), false);
            assert.strictEqual(isValidCommand('GETSERVERS'), false);
        });
    });

    describe('isValidEvent', () => {
        it('should return true for valid events', () => {
            assert.strictEqual(isValidEvent('serversLoaded'), true);
            assert.strictEqual(isValidEvent('connectionProgress'), true);
            assert.strictEqual(isValidEvent('namespaceList'), true);
            assert.strictEqual(isValidEvent('tableData'), true);
            assert.strictEqual(isValidEvent('error'), true);
            assert.strictEqual(isValidEvent('saveCellResult'), true);
            assert.strictEqual(isValidEvent('restoreGridState'), true);
            assert.strictEqual(isValidEvent('menuAction'), true);
            assert.strictEqual(isValidEvent('menuSetNull'), true);
            assert.strictEqual(isValidEvent('menuToggleFilterPanel'), true);
            assert.strictEqual(isValidEvent('menuShowShortcuts'), true);
            assert.strictEqual(isValidEvent('restoreAppState'), true);
        });

        it('should return false for invalid events', () => {
            assert.strictEqual(isValidEvent('invalidEvent'), false);
            assert.strictEqual(isValidEvent(''), false);
            assert.strictEqual(isValidEvent('serversloaded'), false); // case-sensitive
            assert.strictEqual(isValidEvent('TABLEDATA'), false);
            assert.strictEqual(isValidEvent('systemInfo'), false);
        });

        it('should be case-sensitive', () => {
            assert.strictEqual(isValidEvent('tableData'), true);
            assert.strictEqual(isValidEvent('TableData'), false);
            assert.strictEqual(isValidEvent('TABLEDATA'), false);
        });
    });
});
