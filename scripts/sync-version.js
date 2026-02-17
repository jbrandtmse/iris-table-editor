/**
 * Synchronize the version from root package.json to all workspace packages.
 * Story 13.3: CI/CD Pipeline
 *
 * The root package.json is the single source of truth for the project version.
 * This script reads that version and writes it to each workspace package.json,
 * preserving all other fields.
 *
 * Usage:
 *   node scripts/sync-version.js
 *   npm run version:sync
 *
 * Uses only Node.js built-in modules (fs, path).
 */
const fs = require('fs');
const path = require('path');

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Synchronize version from a root package.json to target package.json files.
 *
 * @param {object} options
 * @param {string} options.rootPath - Path to the root package.json
 * @param {string[]} options.targets - Paths to target package.json files
 * @returns {{ version: string, updated: string[] }} The version and list of updated files
 */
function syncVersion(options) {
    const { rootPath, targets } = options;

    const rootPkg = JSON.parse(fs.readFileSync(rootPath, 'utf-8'));
    const version = rootPkg.version;

    if (!version) {
        throw new Error('No version found in root package.json');
    }

    const updated = [];

    for (const target of targets) {
        const fullPath = path.resolve(target);
        const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        pkg.version = version;
        fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(`${LOG_PREFIX} Updated ${target} to version ${version}`);
        updated.push(target);
    }

    return { version, updated };
}

// Export for testing
module.exports = { syncVersion };

// CLI execution
if (require.main === module) {
    const rootPath = path.resolve(__dirname, '..', 'package.json');
    const targets = [
        path.resolve(__dirname, '..', 'packages', 'core', 'package.json'),
        path.resolve(__dirname, '..', 'packages', 'webview', 'package.json'),
        path.resolve(__dirname, '..', 'packages', 'vscode', 'package.json'),
        path.resolve(__dirname, '..', 'packages', 'desktop', 'package.json'),
        path.resolve(__dirname, '..', 'packages', 'web', 'package.json'),
    ];

    try {
        const { version } = syncVersion({ rootPath, targets });
        console.log(`${LOG_PREFIX} All packages synced to version ${version}`);
    } catch (error) {
        console.error(`${LOG_PREFIX} ERROR: ${error.message}`);
        process.exit(1);
    }
}
