/**
 * Unit tests for SessionManager
 * Story 11.2: IPC Bridge
 *
 * Tests session lifecycle (start, end, isActive), credential handling,
 * table context management, and service instance creation.
 *
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it, beforeEach } from 'node:test';
import * as assert from 'assert';
import { SessionManager } from '../main/SessionManager';
import type { IServerSpec, ITableSchema } from '@iris-te/core';

// ============================================
// Helpers
// ============================================

function createTestSpec(overrides: Partial<IServerSpec> = {}): IServerSpec {
    return {
        name: 'test-server',
        scheme: 'http',
        host: 'localhost',
        port: 52773,
        pathPrefix: '',
        ...overrides,
    };
}

function createTestSchema(overrides: Partial<ITableSchema> = {}): ITableSchema {
    return {
        tableName: 'SQLUser.TestTable',
        namespace: 'USER',
        columns: [
            { name: 'ID', dataType: 'INTEGER', nullable: false, readOnly: true },
            { name: 'Name', dataType: 'VARCHAR', nullable: true, maxLength: 50 },
            { name: 'Age', dataType: 'INTEGER', nullable: true },
        ],
        ...overrides,
    };
}

// ============================================
// Session Lifecycle Tests (Task 7.1)
// ============================================

describe('SessionManager', () => {
    let session: SessionManager;

    beforeEach(() => {
        session = new SessionManager();
    });

    describe('initial state', () => {
        it('should not be active when first created', () => {
            assert.strictEqual(session.isActive(), false);
        });

        it('should return null for all getters when not active', () => {
            assert.strictEqual(session.getServerName(), null);
            assert.strictEqual(session.getServerSpec(), null);
            assert.strictEqual(session.getUsername(), null);
            assert.strictEqual(session.getPassword(), null);
            assert.strictEqual(session.getQueryExecutor(), null);
            assert.strictEqual(session.getMetadataService(), null);
            assert.strictEqual(session.getCurrentNamespace(), null);
            assert.strictEqual(session.getCurrentTableName(), null);
            assert.strictEqual(session.getCurrentSchema(), null);
        });
    });

    describe('startSession', () => {
        it('should activate the session', () => {
            const spec = createTestSpec();
            session.startSession('my-server', spec, '_SYSTEM', 'SYS');
            assert.strictEqual(session.isActive(), true);
        });

        it('should store server name', () => {
            const spec = createTestSpec();
            session.startSession('my-server', spec, '_SYSTEM', 'SYS');
            assert.strictEqual(session.getServerName(), 'my-server');
        });

        it('should store server spec', () => {
            const spec = createTestSpec({ host: '192.168.1.100', port: 443 });
            session.startSession('prod', spec, 'admin', 'secret');
            const storedSpec = session.getServerSpec();
            assert.ok(storedSpec);
            assert.strictEqual(storedSpec.host, '192.168.1.100');
            assert.strictEqual(storedSpec.port, 443);
        });

        it('should store credentials', () => {
            const spec = createTestSpec();
            session.startSession('my-server', spec, '_SYSTEM', 'SYS');
            assert.strictEqual(session.getUsername(), '_SYSTEM');
            assert.strictEqual(session.getPassword(), 'SYS');
        });

        it('should create QueryExecutor', () => {
            const spec = createTestSpec();
            session.startSession('my-server', spec, '_SYSTEM', 'SYS');
            assert.ok(session.getQueryExecutor());
        });

        it('should create TableMetadataService', () => {
            const spec = createTestSpec();
            session.startSession('my-server', spec, '_SYSTEM', 'SYS');
            assert.ok(session.getMetadataService());
        });

        it('should clear previous session when starting a new one', () => {
            const spec1 = createTestSpec({ name: 'server-1' });
            const spec2 = createTestSpec({ name: 'server-2' });

            session.startSession('server-1', spec1, 'user1', 'pass1');
            session.setNamespace('NS1');
            session.setTable('T1', createTestSchema());

            session.startSession('server-2', spec2, 'user2', 'pass2');

            assert.strictEqual(session.getServerName(), 'server-2');
            assert.strictEqual(session.getUsername(), 'user2');
            assert.strictEqual(session.getPassword(), 'pass2');
            // Table context should be cleared
            assert.strictEqual(session.getCurrentNamespace(), null);
            assert.strictEqual(session.getCurrentTableName(), null);
            assert.strictEqual(session.getCurrentSchema(), null);
        });
    });

    describe('endSession', () => {
        it('should deactivate the session', () => {
            const spec = createTestSpec();
            session.startSession('my-server', spec, '_SYSTEM', 'SYS');
            assert.strictEqual(session.isActive(), true);

            session.endSession();
            assert.strictEqual(session.isActive(), false);
        });

        it('should clear all fields', () => {
            const spec = createTestSpec();
            session.startSession('my-server', spec, '_SYSTEM', 'SYS');
            session.setNamespace('USER');
            session.setTable('SQLUser.Test', createTestSchema());

            session.endSession();

            assert.strictEqual(session.getServerName(), null);
            assert.strictEqual(session.getServerSpec(), null);
            assert.strictEqual(session.getUsername(), null);
            assert.strictEqual(session.getPassword(), null);
            assert.strictEqual(session.getQueryExecutor(), null);
            assert.strictEqual(session.getMetadataService(), null);
            assert.strictEqual(session.getCurrentNamespace(), null);
            assert.strictEqual(session.getCurrentTableName(), null);
            assert.strictEqual(session.getCurrentSchema(), null);
        });

        it('should purge password from memory (credential clearing)', () => {
            const spec = createTestSpec();
            session.startSession('my-server', spec, '_SYSTEM', 'secret-password');
            assert.strictEqual(session.getPassword(), 'secret-password');

            session.endSession();
            assert.strictEqual(session.getPassword(), null);
        });

        it('should be safe to call when not active', () => {
            // Should not throw
            session.endSession();
            assert.strictEqual(session.isActive(), false);
        });

        it('should be safe to call multiple times', () => {
            const spec = createTestSpec();
            session.startSession('my-server', spec, '_SYSTEM', 'SYS');
            session.endSession();
            session.endSession();
            assert.strictEqual(session.isActive(), false);
        });
    });

    describe('isActive', () => {
        it('should return false when no session started', () => {
            assert.strictEqual(session.isActive(), false);
        });

        it('should return true after startSession', () => {
            session.startSession('test', createTestSpec(), 'user', 'pass');
            assert.strictEqual(session.isActive(), true);
        });

        it('should return false after endSession', () => {
            session.startSession('test', createTestSpec(), 'user', 'pass');
            session.endSession();
            assert.strictEqual(session.isActive(), false);
        });
    });

    // ============================================
    // Table Context Tests (Task 7.2)
    // ============================================

    describe('table context', () => {
        beforeEach(() => {
            session.startSession('my-server', createTestSpec(), '_SYSTEM', 'SYS');
        });

        describe('setNamespace', () => {
            it('should set the current namespace', () => {
                session.setNamespace('USER');
                assert.strictEqual(session.getCurrentNamespace(), 'USER');
            });

            it('should clear table context when namespace changes', () => {
                session.setNamespace('USER');
                session.setTable('SQLUser.Test', createTestSchema());
                assert.ok(session.getCurrentTableName());

                session.setNamespace('SAMPLES');
                assert.strictEqual(session.getCurrentTableName(), null);
                assert.strictEqual(session.getCurrentSchema(), null);
            });

            it('should allow changing namespace multiple times', () => {
                session.setNamespace('USER');
                assert.strictEqual(session.getCurrentNamespace(), 'USER');

                session.setNamespace('SAMPLES');
                assert.strictEqual(session.getCurrentNamespace(), 'SAMPLES');
            });
        });

        describe('setTable', () => {
            it('should set the current table name and schema', () => {
                const schema = createTestSchema();
                session.setTable('SQLUser.Test', schema);
                assert.strictEqual(session.getCurrentTableName(), 'SQLUser.Test');
                assert.deepStrictEqual(session.getCurrentSchema(), schema);
            });

            it('should allow changing table', () => {
                const schema1 = createTestSchema({ tableName: 'T1' });
                const schema2 = createTestSchema({ tableName: 'T2' });

                session.setTable('T1', schema1);
                assert.strictEqual(session.getCurrentTableName(), 'T1');

                session.setTable('T2', schema2);
                assert.strictEqual(session.getCurrentTableName(), 'T2');
                assert.deepStrictEqual(session.getCurrentSchema(), schema2);
            });
        });

        describe('clearTable', () => {
            it('should clear table but keep namespace', () => {
                session.setNamespace('USER');
                session.setTable('SQLUser.Test', createTestSchema());

                session.clearTable();

                assert.strictEqual(session.getCurrentNamespace(), 'USER');
                assert.strictEqual(session.getCurrentTableName(), null);
                assert.strictEqual(session.getCurrentSchema(), null);
            });

            it('should be safe to call when no table is set', () => {
                session.clearTable();
                assert.strictEqual(session.getCurrentTableName(), null);
            });
        });
    });
});
