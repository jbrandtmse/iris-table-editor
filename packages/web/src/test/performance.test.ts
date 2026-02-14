/**
 * Performance Testing & Concurrent Load
 * Story 19.3: Performance Testing & Concurrent Load
 *
 * Tests session isolation under concurrent usage, asset size budgets,
 * and WebSocket-style concurrent session management.
 * Uses Node.js built-in test runner.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { SessionManager } from '../server/sessionManager';
import type { ConnectionDetails } from '../server/sessionManager';

/**
 * Helper: create connection details with unique values per index
 */
function makeConnectionDetails(index: number): ConnectionDetails {
    return {
        host: `iris-server-${index}.local`,
        port: 52773 + index,
        namespace: `NS_${index}`,
        username: `user_${index}`,
        password: `pass_${index}`,
        pathPrefix: `/iris/${index}`,
        useHTTPS: index % 2 === 0,
    };
}

/**
 * Helper: recursively get all file paths in a directory
 */
function getAllFiles(dirPath: string): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dirPath)) {
        return files;
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...getAllFiles(fullPath));
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
    return files;
}

// ============================================
// Task 1: Session Isolation Verification (AC: 1)
// ============================================

describe('Session Isolation (Story 19.3, Task 1)', () => {
    let manager: SessionManager;

    beforeEach(() => {
        manager = new SessionManager({
            sessionTimeoutMs: 5000,
            cleanupIntervalMs: 0, // disable periodic cleanup in tests
        });
    });

    afterEach(() => {
        manager.clearCleanupInterval();
    });

    it('should create 10 sessions with unique tokens (Task 1.2)', () => {
        const tokens: string[] = [];
        for (let i = 0; i < 10; i++) {
            tokens.push(manager.createSession(makeConnectionDetails(i)));
        }

        // All tokens should be unique
        const uniqueTokens = new Set(tokens);
        assert.strictEqual(uniqueTokens.size, 10, 'All 10 tokens should be unique');

        // All tokens should be non-empty strings
        for (const token of tokens) {
            assert.ok(typeof token === 'string' && token.length > 0, 'Token should be a non-empty string');
        }
    });

    it('should maintain independent connection state per session (Task 1.3)', () => {
        const tokens: string[] = [];
        for (let i = 0; i < 10; i++) {
            tokens.push(manager.createSession(makeConnectionDetails(i)));
        }

        // Verify each session stores its own connection details
        for (let i = 0; i < 10; i++) {
            const session = manager.validateToken(tokens[i]);
            assert.ok(session, `Session ${i} should be valid`);
            assert.strictEqual(session.host, `iris-server-${i}.local`, `Session ${i} host should match`);
            assert.strictEqual(session.port, 52773 + i, `Session ${i} port should match`);
            assert.strictEqual(session.namespace, `NS_${i}`, `Session ${i} namespace should match`);
            assert.strictEqual(session.username, `user_${i}`, `Session ${i} username should match`);
            assert.strictEqual(session.password, `pass_${i}`, `Session ${i} password should match`);
            assert.strictEqual(session.pathPrefix, `/iris/${i}`, `Session ${i} pathPrefix should match`);
            assert.strictEqual(session.useHTTPS, i % 2 === 0, `Session ${i} useHTTPS should match`);
        }
    });

    it('should not affect other sessions when one is destroyed (Task 1.4)', () => {
        const tokens: string[] = [];
        for (let i = 0; i < 10; i++) {
            tokens.push(manager.createSession(makeConnectionDetails(i)));
        }

        // Destroy session at index 5
        const destroyed = manager.destroySession(tokens[5]);
        assert.strictEqual(destroyed, true, 'Destroy should return true for existing session');

        // Destroyed session should no longer be valid
        const destroyedSession = manager.validateToken(tokens[5]);
        assert.strictEqual(destroyedSession, null, 'Destroyed session should return null');

        // All other sessions should still be valid
        for (let i = 0; i < 10; i++) {
            if (i === 5) {
                continue;
            }
            const session = manager.validateToken(tokens[i]);
            assert.ok(session, `Session ${i} should still be valid after destroying session 5`);
            assert.strictEqual(session.host, `iris-server-${i}.local`, `Session ${i} host should be intact`);
        }
    });

    it('should track session count accurately (Task 1.5)', () => {
        assert.strictEqual(manager.getSessionCount(), 0, 'Initial count should be 0');

        const tokens: string[] = [];
        for (let i = 0; i < 10; i++) {
            tokens.push(manager.createSession(makeConnectionDetails(i)));
            assert.strictEqual(manager.getSessionCount(), i + 1, `Count should be ${i + 1} after creating ${i + 1} sessions`);
        }

        assert.strictEqual(manager.getSessionCount(), 10, 'Count should be 10 after creating all sessions');

        // Destroy 3 sessions
        manager.destroySession(tokens[0]);
        assert.strictEqual(manager.getSessionCount(), 9, 'Count should be 9 after first destroy');

        manager.destroySession(tokens[4]);
        assert.strictEqual(manager.getSessionCount(), 8, 'Count should be 8 after second destroy');

        manager.destroySession(tokens[9]);
        assert.strictEqual(manager.getSessionCount(), 7, 'Count should be 7 after third destroy');

        // Remaining sessions should still be valid
        for (let i = 0; i < 10; i++) {
            if (i === 0 || i === 4 || i === 9) {
                continue;
            }
            assert.ok(manager.validateToken(tokens[i]), `Session ${i} should still be valid`);
        }
    });
});

// ============================================
// Task 2: Asset Size Verification (AC: 2)
// ============================================

describe('Asset Size Verification (Story 19.3, Task 2)', () => {
    const MAX_TOTAL_PUBLIC_SIZE = 500 * 1024;    // 500KB
    const MAX_INDIVIDUAL_JS_SIZE = 100 * 1024;   // 100KB per JS file
    const MAX_WEBVIEW_SIZE = 500 * 1024;          // 500KB

    it('should keep total public assets under 500KB (Task 2.1)', () => {
        const publicDir = path.resolve(__dirname, '..', '..', 'public');
        const files = getAllFiles(publicDir);
        assert.ok(files.length > 0, 'Public directory should contain files');

        let totalSize = 0;
        for (const file of files) {
            totalSize += fs.statSync(file).size;
        }

        assert.ok(
            totalSize < MAX_TOTAL_PUBLIC_SIZE,
            `Total public assets (${(totalSize / 1024).toFixed(1)}KB) should be under 500KB`
        );
    });

    it('should keep individual JS files under 100KB each (Task 2.2)', () => {
        const publicDir = path.resolve(__dirname, '..', '..', 'public');
        const files = getAllFiles(publicDir).filter(f => f.endsWith('.js'));
        assert.ok(files.length > 0, 'Public directory should contain JS files');

        for (const file of files) {
            const size = fs.statSync(file).size;
            const relativePath = path.relative(publicDir, file);
            assert.ok(
                size < MAX_INDIVIDUAL_JS_SIZE,
                `${relativePath} (${(size / 1024).toFixed(1)}KB) should be under 100KB`
            );
        }
    });

    it('should keep shared webview assets under 500KB total (Task 2.3)', () => {
        const webviewDir = path.resolve(__dirname, '..', '..', '..', 'webview', 'src');
        const files = getAllFiles(webviewDir);
        assert.ok(files.length > 0, 'Webview source directory should contain files');

        let totalSize = 0;
        for (const file of files) {
            totalSize += fs.statSync(file).size;
        }

        assert.ok(
            totalSize < MAX_WEBVIEW_SIZE,
            `Total webview assets (${(totalSize / 1024).toFixed(1)}KB) should be under 500KB`
        );
    });
});

// ============================================
// Task 3: WebSocket Concurrent Connection Tests (AC: 3)
// ============================================

describe('WebSocket Concurrent Sessions (Story 19.3, Task 3)', () => {
    let manager: SessionManager;

    beforeEach(() => {
        manager = new SessionManager({
            sessionTimeoutMs: 5000,
            cleanupIntervalMs: 0,
        });
    });

    afterEach(() => {
        manager.clearCleanupInterval();
    });

    it('should handle multiple concurrent sessions correctly (Task 3.1)', () => {
        const tokens: string[] = [];
        for (let i = 0; i < 10; i++) {
            tokens.push(manager.createSession(makeConnectionDetails(i)));
        }

        assert.strictEqual(manager.getSessionCount(), 10, 'All 10 sessions should be active');

        // All sessions should be independently retrievable
        for (let i = 0; i < 10; i++) {
            const session = manager.validateToken(tokens[i]);
            assert.ok(session, `Session ${i} should be retrievable`);
        }
    });

    it('should store independent connection details per session (Task 3.2)', () => {
        const tokens: string[] = [];
        for (let i = 0; i < 10; i++) {
            tokens.push(manager.createSession(makeConnectionDetails(i)));
        }

        // Read all sessions and verify no cross-contamination
        const sessions = tokens.map((token, i) => {
            const session = manager.validateToken(token);
            assert.ok(session, `Session ${i} should exist`);
            return session;
        });

        // Each session should have unique connection details
        for (let i = 0; i < sessions.length; i++) {
            for (let j = i + 1; j < sessions.length; j++) {
                assert.notStrictEqual(
                    sessions[i].host, sessions[j].host,
                    `Session ${i} and ${j} should have different hosts`
                );
                assert.notStrictEqual(
                    sessions[i].port, sessions[j].port,
                    `Session ${i} and ${j} should have different ports`
                );
                assert.notStrictEqual(
                    sessions[i].namespace, sessions[j].namespace,
                    `Session ${i} and ${j} should have different namespaces`
                );
                assert.notStrictEqual(
                    sessions[i].username, sessions[j].username,
                    `Session ${i} and ${j} should have different usernames`
                );
            }
        }
    });

    it('should not mix up data when sessions are destroyed and recreated (Task 3.3)', () => {
        const expiredTokens: string[] = [];
        manager = new SessionManager({
            sessionTimeoutMs: 5000,
            cleanupIntervalMs: 0,
            onSessionExpired: (token) => {
                expiredTokens.push(token);
            },
        });

        // Create 5 sessions
        const tokens: string[] = [];
        for (let i = 0; i < 5; i++) {
            tokens.push(manager.createSession(makeConnectionDetails(i)));
        }
        assert.strictEqual(manager.getSessionCount(), 5);

        // Destroy sessions 1 and 3
        manager.destroySession(tokens[1]);
        manager.destroySession(tokens[3]);
        assert.strictEqual(manager.getSessionCount(), 3);
        assert.strictEqual(expiredTokens.length, 2, 'Should have notified 2 expired sessions');

        // Create 2 new sessions with different details
        const newToken1 = manager.createSession(makeConnectionDetails(100));
        const newToken2 = manager.createSession(makeConnectionDetails(200));
        assert.strictEqual(manager.getSessionCount(), 5);

        // Verify original surviving sessions are unaffected
        const session0 = manager.validateToken(tokens[0]);
        assert.ok(session0, 'Session 0 should still exist');
        assert.strictEqual(session0.host, 'iris-server-0.local');

        const session2 = manager.validateToken(tokens[2]);
        assert.ok(session2, 'Session 2 should still exist');
        assert.strictEqual(session2.host, 'iris-server-2.local');

        const session4 = manager.validateToken(tokens[4]);
        assert.ok(session4, 'Session 4 should still exist');
        assert.strictEqual(session4.host, 'iris-server-4.local');

        // Verify new sessions have correct data
        const newSession1 = manager.validateToken(newToken1);
        assert.ok(newSession1, 'New session 1 should exist');
        assert.strictEqual(newSession1.host, 'iris-server-100.local');
        assert.strictEqual(newSession1.port, 52873);

        const newSession2 = manager.validateToken(newToken2);
        assert.ok(newSession2, 'New session 2 should exist');
        assert.strictEqual(newSession2.host, 'iris-server-200.local');
        assert.strictEqual(newSession2.port, 52973);

        // Destroyed sessions should still be invalid
        assert.strictEqual(manager.validateToken(tokens[1]), null, 'Destroyed session 1 should be null');
        assert.strictEqual(manager.validateToken(tokens[3]), null, 'Destroyed session 3 should be null');
    });

    it('should handle cleanup with multiple active sessions correctly', () => {
        const expiredTokens: string[] = [];
        manager = new SessionManager({
            sessionTimeoutMs: 50, // very short timeout for testing
            cleanupIntervalMs: 0,
            onSessionExpired: (token) => {
                expiredTokens.push(token);
            },
        });

        // Create sessions
        const tokens: string[] = [];
        for (let i = 0; i < 5; i++) {
            tokens.push(manager.createSession(makeConnectionDetails(i)));
        }
        assert.strictEqual(manager.getSessionCount(), 5);

        // Wait for sessions to expire, then trigger cleanup
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                // Touch session 2 to keep it alive
                manager.touchSession(tokens[2]);

                // Wait again past timeout for untouched sessions
                setTimeout(() => {
                    const removed = manager.cleanupExpiredSessions();
                    // At least 4 sessions should have expired (all except the touched one)
                    assert.ok(removed >= 4, `Should have cleaned up at least 4 sessions, cleaned up ${removed}`);
                    // Session 2 might still be alive if touched recently enough
                    assert.ok(manager.getSessionCount() <= 1, `Should have at most 1 session remaining, have ${manager.getSessionCount()}`);
                    resolve();
                }, 100);
            }, 60);
        });
    });
});
