/**
 * Unit tests for Credential Storage
 * Story 12.4: Credential Storage
 *
 * Tests NodeCryptoCredentialStore encrypt/decrypt operations and
 * ConnectionManager integration with ICredentialStore.
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NodeCryptoCredentialStore } from '../main/NodeCryptoCredentialStore';
import { ConnectionManager, ServerConfig } from '../main/ConnectionManager';
import type { ICredentialStore } from '../main/ICredentialStore';

/**
 * Create a valid test server config
 */
function createTestConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
    return {
        name: 'test-server',
        hostname: 'localhost',
        port: 52773,
        username: '_SYSTEM',
        ssl: false,
        encryptedPassword: 'SYS',
        ...overrides,
    };
}

/**
 * Mock credential store that tracks calls for testing
 */
class MockCredentialStore implements ICredentialStore {
    encryptCalls: string[] = [];
    decryptCalls: string[] = [];
    available = true;

    encrypt(password: string): string {
        this.encryptCalls.push(password);
        return `encrypted:${password}`;
    }

    decrypt(encrypted: string): string {
        this.decryptCalls.push(encrypted);
        if (encrypted.startsWith('encrypted:')) {
            return encrypted.substring('encrypted:'.length);
        }
        throw new Error('Invalid encrypted format');
    }

    isAvailable(): boolean {
        return this.available;
    }
}

// ============================================
// NodeCryptoCredentialStore Tests
// ============================================

describe('NodeCryptoCredentialStore', () => {
    let store: NodeCryptoCredentialStore;

    beforeEach(() => {
        store = new NodeCryptoCredentialStore();
    });

    describe('encrypt/decrypt round-trip', () => {
        it('should encrypt and decrypt a simple password', () => {
            const password = 'MySecret123';
            const encrypted = store.encrypt(password);
            const decrypted = store.decrypt(encrypted);
            assert.strictEqual(decrypted, password);
        });

        it('should encrypt and decrypt an empty string', () => {
            const password = '';
            const encrypted = store.encrypt(password);
            const decrypted = store.decrypt(encrypted);
            assert.strictEqual(decrypted, password);
        });

        it('should encrypt and decrypt a long password', () => {
            const password = 'A'.repeat(1000);
            const encrypted = store.encrypt(password);
            const decrypted = store.decrypt(encrypted);
            assert.strictEqual(decrypted, password);
        });

        it('should encrypt and decrypt passwords with special characters', () => {
            const password = 'p@$$w0rd!#%^&*(){}[]|\\:;"\'<>,.?/~`';
            const encrypted = store.encrypt(password);
            const decrypted = store.decrypt(encrypted);
            assert.strictEqual(decrypted, password);
        });

        it('should encrypt and decrypt unicode passwords', () => {
            const password = '\u00fc\u00f6\u00e4\u00df\u00e9\u00e8\u00ea\u00eb\u2603\u2764\uD83D\uDE80';
            const encrypted = store.encrypt(password);
            const decrypted = store.decrypt(encrypted);
            assert.strictEqual(decrypted, password);
        });

        it('should encrypt and decrypt newlines and whitespace', () => {
            const password = 'line1\nline2\ttab\r\nwindows';
            const encrypted = store.encrypt(password);
            const decrypted = store.decrypt(encrypted);
            assert.strictEqual(decrypted, password);
        });
    });

    describe('encryption properties', () => {
        it('should produce different ciphertexts for the same password (random IV)', () => {
            const password = 'SamePassword';
            const encrypted1 = store.encrypt(password);
            const encrypted2 = store.encrypt(password);

            assert.notStrictEqual(encrypted1, encrypted2, 'Same password should produce different ciphertexts');

            // Both should decrypt to the same value
            assert.strictEqual(store.decrypt(encrypted1), password);
            assert.strictEqual(store.decrypt(encrypted2), password);
        });

        it('should produce different ciphertexts for different passwords', () => {
            const encrypted1 = store.encrypt('password1');
            const encrypted2 = store.encrypt('password2');
            assert.notStrictEqual(encrypted1, encrypted2);
        });

        it('should produce base64-encoded output', () => {
            const encrypted = store.encrypt('test');
            // Base64 characters only: A-Z, a-z, 0-9, +, /, =
            assert.ok(/^[A-Za-z0-9+/=]+$/.test(encrypted), 'Output should be valid base64');
        });

        it('should produce output longer than the input (IV + AuthTag overhead)', () => {
            const password = 'short';
            const encrypted = store.encrypt(password);
            // IV (12) + AuthTag (16) + ciphertext >= password length, all base64 encoded
            assert.ok(encrypted.length > password.length);
        });
    });

    describe('decryption error handling', () => {
        it('should throw on invalid base64 data that is too short', () => {
            assert.throws(
                () => store.decrypt('dG9vc2hvcnQ='), // "tooshort" in base64, less than IV+AuthTag
                /too short|Decryption failed/
            );
        });

        it('should throw on tampered ciphertext', () => {
            const encrypted = store.encrypt('original');
            // Tamper with the encrypted data
            const buffer = Buffer.from(encrypted, 'base64');
            // Flip a bit in the ciphertext portion (after IV + AuthTag)
            if (buffer.length > 28) {
                buffer[28] = buffer[28] ^ 0xFF;
            }
            const tampered = buffer.toString('base64');

            assert.throws(
                () => store.decrypt(tampered),
                /Decryption failed/
            );
        });

        it('should throw when decrypting with a different store instance', () => {
            // This tests that the key is derived consistently
            // Two instances on the same machine should produce the same key
            const store2 = new NodeCryptoCredentialStore();
            const encrypted = store.encrypt('test-password');
            // Same machine = same key, so this should work
            const decrypted = store2.decrypt(encrypted);
            assert.strictEqual(decrypted, 'test-password');
        });
    });

    describe('isAvailable', () => {
        it('should return true (Node.js crypto is always available)', () => {
            assert.strictEqual(store.isAvailable(), true);
        });
    });
});

// ============================================
// ConnectionManager with ICredentialStore Tests
// ============================================

describe('ConnectionManager with credential store', () => {
    let tempDir: string;
    let mockStore: MockCredentialStore;
    let manager: ConnectionManager;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-cred-test-'));
        mockStore = new MockCredentialStore();
        manager = new ConnectionManager({
            configDir: tempDir,
            credentialStore: mockStore,
        });
    });

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('saveServer encryption', () => {
        it('should encrypt password before storing', () => {
            manager.saveServer(createTestConfig({ encryptedPassword: 'MySecret' }));

            assert.strictEqual(mockStore.encryptCalls.length, 1);
            assert.strictEqual(mockStore.encryptCalls[0], 'MySecret');

            // On disk, should be encrypted
            const data = JSON.parse(fs.readFileSync(manager.getConfigPath(), 'utf-8'));
            assert.strictEqual(data.servers[0].encryptedPassword, 'encrypted:MySecret');
        });

        it('should store empty string for empty password', () => {
            manager.saveServer(createTestConfig({ encryptedPassword: '' }));

            // encryptPassword returns '' for empty passwords
            const data = JSON.parse(fs.readFileSync(manager.getConfigPath(), 'utf-8'));
            assert.strictEqual(data.servers[0].encryptedPassword, '');
        });

        it('should not store plaintext password on disk', () => {
            const plaintext = 'SuperSecret123!';
            manager.saveServer(createTestConfig({ encryptedPassword: plaintext }));

            const rawFile = fs.readFileSync(manager.getConfigPath(), 'utf-8');
            // The raw file should NOT contain the plaintext
            assert.ok(!rawFile.includes(`"${plaintext}"`), 'Plaintext password should not appear in file');
            // It should contain the encrypted version
            assert.ok(rawFile.includes(`encrypted:${plaintext}`));
        });
    });

    describe('getServer decryption', () => {
        it('should decrypt password when retrieving a server', () => {
            manager.saveServer(createTestConfig({ encryptedPassword: 'MySecret' }));
            mockStore.decryptCalls = []; // Reset calls from any prior operations

            const server = manager.getServer('test-server');
            assert.ok(server);
            assert.strictEqual(server.encryptedPassword, 'MySecret');
            assert.strictEqual(mockStore.decryptCalls.length, 1);
        });

        it('should return empty string if decryption fails', () => {
            // Save with mock, then break the mock's decrypt
            manager.saveServer(createTestConfig({ encryptedPassword: 'MySecret' }));

            // Override decrypt to throw
            mockStore.decrypt = () => { throw new Error('Decryption key changed'); };

            const server = manager.getServer('test-server');
            assert.ok(server);
            assert.strictEqual(server.encryptedPassword, '');
        });

        it('should return undefined for non-existent server', () => {
            assert.strictEqual(manager.getServer('nonexistent'), undefined);
        });
    });

    describe('getServers strips passwords', () => {
        it('should return empty passwords in getServers()', () => {
            manager.saveServer(createTestConfig({ name: 'server-1', encryptedPassword: 'pass1' }));
            manager.saveServer(createTestConfig({ name: 'server-2', encryptedPassword: 'pass2' }));

            const servers = manager.getServers();
            assert.strictEqual(servers.length, 2);
            for (const server of servers) {
                assert.strictEqual(server.encryptedPassword, '', 'getServers should strip passwords');
            }
        });

        it('should still return other server info in getServers()', () => {
            manager.saveServer(createTestConfig({
                name: 'my-server',
                hostname: '192.168.1.1',
                port: 1972,
                username: 'admin',
            }));

            const servers = manager.getServers();
            assert.strictEqual(servers[0].name, 'my-server');
            assert.strictEqual(servers[0].hostname, '192.168.1.1');
            assert.strictEqual(servers[0].port, 1972);
            assert.strictEqual(servers[0].username, 'admin');
        });
    });

    describe('getDecryptedPassword', () => {
        it('should return decrypted password for existing server', () => {
            manager.saveServer(createTestConfig({ encryptedPassword: 'MySecret' }));

            const password = manager.getDecryptedPassword('test-server');
            assert.strictEqual(password, 'MySecret');
        });

        it('should return empty string for non-existent server', () => {
            const password = manager.getDecryptedPassword('nonexistent');
            assert.strictEqual(password, '');
        });
    });

    describe('updateServer encryption', () => {
        it('should encrypt new password on update', () => {
            manager.saveServer(createTestConfig({ encryptedPassword: 'OldPass' }));
            mockStore.encryptCalls = [];

            manager.updateServer('test-server', createTestConfig({ encryptedPassword: 'NewPass' }));

            assert.strictEqual(mockStore.encryptCalls.length, 1);
            assert.strictEqual(mockStore.encryptCalls[0], 'NewPass');

            const data = JSON.parse(fs.readFileSync(manager.getConfigPath(), 'utf-8'));
            assert.strictEqual(data.servers[0].encryptedPassword, 'encrypted:NewPass');
        });

        it('should preserve existing encrypted password when empty string passed', () => {
            manager.saveServer(createTestConfig({ encryptedPassword: 'OriginalPass' }));

            // Update with empty password = keep existing
            manager.updateServer('test-server', createTestConfig({ encryptedPassword: '' }));

            const data = JSON.parse(fs.readFileSync(manager.getConfigPath(), 'utf-8'));
            assert.strictEqual(data.servers[0].encryptedPassword, 'encrypted:OriginalPass');
        });

        it('should preserve encrypted password on rename with empty password', () => {
            manager.saveServer(createTestConfig({ name: 'old-name', encryptedPassword: 'KeepMe' }));

            manager.updateServer('old-name', createTestConfig({
                name: 'new-name',
                encryptedPassword: '',
            }));

            const data = JSON.parse(fs.readFileSync(manager.getConfigPath(), 'utf-8'));
            assert.strictEqual(data.servers[0].encryptedPassword, 'encrypted:KeepMe');
            assert.strictEqual(data.servers[0].name, 'new-name');
        });
    });

    describe('persistence and reload', () => {
        it('should encrypt on save and decrypt on reload+getServer', () => {
            manager.saveServer(createTestConfig({ encryptedPassword: 'Persistent' }));

            // Create a new manager pointing to the same directory and same store
            const manager2 = new ConnectionManager({
                configDir: tempDir,
                credentialStore: mockStore,
            });

            const server = manager2.getServer('test-server');
            assert.ok(server);
            assert.strictEqual(server.encryptedPassword, 'Persistent');
        });

        it('should write encrypted data to disk, not plaintext', () => {
            manager.saveServer(createTestConfig({ encryptedPassword: 'DiskTest' }));

            const rawFile = fs.readFileSync(manager.getConfigPath(), 'utf-8');
            const data = JSON.parse(rawFile);
            // On disk, stored as "encrypted:DiskTest" not "DiskTest"
            assert.strictEqual(data.servers[0].encryptedPassword, 'encrypted:DiskTest');
        });
    });
});

// ============================================
// ConnectionManager WITHOUT credential store (backward compat)
// ============================================

describe('ConnectionManager without credential store (backward compat)', () => {
    let tempDir: string;
    let manager: ConnectionManager;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-nostore-test-'));
        manager = new ConnectionManager({ configDir: tempDir });
    });

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should store password as-is (passthrough)', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'PlainText' }));

        const data = JSON.parse(fs.readFileSync(manager.getConfigPath(), 'utf-8'));
        assert.strictEqual(data.servers[0].encryptedPassword, 'PlainText');
    });

    it('should return password as-is from getServer', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'PlainText' }));

        const server = manager.getServer('test-server');
        assert.ok(server);
        assert.strictEqual(server.encryptedPassword, 'PlainText');
    });

    it('should return password as-is from getServers (no store = no stripping)', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'PlainText' }));

        const servers = manager.getServers();
        assert.strictEqual(servers[0].encryptedPassword, 'PlainText');
    });

    it('should return password from getDecryptedPassword', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'PlainText' }));

        const password = manager.getDecryptedPassword('test-server');
        assert.strictEqual(password, 'PlainText');
    });

    it('should update password as-is', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'OldPass' }));
        manager.updateServer('test-server', createTestConfig({ encryptedPassword: 'NewPass' }));

        const server = manager.getServer('test-server');
        assert.ok(server);
        assert.strictEqual(server.encryptedPassword, 'NewPass');
    });

    it('should handle empty password on save', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: '' }));

        const server = manager.getServer('test-server');
        assert.ok(server);
        assert.strictEqual(server.encryptedPassword, '');
    });

    it('should load existing servers from disk', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'SYS' }));

        const manager2 = new ConnectionManager({ configDir: tempDir });
        assert.strictEqual(manager2.getServerCount(), 1);
        assert.strictEqual(manager2.getServer('test-server')?.encryptedPassword, 'SYS');
    });
});

// ============================================
// ConnectionManager with unavailable credential store
// ============================================

describe('ConnectionManager with unavailable credential store', () => {
    let tempDir: string;
    let mockStore: MockCredentialStore;
    let manager: ConnectionManager;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-unavail-test-'));
        mockStore = new MockCredentialStore();
        mockStore.available = false;
        manager = new ConnectionManager({
            configDir: tempDir,
            credentialStore: mockStore,
        });
    });

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should store empty string when credential store is unavailable', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'MySecret' }));

        const data = JSON.parse(fs.readFileSync(manager.getConfigPath(), 'utf-8'));
        assert.strictEqual(data.servers[0].encryptedPassword, '');
    });

    it('should not call encrypt when store is unavailable', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'MySecret' }));
        assert.strictEqual(mockStore.encryptCalls.length, 0);
    });

    it('should return empty password from getServer when store is unavailable', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'MySecret' }));

        // Password was stored as '' because store is unavailable
        // getServer returns '' for empty stored password even if store is unavailable
        const server = manager.getServer('test-server');
        assert.ok(server);
        assert.strictEqual(server.encryptedPassword, '');
    });

    it('should return empty string from getDecryptedPassword', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'MySecret' }));
        assert.strictEqual(manager.getDecryptedPassword('test-server'), '');
    });

    it('should still save other server data normally', () => {
        manager.saveServer(createTestConfig({
            name: 'my-server',
            hostname: '192.168.1.1',
            port: 1972,
            username: 'admin',
            encryptedPassword: 'ignored',
        }));

        const server = manager.getServer('my-server');
        assert.ok(server);
        assert.strictEqual(server.name, 'my-server');
        assert.strictEqual(server.hostname, '192.168.1.1');
        assert.strictEqual(server.port, 1972);
        assert.strictEqual(server.username, 'admin');
    });
});

// ============================================
// Integration: NodeCryptoCredentialStore + ConnectionManager
// ============================================

describe('ConnectionManager with NodeCryptoCredentialStore integration', () => {
    let tempDir: string;
    let credStore: NodeCryptoCredentialStore;
    let manager: ConnectionManager;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-integ-test-'));
        credStore = new NodeCryptoCredentialStore();
        manager = new ConnectionManager({
            configDir: tempDir,
            credentialStore: credStore,
        });
    });

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should save and retrieve password through real encryption', () => {
        const password = 'RealSecret123!';
        manager.saveServer(createTestConfig({ encryptedPassword: password }));

        const server = manager.getServer('test-server');
        assert.ok(server);
        assert.strictEqual(server.encryptedPassword, password);
    });

    it('should store encrypted (not plaintext) password on disk', () => {
        const password = 'PlaintextShouldNotAppear';
        manager.saveServer(createTestConfig({ encryptedPassword: password }));

        const rawFile = fs.readFileSync(manager.getConfigPath(), 'utf-8');
        assert.ok(!rawFile.includes(`"${password}"`), 'Plaintext password must not appear in config file');
    });

    it('should survive manager reload', () => {
        const password = 'SurviveReload!@#';
        manager.saveServer(createTestConfig({ encryptedPassword: password }));

        const manager2 = new ConnectionManager({
            configDir: tempDir,
            credentialStore: credStore,
        });

        const server = manager2.getServer('test-server');
        assert.ok(server);
        assert.strictEqual(server.encryptedPassword, password);
    });

    it('should handle multiple servers with different passwords', () => {
        manager.saveServer(createTestConfig({ name: 'server-1', encryptedPassword: 'pass1' }));
        manager.saveServer(createTestConfig({ name: 'server-2', encryptedPassword: 'pass2' }));
        manager.saveServer(createTestConfig({ name: 'server-3', encryptedPassword: 'pass3' }));

        assert.strictEqual(manager.getDecryptedPassword('server-1'), 'pass1');
        assert.strictEqual(manager.getDecryptedPassword('server-2'), 'pass2');
        assert.strictEqual(manager.getDecryptedPassword('server-3'), 'pass3');
    });

    it('should strip passwords in getServers', () => {
        manager.saveServer(createTestConfig({ name: 's1', encryptedPassword: 'secret1' }));
        manager.saveServer(createTestConfig({ name: 's2', encryptedPassword: 'secret2' }));

        const servers = manager.getServers();
        for (const s of servers) {
            assert.strictEqual(s.encryptedPassword, '', 'getServers must strip passwords');
        }
    });

    it('should update password correctly', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'OldPassword' }));
        manager.updateServer('test-server', createTestConfig({ encryptedPassword: 'NewPassword' }));

        assert.strictEqual(manager.getDecryptedPassword('test-server'), 'NewPassword');
    });

    it('should preserve password on update with empty string', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'KeepThis' }));
        manager.updateServer('test-server', createTestConfig({ encryptedPassword: '' }));

        assert.strictEqual(manager.getDecryptedPassword('test-server'), 'KeepThis');
    });

    it('should handle delete and not return password', () => {
        manager.saveServer(createTestConfig({ encryptedPassword: 'DeleteMe' }));
        manager.deleteServer('test-server');

        assert.strictEqual(manager.getDecryptedPassword('test-server'), '');
        assert.strictEqual(manager.getServer('test-server'), undefined);
    });

    it('should store different ciphertexts for same password saved to different servers', () => {
        manager.saveServer(createTestConfig({ name: 'a', encryptedPassword: 'SamePass' }));
        manager.saveServer(createTestConfig({ name: 'b', encryptedPassword: 'SamePass' }));

        const data = JSON.parse(fs.readFileSync(manager.getConfigPath(), 'utf-8'));
        // Due to random IV, same password should produce different ciphertexts
        assert.notStrictEqual(
            data.servers[0].encryptedPassword,
            data.servers[1].encryptedPassword,
            'Same password should produce different ciphertexts due to random IV'
        );
    });
});
