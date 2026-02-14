/**
 * Unit tests for Centralized Environment Configuration
 * Story 18.2: Environment Configuration - Task 5
 *
 * Tests default values, env var parsing, production validation,
 * and TLS validation. Uses Node.js built-in test runner.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import { getConfig, validateConfig } from '../server/config';
import type { AppConfig } from '../server/config';

/**
 * Save and restore environment variables around each test.
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
// Default Values (Task 5.2)
// ============================================

describe('Config default values', () => {
    beforeEach(() => {
        saveEnv();
        clearEnv();
    });

    afterEach(() => {
        restoreEnv();
    });

    it('should default PORT to 3000', () => {
        const cfg = getConfig();
        assert.strictEqual(cfg.port, 3000);
    });

    it('should default NODE_ENV to development', () => {
        const cfg = getConfig();
        assert.strictEqual(cfg.nodeEnv, 'development');
    });

    it('should default allowedOrigins to undefined', () => {
        const cfg = getConfig();
        assert.strictEqual(cfg.allowedOrigins, undefined);
    });

    it('should generate a random sessionSecret when not set', () => {
        const cfg = getConfig();
        assert.ok(cfg.sessionSecret.length > 0, 'Should generate a non-empty secret');
        assert.ok(cfg.sessionSecret.length >= 32, 'Random secret should be at least 32 chars');
    });

    it('should use sessionSecret as csrfSecret fallback', () => {
        const cfg = getConfig();
        assert.strictEqual(cfg.csrfSecret, cfg.sessionSecret);
    });

    it('should default sessionTimeout to 1800', () => {
        const cfg = getConfig();
        assert.strictEqual(cfg.sessionTimeout, 1800);
    });

    it('should default rateLimitMax to 100', () => {
        const cfg = getConfig();
        assert.strictEqual(cfg.rateLimitMax, 100);
    });

    it('should default tlsCert to undefined', () => {
        const cfg = getConfig();
        assert.strictEqual(cfg.tlsCert, undefined);
    });

    it('should default tlsKey to undefined', () => {
        const cfg = getConfig();
        assert.strictEqual(cfg.tlsKey, undefined);
    });
});

// ============================================
// Env Var Parsing (Task 5.3, 5.4)
// ============================================

describe('Config env var parsing', () => {
    beforeEach(() => {
        saveEnv();
        clearEnv();
    });

    afterEach(() => {
        restoreEnv();
    });

    it('should parse PORT as integer', () => {
        process.env.PORT = '8080';
        const cfg = getConfig();
        assert.strictEqual(cfg.port, 8080);
    });

    it('should fall back to default PORT on invalid value', () => {
        process.env.PORT = 'abc';
        const cfg = getConfig();
        assert.strictEqual(cfg.port, 3000);
    });

    it('should read NODE_ENV from environment', () => {
        process.env.NODE_ENV = 'production';
        const cfg = getConfig();
        assert.strictEqual(cfg.nodeEnv, 'production');
    });

    it('should parse ALLOWED_ORIGINS as comma-separated array', () => {
        process.env.ALLOWED_ORIGINS = 'https://a.example.com,https://b.example.com';
        const cfg = getConfig();
        assert.deepStrictEqual(cfg.allowedOrigins, ['https://a.example.com', 'https://b.example.com']);
    });

    it('should trim whitespace from ALLOWED_ORIGINS entries', () => {
        process.env.ALLOWED_ORIGINS = ' https://a.com , https://b.com ';
        const cfg = getConfig();
        assert.deepStrictEqual(cfg.allowedOrigins, ['https://a.com', 'https://b.com']);
    });

    it('should filter empty entries from ALLOWED_ORIGINS', () => {
        process.env.ALLOWED_ORIGINS = 'https://a.com,,https://b.com,';
        const cfg = getConfig();
        assert.deepStrictEqual(cfg.allowedOrigins, ['https://a.com', 'https://b.com']);
    });

    it('should return undefined for empty ALLOWED_ORIGINS', () => {
        process.env.ALLOWED_ORIGINS = '';
        const cfg = getConfig();
        assert.strictEqual(cfg.allowedOrigins, undefined);
    });

    it('should use SESSION_SECRET from environment', () => {
        process.env.SESSION_SECRET = 'my-secret';
        const cfg = getConfig();
        assert.strictEqual(cfg.sessionSecret, 'my-secret');
    });

    it('should use CSRF_SECRET from environment when set', () => {
        process.env.SESSION_SECRET = 'session-secret';
        process.env.CSRF_SECRET = 'csrf-secret';
        const cfg = getConfig();
        assert.strictEqual(cfg.csrfSecret, 'csrf-secret');
    });

    it('should fall back csrfSecret to sessionSecret when CSRF_SECRET not set', () => {
        process.env.SESSION_SECRET = 'session-secret';
        const cfg = getConfig();
        assert.strictEqual(cfg.csrfSecret, 'session-secret');
    });

    it('should parse SESSION_TIMEOUT as integer seconds', () => {
        process.env.SESSION_TIMEOUT = '3600';
        const cfg = getConfig();
        assert.strictEqual(cfg.sessionTimeout, 3600);
    });

    it('should fall back to default SESSION_TIMEOUT on invalid value', () => {
        process.env.SESSION_TIMEOUT = 'invalid';
        const cfg = getConfig();
        assert.strictEqual(cfg.sessionTimeout, 1800);
    });

    it('should parse RATE_LIMIT_MAX as integer', () => {
        process.env.RATE_LIMIT_MAX = '50';
        const cfg = getConfig();
        assert.strictEqual(cfg.rateLimitMax, 50);
    });

    it('should fall back to default RATE_LIMIT_MAX on invalid value', () => {
        process.env.RATE_LIMIT_MAX = 'abc';
        const cfg = getConfig();
        assert.strictEqual(cfg.rateLimitMax, 100);
    });

    it('should read TLS_CERT path', () => {
        process.env.TLS_CERT = '/path/to/cert.pem';
        const cfg = getConfig();
        assert.strictEqual(cfg.tlsCert, '/path/to/cert.pem');
    });

    it('should read TLS_KEY path', () => {
        process.env.TLS_KEY = '/path/to/key.pem';
        const cfg = getConfig();
        assert.strictEqual(cfg.tlsKey, '/path/to/key.pem');
    });

    it('should reject negative PORT and use default', () => {
        process.env.PORT = '-1';
        const cfg = getConfig();
        assert.strictEqual(cfg.port, 3000);
    });

    it('should reject zero PORT and use default', () => {
        process.env.PORT = '0';
        const cfg = getConfig();
        assert.strictEqual(cfg.port, 3000);
    });

    it('should reject negative SESSION_TIMEOUT and use default', () => {
        process.env.SESSION_TIMEOUT = '-100';
        const cfg = getConfig();
        assert.strictEqual(cfg.sessionTimeout, 1800);
    });

    it('should reject zero SESSION_TIMEOUT and use default', () => {
        process.env.SESSION_TIMEOUT = '0';
        const cfg = getConfig();
        assert.strictEqual(cfg.sessionTimeout, 1800);
    });

    it('should reject negative RATE_LIMIT_MAX and use default', () => {
        process.env.RATE_LIMIT_MAX = '-5';
        const cfg = getConfig();
        assert.strictEqual(cfg.rateLimitMax, 100);
    });

    it('should reject zero RATE_LIMIT_MAX and use default', () => {
        process.env.RATE_LIMIT_MAX = '0';
        const cfg = getConfig();
        assert.strictEqual(cfg.rateLimitMax, 100);
    });

    it('should track sessionSecretExplicit as false when not set', () => {
        const cfg = getConfig();
        assert.strictEqual(cfg.sessionSecretExplicit, false);
    });

    it('should track sessionSecretExplicit as true when set', () => {
        process.env.SESSION_SECRET = 'my-secret';
        const cfg = getConfig();
        assert.strictEqual(cfg.sessionSecretExplicit, true);
    });
});

// ============================================
// Production Validation (Task 5.5)
// ============================================

describe('Config production validation', () => {
    beforeEach(() => {
        saveEnv();
        clearEnv();
    });

    afterEach(() => {
        restoreEnv();
    });

    it('should return false in development when SESSION_SECRET is not set', () => {
        const cfg = getConfig();
        // Dev mode: warn but don't exit
        const result = validateConfig(cfg);
        assert.strictEqual(result, false);
    });

    it('should return true in development when SESSION_SECRET is set', () => {
        process.env.SESSION_SECRET = 'my-secret';
        const cfg = getConfig();
        const result = validateConfig(cfg);
        assert.strictEqual(result, true);
    });

    it('should call process.exit(1) in production when SESSION_SECRET is not set', () => {
        process.env.NODE_ENV = 'production';
        const cfg = getConfig();

        // Intercept process.exit to prevent test from actually exiting
        let exitCode: number | undefined;
        const originalExit = process.exit;
        process.exit = ((code?: number) => {
            exitCode = code;
        }) as typeof process.exit;

        try {
            validateConfig(cfg);
            assert.strictEqual(exitCode, 1, 'Should exit with code 1');
        } finally {
            process.exit = originalExit;
        }
    });

    it('should not exit in production when SESSION_SECRET is set', () => {
        process.env.NODE_ENV = 'production';
        process.env.SESSION_SECRET = 'prod-secret';
        const cfg = getConfig();

        let exitCalled = false;
        const originalExit = process.exit;
        process.exit = (() => {
            exitCalled = true;
        }) as typeof process.exit;

        try {
            const result = validateConfig(cfg);
            assert.strictEqual(exitCalled, false, 'Should not exit');
            assert.strictEqual(result, true);
        } finally {
            process.exit = originalExit;
        }
    });
});

// ============================================
// TLS Validation (Task 5.6)
// ============================================

describe('Config TLS validation', () => {
    beforeEach(() => {
        saveEnv();
        clearEnv();
        // Set SESSION_SECRET so we don't trigger that validation
        process.env.SESSION_SECRET = 'test-secret';
    });

    afterEach(() => {
        restoreEnv();
    });

    it('should pass when neither TLS_CERT nor TLS_KEY is set', () => {
        const cfg = getConfig();
        const result = validateConfig(cfg);
        assert.strictEqual(result, true);
    });

    it('should pass when both TLS_CERT and TLS_KEY are set', () => {
        process.env.TLS_CERT = '/path/to/cert.pem';
        process.env.TLS_KEY = '/path/to/key.pem';
        const cfg = getConfig();
        const result = validateConfig(cfg);
        assert.strictEqual(result, true);
    });

    it('should warn in dev when only TLS_CERT is set (missing TLS_KEY)', () => {
        process.env.TLS_CERT = '/path/to/cert.pem';
        const cfg = getConfig();
        const result = validateConfig(cfg);
        assert.strictEqual(result, false, 'Should return false when TLS_KEY is missing');
    });

    it('should warn in dev when only TLS_KEY is set (missing TLS_CERT)', () => {
        process.env.TLS_KEY = '/path/to/key.pem';
        const cfg = getConfig();
        const result = validateConfig(cfg);
        assert.strictEqual(result, false, 'Should return false when TLS_CERT is missing');
    });

    it('should exit in production when only TLS_CERT is set', () => {
        process.env.NODE_ENV = 'production';
        process.env.TLS_CERT = '/path/to/cert.pem';
        const cfg = getConfig();

        let exitCode: number | undefined;
        const originalExit = process.exit;
        process.exit = ((code?: number) => {
            exitCode = code;
        }) as typeof process.exit;

        try {
            validateConfig(cfg);
            assert.strictEqual(exitCode, 1, 'Should exit with code 1');
        } finally {
            process.exit = originalExit;
        }
    });

    it('should exit in production when only TLS_KEY is set', () => {
        process.env.NODE_ENV = 'production';
        process.env.TLS_KEY = '/path/to/key.pem';
        const cfg = getConfig();

        let exitCode: number | undefined;
        const originalExit = process.exit;
        process.exit = ((code?: number) => {
            exitCode = code;
        }) as typeof process.exit;

        try {
            validateConfig(cfg);
            assert.strictEqual(exitCode, 1, 'Should exit with code 1');
        } finally {
            process.exit = originalExit;
        }
    });
});
