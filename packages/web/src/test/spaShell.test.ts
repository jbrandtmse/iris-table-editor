/**
 * Unit tests for SPA Shell
 * Story 17.1: SPA Shell - Task 5
 *
 * Tests webview asset serving, SPA catch-all routing,
 * and WebMessageBridge behavior.
 * Uses Node.js built-in test runner.
 */
import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { createAppServer } from '../server/server';

let httpServer: Server;
let baseUrl: string;

async function startTestServer(): Promise<void> {
    const result = createAppServer({
        skipSecurity: true,
        cleanupIntervalMs: 0,
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

describe('SPA Shell (Story 17.1)', () => {
    before(async () => {
        await startTestServer();
    });

    after(async () => {
        await stopTestServer();
    });

    // ============================================
    // SPA Catch-All Routing (Task 4)
    // ============================================

    describe('SPA catch-all routing', () => {
        it('should return HTML for /table/SAMPLES/Customer', async () => {
            const response = await fetch(`${baseUrl}/table/SAMPLES/Customer`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('text/html'),
                `Expected text/html but got ${contentType}`
            );

            const body = await response.text();
            assert.ok(
                body.includes('IRIS Table Editor'),
                'Should return the SPA shell HTML'
            );
        });

        it('should return HTML for deeply nested routes', async () => {
            const response = await fetch(`${baseUrl}/table/USER/MySchema.MyTable`);
            assert.strictEqual(response.status, 200);

            const body = await response.text();
            assert.ok(
                body.includes('IRIS Table Editor'),
                'Deep nested routes should return SPA shell'
            );
        });

        it('should return JSON for API routes (not HTML)', async () => {
            const response = await fetch(`${baseUrl}/health`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('application/json'),
                `Expected application/json for API routes but got ${contentType}`
            );

            const body = await response.json() as { status: string; uptime: number; connections: number };
            assert.strictEqual(body.status, 'ok');
            assert.strictEqual(typeof body.uptime, 'number');
            assert.strictEqual(typeof body.connections, 'number');
        });

        it('should return HTML for root URL', async () => {
            const response = await fetch(`${baseUrl}/`);
            assert.strictEqual(response.status, 200);

            const body = await response.text();
            assert.ok(
                body.includes('IRIS Table Editor'),
                'Root URL should return SPA shell'
            );
        });
    });

    // ============================================
    // Webview Asset Serving (Task 1)
    // ============================================

    describe('Webview asset serving', () => {
        it('should serve /webview/main.js with 200', async () => {
            const response = await fetch(`${baseUrl}/webview/main.js`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('javascript'),
                `Expected JavaScript content type but got ${contentType}`
            );
        });

        it('should serve /webview/grid.js with 200', async () => {
            const response = await fetch(`${baseUrl}/webview/grid.js`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('javascript'),
                `Expected JavaScript content type but got ${contentType}`
            );
        });

        it('should serve /webview/styles.css with 200', async () => {
            const response = await fetch(`${baseUrl}/webview/styles.css`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('text/css'),
                `Expected text/css but got ${contentType}`
            );
        });

        it('should serve /webview/theme.css with 200', async () => {
            const response = await fetch(`${baseUrl}/webview/theme.css`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('text/css'),
                `Expected text/css but got ${contentType}`
            );
        });

        it('should serve /webview/grid-styles.css with 200', async () => {
            const response = await fetch(`${baseUrl}/webview/grid-styles.css`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('text/css'),
                `Expected text/css but got ${contentType}`
            );
        });

        it('should serve /webview/desktopThemeBridge.css with 200', async () => {
            const response = await fetch(`${baseUrl}/webview/desktopThemeBridge.css`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('text/css'),
                `Expected text/css but got ${contentType}`
            );
        });
    });

    // ============================================
    // SPA Shell HTML Structure (Task 1)
    // ============================================

    describe('SPA shell HTML structure', () => {
        it('should include webview CSS links', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();

            assert.ok(body.includes('/webview/theme.css'), 'Should link webview theme.css');
            assert.ok(body.includes('/webview/styles.css'), 'Should link webview styles.css');
            assert.ok(body.includes('/webview/grid-styles.css'), 'Should link webview grid-styles.css');
            assert.ok(body.includes('webThemeBridge.css'), 'Should link webThemeBridge.css');
        });

        it('should include webview script tags', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();

            assert.ok(body.includes('/webview/main.js'), 'Should include webview main.js script');
            assert.ok(body.includes('/webview/grid.js'), 'Should include webview grid.js script');
        });

        it('should include WebMessageBridge script before webview scripts', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();

            const bridgePos = body.indexOf('WebMessageBridge.js');
            const mainPos = body.indexOf('/webview/main.js');
            assert.ok(bridgePos > 0, 'Should include WebMessageBridge.js');
            assert.ok(mainPos > 0, 'Should include /webview/main.js');
            assert.ok(
                bridgePos < mainPos,
                'WebMessageBridge.js should load before webview/main.js'
            );
        });

        it('should include .ite-container inside connected view', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();

            assert.ok(
                body.includes('ite-container'),
                'Should include .ite-container for webview rendering'
            );
            assert.ok(
                body.includes('ite-connected-view__body'),
                'Should include .ite-connected-view__body wrapper'
            );
        });

        it('should include spa-router.js script', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();

            assert.ok(body.includes('spa-router.js'), 'Should include spa-router.js');
        });
    });

    // ============================================
    // Static File Serving (existing public files)
    // ============================================

    describe('Public static file serving', () => {
        it('should serve WebMessageBridge.js with 200', async () => {
            const response = await fetch(`${baseUrl}/WebMessageBridge.js`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('javascript'),
                `Expected JavaScript content type but got ${contentType}`
            );
        });

        it('should serve spa-router.js with 200', async () => {
            const response = await fetch(`${baseUrl}/spa-router.js`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('javascript'),
                `Expected JavaScript content type but got ${contentType}`
            );
        });

        it('should serve connection-form.css with 200', async () => {
            const response = await fetch(`${baseUrl}/connection-form.css`);
            assert.strictEqual(response.status, 200);
        });
    });
});
