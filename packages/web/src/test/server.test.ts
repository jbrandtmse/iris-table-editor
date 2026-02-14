/**
 * Unit tests for Express server
 * Story 15.1: Server Bootstrap - Task 7
 *
 * Tests health endpoint, static file serving, SPA fallback, and port configuration.
 * Uses Node.js built-in test runner and native fetch.
 */
import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

let server: Server;
let baseUrl: string;

/**
 * Start the server on a random available port before all tests.
 */
async function startTestServer(): Promise<void> {
    // Import inside function so we can control when the module loads
    const { app, server: httpServer } = await import('../server/server');
    server = httpServer;

    await new Promise<void>((resolve) => {
        server.listen(0, () => {
            const address = server.address() as AddressInfo;
            baseUrl = `http://localhost:${address.port}`;
            resolve();
        });
    });

    // Suppress unused variable warning - app is used by httpServer
    void app;
}

/**
 * Stop the server after all tests.
 */
async function stopTestServer(): Promise<void> {
    if (server) {
        await new Promise<void>((resolve, reject) => {
            server.close((err) => {
                if (err) { reject(err); } else { resolve(); }
            });
        });
    }
}

describe('Express Server', () => {
    before(async () => {
        await startTestServer();
    });

    after(async () => {
        await stopTestServer();
    });

    // ============================================
    // Health Endpoint
    // ============================================

    describe('GET /health', () => {
        it('should return status ok with 200', async () => {
            const response = await fetch(`${baseUrl}/health`);
            assert.strictEqual(response.status, 200);

            const body = await response.json();
            assert.deepStrictEqual(body, { status: 'ok' });
        });

        it('should return JSON content type', async () => {
            const response = await fetch(`${baseUrl}/health`);
            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('application/json'),
                `Expected application/json but got ${contentType}`
            );
        });
    });

    // ============================================
    // Static File Serving
    // ============================================

    describe('Static file serving', () => {
        it('should serve index.html at root URL', async () => {
            const response = await fetch(`${baseUrl}/`);
            assert.strictEqual(response.status, 200);

            const body = await response.text();
            assert.ok(
                body.includes('IRIS Table Editor'),
                'Root should serve the placeholder page'
            );
        });

        it('should serve index.html with correct content type', async () => {
            const response = await fetch(`${baseUrl}/`);
            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('text/html'),
                `Expected text/html but got ${contentType}`
            );
        });
    });

    // ============================================
    // SPA Fallback
    // ============================================

    describe('SPA fallback', () => {
        it('should return index.html for unknown routes', async () => {
            const response = await fetch(`${baseUrl}/some/unknown/route`);
            assert.strictEqual(response.status, 200);

            const body = await response.text();
            assert.ok(
                body.includes('IRIS Table Editor'),
                'Unknown routes should fall back to index.html'
            );
        });

        it('should return index.html for deep nested routes', async () => {
            const response = await fetch(`${baseUrl}/app/tables/edit/123`);
            assert.strictEqual(response.status, 200);

            const body = await response.text();
            assert.ok(
                body.includes('IRIS Table Editor'),
                'Deep nested routes should fall back to index.html'
            );
        });
    });

    // ============================================
    // Server Configuration
    // ============================================

    describe('Server configuration', () => {
        it('should start on the assigned port', () => {
            const address = server.address() as AddressInfo;
            assert.ok(address.port > 0, 'Server should be listening on a port');
        });

        it('should be listening', () => {
            assert.ok(server.listening, 'Server should be in listening state');
        });
    });

    // ============================================
    // JSON Body Parser
    // ============================================

    describe('JSON body parser', () => {
        it('should accept JSON POST requests', async () => {
            // POST to health endpoint (not defined for POST, but body parser should work)
            const response = await fetch(`${baseUrl}/health`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: 'data' }),
            });
            // Should get the SPA fallback or 404, not a parse error
            assert.ok(
                response.status < 500,
                'Server should not return 500 for valid JSON POST'
            );
        });
    });
});
