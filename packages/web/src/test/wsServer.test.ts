/**
 * Unit tests for WebSocket server
 * Story 15.3: WebSocket Server - Task 7.1-7.6
 *
 * Tests WebSocket connection authentication, command processing,
 * malformed message handling, and session expiry.
 * Uses ws client library to connect to the test server.
 * Uses Node.js built-in test runner.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'assert';
import { WebSocket } from 'ws';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { createAppServer } from '../server/server';
import type { SessionManager } from '../server/sessionManager';
import { SESSION_COOKIE_NAME } from '../server/sessionManager';
import type { ServiceFactory } from '../server/commandHandler';
import type { WebSocketServerHandle } from '../server/wsServer';
import { WS_CLOSE_SESSION_EXPIRED } from '../server/wsServer';

let httpServer: Server;
let wsUrl: string;
let sessionManager: SessionManager;
let wsHandle: WebSocketServerHandle;

/**
 * Mock service factory that returns controllable stubs.
 * Tests set mockServiceImpl to control command handler behavior.
 */
let mockGetNamespaces: () => Promise<{ success: boolean; namespaces?: string[]; error?: { message: string; code: string } }>;
let mockGetTables: () => Promise<{ success: boolean; tables?: string[]; error?: { message: string; code: string } }>;

function createMockServiceFactory(): ServiceFactory {
    return {
        createServices() {
            return {
                apiService: {} as never,
                queryExecutor: {
                    getTableData: async () => ({
                        success: true,
                        rows: [{ ID: 1, Name: 'Test' }],
                        totalRows: 1,
                    }),
                    updateCell: async () => ({ success: true, rowsAffected: 1 }),
                    insertRow: async () => ({ success: true }),
                    deleteRow: async () => ({ success: true }),
                } as never,
                metadataService: {
                    getNamespaces: () => mockGetNamespaces(),
                    getTables: () => mockGetTables(),
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
                } as never,
            };
        },
    };
}

/**
 * Helper: create a session and return its token
 */
function createTestSession(): string {
    return sessionManager.createSession({
        host: 'iris-test',
        port: 52773,
        namespace: 'USER',
        username: 'testuser',
        password: 'testpass',
    });
}

/**
 * Helper: connect a WebSocket with a session token
 */
function connectWs(token: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${wsUrl}?token=${token}`);
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
    });
}

/**
 * Helper: connect a WebSocket with a cookie header
 */
function connectWsWithCookie(token: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl, {
            headers: {
                'Cookie': `${SESSION_COOKIE_NAME}=${token}`,
            },
        });
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
    });
}

/**
 * Helper: wait for a WebSocket message and parse as JSON
 */
function waitForMessage(ws: WebSocket, timeout = 5000): Promise<{ event: string; payload: unknown }> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), timeout);
        ws.once('message', (data) => {
            clearTimeout(timer);
            resolve(JSON.parse(data.toString()));
        });
    });
}

/**
 * Helper: wait for WebSocket close event
 */
function waitForClose(ws: WebSocket, timeout = 5000): Promise<{ code: number; reason: string }> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for close')), timeout);
        ws.once('close', (code, reason) => {
            clearTimeout(timer);
            resolve({ code, reason: reason.toString() });
        });
    });
}

/**
 * Helper: send a command and get the response
 */
async function sendCommand(ws: WebSocket, command: string, payload: unknown = {}): Promise<{ event: string; payload: unknown }> {
    const messagePromise = waitForMessage(ws);
    ws.send(JSON.stringify({ command, payload }));
    return messagePromise;
}

async function startTestServer(): Promise<void> {
    // Default mock behaviors
    mockGetNamespaces = async () => ({ success: true, namespaces: ['USER', 'SAMPLES'] });
    mockGetTables = async () => ({ success: true, tables: ['Sample.Person', 'Sample.Company'] });

    const result = createAppServer({
        wsOptions: { serviceFactory: createMockServiceFactory() },
        skipSecurity: true,
    });

    httpServer = result.server;
    sessionManager = result.sessionManager;
    wsHandle = result.wsHandle;

    await new Promise<void>((resolve) => {
        httpServer.listen(0, () => {
            const address = httpServer.address() as AddressInfo;
            wsUrl = `ws://localhost:${address.port}`;
            resolve();
        });
    });
}

async function stopTestServer(): Promise<void> {
    // Close all WebSocket connections
    if (wsHandle) {
        wsHandle.wss.close();
    }
    if (httpServer) {
        await new Promise<void>((resolve, reject) => {
            httpServer.close((err) => {
                if (err) { reject(err); } else { resolve(); }
            });
        });
    }
}

describe('WebSocket Server', () => {
    before(async () => {
        await startTestServer();
    });

    after(async () => {
        await stopTestServer();
    });

    // ============================================
    // Connection Authentication (Task 7.2, 7.3)
    // ============================================

    describe('Connection authentication', () => {
        it('should accept WebSocket connection with valid session token in query param (Task 7.2)', async () => {
            const token = createTestSession();
            const ws = await connectWs(token);

            assert.strictEqual(ws.readyState, WebSocket.OPEN, 'WebSocket should be open');
            ws.close();
        });

        it('should accept WebSocket connection with valid session token in cookie (Task 7.2)', async () => {
            const token = createTestSession();
            const ws = await connectWsWithCookie(token);

            assert.strictEqual(ws.readyState, WebSocket.OPEN, 'WebSocket should be open');
            ws.close();
        });

        it('should reject WebSocket connection without session token (Task 7.3)', async () => {
            const result = await new Promise<{ rejected: boolean; statusCode?: number }>((resolve) => {
                const ws = new WebSocket(wsUrl);
                ws.on('unexpected-response', (_req, res) => {
                    resolve({ rejected: true, statusCode: res.statusCode });
                });
                ws.on('open', () => {
                    resolve({ rejected: false });
                    ws.close();
                });
                ws.on('error', () => {
                    // Suppress error event that follows unexpected-response
                });
            });

            assert.ok(result.rejected, 'Connection should be rejected');
            assert.strictEqual(result.statusCode, 401, 'Should reject with HTTP 401');
        });

        it('should reject WebSocket connection with invalid session token (Task 7.3)', async () => {
            const result = await new Promise<{ rejected: boolean; statusCode?: number }>((resolve) => {
                const ws = new WebSocket(`${wsUrl}?token=invalid-token-12345`);
                ws.on('unexpected-response', (_req, res) => {
                    resolve({ rejected: true, statusCode: res.statusCode });
                });
                ws.on('open', () => {
                    resolve({ rejected: false });
                    ws.close();
                });
                ws.on('error', () => {
                    // Suppress error event that follows unexpected-response
                });
            });

            assert.ok(result.rejected, 'Connection should be rejected');
            assert.strictEqual(result.statusCode, 401, 'Should reject with HTTP 401');
        });
    });

    // ============================================
    // Command Send/Receive (Task 7.4)
    // ============================================

    describe('Command processing', () => {
        let ws: WebSocket;
        let token: string;

        beforeEach(async () => {
            token = createTestSession();
            ws = await connectWs(token);
        });

        it('should process getNamespaces command and return namespaceList event (Task 7.4)', async () => {
            const response = await sendCommand(ws, 'getNamespaces');

            assert.strictEqual(response.event, 'namespaceList');
            const payload = response.payload as { namespaces: string[] };
            assert.ok(Array.isArray(payload.namespaces));
            assert.deepStrictEqual(payload.namespaces, ['USER', 'SAMPLES']);

            ws.close();
        });

        it('should process getTables command and return tableList event (Task 7.4)', async () => {
            const response = await sendCommand(ws, 'getTables', { namespace: 'USER' });

            assert.strictEqual(response.event, 'tableList');
            const payload = response.payload as { tables: string[]; namespace: string };
            assert.ok(Array.isArray(payload.tables));
            assert.strictEqual(payload.namespace, 'USER');

            ws.close();
        });

        it('should process selectTable command and return tableSelected event (Task 7.4)', async () => {
            const response = await sendCommand(ws, 'selectTable', {
                namespace: 'USER',
                tableName: 'Sample.Person',
            });

            assert.strictEqual(response.event, 'tableSelected');
            const payload = response.payload as { tableName: string; namespace: string; columns: unknown[] };
            assert.strictEqual(payload.tableName, 'Sample.Person');
            assert.strictEqual(payload.namespace, 'USER');
            assert.ok(Array.isArray(payload.columns));

            ws.close();
        });

        it('should handle multiple sequential commands on same connection', async () => {
            // getNamespaces
            const nsResponse = await sendCommand(ws, 'getNamespaces');
            assert.strictEqual(nsResponse.event, 'namespaceList');

            // getTables
            const tablesResponse = await sendCommand(ws, 'getTables', { namespace: 'USER' });
            assert.strictEqual(tablesResponse.event, 'tableList');

            ws.close();
        });
    });

    // ============================================
    // Malformed Message Handling (Task 7.5)
    // ============================================

    describe('Malformed message handling', () => {
        it('should return error event for malformed JSON (Task 7.5)', async () => {
            const token = createTestSession();
            const ws = await connectWs(token);

            const messagePromise = waitForMessage(ws);
            ws.send('not valid json{{{');
            const response = await messagePromise;

            assert.strictEqual(response.event, 'error');
            const payload = response.payload as { code: string };
            assert.strictEqual(payload.code, 'INVALID_JSON');

            ws.close();
        });

        it('should return error event for message without command field', async () => {
            const token = createTestSession();
            const ws = await connectWs(token);

            const messagePromise = waitForMessage(ws);
            ws.send(JSON.stringify({ payload: {} }));
            const response = await messagePromise;

            assert.strictEqual(response.event, 'error');
            const payload = response.payload as { code: string };
            assert.strictEqual(payload.code, 'INVALID_MESSAGE');

            ws.close();
        });
    });

    // ============================================
    // Unknown Command (Task 7.6)
    // ============================================

    describe('Unknown command handling', () => {
        it('should return error event for unknown command (Task 7.6)', async () => {
            const token = createTestSession();
            const ws = await connectWs(token);

            const response = await sendCommand(ws, 'unknownCommand', {});

            assert.strictEqual(response.event, 'error');
            const payload = response.payload as { message: string; code: string };
            assert.ok(payload.message.includes('Unknown command'));
            assert.strictEqual(payload.code, 'UNKNOWN_COMMAND');

            ws.close();
        });
    });

    // ============================================
    // Session Expiry (AC: 5)
    // ============================================

    describe('Session expiry notification', () => {
        it('should send sessionExpired event and close with 4002 when session is destroyed', async () => {
            const token = createTestSession();
            const ws = await connectWs(token);

            const messagePromise = waitForMessage(ws);
            const closePromise = waitForClose(ws);

            // Destroy session and notify
            sessionManager.destroySession(token);
            wsHandle.notifySessionExpired(token);

            const message = await messagePromise;
            assert.strictEqual(message.event, 'sessionExpired');

            const { code } = await closePromise;
            assert.strictEqual(code, WS_CLOSE_SESSION_EXPIRED);
        });
    });

    // ============================================
    // Connection Count / Cleanup (AC: 6)
    // ============================================

    describe('Connection cleanup', () => {
        it('should track active connections', async () => {
            const initialCount = wsHandle.getConnectionCount();

            const token = createTestSession();
            const ws = await connectWs(token);

            assert.strictEqual(wsHandle.getConnectionCount(), initialCount + 1);

            ws.close();
            // Wait a bit for close to process
            await new Promise(resolve => setTimeout(resolve, 100));

            assert.strictEqual(wsHandle.getConnectionCount(), initialCount);
        });

        it('should allow reconnection after disconnect', async () => {
            const token = createTestSession();

            // First connection
            const ws1 = await connectWs(token);
            assert.strictEqual(ws1.readyState, WebSocket.OPEN);
            ws1.close();
            await new Promise(resolve => setTimeout(resolve, 100));

            // Second connection with same token
            const ws2 = await connectWs(token);
            assert.strictEqual(ws2.readyState, WebSocket.OPEN);

            // Verify it still works
            const response = await sendCommand(ws2, 'getNamespaces');
            assert.strictEqual(response.event, 'namespaceList');

            ws2.close();
        });
    });
});
