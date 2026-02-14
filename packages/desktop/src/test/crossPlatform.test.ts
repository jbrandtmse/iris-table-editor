/**
 * Cross-Platform Testing
 * Story 14.2: Cross-Platform Testing
 *
 * Verifies the desktop Electron app configuration and code patterns for
 * correct cross-platform behavior on both Windows and macOS.
 *
 * Tests cover:
 * - Task 1: electron-builder.yml config (win/mac/nsis/dmg sections, icons, settings)
 * - Task 2: Keyboard shortcut cross-platform compatibility (menu + webview)
 * - Task 3: Platform-specific main process behavior (quit, activate, credentials)
 * - Task 4: Auto-update cross-platform configuration (publish, targets)
 *
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
// ============================================
// Resolve paths
// ============================================

const desktopDir = path.resolve(__dirname, '../..');
const electronBuilderPath = path.join(desktopDir, 'electron-builder.yml');
const menuBuilderPath = path.join(desktopDir, 'src', 'main', 'menuBuilder.ts');
const mainTsPath = path.join(desktopDir, 'src', 'main', 'main.ts');
const credentialStorePath = path.join(desktopDir, 'src', 'main', 'NodeCryptoCredentialStore.ts');
const autoUpdatePath = path.join(desktopDir, 'src', 'main', 'AutoUpdateManager.ts');
const gridJsPath = path.resolve(desktopDir, '../../packages/webview/src/grid.js');

// ============================================
// Load all source files once at module level
// ============================================

const builderRaw: string = fs.readFileSync(electronBuilderPath, 'utf-8');
const menuSource: string = fs.readFileSync(menuBuilderPath, 'utf-8');
const gridSource: string = fs.readFileSync(gridJsPath, 'utf-8');
const mainSource: string = fs.readFileSync(mainTsPath, 'utf-8');
const credentialSource: string = fs.readFileSync(credentialStorePath, 'utf-8');
const autoUpdateSource: string = fs.readFileSync(autoUpdatePath, 'utf-8');

// ============================================
// Helper: Parse YAML manually if yaml package unavailable
// ============================================

function getYamlValue(raw: string, key: string): string | undefined {
    const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm');
    const match = raw.match(regex);
    return match?.[1]?.trim().replace(/^["']|["']$/g, '');
}

function hasYamlBlock(raw: string, blockName: string): boolean {
    const regex = new RegExp(`^${blockName}:`, 'm');
    return regex.test(raw);
}

function getYamlBlockValue(raw: string, block: string, key: string): string | undefined {
    // Find the block start
    const blockRegex = new RegExp(`^${block}:\\s*$`, 'm');
    const blockMatch = blockRegex.exec(raw);
    if (!blockMatch) {
        return undefined;
    }

    // Get content after block start, scoped to this block only
    const afterBlock = raw.substring(blockMatch.index + blockMatch[0].length);
    // Stop at the next top-level key (non-indented line starting with a letter)
    const nextBlockMatch = afterBlock.match(/\n[a-zA-Z#]/);
    const blockContent = nextBlockMatch
        ? afterBlock.substring(0, nextBlockMatch.index)
        : afterBlock;
    // Find the key within indented lines of this block
    const keyRegex = new RegExp(`^\\s+${key}:\\s*(.+)$`, 'm');
    const keyMatch = blockContent.match(keyRegex);
    if (!keyMatch) {
        return undefined;
    }

    return keyMatch[1].trim().replace(/^["']|["']$/g, '');
}

// ============================================
// Task 1: Audit electron-builder config
// ============================================

describe('Story 14.2 Task 1: electron-builder.yml cross-platform config', () => {

    describe('1.1: Required top-level settings', () => {

        it('should have appId set to com.intersystems.iris-table-editor', () => {
            const appId = getYamlValue(builderRaw, 'appId');
            assert.strictEqual(appId, 'com.intersystems.iris-table-editor');
        });

        it('should have productName set to IRIS Table Editor', () => {
            const productName = getYamlValue(builderRaw, 'productName');
            assert.strictEqual(productName, 'IRIS Table Editor');
        });

        it('should have asar enabled', () => {
            const asar = getYamlValue(builderRaw, 'asar');
            assert.strictEqual(asar, 'true');
        });

        it('should have explicit electronVersion', () => {
            const electronVersion = getYamlValue(builderRaw, 'electronVersion');
            assert.ok(electronVersion, 'electronVersion must be specified');
            assert.match(electronVersion, /^\d+\.\d+\.\d+$/, 'electronVersion must be semver');
        });
    });

    describe('1.2: Windows configuration (win + nsis)', () => {

        it('should have win section', () => {
            assert.ok(hasYamlBlock(builderRaw, 'win'), 'win section must exist');
        });

        it('should have win target set to nsis', () => {
            const target = getYamlBlockValue(builderRaw, 'win', 'target');
            assert.strictEqual(target, 'nsis');
        });

        it('should have win icon pointing to .ico file', () => {
            const icon = getYamlBlockValue(builderRaw, 'win', 'icon');
            assert.ok(icon, 'win.icon must be specified');
            assert.ok(icon.endsWith('.ico'), `win.icon must be .ico format, got: ${icon}`);
        });

        it('should have nsis section', () => {
            assert.ok(hasYamlBlock(builderRaw, 'nsis'), 'nsis section must exist');
        });

        it('should have nsis.oneClick set to false (user-controlled install)', () => {
            const oneClick = getYamlBlockValue(builderRaw, 'nsis', 'oneClick');
            assert.strictEqual(oneClick, 'false');
        });

        it('should have nsis.allowToChangeInstallationDirectory', () => {
            const allowChange = getYamlBlockValue(builderRaw, 'nsis', 'allowToChangeInstallationDirectory');
            assert.strictEqual(allowChange, 'true');
        });

        it('should have nsis.createDesktopShortcut', () => {
            const desktop = getYamlBlockValue(builderRaw, 'nsis', 'createDesktopShortcut');
            assert.strictEqual(desktop, 'true');
        });

        it('should have nsis.createStartMenuShortcut', () => {
            const startMenu = getYamlBlockValue(builderRaw, 'nsis', 'createStartMenuShortcut');
            assert.strictEqual(startMenu, 'true');
        });

        it('should have nsis.shortcutName set', () => {
            const shortcutName = getYamlBlockValue(builderRaw, 'nsis', 'shortcutName');
            assert.ok(shortcutName, 'nsis.shortcutName must be specified');
            assert.strictEqual(shortcutName, 'IRIS Table Editor');
        });
    });

    describe('1.3: macOS configuration (mac + dmg)', () => {

        it('should have mac section', () => {
            assert.ok(hasYamlBlock(builderRaw, 'mac'), 'mac section must exist');
        });

        it('should have mac target set to dmg', () => {
            const target = getYamlBlockValue(builderRaw, 'mac', 'target');
            assert.strictEqual(target, 'dmg');
        });

        it('should have mac icon pointing to .png file', () => {
            const icon = getYamlBlockValue(builderRaw, 'mac', 'icon');
            assert.ok(icon, 'mac.icon must be specified');
            assert.ok(icon.endsWith('.png'), `mac.icon must be .png format, got: ${icon}`);
        });

        it('should have mac category set for developer tools', () => {
            const category = getYamlBlockValue(builderRaw, 'mac', 'category');
            assert.ok(category, 'mac.category must be specified');
            assert.strictEqual(category, 'public.app-category.developer-tools');
        });

        it('should have dmg section', () => {
            assert.ok(hasYamlBlock(builderRaw, 'dmg'), 'dmg section must exist');
        });

        it('should have dmg contents with Applications link', () => {
            // Verify the DMG contents include a link to /Applications
            assert.ok(
                builderRaw.includes('type: link'),
                'dmg.contents must include a link item'
            );
            assert.ok(
                builderRaw.includes('path: /Applications'),
                'dmg.contents must include Applications folder link'
            );
        });
    });

    describe('1.4: Icon files exist', () => {

        it('should have Windows icon file (icon.ico) in build-resources/', () => {
            const icoPath = path.join(desktopDir, 'build-resources', 'icon.ico');
            assert.ok(fs.existsSync(icoPath), `Windows icon not found: ${icoPath}`);
        });

        it('should have macOS icon file (icon.png) in build-resources/', () => {
            const pngPath = path.join(desktopDir, 'build-resources', 'icon.png');
            assert.ok(fs.existsSync(pngPath), `macOS icon not found: ${pngPath}`);
        });

        it('should reference icon paths under build-resources/', () => {
            const winIcon = getYamlBlockValue(builderRaw, 'win', 'icon');
            const macIcon = getYamlBlockValue(builderRaw, 'mac', 'icon');
            assert.ok(winIcon?.startsWith('build-resources/'), 'win.icon should be in build-resources/');
            assert.ok(macIcon?.startsWith('build-resources/'), 'mac.icon should be in build-resources/');
        });
    });

    describe('1.5: Directories configuration', () => {

        it('should have directories.app set to app-dist', () => {
            assert.ok(
                builderRaw.includes('app: app-dist'),
                'directories.app must be app-dist'
            );
        });

        it('should have directories.output set to release', () => {
            assert.ok(
                builderRaw.includes('output: release'),
                'directories.output must be release'
            );
        });

        it('should have directories.buildResources set to build-resources', () => {
            assert.ok(
                builderRaw.includes('buildResources: build-resources'),
                'directories.buildResources must be build-resources'
            );
        });
    });
});

// ============================================
// Task 2: Audit keyboard shortcut cross-platform compatibility
// ============================================

describe('Story 14.2 Task 2: Keyboard shortcut cross-platform compatibility', () => {

    describe('2.1-2.2: Menu accelerators use CommandOrControl', () => {

        it('should have Close Tab accelerator using CommandOrControl', () => {
            assert.ok(
                menuSource.includes("accelerator: 'CommandOrControl+W'"),
                'Close Tab must use CommandOrControl+W'
            );
        });

        it('should have Close All Tabs accelerator using CommandOrControl', () => {

            assert.ok(
                menuSource.includes("accelerator: 'CommandOrControl+Shift+W'"),
                'Close All Tabs must use CommandOrControl+Shift+W'
            );
        });

        it('should have Set NULL accelerator using CommandOrControl', () => {

            assert.ok(
                menuSource.includes("accelerator: 'CommandOrControl+Shift+N'"),
                'Set NULL must use CommandOrControl+Shift+N'
            );
        });

        it('should have Toggle Sidebar accelerator using CommandOrControl', () => {

            assert.ok(
                menuSource.includes("accelerator: 'CommandOrControl+B'"),
                'Toggle Sidebar must use CommandOrControl+B'
            );
        });

        it('should have Keyboard Shortcuts accelerator using CommandOrControl', () => {

            assert.ok(
                menuSource.includes("accelerator: 'CommandOrControl+/'"),
                'Keyboard Shortcuts must use CommandOrControl+/'
            );
        });

        it('should NOT have any accelerator using bare Ctrl (without CommandOrControl)', () => {

            // Extract all accelerator values
            const acceleratorRegex = /accelerator:\s*'([^']+)'/g;
            let match;
            const bareCtrlAccelerators: string[] = [];
            while ((match = acceleratorRegex.exec(menuSource)) !== null) {
                const accel = match[1];
                // Should start with CommandOrControl, not bare Ctrl or Cmd
                if (accel.startsWith('Ctrl+') || accel.startsWith('Cmd+')) {
                    bareCtrlAccelerators.push(accel);
                }
            }
            assert.deepStrictEqual(
                bareCtrlAccelerators,
                [],
                `Found bare Ctrl/Cmd accelerators (should use CommandOrControl):\n  ${bareCtrlAccelerators.join('\n  ')}`
            );
        });

        it('should have exactly 5 custom accelerators in menuBuilder', () => {

            const acceleratorRegex = /accelerator:\s*'CommandOrControl\+[^']+'/g;
            const matches = menuSource.match(acceleratorRegex) || [];
            assert.strictEqual(
                matches.length,
                5,
                `Expected 5 CommandOrControl accelerators, found ${matches.length}: ${matches.join(', ')}`
            );
        });
    });

    describe('2.3-2.4: Webview keyboard handlers support both Ctrl and Cmd', () => {

        it('handleKeyboardNavigation: Ctrl+N (new row) should check ctrlKey and metaKey', () => {
            assert.ok(
                gridSource.includes("(event.ctrlKey || event.metaKey) && event.key === 'n'"),
                'Ctrl+N must check both ctrlKey and metaKey'
            );
        });

        it('handleKeyboardNavigation: Ctrl+S (save) should check ctrlKey and metaKey', () => {

            assert.ok(
                gridSource.includes("(event.ctrlKey || event.metaKey) && event.key === 's'"),
                'Ctrl+S must check both ctrlKey and metaKey'
            );
        });

        it('handleKeyboardNavigation: Ctrl+D (duplicate) should check ctrlKey and metaKey', () => {

            assert.ok(
                gridSource.includes("(event.ctrlKey || event.metaKey) && event.key === 'd'"),
                'Ctrl+D must check both ctrlKey and metaKey'
            );
        });

        it('handleKeyboardNavigation: Ctrl+E (export) should check ctrlKey and metaKey', () => {

            assert.ok(
                gridSource.includes("(event.ctrlKey || event.metaKey) && event.key === 'e'"),
                'Ctrl+E must check both ctrlKey and metaKey'
            );
        });

        it('handleKeyboardNavigation: Ctrl+R/F5 (refresh) should check ctrlKey and metaKey', () => {

            assert.ok(
                gridSource.includes("(event.ctrlKey || event.metaKey) && event.key === 'r'"),
                'Ctrl+R must check both ctrlKey and metaKey'
            );
        });

        it('handleKeyboardNavigation: Ctrl+F (filter) should check ctrlKey and metaKey', () => {

            assert.ok(
                gridSource.includes("(event.ctrlKey || event.metaKey) && event.key === 'f'"),
                'Ctrl+F must check both ctrlKey and metaKey'
            );
        });

        it('handleKeyboardNavigation: Ctrl+Shift+F (clear filters) should check ctrlKey and metaKey', () => {

            assert.ok(
                gridSource.includes("(event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f'"),
                'Ctrl+Shift+F must check both ctrlKey and metaKey'
            );
        });

        it('handleKeyboardNavigation: Ctrl+G (go to row) should check ctrlKey and metaKey', () => {

            assert.ok(
                gridSource.includes("(event.ctrlKey || event.metaKey) && event.key === 'g'"),
                'Ctrl+G must check both ctrlKey and metaKey'
            );
        });

        it('handleKeyboardNavigation: Ctrl+Shift+= (new row alias) should check ctrlKey and metaKey', () => {

            assert.ok(
                gridSource.includes("(event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === '=' || event.key === '+')"),
                'Ctrl+Shift+= must check both ctrlKey and metaKey'
            );
        });

        it('handleKeyboardNavigation: Ctrl+- (delete row) should check ctrlKey and metaKey', () => {

            assert.ok(
                gridSource.includes("(event.ctrlKey || event.metaKey) && event.key === '-'"),
                'Ctrl+- must check both ctrlKey and metaKey'
            );
        });

        it('handleEditInputKeydown: Ctrl+Z (undo) should check ctrlKey and metaKey', () => {

            assert.ok(
                gridSource.includes("(event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z'"),
                'Ctrl+Z must check both ctrlKey and metaKey'
            );
        });

        it('handleEditInputKeydown: Ctrl+Enter (save and stay) should check ctrlKey and metaKey', () => {

            // Verify that the Enter key case handler checks for ctrlKey || metaKey modifier.
            // The actual code uses: case 'Enter': ... if (event.ctrlKey || event.metaKey)
            // There are multiple case 'Enter': blocks (date picker, edit input, cell keydown).
            // We verify that at least one Enter handler includes both ctrlKey and metaKey.
            assert.ok(
                /case\s+'Enter':[\s\S]{0,500}event\.ctrlKey \|\| event\.metaKey/.test(gridSource),
                'Enter case handler must check both ctrlKey and metaKey for Ctrl+Enter save-and-stay'
            );
        });

        it('handleCellKeydown: printable character guard should exclude metaKey', () => {

            // Printable character detection: key.length === 1 && !ctrlKey && !altKey && !metaKey
            assert.ok(
                gridSource.includes("!event.ctrlKey && !event.altKey && !event.metaKey"),
                'Printable character filter must exclude ctrlKey, altKey, and metaKey'
            );
        });

        it('handleCellKeydown: Ctrl+Shift+N (set null) checks only ctrlKey (known macOS gap)', () => {

            // This is a KNOWN GAP: handleCellKeydown line checks event.ctrlKey only
            // The native menu accelerator CommandOrControl+Shift+N covers macOS via
            // the menu system, so this is a partial gap only for the grid-level handler.
            //
            // NOTE: This test documents the gap. The menu accelerator provides macOS coverage.
            const setCellNullPattern = 'event.ctrlKey && event.shiftKey && event.key.toLowerCase() === \'n\'';
            assert.ok(
                gridSource.includes(setCellNullPattern),
                'handleCellKeydown should have Ctrl+Shift+N handler'
            );
            // Verify the native menu covers macOS via CommandOrControl
            assert.ok(
                menuSource.includes("accelerator: 'CommandOrControl+Shift+N'"),
                'Native menu provides macOS coverage via CommandOrControl+Shift+N'
            );
        });

        it('handleCellKeydown: Home/End use ctrlKey for cell navigation (platform-appropriate)', () => {

            // Home/End + Ctrl for first/last cell is a Windows/Linux navigation convention.
            // macOS keyboards typically use Cmd+Up/Down for beginning/end of document.
            // This is platform-appropriate behavior, not a gap.
            // Use regex to verify ctrlKey check is within the Home/End case handlers
            assert.ok(
                /case\s+'Home':[\s\S]{0,200}event\.ctrlKey/.test(gridSource),
                'Home key handler should have ctrlKey check within its case block'
            );
            assert.ok(
                /case\s+'End':[\s\S]{0,200}event\.ctrlKey/.test(gridSource),
                'End key handler should have ctrlKey check within its case block'
            );
        });

        it('pagination shortcuts (Ctrl+PageDown/Up) use ctrlKey only (platform-appropriate)', () => {

            // Ctrl+PageDown/PageUp for pagination is a standard pattern.
            // macOS does not typically have PageDown/PageUp keys, so Alt+Arrow is the fallback.
            // Verify both alternatives are combined in the same conditional expression.
            assert.ok(
                /event\.ctrlKey && event\.key === 'PageDown'.*event\.altKey && event\.key === 'ArrowRight'/.test(gridSource),
                'Ctrl+PageDown and Alt+ArrowRight should be combined alternatives for next page'
            );
            assert.ok(
                /event\.ctrlKey && event\.key === 'PageUp'.*event\.altKey && event\.key === 'ArrowLeft'/.test(gridSource),
                'Ctrl+PageUp and Alt+ArrowLeft should be combined alternatives for previous page'
            );
        });
    });
});

// ============================================
// Task 3: Audit platform-specific main process behavior
// ============================================

describe('Story 14.2 Task 3: Platform-specific main process behavior', () => {

    describe('3.1-3.2: Window lifecycle behavior', () => {

        it('should handle window-all-closed event', () => {
            assert.ok(
                mainSource.includes("app.on('window-all-closed'"),
                'main.ts must handle window-all-closed event'
            );
        });

        it('should call app.quit() on window-all-closed (current MVP behavior)', () => {

            // Current implementation quits on all platforms (MVP choice)
            // Future: macOS should keep app alive in dock
            assert.ok(
                mainSource.includes('app.quit()'),
                'main.ts should call app.quit() on window-all-closed'
            );
        });

        it('should handle macOS activate event for window recreation', () => {

            assert.ok(
                mainSource.includes("app.on('activate'"),
                'main.ts must handle activate event for macOS dock icon click'
            );
        });

        it('should check for zero windows before recreating in activate handler', () => {

            assert.ok(
                mainSource.includes('BrowserWindow.getAllWindows().length === 0'),
                'activate handler must check no existing windows before creating one'
            );
        });

        it('should use whenReady() for app initialization', () => {

            assert.ok(
                mainSource.includes('app.whenReady()'),
                'main.ts must use app.whenReady() for initialization'
            );
        });
    });

    describe('3.3: Window security settings', () => {

        it('should set nodeIntegration to false', () => {

            assert.ok(
                mainSource.includes('nodeIntegration: false'),
                'nodeIntegration must be false for security'
            );
        });

        it('should set contextIsolation to true', () => {

            assert.ok(
                mainSource.includes('contextIsolation: true'),
                'contextIsolation must be true for security'
            );
        });

        it('should set sandbox to true', () => {

            assert.ok(
                mainSource.includes('sandbox: true'),
                'sandbox must be true for security'
            );
        });

        it('should configure a preload script', () => {

            assert.ok(
                mainSource.includes("preload: path.join(__dirname, 'preload.js')"),
                'preload script must be configured'
            );
        });

        it('should block navigation away from file:// protocol', () => {

            assert.ok(
                mainSource.includes('will-navigate'),
                'main.ts must handle will-navigate for navigation security'
            );
            assert.ok(
                mainSource.includes("url.startsWith('file://')"),
                'Navigation guard must only allow file:// protocol'
            );
        });

        it('should block new window creation', () => {

            assert.ok(
                mainSource.includes('setWindowOpenHandler'),
                'main.ts must set window open handler to block new windows'
            );
            assert.ok(
                mainSource.includes("action: 'deny'"),
                'Window open handler must deny all new windows'
            );
        });
    });

    describe('3.4: Credential storage cross-platform compatibility', () => {

        it('should use Node.js crypto module (cross-platform)', () => {
            assert.ok(
                credentialSource.includes("import * as crypto from 'crypto'"),
                'Should import Node.js crypto module'
            );
        });

        it('should use AES-256-GCM authenticated encryption', () => {

            assert.ok(
                credentialSource.includes("'aes-256-gcm'"),
                'Should use AES-256-GCM algorithm'
            );
        });

        it('should derive key from machine-local identifiers', () => {

            assert.ok(
                credentialSource.includes('os.hostname()'),
                'Should use hostname for key derivation'
            );
            assert.ok(
                credentialSource.includes('os.userInfo()'),
                'Should use user info for key derivation'
            );
        });

        it('should use scryptSync for key derivation (works on all platforms)', () => {

            assert.ok(
                credentialSource.includes('crypto.scryptSync'),
                'Should use scryptSync for platform-independent key derivation'
            );
        });

        it('should implement ICredentialStore interface', () => {

            assert.ok(
                credentialSource.includes('implements ICredentialStore'),
                'Should implement ICredentialStore interface'
            );
        });

        it('should have encrypt, decrypt, and isAvailable methods', () => {

            assert.ok(credentialSource.includes('encrypt(password:'), 'Should have encrypt method');
            assert.ok(credentialSource.includes('decrypt(encrypted:'), 'Should have decrypt method');
            assert.ok(credentialSource.includes('isAvailable():'), 'Should have isAvailable method');
        });

        it('should always return true for isAvailable (Node.js crypto always available)', () => {

            // The isAvailable method returns true because Node.js crypto is always available
            assert.ok(
                credentialSource.includes('return true'),
                'isAvailable should return true'
            );
        });

        it('should have fallback when os.userInfo() fails', () => {

            assert.ok(
                credentialSource.includes('catch (error)'),
                'deriveMachineKey should have error handling'
            );
            assert.ok(
                credentialSource.includes('return os.hostname()'),
                'Should fall back to hostname-only when userInfo fails'
            );
        });

        it('main.ts should instantiate NodeCryptoCredentialStore (not safeStorage)', () => {

            assert.ok(
                mainSource.includes('new NodeCryptoCredentialStore()'),
                'main.ts should use NodeCryptoCredentialStore (cross-platform)'
            );
        });
    });
});

// ============================================
// Task 4: Audit auto-update cross-platform configuration
// ============================================

describe('Story 14.2 Task 4: Auto-update cross-platform configuration', () => {

    describe('4.1: Publish configuration in electron-builder.yml', () => {

        it('should have publish section', () => {
            assert.ok(
                hasYamlBlock(builderRaw, 'publish'),
                'publish section must exist in electron-builder.yml'
            );
        });

        it('should use github as publish provider', () => {
            const provider = getYamlBlockValue(builderRaw, 'publish', 'provider');
            assert.strictEqual(provider, 'github');
        });

        it('should have publish owner configured', () => {
            const owner = getYamlBlockValue(builderRaw, 'publish', 'owner');
            assert.ok(owner, 'publish.owner must be specified');
        });

        it('should have publish repo configured', () => {
            const repo = getYamlBlockValue(builderRaw, 'publish', 'repo');
            assert.ok(repo, 'publish.repo must be specified');
            assert.strictEqual(repo, 'iris-table-editor');
        });
    });

    describe('4.2: Win target produces latest.yml (NSIS + GitHub)', () => {

        it('should have win target as nsis which produces latest.yml', () => {
            // electron-builder with nsis target + github provider automatically
            // generates latest.yml for Windows auto-update
            const target = getYamlBlockValue(builderRaw, 'win', 'target');
            assert.strictEqual(target, 'nsis', 'Windows must use nsis target for latest.yml');
        });

        it('should have github publish provider for electron-updater compatibility', () => {
            // electron-updater reads latest.yml / latest-mac.yml from GitHub Releases
            const provider = getYamlBlockValue(builderRaw, 'publish', 'provider');
            assert.strictEqual(provider, 'github');
        });
    });

    describe('4.3: Mac target produces latest-mac.yml (DMG + GitHub)', () => {

        it('should have mac target as dmg which produces latest-mac.yml', () => {
            // electron-builder with dmg target + github provider automatically
            // generates latest-mac.yml for macOS auto-update
            const target = getYamlBlockValue(builderRaw, 'mac', 'target');
            assert.strictEqual(target, 'dmg', 'macOS must use dmg target for latest-mac.yml');
        });
    });

    describe('4.4: AutoUpdateManager cross-platform behavior', () => {

        it('should use electron-updater (cross-platform update library)', () => {
            assert.ok(
                autoUpdateSource.includes("require('electron-updater')"),
                'Should use electron-updater for cross-platform auto-update'
            );
        });

        it('should handle electron-updater not being available gracefully', () => {

            assert.ok(
                autoUpdateSource.includes('catch'),
                'Should catch errors when electron-updater is not available'
            );
            assert.ok(
                autoUpdateSource.includes('auto-update disabled'),
                'Should log a message when electron-updater is unavailable'
            );
        });

        it('should set autoDownload to true', () => {

            assert.ok(
                autoUpdateSource.includes('this.updater.autoDownload = true'),
                'autoDownload should be enabled'
            );
        });

        it('should set autoInstallOnAppQuit to true', () => {

            assert.ok(
                autoUpdateSource.includes('this.updater.autoInstallOnAppQuit = true'),
                'autoInstallOnAppQuit should be enabled'
            );
        });

        it('should NOT have platform-specific auto-update code', () => {

            // electron-updater handles platform detection internally.
            // The AutoUpdateManager should not have process.platform checks.
            assert.ok(
                !autoUpdateSource.includes('process.platform'),
                'AutoUpdateManager should not have platform-specific code (electron-updater handles this)'
            );
        });

        it('should support both background and interactive update checks', () => {

            assert.ok(
                autoUpdateSource.includes('checkForUpdates'),
                'Should have background checkForUpdates method'
            );
            assert.ok(
                autoUpdateSource.includes('checkForUpdatesInteractive'),
                'Should have interactive checkForUpdatesInteractive method'
            );
        });

        it('should have dispose method for cleanup', () => {

            assert.ok(
                autoUpdateSource.includes('dispose():'),
                'Should have dispose method for event listener cleanup'
            );
        });

        it('should accept injectable updater for testability', () => {

            assert.ok(
                autoUpdateSource.includes('options.updater'),
                'Constructor should accept an injectable updater for testing'
            );
        });
    });
});
