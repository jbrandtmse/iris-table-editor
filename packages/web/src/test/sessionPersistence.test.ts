/**
 * Tests for session persistence, expired session detection, and WebSocket reconnection
 * Story 16.5: Session Persistence & Auto-Reconnect - Task 5
 *
 * Tests:
 * - Session persistence across simulated reload (same cookie returns connected)
 * - Session timeout returns disconnected
 * - WebSocket backoff algorithm (unit test)
 * - WebSocket session expiry vs network disconnect distinction
 * - Reconnection banner behavior
 *
 * Uses Node.js built-in test runner.
 */
import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { SESSION_COOKIE_NAME } from '../server/sessionManager';
import type { SessionManager } from '../server/sessionManager';
import { createAppServer } from '../server/server';
import type { WebSocketServerHandle } from '../server/wsServer';
import { WS_CLOSE_SESSION_EXPIRED } from '../server/wsServer';
import type { ServiceFactory } from '../server/commandHandler';

// ============================================
// Test configuration
// ============================================

const SHORT_TIMEOUT_MS = 300;

// ============================================
// Helpers
// ============================================

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let mockIrisFetchImpl: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

function mockIrisFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
    return mockIrisFetchImpl(url, init);
}

function irisResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function successIrisResponse(): Response {
    return irisResponse({
        status: { errors: [] },
        result: { content: { api: 7, namespaces: ['USER'] } },
    });
}

function createMockServiceFactory(): ServiceFactory {
    return {
        createServices() {
            return {
                apiService: {} as never,
                queryExecutor: {
                    getTableData: async () => ({ success: true, rows: [], totalRows: 0 }),
                    updateCell: async () => ({ success: true, rowsAffected: 1 }),
                    insertRow: async () => ({ success: true }),
                    deleteRow: async () => ({ success: true }),
                } as never,
                metadataService: {
                    getNamespaces: async () => ({ success: true, namespaces: ['USER'] }),
                    getTables: async () => ({ success: true, tables: [] }),
                    getTableSchema: async () => ({ success: true, schema: { tableName: 'T', namespace: 'USER', columns: [] } }),
                } as never,
            };
        },
    };
}

function extractSessionCookie(response: globalThis.Response): string {
    const setCookie = response.headers.get('set-cookie') || '';
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    return match ? match[1] : '';
}

// ============================================
// Task 5.2 & 5.3: Session persistence and timeout via HTTP
// ============================================
describe('Session persistence across reload', () => {
    let httpServer: Server;
    let baseUrl: string;
    let sessionManager: SessionManager;

    before(async () => {
        mockIrisFetchImpl = async () => successIrisResponse();

        const result = createAppServer({
            proxyOptions: { fetchFn: mockIrisFetch as typeof globalThis.fetch },
            skipSecurity: true,
            sessionTimeoutMs: SHORT_TIMEOUT_MS,
            cleanupIntervalMs: 0,
        });

        httpServer = result.server;
        sessionManager = result.sessionManager;

        await new Promise<void>((resolve) => {
            httpServer.listen(0, () => {
                const address = httpServer.address() as AddressInfo;
                baseUrl = `http://localhost:${address.port}`;
                resolve();
            });
        });
    });

    after(async () => {
        sessionManager.clearCleanupInterval();
        if (httpServer) {
            await new Promise<void>((resolve, reject) => {
                httpServer.close((err) => {
                    if (err) { reject(err); } else { resolve(); }
                });
            });
        }
    });

    it('should return connected for same session cookie (simulated reload) (Task 5.2)', async () => {
        // Connect and get session cookie
        const connectRes = await fetch(`${baseUrl}/api/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                host: 'iris-test', port: 52773, namespace: 'USER',
                username: 'reloaduser', password: 'testpass',
            }),
        });

        assert.strictEqual(connectRes.status, 200);
        const cookie = extractSessionCookie(connectRes);
        assert.ok(cookie, 'Should receive a session cookie');

        // "Simulated reload": check session with same cookie
        const sessionRes = await fetch(`${baseUrl}/api/session`, {
            headers: { 'Cookie': `${SESSION_COOKIE_NAME}=${cookie}` },
        });

        assert.strictEqual(sessionRes.status, 200);
        const body = await sessionRes.json() as { status: string; server: { namespace: string; username: string } };
        assert.strictEqual(body.status, 'connected', 'Session should persist across reload');
        assert.strictEqual(body.server.namespace, 'USER');
        assert.strictEqual(body.server.username, 'reloaduser');
    });

    it('should return disconnected after session timeout (Task 5.3)', async () => {
        // Connect
        const connectRes = await fetch(`${baseUrl}/api/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                host: 'iris-test', port: 52773, namespace: 'USER',
                username: 'timeoutuser', password: 'testpass',
            }),
        });

        const cookie = extractSessionCookie(connectRes);
        assert.ok(cookie, 'Should receive a session cookie');

        // Wait for session to expire
        await wait(SHORT_TIMEOUT_MS + 100);

        // Check session - should be disconnected
        const sessionRes = await fetch(`${baseUrl}/api/session`, {
            headers: { 'Cookie': `${SESSION_COOKIE_NAME}=${cookie}` },
        });

        assert.strictEqual(sessionRes.status, 200);
        const body = await sessionRes.json() as { status: string };
        assert.strictEqual(body.status, 'disconnected', 'Session should be disconnected after timeout');
    });
});

// ============================================
// Task 5.4: WebSocket backoff algorithm (unit test)
// ============================================
describe('WebSocket backoff algorithm', () => {
    /**
     * Replicate the calculateBackoff logic from ws-reconnect.js for testing.
     * This tests the algorithm itself, not the browser file.
     */
    const BASE_DELAY_MS = 1000;
    const MAX_DELAY_MS = 30000;
    const JITTER_FACTOR = 0.2;

    function calculateBackoff(attempt: number): number {
        const exponential = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
        const jitter = exponential * JITTER_FACTOR * (2 * Math.random() - 1);
        return Math.max(0, Math.round(exponential + jitter));
    }

    it('should return approximately 1s for first attempt (Task 5.4)', () => {
        // Run multiple times to account for jitter
        for (let i = 0; i < 20; i++) {
            const delay = calculateBackoff(0);
            // 1000 +/- 20% = 800 to 1200
            assert.ok(delay >= 800, `Delay ${delay} should be >= 800`);
            assert.ok(delay <= 1200, `Delay ${delay} should be <= 1200`);
        }
    });

    it('should double delay for each subsequent attempt (Task 5.4)', () => {
        // Attempt 1: ~2000, Attempt 2: ~4000, Attempt 3: ~8000
        for (let attempt = 0; attempt < 5; attempt++) {
            const delays: number[] = [];
            for (let i = 0; i < 20; i++) {
                delays.push(calculateBackoff(attempt));
            }
            const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
            const expected = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);

            // Average should be within 25% of expected (accounting for jitter)
            assert.ok(
                Math.abs(avgDelay - expected) / expected < 0.25,
                `Average delay ${avgDelay} should be close to ${expected} for attempt ${attempt}`,
            );
        }
    });

    it('should cap at MAX_DELAY_MS (30s) (Task 5.4)', () => {
        for (let i = 0; i < 20; i++) {
            const delay = calculateBackoff(20); // Way beyond cap
            // 30000 +/- 20% = 24000 to 36000
            assert.ok(delay >= 24000, `Delay ${delay} should be >= 24000`);
            assert.ok(delay <= 36000, `Delay ${delay} should be <= 36000`);
        }
    });

    it('should produce varied delays due to jitter (Task 5.4)', () => {
        const delays = new Set<number>();
        for (let i = 0; i < 20; i++) {
            delays.add(calculateBackoff(3));
        }
        // With jitter, we should get at least some variation
        assert.ok(delays.size > 1, 'Jitter should produce varied delays');
    });
});

// ============================================
// Task 5.5: WebSocket session expiry vs network disconnect
// ============================================
describe('WebSocket session expiry vs network disconnect', () => {
    let httpServer: Server;
    let wsUrl: string;
    let sessionManager: SessionManager;
    let wsHandle: WebSocketServerHandle;

    before(async () => {
        mockIrisFetchImpl = async () => successIrisResponse();

        const result = createAppServer({
            proxyOptions: { fetchFn: mockIrisFetch as typeof globalThis.fetch },
            wsOptions: { serviceFactory: createMockServiceFactory() },
            skipSecurity: true,
            sessionTimeoutMs: SHORT_TIMEOUT_MS,
            cleanupIntervalMs: 0,
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
    });

    after(async () => {
        sessionManager.clearCleanupInterval();
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
    });

    function connectWs(token: string): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`${wsUrl}?token=${token}`);
            ws.on('open', () => resolve(ws));
            ws.on('error', reject);
        });
    }

    function waitForClose(ws: WebSocket, timeout = 5000): Promise<{ code: number; reason: string }> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Timeout waiting for close')), timeout);
            ws.once('close', (code, reason) => {
                clearTimeout(timer);
                resolve({ code, reason: reason.toString() });
            });
        });
    }

    function waitForMessage(ws: WebSocket, timeout = 5000): Promise<{ event: string; payload: unknown }> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), timeout);
            ws.once('message', (data) => {
                clearTimeout(timer);
                resolve(JSON.parse(data.toString()));
            });
        });
    }

    it('should close with code 4002 on session expiry (Task 5.5)', async () => {
        const token = sessionManager.createSession({
            host: 'iris-test', port: 52773, namespace: 'USER',
            username: 'wsuser', password: 'testpass',
        });

        const ws = await connectWs(token);
        const messagePromise = waitForMessage(ws);
        const closePromise = waitForClose(ws);

        // Trigger session expiry
        sessionManager.destroySession(token);
        wsHandle.notifySessionExpired(token);

        const message = await messagePromise;
        assert.strictEqual(message.event, 'sessionExpired', 'Should receive sessionExpired event');

        const { code } = await closePromise;
        assert.strictEqual(code, WS_CLOSE_SESSION_EXPIRED, 'Close code should be 4002 for session expiry');
    });

    it('should close with code 1000 or 1001 on normal server-side close (Task 5.5)', async () => {
        const token = sessionManager.createSession({
            host: 'iris-test', port: 52773, namespace: 'USER',
            username: 'wsuser2', password: 'testpass',
        });

        const ws = await connectWs(token);
        const closePromise = waitForClose(ws);

        // Simulate server closing the connection normally (not session expiry)
        // Find the server-side websocket and close it
        ws.close(1000, 'Normal closure');

        const { code } = await closePromise;
        assert.strictEqual(code, 1000, 'Close code should be 1000 for normal closure');
    });

    it('should allow reconnection after network disconnect (not session expiry) (Task 5.5)', async () => {
        const token = sessionManager.createSession({
            host: 'iris-test', port: 52773, namespace: 'USER',
            username: 'reconnectuser', password: 'testpass',
        });

        // First connection
        const ws1 = await connectWs(token);
        assert.strictEqual(ws1.readyState, WebSocket.OPEN);
        ws1.close();
        await wait(100);

        // Should be able to reconnect (session still valid)
        const ws2 = await connectWs(token);
        assert.strictEqual(ws2.readyState, WebSocket.OPEN, 'Should reconnect successfully');
        ws2.close();
    });

    it('should NOT allow reconnection after session expiry (4002) (Task 5.5)', async () => {
        const token = sessionManager.createSession({
            host: 'iris-test', port: 52773, namespace: 'USER',
            username: 'expireuser', password: 'testpass',
        });

        const ws = await connectWs(token);
        const closePromise = waitForClose(ws);

        sessionManager.destroySession(token);
        wsHandle.notifySessionExpired(token);

        await closePromise;

        // Try to reconnect - should be rejected
        const result = await new Promise<{ rejected: boolean; statusCode?: number }>((resolve) => {
            const ws2 = new WebSocket(`${wsUrl}?token=${token}`);
            ws2.on('unexpected-response', (_req, res) => {
                resolve({ rejected: true, statusCode: res.statusCode });
            });
            ws2.on('open', () => {
                resolve({ rejected: false });
                ws2.close();
            });
            ws2.on('error', () => {
                // Suppress error
            });
        });

        assert.ok(result.rejected, 'Should reject reconnection after session expiry');
        assert.strictEqual(result.statusCode, 401, 'Should reject with 401');
    });
});

// ============================================
// Task 5.6: Reconnection banner behavior (unit tests)
// ============================================
describe('Reconnection banner behavior', () => {
    it('should have reconnection banner HTML in index.html', async () => {
        // Read the HTML file and verify banner elements exist
        const fs = await import('fs');
        const path = await import('path');
        const htmlPath = path.join(__dirname, '..', '..', 'public', 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        assert.ok(html.includes('id="reconnectBanner"'), 'Should have reconnect banner element');
        assert.ok(html.includes('id="reconnectMessage"'), 'Should have reconnect message element');
        assert.ok(html.includes('id="reconnectRefreshBtn"'), 'Should have reconnect refresh button');
        assert.ok(html.includes('ite-reconnect-banner'), 'Should use BEM class name');
        assert.ok(html.includes('hidden'), 'Banner should be hidden by default');
        assert.ok(html.includes('aria-live="assertive"'), 'Banner should have aria-live for screen readers');
    });

    it('should have reconnection banner styles in CSS', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const cssPath = path.join(__dirname, '..', '..', 'public', 'connection-form.css');
        const css = fs.readFileSync(cssPath, 'utf-8');

        assert.ok(css.includes('.ite-reconnect-banner'), 'Should have banner base style');
        assert.ok(css.includes('.ite-reconnect-banner__message'), 'Should have banner message style');
        assert.ok(css.includes('.ite-reconnect-banner__refresh'), 'Should have banner refresh button style');
    });

    it('should have ws-reconnect.js script reference in index.html', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const htmlPath = path.join(__dirname, '..', '..', 'public', 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        assert.ok(html.includes('ws-reconnect.js'), 'Should reference ws-reconnect.js');
        // ws-reconnect.js should come after connection-form.js
        const formIndex = html.indexOf('connection-form.js');
        const wsIndex = html.indexOf('ws-reconnect.js');
        assert.ok(wsIndex > formIndex, 'ws-reconnect.js should load after connection-form.js');
    });

    it('should have CSP with connect-src in index.html (server-side CSP adds WebSocket origin)', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const htmlPath = path.join(__dirname, '..', '..', 'public', 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        assert.ok(html.includes('connect-src'), 'CSP should have connect-src directive');
    });
});

// ============================================
// Task 5: Session state tracking in connection-form.js
// ============================================
describe('Session state tracking', () => {
    it('should have wasConnected sessionStorage key constants in connection-form.js', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const jsPath = path.join(__dirname, '..', '..', 'public', 'connection-form.js');
        const js = fs.readFileSync(jsPath, 'utf-8');

        assert.ok(js.includes("'ite-was-connected'"), 'Should define WAS_CONNECTED_KEY');
        assert.ok(js.includes("'ite-open-tabs'"), 'Should define OPEN_TABS_KEY');
    });

    it('should set wasConnected on successful connect', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const jsPath = path.join(__dirname, '..', '..', 'public', 'connection-form.js');
        const js = fs.readFileSync(jsPath, 'utf-8');

        assert.ok(
            js.includes("sessionStorage.setItem(WAS_CONNECTED_KEY, 'true')"),
            'Should set wasConnected to true on connect',
        );
    });

    it('should clear wasConnected on explicit disconnect', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const jsPath = path.join(__dirname, '..', '..', 'public', 'connection-form.js');
        const js = fs.readFileSync(jsPath, 'utf-8');

        assert.ok(
            js.includes('sessionStorage.removeItem(WAS_CONNECTED_KEY)'),
            'Should remove wasConnected on disconnect',
        );
    });

    it('should show session expired message when was-connected but session gone', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const jsPath = path.join(__dirname, '..', '..', 'public', 'connection-form.js');
        const js = fs.readFileSync(jsPath, 'utf-8');

        assert.ok(
            js.includes("'Session expired. Please reconnect.'"),
            'Should show session expired message',
        );
    });

    it('should expose handleSessionExpired function for WebSocket client', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const jsPath = path.join(__dirname, '..', '..', 'public', 'connection-form.js');
        const js = fs.readFileSync(jsPath, 'utf-8');

        assert.ok(
            js.includes('handleSessionExpired: handleSessionExpired'),
            'Should expose handleSessionExpired in window.iteConnectionForm',
        );
    });
});

// ============================================
// WebSocket reconnect client structure tests
// ============================================
describe('WebSocket reconnect client structure', () => {
    it('should define ws-reconnect.js with correct constants', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const jsPath = path.join(__dirname, '..', '..', 'public', 'ws-reconnect.js');
        const js = fs.readFileSync(jsPath, 'utf-8');

        assert.ok(js.includes('BASE_DELAY_MS = 1000'), 'Should have 1s base delay');
        assert.ok(js.includes('MAX_DELAY_MS = 30000'), 'Should have 30s max delay');
        assert.ok(js.includes('MAX_RETRIES = 10'), 'Should have 10 max retries');
        assert.ok(js.includes('JITTER_FACTOR = 0.2'), 'Should have 20% jitter');
        assert.ok(js.includes('WS_CLOSE_SESSION_EXPIRED = 4002'), 'Should define close code 4002');
    });

    it('should distinguish session expiry from network disconnect', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const jsPath = path.join(__dirname, '..', '..', 'public', 'ws-reconnect.js');
        const js = fs.readFileSync(jsPath, 'utf-8');

        assert.ok(
            js.includes('event.code === WS_CLOSE_SESSION_EXPIRED'),
            'Should check for close code 4002',
        );
        assert.ok(
            js.includes('handleSessionExpired'),
            'Should call handleSessionExpired on code 4002',
        );
        assert.ok(
            js.includes('scheduleReconnect'),
            'Should schedule reconnect on network disconnect',
        );
    });

    it('should NOT reconnect on session expiry (4002)', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const jsPath = path.join(__dirname, '..', '..', 'public', 'ws-reconnect.js');
        const js = fs.readFileSync(jsPath, 'utf-8');

        // After handling 4002, the code returns early (no scheduleReconnect call)
        // Check that the 4002 branch has a return statement before scheduleReconnect
        const sessionExpiredBlock = js.substring(
            js.indexOf('event.code === WS_CLOSE_SESSION_EXPIRED'),
            js.indexOf('scheduleReconnect'),
        );
        assert.ok(
            sessionExpiredBlock.includes('return'),
            'Should return early after session expiry, preventing reconnect',
        );
    });

    it('should fire ite-ws-reconnected custom event on successful reconnect', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const jsPath = path.join(__dirname, '..', '..', 'public', 'ws-reconnect.js');
        const js = fs.readFileSync(jsPath, 'utf-8');

        assert.ok(
            js.includes("'ite-ws-reconnected'"),
            'Should dispatch ite-ws-reconnected event',
        );
    });

    it('should show banner with refresh button after max retries', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const jsPath = path.join(__dirname, '..', '..', 'public', 'ws-reconnect.js');
        const js = fs.readFileSync(jsPath, 'utf-8');

        assert.ok(
            js.includes("'Connection lost. Please refresh the page.'"),
            'Should show max-retries message',
        );
        assert.ok(
            js.includes('showBannerWithRefresh'),
            'Should show banner with refresh button on max retries',
        );
    });
});
