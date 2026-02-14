/**
 * Stage webview assets for VSIX packaging.
 *
 * vsce always ignores node_modules/ internally, regardless of .vscodeignore.
 * In a monorepo, workspace packages (@iris-te/webview) are hoisted as symlinks
 * to root node_modules/ and unavailable during vsce package.
 *
 * This script copies runtime webview assets to webview-dist/ so they are
 * included in the VSIX. The providers reference this path at runtime.
 */
const fs = require('fs');
const path = require('path');

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

const rootModules = path.resolve(__dirname, '..', '..', 'node_modules');
const webviewDist = path.join(__dirname, 'webview-dist');

// Clean previous staging
if (fs.existsSync(webviewDist)) {
    fs.rmSync(webviewDist, { recursive: true });
}

// Stage @iris-te/webview/src (CSS, JS, HTML for webviews)
const webviewSrc = path.join(rootModules, '@iris-te', 'webview', 'src');
if (!fs.existsSync(webviewSrc)) {
    console.error(`ERROR: ${webviewSrc} not found. Run 'npm install' from the repository root first.`);
    process.exit(1);
}
const webviewDestDir = path.join(webviewDist, 'webview');
console.log('Staging @iris-te/webview assets...');
copyDirRecursive(webviewSrc, webviewDestDir);

// Stage @vscode/codicons/dist (CSS, fonts)
const codiconsSrc = path.join(rootModules, '@vscode', 'codicons', 'dist');
if (!fs.existsSync(codiconsSrc)) {
    console.error(`ERROR: ${codiconsSrc} not found. Run 'npm install' from the repository root first.`);
    process.exit(1);
}
const codiconsDest = path.join(webviewDist, 'codicons');
console.log('Staging @vscode/codicons assets...');
copyDirRecursive(codiconsSrc, codiconsDest);

console.log('Webview assets staged to webview-dist/');
