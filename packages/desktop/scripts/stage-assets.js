/**
 * Stage assets for electron-builder packaging.
 * Story 13.1: Electron Builder Config
 *
 * electron-builder's `files` patterns are relative to `directories.app`.
 * With the monorepo structure, webview assets live in a sibling package.
 * This script copies all required files into `app-dist/` so that the
 * relative path structure is preserved and all `path.join(__dirname, ...)`
 * references from compiled main.js continue to work.
 *
 * Key insight: The compiled code uses `../../../webview/src/` paths from
 * `dist/main/` and `src/ui/`, which means both need to be 3 levels deep
 * from the webview directory. We achieve this by nesting under `desktop/`:
 *
 *   app-dist/                        (= packages/ level)
 *   ├── desktop/                     (= packages/desktop/)
 *   │   ├── dist/main/               (compiled main process files)
 *   │   ├── dist/index.js            (package entry)
 *   │   └── src/ui/                  (HTML, CSS, JS)
 *   ├── webview/src/                 (shared webview assets)
 *   ├── node_modules/@iris-te/core/  (production dependency)
 *   └── package.json                 (main: desktop/dist/index.js)
 *
 * This mirrors the monorepo layout under `packages/` so all relative
 * paths (../../src/ui/, ../../../webview/src/) resolve correctly.
 *
 * Uses only Node.js built-in modules (fs, path).
 */
const fs = require('fs');
const path = require('path');

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Copy a directory recursively, resolving symlinks and skipping
 * node_modules and .git directories.
 */
function copyDirRecursive(src, dest) {
    const realSrc = fs.realpathSync(src);
    fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(realSrc, { withFileTypes: true })) {
        const srcPath = path.join(realSrc, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.name === 'node_modules' || entry.name === '.git') {
            continue;
        }

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Copy specific file extensions from a directory (non-recursive).
 * Supports compound extensions like '.d.ts' and '.js.map'.
 */
function copyFiles(srcDir, destDir, extensions) {
    const realSrc = fs.realpathSync(srcDir);
    fs.mkdirSync(destDir, { recursive: true });

    for (const entry of fs.readdirSync(realSrc, { withFileTypes: true })) {
        if (entry.isFile()) {
            const name = entry.name.toLowerCase();
            const matches = !extensions || extensions.some(ext => name.endsWith(ext));
            if (matches) {
                fs.copyFileSync(
                    path.join(realSrc, entry.name),
                    path.join(destDir, entry.name)
                );
            }
        }
    }
}

/**
 * Copy a directory recursively with extension filtering.
 * Combines recursive traversal from copyDirRecursive with the
 * extension filtering from copyFiles. This ensures subdirectories
 * are included while only copying files that match the allowed extensions.
 */
function copyDirRecursiveFiltered(src, dest, extensions) {
    const realSrc = fs.realpathSync(src);
    fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(realSrc, { withFileTypes: true })) {
        const srcPath = path.join(realSrc, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.name === 'node_modules' || entry.name === '.git') {
            continue;
        }

        if (entry.isDirectory()) {
            copyDirRecursiveFiltered(srcPath, destPath, extensions);
        } else if (entry.isFile()) {
            const name = entry.name.toLowerCase();
            const matches = !extensions || extensions.some(ext => name.endsWith(ext));
            if (matches) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

/**
 * Stage all assets into the app-dist directory.
 * @param {object} options
 * @param {string} options.desktopDir - Path to packages/desktop/
 * @param {string} options.appDistDir - Path to packages/desktop/app-dist/
 * @param {string} [options.rootModules] - Path to root node_modules/
 */
function stageAssets(options) {
    const { desktopDir, appDistDir, rootModules } = options;
    const resolvedRootModules = rootModules || path.resolve(desktopDir, '..', '..', 'node_modules');

    // Clean previous staging
    if (fs.existsSync(appDistDir)) {
        fs.rmSync(appDistDir, { recursive: true });
    }
    fs.mkdirSync(appDistDir, { recursive: true });

    // The staged layout nests desktop files under desktop/ subdirectory
    // to preserve the monorepo's relative path structure.
    // From dist/main/main.js: ../../../webview/src/ needs to reach webview/src/
    // dist/main/ is 3 levels below the packages/ root, so we nest under desktop/.
    const desktopStaged = path.join(appDistDir, 'desktop');

    // 1. Stage compiled main process files: dist/main/ → app-dist/desktop/dist/main/
    // Uses copyDirRecursive to handle any subdirectories that may be added
    // under src/main/ in the future. Only .js and .js.map files are needed
    // at runtime (.d.ts files are excluded by the filter).
    const distMainSrc = path.join(desktopDir, 'dist', 'main');
    const distMainDest = path.join(desktopStaged, 'dist', 'main');
    if (!fs.existsSync(distMainSrc)) {
        throw new Error(`Compiled main process not found at ${distMainSrc}. Run 'npm run compile' first.`);
    }
    console.log(`${LOG_PREFIX} Staging dist/main/ → app-dist/desktop/dist/main/`);
    copyDirRecursiveFiltered(distMainSrc, distMainDest, ['.js', '.js.map']);

    // 2. Stage root dist files (index.js etc.) for package exports
    const distSrc = path.join(desktopDir, 'dist');
    const distDest = path.join(desktopStaged, 'dist');
    console.log(`${LOG_PREFIX} Staging dist/ root files → app-dist/desktop/dist/`);
    copyFiles(distSrc, distDest, ['.js', '.js.map', '.d.ts']);

    // 3. Stage desktop UI assets: src/ui/ → app-dist/desktop/src/ui/
    const uiSrc = path.join(desktopDir, 'src', 'ui');
    const uiDest = path.join(desktopStaged, 'src', 'ui');
    if (!fs.existsSync(uiSrc)) {
        throw new Error(`Desktop UI assets not found at ${uiSrc}.`);
    }
    console.log(`${LOG_PREFIX} Staging src/ui/ → app-dist/desktop/src/ui/`);
    copyDirRecursive(uiSrc, uiDest);

    // 4. Stage webview assets: packages/webview/src/ → app-dist/webview/src/
    // This is at the app-dist root (= packages/ level) so that
    // ../../../webview/src/ from desktop/dist/main/ resolves correctly.
    const webviewSrc = path.join(resolvedRootModules, '@iris-te', 'webview', 'src');
    const webviewDest = path.join(appDistDir, 'webview', 'src');
    if (!fs.existsSync(webviewSrc)) {
        throw new Error(`Webview assets not found at ${webviewSrc}. Run 'npm install' from the repository root first.`);
    }
    console.log(`${LOG_PREFIX} Staging webview/src/ → app-dist/webview/src/`);
    copyDirRecursive(webviewSrc, webviewDest);

    // 5. Stage @iris-te/core compiled output into app-dist/node_modules/@iris-te/core/
    // This is at the app-dist root level so require('@iris-te/core') resolves
    // from any nested directory via Node.js module resolution.
    const corePkg = path.join(resolvedRootModules, '@iris-te', 'core');
    const coreDest = path.join(appDistDir, 'node_modules', '@iris-te', 'core');
    if (!fs.existsSync(corePkg)) {
        throw new Error(`@iris-te/core not found at ${corePkg}. Run 'npm install' from the repository root first.`);
    }
    console.log(`${LOG_PREFIX} Staging @iris-te/core → app-dist/node_modules/@iris-te/core/`);
    // Copy dist/ directory
    const coreDistSrc = path.join(corePkg, 'dist');
    const realCoreDistSrc = fs.realpathSync(coreDistSrc);
    copyDirRecursive(realCoreDistSrc, path.join(coreDest, 'dist'));
    // Copy package.json
    const corePkgJson = path.join(corePkg, 'package.json');
    const realCorePkgJson = fs.realpathSync(corePkgJson);
    fs.copyFileSync(realCorePkgJson, path.join(coreDest, 'package.json'));

    // 6. Stage @vscode/codicons font and CSS
    const codiconsSrc = path.join(resolvedRootModules, '@vscode', 'codicons', 'dist');
    const codiconsDest = path.join(desktopStaged, 'src', 'ui', 'codicons');
    if (fs.existsSync(codiconsSrc)) {
        fs.mkdirSync(codiconsDest, { recursive: true });
        // Copy only the CSS and font files needed at runtime
        for (const file of ['codicon.css', 'codicon.ttf']) {
            const src = path.join(codiconsSrc, file);
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, path.join(codiconsDest, file));
            }
        }
        console.log(`${LOG_PREFIX} Staging @vscode/codicons → app-dist/desktop/src/ui/codicons/`);
    } else {
        console.warn(`${LOG_PREFIX} @vscode/codicons not found at ${codiconsSrc} — toolbar icons will be missing`);
    }

    // 7. Generate minimal package.json for electron-builder
    // Main entry points to desktop/dist/main/main.js (the Electron entry)
    const desktopPkg = JSON.parse(fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf-8'));
    const stagedPkg = {
        name: desktopPkg.name,
        version: desktopPkg.version,
        main: 'desktop/dist/main/main.js',
        description: desktopPkg.description,
        author: desktopPkg.author || 'IRIS Table Editor',
        dependencies: {
            '@iris-te/core': '*',
            ...(desktopPkg.dependencies['electron-updater']
                ? { 'electron-updater': desktopPkg.dependencies['electron-updater'] }
                : {}),
        },
    };
    const stagedPkgPath = path.join(appDistDir, 'package.json');
    fs.writeFileSync(stagedPkgPath, JSON.stringify(stagedPkg, null, 2) + '\n');
    console.log(`${LOG_PREFIX} Generated minimal package.json`);

    console.log(`${LOG_PREFIX} Asset staging complete → ${appDistDir}`);
}

// Export for testing
module.exports = { stageAssets, copyDirRecursive, copyDirRecursiveFiltered };

// CLI execution
if (require.main === module) {
    const desktopDir = path.resolve(__dirname, '..');
    const appDistDir = path.join(desktopDir, 'app-dist');

    try {
        stageAssets({ desktopDir, appDistDir });
    } catch (error) {
        console.error(`ERROR: ${error.message}`);
        process.exit(1);
    }
}
