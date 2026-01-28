import * as assert from 'assert';
import * as vscode from 'vscode';
import { ServerConnectionManager } from '../providers/ServerConnectionManager';

suite('ServerConnectionManager Test Suite', () => {
    let manager: ServerConnectionManager;

    setup(() => {
        manager = new ServerConnectionManager();
    });

    test('ServerConnectionManager can be instantiated', () => {
        assert.ok(manager, 'Manager should be instantiated');
    });

    test('isServerManagerInstalled returns boolean', () => {
        const result = manager.isServerManagerInstalled();
        assert.strictEqual(typeof result, 'boolean', 'isServerManagerInstalled should return a boolean');
    });

    test('getServerList returns array', async () => {
        const servers = await manager.getServerList();
        assert.ok(Array.isArray(servers), 'getServerList should return an array');
    });

    test('getServerSpec returns undefined for non-existent server', async () => {
        const spec = await manager.getServerSpec('non-existent-server-name-12345');
        // Either returns undefined if Server Manager is installed, or undefined if not
        assert.ok(spec === undefined, 'getServerSpec should return undefined for non-existent server');
    });

    test('isServerManagerInstalled checks for extension', () => {
        // This test verifies the method exists and runs without error
        // The actual result depends on whether Server Manager is installed in the test environment
        const installed = manager.isServerManagerInstalled();

        // Verify the extension lookup is correct
        const extension = vscode.extensions.getExtension('intersystems-community.servermanager');
        const expected = extension !== undefined;

        assert.strictEqual(
            installed,
            expected,
            'isServerManagerInstalled should match extension presence'
        );
    });

    test('Multiple getServerList calls use cached API', async () => {
        // Call twice to ensure caching doesn't cause issues
        const servers1 = await manager.getServerList();
        const servers2 = await manager.getServerList();

        assert.ok(Array.isArray(servers1), 'First call should return array');
        assert.ok(Array.isArray(servers2), 'Second call should return array');
    });

    test('getServerList handles errors gracefully', async () => {
        // Create a new manager instance to test error handling
        const testManager = new ServerConnectionManager();

        // Even if Server Manager has issues, getServerList should not throw
        // It should return an empty array on any error
        let result: string[];
        let errorThrown = false;

        try {
            result = await testManager.getServerList();
        } catch {
            errorThrown = true;
            result = [];
        }

        assert.strictEqual(errorThrown, false, 'getServerList should not throw exceptions');
        assert.ok(Array.isArray(result), 'Result should always be an array');
    });

    test('getServerSpec handles missing server gracefully', async () => {
        // Test with a server name that definitely won't exist
        const spec = await manager.getServerSpec('__nonexistent_server_name_xyz_12345__');

        // Should return undefined, not throw
        assert.strictEqual(spec, undefined, 'Should return undefined for missing server');
    });

    test('getServerSpec handles empty string server name', async () => {
        const spec = await manager.getServerSpec('');

        // Should handle gracefully - either undefined or no crash
        assert.ok(spec === undefined, 'Should return undefined for empty server name');
    });

    test('isServerManagerInstalled returns consistent results', () => {
        // Call multiple times to ensure consistency
        const result1 = manager.isServerManagerInstalled();
        const result2 = manager.isServerManagerInstalled();
        const result3 = manager.isServerManagerInstalled();

        assert.strictEqual(result1, result2, 'Results should be consistent');
        assert.strictEqual(result2, result3, 'Results should be consistent');
    });

    // Story 1.4 - Connection tests
    test('connect method exists', () => {
        assert.ok(typeof manager.connect === 'function', 'connect should be a function');
    });

    test('disconnect method exists', () => {
        assert.ok(typeof manager.disconnect === 'function', 'disconnect should be a function');
    });

    test('isConnected method exists and returns boolean', () => {
        assert.ok(typeof manager.isConnected === 'function', 'isConnected should be a function');
        assert.strictEqual(typeof manager.isConnected(), 'boolean', 'isConnected should return boolean');
    });

    test('getConnectedServer method exists', () => {
        assert.ok(typeof manager.getConnectedServer === 'function', 'getConnectedServer should be a function');
    });

    test('getConnectedServerSpec method exists', () => {
        assert.ok(typeof manager.getConnectedServerSpec === 'function', 'getConnectedServerSpec should be a function');
    });

    test('Initially not connected', () => {
        assert.strictEqual(manager.isConnected(), false, 'Should not be connected initially');
        assert.strictEqual(manager.getConnectedServer(), null, 'Should have no connected server initially');
        assert.strictEqual(manager.getConnectedServerSpec(), null, 'Should have no server spec initially');
    });

    test('connect returns error for non-existent server', async () => {
        const result = await manager.connect('__nonexistent_server_xyz_12345__');

        assert.strictEqual(result.success, false, 'Should fail for non-existent server');
        assert.ok(result.error, 'Should have an error');
        assert.ok(result.error!.message, 'Error should have a message');
    });

    test('disconnect clears connection state', () => {
        // Start with fresh manager
        const testManager = new ServerConnectionManager();

        // Disconnect should work even when not connected
        assert.doesNotThrow(() => {
            testManager.disconnect();
        }, 'disconnect should not throw when not connected');

        // Verify state after disconnect
        assert.strictEqual(testManager.isConnected(), false);
        assert.strictEqual(testManager.getConnectedServer(), null);
        assert.strictEqual(testManager.getConnectedServerSpec(), null);
    });

    test('connect returns proper result structure', async () => {
        const result = await manager.connect('any-server-name');

        // Result should always have success property
        assert.ok('success' in result, 'Result should have success property');
        assert.strictEqual(typeof result.success, 'boolean', 'success should be boolean');

        // If failed, should have error
        if (!result.success) {
            assert.ok(result.error, 'Failed result should have error');
            assert.ok('message' in result.error!, 'Error should have message');
            assert.ok('code' in result.error!, 'Error should have code');
            assert.ok('recoverable' in result.error!, 'Error should have recoverable');
            assert.ok('context' in result.error!, 'Error should have context');
        }
    });

    test('Multiple connect attempts do not throw', async () => {
        // Attempt multiple connects (all should fail gracefully since server doesn't exist)
        const results = await Promise.all([
            manager.connect('server1'),
            manager.connect('server2'),
            manager.connect('server3')
        ]);

        // All should return valid result objects
        for (const result of results) {
            assert.ok('success' in result, 'Each result should have success property');
        }
    });

    // Story 1.5 - getNamespaces tests
    test('getNamespaces method exists', () => {
        assert.ok(typeof manager.getNamespaces === 'function', 'getNamespaces should be a function');
    });

    test('getNamespaces returns error when not connected', async () => {
        // Fresh manager - not connected
        const result = await manager.getNamespaces();

        assert.strictEqual(result.success, false, 'Should fail when not connected');
        assert.ok(result.error, 'Should have an error');
        assert.ok(result.error!.message.includes('Not connected'), 'Error should indicate not connected');
    });

    test('getNamespaces returns proper result structure', async () => {
        const result = await manager.getNamespaces();

        // Result should always have success property
        assert.ok('success' in result, 'Result should have success property');
        assert.strictEqual(typeof result.success, 'boolean', 'success should be boolean');

        // If failed, should have error with proper structure
        if (!result.success) {
            assert.ok(result.error, 'Failed result should have error');
            assert.ok('message' in result.error!, 'Error should have message');
            assert.ok('code' in result.error!, 'Error should have code');
            assert.ok('recoverable' in result.error!, 'Error should have recoverable');
            assert.ok('context' in result.error!, 'Error should have context');
        }

        // If successful, should have namespaces array
        if (result.success) {
            assert.ok(Array.isArray(result.namespaces), 'Success should have namespaces array');
        }
    });

    // Story 1.6 - getTables tests
    test('getTables method exists', () => {
        assert.ok(typeof manager.getTables === 'function', 'getTables should be a function');
    });

    test('getTables returns error when not connected', async () => {
        // Fresh manager - not connected
        const result = await manager.getTables('USER');

        assert.strictEqual(result.success, false, 'Should fail when not connected');
        assert.ok(result.error, 'Should have an error');
        assert.ok(result.error!.message.includes('Not connected'), 'Error should indicate not connected');
    });

    test('getTables returns error when namespace is empty', async () => {
        // Fresh manager - not connected, but check namespace validation
        const result = await manager.getTables('');

        assert.strictEqual(result.success, false, 'Should fail with empty namespace');
        assert.ok(result.error, 'Should have an error');
    });

    test('getTables returns proper result structure', async () => {
        const result = await manager.getTables('USER');

        // Result should always have success property
        assert.ok('success' in result, 'Result should have success property');
        assert.strictEqual(typeof result.success, 'boolean', 'success should be boolean');

        // If failed, should have error with proper structure
        if (!result.success) {
            assert.ok(result.error, 'Failed result should have error');
            assert.ok('message' in result.error!, 'Error should have message');
            assert.ok('code' in result.error!, 'Error should have code');
            assert.ok('recoverable' in result.error!, 'Error should have recoverable');
            assert.ok('context' in result.error!, 'Error should have context');
        }

        // If successful, should have tables array
        if (result.success) {
            assert.ok(Array.isArray(result.tables), 'Success should have tables array');
        }
    });
});
