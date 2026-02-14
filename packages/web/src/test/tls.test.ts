/**
 * Unit tests for HTTPS/TLS Configuration
 * Story 18.4: HTTPS/TLS Configuration - Task 5
 *
 * Tests trust proxy config, HTTPS redirect middleware, docker-compose.tls.yml,
 * and cookie security verification. Uses Node.js built-in test runner.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { getConfig } from '../server/config';
import { createAppServer } from '../server/server';

// Resolve paths relative to repo root
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const webPkgDir = path.join(repoRoot, 'packages', 'web');

/**
 * Environment variables that may be modified during tests.
 */
const ENV_KEYS = [
    'PORT', 'NODE_ENV', 'ALLOWED_ORIGINS', 'SESSION_SECRET',
    'CSRF_SECRET', 'SESSION_TIMEOUT', 'RATE_LIMIT_MAX',
    'TLS_CERT', 'TLS_KEY', 'TRUST_PROXY', 'FORCE_HTTPS',
];

let savedEnv: Record<string, string | undefined>;

function saveEnv(): void {
    savedEnv = {};
    for (const key of ENV_KEYS) {
        savedEnv[key] = process.env[key];
    }
}

function restoreEnv(): void {
    for (const key of ENV_KEYS) {
        if (savedEnv[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = savedEnv[key];
        }
    }
}

function clearEnv(): void {
    for (const key of ENV_KEYS) {
        delete process.env[key];
    }
}

// ============================================
// Config: TRUST_PROXY and FORCE_HTTPS
// ============================================

describe('TLS config: TRUST_PROXY', () => {
    beforeEach(() => {
        saveEnv();
        clearEnv();
    });

    afterEach(() => {
        restoreEnv();
    });

    it('should default trustProxy to false in development', () => {
        const cfg = getConfig();
        assert.strictEqual(cfg.trustProxy, false);
    });

    it('should default trustProxy to true in production when TRUST_PROXY not set', () => {
        process.env.NODE_ENV = 'production';
        const cfg = getConfig();
        assert.strictEqual(cfg.trustProxy, true);
    });

    it('should read TRUST_PROXY=true from environment', () => {
        process.env.TRUST_PROXY = 'true';
        const cfg = getConfig();
        assert.strictEqual(cfg.trustProxy, true);
    });

    it('should read TRUST_PROXY=false to override production default', () => {
        process.env.NODE_ENV = 'production';
        process.env.TRUST_PROXY = 'false';
        const cfg = getConfig();
        assert.strictEqual(cfg.trustProxy, false);
    });
});

describe('TLS config: FORCE_HTTPS', () => {
    beforeEach(() => {
        saveEnv();
        clearEnv();
    });

    afterEach(() => {
        restoreEnv();
    });

    it('should default forceHttps to false', () => {
        const cfg = getConfig();
        assert.strictEqual(cfg.forceHttps, false);
    });

    it('should read FORCE_HTTPS=true from environment', () => {
        process.env.FORCE_HTTPS = 'true';
        const cfg = getConfig();
        assert.strictEqual(cfg.forceHttps, true);
    });

    it('should treat FORCE_HTTPS=false as false', () => {
        process.env.FORCE_HTTPS = 'false';
        const cfg = getConfig();
        assert.strictEqual(cfg.forceHttps, false);
    });
});

// ============================================
// Server: trust proxy setting
// ============================================

describe('Server trust proxy setting', () => {
    beforeEach(() => {
        saveEnv();
        clearEnv();
    });

    afterEach(() => {
        restoreEnv();
    });

    it('should set trust proxy when TRUST_PROXY=true', () => {
        process.env.TRUST_PROXY = 'true';
        const result = createAppServer({ skipSecurity: true, cleanupIntervalMs: 0 });
        try {
            assert.strictEqual(result.app.get('trust proxy'), 1);
        } finally {
            result.sessionManager.clearCleanupInterval();
            result.server.close();
        }
    });

    it('should not set trust proxy when TRUST_PROXY is not set in development', () => {
        const result = createAppServer({ skipSecurity: true, cleanupIntervalMs: 0 });
        try {
            // Express defaults trust proxy to false (undefined)
            const setting = result.app.get('trust proxy');
            assert.ok(setting === false || setting === undefined, `Expected false or undefined, got ${setting}`);
        } finally {
            result.sessionManager.clearCleanupInterval();
            result.server.close();
        }
    });
});

// ============================================
// HTTPS redirect middleware
// ============================================

describe('HTTPS redirect middleware', () => {
    let server: Server;
    let baseUrl: string;

    beforeEach(() => {
        saveEnv();
        clearEnv();
    });

    afterEach(async () => {
        restoreEnv();
        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    it('should redirect HTTP to HTTPS when FORCE_HTTPS=true', async () => {
        process.env.FORCE_HTTPS = 'true';
        process.env.TRUST_PROXY = 'true';
        const result = createAppServer({
            securityOptions: { csrfSecret: 'test-csrf-secret' },
            cleanupIntervalMs: 0,
        });
        server = result.server;

        await new Promise<void>((resolve) => {
            server.listen(0, () => {
                const addr = server.address() as AddressInfo;
                baseUrl = `http://localhost:${addr.port}`;
                resolve();
            });
        });

        // Request without X-Forwarded-Proto (not secure) — should redirect
        const res = await fetch(`${baseUrl}/some-page`, { redirect: 'manual' });
        assert.strictEqual(res.status, 301);
        const location = res.headers.get('location');
        assert.ok(location, 'Should have Location header');
        assert.ok(location!.startsWith('https://'), `Location should start with https://, got: ${location}`);

        result.sessionManager.clearCleanupInterval();
    });

    it('should skip redirect for /health endpoint', async () => {
        process.env.FORCE_HTTPS = 'true';
        process.env.TRUST_PROXY = 'true';
        const result = createAppServer({
            securityOptions: { csrfSecret: 'test-csrf-secret' },
            cleanupIntervalMs: 0,
        });
        server = result.server;

        await new Promise<void>((resolve) => {
            server.listen(0, () => {
                const addr = server.address() as AddressInfo;
                baseUrl = `http://localhost:${addr.port}`;
                resolve();
            });
        });

        const res = await fetch(`${baseUrl}/health`);
        assert.strictEqual(res.status, 200);
        const body = await res.json() as { status: string };
        assert.strictEqual(body.status, 'ok');

        result.sessionManager.clearCleanupInterval();
    });

    it('should not redirect when FORCE_HTTPS is not set', async () => {
        const result = createAppServer({ skipSecurity: true, cleanupIntervalMs: 0 });
        server = result.server;

        await new Promise<void>((resolve) => {
            server.listen(0, () => {
                const addr = server.address() as AddressInfo;
                baseUrl = `http://localhost:${addr.port}`;
                resolve();
            });
        });

        const res = await fetch(`${baseUrl}/health`);
        assert.strictEqual(res.status, 200);

        result.sessionManager.clearCleanupInterval();
    });
});

// ============================================
// docker-compose.tls.yml
// ============================================

describe('docker-compose.tls.yml', () => {
    const composeTlsPath = path.join(webPkgDir, 'docker-compose.tls.yml');

    it('should exist at packages/web/docker-compose.tls.yml', () => {
        assert.ok(fs.existsSync(composeTlsPath), 'docker-compose.tls.yml not found');
    });

    it('should map port 443', () => {
        const content = fs.readFileSync(composeTlsPath, 'utf-8');
        assert.ok(content.includes('443'), 'Should map port 443');
    });

    it('should set TLS_CERT environment variable', () => {
        const content = fs.readFileSync(composeTlsPath, 'utf-8');
        assert.ok(content.includes('TLS_CERT'), 'Should set TLS_CERT');
    });

    it('should set TLS_KEY environment variable', () => {
        const content = fs.readFileSync(composeTlsPath, 'utf-8');
        assert.ok(content.includes('TLS_KEY'), 'Should set TLS_KEY');
    });

    it('should mount certificates volume as read-only', () => {
        const content = fs.readFileSync(composeTlsPath, 'utf-8');
        assert.ok(content.includes('/certs'), 'Should reference /certs directory');
        assert.ok(content.includes(':ro'), 'Certificate volume should be read-only');
    });

    it('should reference cert paths inside /certs/', () => {
        const content = fs.readFileSync(composeTlsPath, 'utf-8');
        assert.ok(content.includes('/certs/cert.pem'), 'TLS_CERT should point to /certs/cert.pem');
        assert.ok(content.includes('/certs/key.pem'), 'TLS_KEY should point to /certs/key.pem');
    });
});

// ============================================
// Cookie security verification (Task 4)
// ============================================

describe('Cookie security in production', () => {
    it('CSRF cookie should have secure flag in production', () => {
        const securityPath = path.join(webPkgDir, 'src', 'server', 'security.ts');
        const content = fs.readFileSync(securityPath, 'utf-8');
        assert.ok(
            content.includes("secure: cfg.nodeEnv === 'production'"),
            'CSRF cookie should set secure: true in production'
        );
    });

    it('session cookie should have Secure flag in production', () => {
        const apiProxyPath = path.join(webPkgDir, 'src', 'server', 'apiProxy.ts');
        const content = fs.readFileSync(apiProxyPath, 'utf-8');
        assert.ok(
            content.includes("production") && content.includes('Secure'),
            'Session cookie should include Secure flag in production'
        );
    });
});

// ============================================
// Startup log includes TLS config
// ============================================

describe('Startup config logging', () => {
    it('logStartupConfig should log TRUST_PROXY', () => {
        const configPath = path.join(webPkgDir, 'src', 'server', 'config.ts');
        const content = fs.readFileSync(configPath, 'utf-8');
        assert.ok(content.includes('TRUST_PROXY'), 'logStartupConfig should log TRUST_PROXY');
    });

    it('logStartupConfig should log FORCE_HTTPS', () => {
        const configPath = path.join(webPkgDir, 'src', 'server', 'config.ts');
        const content = fs.readFileSync(configPath, 'utf-8');
        assert.ok(content.includes('FORCE_HTTPS'), 'logStartupConfig should log FORCE_HTTPS');
    });
});
