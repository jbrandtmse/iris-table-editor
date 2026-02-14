import * as assert from 'assert';
import { AtelierApiService, IServerSpec, ErrorCodes, IColumnInfo, ITableSchema } from '@iris-te/core';

suite('AtelierApiService Test Suite', () => {

    let service: AtelierApiService;

    const mockServerSpec: IServerSpec = {
        name: 'test-server',
        scheme: 'http',
        host: 'localhost',
        port: 52773,
        pathPrefix: '/api/atelier/',
        username: 'testuser'
    };

    setup(() => {
        service = new AtelierApiService();
    });

    test('AtelierApiService can be instantiated', () => {
        assert.ok(service, 'Service should be instantiated');
    });

    test('AtelierApiService has testConnection method', () => {
        assert.ok(typeof service.testConnection === 'function', 'testConnection should be a function');
    });

    test('AtelierApiService has executeQuery method', () => {
        assert.ok(typeof service.executeQuery === 'function', 'executeQuery should be a function');
    });

    test('AtelierApiService has setTimeout method', () => {
        assert.ok(typeof service.setTimeout === 'function', 'setTimeout should be a function');
    });

    test('setTimeout can be called without error', () => {
        assert.doesNotThrow(() => {
            service.setTimeout(5000);
        }, 'setTimeout should not throw');
    });

    test('testConnection returns proper error structure on network failure', async () => {
        // Use an invalid hostname to trigger network error
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        // Set a short timeout for faster test
        service.setTimeout(1000);

        const result = await service.testConnection(invalidSpec, 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.ok(
            [ErrorCodes.SERVER_UNREACHABLE, ErrorCodes.CONNECTION_TIMEOUT].includes(result.error!.code as typeof ErrorCodes.SERVER_UNREACHABLE),
            'Should be network-related error'
        );
        assert.ok(result.error!.recoverable, 'Should be recoverable');
    });

    test('executeQuery returns proper error structure on network failure', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        service.setTimeout(1000);

        const result = await service.executeQuery(
            invalidSpec,
            'USER',
            'test',
            'test',
            'SELECT 1'
        );

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
    });

    test('AtelierApiService methods return consistent error format', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-test.local'
        };

        service.setTimeout(500);

        const testResult = await service.testConnection(invalidSpec, 'user', 'pass');
        const queryResult = await service.executeQuery(invalidSpec, 'USER', 'user', 'pass', 'SELECT 1');

        // Both should have consistent error structure
        if (testResult.error) {
            assert.ok('message' in testResult.error, 'Should have message');
            assert.ok('code' in testResult.error, 'Should have code');
            assert.ok('recoverable' in testResult.error, 'Should have recoverable');
            assert.ok('context' in testResult.error, 'Should have context');
        }

        if (queryResult.error) {
            assert.ok('message' in queryResult.error, 'Should have message');
            assert.ok('code' in queryResult.error, 'Should have code');
            assert.ok('recoverable' in queryResult.error, 'Should have recoverable');
            assert.ok('context' in queryResult.error, 'Should have context');
        }
    });

    // Note: These tests validate structure and error handling.
    // Integration tests against a real IRIS server would be done separately.
    test('testConnection context is set correctly', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid.local'
        };

        service.setTimeout(500);

        const result = await service.testConnection(invalidSpec, 'user', 'pass');

        if (result.error) {
            assert.strictEqual(result.error.context, 'testConnection', 'Context should be testConnection');
        }
    });

    test('executeQuery context is set correctly', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid.local'
        };

        service.setTimeout(500);

        const result = await service.executeQuery(invalidSpec, 'USER', 'user', 'pass', 'SELECT 1');

        if (result.error) {
            assert.strictEqual(result.error.context, 'executeQuery', 'Context should be executeQuery');
        }
    });

    // Story 1.5: getNamespaces tests
    test('AtelierApiService has getNamespaces method', () => {
        assert.ok(typeof service.getNamespaces === 'function', 'getNamespaces should be a function');
    });

    test('getNamespaces returns proper error structure on network failure', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        service.setTimeout(1000);

        const result = await service.getNamespaces(invalidSpec, 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.ok(
            [ErrorCodes.SERVER_UNREACHABLE, ErrorCodes.CONNECTION_TIMEOUT].includes(result.error!.code as typeof ErrorCodes.SERVER_UNREACHABLE),
            'Should be network-related error'
        );
        assert.ok(result.error!.recoverable, 'Should be recoverable');
    });

    test('getNamespaces context is set correctly', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid.local'
        };

        service.setTimeout(500);

        const result = await service.getNamespaces(invalidSpec, 'user', 'pass');

        if (result.error) {
            assert.strictEqual(result.error.context, 'getNamespaces', 'Context should be getNamespaces');
        }
    });

    test('getNamespaces returns consistent error format', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-test.local'
        };

        service.setTimeout(500);

        const result = await service.getNamespaces(invalidSpec, 'user', 'pass');

        if (result.error) {
            assert.ok('message' in result.error, 'Should have message');
            assert.ok('code' in result.error, 'Should have code');
            assert.ok('recoverable' in result.error, 'Should have recoverable');
            assert.ok('context' in result.error, 'Should have context');
        }
    });

    // Story 1.5 AC#3: Verify namespace encoding integration
    // This test validates that system namespaces like %SYS returned from getNamespaces
    // will be properly encoded when used in subsequent API calls
    test('System namespaces from getNamespaces can be properly encoded for API calls', () => {
        // Import UrlBuilder to verify encoding integration
        // UrlBuilder is re-exported from @iris-te/core
        const { UrlBuilder } = require('@iris-te/core');

        // Simulate namespaces that would be returned from getNamespaces
        const systemNamespaces = ['%SYS', '%APPTOOLS', 'USER', 'SAMPLES'];

        for (const ns of systemNamespaces) {
            // Verify each namespace can be encoded without error
            const encoded = UrlBuilder.encodeNamespace(ns);

            // System namespaces with % should be encoded
            if (ns.includes('%')) {
                assert.ok(encoded.includes('%25'), `${ns} should have % encoded as %25`);
                assert.ok(!encoded.includes('%%'), `${ns} should not have double %`);
            }

            // Verify the encoded namespace produces a valid query URL
            const queryUrl = UrlBuilder.buildQueryUrl('http://localhost:52773/api/atelier/', ns);
            assert.ok(queryUrl.includes('/v1/'), 'URL should contain version path');
            assert.ok(!queryUrl.includes('/%S'), 'URL should not contain unencoded %S');

            // Specifically verify %SYS encoding
            if (ns === '%SYS') {
                assert.ok(queryUrl.includes('%25SYS'), '%SYS should be encoded as %25SYS in URL');
            }
        }
    });

    // Story 1.6: getTables tests
    test('AtelierApiService has getTables method', () => {
        assert.ok(typeof service.getTables === 'function', 'getTables should be a function');
    });

    test('getTables returns proper error structure on network failure', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        service.setTimeout(1000);

        const result = await service.getTables(invalidSpec, 'USER', 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.ok(
            [ErrorCodes.SERVER_UNREACHABLE, ErrorCodes.CONNECTION_TIMEOUT].includes(result.error!.code as typeof ErrorCodes.SERVER_UNREACHABLE),
            'Should be network-related error'
        );
        assert.ok(result.error!.recoverable, 'Should be recoverable');
    });

    test('getTables context is set correctly', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid.local'
        };

        service.setTimeout(500);

        const result = await service.getTables(invalidSpec, 'USER', 'user', 'pass');

        if (result.error) {
            assert.strictEqual(result.error.context, 'getTables', 'Context should be getTables');
        }
    });

    test('getTables returns consistent error format', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-test.local'
        };

        service.setTimeout(500);

        const result = await service.getTables(invalidSpec, 'USER', 'user', 'pass');

        if (result.error) {
            assert.ok('message' in result.error, 'Should have message');
            assert.ok('code' in result.error, 'Should have code');
            assert.ok('recoverable' in result.error, 'Should have recoverable');
            assert.ok('context' in result.error, 'Should have context');
        }
    });

    // Story 1.6 AC#2: Verify system namespace encoding for table queries
    test('System namespaces are properly encoded for getTables API calls', () => {
        // UrlBuilder is re-exported from @iris-te/core
        const { UrlBuilder } = require('@iris-te/core');

        // Test namespaces that might be used for table queries
        const testNamespaces = ['%SYS', 'USER', 'HSCUSTOM', '%CACHELIB'];

        for (const ns of testNamespaces) {
            const queryUrl = UrlBuilder.buildQueryUrl('http://localhost:52773/api/atelier/', ns);

            // Verify %SYS is encoded correctly
            if (ns === '%SYS') {
                assert.ok(queryUrl.includes('%25SYS'), '%SYS should be encoded as %25SYS in URL');
            }

            // Verify URL doesn't contain unencoded %
            assert.ok(!queryUrl.includes('/%S'), 'URL should not contain unencoded %S');
        }
    });

    // Story 2.1: ITableSchema and IColumnInfo interface tests
    test('IColumnInfo interface has required properties', () => {
        const columnInfo: IColumnInfo = {
            name: 'TestColumn',
            dataType: 'VARCHAR',
            nullable: true,
            maxLength: 255
        };

        assert.strictEqual(columnInfo.name, 'TestColumn', 'name should be set');
        assert.strictEqual(columnInfo.dataType, 'VARCHAR', 'dataType should be set');
        assert.strictEqual(columnInfo.nullable, true, 'nullable should be set');
        assert.strictEqual(columnInfo.maxLength, 255, 'maxLength should be set');
    });

    test('IColumnInfo interface allows optional properties to be undefined', () => {
        const columnInfo: IColumnInfo = {
            name: 'ID',
            dataType: 'INTEGER',
            nullable: false
        };

        assert.strictEqual(columnInfo.name, 'ID', 'name should be set');
        assert.strictEqual(columnInfo.maxLength, undefined, 'maxLength should be optional');
        assert.strictEqual(columnInfo.precision, undefined, 'precision should be optional');
        assert.strictEqual(columnInfo.scale, undefined, 'scale should be optional');
    });

    test('ITableSchema interface has required properties', () => {
        const schema: ITableSchema = {
            tableName: 'TestTable',
            namespace: 'USER',
            columns: [
                { name: 'ID', dataType: 'INTEGER', nullable: false },
                { name: 'Name', dataType: 'VARCHAR', nullable: true, maxLength: 100 }
            ]
        };

        assert.strictEqual(schema.tableName, 'TestTable', 'tableName should be set');
        assert.strictEqual(schema.namespace, 'USER', 'namespace should be set');
        assert.strictEqual(schema.columns.length, 2, 'columns should contain 2 items');
    });

    // Story 2.1: getTableSchema method tests
    test('AtelierApiService has getTableSchema method', () => {
        assert.ok(typeof service.getTableSchema === 'function', 'getTableSchema should be a function');
    });

    test('getTableSchema returns proper error structure on network failure', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        service.setTimeout(1000);

        const result = await service.getTableSchema(invalidSpec, 'USER', 'TestTable', 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.ok(
            [ErrorCodes.SERVER_UNREACHABLE, ErrorCodes.CONNECTION_TIMEOUT].includes(result.error!.code as typeof ErrorCodes.SERVER_UNREACHABLE),
            'Should be network-related error'
        );
        assert.ok(result.error!.recoverable, 'Should be recoverable');
    });

    test('getTableSchema context is set correctly', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid.local'
        };

        service.setTimeout(500);

        const result = await service.getTableSchema(invalidSpec, 'USER', 'TestTable', 'user', 'pass');

        if (result.error) {
            assert.strictEqual(result.error.context, 'getTableSchema', 'Context should be getTableSchema');
        }
    });

    // Story 2.1: getTableData method tests
    test('AtelierApiService has getTableData method', () => {
        assert.ok(typeof service.getTableData === 'function', 'getTableData should be a function');
    });

    test('getTableData returns proper error structure on network failure', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        const schema: ITableSchema = {
            tableName: 'TestTable',
            namespace: 'USER',
            columns: [{ name: 'ID', dataType: 'INTEGER', nullable: false }]
        };

        service.setTimeout(1000);

        const result = await service.getTableData(invalidSpec, 'USER', 'TestTable', schema, 100, 0, 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.ok(
            [ErrorCodes.SERVER_UNREACHABLE, ErrorCodes.CONNECTION_TIMEOUT].includes(result.error!.code as typeof ErrorCodes.SERVER_UNREACHABLE),
            'Should be network-related error'
        );
        assert.ok(result.error!.recoverable, 'Should be recoverable');
    });

    test('getTableData context is set correctly', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid.local'
        };

        const schema: ITableSchema = {
            tableName: 'TestTable',
            namespace: 'USER',
            columns: [{ name: 'ID', dataType: 'INTEGER', nullable: false }]
        };

        service.setTimeout(500);

        const result = await service.getTableData(invalidSpec, 'USER', 'TestTable', schema, 100, 0, 'user', 'pass');

        if (result.error) {
            assert.strictEqual(result.error.context, 'getTableData', 'Context should be getTableData');
        }
    });

    // Story 1.7: External abort signal support tests
    test('testConnection accepts externalSignal parameter', () => {
        // Verify the method signature accepts an AbortSignal
        const controller = new AbortController();
        // Should not throw - just verifying signature accepts the parameter
        assert.doesNotThrow(() => {
            // Call with external signal - will fail with network error but should accept param
            service.setTimeout(500);
            service.testConnection(mockServerSpec, 'user', 'pass', controller.signal);
        }, 'testConnection should accept externalSignal parameter');
        // Abort to clean up
        controller.abort();
    });

    test('testConnection returns CONNECTION_CANCELLED when external signal is aborted', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        // Use a longer timeout so the external abort fires before the timeout
        service.setTimeout(30000);

        const controller = new AbortController();

        // Abort immediately (before fetch can resolve)
        setTimeout(() => controller.abort(), 50);

        const result = await service.testConnection(invalidSpec, 'test', 'test', controller.signal);

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.strictEqual(
            result.error!.code,
            ErrorCodes.CONNECTION_CANCELLED,
            'Should return CONNECTION_CANCELLED when external signal is aborted'
        );
        assert.strictEqual(result.error!.recoverable, true, 'Should be recoverable');
    });

    test('testConnection returns CONNECTION_TIMEOUT when no external signal (timeout case)', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            // Use a valid-looking but unresponsive host to trigger timeout
            host: '192.0.2.1'  // TEST-NET-1 (RFC 5737) - guaranteed non-routable
        };

        // Very short timeout to trigger quickly
        service.setTimeout(100);

        const result = await service.testConnection(invalidSpec, 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        // Without external signal, should be timeout or network error (not cancelled)
        assert.notStrictEqual(
            result.error!.code,
            ErrorCodes.CONNECTION_CANCELLED,
            'Should NOT return CONNECTION_CANCELLED without external signal abort'
        );
    });

    test('executeQuery accepts externalSignal parameter', () => {
        // Verify the method signature accepts an AbortSignal
        const controller = new AbortController();
        assert.doesNotThrow(() => {
            service.setTimeout(500);
            service.executeQuery(mockServerSpec, 'USER', 'user', 'pass', 'SELECT 1', [], controller.signal);
        }, 'executeQuery should accept externalSignal parameter');
        controller.abort();
    });

    test('executeQuery returns CONNECTION_CANCELLED when external signal is aborted', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        service.setTimeout(30000);

        const controller = new AbortController();

        // Abort immediately
        setTimeout(() => controller.abort(), 50);

        const result = await service.executeQuery(invalidSpec, 'USER', 'test', 'test', 'SELECT 1', [], controller.signal);

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.strictEqual(
            result.error!.code,
            ErrorCodes.CONNECTION_CANCELLED,
            'Should return CONNECTION_CANCELLED when external signal is aborted'
        );
    });
});
