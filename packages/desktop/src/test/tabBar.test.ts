/**
 * Unit tests for Story 11.3: Tab Bar
 *
 * Tests:
 * - TabBarManager: openTab, closeTab, switchTab, getTabByTable, duplicate prevention
 * - Tab state save/restore
 * - Dirty check on close
 * - Keyboard shortcut handling (next tab, prev tab, close)
 * - activateTab IPC command routing
 * - Channel validation updates (new commands/events)
 * - emitLocalEvent callback registry logic
 *
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import { SessionManager } from '../main/SessionManager';
import { routeCommand, sendEvent, requireSession } from '../main/ipc';
import { isValidCommand, isValidEvent, ALLOWED_COMMANDS, ALLOWED_EVENTS } from '../main/channelValidation';
import type { IServerSpec, ITableSchema } from '@iris-te/core';
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
// Test helpers
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
        ],
    };
}

const stubConnMgr = {} as unknown as ConnectionManager;
const stubLifecycleMgr = {} as unknown as ConnectionLifecycleManager;

// ============================================
// TabBarManager simulation (testing the JS logic via pure state)
// Since tab-bar.js is browser-side, we test the logic patterns here
// ============================================

/**
 * Minimal tab model matching tab-bar.js Tab type
 */
interface Tab {
    id: string;
    namespace: string;
    tableName: string;
    label: string;
    cachedSchema: unknown;
    cachedData: unknown;
    gridState: Record<string, unknown> | null;
    isDirty: boolean;
    isLoading: boolean;
}

/**
 * Pure-logic TabBarManager for testability (no DOM dependencies)
 */
class TestTabBarManager {
    tabs: Tab[] = [];
    activeTabId: string | null = null;
    private _pendingTabId: string | null = null;
    private _tabIdCounter = 0;

    // Simulated messageBridge state
    bridgeState: Record<string, unknown> = {};
    sentCommands: Array<{ command: string; payload: unknown }> = [];
    emittedEvents: Array<{ eventName: string; payload: unknown }> = [];

    // Track confirm calls
    confirmResult = true;
    confirmCalled = false;

    _generateId(): string {
        this._tabIdCounter++;
        return 'tab-' + this._tabIdCounter;
    }

    getTabByTable(namespace: string, tableName: string): Tab | null {
        return this.tabs.find(t => t.namespace === namespace && t.tableName === tableName) || null;
    }

    getTabById(tabId: string): Tab | null {
        return this.tabs.find(t => t.id === tabId) || null;
    }

    getActiveTab(): Tab | null {
        if (!this.activeTabId) {return null;}
        return this.getTabById(this.activeTabId);
    }

    openTab(namespace: string, tableName: string): void {
        const existing = this.getTabByTable(namespace, tableName);
        if (existing) {
            this.switchTab(existing.id);
            return;
        }

        const tab: Tab = {
            id: this._generateId(),
            namespace,
            tableName,
            label: tableName,
            cachedSchema: null,
            cachedData: null,
            gridState: null,
            isDirty: false,
            isLoading: true,
        };

        this._saveCurrentTabState();
        this.tabs.push(tab);
        this._pendingTabId = tab.id;
        this.activeTabId = tab.id;

        this.sentCommands.push({
            command: 'selectTable',
            payload: { namespace, tableName },
        });
    }

    switchTab(tabId: string): void {
        if (tabId === this.activeTabId) {return;}
        const targetTab = this.getTabById(tabId);
        if (!targetTab) {return;}

        this._saveCurrentTabState();
        this.activeTabId = tabId;
        this._restoreTabState(targetTab);
    }

    closeTab(tabId: string): boolean {
        const tab = this.getTabById(tabId);
        if (!tab) {return false;}

        if (tab.isDirty) {
            this.confirmCalled = true;
            if (!this.confirmResult) {return false;}
        }

        const tabIndex = this.tabs.indexOf(tab);
        this.tabs.splice(tabIndex, 1);

        if (this.activeTabId === tabId) {
            if (this.tabs.length === 0) {
                this.activeTabId = null;
                this.bridgeState = {};
            } else {
                const nextIndex = Math.min(tabIndex, this.tabs.length - 1);
                const nextTab = this.tabs[nextIndex];
                this.activeTabId = nextTab.id;
                this._restoreTabState(nextTab);
            }
        }

        return true;
    }

    nextTab(): void {
        if (this.tabs.length <= 1) {return;}
        const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
        const nextIndex = (currentIndex + 1) % this.tabs.length;
        this.switchTab(this.tabs[nextIndex].id);
    }

    prevTab(): void {
        if (this.tabs.length <= 1) {return;}
        const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
        const prevIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
        this.switchTab(this.tabs[prevIndex].id);
    }

    _saveCurrentTabState(): void {
        const currentTab = this.getActiveTab();
        if (!currentTab) {return;}
        const state = Object.assign({}, this.bridgeState);
        currentTab.gridState = state;
        currentTab.cachedSchema = state.columns || null;
        currentTab.cachedData = {
            rows: state.rows || [],
            totalRows: state.totalRows || 0,
        };
        this._updateDirtyFromState(currentTab, state);
    }

    _restoreTabState(tab: Tab): void {
        if (tab.gridState) {
            this.bridgeState = Object.assign({}, tab.gridState);
        } else {
            this.bridgeState = {};
        }
        this.emittedEvents.push({ eventName: 'restoreGridState', payload: {} });
        this.sentCommands.push({
            command: 'activateTab',
            payload: {
                namespace: tab.namespace,
                tableName: tab.tableName,
                schema: tab.cachedSchema,
            },
        });
    }

    _updateDirtyFromState(tab: Tab, gridState: Record<string, unknown>): void {
        const ps = gridState.pendingSaves;
        const hasPendingSaves = ps &&
            ((ps instanceof Map && ps.size > 0) ||
             (typeof ps === 'object' && !(ps instanceof Map) && Object.keys(ps as object).length > 0));
        const nr = gridState.newRows as unknown[];
        const hasNewRows = nr && nr.length > 0;
        tab.isDirty = !!(hasPendingSaves || hasNewRows);
    }

    handleTableSchema(payload: { tableName: string; namespace: string; columns: unknown }): void {
        const targetTab = this._pendingTabId
            ? this.getTabById(this._pendingTabId)
            : this.getActiveTab();

        if (targetTab) {
            targetTab.cachedSchema = payload.columns;
            targetTab.label = payload.tableName;
            targetTab.isLoading = false;
            this._pendingTabId = null;
        }
    }

    handleTableData(payload: { rows: unknown[]; totalRows: number }): void {
        const activeTab = this.getActiveTab();
        if (activeTab) {
            activeTab.cachedData = {
                rows: payload.rows || [],
                totalRows: payload.totalRows || 0,
            };
            activeTab.isLoading = false;
        }
    }
}

// ============================================
// Tests
// ============================================

describe('Story 11.3: Tab Bar', () => {

    // ============================================
    // TabBarManager: openTab
    // ============================================

    describe('TabBarManager.openTab', () => {
        it('should create a new tab and set it as active', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');

            assert.strictEqual(mgr.tabs.length, 1);
            assert.strictEqual(mgr.activeTabId, mgr.tabs[0].id);
            assert.strictEqual(mgr.tabs[0].namespace, 'USER');
            assert.strictEqual(mgr.tabs[0].tableName, 'SQLUser.Person');
            assert.strictEqual(mgr.tabs[0].isLoading, true);
        });

        it('should send selectTable command when opening tab', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');

            const selectCmd = mgr.sentCommands.find(c => c.command === 'selectTable');
            assert.ok(selectCmd, 'Expected selectTable command');
            const p = selectCmd!.payload as { namespace: string; tableName: string };
            assert.strictEqual(p.namespace, 'USER');
            assert.strictEqual(p.tableName, 'SQLUser.Person');
        });

        it('should open multiple tabs', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('USER', 'SQLUser.Employee');

            assert.strictEqual(mgr.tabs.length, 2);
            // Second tab should be active
            assert.strictEqual(mgr.activeTabId, mgr.tabs[1].id);
        });

        it('should set label to tableName initially', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');

            assert.strictEqual(mgr.tabs[0].label, 'SQLUser.Person');
        });
    });

    // ============================================
    // TabBarManager: duplicate prevention
    // ============================================

    describe('TabBarManager duplicate prevention', () => {
        it('should not create a duplicate tab for same namespace+tableName', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('USER', 'SQLUser.Person');

            assert.strictEqual(mgr.tabs.length, 1);
        });

        it('should switch to existing tab instead of duplicating', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('USER', 'SQLUser.Employee');
            assert.strictEqual(mgr.activeTabId, mgr.tabs[1].id);

            // Opening Person again should switch back
            mgr.openTab('USER', 'SQLUser.Person');
            assert.strictEqual(mgr.tabs.length, 2);
            assert.strictEqual(mgr.activeTabId, mgr.tabs[0].id);
        });

        it('should allow same table name in different namespaces', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('SAMPLES', 'SQLUser.Person');

            assert.strictEqual(mgr.tabs.length, 2);
        });

        it('getTabByTable should return null when no match', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');

            const result = mgr.getTabByTable('USER', 'SQLUser.NonExistent');
            assert.strictEqual(result, null);
        });

        it('getTabByTable should return the matching tab', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');

            const result = mgr.getTabByTable('USER', 'SQLUser.Person');
            assert.ok(result);
            assert.strictEqual(result!.tableName, 'SQLUser.Person');
        });
    });

    // ============================================
    // TabBarManager: switchTab with state save/restore
    // ============================================

    describe('TabBarManager.switchTab', () => {
        it('should switch active tab', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('USER', 'SQLUser.Employee');

            const tab1Id = mgr.tabs[0].id;
            mgr.switchTab(tab1Id);

            assert.strictEqual(mgr.activeTabId, tab1Id);
        });

        it('should save current tab state before switching', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            // Simulate grid state
            mgr.bridgeState = { columns: ['ID', 'Name'], rows: [{ ID: 1 }], totalRows: 1, currentPage: 2 };

            mgr.openTab('USER', 'SQLUser.Employee');

            // Tab 1 should have saved state
            assert.ok(mgr.tabs[0].gridState);
            assert.strictEqual((mgr.tabs[0].gridState as Record<string, unknown>).currentPage, 2);
        });

        it('should restore target tab state', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.bridgeState = { columns: ['ID'], rows: [{ ID: 1 }], totalRows: 1 };

            mgr.openTab('USER', 'SQLUser.Employee');
            mgr.bridgeState = { columns: ['EmpID'], rows: [{ EmpID: 10 }], totalRows: 5 };

            // Switch back to Person
            mgr.switchTab(mgr.tabs[0].id);

            // Bridge state should be restored from Person's saved state
            assert.ok(mgr.bridgeState);
            assert.deepStrictEqual((mgr.bridgeState as Record<string, unknown>).columns, ['ID']);
        });

        it('should emit restoreGridState event on switch', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('USER', 'SQLUser.Employee');

            mgr.emittedEvents = [];
            mgr.switchTab(mgr.tabs[0].id);

            const restoreEvent = mgr.emittedEvents.find(e => e.eventName === 'restoreGridState');
            assert.ok(restoreEvent, 'Expected restoreGridState event');
        });

        it('should send activateTab command on switch', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('USER', 'SQLUser.Employee');

            mgr.sentCommands = [];
            mgr.switchTab(mgr.tabs[0].id);

            const activateCmd = mgr.sentCommands.find(c => c.command === 'activateTab');
            assert.ok(activateCmd, 'Expected activateTab command');
            const p = activateCmd!.payload as { namespace: string; tableName: string };
            assert.strictEqual(p.namespace, 'USER');
            assert.strictEqual(p.tableName, 'SQLUser.Person');
        });

        it('should not switch if already on the tab', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');

            mgr.sentCommands = [];
            mgr.switchTab(mgr.tabs[0].id);

            // No activateTab command should be sent
            const activateCmd = mgr.sentCommands.find(c => c.command === 'activateTab');
            assert.strictEqual(activateCmd, undefined);
        });
    });

    // ============================================
    // TabBarManager: closeTab
    // ============================================

    describe('TabBarManager.closeTab', () => {
        it('should close tab and remove from list', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            const tabId = mgr.tabs[0].id;

            const result = mgr.closeTab(tabId);

            assert.strictEqual(result, true);
            assert.strictEqual(mgr.tabs.length, 0);
            assert.strictEqual(mgr.activeTabId, null);
        });

        it('should activate adjacent tab (prefer right) after close', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('USER', 'SQLUser.Employee');
            mgr.openTab('USER', 'SQLUser.Department');

            // Close Employee (middle) — should activate Department (right)
            const tab2Id = mgr.tabs[1].id;
            mgr.switchTab(tab2Id);
            mgr.closeTab(tab2Id);

            assert.strictEqual(mgr.tabs.length, 2);
            assert.strictEqual(mgr.activeTabId, mgr.tabs[1].id); // Department
        });

        it('should activate left tab when closing rightmost', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('USER', 'SQLUser.Employee');

            const tab2Id = mgr.tabs[1].id;
            // Already on tab2
            mgr.closeTab(tab2Id);

            assert.strictEqual(mgr.tabs.length, 1);
            assert.strictEqual(mgr.activeTabId, mgr.tabs[0].id); // Person
        });

        it('should return false for non-existent tab', () => {
            const mgr = new TestTabBarManager();
            const result = mgr.closeTab('nonexistent');
            assert.strictEqual(result, false);
        });

        it('should not activate a different tab if closing non-active tab', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('USER', 'SQLUser.Employee');

            const tab1Id = mgr.tabs[0].id;
            const tab2Id = mgr.tabs[1].id;
            // Active is tab2, close tab1
            mgr.closeTab(tab1Id);

            assert.strictEqual(mgr.tabs.length, 1);
            assert.strictEqual(mgr.activeTabId, tab2Id);
        });
    });

    // ============================================
    // TabBarManager: dirty check on close
    // ============================================

    describe('TabBarManager dirty check', () => {
        it('should close dirty tab when confirm returns true', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.tabs[0].isDirty = true;
            mgr.confirmResult = true;

            const result = mgr.closeTab(mgr.tabs[0].id);

            assert.strictEqual(result, true);
            assert.strictEqual(mgr.confirmCalled, true);
            assert.strictEqual(mgr.tabs.length, 0);
        });

        it('should keep dirty tab open when confirm returns false', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.tabs[0].isDirty = true;
            mgr.confirmResult = false;

            const result = mgr.closeTab(mgr.tabs[0].id);

            assert.strictEqual(result, false);
            assert.strictEqual(mgr.confirmCalled, true);
            assert.strictEqual(mgr.tabs.length, 1);
        });

        it('should not prompt when tab is not dirty', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.tabs[0].isDirty = false;

            mgr.closeTab(mgr.tabs[0].id);

            assert.strictEqual(mgr.confirmCalled, false);
        });

        it('should track dirty state from pendingSaves', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');

            // Simulate pending saves
            mgr.bridgeState = {
                pendingSaves: { 'key1': { value: 'test' } },
                newRows: [],
            };
            mgr._saveCurrentTabState();

            assert.strictEqual(mgr.tabs[0].isDirty, true);
        });

        it('should track dirty state from newRows', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');

            mgr.bridgeState = {
                pendingSaves: {},
                newRows: [{ ID: null, Name: 'new' }],
            };
            mgr._saveCurrentTabState();

            assert.strictEqual(mgr.tabs[0].isDirty, true);
        });

        it('should not be dirty with empty pendingSaves and newRows', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');

            mgr.bridgeState = {
                pendingSaves: {},
                newRows: [],
            };
            mgr._saveCurrentTabState();

            assert.strictEqual(mgr.tabs[0].isDirty, false);
        });
    });

    // ============================================
    // TabBarManager: keyboard navigation (next/prev)
    // ============================================

    describe('TabBarManager keyboard navigation', () => {
        it('nextTab should wrap around to first tab', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('USER', 'SQLUser.Employee');
            mgr.openTab('USER', 'SQLUser.Dept');

            // Active is tab3 (last opened)
            assert.strictEqual(mgr.activeTabId, mgr.tabs[2].id);

            mgr.nextTab();
            // Should wrap to tab1
            assert.strictEqual(mgr.activeTabId, mgr.tabs[0].id);
        });

        it('prevTab should wrap around to last tab', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            mgr.openTab('USER', 'SQLUser.Employee');

            // Switch to first tab
            mgr.switchTab(mgr.tabs[0].id);

            mgr.prevTab();
            // Should wrap to last tab
            assert.strictEqual(mgr.activeTabId, mgr.tabs[1].id);
        });

        it('nextTab should do nothing with 0 tabs', () => {
            const mgr = new TestTabBarManager();
            mgr.nextTab();
            assert.strictEqual(mgr.activeTabId, null);
        });

        it('nextTab should do nothing with 1 tab', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            const id = mgr.activeTabId;

            mgr.nextTab();
            assert.strictEqual(mgr.activeTabId, id);
        });

        it('prevTab should do nothing with 1 tab', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');
            const id = mgr.activeTabId;

            mgr.prevTab();
            assert.strictEqual(mgr.activeTabId, id);
        });

        it('nextTab should cycle through all tabs', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.A');
            mgr.openTab('USER', 'SQLUser.B');
            mgr.openTab('USER', 'SQLUser.C');

            // Currently on C (tab3)
            mgr.nextTab(); // -> A
            assert.strictEqual(mgr.activeTabId, mgr.tabs[0].id);
            mgr.nextTab(); // -> B
            assert.strictEqual(mgr.activeTabId, mgr.tabs[1].id);
            mgr.nextTab(); // -> C
            assert.strictEqual(mgr.activeTabId, mgr.tabs[2].id);
        });
    });

    // ============================================
    // TabBarManager: handleTableSchema/handleTableData
    // ============================================

    describe('TabBarManager event handlers', () => {
        it('handleTableSchema should update pending tab', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');

            mgr.handleTableSchema({
                tableName: 'SQLUser.Person',
                namespace: 'USER',
                columns: [{ name: 'ID', dataType: 'INTEGER' }],
            });

            assert.strictEqual(mgr.tabs[0].isLoading, false);
            assert.deepStrictEqual(mgr.tabs[0].cachedSchema, [{ name: 'ID', dataType: 'INTEGER' }]);
            assert.strictEqual(mgr.tabs[0].label, 'SQLUser.Person');
        });

        it('handleTableData should cache data in active tab', () => {
            const mgr = new TestTabBarManager();
            mgr.openTab('USER', 'SQLUser.Person');

            mgr.handleTableData({
                rows: [{ ID: 1, Name: 'Alice' }],
                totalRows: 100,
            });

            assert.ok(mgr.tabs[0].cachedData);
            const data = mgr.tabs[0].cachedData as { rows: unknown[]; totalRows: number };
            assert.strictEqual(data.totalRows, 100);
            assert.strictEqual(data.rows.length, 1);
        });
    });

    // ============================================
    // activateTab IPC command routing
    // ============================================

    describe('activateTab IPC command', () => {
        let session: SessionManager;

        beforeEach(() => {
            session = new SessionManager();
        });

        it('should return error without active session', async () => {
            const { win, sentEvents } = createMockWindow();
            await routeCommand('activateTab', {}, win, stubConnMgr, stubLifecycleMgr, session);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event, 'Expected error event');
            const payload = event.payload as { message: string };
            assert.ok(payload.message.includes('Not connected'));
        });

        it('should set namespace and table on SessionManager', async () => {
            session.startSession('test-server', createTestSpec(), '_SYSTEM', 'SYS');
            const { win, sentEvents } = createMockWindow();

            const schema = createTestSchema();
            await routeCommand('activateTab', {
                namespace: 'USER',
                tableName: 'SQLUser.TestTable',
                schema,
            }, win, stubConnMgr, stubLifecycleMgr, session);

            assert.strictEqual(session.getCurrentNamespace(), 'USER');
            assert.strictEqual(session.getCurrentTableName(), 'SQLUser.TestTable');
            assert.ok(session.getCurrentSchema());

            // No response event should be sent
            assert.strictEqual(sentEvents.length, 0, 'activateTab should not send any events');
        });

        it('should handle missing namespace gracefully', async () => {
            session.startSession('test-server', createTestSpec(), '_SYSTEM', 'SYS');
            const { win, sentEvents } = createMockWindow();

            // No namespace/tableName — should still succeed (no-op)
            await routeCommand('activateTab', {}, win, stubConnMgr, stubLifecycleMgr, session);

            // No error event should be sent
            assert.strictEqual(sentEvents.length, 0);
        });

        it('should only set namespace when tableName is missing', async () => {
            session.startSession('test-server', createTestSpec(), '_SYSTEM', 'SYS');
            const { win } = createMockWindow();

            await routeCommand('activateTab', {
                namespace: 'SAMPLES',
            }, win, stubConnMgr, stubLifecycleMgr, session);

            assert.strictEqual(session.getCurrentNamespace(), 'SAMPLES');
            assert.strictEqual(session.getCurrentTableName(), null);
        });
    });

    // ============================================
    // Channel validation updates
    // ============================================

    describe('Channel validation (Story 11.3 additions)', () => {
        it('activateTab should be a valid command', () => {
            assert.strictEqual(isValidCommand('activateTab'), true);
        });

        it('restoreGridState should be a valid event', () => {
            assert.strictEqual(isValidEvent('restoreGridState'), true);
        });

        it('ALLOWED_COMMANDS should include activateTab', () => {
            assert.ok(ALLOWED_COMMANDS.has('activateTab'));
        });

        it('ALLOWED_EVENTS should include restoreGridState', () => {
            assert.ok(ALLOWED_EVENTS.has('restoreGridState'));
        });
    });

    // ============================================
    // emitLocalEvent callback registry logic
    // ============================================

    describe('emitLocalEvent logic (callback registry)', () => {
        it('should register and call local callbacks', () => {
            // Simulating the preload callback registry pattern
            const localCallbacks = new Map<string, Set<(payload: unknown) => void>>();
            const results: unknown[] = [];

            // Register
            const handler = (payload: unknown) => results.push(payload);
            const eventName = 'restoreGridState';
            let callbacks = localCallbacks.get(eventName);
            if (!callbacks) {
                callbacks = new Set();
                localCallbacks.set(eventName, callbacks);
            }
            callbacks.add(handler);

            // Emit
            const cbs = localCallbacks.get(eventName);
            if (cbs) {
                cbs.forEach(cb => cb({ test: true }));
            }

            assert.strictEqual(results.length, 1);
            assert.deepStrictEqual(results[0], { test: true });
        });

        it('should support multiple callbacks for same event', () => {
            const localCallbacks = new Map<string, Set<(payload: unknown) => void>>();
            const results: string[] = [];

            const handler1 = () => results.push('handler1');
            const handler2 = () => results.push('handler2');
            const eventName = 'restoreGridState';

            let callbacks = localCallbacks.get(eventName);
            if (!callbacks) {
                callbacks = new Set();
                localCallbacks.set(eventName, callbacks);
            }
            callbacks.add(handler1);
            callbacks.add(handler2);

            const cbs = localCallbacks.get(eventName);
            if (cbs) {
                cbs.forEach(cb => cb({}));
            }

            assert.strictEqual(results.length, 2);
            assert.ok(results.includes('handler1'));
            assert.ok(results.includes('handler2'));
        });

        it('should remove callback on offEvent', () => {
            const localCallbacks = new Map<string, Set<(payload: unknown) => void>>();
            const results: unknown[] = [];
            const handler = (payload: unknown) => results.push(payload);
            const eventName = 'restoreGridState';

            // Register
            let callbacks = localCallbacks.get(eventName);
            if (!callbacks) {
                callbacks = new Set();
                localCallbacks.set(eventName, callbacks);
            }
            callbacks.add(handler);

            // Remove
            const cbs2 = localCallbacks.get(eventName);
            if (cbs2) {
                cbs2.delete(handler);
                if (cbs2.size === 0) {
                    localCallbacks.delete(eventName);
                }
            }

            // Emit — should not call handler
            const cbs3 = localCallbacks.get(eventName);
            if (cbs3) {
                cbs3.forEach(cb => cb({ test: true }));
            }

            assert.strictEqual(results.length, 0);
        });

        it('should handle errors in callbacks gracefully', () => {
            const localCallbacks = new Map<string, Set<(payload: unknown) => void>>();
            const results: string[] = [];
            const errors: unknown[] = [];

            const badHandler = () => { throw new Error('test error'); };
            const goodHandler = () => results.push('success');
            const eventName = 'restoreGridState';

            let callbacks = localCallbacks.get(eventName);
            if (!callbacks) {
                callbacks = new Set();
                localCallbacks.set(eventName, callbacks);
            }
            callbacks.add(badHandler);
            callbacks.add(goodHandler);

            // Emit with error catching (matching preload pattern)
            const cbs = localCallbacks.get(eventName);
            if (cbs) {
                cbs.forEach(cb => {
                    try {
                        cb({});
                    } catch (e) {
                        errors.push(e);
                    }
                });
            }

            assert.strictEqual(results.length, 1);
            assert.strictEqual(errors.length, 1);
        });

        it('should validate event name (reject invalid events)', () => {
            // isValidEvent from channelValidation
            assert.strictEqual(isValidEvent('restoreGridState'), true);
            assert.strictEqual(isValidEvent('invalidEventName'), false);
            assert.strictEqual(isValidEvent(''), false);
        });

        it('should not emit for unregistered events', () => {
            const localCallbacks = new Map<string, Set<(payload: unknown) => void>>();
            const results: unknown[] = [];

            // No handlers registered
            const cbs = localCallbacks.get('restoreGridState');
            if (cbs) {
                cbs.forEach(cb => cb({ test: true }));
            }

            // Should not crash and results should be empty
            assert.strictEqual(results.length, 0);
        });
    });
});
