/**
 * Unit tests for ConnectionManager
 * Story 12.1: Server List UI - Task 6.1
 *
 * Tests CRUD operations, validation, and persistence via JSON file store.
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConnectionManager, ServerConfig } from '../main/ConnectionManager';

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

describe('ConnectionManager', () => {
    let tempDir: string;
    let manager: ConnectionManager;

    beforeEach(() => {
        // Create a temporary directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-test-'));
        manager = new ConnectionManager({ configDir: tempDir });
    });

    afterEach(() => {
        // Clean up temp directory
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ============================================
    // Constructor & Initialization
    // ============================================

    describe('initialization', () => {
        it('should start with an empty server list', () => {
            assert.strictEqual(manager.getServerCount(), 0);
            assert.deepStrictEqual(manager.getServers(), []);
        });

        it('should create the config file on first save', () => {
            const config = createTestConfig();
            manager.saveServer(config);

            const configPath = manager.getConfigPath();
            assert.ok(fs.existsSync(configPath), 'Config file should exist after save');
        });

        it('should load existing servers from disk', () => {
            // Save a server first
            const config = createTestConfig();
            manager.saveServer(config);

            // Create a new manager pointing to the same directory
            const manager2 = new ConnectionManager({ configDir: tempDir });
            assert.strictEqual(manager2.getServerCount(), 1);
            assert.strictEqual(manager2.getServer('test-server')?.hostname, 'localhost');
        });

        it('should handle invalid config file gracefully', () => {
            const configPath = path.join(tempDir, 'servers.json');
            fs.writeFileSync(configPath, 'not valid json!!!', 'utf-8');

            const mgr = new ConnectionManager({ configDir: tempDir });
            assert.strictEqual(mgr.getServerCount(), 0, 'Should start empty on invalid JSON');
        });

        it('should handle config file with wrong structure gracefully', () => {
            const configPath = path.join(tempDir, 'servers.json');
            fs.writeFileSync(configPath, JSON.stringify({ foo: 'bar' }), 'utf-8');

            const mgr = new ConnectionManager({ configDir: tempDir });
            assert.strictEqual(mgr.getServerCount(), 0, 'Should start empty on invalid structure');
        });

        it('should use custom config file name', () => {
            const mgr = new ConnectionManager({
                configDir: tempDir,
                configFileName: 'custom-config.json',
            });
            mgr.saveServer(createTestConfig());

            assert.ok(
                fs.existsSync(path.join(tempDir, 'custom-config.json')),
                'Should use custom file name'
            );
        });
    });

    // ============================================
    // CRUD: saveServer
    // ============================================

    describe('saveServer', () => {
        it('should save a valid server configuration', () => {
            const config = createTestConfig();
            manager.saveServer(config);

            assert.strictEqual(manager.getServerCount(), 1);
            const saved = manager.getServer('test-server');
            assert.ok(saved);
            assert.strictEqual(saved.name, 'test-server');
            assert.strictEqual(saved.hostname, 'localhost');
            assert.strictEqual(saved.port, 52773);
            assert.strictEqual(saved.username, '_SYSTEM');
            assert.strictEqual(saved.ssl, false);
            assert.strictEqual(saved.encryptedPassword, 'SYS');
        });

        it('should persist to disk', () => {
            manager.saveServer(createTestConfig());

            const data = JSON.parse(fs.readFileSync(manager.getConfigPath(), 'utf-8'));
            assert.strictEqual(data.servers.length, 1);
            assert.strictEqual(data.servers[0].name, 'test-server');
        });

        it('should save server with optional fields', () => {
            const config = createTestConfig({
                description: 'My production server',
                namespace: 'HSBUS',
                pathPrefix: '/iris',
            });
            manager.saveServer(config);

            const saved = manager.getServer('test-server');
            assert.strictEqual(saved?.description, 'My production server');
            assert.strictEqual(saved?.namespace, 'HSBUS');
            assert.strictEqual(saved?.pathPrefix, '/iris');
        });

        it('should save multiple servers', () => {
            manager.saveServer(createTestConfig({ name: 'server-1' }));
            manager.saveServer(createTestConfig({ name: 'server-2' }));
            manager.saveServer(createTestConfig({ name: 'server-3' }));

            assert.strictEqual(manager.getServerCount(), 3);
        });

        it('should reject duplicate server names', () => {
            manager.saveServer(createTestConfig({ name: 'duplicate' }));
            assert.throws(
                () => manager.saveServer(createTestConfig({ name: 'duplicate' })),
                /already exists/
            );
        });

        it('should return copies from getServers to prevent mutation', () => {
            manager.saveServer(createTestConfig());
            const servers = manager.getServers();
            servers[0].name = 'mutated';

            // Original should be unchanged
            assert.strictEqual(manager.getServer('test-server')?.name, 'test-server');
        });

        it('should return a copy from getServer to prevent mutation', () => {
            manager.saveServer(createTestConfig());
            const server = manager.getServer('test-server');
            if (server) {
                server.hostname = 'mutated';
            }

            assert.strictEqual(manager.getServer('test-server')?.hostname, 'localhost');
        });
    });

    // ============================================
    // CRUD: getServer / getServers
    // ============================================

    describe('getServer / getServers', () => {
        it('should return undefined for non-existent server', () => {
            assert.strictEqual(manager.getServer('nonexistent'), undefined);
        });

        it('should find server by exact name', () => {
            manager.saveServer(createTestConfig({ name: 'my-server' }));
            assert.ok(manager.getServer('my-server'));
            assert.strictEqual(manager.getServer('MY-SERVER'), undefined); // case sensitive
        });

        it('should return all servers', () => {
            manager.saveServer(createTestConfig({ name: 'a' }));
            manager.saveServer(createTestConfig({ name: 'b' }));

            const servers = manager.getServers();
            assert.strictEqual(servers.length, 2);
        });
    });

    // ============================================
    // CRUD: updateServer
    // ============================================

    describe('updateServer', () => {
        it('should update an existing server', () => {
            manager.saveServer(createTestConfig());
            manager.updateServer('test-server', createTestConfig({ hostname: 'new-host' }));

            assert.strictEqual(manager.getServer('test-server')?.hostname, 'new-host');
        });

        it('should throw for non-existent server', () => {
            assert.throws(
                () => manager.updateServer('nonexistent', createTestConfig()),
                /not found/
            );
        });

        it('should allow renaming a server', () => {
            manager.saveServer(createTestConfig({ name: 'old-name' }));
            manager.updateServer('old-name', createTestConfig({ name: 'new-name' }));

            assert.strictEqual(manager.getServer('old-name'), undefined);
            assert.ok(manager.getServer('new-name'));
            assert.strictEqual(manager.getServerCount(), 1);
        });

        it('should reject rename to existing name', () => {
            manager.saveServer(createTestConfig({ name: 'server-a' }));
            manager.saveServer(createTestConfig({ name: 'server-b' }));

            assert.throws(
                () => manager.updateServer('server-a', createTestConfig({ name: 'server-b' })),
                /already exists/
            );
        });

        it('should persist update to disk', () => {
            manager.saveServer(createTestConfig());
            manager.updateServer('test-server', createTestConfig({ port: 9999 }));

            const data = JSON.parse(fs.readFileSync(manager.getConfigPath(), 'utf-8'));
            assert.strictEqual(data.servers[0].port, 9999);
        });
    });

    // ============================================
    // CRUD: deleteServer
    // ============================================

    describe('deleteServer', () => {
        it('should delete an existing server', () => {
            manager.saveServer(createTestConfig());
            manager.deleteServer('test-server');

            assert.strictEqual(manager.getServerCount(), 0);
            assert.strictEqual(manager.getServer('test-server'), undefined);
        });

        it('should throw for non-existent server', () => {
            assert.throws(
                () => manager.deleteServer('nonexistent'),
                /not found/
            );
        });

        it('should persist deletion to disk', () => {
            manager.saveServer(createTestConfig());
            manager.deleteServer('test-server');

            const data = JSON.parse(fs.readFileSync(manager.getConfigPath(), 'utf-8'));
            assert.strictEqual(data.servers.length, 0);
        });

        it('should only delete the specified server', () => {
            manager.saveServer(createTestConfig({ name: 'keep' }));
            manager.saveServer(createTestConfig({ name: 'remove' }));
            manager.deleteServer('remove');

            assert.strictEqual(manager.getServerCount(), 1);
            assert.ok(manager.getServer('keep'));
        });
    });

    // ============================================
    // Validation
    // ============================================

    describe('validation', () => {
        it('should reject empty name', () => {
            assert.throws(
                () => manager.saveServer(createTestConfig({ name: '' })),
                /required/
            );
        });

        it('should reject whitespace-only name', () => {
            assert.throws(
                () => manager.saveServer(createTestConfig({ name: '   ' })),
                /cannot be empty/
            );
        });

        it('should reject empty hostname', () => {
            assert.throws(
                () => manager.saveServer(createTestConfig({ hostname: '' })),
                /required/
            );
        });

        it('should reject port 0', () => {
            assert.throws(
                () => manager.saveServer(createTestConfig({ port: 0 })),
                /port/
            );
        });

        it('should reject port above 65535', () => {
            assert.throws(
                () => manager.saveServer(createTestConfig({ port: 70000 })),
                /port/
            );
        });

        it('should reject non-integer port', () => {
            assert.throws(
                () => manager.saveServer(createTestConfig({ port: 52773.5 })),
                /port/
            );
        });

        it('should reject negative port', () => {
            assert.throws(
                () => manager.saveServer(createTestConfig({ port: -1 })),
                /port/
            );
        });

        it('should reject empty username', () => {
            assert.throws(
                () => manager.saveServer(createTestConfig({ username: '' })),
                /required/
            );
        });

        it('should reject non-boolean ssl', () => {
            assert.throws(
                () => manager.saveServer(createTestConfig({ ssl: 'yes' as unknown as boolean })),
                /ssl/
            );
        });

        it('should accept valid port boundaries', () => {
            // Port 1 - minimum
            manager.saveServer(createTestConfig({ name: 'port-1', port: 1 }));
            assert.strictEqual(manager.getServer('port-1')?.port, 1);

            // Port 65535 - maximum
            manager.saveServer(createTestConfig({ name: 'port-max', port: 65535 }));
            assert.strictEqual(manager.getServer('port-max')?.port, 65535);
        });

        it('should validate on update as well', () => {
            manager.saveServer(createTestConfig());
            assert.throws(
                () => manager.updateServer('test-server', createTestConfig({ port: -5 })),
                /port/
            );
        });
    });

    // ============================================
    // getServerCount
    // ============================================

    describe('getServerCount', () => {
        it('should return 0 for empty store', () => {
            assert.strictEqual(manager.getServerCount(), 0);
        });

        it('should return correct count', () => {
            manager.saveServer(createTestConfig({ name: 'a' }));
            assert.strictEqual(manager.getServerCount(), 1);

            manager.saveServer(createTestConfig({ name: 'b' }));
            assert.strictEqual(manager.getServerCount(), 2);

            manager.deleteServer('a');
            assert.strictEqual(manager.getServerCount(), 1);
        });
    });

    // ============================================
    // Edge cases
    // ============================================

    describe('edge cases', () => {
        it('should create config directory if it does not exist', () => {
            const nestedDir = path.join(tempDir, 'nested', 'deep');
            const mgr = new ConnectionManager({ configDir: nestedDir });
            mgr.saveServer(createTestConfig());

            assert.ok(fs.existsSync(path.join(nestedDir, 'servers.json')));
        });

        it('should handle server names with special characters', () => {
            const config = createTestConfig({ name: 'server "with" <special> chars & more' });
            manager.saveServer(config);

            const saved = manager.getServer('server "with" <special> chars & more');
            assert.ok(saved);
            assert.strictEqual(saved.name, 'server "with" <special> chars & more');
        });

        it('should handle empty password', () => {
            const config = createTestConfig({ encryptedPassword: '' });
            // Empty password should be allowed (validation only checks required fields)
            manager.saveServer(config);
            assert.strictEqual(manager.getServer('test-server')?.encryptedPassword, '');
        });
    });
});
