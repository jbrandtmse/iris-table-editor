import * as assert from 'assert';
import { AtelierApiService } from '../services/AtelierApiService';
import { IServerSpec } from '../models/IServerSpec';
import { ErrorCodes } from '../utils/ErrorHandler';

suite('AtelierApiService Test Suite', () => {

    let service: AtelierApiService;

    const mockServerSpec: IServerSpec = {
        name: 'test-server',
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
});
