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
});
