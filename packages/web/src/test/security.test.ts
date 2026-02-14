/**
 * Unit tests for Security Middleware
 * Story 15.4: Security Middleware - Task 5.1-5.9
 *
 * Tests helmet headers, CORS, CSRF protection, rate limiting,
 * and body size limits. Uses createAppServer with security enabled.
 * Uses Node.js built-in test runner.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'assert';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { createAppServer } from '../server/server';
import type { SessionManager } from '../server/sessionManager';
import { SESSION_COOKIE_NAME } from '../server/sessionManager';

/** Fixed CSRF secret for deterministic testing */
const TEST_CSRF_SECRET = 'test-csrf-secret-for-deterministic-tokens';

let httpServer: Server;
let baseUrl: string;
let sessionManager: SessionManager;

/**
 * Mock IRIS fetch that always succeeds (security tests don't care about IRIS responses)
 */
async function mockIrisFetch(): Promise<Response> {
    return new Response(JSON.stringify({ status: { errors: [] }, result: { content: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function startTestServer(): Promise<void> {
    const result = createAppServer({
        proxyOptions: { fetchFn: mockIrisFetch as typeof globalThis.fetch },
        securityOptions: { csrfSecret: TEST_CSRF_SECRET },
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
 * Create a session directly for testing
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

/**
 * Helper: Get a CSRF token from the server.
 * The session cookie must be included so the CSRF token is bound to the correct session.
 * Returns both the token string and the Set-Cookie header for the CSRF cookie.
 */
async function getCsrfToken(sessionCookie?: string): Promise<{ csrfToken: string; csrfCookie: string }> {
    const headers: Record<string, string> = {};
    if (sessionCookie) {
        headers['Cookie'] = sessionCookie;
    }
    const response = await fetch(`${baseUrl}/api/csrf-token`, { headers });
    assert.strictEqual(response.status, 200);
    const body = await response.json() as { csrfToken: string };
    assert.ok(body.csrfToken, 'Should return a CSRF token');

    // Extract the CSRF cookie from Set-Cookie header
    const setCookie = response.headers.get('set-cookie') || '';
    return { csrfToken: body.csrfToken, csrfCookie: setCookie };
}

/**
 * Extract cookie name=value pairs from a Set-Cookie header string for re-sending.
 */
function extractCookieValue(setCookie: string): string {
    // Set-Cookie: __csrf=VALUE; Path=/; HttpOnly; SameSite=Strict
    const match = setCookie.match(/^([^;]+)/);
    return match ? match[1] : '';
}

describe('Security Middleware', () => {
    before(async () => {
        await startTestServer();
    });

    after(async () => {
        await stopTestServer();
    });

    // ============================================
    // Helmet Security Headers (Task 5.2)
    // ============================================

    describe('Helmet security headers', () => {
        it('should include X-Content-Type-Options header', async () => {
            const response = await fetch(`${baseUrl}/health`);
            const header = response.headers.get('x-content-type-options');
            assert.strictEqual(header, 'nosniff');
        });

        it('should include X-Frame-Options header via CSP frame-ancestors', async () => {
            const response = await fetch(`${baseUrl}/health`);
            // Helmet 8.x uses Content-Security-Policy frame-ancestors instead of X-Frame-Options
            const csp = response.headers.get('content-security-policy') || '';
            assert.ok(
                csp.includes("frame-ancestors 'none'"),
                `CSP should include frame-ancestors 'none', got: ${csp}`
            );
        });

        it('should include Content-Security-Policy header', async () => {
            const response = await fetch(`${baseUrl}/health`);
            const csp = response.headers.get('content-security-policy');
            assert.ok(csp, 'Should have Content-Security-Policy header');
            assert.ok(csp!.includes("default-src 'self'"), 'CSP should restrict default-src');
        });

        it('should allow WebSocket connections in CSP connect-src', async () => {
            const response = await fetch(`${baseUrl}/health`);
            const csp = response.headers.get('content-security-policy') || '';
            assert.ok(csp.includes('ws:'), 'CSP connect-src should allow ws: for WebSocket');
            assert.ok(csp.includes('wss:'), 'CSP connect-src should allow wss: for secure WebSocket');
        });

        it('should include Strict-Transport-Security header', async () => {
            const response = await fetch(`${baseUrl}/health`);
            const hsts = response.headers.get('strict-transport-security');
            assert.ok(hsts, 'Should have Strict-Transport-Security header');
        });

        it('should include X-DNS-Prefetch-Control header', async () => {
            const response = await fetch(`${baseUrl}/health`);
            const header = response.headers.get('x-dns-prefetch-control');
            assert.ok(header !== null, 'Should have X-DNS-Prefetch-Control header');
        });
    });

    // ============================================
    // CORS (Task 5.3, 5.4)
    // ============================================

    describe('CORS', () => {
        it('should not include CORS headers when ALLOWED_ORIGINS is not set (same-origin default)', async () => {
            // By default ALLOWED_ORIGINS is not set in test environment
            const response = await fetch(`${baseUrl}/health`);
            const corsHeader = response.headers.get('access-control-allow-origin');
            assert.strictEqual(corsHeader, null, 'No CORS headers when ALLOWED_ORIGINS is not set');
        });

        describe('with ALLOWED_ORIGINS configured', () => {
            let corsServer: Server;
            let corsUrl: string;

            before(async () => {
                const originalEnv = process.env.ALLOWED_ORIGINS;
                process.env.ALLOWED_ORIGINS = 'https://allowed.example.com,https://other.example.com';

                const result = createAppServer({
                    proxyOptions: { fetchFn: mockIrisFetch as typeof globalThis.fetch },
                    securityOptions: { csrfSecret: TEST_CSRF_SECRET },
                });

                process.env.ALLOWED_ORIGINS = originalEnv;
                corsServer = result.server;

                await new Promise<void>((resolve) => {
                    corsServer.listen(0, () => {
                        const address = corsServer.address() as AddressInfo;
                        corsUrl = `http://localhost:${address.port}`;
                        resolve();
                    });
                });
            });

            after(async () => {
                if (corsServer) {
                    await new Promise<void>((resolve, reject) => {
                        corsServer.close((err) => {
                            if (err) { reject(err); } else { resolve(); }
                        });
                    });
                }
            });

            it('should accept requests from allowed origins (Task 5.3)', async () => {
                const response = await fetch(`${corsUrl}/health`, {
                    headers: { 'Origin': 'https://allowed.example.com' },
                });
                const corsHeader = response.headers.get('access-control-allow-origin');
                assert.strictEqual(corsHeader, 'https://allowed.example.com', 'Should echo allowed origin');
            });

            it('should reject requests from disallowed origins (Task 5.4)', async () => {
                const response = await fetch(`${corsUrl}/health`, {
                    headers: { 'Origin': 'https://evil.example.com' },
                });
                const corsHeader = response.headers.get('access-control-allow-origin');
                assert.strictEqual(corsHeader, null, 'Should not include CORS header for disallowed origin');
            });
        });
    });

    // ============================================
    // CSRF Token Endpoint (Task 5.5)
    // ============================================

    describe('CSRF token endpoint', () => {
        it('should return a CSRF token from GET /api/csrf-token', async () => {
            const { csrfToken, csrfCookie } = await getCsrfToken();
            assert.ok(csrfToken.length > 0, 'CSRF token should be non-empty');
            assert.ok(csrfCookie.includes('__csrf'), 'Should set CSRF cookie');
        });
    });

    // ============================================
    // CSRF Protection (Task 5.6, 5.7)
    // ============================================

    describe('CSRF protection', () => {
        let sessionToken: string;

        beforeEach(() => {
            sessionToken = createDirectSession();
        });

        it('should reject POST requests without CSRF token with 403 (Task 5.6)', async () => {
            const response = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });

            assert.strictEqual(response.status, 403, 'POST without CSRF token should be rejected');
        });

        it('should reject POST requests with invalid CSRF token with 403', async () => {
            const response = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                    'X-CSRF-Token': 'invalid-token',
                },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });

            assert.strictEqual(response.status, 403, 'POST with invalid CSRF token should be rejected');
        });

        it('should return JSON body on CSRF rejection (not HTML)', async () => {
            const response = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}`,
                },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });

            assert.strictEqual(response.status, 403);
            const contentType = response.headers.get('content-type') || '';
            assert.ok(contentType.includes('application/json'), 'CSRF rejection should return JSON, not HTML');
            const body = await response.json() as { error: string };
            assert.ok(body.error, 'Should include error message in JSON body');
        });

        it('should accept POST requests with valid CSRF token (Task 5.7)', async () => {
            // Step 1: Get a CSRF token with the session cookie so it's bound correctly
            const sessionCookie = `${SESSION_COOKIE_NAME}=${sessionToken}`;
            const { csrfToken, csrfCookie } = await getCsrfToken(sessionCookie);
            const csrfCookieValue = extractCookieValue(csrfCookie);

            // Step 2: Make POST with the CSRF token in header and both cookies
            const response = await fetch(`${baseUrl}/api/iris/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `${SESSION_COOKIE_NAME}=${sessionToken}; ${csrfCookieValue}`,
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({ query: 'SELECT 1', parameters: [] }),
            });

            assert.strictEqual(response.status, 200, 'POST with valid CSRF token should succeed');
        });

        it('should exempt /api/connect from CSRF (Task 3.3)', async () => {
            // /api/connect should work without CSRF token
            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: 'iris-test',
                    port: 52773,
                    namespace: 'USER',
                    username: 'admin',
                    password: 'secret',
                }),
            });

            // Should not get 403 (CSRF rejection) — 200 from mock or 400/401 from validation
            assert.notStrictEqual(response.status, 403, '/api/connect should be exempt from CSRF');
        });

        it('should exempt GET requests from CSRF', async () => {
            const response = await fetch(`${baseUrl}/health`);
            assert.strictEqual(response.status, 200, 'GET requests should not require CSRF token');
        });
    });

    // ============================================
    // Rate Limiting (Task 5.8)
    // ============================================

    describe('Rate limiting', () => {
        let rateLimitServer: Server;
        let rateLimitUrl: string;

        before(async () => {
            // Create a separate server with very low rate limit for testing
            const originalEnv = process.env.RATE_LIMIT_MAX;
            process.env.RATE_LIMIT_MAX = '5';

            const result = createAppServer({
                proxyOptions: { fetchFn: mockIrisFetch as typeof globalThis.fetch },
                securityOptions: { csrfSecret: TEST_CSRF_SECRET },
            });

            process.env.RATE_LIMIT_MAX = originalEnv;

            rateLimitServer = result.server;

            await new Promise<void>((resolve) => {
                rateLimitServer.listen(0, () => {
                    const address = rateLimitServer.address() as AddressInfo;
                    rateLimitUrl = `http://localhost:${address.port}`;
                    resolve();
                });
            });
        });

        after(async () => {
            if (rateLimitServer) {
                await new Promise<void>((resolve, reject) => {
                    rateLimitServer.close((err) => {
                        if (err) { reject(err); } else { resolve(); }
                    });
                });
            }
        });

        it('should return 429 after exceeding rate limit (Task 5.8)', async () => {
            // Send requests up to the limit
            for (let i = 0; i < 5; i++) {
                await fetch(`${rateLimitUrl}/health`);
            }

            // The next request should be rate limited
            const response = await fetch(`${rateLimitUrl}/health`);
            assert.strictEqual(response.status, 429, 'Should return 429 after exceeding rate limit');
        });
    });

    // ============================================
    // Body Size Limit (Task 5.9)
    // ============================================

    describe('Body size limit', () => {
        it('should reject oversized request bodies with 413 (Task 5.9)', async () => {
            // Use /api/connect which is CSRF-exempt to test body size limit directly
            const largeBody = JSON.stringify({
                host: 'test',
                port: 52773,
                namespace: 'USER',
                username: 'admin',
                password: 'x'.repeat(11 * 1024 * 1024),
            });

            const response = await fetch(`${baseUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: largeBody,
            });

            assert.strictEqual(response.status, 413, 'Should reject bodies larger than 10MB');
        });
    });
});
