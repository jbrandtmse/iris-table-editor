/**
 * Tests for electron-builder build scripts.
 * Story 13.1: Electron Builder Config
 *
 * Tests for:
 * - generate-icons.js: ICO file generation from PNG
 * - stage-assets.js: Asset staging for electron-builder
 */
import { describe, it, before, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Resolve paths to the scripts (they use CommonJS module.exports)
const generateIconsPath = path.resolve(__dirname, '../../scripts/generate-icons.js');
const stageAssetsPath = path.resolve(__dirname, '../../scripts/stage-assets.js');

// Helper: create a minimal valid PNG file with specified dimensions
function createMinimalPng(width: number, height: number): Buffer {
    // Minimal PNG: signature + IHDR + IDAT + IEND
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // IHDR chunk (13 bytes data)
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData.writeUInt8(8, 8);          // bit depth
    ihdrData.writeUInt8(2, 9);          // color type (RGB)
    ihdrData.writeUInt8(0, 10);         // compression
    ihdrData.writeUInt8(0, 11);         // filter
    ihdrData.writeUInt8(0, 12);         // interlace

    const ihdrType = Buffer.from('IHDR');
    const ihdrLength = Buffer.alloc(4);
    ihdrLength.writeUInt32BE(13, 0);

    // CRC32 placeholder (not validated for our ICO wrapping test)
    const ihdrCrc = Buffer.alloc(4);

    // IEND chunk
    const iendLength = Buffer.alloc(4);
    iendLength.writeUInt32BE(0, 0);
    const iendType = Buffer.from('IEND');
    const iendCrc = Buffer.alloc(4);

    return Buffer.concat([
        signature,
        ihdrLength, ihdrType, ihdrData, ihdrCrc,
        iendLength, iendType, iendCrc,
    ]);
}

describe('generate-icons.js', () => {
    let tmpDir: string;
    let generateIco: (pngPath: string, icoPath: string) => void;

    before(() => {
        const mod = require(generateIconsPath);
        generateIco = mod.generateIco;
    });

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-icons-'));
    });

    function cleanup(): void {
        if (tmpDir && fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true });
        }
    }

    it('should generate a valid ICO file from PNG', () => {
        try {
            const pngData = createMinimalPng(128, 128);
            const pngPath = path.join(tmpDir, 'test.png');
            const icoPath = path.join(tmpDir, 'test.ico');

            fs.writeFileSync(pngPath, pngData);
            generateIco(pngPath, icoPath);

            assert.ok(fs.existsSync(icoPath), 'ICO file should exist');

            const icoData = fs.readFileSync(icoPath);
            assert.ok(icoData.length > 22, 'ICO file should be larger than header (22 bytes)');
        } finally {
            cleanup();
        }
    });

    it('should write correct ICO header bytes', () => {
        try {
            const pngData = createMinimalPng(128, 128);
            const pngPath = path.join(tmpDir, 'test.png');
            const icoPath = path.join(tmpDir, 'test.ico');

            fs.writeFileSync(pngPath, pngData);
            generateIco(pngPath, icoPath);

            const icoData = fs.readFileSync(icoPath);

            // ICO header: reserved=0, type=1 (ICO), count=1
            assert.strictEqual(icoData.readUInt16LE(0), 0, 'Reserved field should be 0');
            assert.strictEqual(icoData.readUInt16LE(2), 1, 'Type field should be 1 (ICO)');
            assert.strictEqual(icoData.readUInt16LE(4), 1, 'Image count should be 1');
        } finally {
            cleanup();
        }
    });

    it('should always declare 256x256 (0,0) in directory entry for electron-builder compatibility', () => {
        try {
            const pngData = createMinimalPng(128, 128);
            const pngPath = path.join(tmpDir, 'test.png');
            const icoPath = path.join(tmpDir, 'test.ico');

            fs.writeFileSync(pngPath, pngData);
            generateIco(pngPath, icoPath);

            const icoData = fs.readFileSync(icoPath);

            // Directory entry starts at byte 6
            // Always 0 (meaning 256) regardless of actual PNG dimensions
            assert.strictEqual(icoData.readUInt8(6), 0, 'Width should be 0 (meaning 256)');
            assert.strictEqual(icoData.readUInt8(7), 0, 'Height should be 0 (meaning 256)');
            assert.strictEqual(icoData.readUInt8(8), 0, 'Color palette should be 0');
            assert.strictEqual(icoData.readUInt8(9), 0, 'Reserved should be 0');
            assert.strictEqual(icoData.readUInt16LE(10), 1, 'Color planes should be 1');
            assert.strictEqual(icoData.readUInt16LE(12), 32, 'Bits per pixel should be 32');
        } finally {
            cleanup();
        }
    });

    it('should also declare 256x256 in directory entry for actual 256x256 images', () => {
        try {
            const pngData = createMinimalPng(256, 256);
            const pngPath = path.join(tmpDir, 'test256.png');
            const icoPath = path.join(tmpDir, 'test256.ico');

            fs.writeFileSync(pngPath, pngData);
            generateIco(pngPath, icoPath);

            const icoData = fs.readFileSync(icoPath);

            // ICO uses 0 to represent 256
            assert.strictEqual(icoData.readUInt8(6), 0, 'Width should be 0 (meaning 256)');
            assert.strictEqual(icoData.readUInt8(7), 0, 'Height should be 0 (meaning 256)');
        } finally {
            cleanup();
        }
    });

    it('should embed the PNG data after the header', () => {
        try {
            const pngData = createMinimalPng(128, 128);
            const pngPath = path.join(tmpDir, 'test.png');
            const icoPath = path.join(tmpDir, 'test.ico');

            fs.writeFileSync(pngPath, pngData);
            generateIco(pngPath, icoPath);

            const icoData = fs.readFileSync(icoPath);
            const headerSize = 6 + 16; // 6-byte header + 16-byte directory entry

            // Image data size in directory entry
            assert.strictEqual(
                icoData.readUInt32LE(14),
                pngData.length,
                'Image data size should match PNG file size'
            );

            // Offset to image data
            assert.strictEqual(
                icoData.readUInt32LE(18),
                headerSize,
                'Image data offset should be after header'
            );

            // Total file size
            assert.strictEqual(
                icoData.length,
                headerSize + pngData.length,
                'Total ICO size should be header + PNG data'
            );

            // PNG signature should appear at offset 22
            const embeddedPng = icoData.subarray(headerSize);
            assert.ok(
                embeddedPng.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
                'Embedded data should start with PNG signature'
            );
        } finally {
            cleanup();
        }
    });

    it('should throw for non-PNG files', () => {
        try {
            const notPng = Buffer.from('This is not a PNG file');
            const fakePath = path.join(tmpDir, 'fake.png');
            const icoPath = path.join(tmpDir, 'fake.ico');

            fs.writeFileSync(fakePath, notPng);

            assert.throws(
                () => generateIco(fakePath, icoPath),
                /Not a valid PNG file/,
                'Should throw for non-PNG input'
            );
        } finally {
            cleanup();
        }
    });

    it('should create output directory if it does not exist', () => {
        try {
            const pngData = createMinimalPng(64, 64);
            const pngPath = path.join(tmpDir, 'test.png');
            const nestedDir = path.join(tmpDir, 'nested', 'dir');
            const icoPath = path.join(nestedDir, 'test.ico');

            fs.writeFileSync(pngPath, pngData);
            generateIco(pngPath, icoPath);

            assert.ok(fs.existsSync(icoPath), 'ICO file should exist in nested directory');
        } finally {
            cleanup();
        }
    });
});

describe('stage-assets.js', () => {
    let tmpDir: string;
    let stageAssets: (options: {
        desktopDir: string;
        appDistDir: string;
        rootModules?: string;
    }) => void;

    before(() => {
        const mod = require(stageAssetsPath);
        stageAssets = mod.stageAssets;
    });

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-stage-'));
    });

    function cleanup(): void {
        if (tmpDir && fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true });
        }
    }

    /**
     * Set up a mock directory structure that mimics the monorepo layout
     * needed by stage-assets.js.
     */
    function setupMockRepo(): { desktopDir: string; appDistDir: string; rootModules: string } {
        const desktopDir = path.join(tmpDir, 'packages', 'desktop');
        const appDistDir = path.join(desktopDir, 'app-dist');
        const rootModules = path.join(tmpDir, 'node_modules');

        // Create desktop package.json
        fs.mkdirSync(desktopDir, { recursive: true });
        fs.writeFileSync(path.join(desktopDir, 'package.json'), JSON.stringify({
            name: '@iris-te/desktop',
            version: '1.2.3',
            main: 'dist/index.js',
            description: 'Test desktop app',
            dependencies: { '@iris-te/core': '*' },
            devDependencies: { electron: '^33.0.0' },
        }));

        // Create dist/main/ with compiled files
        const distMain = path.join(desktopDir, 'dist', 'main');
        fs.mkdirSync(distMain, { recursive: true });
        fs.writeFileSync(path.join(distMain, 'main.js'), '// main.js');
        fs.writeFileSync(path.join(distMain, 'main.js.map'), '{}');
        fs.writeFileSync(path.join(distMain, 'preload.js'), '// preload.js');
        fs.writeFileSync(path.join(distMain, 'ipc.js'), '// ipc.js');

        // Create dist/main/ subdirectory to test recursive staging
        const distMainSub = path.join(distMain, 'services');
        fs.mkdirSync(distMainSub, { recursive: true });
        fs.writeFileSync(path.join(distMainSub, 'helper.js'), '// helper');
        fs.writeFileSync(path.join(distMainSub, 'helper.js.map'), '{}');
        fs.writeFileSync(path.join(distMainSub, 'helper.d.ts'), '// types - should NOT be staged');

        // Create dist/ root files
        fs.writeFileSync(path.join(desktopDir, 'dist', 'index.js'), '// index.js');
        fs.writeFileSync(path.join(desktopDir, 'dist', 'index.d.ts'), '// types');

        // Create src/ui/ with HTML and CSS
        const uiDir = path.join(desktopDir, 'src', 'ui');
        fs.mkdirSync(uiDir, { recursive: true });
        fs.writeFileSync(path.join(uiDir, 'app-shell.html'), '<html></html>');
        fs.writeFileSync(path.join(uiDir, 'app-shell.css'), '/* css */');

        // Create src/ui/connection/ subdirectory
        const connDir = path.join(uiDir, 'connection');
        fs.mkdirSync(connDir, { recursive: true });
        fs.writeFileSync(path.join(connDir, 'server-list.js'), '// server-list');
        fs.writeFileSync(path.join(connDir, 'server-list.css'), '/* css */');

        // Create webview package in node_modules
        const webviewSrc = path.join(rootModules, '@iris-te', 'webview', 'src');
        fs.mkdirSync(webviewSrc, { recursive: true });
        fs.writeFileSync(path.join(webviewSrc, 'theme.css'), '/* theme */');
        fs.writeFileSync(path.join(webviewSrc, 'styles.css'), '/* styles */');
        fs.writeFileSync(path.join(webviewSrc, 'grid.js'), '// grid');
        fs.writeFileSync(path.join(webviewSrc, 'desktopThemeBridge.css'), '/* bridge */');

        // Create core package in node_modules
        const corePkg = path.join(rootModules, '@iris-te', 'core');
        const coreDist = path.join(corePkg, 'dist');
        fs.mkdirSync(coreDist, { recursive: true });
        fs.writeFileSync(path.join(corePkg, 'package.json'), JSON.stringify({
            name: '@iris-te/core',
            version: '0.1.0',
            main: 'dist/index.js',
        }));
        fs.writeFileSync(path.join(coreDist, 'index.js'), '// core index');
        fs.writeFileSync(path.join(coreDist, 'index.d.ts'), '// core types');

        // Create subdirectory in core dist
        const coreModels = path.join(coreDist, 'models');
        fs.mkdirSync(coreModels, { recursive: true });
        fs.writeFileSync(path.join(coreModels, 'IServerSpec.js'), '// IServerSpec');

        return { desktopDir, appDistDir, rootModules };
    }

    it('should create expected directory structure with desktop/ nesting', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            assert.ok(fs.existsSync(path.join(appDistDir, 'desktop', 'dist', 'main')), 'desktop/dist/main/ should exist');
            assert.ok(fs.existsSync(path.join(appDistDir, 'desktop', 'src', 'ui')), 'desktop/src/ui/ should exist');
            assert.ok(fs.existsSync(path.join(appDistDir, 'webview', 'src')), 'webview/src/ should exist');
            assert.ok(
                fs.existsSync(path.join(appDistDir, 'node_modules', '@iris-te', 'core')),
                'node_modules/@iris-te/core/ should exist'
            );
            assert.ok(fs.existsSync(path.join(appDistDir, 'package.json')), 'package.json should exist');
        } finally {
            cleanup();
        }
    });

    it('should stage compiled main process files under desktop/', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            assert.ok(
                fs.existsSync(path.join(appDistDir, 'desktop', 'dist', 'main', 'main.js')),
                'main.js should be staged'
            );
            assert.ok(
                fs.existsSync(path.join(appDistDir, 'desktop', 'dist', 'main', 'preload.js')),
                'preload.js should be staged'
            );
            assert.ok(
                fs.existsSync(path.join(appDistDir, 'desktop', 'dist', 'main', 'ipc.js')),
                'ipc.js should be staged'
            );
        } finally {
            cleanup();
        }
    });

    it('should stage desktop UI assets including subdirectories', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            assert.ok(
                fs.existsSync(path.join(appDistDir, 'desktop', 'src', 'ui', 'app-shell.html')),
                'app-shell.html should be staged'
            );
            assert.ok(
                fs.existsSync(path.join(appDistDir, 'desktop', 'src', 'ui', 'connection', 'server-list.js')),
                'connection/server-list.js should be staged'
            );
        } finally {
            cleanup();
        }
    });

    it('should stage webview assets at app-dist root level', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            assert.ok(
                fs.existsSync(path.join(appDistDir, 'webview', 'src', 'theme.css')),
                'theme.css should be staged'
            );
            assert.ok(
                fs.existsSync(path.join(appDistDir, 'webview', 'src', 'grid.js')),
                'grid.js should be staged'
            );
            assert.ok(
                fs.existsSync(path.join(appDistDir, 'webview', 'src', 'desktopThemeBridge.css')),
                'desktopThemeBridge.css should be staged'
            );
        } finally {
            cleanup();
        }
    });

    it('should stage @iris-te/core with dist/ and package.json', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            const coreStagedDir = path.join(appDistDir, 'node_modules', '@iris-te', 'core');

            assert.ok(
                fs.existsSync(path.join(coreStagedDir, 'package.json')),
                'core package.json should be staged'
            );
            assert.ok(
                fs.existsSync(path.join(coreStagedDir, 'dist', 'index.js')),
                'core dist/index.js should be staged'
            );
            assert.ok(
                fs.existsSync(path.join(coreStagedDir, 'dist', 'models', 'IServerSpec.js')),
                'core dist/models/ should be staged recursively'
            );
        } finally {
            cleanup();
        }
    });

    it('should generate minimal package.json with correct fields', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            const stagedPkg = JSON.parse(
                fs.readFileSync(path.join(appDistDir, 'package.json'), 'utf-8')
            );

            assert.strictEqual(stagedPkg.name, '@iris-te/desktop', 'name should match');
            assert.strictEqual(stagedPkg.version, '1.2.3', 'version should match');
            assert.strictEqual(stagedPkg.main, 'desktop/dist/main/main.js', 'main should point to Electron entry');
            assert.ok(stagedPkg.dependencies, 'dependencies should exist');
            assert.strictEqual(
                stagedPkg.dependencies['@iris-te/core'],
                '*',
                '@iris-te/core should be in dependencies'
            );
        } finally {
            cleanup();
        }
    });

    it('should NOT include devDependencies in staged package.json', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            const stagedPkg = JSON.parse(
                fs.readFileSync(path.join(appDistDir, 'package.json'), 'utf-8')
            );

            assert.strictEqual(
                stagedPkg.devDependencies,
                undefined,
                'devDependencies should not be present'
            );
        } finally {
            cleanup();
        }
    });

    it('should NOT include scripts in staged package.json', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            const stagedPkg = JSON.parse(
                fs.readFileSync(path.join(appDistDir, 'package.json'), 'utf-8')
            );

            assert.strictEqual(
                stagedPkg.scripts,
                undefined,
                'scripts should not be present'
            );
        } finally {
            cleanup();
        }
    });

    it('should clean previous staging directory before staging', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();

            // Create stale file
            fs.mkdirSync(appDistDir, { recursive: true });
            fs.writeFileSync(path.join(appDistDir, 'stale-file.txt'), 'stale');

            stageAssets({ desktopDir, appDistDir, rootModules });

            assert.ok(
                !fs.existsSync(path.join(appDistDir, 'stale-file.txt')),
                'stale file should be removed'
            );
        } finally {
            cleanup();
        }
    });

    it('should throw when dist/main/ does not exist', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();

            // Remove dist/main/
            fs.rmSync(path.join(desktopDir, 'dist', 'main'), { recursive: true });

            assert.throws(
                () => stageAssets({ desktopDir, appDistDir, rootModules }),
                /Compiled main process not found/,
                'Should throw when dist/main/ is missing'
            );
        } finally {
            cleanup();
        }
    });

    it('should throw when webview package is not found', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();

            // Remove webview package
            fs.rmSync(path.join(rootModules, '@iris-te', 'webview'), { recursive: true });

            assert.throws(
                () => stageAssets({ desktopDir, appDistDir, rootModules }),
                /Webview assets not found/,
                'Should throw when webview package is missing'
            );
        } finally {
            cleanup();
        }
    });

    it('should preserve relative path ../../src/ui/ from desktop/dist/main/', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            // From desktop/dist/main/main.js, path.join(__dirname, '../../src/ui/app-shell.html')
            const mainDir = path.join(appDistDir, 'desktop', 'dist', 'main');
            const resolvedHtml = path.resolve(mainDir, '../../src/ui/app-shell.html');

            assert.ok(
                fs.existsSync(resolvedHtml),
                `Relative path ../../src/ui/app-shell.html from desktop/dist/main/ should resolve: ${resolvedHtml}`
            );
        } finally {
            cleanup();
        }
    });

    it('should preserve relative path ../../../webview/src/ from desktop/dist/main/', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            // From desktop/dist/main/main.js, path.join(__dirname, '../../../webview/src/desktopThemeBridge.css')
            // 3 up from desktop/dist/main = app-dist root, then webview/src/
            const mainDir = path.join(appDistDir, 'desktop', 'dist', 'main');
            const resolvedCss = path.resolve(mainDir, '../../../webview/src/desktopThemeBridge.css');

            assert.ok(
                fs.existsSync(resolvedCss),
                `Relative path ../../../webview/src/desktopThemeBridge.css from desktop/dist/main/ should resolve: ${resolvedCss}`
            );
        } finally {
            cleanup();
        }
    });

    it('should preserve relative path ../../../webview/src/ from desktop/src/ui/', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            // From desktop/src/ui/app-shell.html, ../../../webview/src/theme.css
            // 3 up from desktop/src/ui = app-dist root, then webview/src/
            const uiDir = path.join(appDistDir, 'desktop', 'src', 'ui');
            const resolvedTheme = path.resolve(uiDir, '../../../webview/src/theme.css');

            assert.ok(
                fs.existsSync(resolvedTheme),
                `Relative path ../../../webview/src/theme.css from desktop/src/ui/ should resolve: ${resolvedTheme}`
            );
        } finally {
            cleanup();
        }
    });

    it('should recursively stage dist/main/ subdirectories', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            // Subdirectory files should be staged
            assert.ok(
                fs.existsSync(path.join(appDistDir, 'desktop', 'dist', 'main', 'services', 'helper.js')),
                'dist/main/services/helper.js should be staged recursively'
            );
            assert.ok(
                fs.existsSync(path.join(appDistDir, 'desktop', 'dist', 'main', 'services', 'helper.js.map')),
                'dist/main/services/helper.js.map should be staged recursively'
            );

            // .d.ts files should NOT be staged (only .js and .js.map)
            assert.ok(
                !fs.existsSync(path.join(appDistDir, 'desktop', 'dist', 'main', 'services', 'helper.d.ts')),
                'dist/main/services/helper.d.ts should NOT be staged (filtered out)'
            );
        } finally {
            cleanup();
        }
    });

    it('should stage dist/ root files under desktop/', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();
            stageAssets({ desktopDir, appDistDir, rootModules });

            assert.ok(
                fs.existsSync(path.join(appDistDir, 'desktop', 'dist', 'index.js')),
                'desktop/dist/index.js should be staged'
            );
            assert.ok(
                fs.existsSync(path.join(appDistDir, 'desktop', 'dist', 'index.d.ts')),
                'desktop/dist/index.d.ts should be staged'
            );
        } finally {
            cleanup();
        }
    });

    it('should throw when @iris-te/core is not found', () => {
        try {
            const { desktopDir, appDistDir, rootModules } = setupMockRepo();

            // Remove core package
            fs.rmSync(path.join(rootModules, '@iris-te', 'core'), { recursive: true });

            assert.throws(
                () => stageAssets({ desktopDir, appDistDir, rootModules }),
                /@iris-te\/core not found/,
                'Should throw when core package is missing'
            );
        } finally {
            cleanup();
        }
    });
});
