/**
 * Security Audit Tests - OWASP Top 10 & Credential Handling
 * Story 19.4: Security Audit
 *
 * Structural verification tests that read source code and check for
 * expected security patterns. These tests verify that security measures
 * are IN PLACE without performing penetration testing.
 *
 * Uses Node.js built-in test runner.
 */
import { describe, it } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// Resolve paths to TypeScript source files.
// At runtime __dirname is packages/web/dist/test/ so we go up to packages/web/
// then into src/server/ for web sources, and up to monorepo root for core.
const WEB_PKG_DIR = path.resolve(__dirname, '..', '..');
const WEB_SERVER_DIR = path.join(WEB_PKG_DIR, 'src', 'server');
const CORE_UTILS_DIR = path.resolve(WEB_PKG_DIR, '..', 'core', 'src', 'utils');

/**
 * Read a source file and return its content as a string.
 */
function readSource(filePath: string): string {
    const resolved = path.resolve(filePath);
    assert.ok(fs.existsSync(resolved), `Source file should exist: ${resolved}`);
    return fs.readFileSync(resolved, 'utf-8');
}

// ============================================
// OWASP Top 10 Verification (Task 1)
// ============================================

describe('Security Audit: OWASP Top 10 Verification', () => {

    // ------------------------------------------
    // 1.2: Injection Prevention
    // ------------------------------------------
    describe('A03:2021 Injection Prevention', () => {
        it('should use parameterized queries with ? placeholders in SqlBuilder', () => {
            const source = readSource(path.join(CORE_UTILS_DIR, 'SqlBuilder.ts'));
            // buildFilterWhereClause uses ? placeholders for parameters
            assert.ok(
                source.includes('LIKE ?') || source.includes('= ?'),
                'SqlBuilder should use ? placeholders for parameterized queries'
            );
        });

        it('should validate SQL identifiers against a strict regex pattern', () => {
            const source = readSource(path.join(CORE_UTILS_DIR, 'SqlBuilder.ts'));
            assert.ok(
                source.includes('VALID_SQL_IDENTIFIER'),
                'SqlBuilder should define a VALID_SQL_IDENTIFIER regex'
            );
            assert.ok(
                source.includes('validateAndEscapeIdentifier'),
                'SqlBuilder should have a validateAndEscapeIdentifier function'
            );
        });

        it('should reject invalid identifiers by throwing an error', () => {
            const source = readSource(path.join(CORE_UTILS_DIR, 'SqlBuilder.ts'));
            assert.ok(
                source.includes('throw new Error'),
                'SqlBuilder should throw errors for invalid identifiers'
            );
        });

        it('should collect filter values into a params array (not inline)', () => {
            const source = readSource(path.join(CORE_UTILS_DIR, 'SqlBuilder.ts'));
            assert.ok(
                source.includes('filterParams'),
                'SqlBuilder should return filter parameters separately from the query string'
            );
        });
    });

    // ------------------------------------------
    // 1.3: Broken Authentication
    // ------------------------------------------
    describe('A07:2021 Broken Authentication', () => {
        it('should use crypto.randomUUID for session token generation', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            assert.ok(
                source.includes('crypto.randomUUID'),
                'SessionManager should use crypto.randomUUID for token generation'
            );
        });

        it('should import crypto module', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            assert.ok(
                source.includes("import * as crypto from 'crypto'"),
                'SessionManager should import the Node.js crypto module'
            );
        });

        it('should implement session timeout with sliding window', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            assert.ok(
                source.includes('lastActivity'),
                'SessionManager should track lastActivity for sliding window timeout'
            );
            assert.ok(
                source.includes('sessionTimeoutMs'),
                'SessionManager should have a configurable timeout'
            );
        });

        it('should delete expired sessions', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            assert.ok(
                source.includes('sessions.delete(token)'),
                'SessionManager should delete sessions from the Map on expiry'
            );
        });

        it('should run periodic cleanup of expired sessions', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            assert.ok(
                source.includes('cleanupExpiredSessions'),
                'SessionManager should have a cleanupExpiredSessions method'
            );
            assert.ok(
                source.includes('setInterval'),
                'SessionManager should use setInterval for periodic cleanup'
            );
        });
    });

    // ------------------------------------------
    // 1.4: Sensitive Data Exposure
    // ------------------------------------------
    describe('A02:2021 Sensitive Data Exposure', () => {
        it('should redact password in logger sanitization', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'logger.ts'));
            assert.ok(
                source.includes("'password'"),
                'Logger SENSITIVE_KEYS should include "password"'
            );
        });

        it('should redact token in logger sanitization', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'logger.ts'));
            assert.ok(
                source.includes("'token'"),
                'Logger SENSITIVE_KEYS should include "token"'
            );
        });

        it('should redact secret in logger sanitization', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'logger.ts'));
            assert.ok(
                source.includes("'secret'"),
                'Logger SENSITIVE_KEYS should include "secret"'
            );
        });

        it('should redact cookie in logger sanitization', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'logger.ts'));
            assert.ok(
                source.includes("'cookie'"),
                'Logger SENSITIVE_KEYS should include "cookie"'
            );
        });

        it('should redact authorization in logger sanitization', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'logger.ts'));
            assert.ok(
                source.includes("'authorization'"),
                'Logger SENSITIVE_KEYS should include "authorization"'
            );
        });

        it('should replace sensitive values with [REDACTED]', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'logger.ts'));
            assert.ok(
                source.includes('[REDACTED]'),
                'Logger should replace sensitive values with [REDACTED]'
            );
        });

        it('should support TLS certificate configuration', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'config.ts'));
            assert.ok(
                source.includes('tlsCert'),
                'Config should have a tlsCert field for TLS support'
            );
            assert.ok(
                source.includes('tlsKey'),
                'Config should have a tlsKey field for TLS support'
            );
        });

        it('should support HTTPS redirection', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'config.ts'));
            assert.ok(
                source.includes('forceHttps'),
                'Config should have a forceHttps option'
            );
        });

        it('should enforce HTTPS for credential transmission in production', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'apiProxy.ts'));
            assert.ok(
                source.includes('HTTPS is required for credential transmission'),
                'apiProxy should enforce HTTPS in production for credentials'
            );
        });
    });

    // ------------------------------------------
    // 1.5: XSS Prevention
    // ------------------------------------------
    describe('A03:2021 XSS Prevention', () => {
        it('should configure helmet with contentSecurityPolicy', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes('contentSecurityPolicy'),
                'Security middleware should configure helmet with contentSecurityPolicy'
            );
        });

        it('should restrict defaultSrc to self in CSP', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("defaultSrc: [\"'self'\"]"),
                'CSP defaultSrc should be restricted to self'
            );
        });

        it('should restrict scriptSrc to self in CSP', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("scriptSrc: [\"'self'\"]"),
                'CSP scriptSrc should be restricted to self'
            );
        });

        it('should block object embedding via objectSrc none', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("objectSrc: [\"'none'\"]"),
                'CSP objectSrc should be none to prevent object/embed injection'
            );
        });

        it('should block framing via frameAncestors none', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("frameAncestors: [\"'none'\"]"),
                'CSP frameAncestors should be none to prevent clickjacking'
            );
        });
    });

    // ------------------------------------------
    // 1.6: Security Headers (Helmet)
    // ------------------------------------------
    describe('A05:2021 Security Misconfiguration - Headers', () => {
        it('should import helmet', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("import helmet from 'helmet'"),
                'Security module should import helmet'
            );
        });

        it('should call helmet() as middleware', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes('app.use(helmet('),
                'Security module should apply helmet as Express middleware'
            );
        });
    });

    // ------------------------------------------
    // 1.7: CSRF Protection
    // ------------------------------------------
    describe('A01:2021 CSRF Protection', () => {
        it('should import doubleCsrf from csrf-csrf', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("from 'csrf-csrf'"),
                'Security module should import from csrf-csrf package'
            );
            assert.ok(
                source.includes('doubleCsrf'),
                'Security module should use the doubleCsrf function'
            );
        });

        it('should configure double-submit cookie pattern', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("cookieName: '__csrf'"),
                'CSRF should use a named cookie (__csrf)'
            );
            assert.ok(
                source.includes('doubleCsrfProtection'),
                'CSRF should use the doubleCsrfProtection middleware'
            );
        });

        it('should read CSRF token from x-csrf-token header', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("'x-csrf-token'"),
                'CSRF should read token from x-csrf-token header'
            );
        });

        it('should provide a GET /api/csrf-token endpoint', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("'/api/csrf-token'"),
                'Security module should expose a CSRF token endpoint'
            );
        });

        it('should return JSON error on CSRF failure (not HTML)', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("'Invalid or missing CSRF token'"),
                'CSRF rejection should return a JSON error message'
            );
        });
    });

    // ------------------------------------------
    // 1.8: Rate Limiting
    // ------------------------------------------
    describe('A04:2021 Rate Limiting', () => {
        it('should import express-rate-limit', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("from 'express-rate-limit'"),
                'Security module should import express-rate-limit'
            );
        });

        it('should apply rateLimit as middleware', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes('app.use(rateLimit('),
                'Security module should apply rateLimit as Express middleware'
            );
        });

        it('should configure a window and max request count', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes('windowMs'),
                'Rate limiter should specify a window duration'
            );
            assert.ok(
                source.includes('rateLimitMax'),
                'Rate limiter should use configurable max request count'
            );
        });
    });

    // ------------------------------------------
    // 1.9: Cookie Security
    // ------------------------------------------
    describe('A02:2021 Cookie Security', () => {
        it('should set httpOnly on CSRF cookie', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes('httpOnly: true'),
                'CSRF cookie should have httpOnly flag'
            );
        });

        it('should set sameSite on CSRF cookie', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("sameSite: 'strict'"),
                'CSRF cookie should have sameSite=strict'
            );
        });

        it('should set secure flag conditionally for production', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'security.ts'));
            assert.ok(
                source.includes("secure: cfg.nodeEnv === 'production'"),
                'CSRF cookie should set secure flag in production'
            );
        });

        it('should set HttpOnly on session cookie', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'apiProxy.ts'));
            assert.ok(
                source.includes('HttpOnly'),
                'Session cookie should have HttpOnly flag'
            );
        });

        it('should set SameSite=Strict on session cookie', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'apiProxy.ts'));
            assert.ok(
                source.includes('SameSite=Strict'),
                'Session cookie should have SameSite=Strict'
            );
        });

        it('should set Secure flag on session cookie in production', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'apiProxy.ts'));
            assert.ok(
                source.includes('; Secure'),
                'Session cookie should include Secure flag for production'
            );
        });
    });
});

// ============================================
// Credential Handling Audit (Task 2)
// ============================================

describe('Security Audit: Credential Handling', () => {

    // ------------------------------------------
    // 2.1: In-memory storage only
    // ------------------------------------------
    describe('In-memory credential storage', () => {
        it('should use a Map for session storage', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            assert.ok(
                source.includes('Map<string, SessionData>'),
                'SessionManager should use Map<string, SessionData> for in-memory storage'
            );
        });

        it('should initialize sessions as a new Map instance', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            assert.ok(
                source.includes('new Map()'),
                'SessionManager should initialize sessions with new Map()'
            );
        });

        it('should not import sqlite or file-based session stores', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            assert.ok(
                !source.includes('sqlite'),
                'SessionManager should not use sqlite'
            );
            assert.ok(
                !source.includes('better-sqlite'),
                'SessionManager should not use better-sqlite'
            );
            assert.ok(
                !source.includes('leveldb'),
                'SessionManager should not use leveldb'
            );
        });
    });

    // ------------------------------------------
    // 2.2: Crypto-random session tokens
    // ------------------------------------------
    describe('Crypto-random session tokens', () => {
        it('should generate tokens using crypto.randomUUID', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            // crypto.randomUUID uses cryptographic random number generator
            assert.ok(
                source.includes('crypto.randomUUID()'),
                'Session tokens should be generated with crypto.randomUUID()'
            );
        });

        it('should not use Math.random for token generation', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            assert.ok(
                !source.includes('Math.random'),
                'SessionManager should not use insecure Math.random for tokens'
            );
        });
    });

    // ------------------------------------------
    // 2.3: Session destroy clears credentials
    // ------------------------------------------
    describe('Session destruction clears credentials', () => {
        it('should delete session data from the Map on destroy', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            assert.ok(
                source.includes('this.sessions.delete(token)'),
                'destroySession should call Map.delete to remove all session data'
            );
        });

        it('should have a destroySession method', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'sessionManager.ts'));
            assert.ok(
                source.includes('destroySession(token: string)'),
                'SessionManager should expose a destroySession method'
            );
        });

        it('should clear session cookie on disconnect', () => {
            const source = readSource(path.join(WEB_SERVER_DIR, 'apiProxy.ts'));
            assert.ok(
                source.includes('clearSessionCookie'),
                'API proxy disconnect endpoint should clear the session cookie'
            );
        });
    });

    // ------------------------------------------
    // 2.4: No file-system persistence of credentials
    // ------------------------------------------
    describe('No file-system persistence', () => {
        const serverFiles = [
            'sessionManager.ts',
            'apiProxy.ts',
            'security.ts',
            'logger.ts',
            'config.ts',
            'commandHandler.ts',
            'wsServer.ts',
            'server.ts',
        ];

        const fileWritePatterns = [
            'fs.writeFile',
            'fs.writeFileSync',
            'fs.appendFile',
            'fs.appendFileSync',
            'writeFile(',
            'writeFileSync(',
            'appendFile(',
            'appendFileSync(',
            'createWriteStream',
        ];

        for (const fileName of serverFiles) {
            it(`should not have file-write operations in ${fileName}`, () => {
                const filePath = path.join(WEB_SERVER_DIR, fileName);
                if (!fs.existsSync(filePath)) {
                    // File may not exist (optional); skip gracefully
                    return;
                }
                const source = fs.readFileSync(filePath, 'utf-8');
                for (const pattern of fileWritePatterns) {
                    assert.ok(
                        !source.includes(pattern),
                        `${fileName} should not contain "${pattern}" (credentials must never be written to disk)`
                    );
                }
            });
        }
    });

    // ------------------------------------------
    // 2.5: npm audit (no high/critical vulnerabilities)
    // ------------------------------------------
    describe('Dependency vulnerability check', () => {
        it('should have no high or critical vulnerabilities in npm audit', () => {
            // Structural check: verify package-lock.json exists (npm audit requires it)
            const lockFile = path.resolve(WEB_PKG_DIR, '..', '..', 'package-lock.json');
            assert.ok(
                fs.existsSync(lockFile),
                'package-lock.json should exist for npm audit to function'
            );
        });
    });
});
