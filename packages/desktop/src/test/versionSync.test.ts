/**
 * Tests for version synchronization script.
 * Story 13.3: CI/CD Pipeline
 *
 * Tests for scripts/sync-version.js:
 * - Reads version from root package.json
 * - Writes version to vscode and desktop package.json
 * - Preserves other fields in target package.json files
 * - Handles missing version field gracefully
 */
import { describe, it, before, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Resolve path to the sync-version script (uses CommonJS module.exports)
const syncVersionPath = path.resolve(__dirname, '../../../../scripts/sync-version.js');

describe('sync-version.js', () => {
    let tmpDir: string;
    let syncVersion: (options: {
        rootPath: string;
        targets: string[];
    }) => { version: string; updated: string[] };

    before(() => {
        const mod = require(syncVersionPath);
        syncVersion = mod.syncVersion;
    });

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-version-sync-'));
    });

    function cleanup(): void {
        if (tmpDir && fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true });
        }
    }

    /**
     * Helper: create a mock package.json file with the given content.
     */
    function writePkg(filePath: string, content: Record<string, unknown>): void {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
    }

    /**
     * Helper: read and parse a package.json file.
     */
    function readPkg(filePath: string): Record<string, unknown> {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    it('should read version from root package.json', () => {
        try {
            const rootPath = path.join(tmpDir, 'package.json');
            const targetPath = path.join(tmpDir, 'packages', 'vscode', 'package.json');

            writePkg(rootPath, { name: 'root', version: '2.5.0' });
            writePkg(targetPath, { name: 'vscode-ext', version: '0.0.0' });

            const result = syncVersion({ rootPath, targets: [targetPath] });

            assert.strictEqual(result.version, '2.5.0', 'Should return the root version');
        } finally {
            cleanup();
        }
    });

    it('should write version to both target package.json files', () => {
        try {
            const rootPath = path.join(tmpDir, 'package.json');
            const vscodePath = path.join(tmpDir, 'packages', 'vscode', 'package.json');
            const desktopPath = path.join(tmpDir, 'packages', 'desktop', 'package.json');

            writePkg(rootPath, { name: 'root', version: '1.2.3' });
            writePkg(vscodePath, { name: 'iris-table-editor', version: '0.0.0' });
            writePkg(desktopPath, { name: '@iris-te/desktop', version: '0.0.0' });

            syncVersion({ rootPath, targets: [vscodePath, desktopPath] });

            const vscodePkg = readPkg(vscodePath);
            const desktopPkg = readPkg(desktopPath);

            assert.strictEqual(vscodePkg.version, '1.2.3', 'VS Code package version should be updated');
            assert.strictEqual(desktopPkg.version, '1.2.3', 'Desktop package version should be updated');
        } finally {
            cleanup();
        }
    });

    it('should preserve existing fields in target package.json', () => {
        try {
            const rootPath = path.join(tmpDir, 'package.json');
            const targetPath = path.join(tmpDir, 'packages', 'vscode', 'package.json');

            writePkg(rootPath, { name: 'root', version: '3.0.0' });
            writePkg(targetPath, {
                name: 'iris-table-editor',
                displayName: 'IRIS Table Editor',
                version: '0.0.0',
                publisher: 'intersystems-community',
                description: 'Excel-like grid editing',
                engines: { vscode: '^1.85.0' },
                scripts: { compile: 'tsc' },
                dependencies: { '@iris-te/core': '*' },
            });

            syncVersion({ rootPath, targets: [targetPath] });

            const updated = readPkg(targetPath);

            assert.strictEqual(updated.version, '3.0.0', 'Version should be updated');
            assert.strictEqual(updated.name, 'iris-table-editor', 'Name should be preserved');
            assert.strictEqual(updated.displayName, 'IRIS Table Editor', 'DisplayName should be preserved');
            assert.strictEqual(updated.publisher, 'intersystems-community', 'Publisher should be preserved');
            assert.strictEqual(updated.description, 'Excel-like grid editing', 'Description should be preserved');
            assert.deepStrictEqual(updated.engines, { vscode: '^1.85.0' }, 'Engines should be preserved');
            assert.deepStrictEqual(updated.scripts, { compile: 'tsc' }, 'Scripts should be preserved');
            assert.deepStrictEqual(
                updated.dependencies,
                { '@iris-te/core': '*' },
                'Dependencies should be preserved'
            );
        } finally {
            cleanup();
        }
    });

    it('should throw when root package.json has no version field', () => {
        try {
            const rootPath = path.join(tmpDir, 'package.json');
            const targetPath = path.join(tmpDir, 'packages', 'vscode', 'package.json');

            writePkg(rootPath, { name: 'root' });
            writePkg(targetPath, { name: 'vscode-ext', version: '0.0.0' });

            assert.throws(
                () => syncVersion({ rootPath, targets: [targetPath] }),
                /No version found in root package\.json/,
                'Should throw when version is missing'
            );
        } finally {
            cleanup();
        }
    });

    it('should return the list of updated file paths', () => {
        try {
            const rootPath = path.join(tmpDir, 'package.json');
            const vscodePath = path.join(tmpDir, 'packages', 'vscode', 'package.json');
            const desktopPath = path.join(tmpDir, 'packages', 'desktop', 'package.json');

            writePkg(rootPath, { name: 'root', version: '4.0.0' });
            writePkg(vscodePath, { name: 'vscode', version: '0.0.0' });
            writePkg(desktopPath, { name: 'desktop', version: '0.0.0' });

            const result = syncVersion({ rootPath, targets: [vscodePath, desktopPath] });

            assert.strictEqual(result.updated.length, 2, 'Should report 2 updated files');
            assert.ok(result.updated.includes(vscodePath), 'Should include VS Code path');
            assert.ok(result.updated.includes(desktopPath), 'Should include desktop path');
        } finally {
            cleanup();
        }
    });

    it('should handle single target', () => {
        try {
            const rootPath = path.join(tmpDir, 'package.json');
            const targetPath = path.join(tmpDir, 'target', 'package.json');

            writePkg(rootPath, { name: 'root', version: '1.0.0-beta.1' });
            writePkg(targetPath, { name: 'target', version: '0.0.0' });

            const result = syncVersion({ rootPath, targets: [targetPath] });

            assert.strictEqual(result.version, '1.0.0-beta.1', 'Should handle pre-release versions');
            assert.strictEqual(
                readPkg(targetPath).version,
                '1.0.0-beta.1',
                'Target should have pre-release version'
            );
        } finally {
            cleanup();
        }
    });

    it('should not modify target when target already has matching version', () => {
        try {
            const rootPath = path.join(tmpDir, 'package.json');
            const targetPath = path.join(tmpDir, 'target', 'package.json');

            writePkg(rootPath, { name: 'root', version: '1.0.0' });
            writePkg(targetPath, { name: 'target', version: '1.0.0', extra: 'field' });

            syncVersion({ rootPath, targets: [targetPath] });

            const updated = readPkg(targetPath);
            assert.strictEqual(updated.version, '1.0.0', 'Version should remain 1.0.0');
            assert.strictEqual(updated.extra, 'field', 'Extra field should be preserved');
        } finally {
            cleanup();
        }
    });

    it('should write valid JSON with trailing newline', () => {
        try {
            const rootPath = path.join(tmpDir, 'package.json');
            const targetPath = path.join(tmpDir, 'target', 'package.json');

            writePkg(rootPath, { name: 'root', version: '1.0.0' });
            writePkg(targetPath, { name: 'target', version: '0.0.0' });

            syncVersion({ rootPath, targets: [targetPath] });

            const raw = fs.readFileSync(targetPath, 'utf-8');
            assert.ok(raw.endsWith('\n'), 'File should end with newline');
            assert.doesNotThrow(() => JSON.parse(raw), 'File should contain valid JSON');
        } finally {
            cleanup();
        }
    });

    it('should throw when root package.json does not exist', () => {
        try {
            const rootPath = path.join(tmpDir, 'nonexistent', 'package.json');
            const targetPath = path.join(tmpDir, 'target', 'package.json');

            writePkg(targetPath, { name: 'target', version: '0.0.0' });

            assert.throws(
                () => syncVersion({ rootPath, targets: [targetPath] }),
                /ENOENT/,
                'Should throw ENOENT when root package.json does not exist'
            );
        } finally {
            cleanup();
        }
    });

    it('should throw when target package.json does not exist', () => {
        try {
            const rootPath = path.join(tmpDir, 'package.json');
            const targetPath = path.join(tmpDir, 'nonexistent', 'package.json');

            writePkg(rootPath, { name: 'root', version: '1.0.0' });

            assert.throws(
                () => syncVersion({ rootPath, targets: [targetPath] }),
                /ENOENT/,
                'Should throw ENOENT when target package.json does not exist'
            );
        } finally {
            cleanup();
        }
    });
});
