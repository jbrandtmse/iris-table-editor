/**
 * Integration tests for Multi-Connection Support
 * Story 16.4: Multi-Connection Support - Task 5
 *
 * Tests connect → disconnect → reconnect flows, session replacement,
 * and connection header population via /api/session.
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

/**
 * The mock IRIS fetch function. Tests reassign this to control proxy behavior.
 */
let mockIrisFetchImpl: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * The actual mock fetch passed to the server via dependency injection.
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
 * Helper: successful IRIS base API response
 */
function successIrisResponse(): Response {
    return irisResponse({
        status: { errors: [] },
        result: { content: { api: 7, namespaces: ['USER'] } },
    });
}

/**
 * Helper: POST /api/connect with given credentials
 */
function connectToServer(
    url: string,
    details: { host: string; port: number; namespace: string; username: string; password: string },
    cookie?: string,
): Promise<globalThis.Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cookie) {
        headers['Cookie'] = cookie;
    }
    return fetch(`${url}/api/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify(details),
    });
}

/**
 * Extract session cookie value from a response's Set-Cookie header.
 */
function extractSessionCookie(response: globalThis.Response): string {
    const setCookie = response.headers.get('set-cookie') || '';
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    return match ? match[1] : '';
}

async function startTestServer(): Promise<void> {
    mockIrisFetchImpl = async () => successIrisResponse();

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

describe('Multi-Connection Support (Story 16.4)', () => {
    before(async () => {
        await startTestServer();
    });

    after(async () => {
        await stopTestServer();
    });

    // ============================================
    // Task 5.2: Connect → Disconnect → Reconnect
    // ============================================

    describe('Connect → Disconnect → Reconnect flow', () => {
        it('should connect, disconnect, and reconnect to a different server (Task 5.2)', async () => {
            mockIrisFetchImpl = async () => successIrisResponse();

            // Step 1: Connect to server A
            const connectA = await connectToServer(baseUrl, {
                host: 'server-a',
                port: 52773,
                namespace: 'USER',
                username: 'admin',
                password: 'passA',
            });
            assert.strictEqual(connectA.status, 200);
            const bodyA = await connectA.json() as { status: string };
            assert.strictEqual(bodyA.status, 'connected');
            const cookieA = `${SESSION_COOKIE_NAME}=${extractSessionCookie(connectA)}`;

            // Verify session A is active
            const sessionA = await fetch(`${baseUrl}/api/session`, {
                headers: { 'Cookie': cookieA },
            });
            const sessionABody = await sessionA.json() as { status: string; server: { namespace: string; username: string } };
            assert.strictEqual(sessionABody.status, 'connected');
            assert.strictEqual(sessionABody.server.username, 'admin');

            // Step 2: Disconnect
            const disconnectRes = await fetch(`${baseUrl}/api/disconnect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': cookieA,
                },
            });
            assert.strictEqual(disconnectRes.status, 200);
            const disconnectBody = await disconnectRes.json() as { status: string };
            assert.strictEqual(disconnectBody.status, 'disconnected');

            // Verify session A is destroyed
            const sessionAAfter = await fetch(`${baseUrl}/api/session`, {
                headers: { 'Cookie': cookieA },
            });
            const sessionAAfterBody = await sessionAAfter.json() as { status: string };
            assert.strictEqual(sessionAAfterBody.status, 'disconnected');

            // Step 3: Connect to server B
            const connectB = await connectToServer(baseUrl, {
                host: 'server-b',
                port: 52774,
                namespace: 'PROD',
                username: 'operator',
                password: 'passB',
            });
            assert.strictEqual(connectB.status, 200);
            const bodyB = await connectB.json() as { status: string };
            assert.strictEqual(bodyB.status, 'connected');
            const cookieB = `${SESSION_COOKIE_NAME}=${extractSessionCookie(connectB)}`;

            // Verify session B is active with new context
            const sessionB = await fetch(`${baseUrl}/api/session`, {
                headers: { 'Cookie': cookieB },
            });
            const sessionBBody = await sessionB.json() as { status: string; server: { namespace: string; username: string } };
            assert.strictEqual(sessionBBody.status, 'connected');
            assert.strictEqual(sessionBBody.server.username, 'operator');
            assert.strictEqual(sessionBBody.server.namespace, 'PROD');
        });
    });

    // ============================================
    // Task 5.3: /api/session returns new context after reconnection
    // ============================================

    describe('GET /api/session after reconnection', () => {
        it('should return new server context after reconnection (Task 5.3)', async () => {
            mockIrisFetchImpl = async () => successIrisResponse();

            // Connect to first server
            const connect1 = await connectToServer(baseUrl, {
                host: 'host1',
                port: 52773,
                namespace: 'DEV',
                username: 'dev-user',
                password: 'pass1',
            });
            const cookie1 = `${SESSION_COOKIE_NAME}=${extractSessionCookie(connect1)}`;

            // Verify first connection
            const session1 = await fetch(`${baseUrl}/api/session`, {
                headers: { 'Cookie': cookie1 },
            });
            const body1 = await session1.json() as { status: string; server: { namespace: string; username: string } };
            assert.strictEqual(body1.server.namespace, 'DEV');
            assert.strictEqual(body1.server.username, 'dev-user');

            // Disconnect
            await fetch(`${baseUrl}/api/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cookie': cookie1 },
            });

            // Connect to second server
            const connect2 = await connectToServer(baseUrl, {
                host: 'host2',
                port: 52774,
                namespace: 'STAGING',
                username: 'stage-user',
                password: 'pass2',
            });
            const cookie2 = `${SESSION_COOKIE_NAME}=${extractSessionCookie(connect2)}`;

            // Verify second connection
            const session2 = await fetch(`${baseUrl}/api/session`, {
                headers: { 'Cookie': cookie2 },
            });
            const body2 = await session2.json() as { status: string; server: { namespace: string; username: string } };
            assert.strictEqual(body2.server.namespace, 'STAGING');
            assert.strictEqual(body2.server.username, 'stage-user');
        });
    });

    // ============================================
    // Task 5.4: Disconnect destroys the old session
    // ============================================

    describe('Disconnect destroys old session', () => {
        it('should return disconnected after session is destroyed (Task 5.4)', async () => {
            mockIrisFetchImpl = async () => successIrisResponse();

            const connectRes = await connectToServer(baseUrl, {
                host: 'ephemeral',
                port: 52773,
                namespace: 'USER',
                username: 'temp',
                password: 'secret',
            });
            const cookie = `${SESSION_COOKIE_NAME}=${extractSessionCookie(connectRes)}`;

            // Verify connected
            const before = await fetch(`${baseUrl}/api/session`, {
                headers: { 'Cookie': cookie },
            });
            const beforeBody = await before.json() as { status: string };
            assert.strictEqual(beforeBody.status, 'connected');

            // Disconnect
            await fetch(`${baseUrl}/api/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
            });

            // Verify destroyed
            const afterRes = await fetch(`${baseUrl}/api/session`, {
                headers: { 'Cookie': cookie },
            });
            const afterBody = await afterRes.json() as { status: string };
            assert.strictEqual(afterBody.status, 'disconnected');

            // Also verify query fails
            const queryRes = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });
            assert.strictEqual(queryRes.status, 401);
        });
    });

    // ============================================
    // Task 5.5: Connecting while already connected replaces session
    // ============================================

    describe('Session replacement on reconnect', () => {
        it('should replace old session when connecting with existing cookie (Task 5.5)', async () => {
            mockIrisFetchImpl = async () => successIrisResponse();

            // Connect to server A
            const connectA = await connectToServer(baseUrl, {
                host: 'replace-a',
                port: 52773,
                namespace: 'USER',
                username: 'userA',
                password: 'passA',
            });
            const tokenA = extractSessionCookie(connectA);
            const cookieA = `${SESSION_COOKIE_NAME}=${tokenA}`;

            const sessionCountBefore = sessionManager.getSessionCount();

            // Connect to server B, passing the old session cookie
            const connectB = await connectToServer(baseUrl, {
                host: 'replace-b',
                port: 52774,
                namespace: 'PROD',
                username: 'userB',
                password: 'passB',
            }, cookieA);
            assert.strictEqual(connectB.status, 200);

            const tokenB = extractSessionCookie(connectB);
            const cookieB = `${SESSION_COOKIE_NAME}=${tokenB}`;

            // Old session should be destroyed
            const oldSession = await fetch(`${baseUrl}/api/session`, {
                headers: { 'Cookie': cookieA },
            });
            const oldBody = await oldSession.json() as { status: string };
            assert.strictEqual(oldBody.status, 'disconnected', 'Old session should be destroyed');

            // New session should be active
            const newSession = await fetch(`${baseUrl}/api/session`, {
                headers: { 'Cookie': cookieB },
            });
            const newBody = await newSession.json() as { status: string; server: { namespace: string; username: string } };
            assert.strictEqual(newBody.status, 'connected');
            assert.strictEqual(newBody.server.username, 'userB');
            assert.strictEqual(newBody.server.namespace, 'PROD');

            // Session count should not increase (old one replaced)
            assert.strictEqual(sessionManager.getSessionCount(), sessionCountBefore, 'Session count should not increase');
        });
    });

    // ============================================
    // Task 5.6: Connection header shows correct server info
    // ============================================

    describe('Connection header via /api/session', () => {
        it('should return namespace and username for header display (Task 5.6)', async () => {
            mockIrisFetchImpl = async () => successIrisResponse();

            const connectRes = await connectToServer(baseUrl, {
                host: 'header-test',
                port: 52773,
                namespace: 'MYNS',
                username: 'headeruser',
                password: 'pass',
            });
            const cookie = `${SESSION_COOKIE_NAME}=${extractSessionCookie(connectRes)}`;

            const sessionRes = await fetch(`${baseUrl}/api/session`, {
                headers: { 'Cookie': cookie },
            });
            const body = await sessionRes.json() as {
                status: string;
                server: { namespace: string; username: string };
                createdAt: number;
                timeoutRemaining: number;
            };

            assert.strictEqual(body.status, 'connected');
            assert.strictEqual(body.server.namespace, 'MYNS');
            assert.strictEqual(body.server.username, 'headeruser');
            assert.ok(typeof body.createdAt === 'number', 'Should include createdAt');
            assert.ok(typeof body.timeoutRemaining === 'number', 'Should include timeoutRemaining');
            // Security: no password, host, or port
            assert.strictEqual((body.server as Record<string, unknown>).password, undefined);
            assert.strictEqual((body.server as Record<string, unknown>).host, undefined);
            assert.strictEqual((body.server as Record<string, unknown>).port, undefined);
        });
    });
});
