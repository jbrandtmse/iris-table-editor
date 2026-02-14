/**
 * Tests for Browser Navigation
 * Story 17.5: Browser Navigation - Task 5
 *
 * Tests URL updates on table selection, browser back/forward,
 * post-connect redirect, and parseTableRoute logic.
 *
 * Uses Node.js built-in test runner.
 */
import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { createAppServer } from '../server/server';

// ============================================
// Test Helpers
// ============================================

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

/** Read spa-router.js source for static analysis tests */
function readSpaRouterSource(): string {
    const routerPath = path.resolve(__dirname, '../../public/spa-router.js');
    return fs.readFileSync(routerPath, 'utf-8');
}

// ============================================
// parseTableRoute Unit Tests (Task 5.4)
// ============================================

describe('Browser Navigation - parseTableRoute (Story 17.5)', () => {
    /**
     * Replicate parseTableRoute logic for unit testing in Node.js.
     * The actual function runs in the browser, so we mirror it here.
     * Must stay in sync with spa-router.js parseTableRoute().
     */
    function parseTableRoute(pathname: string): { namespace: string; tableName: string } | null {
        const match = pathname.match(/^\/table\/([^/]+)\/([^/]+)$/);
        if (match) {
            try {
                return {
                    namespace: decodeURIComponent(match[1]),
                    tableName: decodeURIComponent(match[2]),
                };
            } catch (_e) {
                return null;
            }
        }
        return null;
    }

    it('should parse a simple table route', () => {
        const result = parseTableRoute('/table/USER/Sample.Person');
        assert.deepStrictEqual(result, {
            namespace: 'USER',
            tableName: 'Sample.Person',
        });
    });

    it('should parse a route with encoded characters', () => {
        const result = parseTableRoute('/table/%25SYS/My%20Table');
        assert.deepStrictEqual(result, {
            namespace: '%SYS',
            tableName: 'My Table',
        });
    });

    it('should parse a route with URL-encoded special characters', () => {
        const result = parseTableRoute('/table/SAMPLES/Schema%2ETableName');
        assert.deepStrictEqual(result, {
            namespace: 'SAMPLES',
            tableName: 'Schema.TableName',
        });
    });

    it('should return null for root path', () => {
        const result = parseTableRoute('/');
        assert.strictEqual(result, null);
    });

    it('should return null for incomplete table route (missing table name)', () => {
        const result = parseTableRoute('/table/USER');
        assert.strictEqual(result, null);
    });

    it('should return null for path with only /table/', () => {
        const result = parseTableRoute('/table/');
        assert.strictEqual(result, null);
    });

    it('should return null for non-table paths', () => {
        assert.strictEqual(parseTableRoute('/about'), null);
        assert.strictEqual(parseTableRoute('/api/connect'), null);
        assert.strictEqual(parseTableRoute('/health'), null);
    });

    it('should return null for paths with extra segments', () => {
        const result = parseTableRoute('/table/USER/Sample.Person/extra');
        assert.strictEqual(result, null);
    });

    it('should return null for empty path', () => {
        const result = parseTableRoute('');
        assert.strictEqual(result, null);
    });

    it('should handle namespace with numbers', () => {
        const result = parseTableRoute('/table/IRIS2021/TestTable');
        assert.deepStrictEqual(result, {
            namespace: 'IRIS2021',
            tableName: 'TestTable',
        });
    });

    it('should handle hyphenated names', () => {
        const result = parseTableRoute('/table/my-namespace/my-table');
        assert.deepStrictEqual(result, {
            namespace: 'my-namespace',
            tableName: 'my-table',
        });
    });

    it('should return null for malformed percent-encoding', () => {
        const result = parseTableRoute('/table/USER/My%ZZTable');
        assert.strictEqual(result, null);
    });
});

// ============================================
// SPA Router Source Analysis (Tasks 5.2, 5.3)
// ============================================

describe('Browser Navigation - SPA Router Source (Story 17.5)', () => {
    let source: string;

    before(() => {
        source = readSpaRouterSource();
    });

    it('Task 5.2: spa-router.js should include pushState usage', () => {
        assert.ok(
            source.includes('history.pushState'),
            'spa-router.js should use history.pushState for URL updates'
        );
    });

    it('Task 5.3: spa-router.js should include popstate event listener', () => {
        assert.ok(
            source.includes('popstate'),
            'spa-router.js should listen for popstate events'
        );
        assert.ok(
            source.includes("addEventListener('popstate'") || source.includes('addEventListener("popstate"'),
            'spa-router.js should register a popstate event listener'
        );
    });

    it('should listen for tableSelected bridge events', () => {
        assert.ok(
            source.includes("'tableSelected'") || source.includes('"tableSelected"'),
            'spa-router.js should register a handler for tableSelected events'
        );
    });

    it('should use encodeURIComponent for URL building', () => {
        assert.ok(
            source.includes('encodeURIComponent'),
            'spa-router.js should encode namespace and table name in URLs'
        );
    });

    it('should track current route to prevent duplicate pushState calls', () => {
        assert.ok(
            source.includes('currentRoute'),
            'spa-router.js should track the current route'
        );
        assert.ok(
            source.includes('isSameRoute'),
            'spa-router.js should check for duplicate routes before pushState'
        );
    });

    it('should handle bridge availability for post-connect redirect', () => {
        assert.ok(
            source.includes('iteMessageBridge'),
            'spa-router.js should check for bridge availability'
        );
        assert.ok(
            source.includes('handleInitialRoute'),
            'spa-router.js should have initial route handling'
        );
    });

    it('should listen for ite-ws-reconnected event', () => {
        assert.ok(
            source.includes('ite-ws-reconnected'),
            'spa-router.js should re-register handlers on WebSocket reconnect'
        );
    });

    it('should expose parseTableRoute for testing', () => {
        assert.ok(
            source.includes('iteSpaRouter'),
            'spa-router.js should expose iteSpaRouter on window'
        );
        assert.ok(
            source.includes('parseTableRoute'),
            'iteSpaRouter should expose parseTableRoute'
        );
    });
});

// ============================================
// SPA Catch-All for Deep Table Routes (Task 5.5)
// ============================================

describe('Browser Navigation - SPA Catch-All (Story 17.5)', () => {
    before(async () => {
        await startTestServer();
    });

    after(async () => {
        await stopTestServer();
    });

    it('Task 5.5: should return HTML for deep table routes', async () => {
        const response = await fetch(`${baseUrl}/table/USER/Sample.Person`);
        assert.strictEqual(response.status, 200);

        const contentType = response.headers.get('content-type') || '';
        assert.ok(
            contentType.includes('text/html'),
            `Expected text/html but got ${contentType}`
        );

        const body = await response.text();
        assert.ok(
            body.includes('IRIS Table Editor'),
            'Deep table route should return SPA shell HTML'
        );
    });

    it('should return HTML for table routes with encoded characters', async () => {
        const response = await fetch(`${baseUrl}/table/%25SYS/My%20Table`);
        assert.strictEqual(response.status, 200);

        const body = await response.text();
        assert.ok(
            body.includes('IRIS Table Editor'),
            'Encoded table route should return SPA shell HTML'
        );
    });

    it('should include spa-router.js in the SPA shell', async () => {
        const response = await fetch(`${baseUrl}/table/SAMPLES/Customer`);
        const body = await response.text();

        assert.ok(
            body.includes('spa-router.js'),
            'SPA shell should include spa-router.js for client-side routing'
        );
    });
});

// ============================================
// buildTablePath Unit Tests
// ============================================

describe('Browser Navigation - buildTablePath (Story 17.5)', () => {
    /**
     * Mirror buildTablePath from spa-router.js for unit testing.
     */
    function buildTablePath(namespace: string, tableName: string): string {
        return '/table/' + encodeURIComponent(namespace) + '/' + encodeURIComponent(tableName);
    }

    it('should build a simple table path', () => {
        assert.strictEqual(
            buildTablePath('USER', 'Sample.Person'),
            '/table/USER/Sample.Person'
        );
    });

    it('should encode special characters in namespace', () => {
        assert.strictEqual(
            buildTablePath('%SYS', 'Config'),
            '/table/%25SYS/Config'
        );
    });

    it('should encode spaces in table name', () => {
        assert.strictEqual(
            buildTablePath('USER', 'My Table'),
            '/table/USER/My%20Table'
        );
    });

    it('should round-trip with parseTableRoute', () => {
        function parseTableRoute(pathname: string): { namespace: string; tableName: string } | null {
            const match = pathname.match(/^\/table\/([^/]+)\/([^/]+)$/);
            if (match) {
                try {
                    return {
                        namespace: decodeURIComponent(match[1]),
                        tableName: decodeURIComponent(match[2]),
                    };
                } catch (_e) {
                    return null;
                }
            }
            return null;
        }

        const path = buildTablePath('%SYS', 'My Table');
        const parsed = parseTableRoute(path);
        assert.deepStrictEqual(parsed, {
            namespace: '%SYS',
            tableName: 'My Table',
        });
    });
});
