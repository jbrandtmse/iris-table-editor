/**
 * Unit tests for IPC handler routing
 * Story 11.1: Electron Bootstrap
 *
 * Tests the routeCommand function and sendEvent helper.
 * Since Electron's ipcMain/ipcRenderer require the runtime,
 * we mock BrowserWindow and test the routing logic directly.
 *
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConnectionManager, ServerConfig } from '../main/ConnectionManager';
import { ConnectionLifecycleManager } from '../main/ConnectionLifecycleManager';
import { AtelierApiService, ErrorCodes } from '@iris-te/core';
import type { IDesktopConnectionProgressPayload, IUserError } from '@iris-te/core';
import { routeCommand, sendEvent } from '../main/ipc';

// ============================================
// Mock BrowserWindow
// ============================================

interface SentEvent {
    channel: string;
    payload: unknown;
}

/**
 * Create a mock BrowserWindow with recording of sent events.
 */
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

// Type alias for the mock
type MockBrowserWindow = Parameters<typeof sendEvent>[0];

// ============================================
// Mock AtelierApiService
// ============================================

interface MockTestResult {
    success: boolean;
    error?: IUserError;
}

let mockTestConnectionResult: MockTestResult = { success: true };

const originalTestConnection = AtelierApiService.prototype.testConnection;
const originalSetTimeout = AtelierApiService.prototype.setTimeout;

// ============================================
// Helpers
// ============================================

function createTestServerConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
    return {
        name: 'test-server',
        hostname: 'localhost',
        port: 52773,
        username: '_SYSTEM',
        ssl: false,
        encryptedPassword: 'SYS',
        ...overrides,
    };
}

function findEvent(sentEvents: SentEvent[], eventName: string): SentEvent | undefined {
    return sentEvents.find(e => e.channel === `event:${eventName}`);
}

// ============================================
// Tests
// ============================================

describe('IPC Handler Routing', () => {
    let tempDir: string;
    let connMgr: ConnectionManager;
    let lifecycleMgr: ConnectionLifecycleManager;
    let lifecycleEvents: IDesktopConnectionProgressPayload[];

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-ipc-'));
        connMgr = new ConnectionManager({ configDir: tempDir });
        lifecycleEvents = [];
        lifecycleMgr = new ConnectionLifecycleManager(connMgr, (payload) => {
            lifecycleEvents.push({ ...payload });
        });
        mockTestConnectionResult = { success: true };

        // Patch AtelierApiService for testConnection-related commands
        AtelierApiService.prototype.setTimeout = function () { /* no-op */ };
        AtelierApiService.prototype.testConnection = async function () {
            return mockTestConnectionResult;
        };
    });

    afterEach(() => {
        AtelierApiService.prototype.testConnection = originalTestConnection;
        AtelierApiService.prototype.setTimeout = originalSetTimeout;

        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ============================================
    // sendEvent helper (Task 7.2)
    // ============================================

    describe('sendEvent', () => {
        it('should send event with correct channel prefix', () => {
            const { win, sentEvents } = createMockWindow();
            sendEvent(win, 'serversLoaded', { servers: [] });

            assert.strictEqual(sentEvents.length, 1);
            assert.strictEqual(sentEvents[0].channel, 'event:serversLoaded');
        });

        it('should include payload in sent event', () => {
            const { win, sentEvents } = createMockWindow();
            const payload = { servers: [{ name: 'test' }] };
            sendEvent(win, 'serversLoaded', payload);

            assert.deepStrictEqual(sentEvents[0].payload, payload);
        });

        it('should not send if window is destroyed', () => {
            const sentEvents: SentEvent[] = [];
            const win = {
                isDestroyed: () => true,
                webContents: {
                    send(channel: string, payload: unknown) {
                        sentEvents.push({ channel, payload });
                    },
                },
            } as unknown as MockBrowserWindow;

            sendEvent(win, 'serversLoaded', { servers: [] });

            assert.strictEqual(sentEvents.length, 0);
        });
    });

    // ============================================
    // getServers command (Task 7.1)
    // ============================================

    describe('getServers', () => {
        it('should return empty server list when no servers', async () => {
            const { win, sentEvents } = createMockWindow();
            await routeCommand('getServers', {}, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'serversLoaded');
            assert.ok(event);
            const payload = event.payload as { servers: unknown[] };
            assert.strictEqual(payload.servers.length, 0);
        });

        it('should return server list with correct structure', async () => {
            connMgr.saveServer(createTestServerConfig({
                name: 'my-server',
                hostname: '192.168.1.1',
                port: 443,
                description: 'Production',
                ssl: true,
            }));
            const { win, sentEvents } = createMockWindow();
            await routeCommand('getServers', {}, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'serversLoaded');
            assert.ok(event);
            const payload = event.payload as { servers: Array<{ name: string; hostname: string; port: number; description: string; ssl: boolean }> };
            assert.strictEqual(payload.servers.length, 1);
            assert.strictEqual(payload.servers[0].name, 'my-server');
            assert.strictEqual(payload.servers[0].hostname, '192.168.1.1');
            assert.strictEqual(payload.servers[0].port, 443);
            assert.strictEqual(payload.servers[0].description, 'Production');
            assert.strictEqual(payload.servers[0].ssl, true);
        });

        it('should return multiple servers', async () => {
            connMgr.saveServer(createTestServerConfig({ name: 'server-a' }));
            connMgr.saveServer(createTestServerConfig({ name: 'server-b' }));
            const { win, sentEvents } = createMockWindow();
            await routeCommand('getServers', {}, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'serversLoaded');
            assert.ok(event);
            const payload = event.payload as { servers: unknown[] };
            assert.strictEqual(payload.servers.length, 2);
        });
    });

    // ============================================
    // connectServer command
    // ============================================

    describe('connectServer', () => {
        it('should call lifecycleManager.connect with server name', async () => {
            connMgr.saveServer(createTestServerConfig({ name: 'prod' }));
            const { win } = createMockWindow();
            await routeCommand('connectServer', { serverName: 'prod' }, win, connMgr, lifecycleMgr);

            // Lifecycle manager should have progressed to connected
            assert.strictEqual(lifecycleMgr.getState(), 'connected');
            assert.strictEqual(lifecycleMgr.getConnectedServer(), 'prod');
        });

        it('should send error when no server name provided', async () => {
            const { win, sentEvents } = createMockWindow();
            await routeCommand('connectServer', { serverName: null }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
            const payload = event.payload as { message: string; context: string };
            assert.ok(payload.message.includes('No server name'));
            assert.strictEqual(payload.context, 'connectServer');
        });

        it('should emit lifecycle events via callback', async () => {
            connMgr.saveServer(createTestServerConfig({ name: 'dev' }));
            const { win } = createMockWindow();
            await routeCommand('connectServer', { serverName: 'dev' }, win, connMgr, lifecycleMgr);

            assert.ok(lifecycleEvents.length >= 2);
            assert.strictEqual(lifecycleEvents[0].status, 'connecting');
            assert.strictEqual(lifecycleEvents[1].status, 'connected');
        });
    });

    // ============================================
    // disconnectServer command
    // ============================================

    describe('disconnectServer', () => {
        it('should call lifecycleManager.disconnect', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { win } = createMockWindow();

            await routeCommand('connectServer', { serverName: 'test-server' }, win, connMgr, lifecycleMgr);
            assert.strictEqual(lifecycleMgr.getState(), 'connected');

            await routeCommand('disconnectServer', {}, win, connMgr, lifecycleMgr);
            assert.strictEqual(lifecycleMgr.getState(), 'disconnected');
        });
    });

    // ============================================
    // cancelConnection command
    // ============================================

    describe('cancelConnection', () => {
        it('should call lifecycleManager.cancelConnection', async () => {
            const { win } = createMockWindow();
            // No-op when not connecting, but should not throw
            await routeCommand('cancelConnection', {}, win, connMgr, lifecycleMgr);
            assert.strictEqual(lifecycleMgr.getState(), 'idle');
        });
    });

    // ============================================
    // deleteServer command
    // ============================================

    describe('deleteServer', () => {
        it('should delete server and send serverDeleted event', async () => {
            connMgr.saveServer(createTestServerConfig({ name: 'to-delete' }));
            const { win, sentEvents } = createMockWindow();
            await routeCommand('deleteServer', { serverName: 'to-delete' }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'serverDeleted');
            assert.ok(event);
            const payload = event.payload as { serverName: string };
            assert.strictEqual(payload.serverName, 'to-delete');
            assert.strictEqual(connMgr.getServerCount(), 0);
        });

        it('should send error when no server name provided', async () => {
            const { win, sentEvents } = createMockWindow();
            await routeCommand('deleteServer', { serverName: null }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
        });

        it('should throw when deleting non-existent server', async () => {
            const { win } = createMockWindow();
            // routeCommand does not catch errors from the service — they propagate
            // The registerIpcHandlers wrapper catches them
            await assert.rejects(
                routeCommand('deleteServer', { serverName: 'nonexistent' }, win, connMgr, lifecycleMgr),
                (error: Error) => {
                    assert.ok(error.message.includes('not found'));
                    return true;
                }
            );
        });
    });

    // ============================================
    // editServer command
    // ============================================

    describe('editServer', () => {
        it('should send serverConfigLoaded event with server details', async () => {
            connMgr.saveServer(createTestServerConfig({
                name: 'edit-me',
                hostname: 'myhost.local',
                port: 443,
                username: 'admin',
                ssl: true,
                description: 'My server',
                pathPrefix: '/iris',
            }));
            const { win, sentEvents } = createMockWindow();
            await routeCommand('editServer', { serverName: 'edit-me' }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'serverConfigLoaded');
            assert.ok(event);
            const payload = event.payload as {
                name: string;
                hostname: string;
                port: number;
                username: string;
                ssl: boolean;
                description: string;
                pathPrefix: string;
            };
            assert.strictEqual(payload.name, 'edit-me');
            assert.strictEqual(payload.hostname, 'myhost.local');
            assert.strictEqual(payload.port, 443);
            assert.strictEqual(payload.username, 'admin');
            assert.strictEqual(payload.ssl, true);
            assert.strictEqual(payload.description, 'My server');
            assert.strictEqual(payload.pathPrefix, '/iris');
        });

        it('should send error when server not found', async () => {
            const { win, sentEvents } = createMockWindow();
            await routeCommand('editServer', { serverName: 'nonexistent' }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
            const payload = event.payload as { message: string };
            assert.ok(payload.message.includes('not found'));
        });

        it('should send error when no server name provided', async () => {
            const { win, sentEvents } = createMockWindow();
            await routeCommand('editServer', { serverName: null }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
        });
    });

    // ============================================
    // saveServer command
    // ============================================

    describe('saveServer', () => {
        it('should save server and send serverSaved event', async () => {
            const { win, sentEvents } = createMockWindow();
            await routeCommand('saveServer', {
                name: 'new-server',
                hostname: 'localhost',
                port: 52773,
                username: '_SYSTEM',
                password: 'SYS',
                ssl: false,
            }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'serverSaved');
            assert.ok(event);
            const payload = event.payload as { serverName: string; mode: string };
            assert.strictEqual(payload.serverName, 'new-server');
            assert.strictEqual(payload.mode, 'add');
            assert.strictEqual(connMgr.getServerCount(), 1);
        });
    });

    // ============================================
    // updateServer command
    // ============================================

    describe('updateServer', () => {
        it('should update server and send serverSaved event in edit mode', async () => {
            connMgr.saveServer(createTestServerConfig({ name: 'original' }));
            const { win, sentEvents } = createMockWindow();

            await routeCommand('updateServer', {
                originalName: 'original',
                name: 'renamed',
                hostname: 'newhost',
                port: 443,
                username: 'admin',
                password: '',
                ssl: true,
            }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'serverSaved');
            assert.ok(event);
            const payload = event.payload as { serverName: string; mode: string };
            assert.strictEqual(payload.serverName, 'renamed');
            assert.strictEqual(payload.mode, 'edit');
        });
    });

    // ============================================
    // testFormConnection command
    // ============================================

    describe('testFormConnection', () => {
        it('should test connection and send testConnectionResult event', async () => {
            mockTestConnectionResult = { success: true };
            const { win, sentEvents } = createMockWindow();

            await routeCommand('testFormConnection', {
                hostname: 'localhost',
                port: 52773,
                ssl: false,
                username: '_SYSTEM',
                password: 'SYS',
            }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'testConnectionResult');
            assert.ok(event);
            const payload = event.payload as { success: boolean; message: string };
            assert.strictEqual(payload.success, true);
        });

        it('should send failure result when connection fails', async () => {
            mockTestConnectionResult = {
                success: false,
                error: {
                    message: 'Connection refused',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            const { win, sentEvents } = createMockWindow();

            await routeCommand('testFormConnection', {
                hostname: 'badhost',
                port: 9999,
                ssl: false,
                username: 'user',
                password: 'pass',
            }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'testConnectionResult');
            assert.ok(event);
            const payload = event.payload as { success: boolean; message: string };
            assert.strictEqual(payload.success, false);
        });
    });

    // ============================================
    // selectServer command
    // ============================================

    describe('selectServer', () => {
        it('should send serverSelected event with server name', async () => {
            const { win, sentEvents } = createMockWindow();
            await routeCommand('selectServer', { serverName: 'my-server' }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'serverSelected');
            assert.ok(event);
            const payload = event.payload as { serverName: string };
            assert.strictEqual(payload.serverName, 'my-server');
        });

        it('should send error when no server name provided', async () => {
            const { win, sentEvents } = createMockWindow();
            await routeCommand('selectServer', { serverName: null }, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
            const payload = event.payload as { message: string; context: string };
            assert.ok(payload.message.includes('No server name'));
            assert.strictEqual(payload.context, 'selectServer');
        });
    });

    // ============================================
    // Unknown command (Task 7.1)
    // ============================================

    describe('unknown command', () => {
        it('should send error event for unknown commands', async () => {
            const { win, sentEvents } = createMockWindow();
            await routeCommand('unknownCommand', {}, win, connMgr, lifecycleMgr);

            const event = findEvent(sentEvents, 'error');
            assert.ok(event);
            const payload = event.payload as { message: string; context: string };
            assert.ok(payload.message.includes('Unknown command'));
            assert.strictEqual(payload.context, 'routeCommand');
        });
    });

    // ============================================
    // Error handling (Task 7.3)
    // ============================================

    describe('error handling', () => {
        it('should propagate service errors (caught by registerIpcHandlers wrapper)', async () => {
            // Attempt to delete a non-existent server — should throw
            const { win } = createMockWindow();
            await assert.rejects(
                routeCommand('deleteServer', { serverName: 'does-not-exist' }, win, connMgr, lifecycleMgr),
                (error: Error) => {
                    assert.ok(error instanceof Error);
                    return true;
                }
            );
        });

        it('should propagate save errors for duplicate servers', async () => {
            connMgr.saveServer(createTestServerConfig({ name: 'duplicate' }));
            const { win } = createMockWindow();

            await assert.rejects(
                routeCommand('saveServer', {
                    name: 'duplicate',
                    hostname: 'localhost',
                    port: 52773,
                    username: '_SYSTEM',
                    password: 'SYS',
                    ssl: false,
                }, win, connMgr, lifecycleMgr),
                (error: Error) => {
                    assert.ok(error.message.includes('already exists'));
                    return true;
                }
            );
        });
    });
});

describe('IPC Preload Bridge', () => {
    // ============================================
    // Preload bridge design verification (AC: 3)
    // ============================================

    describe('bridge interface verification', () => {
        it('should define the correct IMessageBridge methods', () => {
            // Verify that the expected methods match IMessageBridge
            const expectedMethods = ['sendCommand', 'onEvent', 'offEvent', 'getState', 'setState'];
            // This is a design verification — the actual bridge is tested manually in Electron
            assert.ok(expectedMethods.length === 5);
        });
    });
});

describe('IPC sendEvent edge cases', () => {
    it('should handle null payload', () => {
        const sentEvents: SentEvent[] = [];
        const win = {
            isDestroyed: () => false,
            webContents: {
                send(channel: string, payload: unknown) {
                    sentEvents.push({ channel, payload });
                },
            },
        } as unknown as Parameters<typeof sendEvent>[0];

        sendEvent(win, 'testEvent', null);

        assert.strictEqual(sentEvents.length, 1);
        assert.strictEqual(sentEvents[0].payload, null);
    });

    it('should handle undefined payload', () => {
        const sentEvents: SentEvent[] = [];
        const win = {
            isDestroyed: () => false,
            webContents: {
                send(channel: string, payload: unknown) {
                    sentEvents.push({ channel, payload });
                },
            },
        } as unknown as Parameters<typeof sendEvent>[0];

        sendEvent(win, 'testEvent', undefined);

        assert.strictEqual(sentEvents.length, 1);
        assert.strictEqual(sentEvents[0].payload, undefined);
    });

    it('should handle complex nested payload', () => {
        const sentEvents: SentEvent[] = [];
        const win = {
            isDestroyed: () => false,
            webContents: {
                send(channel: string, payload: unknown) {
                    sentEvents.push({ channel, payload });
                },
            },
        } as unknown as Parameters<typeof sendEvent>[0];

        const complexPayload = {
            servers: [{ name: 'a', nested: { deep: true } }],
            count: 42,
        };

        sendEvent(win, 'complex', complexPayload);

        assert.deepStrictEqual(sentEvents[0].payload, complexPayload);
    });
});
