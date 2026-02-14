/**
 * Tests for Web Connection Form
 * Story 16.1: Web Connection Form UI - Task 6
 *
 * Integration tests for /api/connect, /api/disconnect, /api/session endpoints.
 * Unit tests for client-side validation logic and recent connections localStorage.
 * Uses Node.js built-in test runner and dependency-injected fetch mock.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
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
 * Helper: create a mock IRIS JSON response.
 */
function irisResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Start server with injected mock fetch and CSRF disabled for simpler testing.
 */
async function startTestServer(): Promise<void> {
    mockIrisFetchImpl = async () => irisResponse({ status: 'ok' });

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
 * Helper: extract session cookie from Set-Cookie header.
 */
function extractSessionCookie(response: Response): string | null {
    const setCookie = response.headers.get('set-cookie');
    if (!setCookie) { return null; }
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    return match ? match[1] : null;
}

// ============================================
// Integration Tests: API Endpoints
// ============================================

describe('Connection Form API Integration', () => {
    before(async () => {
        await startTestServer();
    });

    after(async () => {
        await stopTestServer();
    });

    // ============================================
    // POST /api/connect
    // ============================================

    describe('POST /api/connect', () => {
        it('should return connected status with valid credentials (6.2)', async () => {
            mockIrisFetchImpl = async () => irisResponse({ status: 'ok' }, 200);

            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'localhost',
                    port: 52773,
                    namespace: 'USER',
                    username: '_SYSTEM',
                    password: 'SYS',
                }),
            });

            assert.strictEqual(response.status, 200);
            const body = await response.json() as { status: string };
            assert.strictEqual(body.status, 'connected');

            // Should set session cookie
            const cookie = extractSessionCookie(response);
            assert.ok(cookie, 'Response should set session cookie');
        });

        it('should return 401 with invalid credentials (6.3)', async () => {
            mockIrisFetchImpl = async () => irisResponse({ error: 'Unauthorized' }, 401);

            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'localhost',
                    port: 52773,
                    namespace: 'USER',
                    username: 'bad',
                    password: 'wrong',
                }),
            });

            assert.strictEqual(response.status, 401);
            const body = await response.json() as { error: string };
            assert.ok(body.error, 'Should return error message');
        });

        it('should return 400 with missing required fields', async () => {
            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'localhost',
                    // Missing port, namespace, username, password
                }),
            });

            assert.strictEqual(response.status, 400);
            const body = await response.json() as { error: string };
            assert.ok(body.error, 'Should return validation error');
        });

        it('should include optional fields like pathPrefix and useHTTPS', async () => {
            let capturedUrl = '';
            mockIrisFetchImpl = async (url: string | URL | Request) => {
                capturedUrl = typeof url === 'string' ? url : (url instanceof URL ? url.href : url.url);
                return irisResponse({ status: 'ok' }, 200);
            };

            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'myserver.example.com',
                    port: 443,
                    namespace: 'PROD',
                    username: '_SYSTEM',
                    password: 'SYS',
                    pathPrefix: '/iris',
                    useHTTPS: true,
                }),
            });

            assert.strictEqual(response.status, 200);
            // The mock should have been called with https scheme and pathPrefix
            assert.ok(capturedUrl.startsWith('https://'), 'Should use HTTPS when useHTTPS is true');
            assert.ok(capturedUrl.includes('/iris'), 'Should include pathPrefix in URL');
        });
    });

    // ============================================
    // GET /api/session
    // ============================================

    describe('GET /api/session', () => {
        it('should return disconnected when no session exists (6.4)', async () => {
            const response = await fetch(`${baseUrl}/api/session`);

            assert.strictEqual(response.status, 200);
            const body = await response.json() as { status: string };
            assert.strictEqual(body.status, 'disconnected');
        });

        it('should return connected when valid session exists (6.4)', async () => {
            // Create a session first
            mockIrisFetchImpl = async () => irisResponse({ status: 'ok' }, 200);

            const connectRes = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'localhost',
                    port: 52773,
                    namespace: 'USER',
                    username: '_SYSTEM',
                    password: 'SYS',
                }),
            });

            const cookie = extractSessionCookie(connectRes);
            assert.ok(cookie, 'Should get session cookie from connect');

            // Now check session with the cookie
            const sessionRes = await fetch(`${baseUrl}/api/session`, {
                headers: {
                    'Cookie': `${SESSION_COOKIE_NAME}=${cookie}`,
                },
            });

            assert.strictEqual(sessionRes.status, 200);
            const body = await sessionRes.json() as { status: string; server: { namespace: string; username: string } };
            assert.strictEqual(body.status, 'connected');
            assert.strictEqual(body.server.namespace, 'USER');
            assert.strictEqual(body.server.username, '_SYSTEM');
        });
    });

    // ============================================
    // POST /api/disconnect
    // ============================================

    describe('POST /api/disconnect', () => {
        it('should disconnect and invalidate session', async () => {
            // Create a session first
            mockIrisFetchImpl = async () => irisResponse({ status: 'ok' }, 200);

            const connectRes = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'localhost',
                    port: 52773,
                    namespace: 'USER',
                    username: '_SYSTEM',
                    password: 'SYS',
                }),
            });

            const cookie = extractSessionCookie(connectRes);
            assert.ok(cookie);

            // Disconnect
            const disconnectRes = await fetch(`${baseUrl}/api/disconnect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${cookie}`,
                },
            });

            assert.strictEqual(disconnectRes.status, 200);
            const body = await disconnectRes.json() as { status: string };
            assert.strictEqual(body.status, 'disconnected');

            // Session should now be invalid
            const sessionRes = await fetch(`${baseUrl}/api/session`, {
                headers: {
                    'Cookie': `${SESSION_COOKIE_NAME}=${cookie}`,
                },
            });

            const sessionBody = await sessionRes.json() as { status: string };
            assert.strictEqual(sessionBody.status, 'disconnected');
        });
    });

    // ============================================
    // Static File Serving
    // ============================================

    describe('Connection form static files', () => {
        it('should serve index.html with connection form', async () => {
            const response = await fetch(`${baseUrl}/`);
            assert.strictEqual(response.status, 200);

            const html = await response.text();
            assert.ok(html.includes('connectionForm'), 'Should contain connection form element');
            assert.ok(html.includes('fieldHost'), 'Should contain host field');
            assert.ok(html.includes('fieldPort'), 'Should contain port field');
            assert.ok(html.includes('fieldNamespace'), 'Should contain namespace field');
            assert.ok(html.includes('fieldUsername'), 'Should contain username field');
            assert.ok(html.includes('fieldPassword'), 'Should contain password field');
        });

        it('should serve connection-form.css', async () => {
            const response = await fetch(`${baseUrl}/connection-form.css`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(contentType.includes('text/css'), `Expected CSS content type, got ${contentType}`);
        });

        it('should serve connection-form.js', async () => {
            const response = await fetch(`${baseUrl}/connection-form.js`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('javascript'),
                `Expected JavaScript content type, got ${contentType}`
            );
        });
    });
});

// ============================================
// Unit Tests: Client-Side Validation Logic
// ============================================

describe('Connection Form Validation (unit)', () => {
    /**
     * Simplified validation function matching the client-side logic.
     * Extracted here for testability without a browser DOM.
     */
    function validateConnectionFields(data: {
        host?: string;
        port?: string;
        namespace?: string;
        username?: string;
        password?: string;
    }): { valid: boolean; errors: Record<string, string> } {
        const fieldErrors: Record<string, string> = {};
        let valid = true;

        // Host - required
        if (!data.host || !data.host.trim()) {
            fieldErrors.host = 'Host is required';
            valid = false;
        }

        // Port - required, valid range
        if (!data.port || !data.port.trim()) {
            fieldErrors.port = 'Port is required';
            valid = false;
        } else {
            const portNum = parseInt(data.port, 10);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                fieldErrors.port = 'Port must be between 1 and 65535';
                valid = false;
            }
        }

        // Namespace - required
        if (!data.namespace || !data.namespace.trim()) {
            fieldErrors.namespace = 'Namespace is required';
            valid = false;
        }

        // Username - required
        if (!data.username || !data.username.trim()) {
            fieldErrors.username = 'Username is required';
            valid = false;
        }

        // Password - required
        if (!data.password) {
            fieldErrors.password = 'Password is required';
            valid = false;
        }

        return { valid, errors: fieldErrors };
    }

    it('should pass validation with all required fields (6.5)', () => {
        const result = validateConnectionFields({
            host: 'localhost',
            port: '52773',
            namespace: 'USER',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, true);
        assert.deepStrictEqual(result.errors, {});
    });

    it('should fail when host is missing (6.5)', () => {
        const result = validateConnectionFields({
            host: '',
            port: '52773',
            namespace: 'USER',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.host);
    });

    it('should fail when port is missing (6.5)', () => {
        const result = validateConnectionFields({
            host: 'localhost',
            port: '',
            namespace: 'USER',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.port);
    });

    it('should fail when port is out of range (6.5)', () => {
        const result = validateConnectionFields({
            host: 'localhost',
            port: '99999',
            namespace: 'USER',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.port);
        assert.ok(result.errors.port.includes('between'));
    });

    it('should fail when port is negative (6.5)', () => {
        const result = validateConnectionFields({
            host: 'localhost',
            port: '-1',
            namespace: 'USER',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.port);
    });

    it('should fail when port is not a number (6.5)', () => {
        const result = validateConnectionFields({
            host: 'localhost',
            port: 'abc',
            namespace: 'USER',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.port);
    });

    it('should fail when namespace is missing (6.5)', () => {
        const result = validateConnectionFields({
            host: 'localhost',
            port: '52773',
            namespace: '',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.namespace);
    });

    it('should fail when username is missing (6.5)', () => {
        const result = validateConnectionFields({
            host: 'localhost',
            port: '52773',
            namespace: 'USER',
            username: '',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.username);
    });

    it('should fail when password is missing (6.5)', () => {
        const result = validateConnectionFields({
            host: 'localhost',
            port: '52773',
            namespace: 'USER',
            username: '_SYSTEM',
            password: '',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.password);
    });

    it('should report all missing fields at once (6.5)', () => {
        const result = validateConnectionFields({
            host: '',
            port: '',
            namespace: '',
            username: '',
            password: '',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.host);
        assert.ok(result.errors.port);
        assert.ok(result.errors.namespace);
        assert.ok(result.errors.username);
        assert.ok(result.errors.password);
    });

    it('should trim whitespace from fields (6.5)', () => {
        const result = validateConnectionFields({
            host: '  ',
            port: '52773',
            namespace: 'USER',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.host);
    });

    it('should accept boundary port values (6.5)', () => {
        const result1 = validateConnectionFields({
            host: 'localhost',
            port: '1',
            namespace: 'USER',
            username: '_SYSTEM',
            password: 'SYS',
        });
        assert.strictEqual(result1.valid, true);

        const result2 = validateConnectionFields({
            host: 'localhost',
            port: '65535',
            namespace: 'USER',
            username: '_SYSTEM',
            password: 'SYS',
        });
        assert.strictEqual(result2.valid, true);
    });
});

// ============================================
// Unit Tests: Recent Connections Storage Logic
// ============================================

describe('Recent Connections localStorage logic (unit)', () => {
    /**
     * In-memory localStorage mock for unit testing.
     */
    class MockStorage {
        private store: Map<string, string> = new Map();

        getItem(key: string): string | null {
            return this.store.get(key) ?? null;
        }

        setItem(key: string, value: string): void {
            this.store.set(key, value);
        }

        removeItem(key: string): void {
            this.store.delete(key);
        }

        clear(): void {
            this.store.clear();
        }
    }

    const STORAGE_KEY = 'ite-recent-connections';
    const MAX_RECENT = 5;

    interface RecentConnection {
        host: string;
        port: number;
        pathPrefix?: string;
        namespace: string;
        username: string;
        useHTTPS?: boolean;
    }

    /**
     * Load recent connections from storage (mirrors client-side logic).
     */
    function loadRecent(storage: MockStorage): RecentConnection[] {
        try {
            const stored = storage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    return parsed.slice(0, MAX_RECENT);
                }
            }
        } catch {
            // Corrupted data
        }
        return [];
    }

    /**
     * Save a recent connection (mirrors client-side logic).
     */
    function saveRecent(storage: MockStorage, data: RecentConnection): void {
        let connections = loadRecent(storage);

        const entry: RecentConnection = {
            host: data.host,
            port: data.port,
            pathPrefix: data.pathPrefix || '',
            namespace: data.namespace,
            username: data.username,
            useHTTPS: data.useHTTPS || false,
        };

        // Remove duplicate
        connections = connections.filter(
            (c) => !(c.host === entry.host && c.port === entry.port &&
                     c.namespace === entry.namespace && c.username === entry.username)
        );

        connections.unshift(entry);
        connections = connections.slice(0, MAX_RECENT);
        storage.setItem(STORAGE_KEY, JSON.stringify(connections));
    }

    /**
     * Remove a recent connection by index.
     */
    function removeRecent(storage: MockStorage, index: number): void {
        const connections = loadRecent(storage);
        connections.splice(index, 1);
        storage.setItem(STORAGE_KEY, JSON.stringify(connections));
    }

    let storage: MockStorage;

    beforeEach(() => {
        storage = new MockStorage();
    });

    it('should return empty array when no connections saved (6.6)', () => {
        const result = loadRecent(storage);
        assert.deepStrictEqual(result, []);
    });

    it('should save and load a connection (6.6)', () => {
        saveRecent(storage, {
            host: 'localhost',
            port: 52773,
            namespace: 'USER',
            username: '_SYSTEM',
        });

        const result = loadRecent(storage);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].host, 'localhost');
        assert.strictEqual(result[0].port, 52773);
        assert.strictEqual(result[0].namespace, 'USER');
        assert.strictEqual(result[0].username, '_SYSTEM');
    });

    it('should NOT save password (6.6)', () => {
        const data = {
            host: 'localhost',
            port: 52773,
            namespace: 'USER',
            username: '_SYSTEM',
        };
        saveRecent(storage, data);

        const raw = storage.getItem(STORAGE_KEY);
        assert.ok(raw);
        assert.ok(!raw.includes('password'), 'Should not contain password field');
    });

    it('should save optional fields (pathPrefix, useHTTPS) (6.6)', () => {
        saveRecent(storage, {
            host: 'myserver',
            port: 443,
            pathPrefix: '/iris',
            namespace: 'PROD',
            username: 'admin',
            useHTTPS: true,
        });

        const result = loadRecent(storage);
        assert.strictEqual(result[0].pathPrefix, '/iris');
        assert.strictEqual(result[0].useHTTPS, true);
    });

    it('should add new connections to the front (6.6)', () => {
        saveRecent(storage, { host: 'server1', port: 52773, namespace: 'A', username: 'u1' });
        saveRecent(storage, { host: 'server2', port: 52773, namespace: 'B', username: 'u2' });

        const result = loadRecent(storage);
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].host, 'server2');
        assert.strictEqual(result[1].host, 'server1');
    });

    it('should limit to 5 recent connections (6.6)', () => {
        for (let i = 0; i < 7; i++) {
            saveRecent(storage, { host: `server${i}`, port: 52773, namespace: 'NS', username: 'user' });
        }

        const result = loadRecent(storage);
        assert.strictEqual(result.length, 5);
        // Most recent should be first
        assert.strictEqual(result[0].host, 'server6');
    });

    it('should deduplicate by host:port:namespace:username (6.6)', () => {
        saveRecent(storage, { host: 'localhost', port: 52773, namespace: 'USER', username: '_SYSTEM' });
        saveRecent(storage, { host: 'other', port: 52773, namespace: 'USER', username: '_SYSTEM' });
        saveRecent(storage, { host: 'localhost', port: 52773, namespace: 'USER', username: '_SYSTEM' });

        const result = loadRecent(storage);
        assert.strictEqual(result.length, 2);
        // Re-added entry should be at front
        assert.strictEqual(result[0].host, 'localhost');
        assert.strictEqual(result[1].host, 'other');
    });

    it('should remove a connection by index (6.6)', () => {
        saveRecent(storage, { host: 'server1', port: 52773, namespace: 'A', username: 'u1' });
        saveRecent(storage, { host: 'server2', port: 52773, namespace: 'B', username: 'u2' });

        removeRecent(storage, 0); // Remove server2 (it's at front)

        const result = loadRecent(storage);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].host, 'server1');
    });

    it('should handle corrupted localStorage data gracefully (6.6)', () => {
        storage.setItem(STORAGE_KEY, 'not valid json{{{');
        const result = loadRecent(storage);
        assert.deepStrictEqual(result, []);
    });

    it('should handle non-array localStorage data gracefully (6.6)', () => {
        storage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
        const result = loadRecent(storage);
        assert.deepStrictEqual(result, []);
    });
});
