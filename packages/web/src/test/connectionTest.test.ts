/**
 * Unit tests for POST /api/test-connection endpoint
 * Story 16.3: Connection Test
 *
 * Tests the stateless connection probe that verifies IRIS server
 * reachability and credentials without creating a session.
 * Uses Node.js built-in test runner with dependency-injected fetch mock.
 */
import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { SESSION_COOKIE_NAME } from '../server/sessionManager';
import { createAppServer } from '../server/server';

let httpServer: Server;
let baseUrl: string;

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
 * Valid connection details for test requests
 */
const validConnectionData = {
    host: 'iris-test',
    port: 52773,
    namespace: 'USER',
    username: 'testuser',
    password: 'testpass',
    pathPrefix: '',
    useHTTPS: false,
};

/**
 * Start server with injected mock fetch for IRIS calls.
 */
async function startTestServer(): Promise<void> {
    // Default: return a successful IRIS Atelier API response with version info
    mockIrisFetchImpl = async () => irisResponse({
        status: { errors: [] },
        result: { content: { api: 7, version: '2024.1.0' } },
    });

    const result = createAppServer({
        proxyOptions: { fetchFn: mockIrisFetch as typeof globalThis.fetch },
        skipSecurity: true,
    });

    httpServer = result.server;

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

describe('POST /api/test-connection (Story 16.3)', () => {
    before(async () => {
        await startTestServer();
    });

    after(async () => {
        await stopTestServer();
    });

    // ============================================
    // Task 4.2: Valid credentials - success + version
    // ============================================

    it('should return success with IRIS version for valid credentials (Task 4.2)', async () => {
        mockIrisFetchImpl = async () => irisResponse({
            status: { errors: [] },
            result: { content: { api: 7, version: '2024.1.0' } },
        });

        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.strictEqual(response.status, 200);
        const body = await response.json() as { status: string; version: string };
        assert.strictEqual(body.status, 'success');
        assert.strictEqual(body.version, '2024.1.0');
    });

    it('should return API version when version field is missing', async () => {
        mockIrisFetchImpl = async () => irisResponse({
            status: { errors: [] },
            result: { content: { api: 7, namespaces: ['USER'] } },
        });

        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.strictEqual(response.status, 200);
        const body = await response.json() as { status: string; version: string };
        assert.strictEqual(body.status, 'success');
        assert.strictEqual(body.version, 'API v7');
    });

    it('should build correct Atelier base URL and include auth header', async () => {
        let capturedUrl: string | undefined;
        let capturedHeaders: Record<string, string> | undefined;

        mockIrisFetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
            capturedUrl = url.toString();
            capturedHeaders = init?.headers as Record<string, string>;
            return irisResponse({
                status: { errors: [] },
                result: { content: { api: 7 } },
            });
        };

        await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.ok(capturedUrl, 'Should have captured URL');
        assert.ok(capturedUrl!.includes('/api/atelier/'), 'URL should include Atelier path');

        assert.ok(capturedHeaders, 'Should have captured headers');
        const expectedAuth = `Basic ${Buffer.from('testuser:testpass').toString('base64')}`;
        assert.strictEqual(capturedHeaders!['Authorization'], expectedAuth);
    });

    it('should use GET method for the IRIS probe request', async () => {
        let capturedMethod: string | undefined;

        mockIrisFetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
            capturedMethod = init?.method;
            return irisResponse({
                status: { errors: [] },
                result: { content: { api: 7 } },
            });
        };

        await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.strictEqual(capturedMethod, 'GET', 'IRIS probe should use GET method');
    });

    // ============================================
    // Task 4.3: Invalid credentials - auth error
    // ============================================

    it('should return 401 for invalid credentials (Task 4.3)', async () => {
        mockIrisFetchImpl = async () => new Response('Unauthorized', { status: 401 });

        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.strictEqual(response.status, 401);
        const body = await response.json() as { error: string; code: string };
        assert.ok(body.error.includes('authentication failed'), 'Should mention auth failure');
        assert.strictEqual(body.code, 'AUTH_FAILED');
    });

    it('should return 401 for 403 IRIS response', async () => {
        mockIrisFetchImpl = async () => new Response('Forbidden', { status: 403 });

        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.strictEqual(response.status, 401);
    });

    // ============================================
    // Task 4.4: Unreachable host - connection error
    // ============================================

    it('should return 502 for unreachable host (Task 4.4)', async () => {
        mockIrisFetchImpl = async () => {
            const connError = new TypeError('fetch failed');
            (connError as NodeJS.ErrnoException).cause = { code: 'ECONNREFUSED' } as NodeJS.ErrnoException;
            throw connError;
        };

        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.strictEqual(response.status, 502);
        const body = await response.json() as { error: string; code: string };
        assert.ok(body.error, 'Should have error message');
        assert.ok(!body.error.includes('iris-test'), 'Should not leak IRIS host');
        assert.ok(!body.error.includes('52773'), 'Should not leak IRIS port');
        assert.strictEqual(body.code, 'SERVER_UNREACHABLE');
    });

    // ============================================
    // Task 4.5: Missing fields - 400
    // ============================================

    it('should return 400 for missing required fields (Task 4.5)', async () => {
        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host: 'server', port: 52773 }), // missing namespace, username, password
        });

        assert.strictEqual(response.status, 400);
        const body = await response.json() as { error: string };
        assert.ok(body.error.includes('Missing required'), 'Should mention missing fields');
    });

    it('should return 400 when password is missing', async () => {
        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                host: 'server',
                port: 52773,
                namespace: 'USER',
                username: 'user',
            }),
        });

        assert.strictEqual(response.status, 400);
    });

    it('should return 400 for empty body', async () => {
        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        assert.strictEqual(response.status, 400);
    });

    // ============================================
    // Task 4.6: Timeout behavior
    // ============================================

    it('should return 504 on timeout (Task 4.6)', async () => {
        mockIrisFetchImpl = async () => {
            throw new DOMException('The operation was aborted', 'AbortError');
        };

        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.strictEqual(response.status, 504);
        const body = await response.json() as { error: string; code: string };
        assert.strictEqual(body.code, 'CONNECTION_TIMEOUT');
    });

    // ============================================
    // Task 4.8: Stateless - no session created
    // ============================================

    it('should NOT create a session (stateless test) (Task 4.8)', async () => {
        mockIrisFetchImpl = async () => irisResponse({
            status: { errors: [] },
            result: { content: { api: 7, version: '2024.1.0' } },
        });

        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.strictEqual(response.status, 200);
        const body = await response.json() as { status: string };
        assert.strictEqual(body.status, 'success');

        // Verify no session cookie was set
        const setCookie = response.headers.get('set-cookie') || '';
        assert.ok(!setCookie.includes(SESSION_COOKIE_NAME),
            'Should NOT set session cookie — test connection is stateless');
    });

    it('should NOT include session token in response body', async () => {
        mockIrisFetchImpl = async () => irisResponse({
            status: { errors: [] },
            result: { content: { api: 7, version: '2024.1.0' } },
        });

        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        const body = await response.json() as Record<string, unknown>;
        assert.strictEqual(body.token, undefined, 'Should not include token');
        assert.strictEqual(body.sessionToken, undefined, 'Should not include sessionToken');
    });

    // ============================================
    // Non-JSON / unexpected IRIS response
    // ============================================

    it('should handle non-JSON IRIS response gracefully', async () => {
        mockIrisFetchImpl = async () => new Response('<html>OK</html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
        });

        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.strictEqual(response.status, 200);
        const body = await response.json() as { status: string; version: string };
        assert.strictEqual(body.status, 'success');
        assert.strictEqual(body.version, 'unknown', 'Version should be unknown for non-JSON response');
    });

    it('should return 502 for non-ok IRIS response', async () => {
        mockIrisFetchImpl = async () => new Response('Internal Server Error', { status: 500 });

        const response = await fetch(`${baseUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.strictEqual(response.status, 502);
        const body = await response.json() as { error: string; code: string };
        assert.strictEqual(body.code, 'CONNECTION_FAILED');
    });
});

// ============================================
// HTTPS Enforcement Tests (Task 4.7)
// ============================================

describe('POST /api/test-connection HTTPS Enforcement (Task 4.7)', () => {
    let prodServer: Server;
    let prodUrl: string;
    let originalNodeEnv: string | undefined;

    before(async () => {
        originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const mockFetch = async (): Promise<Response> =>
            new Response(JSON.stringify({ status: { errors: [] }, result: { content: { api: 7 } } }), {
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

    it('should reject non-HTTPS /api/test-connection in production with 403', async () => {
        const response = await fetch(`${prodUrl}/api/test-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validConnectionData),
        });

        assert.strictEqual(response.status, 403);
        const body = await response.json() as { error: string };
        assert.ok(body.error.includes('HTTPS'), 'Error should mention HTTPS requirement');
    });
});
