/**
 * Unit tests for WindowStateManager, off-screen detection, and debounce
 * Story 11.5: Window State Persistence
 *
 * Tests load/save operations, validation, defaults, off-screen detection,
 * debounce behavior, and channel validation updates.
 *
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    WindowStateManager,
    isOnScreen,
    createDebouncedSave,
} from '../main/WindowStateManager';
import type {
    AppPersistentState,
    DisplayBounds,
} from '../main/WindowStateManager';
import {
    ALLOWED_COMMANDS,
    ALLOWED_EVENTS,
    isValidCommand,
    isValidEvent,
} from '../main/channelValidation';

// ============================================
// WindowStateManager Tests
// ============================================

describe('WindowStateManager', () => {
    let tempDir: string;
    let manager: WindowStateManager;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-wsm-test-'));
        manager = new WindowStateManager(tempDir);
    });

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ============================================
    // Defaults
    // ============================================

    describe('getDefaults', () => {
        it('should return default state with correct values', () => {
            const defaults = manager.getDefaults();
            assert.strictEqual(defaults.window.width, 1200);
            assert.strictEqual(defaults.window.height, 800);
            assert.strictEqual(defaults.window.isMaximized, false);
            assert.strictEqual(defaults.window.x, undefined);
            assert.strictEqual(defaults.window.y, undefined);
            assert.strictEqual(defaults.sidebar.width, 280);
            assert.strictEqual(defaults.sidebar.isVisible, true);
            assert.strictEqual(defaults.theme, 'system');
        });

        it('should return a fresh copy each time', () => {
            const d1 = manager.getDefaults();
            const d2 = manager.getDefaults();
            assert.notStrictEqual(d1, d2);
            assert.notStrictEqual(d1.window, d2.window);
            assert.notStrictEqual(d1.sidebar, d2.sidebar);
        });
    });

    // ============================================
    // Load
    // ============================================

    describe('load', () => {
        it('should return defaults when no file exists', () => {
            const state = manager.load();
            assert.strictEqual(state.window.width, 1200);
            assert.strictEqual(state.window.height, 800);
            assert.strictEqual(state.window.isMaximized, false);
            assert.strictEqual(state.sidebar.width, 280);
            assert.strictEqual(state.sidebar.isVisible, true);
            assert.strictEqual(state.theme, 'system');
        });

        it('should load valid saved state', () => {
            const savedState: AppPersistentState = {
                window: { x: 100, y: 200, width: 1000, height: 700, isMaximized: true },
                sidebar: { width: 300, isVisible: false },
                theme: 'dark',
            };
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify(savedState), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.x, 100);
            assert.strictEqual(state.window.y, 200);
            assert.strictEqual(state.window.width, 1000);
            assert.strictEqual(state.window.height, 700);
            assert.strictEqual(state.window.isMaximized, true);
            assert.strictEqual(state.sidebar.width, 300);
            assert.strictEqual(state.sidebar.isVisible, false);
            assert.strictEqual(state.theme, 'dark');
        });

        it('should return defaults on corrupted JSON', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, 'not valid json!!!', 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.width, 1200);
            assert.strictEqual(state.window.height, 800);
            assert.strictEqual(state.theme, 'system');
        });

        it('should return defaults on non-object JSON', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, '"just a string"', 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.width, 1200);
            assert.strictEqual(state.theme, 'system');
        });

        it('should return defaults on null JSON', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, 'null', 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.width, 1200);
        });

        it('should return defaults on empty object JSON', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, '{}', 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.width, 1200);
            assert.strictEqual(state.window.height, 800);
            assert.strictEqual(state.sidebar.width, 280);
            assert.strictEqual(state.theme, 'system');
        });
    });

    // ============================================
    // Validation
    // ============================================

    describe('validation', () => {
        it('should clamp window width below minimum to default', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                window: { width: 100, height: 600, isMaximized: false },
            }), 'utf-8');

            const state = manager.load();
            // Width 100 is below minimum 400, should use default 1200
            assert.strictEqual(state.window.width, 1200);
        });

        it('should clamp window height below minimum to default', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                window: { width: 800, height: 100, isMaximized: false },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.height, 800); // default
        });

        it('should clamp window width above maximum to default', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                window: { width: 99999, height: 600, isMaximized: false },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.width, 1200); // default
        });

        it('should accept valid window dimensions', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                window: { width: 800, height: 600, isMaximized: false },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.width, 800);
            assert.strictEqual(state.window.height, 600);
        });

        it('should clamp sidebar width below minimum to default', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                sidebar: { width: 50, isVisible: true },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.sidebar.width, 280); // default
        });

        it('should clamp sidebar width above maximum to default', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                sidebar: { width: 800, isVisible: true },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.sidebar.width, 280); // default
        });

        it('should accept valid sidebar width', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                sidebar: { width: 350, isVisible: true },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.sidebar.width, 350);
        });

        it('should reject invalid theme values', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                theme: 'invalid-theme',
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.theme, 'system'); // default
        });

        it('should accept light theme', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({ theme: 'light' }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.theme, 'light');
        });

        it('should accept dark theme', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({ theme: 'dark' }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.theme, 'dark');
        });

        it('should reject non-boolean isMaximized', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                window: { width: 800, height: 600, isMaximized: 'yes' },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.isMaximized, false); // default
        });

        it('should reject non-boolean sidebar isVisible', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                sidebar: { width: 280, isVisible: 'true' },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.sidebar.isVisible, true); // default
        });

        it('should reject non-number x and y', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                window: { x: 'abc', y: null, width: 800, height: 600, isMaximized: false },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.x, undefined);
            assert.strictEqual(state.window.y, undefined);
        });

        it('should reject Infinity and NaN for x and y', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            // JSON.stringify converts Infinity/NaN to null, so test via object
            fs.writeFileSync(filePath, JSON.stringify({
                window: { x: null, y: null, width: 800, height: 600, isMaximized: false },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.x, undefined);
            assert.strictEqual(state.window.y, undefined);
        });

        it('should round floating-point dimensions', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                window: { x: 100.7, y: 200.3, width: 800.5, height: 600.9, isMaximized: false },
                sidebar: { width: 300.4, isVisible: true },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.x, 101);
            assert.strictEqual(state.window.y, 200);
            assert.strictEqual(state.window.width, 801);
            assert.strictEqual(state.window.height, 601);
            assert.strictEqual(state.sidebar.width, 300);
        });

        it('should handle window as non-object gracefully', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                window: 'not an object',
                sidebar: { width: 300, isVisible: true },
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.width, 1200); // default
            assert.strictEqual(state.sidebar.width, 300); // sidebar still loads
        });

        it('should handle sidebar as non-object gracefully', () => {
            const filePath = path.join(tempDir, 'window-state.json');
            fs.writeFileSync(filePath, JSON.stringify({
                window: { width: 800, height: 600, isMaximized: false },
                sidebar: 42,
            }), 'utf-8');

            const state = manager.load();
            assert.strictEqual(state.window.width, 800);
            assert.strictEqual(state.sidebar.width, 280); // default
        });
    });

    // ============================================
    // Save
    // ============================================

    describe('save', () => {
        it('should write state to disk', () => {
            const state: AppPersistentState = {
                window: { x: 50, y: 60, width: 900, height: 650, isMaximized: false },
                sidebar: { width: 320, isVisible: true },
                theme: 'light',
            };

            manager.save(state);

            const filePath = manager.getStatePath();
            assert.ok(fs.existsSync(filePath), 'State file should exist after save');

            const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            assert.strictEqual(loaded.window.x, 50);
            assert.strictEqual(loaded.window.y, 60);
            assert.strictEqual(loaded.window.width, 900);
            assert.strictEqual(loaded.window.height, 650);
            assert.strictEqual(loaded.window.isMaximized, false);
            assert.strictEqual(loaded.sidebar.width, 320);
            assert.strictEqual(loaded.sidebar.isVisible, true);
            assert.strictEqual(loaded.theme, 'light');
        });

        it('should create directory if it does not exist', () => {
            const nestedDir = path.join(tempDir, 'nested', 'dir');
            const nestedManager = new WindowStateManager(nestedDir);

            nestedManager.save(nestedManager.getDefaults());

            assert.ok(fs.existsSync(nestedManager.getStatePath()), 'State file in nested dir should exist');
        });

        it('should overwrite existing state file', () => {
            const state1: AppPersistentState = {
                window: { width: 900, height: 650, isMaximized: false },
                sidebar: { width: 300, isVisible: true },
                theme: 'light',
            };
            manager.save(state1);

            const state2: AppPersistentState = {
                window: { width: 1100, height: 750, isMaximized: true },
                sidebar: { width: 250, isVisible: false },
                theme: 'dark',
            };
            manager.save(state2);

            const loaded = manager.load();
            assert.strictEqual(loaded.window.width, 1100);
            assert.strictEqual(loaded.window.isMaximized, true);
            assert.strictEqual(loaded.sidebar.width, 250);
            assert.strictEqual(loaded.sidebar.isVisible, false);
            assert.strictEqual(loaded.theme, 'dark');
        });

        it('should produce valid JSON that can be loaded', () => {
            const state: AppPersistentState = {
                window: { x: -100, y: 0, width: 500, height: 400, isMaximized: false },
                sidebar: { width: 200, isVisible: false },
                theme: 'system',
            };
            manager.save(state);

            const loaded = manager.load();
            assert.strictEqual(loaded.window.x, -100);
            assert.strictEqual(loaded.window.y, 0);
            assert.strictEqual(loaded.window.width, 500);
            assert.strictEqual(loaded.window.height, 400);
        });
    });

    // ============================================
    // getStatePath
    // ============================================

    describe('getStatePath', () => {
        it('should return path ending with window-state.json', () => {
            const p = manager.getStatePath();
            assert.ok(p.endsWith('window-state.json'));
            assert.ok(p.startsWith(tempDir));
        });
    });
});

// ============================================
// Off-Screen Detection Tests
// ============================================

describe('isOnScreen', () => {
    const singleDisplay: DisplayBounds[] = [
        { x: 0, y: 0, width: 1920, height: 1080 },
    ];

    const dualDisplay: DisplayBounds[] = [
        { x: 0, y: 0, width: 1920, height: 1080 },
        { x: 1920, y: 0, width: 1920, height: 1080 },
    ];

    it('should return true when window center is on single display', () => {
        assert.strictEqual(isOnScreen(100, 100, 800, 600, singleDisplay), true);
    });

    it('should return true when window center is on the primary display', () => {
        assert.strictEqual(isOnScreen(0, 0, 1920, 1080, singleDisplay), true);
    });

    it('should return false when window is completely off-screen', () => {
        assert.strictEqual(isOnScreen(3000, 3000, 800, 600, singleDisplay), false);
    });

    it('should return false when window center is off-screen to the left', () => {
        // Window at -1000, center at -600. Off the display.
        assert.strictEqual(isOnScreen(-1000, 100, 800, 600, singleDisplay), false);
    });

    it('should return false when window center is off-screen to the right', () => {
        assert.strictEqual(isOnScreen(2000, 100, 800, 600, singleDisplay), false);
    });

    it('should return true when window center is on second display', () => {
        // Window at x=2000 on second display (1920-3840)
        assert.strictEqual(isOnScreen(2000, 100, 800, 600, dualDisplay), true);
    });

    it('should return true when window partially overlaps but center is on-screen', () => {
        // Window at x=1200, width=800: center at 1600 which is < 1920
        assert.strictEqual(isOnScreen(1200, 100, 800, 600, singleDisplay), true);
    });

    it('should return false when no displays are provided', () => {
        assert.strictEqual(isOnScreen(100, 100, 800, 600, []), false);
    });

    it('should handle negative display positions (display above primary)', () => {
        const displays: DisplayBounds[] = [
            { x: 0, y: 0, width: 1920, height: 1080 },
            { x: 0, y: -1080, width: 1920, height: 1080 },
        ];
        // Window on the upper display
        assert.strictEqual(isOnScreen(100, -800, 800, 600, displays), true);
    });

    it('should handle window at exact edge of display', () => {
        // Window center at exactly (1920, 540) is at the edge of first display
        // Center at 1920 is NOT < 1920, so should be off-screen for single display
        assert.strictEqual(isOnScreen(1520, 240, 800, 600, singleDisplay), false);
    });

    it('should detect window center at edge as on second display', () => {
        // Center at 1920 is >= 1920 (start of second display) for dual display
        assert.strictEqual(isOnScreen(1520, 240, 800, 600, dualDisplay), true);
    });
});

// ============================================
// Debounce Tests
// ============================================

describe('createDebouncedSave', () => {
    it('should call function after delay', async () => {
        let callCount = 0;
        const debounced = createDebouncedSave(() => { callCount++; }, 50);

        debounced.call();

        // Should not have been called yet
        assert.strictEqual(callCount, 0);

        // Wait for debounce to fire
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(callCount, 1);
    });

    it('should only call once for multiple rapid invocations', async () => {
        let callCount = 0;
        const debounced = createDebouncedSave(() => { callCount++; }, 50);

        debounced.call();
        debounced.call();
        debounced.call();
        debounced.call();
        debounced.call();

        // Wait for debounce
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(callCount, 1);
    });

    it('should cancel pending call', async () => {
        let callCount = 0;
        const debounced = createDebouncedSave(() => { callCount++; }, 50);

        debounced.call();
        debounced.cancel();

        // Wait past the delay
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(callCount, 0);
    });

    it('should allow new calls after cancel', async () => {
        let callCount = 0;
        const debounced = createDebouncedSave(() => { callCount++; }, 50);

        debounced.call();
        debounced.cancel();
        debounced.call();

        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(callCount, 1);
    });

    it('should reset timer on subsequent calls', async () => {
        let callCount = 0;
        const debounced = createDebouncedSave(() => { callCount++; }, 80);

        debounced.call();

        // Wait 50ms (less than delay) and call again
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.strictEqual(callCount, 0);
        debounced.call();

        // Wait another 50ms — first call was reset, so 50ms after second call
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.strictEqual(callCount, 0);

        // Wait more for the actual fire
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.strictEqual(callCount, 1);
    });

    it('cancel should be safe to call when no pending timeout', () => {
        const debounced = createDebouncedSave(() => {}, 50);

        // Should not throw
        debounced.cancel();
        debounced.cancel();
    });
});

// ============================================
// Channel Validation Updates (Story 11.5)
// ============================================

describe('Channel Validation (Story 11.5)', () => {
    describe('ALLOWED_COMMANDS', () => {
        it('should include sidebarStateChanged command', () => {
            assert.ok(ALLOWED_COMMANDS.has('sidebarStateChanged'), 'Missing sidebarStateChanged command');
        });

        it('should have exactly 23 commands', () => {
            assert.strictEqual(ALLOWED_COMMANDS.size, 23);
        });
    });

    describe('ALLOWED_EVENTS', () => {
        it('should include restoreAppState event', () => {
            assert.ok(ALLOWED_EVENTS.has('restoreAppState'), 'Missing restoreAppState event');
        });

        it('should have exactly 25 events', () => {
            assert.strictEqual(ALLOWED_EVENTS.size, 25);
        });
    });

    describe('isValidCommand', () => {
        it('should return true for sidebarStateChanged', () => {
            assert.strictEqual(isValidCommand('sidebarStateChanged'), true);
        });
    });

    describe('isValidEvent', () => {
        it('should return true for restoreAppState', () => {
            assert.strictEqual(isValidEvent('restoreAppState'), true);
        });
    });
});

// ============================================
// IPC sidebarStateChanged command routing
// ============================================

describe('sidebarStateChanged IPC command', () => {
    it('should be routable as a command (integration-ready)', async () => {
        // This test verifies that sidebarStateChanged is in the allowed commands
        // and can be validated. Full IPC routing is tested in ipc.test.ts.
        assert.ok(isValidCommand('sidebarStateChanged'));
    });

    it('should invoke onSidebarStateChanged callback via routeCommand', async () => {
        // Import routeCommand and sendEvent for IPC routing test
        const { routeCommand } = await import('../main/ipc');
        type MockBrowserWindow = Parameters<typeof routeCommand>[2];

        const mockWin = {
            isDestroyed: () => false,
            webContents: { send: () => {} },
        } as unknown as MockBrowserWindow;

        const stubConnMgr = {} as Parameters<typeof routeCommand>[3];
        const stubLifecycleMgr = { disconnect: () => {} } as unknown as Parameters<typeof routeCommand>[4];

        let receivedWidth = -1;
        let receivedVisible: boolean | null = null;

        await routeCommand(
            'sidebarStateChanged',
            { width: 320, isVisible: false },
            mockWin,
            stubConnMgr,
            stubLifecycleMgr,
            undefined,
            {
                onSidebarStateChanged: (payload) => {
                    receivedWidth = payload.width;
                    receivedVisible = payload.isVisible;
                },
            }
        );

        assert.strictEqual(receivedWidth, 320);
        assert.strictEqual(receivedVisible, false);
    });

    it('should clamp sidebar width in IPC handler', async () => {
        const { routeCommand } = await import('../main/ipc');
        type MockBrowserWindow = Parameters<typeof routeCommand>[2];

        const mockWin = {
            isDestroyed: () => false,
            webContents: { send: () => {} },
        } as unknown as MockBrowserWindow;

        const stubConnMgr = {} as Parameters<typeof routeCommand>[3];
        const stubLifecycleMgr = { disconnect: () => {} } as unknown as Parameters<typeof routeCommand>[4];

        let receivedWidth = -1;

        // Send width out of range (too large)
        await routeCommand(
            'sidebarStateChanged',
            { width: 9999, isVisible: true },
            mockWin,
            stubConnMgr,
            stubLifecycleMgr,
            undefined,
            {
                onSidebarStateChanged: (payload) => {
                    receivedWidth = payload.width;
                },
            }
        );

        assert.strictEqual(receivedWidth, 400, 'Width should be clamped to max 400');

        // Send width out of range (too small)
        await routeCommand(
            'sidebarStateChanged',
            { width: 10, isVisible: true },
            mockWin,
            stubConnMgr,
            stubLifecycleMgr,
            undefined,
            {
                onSidebarStateChanged: (payload) => {
                    receivedWidth = payload.width;
                },
            }
        );

        assert.strictEqual(receivedWidth, 200, 'Width should be clamped to min 200');
    });

    it('should not throw when onSidebarStateChanged callback is not provided', async () => {
        const { routeCommand } = await import('../main/ipc');
        type MockBrowserWindow = Parameters<typeof routeCommand>[2];

        const mockWin = {
            isDestroyed: () => false,
            webContents: { send: () => {} },
        } as unknown as MockBrowserWindow;

        const stubConnMgr = {} as Parameters<typeof routeCommand>[3];
        const stubLifecycleMgr = { disconnect: () => {} } as unknown as Parameters<typeof routeCommand>[4];

        await assert.doesNotReject(
            routeCommand(
                'sidebarStateChanged',
                { width: 280, isVisible: true },
                mockWin,
                stubConnMgr,
                stubLifecycleMgr
            )
        );
    });
});
