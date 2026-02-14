/**
 * Tests for session timeout, expiry, activity tracking, and cleanup
 * Story 15.5: Session Management - Tasks 1-7
 *
 * Uses short timeouts (100ms) for fast test execution.
 * Uses Node.js built-in test runner.
 */
import { describe, it, beforeEach, afterEach, before, after } from 'node:test';
import * as assert from 'assert';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { SessionManager, SESSION_COOKIE_NAME } from '../server/sessionManager';
import type { ConnectionDetails } from '../server/sessionManager';
import { createAppServer } from '../server/server';
import type { Request } from 'express';

/**
 * Short timeout for unit tests (100ms)
 */
const TEST_TIMEOUT_MS = 100;

/**
 * Longer timeout for integration tests with HTTP roundtrips (500ms)
 */
const INTEGRATION_TIMEOUT_MS = 500;

/**
 * Helper: create a mock Express Request with optional cookie and auth header
 */
function mockRequest(options: {
    cookie?: string;
    authorization?: string;
} = {}): Request {
    const headers: Record<string, string | undefined> = {};
    if (options.cookie) {
        headers.cookie = options.cookie;
    }
    if (options.authorization) {
        headers.authorization = options.authorization;
    }
    return { headers } as unknown as Request;
}

/**
 * Helper: create a standard set of connection details
 */
function makeConnectionDetails(overrides: Partial<ConnectionDetails> = {}): ConnectionDetails {
    return {
        host: 'iris-server.local',
        port: 52773,
        namespace: 'USER',
        username: 'testuser',
        password: 'testpass',
        pathPrefix: '/iris',
        useHTTPS: false,
        ...overrides,
    };
}

/**
 * Helper: wait for a specified time
 */
function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Task 1: Session timeout/expiry in SessionManager
// ============================================
describe('Session timeout and expiry', () => {
    let manager: SessionManager;

    beforeEach(() => {
        manager = new SessionManager({
            sessionTimeoutMs: TEST_TIMEOUT_MS,
            cleanupIntervalMs: 0, // Disable periodic cleanup for unit tests
        });
    });

    afterEach(() => {
        manager.clearCleanupInterval();
    });

    // Task 1.1: createdAt and lastActivity timestamps
    it('should set createdAt and lastActivity on session creation', () => {
        const before = Date.now();
        const token = manager.createSession(makeConnectionDetails());
        const after = Date.now();

        // Use validateToken to check timestamps (validate also updates lastActivity via sliding window)
        const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token}` });
        const session = manager.validate(req);

        assert.ok(session, 'Session should exist');
        assert.ok(session!.createdAt >= before && session!.createdAt <= after, 'createdAt should be set to current time');
        // lastActivity is updated by validate() (sliding window), so check it's at least >= before
        assert.ok(session!.lastActivity >= before, 'lastActivity should be at or after creation time');
    });

    // Task 1.2: Configurable sessionTimeout
    it('should use configured session timeout', () => {
        const customManager = new SessionManager({
            sessionTimeoutMs: 5000,
            cleanupIntervalMs: 0,
        });
        assert.strictEqual(customManager.getSessionTimeoutMs(), 5000);
        customManager.clearCleanupInterval();
    });

    // Task 1.3: validate() returns null if expired (Task 7.2)
    it('should return null for expired session', async () => {
        const token = manager.createSession(makeConnectionDetails());
        const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token}` });

        // Session should be valid immediately
        const session = manager.validate(req);
        assert.ok(session, 'Session should be valid before timeout');

        // Wait for session to expire
        await wait(TEST_TIMEOUT_MS + 50);

        // Session should now be expired
        const expired = manager.validate(req);
        assert.strictEqual(expired, null, 'Session should be null after timeout');
    });

    // Task 7.3: Expired session returns 401 on next API request
    // (This is tested via integration test below)

    // Task 1.4: Sliding window - lastActivity updates on validate (Task 7.4)
    it('should reset timeout on activity (sliding window)', async () => {
        const token = manager.createSession(makeConnectionDetails());
        const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token}` });

        // Wait 60% of timeout
        await wait(TEST_TIMEOUT_MS * 0.6);

        // Access session - should update lastActivity
        const session = manager.validate(req);
        assert.ok(session, 'Session should still be valid at 60% of timeout');

        // Wait another 60% of timeout (total 120% from creation, but only 60% from last activity)
        await wait(TEST_TIMEOUT_MS * 0.6);

        // Session should still be valid because of sliding window
        const stillValid = manager.validate(req);
        assert.ok(stillValid, 'Session should be valid due to sliding window');

        // Wait for full timeout from last activity
        await wait(TEST_TIMEOUT_MS + 50);

        // Now it should be expired
        const expired = manager.validate(req);
        assert.strictEqual(expired, null, 'Session should expire after full timeout from last activity');
    });

    // Task 1.5: Periodic cleanup (Task 7.5)
    it('should clean up expired sessions', async () => {
        manager.createSession(makeConnectionDetails({ username: 'user1' }));
        manager.createSession(makeConnectionDetails({ username: 'user2' }));
        assert.strictEqual(manager.getSessionCount(), 2);

        // Wait for sessions to expire
        await wait(TEST_TIMEOUT_MS + 50);

        // Run cleanup
        const removed = manager.cleanupExpiredSessions();
        assert.strictEqual(removed, 2, 'Should remove 2 expired sessions');
        assert.strictEqual(manager.getSessionCount(), 0, 'No sessions should remain');
    });

    it('should not clean up active sessions', async () => {
        const token1 = manager.createSession(makeConnectionDetails({ username: 'user1' }));
        manager.createSession(makeConnectionDetails({ username: 'user2' }));

        // Wait 60% of timeout
        await wait(TEST_TIMEOUT_MS * 0.6);

        // Touch only user1's session
        const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token1}` });
        manager.validate(req);

        // Wait for user2's session to expire (40% more)
        await wait(TEST_TIMEOUT_MS * 0.6);

        const removed = manager.cleanupExpiredSessions();
        assert.strictEqual(removed, 1, 'Should remove 1 expired session');
        assert.strictEqual(manager.getSessionCount(), 1, 'Active session should remain');
    });

    // Task 1.6: clearCleanupInterval
    it('should stop cleanup timer on clearCleanupInterval', () => {
        const timedManager = new SessionManager({
            sessionTimeoutMs: TEST_TIMEOUT_MS,
            cleanupIntervalMs: 50,
        });

        // Should not throw
        timedManager.clearCleanupInterval();
        // Calling again should be safe
        timedManager.clearCleanupInterval();
    });
});

// ============================================
// Task 2: Session expiry with WebSocket notification
// ============================================
describe('Session expiry WebSocket notification', () => {
    let manager: SessionManager;
    let expiredTokens: string[];

    beforeEach(() => {
        expiredTokens = [];
        manager = new SessionManager({
            sessionTimeoutMs: TEST_TIMEOUT_MS,
            cleanupIntervalMs: 0,
            onSessionExpired: (token: string) => {
                expiredTokens.push(token);
            },
        });
    });

    afterEach(() => {
        manager.clearCleanupInterval();
    });

    // Task 2.1: validate() calls onSessionExpired when session expires
    it('should call onSessionExpired when validate detects expired session', async () => {
        const token = manager.createSession(makeConnectionDetails());
        const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token}` });

        await wait(TEST_TIMEOUT_MS + 50);

        manager.validate(req);
        assert.strictEqual(expiredTokens.length, 1, 'Should notify of 1 expired session');
        assert.strictEqual(expiredTokens[0], token, 'Should notify with correct token');
    });

    // Task 2.2: callback mechanism
    it('should support setting callback after construction', () => {
        const laterTokens: string[] = [];
        const mgr = new SessionManager({
            sessionTimeoutMs: TEST_TIMEOUT_MS,
            cleanupIntervalMs: 0,
        });

        mgr.setOnSessionExpired((token) => laterTokens.push(token));
        mgr.clearCleanupInterval();
    });

    // Task 2.3: notification before cleanup
    it('should call onSessionExpired during cleanup', async () => {
        const token1 = manager.createSession(makeConnectionDetails({ username: 'user1' }));
        const token2 = manager.createSession(makeConnectionDetails({ username: 'user2' }));

        await wait(TEST_TIMEOUT_MS + 50);

        manager.cleanupExpiredSessions();
        assert.strictEqual(expiredTokens.length, 2, 'Should notify for both expired sessions');
        assert.ok(expiredTokens.includes(token1), 'Should include first token');
        assert.ok(expiredTokens.includes(token2), 'Should include second token');
    });
});

// ============================================
// Task 3: Session activity tracking (touchSession)
// ============================================
describe('Session activity tracking', () => {
    let manager: SessionManager;

    beforeEach(() => {
        manager = new SessionManager({
            sessionTimeoutMs: TEST_TIMEOUT_MS,
            cleanupIntervalMs: 0,
        });
    });

    afterEach(() => {
        manager.clearCleanupInterval();
    });

    it('should update lastActivity via touchSession', async () => {
        const token = manager.createSession(makeConnectionDetails());

        // Wait 60% of timeout
        await wait(TEST_TIMEOUT_MS * 0.6);

        // Touch to keep alive
        const touched = manager.touchSession(token);
        assert.strictEqual(touched, true, 'Should return true for active session');

        // Wait another 60% (120% from start, but 60% from touch)
        await wait(TEST_TIMEOUT_MS * 0.6);

        // Session should still be valid
        const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token}` });
        const session = manager.validate(req);
        assert.ok(session, 'Session should still be valid after touch');
    });

    it('should return false for touchSession on expired session', async () => {
        const token = manager.createSession(makeConnectionDetails());

        await wait(TEST_TIMEOUT_MS + 50);

        const touched = manager.touchSession(token);
        assert.strictEqual(touched, false, 'Should return false for expired session');
    });

    it('should return false for touchSession on unknown token', () => {
        const touched = manager.touchSession('nonexistent-token');
        assert.strictEqual(touched, false, 'Should return false for unknown token');
    });
});

// ============================================
// Task 4: Session isolation
// ============================================
describe('Session isolation with timeout', () => {
    let manager: SessionManager;

    beforeEach(() => {
        manager = new SessionManager({
            sessionTimeoutMs: TEST_TIMEOUT_MS * 5, // Longer timeout for isolation tests
            cleanupIntervalMs: 0,
        });
    });

    afterEach(() => {
        manager.clearCleanupInterval();
    });

    // Task 4.1-4.2: Independent credentials and namespace
    it('should maintain independent sessions with different IRIS servers', () => {
        const token1 = manager.createSession(makeConnectionDetails({
            host: 'iris-server-1',
            port: 52773,
            username: 'admin1',
            password: 'pass1',
            namespace: 'PRODUCTION',
        }));

        const token2 = manager.createSession(makeConnectionDetails({
            host: 'iris-server-2',
            port: 57772,
            username: 'admin2',
            password: 'pass2',
            namespace: 'STAGING',
        }));

        const req1 = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token1}` });
        const req2 = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token2}` });

        const session1 = manager.validate(req1);
        const session2 = manager.validate(req2);

        // Each session has its own credentials
        assert.ok(session1);
        assert.ok(session2);
        assert.strictEqual(session1!.host, 'iris-server-1');
        assert.strictEqual(session1!.username, 'admin1');
        assert.strictEqual(session1!.password, 'pass1');
        assert.strictEqual(session1!.namespace, 'PRODUCTION');
        assert.strictEqual(session2!.host, 'iris-server-2');
        assert.strictEqual(session2!.username, 'admin2');
        assert.strictEqual(session2!.password, 'pass2');
        assert.strictEqual(session2!.namespace, 'STAGING');
    });

    // Task 4.3: Concurrent sessions accessing different IRIS servers
    it('should allow concurrent sessions to coexist independently', () => {
        const tokens: string[] = [];
        for (let i = 0; i < 5; i++) {
            tokens.push(manager.createSession(makeConnectionDetails({
                host: `iris-${i}`,
                username: `user${i}`,
            })));
        }

        assert.strictEqual(manager.getSessionCount(), 5);

        // Destroy middle session
        manager.destroySession(tokens[2]);
        assert.strictEqual(manager.getSessionCount(), 4);

        // Others still work
        for (let i = 0; i < 5; i++) {
            const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${tokens[i]}` });
            const session = manager.validate(req);
            if (i === 2) {
                assert.strictEqual(session, null, `Session ${i} should be destroyed`);
            } else {
                assert.ok(session, `Session ${i} should be valid`);
                assert.strictEqual(session!.host, `iris-${i}`);
            }
        }
    });
});

// ============================================
// Tasks 5, 6, 7 (integration): Full server integration tests
// ============================================
describe('Session timeout integration', () => {
    let httpServer: Server;
    let baseUrl: string;
    let sessionManager: SessionManager;

    /**
     * Mock IRIS fetch
     */
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

    before(async () => {
        mockIrisFetchImpl = async () => irisResponse({ status: { errors: [] }, result: { content: [] } });

        const result = createAppServer({
            proxyOptions: { fetchFn: mockIrisFetch as typeof globalThis.fetch },
            skipSecurity: true,
            sessionTimeoutMs: INTEGRATION_TIMEOUT_MS,
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

    // Task 7.3: Session expiry returns 401 on next API request
    it('should return 401 for expired session on API request', async () => {
        const token = sessionManager.createSession({
            host: 'iris-test', port: 52773, namespace: 'USER',
            username: 'testuser', password: 'testpass',
        });

        // Valid request should work
        const validRes = await fetch(`${baseUrl}/api/iris/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `${SESSION_COOKIE_NAME}=${token}`,
            },
            body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
        });
        assert.strictEqual(validRes.status, 200, 'Should succeed before timeout');

        // Wait for expiry
        await wait(INTEGRATION_TIMEOUT_MS + 100);

        // Should now return 401
        const expiredRes = await fetch(`${baseUrl}/api/iris/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `${SESSION_COOKIE_NAME}=${token}`,
            },
            body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
        });
        assert.strictEqual(expiredRes.status, 401, 'Should return 401 after session timeout');
    });

    // Task 5.1-5.2: Disconnect destroys session and clears credentials (Task 7.7)
    it('should destroy session and clear cookie on disconnect', async () => {
        const token = sessionManager.createSession({
            host: 'iris-test', port: 52773, namespace: 'USER',
            username: 'disconnect-user', password: 'testpass',
        });

        const response = await fetch(`${baseUrl}/api/disconnect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `${SESSION_COOKIE_NAME}=${token}`,
            },
        });

        assert.strictEqual(response.status, 200);
        const body = await response.json() as { status: string };
        assert.strictEqual(body.status, 'disconnected');

        // Verify cookie is cleared
        const setCookie = response.headers.get('set-cookie') || '';
        assert.ok(setCookie.includes('Max-Age=0'), 'Cookie should be cleared');

        // Verify session is gone
        const queryRes = await fetch(`${baseUrl}/api/iris/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `${SESSION_COOKIE_NAME}=${token}`,
            },
            body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
        });
        assert.strictEqual(queryRes.status, 401, 'Session should be invalidated');
    });

    // Task 5.3-5.4: Disconnect closes WebSocket connections (Task 7.8)
    it('should close WebSocket connections on disconnect', async () => {
        const token = sessionManager.createSession({
            host: 'iris-test', port: 52773, namespace: 'USER',
            username: 'ws-disconnect-user', password: 'testpass',
        });

        // Connect WebSocket
        const wsUrl = `${baseUrl.replace('http', 'ws')}?token=${token}`;
        const ws = new WebSocket(wsUrl);

        await new Promise<void>((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
        });

        // Set up listeners for session expiry message and close
        const messagePromise = new Promise<{ event: string }>((resolve) => {
            ws.on('message', (data) => {
                resolve(JSON.parse(data.toString()));
            });
        });

        const closePromise = new Promise<{ code: number }>((resolve) => {
            ws.on('close', (code) => {
                resolve({ code });
            });
        });

        // Disconnect via API - destroySession fires onSessionExpired callback,
        // which calls wsHandle.notifySessionExpired(token) to close WS connections.
        await fetch(`${baseUrl}/api/disconnect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `${SESSION_COOKIE_NAME}=${token}`,
            },
        });

        // WebSocket should receive sessionExpired event
        const message = await Promise.race([
            messagePromise,
            wait(2000).then(() => ({ event: 'timeout' })),
        ]);
        assert.strictEqual(message.event, 'sessionExpired', 'Should receive sessionExpired event');

        // WebSocket should be closed with code 4002
        const closeResult = await Promise.race([
            closePromise,
            wait(2000).then(() => ({ code: -1 })),
        ]);

        // Clean up
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }

        assert.strictEqual(closeResult.code, 4002, 'WebSocket should close with session expired code 4002');
    });

    // Task 6.1-6.2: /api/session returns timeout info (Task 7.9)
    it('should return timeout info in /api/session response', async () => {
        const token = sessionManager.createSession({
            host: 'iris-test', port: 52773, namespace: 'USER',
            username: 'session-info-user', password: 'testpass',
        });

        const response = await fetch(`${baseUrl}/api/session`, {
            headers: {
                'Cookie': `${SESSION_COOKIE_NAME}=${token}`,
            },
        });

        assert.strictEqual(response.status, 200);
        const body = await response.json() as {
            status: string;
            server: { namespace: string; username: string };
            createdAt: number;
            timeoutRemaining: number;
        };

        assert.strictEqual(body.status, 'connected');
        assert.strictEqual(body.server.namespace, 'USER');
        assert.strictEqual(body.server.username, 'session-info-user');
        assert.ok(typeof body.createdAt === 'number', 'Should include createdAt');
        assert.ok(body.createdAt > 0, 'createdAt should be a valid timestamp');
        assert.ok(typeof body.timeoutRemaining === 'number', 'Should include timeoutRemaining');
        assert.ok(body.timeoutRemaining > 0, 'timeoutRemaining should be positive for active session');
        assert.ok(body.timeoutRemaining <= INTEGRATION_TIMEOUT_MS, 'timeoutRemaining should not exceed timeout');
    });

    // Task 7.6: Concurrent sessions are isolated (different tokens, different servers)
    it('should isolate concurrent sessions with different IRIS servers', async () => {
        const token1 = sessionManager.createSession({
            host: 'iris-prod', port: 52773, namespace: 'PROD',
            username: 'produser', password: 'prodpass',
        });
        const token2 = sessionManager.createSession({
            host: 'iris-staging', port: 57772, namespace: 'STAGING',
            username: 'stageuser', password: 'stagepass',
        });

        // Check session 1
        const res1 = await fetch(`${baseUrl}/api/session`, {
            headers: { 'Cookie': `${SESSION_COOKIE_NAME}=${token1}` },
        });
        const body1 = await res1.json() as { status: string; server: { namespace: string; username: string } };
        assert.strictEqual(body1.server.namespace, 'PROD');
        assert.strictEqual(body1.server.username, 'produser');

        // Check session 2
        const res2 = await fetch(`${baseUrl}/api/session`, {
            headers: { 'Cookie': `${SESSION_COOKIE_NAME}=${token2}` },
        });
        const body2 = await res2.json() as { status: string; server: { namespace: string; username: string } };
        assert.strictEqual(body2.server.namespace, 'STAGING');
        assert.strictEqual(body2.server.username, 'stageuser');

        // Destroy session 1, session 2 should still work
        sessionManager.destroySession(token1);

        const res1After = await fetch(`${baseUrl}/api/session`, {
            headers: { 'Cookie': `${SESSION_COOKIE_NAME}=${token1}` },
        });
        const body1After = await res1After.json() as { status: string };
        assert.strictEqual(body1After.status, 'disconnected', 'Destroyed session should show disconnected');

        const res2After = await fetch(`${baseUrl}/api/session`, {
            headers: { 'Cookie': `${SESSION_COOKIE_NAME}=${token2}` },
        });
        const body2After = await res2After.json() as { status: string; server: { namespace: string } };
        assert.strictEqual(body2After.status, 'connected', 'Other session should still be connected');
        assert.strictEqual(body2After.server.namespace, 'STAGING');
    });
});
