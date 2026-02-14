/**
 * Unit tests for API Proxy routes
 * Story 15.2: Atelier API Proxy - Task 6.1-6.6, 6.10-6.11
 *
 * Tests proxy query forwarding, session validation, error handling,
 * connect/disconnect endpoints. Uses dependency-injected fetch mock
 * so IRIS calls are intercepted without affecting real HTTP calls.
 * Uses Node.js built-in test runner.
 */
import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { SESSION_COOKIE_NAME } from '../server/sessionManager';
import { createAppServer } from '../server/server';
import type { SessionManager } from '../server/sessionManager';

let httpServer: Server;
let baseUrl: string;
let sessionManager: SessionManager;
let sessionToken: string;

/**
 * The mock IRIS fetch function. Tests reassign this to control proxy behavior.
 */
let mockIrisFetchImpl: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * The actual mock fetch passed to the server via dependency injection.
 * Delegates to mockIrisFetchImpl so tests can change behavior per-test.
 */
function mockIrisFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
    return mockIrisFetchImpl(url, init);
}

/**
 * Helper: create a mock IRIS JSON response
 */
function irisResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Start server with injected mock fetch for IRIS calls.
 */
async function startTestServer(): Promise<void> {
    // Default: return a successful IRIS response
    mockIrisFetchImpl = async () => irisResponse({ status: { errors: [] }, result: { content: [] } });

    const result = createAppServer({
        proxyOptions: { fetchFn: mockIrisFetch as typeof globalThis.fetch },
        skipSecurity: true,
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
}

async function stopTestServer(): Promise<void> {
    if (httpServer) {
        await new Promise<void>((resolve, reject) => {
            httpServer.close((err) => {
                if (err) { reject(err); } else { resolve(); }
            });
        });
    }
}

/**
 * Create a session directly via the session manager (avoids needing /api/connect).
 */
function createDirectSession(): string {
    return sessionManager.createSession({
        host: 'iris-test',
        port: 52773,
        namespace: 'USER',
        username: 'testuser',
        password: 'testpass',
        pathPrefix: '',
        useHTTPS: false,
    });
}

describe('API Proxy', () => {
    before(async () => {
        await startTestServer();
        sessionToken = createDirectSession();
    });

    after(async () => {
        await stopTestServer();
    });

    // ============================================
    // POST /api/iris/query - Proxy Tests (Task 6.2-6.6)
    // ============================================

    describe('POST /api/iris/query', () => {
        it('should return proxied response with valid session (Task 6.2)', async () => {
            const irisData = {
                status: { errors: [] },
                result: { content: [{ ID: 1, Name: 'Test' }] },
            };

            mockIrisFetchImpl = async () => irisResponse(irisData);

            const response = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                },
                body: JSON.stringify({
                    query: 'SELECT * FROM Sample.Person',
                    parameters: [],
                }),
            });

            assert.strictEqual(response.status, 200);
            const body = await response.json();
            assert.deepStrictEqual(body, irisData);
        });

        it('should forward query and parameters to IRIS', async () => {
            let capturedBody: string | undefined;

            mockIrisFetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
                capturedBody = init?.body as string;
                return irisResponse({ status: { errors: [] }, result: { content: [] } });
            };

            await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                },
                body: JSON.stringify({
                    query: 'SELECT * FROM Sample.Person WHERE Name = ?',
                    parameters: ['John'],
                }),
            });

            assert.ok(capturedBody, 'Should have captured request body');
            const parsed = JSON.parse(capturedBody!);
            assert.strictEqual(parsed.query, 'SELECT * FROM Sample.Person WHERE Name = ?');
            assert.deepStrictEqual(parsed.parameters, ['John']);
        });

        it('should inject Basic Auth header from session credentials', async () => {
            let capturedHeaders: Record<string, string> | undefined;

            mockIrisFetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
                capturedHeaders = init?.headers as Record<string, string>;
                return irisResponse({ status: { errors: [] }, result: { content: [] } });
            };

            await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });

            assert.ok(capturedHeaders, 'Should have captured headers');
            const expectedAuth = `Basic ${Buffer.from('testuser:testpass').toString('base64')}`;
            assert.strictEqual(capturedHeaders!['Authorization'], expectedAuth);
        });

        it('should build correct Atelier URL using UrlBuilder', async () => {
            let capturedUrl: string | undefined;

            mockIrisFetchImpl = async (url: string | URL | Request) => {
                capturedUrl = url.toString();
                return irisResponse({ status: { errors: [] }, result: { content: [] } });
            };

            await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });

            assert.ok(capturedUrl, 'Should have captured URL');
            assert.ok(capturedUrl!.includes('/api/atelier/'), 'URL should include Atelier path');
            assert.ok(capturedUrl!.includes('/v1/USER/action/query'), 'URL should include query endpoint');
        });

        it('should return 401 without session (Task 6.3)', async () => {
            const response = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });

            assert.strictEqual(response.status, 401);
            const body = await response.json() as { error: string };
            assert.strictEqual(body.error, 'Unauthorized');
        });

        it('should return 401 with expired/invalid session (Task 6.4)', async () => {
            const response = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=expired-token-12345`,
                },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });

            assert.strictEqual(response.status, 401);
        });

        it('should return 400 for missing query field', async () => {
            const response = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                },
                body: JSON.stringify({ parameters: [] }),
            });

            assert.strictEqual(response.status, 400);
        });

        it('should return 502 when IRIS is unreachable (Task 6.5)', async () => {
            mockIrisFetchImpl = async () => {
                const connError = new TypeError('fetch failed');
                (connError as NodeJS.ErrnoException).cause = { code: 'ECONNREFUSED' } as NodeJS.ErrnoException;
                throw connError;
            };

            const response = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });

            assert.strictEqual(response.status, 502);
            const body = await response.json() as { error: string; code: string };
            assert.ok(body.error, 'Should have error message');
            assert.ok(!body.error.includes('iris-test'), 'Should not leak IRIS host');
            assert.ok(!body.error.includes('52773'), 'Should not leak IRIS port');
            assert.strictEqual(body.code, 'SERVER_UNREACHABLE');
        });

        it('should return 504 when IRIS times out (Task 6.6)', async () => {
            mockIrisFetchImpl = async () => {
                throw new DOMException('The operation was aborted', 'AbortError');
            };

            const response = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });

            assert.strictEqual(response.status, 504);
            const body = await response.json() as { error: string; code: string };
            assert.ok(body.error, 'Should have error message');
            assert.strictEqual(body.code, 'CONNECTION_TIMEOUT');
        });

        it('should return 401 when IRIS returns 401 (auth failure)', async () => {
            mockIrisFetchImpl = async () => new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });

            assert.strictEqual(response.status, 401);
            const body = await response.json() as { error: string };
            assert.strictEqual(body.error, 'IRIS authentication failed');
        });
    });

    // ============================================
    // POST /api/connect (Task 6.10)
    // ============================================

    describe('POST /api/connect', () => {
        it('should create session on successful IRIS connection (Task 6.10)', async () => {
            mockIrisFetchImpl = async () => irisResponse({
                status: { errors: [] },
                result: { content: { api: 7, namespaces: ['USER'] } },
            });

            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'new-server',
                    port: 52773,
                    namespace: 'USER',
                    username: 'admin',
                    password: 'secret',
                }),
            });

            assert.strictEqual(response.status, 200);
            const body = await response.json() as { status: string; token?: string };
            assert.strictEqual(body.status, 'connected');
            assert.strictEqual(body.token, undefined, 'Token should not be in response body (HttpOnly cookie only)');

            // Verify Set-Cookie header
            const setCookie = response.headers.get('set-cookie') || '';
            assert.ok(setCookie.includes(SESSION_COOKIE_NAME), 'Should set session cookie');
            assert.ok(setCookie.includes('HttpOnly'), 'Cookie should be HttpOnly');
        });

        it('should return 400 for missing required fields', async () => {
            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host: 'server', port: 52773 }), // missing namespace, username, password
            });

            assert.strictEqual(response.status, 400);
        });

        it('should return 401 when IRIS auth fails during connect', async () => {
            mockIrisFetchImpl = async () => new Response('Unauthorized', { status: 401 });

            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'server',
                    port: 52773,
                    namespace: 'USER',
                    username: 'bad',
                    password: 'wrong',
                }),
            });

            assert.strictEqual(response.status, 401);
        });

        it('should return 502 when IRIS is unreachable during connect', async () => {
            mockIrisFetchImpl = async () => {
                const connError = new TypeError('fetch failed');
                (connError as NodeJS.ErrnoException).cause = { code: 'ECONNREFUSED' } as NodeJS.ErrnoException;
                throw connError;
            };

            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'unreachable',
                    port: 52773,
                    namespace: 'USER',
                    username: 'user',
                    password: 'pass',
                }),
            });

            assert.strictEqual(response.status, 502);
        });
    });

    // ============================================
    // POST /api/disconnect (Task 6.11)
    // ============================================

    describe('POST /api/disconnect', () => {
        it('should destroy session and return disconnected (Task 6.11)', async () => {
            // Create a dedicated session to disconnect
            const tempToken = sessionManager.createSession({
                host: 'test', port: 52773, namespace: 'USER',
                username: 'user', password: 'pass',
            });

            const response = await fetch(`${baseUrl}/api/disconnect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${tempToken}`,
                },
            });

            assert.strictEqual(response.status, 200);
            const body = await response.json() as { status: string };
            assert.strictEqual(body.status, 'disconnected');

            // Verify session is invalidated - query should return 401
            const queryRes = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${tempToken}`,
                },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });
            assert.strictEqual(queryRes.status, 401, 'Session should be invalidated after disconnect');
        });

        it('should return disconnected even without a session', async () => {
            const response = await fetch(`${baseUrl}/api/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            assert.strictEqual(response.status, 200);
            const body = await response.json() as { status: string };
            assert.strictEqual(body.status, 'disconnected');
        });
    });

    // ============================================
    // GET /api/session
    // ============================================

    describe('GET /api/session', () => {
        it('should return connected status with server info for valid session', async () => {
            const response = await fetch(`${baseUrl}/api/session`, {
                headers: {
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                },
            });

            assert.strictEqual(response.status, 200);
            const body = await response.json() as { status: string; server: Record<string, unknown> };
            assert.strictEqual(body.status, 'connected');
            assert.ok(body.server, 'Should include server info');
            assert.strictEqual(body.server.username, 'testuser');
            assert.strictEqual(body.server.namespace, 'USER');
            // Internal details must NOT be included
            assert.strictEqual(body.server.password, undefined, 'Password should not be in session response');
            assert.strictEqual(body.server.host, undefined, 'Host should not be leaked to browser');
            assert.strictEqual(body.server.port, undefined, 'Port should not be leaked to browser');
        });

        it('should return disconnected for no session', async () => {
            const response = await fetch(`${baseUrl}/api/session`);

            assert.strictEqual(response.status, 200);
            const body = await response.json() as { status: string };
            assert.strictEqual(body.status, 'disconnected');
        });
    });
});
