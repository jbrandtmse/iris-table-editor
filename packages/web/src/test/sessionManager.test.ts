/**
 * Unit tests for SessionManager
 * Story 15.2: Atelier API Proxy - Task 6.7-6.9
 *
 * Tests session lifecycle: creation, validation, destruction, isolation.
 * Uses Node.js built-in test runner.
 */
import { describe, it, beforeEach } from 'node:test';
import * as assert from 'assert';
import { SessionManager, SESSION_COOKIE_NAME } from '../server/sessionManager';
import type { ConnectionDetails } from '../server/sessionManager';
import type { Request } from 'express';

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

describe('SessionManager', () => {
    let manager: SessionManager;

    beforeEach(() => {
        manager = new SessionManager();
    });

    // ============================================
    // Session Creation (Task 6.8)
    // ============================================

    describe('createSession', () => {
        it('should return a non-empty token string', () => {
            const token = manager.createSession(makeConnectionDetails());
            assert.ok(token, 'Token should be truthy');
            assert.strictEqual(typeof token, 'string');
            assert.ok(token.length > 0, 'Token should not be empty');
        });

        it('should return unique tokens for each session', () => {
            const token1 = manager.createSession(makeConnectionDetails());
            const token2 = manager.createSession(makeConnectionDetails({ username: 'user2' }));
            assert.notStrictEqual(token1, token2, 'Tokens should be unique');
        });

        it('should increment session count', () => {
            assert.strictEqual(manager.getSessionCount(), 0);
            manager.createSession(makeConnectionDetails());
            assert.strictEqual(manager.getSessionCount(), 1);
            manager.createSession(makeConnectionDetails({ username: 'user2' }));
            assert.strictEqual(manager.getSessionCount(), 2);
        });

        it('should store connection details correctly', () => {
            const details = makeConnectionDetails({
                host: 'myhost',
                port: 1234,
                namespace: '%SYS',
                username: 'admin',
                password: 'secret',
                pathPrefix: '/api',
                useHTTPS: true,
            });

            const token = manager.createSession(details);
            const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token}` });
            const session = manager.validate(req);

            assert.ok(session, 'Session should exist');
            assert.strictEqual(session!.host, 'myhost');
            assert.strictEqual(session!.port, 1234);
            assert.strictEqual(session!.namespace, '%SYS');
            assert.strictEqual(session!.username, 'admin');
            assert.strictEqual(session!.password, 'secret');
            assert.strictEqual(session!.pathPrefix, '/api');
            assert.strictEqual(session!.useHTTPS, true);
        });

        it('should default pathPrefix to empty string', () => {
            const details = makeConnectionDetails();
            delete (details as Partial<ConnectionDetails>).pathPrefix;
            const token = manager.createSession(details);
            const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token}` });
            const session = manager.validate(req);

            assert.ok(session);
            assert.strictEqual(session!.pathPrefix, '');
        });

        it('should default useHTTPS to false', () => {
            const details = makeConnectionDetails();
            delete (details as Partial<ConnectionDetails>).useHTTPS;
            const token = manager.createSession(details);
            const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token}` });
            const session = manager.validate(req);

            assert.ok(session);
            assert.strictEqual(session!.useHTTPS, false);
        });
    });

    // ============================================
    // Session Validation (Task 6.8)
    // ============================================

    describe('validate', () => {
        it('should return session data for valid cookie token', () => {
            const token = manager.createSession(makeConnectionDetails());
            const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token}` });
            const session = manager.validate(req);

            assert.ok(session, 'Should return session for valid token');
            assert.strictEqual(session!.username, 'testuser');
        });

        it('should return session data for valid Bearer token', () => {
            const token = manager.createSession(makeConnectionDetails());
            const req = mockRequest({ authorization: `Bearer ${token}` });
            const session = manager.validate(req);

            assert.ok(session, 'Should return session for Bearer token');
            assert.strictEqual(session!.username, 'testuser');
        });

        it('should return null for missing token', () => {
            const req = mockRequest();
            const session = manager.validate(req);
            assert.strictEqual(session, null);
        });

        it('should return null for invalid/unknown token', () => {
            manager.createSession(makeConnectionDetails());
            const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=invalid-token-here` });
            const session = manager.validate(req);
            assert.strictEqual(session, null);
        });

        it('should prefer cookie over Bearer token', () => {
            const token1 = manager.createSession(makeConnectionDetails({ username: 'cookie-user' }));
            const token2 = manager.createSession(makeConnectionDetails({ username: 'bearer-user' }));
            const req = mockRequest({
                cookie: `${SESSION_COOKIE_NAME}=${token1}`,
                authorization: `Bearer ${token2}`,
            });
            const session = manager.validate(req);

            assert.ok(session);
            assert.strictEqual(session!.username, 'cookie-user');
        });

        it('should handle cookie among multiple cookies', () => {
            const token = manager.createSession(makeConnectionDetails());
            const req = mockRequest({
                cookie: `other=value; ${SESSION_COOKIE_NAME}=${token}; another=xyz`,
            });
            const session = manager.validate(req);

            assert.ok(session, 'Should find session cookie among others');
        });
    });

    // ============================================
    // Session Destruction (Task 6.8)
    // ============================================

    describe('destroySession', () => {
        it('should remove the session', () => {
            const token = manager.createSession(makeConnectionDetails());
            assert.strictEqual(manager.getSessionCount(), 1);

            const result = manager.destroySession(token);
            assert.strictEqual(result, true, 'Should return true for destroyed session');
            assert.strictEqual(manager.getSessionCount(), 0);
        });

        it('should return false for non-existent token', () => {
            const result = manager.destroySession('non-existent-token');
            assert.strictEqual(result, false);
        });

        it('should invalidate the token after destruction', () => {
            const token = manager.createSession(makeConnectionDetails());
            manager.destroySession(token);

            const req = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token}` });
            const session = manager.validate(req);
            assert.strictEqual(session, null, 'Destroyed session should not validate');
        });
    });

    // ============================================
    // Session Isolation (Task 6.9)
    // ============================================

    describe('session isolation', () => {
        it('should maintain separate sessions for different tokens', () => {
            const token1 = manager.createSession(makeConnectionDetails({
                username: 'user1',
                host: 'host1',
            }));
            const token2 = manager.createSession(makeConnectionDetails({
                username: 'user2',
                host: 'host2',
            }));

            const req1 = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token1}` });
            const req2 = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token2}` });

            const session1 = manager.validate(req1);
            const session2 = manager.validate(req2);

            assert.ok(session1);
            assert.ok(session2);
            assert.strictEqual(session1!.username, 'user1');
            assert.strictEqual(session1!.host, 'host1');
            assert.strictEqual(session2!.username, 'user2');
            assert.strictEqual(session2!.host, 'host2');
        });

        it('should not affect other sessions when one is destroyed', () => {
            const token1 = manager.createSession(makeConnectionDetails({ username: 'user1' }));
            const token2 = manager.createSession(makeConnectionDetails({ username: 'user2' }));

            manager.destroySession(token1);

            const req1 = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token1}` });
            const req2 = mockRequest({ cookie: `${SESSION_COOKIE_NAME}=${token2}` });

            assert.strictEqual(manager.validate(req1), null, 'Destroyed session should be null');
            const session2 = manager.validate(req2);
            assert.ok(session2, 'Other session should remain valid');
            assert.strictEqual(session2!.username, 'user2');
        });
    });
});
