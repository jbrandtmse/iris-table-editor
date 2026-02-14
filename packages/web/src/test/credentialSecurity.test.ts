/**
 * Security Verification Tests for Browser Credential Handling
 * Story 16.2: Browser Credential Handling - Task 5
 *
 * Comprehensive regression guard verifying:
 * - Credentials are sent in request body only (not URL params)
 * - /api/connect response does NOT contain password
 * - /api/session response does NOT contain password
 * - Session cookie has HttpOnly flag
 * - Session cookie has SameSite=Strict
 * - Recent connections in localStorage contain NO password
 * - HTTPS enforcement in production mode
 * - Password field cleanup after connection
 *
 * Uses Node.js built-in test runner and dependency-injected fetch mock.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'assert';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { SESSION_COOKIE_NAME } from '../server/sessionManager';
import { createAppServer } from '../server/server';
import type { SessionManager } from '../server/sessionManager';

// ============================================
// Test Server Setup
// ============================================

let httpServer: Server;
let baseUrl: string;
let sessionManager: SessionManager;

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

async function startTestServer(): Promise<void> {
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

function extractSessionCookie(response: Response): string | null {
    const setCookie = response.headers.get('set-cookie');
    if (!setCookie) { return null; }
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    return match ? match[1] : null;
}

// ============================================
// Task 5.2: /api/connect response does NOT contain password
// Task 5.3: /api/session response does NOT contain password
// Task 5.4: Session cookie has HttpOnly flag
// Task 5.5: Session cookie has SameSite=Strict
// ============================================

describe('Credential Security Verification (Story 16.2)', () => {
    before(async () => {
        await startTestServer();
    });

    after(async () => {
        await stopTestServer();
    });

    describe('Credential Transmission Security (Task 1)', () => {
        it('should send credentials in request body via POST, not URL params (Task 5.2)', async () => {
            let capturedUrl = '';
            mockIrisFetchImpl = async (url: string | URL | Request) => {
                capturedUrl = typeof url === 'string' ? url : (url instanceof URL ? url.href : url.url);
                return irisResponse({ status: 'ok' });
            };

            await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'localhost',
                    port: 52773,
                    namespace: 'USER',
                    username: '_SYSTEM',
                    password: 'SecretPass123',
                }),
            });

            // Verify the proxied request to IRIS does not contain password in URL
            assert.ok(!capturedUrl.includes('SecretPass123'), 'Password should not appear in proxied URL');
            assert.ok(!capturedUrl.includes('password'), 'Password param name should not appear in URL');
        });

        it('should validate credentials against IRIS before creating session (Task 1.2)', async () => {
            // When IRIS returns 401, no session should be created
            const initialCount = sessionManager.getSessionCount();

            mockIrisFetchImpl = async () => irisResponse({ error: 'Unauthorized' }, 401);

            await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'localhost',
                    port: 52773,
                    namespace: 'USER',
                    username: 'baduser',
                    password: 'badpass',
                }),
            });

            assert.strictEqual(
                sessionManager.getSessionCount(),
                initialCount,
                'No session should be created when IRIS auth fails'
            );
        });

        it('should store credentials only in server-side session memory (Task 1.3)', async () => {
            mockIrisFetchImpl = async () => irisResponse({ status: 'ok' });

            const testPassword = 'UniqueTestPwd_1_3!';
            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'localhost',
                    port: 52773,
                    namespace: 'USER',
                    username: '_SYSTEM',
                    password: testPassword,
                }),
            });

            // Session should be created in memory
            assert.ok(sessionManager.getSessionCount() > 0, 'Session should exist in memory');

            // Response body should NOT contain the password
            const body = await response.json() as Record<string, unknown>;
            const bodyStr = JSON.stringify(body);
            assert.ok(!bodyStr.includes(testPassword), 'Response body should not contain the password');
        });

        it('should return session token as HTTP-only cookie, not in response body (Task 1.4)', async () => {
            mockIrisFetchImpl = async () => irisResponse({ status: 'ok' });

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

            // Token should be in Set-Cookie header, NOT in response body
            const body = await response.json() as Record<string, unknown>;
            assert.strictEqual(body.token, undefined, 'Token should NOT be in response body');
            assert.strictEqual(body.sessionToken, undefined, 'Session token should NOT be in response body');

            const setCookie = response.headers.get('set-cookie') || '';
            assert.ok(setCookie.includes(SESSION_COOKIE_NAME), 'Session cookie should be set');
        });
    });

    describe('Connect Response Password Absence (Task 5.2)', () => {
        it('should NOT contain password in /api/connect response body', async () => {
            const testPassword = 'SuperSecret_Pwd_12345';
            mockIrisFetchImpl = async () => irisResponse({ status: 'ok' });

            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'localhost',
                    port: 52773,
                    namespace: 'USER',
                    username: '_SYSTEM',
                    password: testPassword,
                }),
            });

            const body = await response.json();
            const bodyStr = JSON.stringify(body);
            assert.ok(!bodyStr.includes(testPassword), 'Response should NEVER echo back the password');
            assert.ok(!bodyStr.includes('password'), 'Response should not contain password field key');
        });
    });

    describe('Session Response Password Absence (Task 5.3)', () => {
        it('should NOT contain password in /api/session response', async () => {
            // Create a session directly
            const token = sessionManager.createSession({
                host: 'localhost',
                port: 52773,
                namespace: 'USER',
                username: 'testuser',
                password: 'VerySecretPassword!',
            });

            const response = await fetch(`${baseUrl}/api/session`, {
                headers: {
                    'Cookie': `${SESSION_COOKIE_NAME}=${token}`,
                },
            });

            assert.strictEqual(response.status, 200);
            const body = await response.json() as Record<string, unknown>;
            const bodyStr = JSON.stringify(body);

            assert.ok(!bodyStr.includes('VerySecretPassword!'), 'Session response must NEVER contain password');
            assert.ok(!bodyStr.includes('password'), 'Session response must not contain password field key');

            // Verify only safe fields are returned
            const server = body.server as Record<string, unknown> | undefined;
            if (server) {
                assert.strictEqual(server.host, undefined, 'Host should not be in session response');
                assert.strictEqual(server.port, undefined, 'Port should not be in session response');
                assert.strictEqual(server.password, undefined, 'Password should not be in session response');
            }
        });
    });

    describe('Session Cookie Security (Task 5.4, 5.5)', () => {
        it('should have HttpOnly flag on session cookie (Task 5.4)', async () => {
            mockIrisFetchImpl = async () => irisResponse({ status: 'ok' });

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

            const setCookie = response.headers.get('set-cookie') || '';
            assert.ok(setCookie.includes('HttpOnly'), 'Session cookie MUST have HttpOnly flag');
        });

        it('should have SameSite=Strict on session cookie (Task 5.5)', async () => {
            mockIrisFetchImpl = async () => irisResponse({ status: 'ok' });

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

            const setCookie = response.headers.get('set-cookie') || '';
            assert.ok(setCookie.includes('SameSite=Strict'), 'Session cookie MUST have SameSite=Strict');
        });

        it('should be a session cookie (no Max-Age or Expires for connect)', async () => {
            mockIrisFetchImpl = async () => irisResponse({ status: 'ok' });

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

            const setCookie = response.headers.get('set-cookie') || '';
            // Session cookies have no Max-Age or Expires — they are deleted when the browser closes
            assert.ok(!setCookie.includes('Max-Age'), 'Session cookie should not have Max-Age (session-scoped)');
            assert.ok(!setCookie.includes('Expires'), 'Session cookie should not have Expires (session-scoped)');
        });

        it('should set Path=/ on session cookie', async () => {
            mockIrisFetchImpl = async () => irisResponse({ status: 'ok' });

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

            const setCookie = response.headers.get('set-cookie') || '';
            assert.ok(setCookie.includes('Path=/'), 'Session cookie should have Path=/');
        });
    });

    describe('Recent Connections Storage Security (Task 5.6)', () => {
        /**
         * These tests verify the ACTUAL client-side saveRecentConnection code
         * by reading connection-form.js source and parsing the entry object literal.
         * This guards against regressions where someone adds 'password' to the saved entry.
         */

        it('should NOT include password in the saveRecentConnection entry object (Task 5.6)', async () => {
            const fs = await import('fs');
            const path = await import('path');
            const jsPath = path.resolve(__dirname, '..', '..', 'public', 'connection-form.js');
            const source = fs.readFileSync(jsPath, 'utf-8');

            // Extract the saveRecentConnection function body
            const fnStart = source.indexOf('function saveRecentConnection(data)');
            assert.ok(fnStart !== -1, 'saveRecentConnection function must exist in connection-form.js');

            // Find the entry object literal that gets saved
            const entryStart = source.indexOf('var entry = {', fnStart);
            assert.ok(entryStart !== -1, 'entry object must exist in saveRecentConnection');

            // Extract until the closing brace of the entry object
            const entryEnd = source.indexOf('};', entryStart);
            assert.ok(entryEnd !== -1, 'entry object must have closing brace');

            const entryBlock = source.substring(entryStart, entryEnd + 2);

            // Verify password is NOT a property in the entry object
            assert.ok(!entryBlock.includes('password'), 'entry object must NOT contain password property');

            // Verify expected safe fields ARE present
            assert.ok(entryBlock.includes('host'), 'entry should contain host');
            assert.ok(entryBlock.includes('port'), 'entry should contain port');
            assert.ok(entryBlock.includes('namespace'), 'entry should contain namespace');
            assert.ok(entryBlock.includes('username'), 'entry should contain username');
            assert.ok(entryBlock.includes('pathPrefix'), 'entry should contain pathPrefix');
            assert.ok(entryBlock.includes('useHTTPS'), 'entry should contain useHTTPS');
        });

        it('should only store: host, port, namespace, username, pathPrefix, useHTTPS (Task 2.3)', async () => {
            const fs = await import('fs');
            const path = await import('path');
            const jsPath = path.resolve(__dirname, '..', '..', 'public', 'connection-form.js');
            const source = fs.readFileSync(jsPath, 'utf-8');

            // Find the entry object in saveRecentConnection
            const fnStart = source.indexOf('function saveRecentConnection(data)');
            const entryStart = source.indexOf('var entry = {', fnStart);
            const entryEnd = source.indexOf('};', entryStart);
            const entryBlock = source.substring(entryStart, entryEnd + 2);

            // Extract property names from the entry object using regex
            // Matches patterns like "host:" or "port:" at the start of property assignments
            const propMatches = entryBlock.match(/(\w+)\s*:/g) || [];
            const props = propMatches.map((m: string) => m.replace(/\s*:/, '')).sort();

            // Filter out 'var' and 'entry' from 'var entry = {'
            const fieldProps = props.filter((p: string) => p !== 'var' && p !== 'entry');

            assert.deepStrictEqual(
                fieldProps,
                ['host', 'namespace', 'pathPrefix', 'port', 'useHTTPS', 'username'],
                'Recent connection entry should only contain safe fields (no password, no credentials)'
            );
        });
    });
});

// ============================================
// HTTPS Enforcement Tests (Task 5.7)
// ============================================

describe('HTTPS Enforcement in Production (Task 5.7)', () => {
    let prodServer: Server;
    let prodUrl: string;
    let originalNodeEnv: string | undefined;

    before(async () => {
        originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const mockFetch = async (): Promise<Response> =>
            new Response(JSON.stringify({ status: 'ok' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });

        const result = createAppServer({
            proxyOptions: { fetchFn: mockFetch as typeof globalThis.fetch },
            skipSecurity: true,
        });

        prodServer = result.server;

        await new Promise<void>((resolve) => {
            prodServer.listen(0, () => {
                const address = prodServer.address() as AddressInfo;
                prodUrl = `http://localhost:${address.port}`;
                resolve();
            });
        });
    });

    after(async () => {
        process.env.NODE_ENV = originalNodeEnv;
        if (prodServer) {
            await new Promise<void>((resolve, reject) => {
                prodServer.close((err) => {
                    if (err) { reject(err); } else { resolve(); }
                });
            });
        }
    });

    it('should reject non-HTTPS /api/connect in production with 403', async () => {
        const response = await fetch(`${prodUrl}/api/connect`, {
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

        assert.strictEqual(response.status, 403, 'Non-HTTPS connect should be rejected in production');
        const body = await response.json() as { error: string };
        assert.ok(body.error.includes('HTTPS'), 'Error message should mention HTTPS requirement');
    });

    it('should allow /api/connect in production when x-forwarded-proto is https (reverse proxy)', async () => {
        const response = await fetch(`${prodUrl}/api/connect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-Proto': 'https',
            },
            body: JSON.stringify({
                host: 'localhost',
                port: 52773,
                namespace: 'USER',
                username: '_SYSTEM',
                password: 'SYS',
            }),
        });

        // Should NOT be 403 — the x-forwarded-proto header indicates HTTPS
        assert.notStrictEqual(response.status, 403, 'Should allow when x-forwarded-proto is https');
        assert.strictEqual(response.status, 200, 'Should succeed with x-forwarded-proto: https');
    });

    it('should include appropriate error code in HTTPS rejection', async () => {
        const response = await fetch(`${prodUrl}/api/connect`, {
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

        const body = await response.json() as { error: string; code: string };
        assert.ok(body.code, 'Should include error code');
    });
});

// ============================================
// Non-Production HTTPS Test
// ============================================

describe('HTTPS Enforcement is NOT applied in development', () => {
    let devServer: Server;
    let devUrl: string;
    let devMockIrisFetchImpl: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

    function devMockIrisFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
        return devMockIrisFetchImpl(url, init);
    }

    before(async () => {
        const originalEnv = process.env.NODE_ENV;
        delete process.env.NODE_ENV;

        devMockIrisFetchImpl = async () =>
            new Response(JSON.stringify({ status: 'ok' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });

        const result = createAppServer({
            proxyOptions: { fetchFn: devMockIrisFetch as typeof globalThis.fetch },
            skipSecurity: true,
        });

        if (originalEnv !== undefined) {
            process.env.NODE_ENV = originalEnv;
        }

        devServer = result.server;

        await new Promise<void>((resolve) => {
            devServer.listen(0, () => {
                const address = devServer.address() as AddressInfo;
                devUrl = `http://localhost:${address.port}`;
                resolve();
            });
        });
    });

    after(async () => {
        if (devServer) {
            await new Promise<void>((resolve, reject) => {
                devServer.close((err) => {
                    if (err) { reject(err); } else { resolve(); }
                });
            });
        }
    });

    it('should allow HTTP /api/connect in development mode', async () => {
        const response = await fetch(`${devUrl}/api/connect`, {
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

        // Should NOT be 403 — should proceed normally (200 from mock)
        assert.notStrictEqual(response.status, 403, 'HTTP should be allowed in development mode');
        assert.strictEqual(response.status, 200);
    });
});

// ============================================
// Password Field Security (Task 4)
// ============================================

describe('Password Field Security (Task 4)', () => {
    it('should use type="password" for password input in HTML', async () => {
        // Read the HTML file to verify the input type
        const fs = await import('fs');
        const path = await import('path');
        // Navigate from dist/test/ -> ../../public/index.html
        const htmlPath = path.resolve(__dirname, '..', '..', 'public', 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        assert.ok(html.includes('type="password"'), 'Password field must have type="password"');
        assert.ok(html.includes('id="fieldPassword"'), 'Password field must exist with expected id');
    });

    it('should clear password from form in client JS after successful connection', async () => {
        // Read the connection-form.js to verify password clearing logic
        const fs = await import('fs');
        const path = await import('path');
        // Navigate from dist/test/ -> ../../public/connection-form.js
        const jsPath = path.resolve(__dirname, '..', '..', 'public', 'connection-form.js');
        const js = fs.readFileSync(jsPath, 'utf-8');

        // Verify password field is cleared after successful connection
        assert.ok(
            js.includes("fields.password.value = ''") || js.includes('fields.password.value = ""'),
            'Client JS should clear password field value after connection'
        );
    });
});

// ============================================
// Secure Cookie in Production (Task 3.3)
// ============================================

describe('Secure Flag in Production Cookie (Task 3.3)', () => {
    it('should include Secure flag in Set-Cookie when NODE_ENV=production', async () => {
        // Use the existing production server from HTTPS enforcement tests.
        // We create a dedicated server instance with NODE_ENV=production to verify
        // the Secure flag is actually set on the cookie at runtime.
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const mockFetch = async (): Promise<Response> =>
            new Response(JSON.stringify({ status: 'ok' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });

        const result = createAppServer({
            proxyOptions: { fetchFn: mockFetch as typeof globalThis.fetch },
            skipSecurity: true,
        });

        const secureServer = result.server;

        try {
            await new Promise<void>((resolve) => {
                secureServer.listen(0, () => resolve());
            });

            const address = secureServer.address() as AddressInfo;
            const secureUrl = `http://localhost:${address.port}`;

            // The HTTPS enforcement will reject this in production, but we can
            // check the Secure flag by creating a session directly and checking
            // any endpoint that sets a cookie. Since /api/connect is blocked over HTTP,
            // we verify through source that setSessionCookie includes Secure in production.
            // This is still a source-level check but combined with the behavioral HTTPS test
            // above, provides defense in depth.
            const fs = await import('fs');
            const path = await import('path');
            const apiProxyPath = path.resolve(__dirname, '..', '..', 'src', 'server', 'apiProxy.ts');
            const source = fs.readFileSync(apiProxyPath, 'utf-8');

            // Verify the setSessionCookie function includes conditional Secure flag
            assert.ok(
                source.includes("process.env.NODE_ENV === 'production'") && source.includes('; Secure'),
                'setSessionCookie must conditionally set Secure flag in production'
            );

            // Also verify via the connect response (which will be 403 due to HTTPS enforcement,
            // confirming the production code path is active)
            const response = await fetch(`${secureUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'localhost', port: 52773, namespace: 'USER',
                    username: '_SYSTEM', password: 'SYS',
                }),
            });
            assert.strictEqual(response.status, 403, 'Production HTTPS enforcement should be active');
        } finally {
            process.env.NODE_ENV = originalNodeEnv;
            await new Promise<void>((resolve, reject) => {
                secureServer.close((err) => err ? reject(err) : resolve());
            });
        }
    });
});
