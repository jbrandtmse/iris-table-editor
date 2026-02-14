/**
 * Unit tests for ConnectionLifecycleManager
 * Story 12.5: Connection Lifecycle
 *
 * Tests connect/disconnect/cancel flows, state transitions, error mapping,
 * server switching, and edge cases.
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConnectionManager, ServerConfig } from '../main/ConnectionManager';
import { ConnectionLifecycleManager, ConnectionState } from '../main/ConnectionLifecycleManager';
import { AtelierApiService, ErrorCodes } from '@iris-te/core';
import type { IDesktopConnectionProgressPayload, IUserError } from '@iris-te/core';

// ============================================
// Mock AtelierApiService via prototype patching
// ============================================

interface MockTestResult {
    success: boolean;
    error?: IUserError;
}

interface CapturedCall {
    spec: {
        name: string;
        scheme: string;
        host: string;
        port: number;
        pathPrefix: string;
        username?: string;
    };
    username: string;
    password: string;
    timeout: number;
    signal?: AbortSignal;
}

let mockResult: MockTestResult = { success: true };
let capturedCalls: CapturedCall[] = [];
let mockDelay = 0; // Optional delay to simulate async behavior

// Save original methods
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

/**
 * Collect all events emitted during a test
 */
function createEventCollector(): {
    events: IDesktopConnectionProgressPayload[];
    callback: (payload: IDesktopConnectionProgressPayload) => void;
} {
    const events: IDesktopConnectionProgressPayload[] = [];
    const callback = (payload: IDesktopConnectionProgressPayload) => {
        events.push({ ...payload });
    };
    return { events, callback };
}

// ============================================
// Tests
// ============================================

describe('ConnectionLifecycleManager', () => {
    let tempDir: string;
    let connMgr: ConnectionManager;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-lifecycle-'));
        connMgr = new ConnectionManager({ configDir: tempDir });
        mockResult = { success: true };
        capturedCalls = [];
        mockDelay = 0;

        // Patch AtelierApiService.prototype
        let capturedTimeout = 30000;

        AtelierApiService.prototype.setTimeout = function (timeout: number) {
            capturedTimeout = timeout;
        };

        AtelierApiService.prototype.testConnection = async function (
            spec: Parameters<typeof originalTestConnection>[0],
            username: string,
            password: string,
            externalSignal?: AbortSignal
        ) {
            capturedCalls.push({
                spec: {
                    name: spec.name,
                    scheme: spec.scheme,
                    host: spec.host,
                    port: spec.port,
                    pathPrefix: spec.pathPrefix,
                    username: spec.username,
                },
                username,
                password,
                timeout: capturedTimeout,
                signal: externalSignal,
            });

            if (mockDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, mockDelay));
            }

            return mockResult;
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
    // Initial state
    // ============================================

    describe('initial state', () => {
        it('should start in idle state', () => {
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            assert.strictEqual(lifecycle.getState(), 'idle');
        });

        it('should have no connected server initially', () => {
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            assert.strictEqual(lifecycle.getConnectedServer(), null);
        });

        it('should not be connecting initially', () => {
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            assert.strictEqual(lifecycle.isConnecting(), false);
        });
    });

    // ============================================
    // connect() - success flow (AC: 1, 3)
    // ============================================

    describe('connect() - success', () => {
        it('should transition through connecting to connected', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            assert.strictEqual(events.length, 2);
            assert.strictEqual(events[0].status, 'connecting');
            assert.strictEqual(events[0].serverName, 'test-server');
            assert.strictEqual(events[1].status, 'connected');
            assert.strictEqual(events[1].serverName, 'test-server');
        });

        it('should set state to connected after success', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            assert.strictEqual(lifecycle.getState(), 'connected');
        });

        it('should track connected server name', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            assert.strictEqual(lifecycle.getConnectedServer(), 'test-server');
        });

        it('should build correct IServerSpec from config', async () => {
            connMgr.saveServer(createTestServerConfig({
                name: 'my-server',
                hostname: '192.168.1.100',
                port: 443,
                ssl: true,
                pathPrefix: '/iris',
                username: 'admin',
            }));
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('my-server');

            assert.strictEqual(capturedCalls.length, 1);
            const call = capturedCalls[0];
            assert.strictEqual(call.spec.name, 'my-server');
            assert.strictEqual(call.spec.scheme, 'https');
            assert.strictEqual(call.spec.host, '192.168.1.100');
            assert.strictEqual(call.spec.port, 443);
            assert.strictEqual(call.spec.pathPrefix, '/iris');
            assert.strictEqual(call.spec.username, 'admin');
            assert.strictEqual(call.username, 'admin');
            assert.strictEqual(call.password, 'SYS');
        });

        it('should use http scheme when ssl is false', async () => {
            connMgr.saveServer(createTestServerConfig({ ssl: false }));
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            assert.strictEqual(capturedCalls[0].spec.scheme, 'http');
        });

        it('should set 10 second timeout on AtelierApiService', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            assert.strictEqual(capturedCalls[0].timeout, 10000);
        });

        it('should pass AbortSignal to AtelierApiService', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            assert.ok(capturedCalls[0].signal instanceof AbortSignal);
        });

        it('should use empty pathPrefix when not provided', async () => {
            connMgr.saveServer(createTestServerConfig({ pathPrefix: undefined }));
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            assert.strictEqual(capturedCalls[0].spec.pathPrefix, '');
        });
    });

    // ============================================
    // connect() - error mapping (AC: 4)
    // ============================================

    describe('connect() - error mapping', () => {
        it('should map SERVER_UNREACHABLE to user-friendly message', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Network error',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            const errorEvent = events.find(e => e.status === 'error');
            assert.ok(errorEvent);
            assert.strictEqual(errorEvent.message, 'Could not reach server. Check host and port.');
            assert.strictEqual(lifecycle.getState(), 'error');
        });

        it('should map AUTH_FAILED to user-friendly message', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Auth failed',
                    code: ErrorCodes.AUTH_FAILED,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            const errorEvent = events.find(e => e.status === 'error');
            assert.ok(errorEvent);
            assert.strictEqual(errorEvent.message, 'Authentication failed. Check username and password.');
        });

        it('should map CONNECTION_TIMEOUT to user-friendly message', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Timeout',
                    code: ErrorCodes.CONNECTION_TIMEOUT,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            const errorEvent = events.find(e => e.status === 'error');
            assert.ok(errorEvent);
            assert.strictEqual(errorEvent.message, 'Connection timed out. Check host and port.');
        });

        it('should map CONNECTION_FAILED to user-friendly message', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Failed',
                    code: ErrorCodes.CONNECTION_FAILED,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            const errorEvent = events.find(e => e.status === 'error');
            assert.ok(errorEvent);
            assert.strictEqual(errorEvent.message, 'Connection failed. Check your settings.');
        });

        it('should use fallback message for unknown error codes', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Unknown',
                    code: 'SOME_UNKNOWN_CODE' as typeof ErrorCodes[keyof typeof ErrorCodes],
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            const errorEvent = events.find(e => e.status === 'error');
            assert.ok(errorEvent);
            assert.strictEqual(errorEvent.message, 'Connection failed. Check your settings.');
        });

        it('should set state to error on failure', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Error',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            assert.strictEqual(lifecycle.getState(), 'error');
            assert.strictEqual(lifecycle.getConnectedServer(), null);
        });

        it('should handle exception thrown by testConnection', async () => {
            // Override mock to throw
            AtelierApiService.prototype.testConnection = async function () {
                throw new Error('Unexpected network failure');
            };

            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            const errorEvent = events.find(e => e.status === 'error');
            assert.ok(errorEvent);
            assert.strictEqual(errorEvent.message, 'Connection failed. Check your settings.');
            assert.strictEqual(lifecycle.getState(), 'error');
        });
    });

    // ============================================
    // connect() - server not found and missing password (Task 6.8)
    // ============================================

    describe('connect() - server not found', () => {
        it('should emit error when server is not found', async () => {
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('nonexistent-server');

            assert.strictEqual(events.length, 1);
            assert.strictEqual(events[0].status, 'error');
            assert.strictEqual(events[0].serverName, 'nonexistent-server');
            assert.ok(events[0].message?.includes('not found'));
            assert.strictEqual(lifecycle.getState(), 'error');
        });

        it('should emit error when password is empty', async () => {
            connMgr.saveServer(createTestServerConfig({ encryptedPassword: '' }));
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            assert.strictEqual(events.length, 1);
            assert.strictEqual(events[0].status, 'error');
            assert.ok(events[0].message?.includes('Password'));
            assert.strictEqual(lifecycle.getState(), 'error');
        });

        it('should not call AtelierApiService when server not found', async () => {
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('nonexistent-server');

            assert.strictEqual(capturedCalls.length, 0);
        });

        it('should not call AtelierApiService when password missing', async () => {
            connMgr.saveServer(createTestServerConfig({ encryptedPassword: '' }));
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            assert.strictEqual(capturedCalls.length, 0);
        });
    });

    // ============================================
    // disconnect() (AC: 5)
    // ============================================

    describe('disconnect()', () => {
        it('should transition to disconnected state', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');
            lifecycle.disconnect();

            assert.strictEqual(lifecycle.getState(), 'disconnected');
        });

        it('should clear connected server name', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');
            lifecycle.disconnect();

            assert.strictEqual(lifecycle.getConnectedServer(), null);
        });

        it('should emit disconnected event', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');
            lifecycle.disconnect();

            const disconnectEvent = events.find(e => e.status === 'disconnected');
            assert.ok(disconnectEvent);
            assert.strictEqual(disconnectEvent.serverName, 'test-server');
        });

        it('should be a no-op when called from idle state', () => {
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            lifecycle.disconnect();

            assert.strictEqual(lifecycle.getState(), 'idle');
            assert.strictEqual(events.length, 0);
        });

        it('should be a no-op when called from error state', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Error',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');
            assert.strictEqual(lifecycle.getState(), 'error');
            const eventCountAfterError = events.length;

            lifecycle.disconnect();

            assert.strictEqual(lifecycle.getState(), 'error');
            assert.strictEqual(events.length, eventCountAfterError);
        });
    });

    // ============================================
    // cancelConnection() (AC: 2)
    // ============================================

    describe('cancelConnection()', () => {
        it('should be a no-op when not connecting', () => {
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            lifecycle.cancelConnection();

            assert.strictEqual(events.length, 0);
            assert.strictEqual(lifecycle.getState(), 'idle');
        });

        it('should emit cancelled event and abort controller during connection', async () => {
            // Use a delay to simulate async connection
            mockDelay = 50;
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            // Start connection but don't await — cancel immediately
            const connectPromise = lifecycle.connect('test-server');

            // Wait for connecting event
            await new Promise(resolve => setTimeout(resolve, 10));
            assert.strictEqual(lifecycle.isConnecting(), true);

            lifecycle.cancelConnection();

            // State should be disconnected after cancel
            assert.strictEqual(lifecycle.getState(), 'disconnected');
            assert.strictEqual(lifecycle.isConnecting(), false);

            // Should have cancelled event
            const cancelledEvent = events.find(e => e.status === 'cancelled');
            assert.ok(cancelledEvent);
            assert.strictEqual(cancelledEvent.serverName, 'test-server');

            // Wait for connect promise to resolve
            await connectPromise;
        });

        it('should abort the AbortController signal', async () => {
            mockDelay = 100;
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            const connectPromise = lifecycle.connect('test-server');

            await new Promise(resolve => setTimeout(resolve, 10));

            // Check that the signal was passed
            assert.ok(capturedCalls.length >= 1);
            const signal = capturedCalls[0].signal;
            assert.ok(signal);
            assert.strictEqual(signal.aborted, false);

            lifecycle.cancelConnection();

            // Signal should now be aborted
            assert.strictEqual(signal.aborted, true);

            await connectPromise;
        });

        it('should not emit cancelled when connected', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');
            assert.strictEqual(lifecycle.getState(), 'connected');

            lifecycle.cancelConnection();

            // Should still be connected — cancel is no-op
            assert.strictEqual(lifecycle.getState(), 'connected');
            const cancelEvents = events.filter(e => e.status === 'cancelled');
            assert.strictEqual(cancelEvents.length, 0);
        });
    });

    // ============================================
    // Server switching (AC: 6)
    // ============================================

    describe('server switching', () => {
        it('should disconnect server A before connecting server B', async () => {
            connMgr.saveServer(createTestServerConfig({ name: 'server-a' }));
            connMgr.saveServer(createTestServerConfig({ name: 'server-b' }));

            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            // Connect to server A
            await lifecycle.connect('server-a');
            assert.strictEqual(lifecycle.getConnectedServer(), 'server-a');

            // Connect to server B (should auto-disconnect A)
            await lifecycle.connect('server-b');

            // Verify disconnected A, then connected B
            const statuses = events.map(e => e.status);
            const disconnectIdx = statuses.lastIndexOf('disconnected');
            const connectBIdx = statuses.lastIndexOf('connected');
            assert.ok(disconnectIdx < connectBIdx, 'disconnect should come before connect to B');

            assert.strictEqual(lifecycle.getConnectedServer(), 'server-b');
        });

        it('should emit disconnect event for server A during switch', async () => {
            connMgr.saveServer(createTestServerConfig({ name: 'server-a' }));
            connMgr.saveServer(createTestServerConfig({ name: 'server-b' }));

            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('server-a');
            await lifecycle.connect('server-b');

            const disconnectEvents = events.filter(e => e.status === 'disconnected');
            assert.strictEqual(disconnectEvents.length, 1);
            assert.strictEqual(disconnectEvents[0].serverName, 'server-a');
        });

        it('should only have one server connected at a time', async () => {
            connMgr.saveServer(createTestServerConfig({ name: 'server-a' }));
            connMgr.saveServer(createTestServerConfig({ name: 'server-b' }));
            connMgr.saveServer(createTestServerConfig({ name: 'server-c' }));

            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('server-a');
            assert.strictEqual(lifecycle.getConnectedServer(), 'server-a');

            await lifecycle.connect('server-b');
            assert.strictEqual(lifecycle.getConnectedServer(), 'server-b');

            await lifecycle.connect('server-c');
            assert.strictEqual(lifecycle.getConnectedServer(), 'server-c');
        });
    });

    // ============================================
    // Edge cases (Task 6.5)
    // ============================================

    describe('edge cases', () => {
        it('should be a no-op when connecting to already-connected server', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');
            const eventCountAfterConnect = events.length;

            // Try connecting again to same server
            await lifecycle.connect('test-server');

            // Should not have emitted more events
            assert.strictEqual(events.length, eventCountAfterConnect);
            assert.strictEqual(lifecycle.getConnectedServer(), 'test-server');
            // Should not have made another API call
            assert.strictEqual(capturedCalls.length, 1);
        });

        it('should cancel previous connection when connecting while already connecting', async () => {
            mockDelay = 100;
            connMgr.saveServer(createTestServerConfig({ name: 'server-a' }));
            connMgr.saveServer(createTestServerConfig({ name: 'server-b' }));

            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            // Start connecting to A
            const connectA = lifecycle.connect('server-a');

            await new Promise(resolve => setTimeout(resolve, 10));
            assert.strictEqual(lifecycle.isConnecting(), true);

            // Start connecting to B while A is in progress
            mockDelay = 0; // B will complete immediately
            const connectB = lifecycle.connect('server-b');

            await Promise.all([connectA, connectB]);

            // Should have cancelled A
            const cancelledEvents = events.filter(e => e.status === 'cancelled');
            assert.strictEqual(cancelledEvents.length, 1);
            assert.strictEqual(cancelledEvents[0].serverName, 'server-a');

            // Should be connected to B
            assert.strictEqual(lifecycle.getConnectedServer(), 'server-b');
            assert.strictEqual(lifecycle.getState(), 'connected');
        });

        it('should handle rapid connect calls', async () => {
            connMgr.saveServer(createTestServerConfig({ name: 'server-a' }));
            connMgr.saveServer(createTestServerConfig({ name: 'server-b' }));
            connMgr.saveServer(createTestServerConfig({ name: 'server-c' }));

            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            // Rapid-fire connect calls (all synchronous completion)
            await lifecycle.connect('server-a');
            await lifecycle.connect('server-b');
            await lifecycle.connect('server-c');

            // Final state should be connected to C
            assert.strictEqual(lifecycle.getConnectedServer(), 'server-c');
            assert.strictEqual(lifecycle.getState(), 'connected');
        });

        it('should allow reconnection after error', async () => {
            connMgr.saveServer(createTestServerConfig());

            // First attempt fails
            mockResult = {
                success: false,
                error: {
                    message: 'Error',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');
            assert.strictEqual(lifecycle.getState(), 'error');

            // Second attempt succeeds
            mockResult = { success: true };
            await lifecycle.connect('test-server');

            assert.strictEqual(lifecycle.getState(), 'connected');
            assert.strictEqual(lifecycle.getConnectedServer(), 'test-server');
        });

        it('should allow reconnection after disconnect', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');
            lifecycle.disconnect();
            assert.strictEqual(lifecycle.getState(), 'disconnected');

            await lifecycle.connect('test-server');
            assert.strictEqual(lifecycle.getState(), 'connected');
            assert.strictEqual(lifecycle.getConnectedServer(), 'test-server');
        });
    });

    // ============================================
    // State getters (Task 6.7)
    // ============================================

    describe('state getters', () => {
        it('getState() returns idle initially', () => {
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);
            assert.strictEqual(lifecycle.getState(), 'idle');
        });

        it('getState() returns connecting during connection', async () => {
            mockDelay = 50;
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            const connectPromise = lifecycle.connect('test-server');
            await new Promise(resolve => setTimeout(resolve, 10));

            assert.strictEqual(lifecycle.getState(), 'connecting');

            lifecycle.cancelConnection();
            await connectPromise;
        });

        it('getState() returns connected after success', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');
            assert.strictEqual(lifecycle.getState(), 'connected');
        });

        it('getState() returns disconnected after disconnect', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');
            lifecycle.disconnect();
            assert.strictEqual(lifecycle.getState(), 'disconnected');
        });

        it('getState() returns error after failed connection', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Error',
                    code: ErrorCodes.CONNECTION_FAILED,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');
            assert.strictEqual(lifecycle.getState(), 'error');
        });

        it('getConnectedServer() returns server name when connected', async () => {
            connMgr.saveServer(createTestServerConfig({ name: 'my-iris' }));
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('my-iris');
            assert.strictEqual(lifecycle.getConnectedServer(), 'my-iris');
        });

        it('getConnectedServer() returns null when not connected', () => {
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);
            assert.strictEqual(lifecycle.getConnectedServer(), null);
        });

        it('isConnecting() returns true during connection', async () => {
            mockDelay = 50;
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            const connectPromise = lifecycle.connect('test-server');
            await new Promise(resolve => setTimeout(resolve, 10));

            assert.strictEqual(lifecycle.isConnecting(), true);

            lifecycle.cancelConnection();
            await connectPromise;
        });

        it('isConnecting() returns false when not connecting', async () => {
            connMgr.saveServer(createTestServerConfig());
            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            assert.strictEqual(lifecycle.isConnecting(), false);

            await lifecycle.connect('test-server');
            assert.strictEqual(lifecycle.isConnecting(), false);
        });
    });

    // ============================================
    // Network error / Connection lost (AC: 7)
    // ============================================

    describe('network error messages', () => {
        it('should include user-friendly message for SERVER_UNREACHABLE (connection lost)', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'ECONNREFUSED',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            connMgr.saveServer(createTestServerConfig());
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            const errorEvent = events.find(e => e.status === 'error');
            assert.ok(errorEvent);
            assert.ok(errorEvent.message);
            assert.ok(errorEvent.message.length > 0);
            assert.strictEqual(errorEvent.serverName, 'test-server');
        });

        it('should include server name in all error events', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Error',
                    code: ErrorCodes.AUTH_FAILED,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            connMgr.saveServer(createTestServerConfig({ name: 'prod-server' }));
            const { events, callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('prod-server');

            const errorEvent = events.find(e => e.status === 'error');
            assert.ok(errorEvent);
            assert.strictEqual(errorEvent.serverName, 'prod-server');
        });
    });

    // ============================================
    // Credential retrieval (Task 6.1)
    // ============================================

    describe('credential retrieval', () => {
        it('should get server config from ConnectionManager', async () => {
            connMgr.saveServer(createTestServerConfig({
                hostname: 'production.example.com',
                port: 443,
                ssl: true,
                username: 'produser',
            }));

            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            assert.strictEqual(capturedCalls[0].spec.host, 'production.example.com');
            assert.strictEqual(capturedCalls[0].spec.port, 443);
            assert.strictEqual(capturedCalls[0].username, 'produser');
        });

        it('should get decrypted password from ConnectionManager', async () => {
            connMgr.saveServer(createTestServerConfig({ encryptedPassword: 'mySecret123' }));

            const { callback } = createEventCollector();
            const lifecycle = new ConnectionLifecycleManager(connMgr, callback);

            await lifecycle.connect('test-server');

            // Without credential store, password is stored as-is
            assert.strictEqual(capturedCalls[0].password, 'mySecret123');
        });
    });

    // ============================================
    // Full state transition coverage (Task 7.5)
    // ============================================

    describe('full state transitions', () => {
        it('idle -> connecting -> connected -> disconnected', async () => {
            connMgr.saveServer(createTestServerConfig());
            const states: ConnectionState[] = [];
            const lifecycle = new ConnectionLifecycleManager(connMgr, () => {
                states.push(lifecycle.getState());
            });

            assert.strictEqual(lifecycle.getState(), 'idle');

            await lifecycle.connect('test-server');
            lifecycle.disconnect();

            assert.deepStrictEqual(states, ['connecting', 'connected', 'disconnected']);
        });

        it('idle -> connecting -> error', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Error',
                    code: ErrorCodes.CONNECTION_FAILED,
                    recoverable: true,
                    context: 'testConnection',
                },
            };
            connMgr.saveServer(createTestServerConfig());
            const states: ConnectionState[] = [];
            const lifecycle = new ConnectionLifecycleManager(connMgr, () => {
                states.push(lifecycle.getState());
            });

            await lifecycle.connect('test-server');

            assert.deepStrictEqual(states, ['connecting', 'error']);
        });

        it('idle -> error (server not found)', async () => {
            const states: ConnectionState[] = [];
            const lifecycle = new ConnectionLifecycleManager(connMgr, () => {
                states.push(lifecycle.getState());
            });

            await lifecycle.connect('nonexistent');

            assert.deepStrictEqual(states, ['error']);
        });

        it('error -> connecting -> connected (retry)', async () => {
            connMgr.saveServer(createTestServerConfig());

            mockResult = {
                success: false,
                error: {
                    message: 'Error',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'testConnection',
                },
            };

            const states: ConnectionState[] = [];
            const lifecycle = new ConnectionLifecycleManager(connMgr, () => {
                states.push(lifecycle.getState());
            });

            await lifecycle.connect('test-server');
            assert.strictEqual(lifecycle.getState(), 'error');

            // Now retry successfully
            mockResult = { success: true };
            states.length = 0;

            await lifecycle.connect('test-server');

            assert.deepStrictEqual(states, ['connecting', 'connected']);
        });
    });
});
