/**
 * Unit tests for Web Theme Bridge
 * Story 17.3: Web Theme Bridge - Task 5
 *
 * Tests theme CSS serving, variable definitions, toggle HTML,
 * and theme switching mechanism.
 * Uses Node.js built-in test runner.
 */
import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { createAppServer } from '../server/server';

let httpServer: Server;
let baseUrl: string;

async function startTestServer(): Promise<void> {
    const result = createAppServer({
        skipSecurity: true,
        cleanupIntervalMs: 0,
    });

    httpServer = result.server;

    await new Promise<void>((resolve) => {
        httpServer.listen(0, () => {
            const address = httpServer.address() as AddressInfo;
            baseUrl = `http://localhost:${address.port}`;
            resolve();
        });
    });
}

async function stopTestServer(): Promise<void> {
    if (httpServer) {
        await new Promise<void>((resolve, reject) => {
            httpServer.close((err) => {
                if (err) { reject(err); } else { resolve(); }
            });
        });
    }
}

describe('Web Theme Bridge (Story 17.3)', () => {
    before(async () => {
        await startTestServer();
    });

    after(async () => {
        await stopTestServer();
    });

    // ============================================
    // Task 5.2: webThemeBridge.css is served and contains --ite-* variables
    // ============================================

    describe('webThemeBridge.css serving', () => {
        it('should serve webThemeBridge.css with 200', async () => {
            const response = await fetch(`${baseUrl}/webThemeBridge.css`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('text/css'),
                `Expected text/css but got ${contentType}`
            );
        });

        it('should contain --ite-theme-fg variable', async () => {
            const response = await fetch(`${baseUrl}/webThemeBridge.css`);
            const body = await response.text();
            assert.ok(
                body.includes('--ite-theme-fg:'),
                'Should contain --ite-theme-fg variable'
            );
        });

        it('should contain --ite-theme-bg variable', async () => {
            const response = await fetch(`${baseUrl}/webThemeBridge.css`);
            const body = await response.text();
            assert.ok(
                body.includes('--ite-theme-bg:'),
                'Should contain --ite-theme-bg variable'
            );
        });

        it('should contain --ite-theme-button-bg variable', async () => {
            const response = await fetch(`${baseUrl}/webThemeBridge.css`);
            const body = await response.text();
            assert.ok(
                body.includes('--ite-theme-button-bg:'),
                'Should contain --ite-theme-button-bg variable'
            );
        });

        it('should contain --ite-theme-input-bg variable', async () => {
            const response = await fetch(`${baseUrl}/webThemeBridge.css`);
            const body = await response.text();
            assert.ok(
                body.includes('--ite-theme-input-bg:'),
                'Should contain --ite-theme-input-bg variable'
            );
        });
    });

    // ============================================
    // Task 5.3: Both light and dark theme definitions
    // ============================================

    describe('webThemeBridge.css theme definitions', () => {
        it('should have light theme as :root default', async () => {
            const response = await fetch(`${baseUrl}/webThemeBridge.css`);
            const body = await response.text();
            // Light theme uses :root without data-theme qualifier
            assert.ok(
                body.includes(':root {'),
                'Should have :root block for light theme defaults'
            );
        });

        it('should have dark theme via data-theme="dark"', async () => {
            const response = await fetch(`${baseUrl}/webThemeBridge.css`);
            const body = await response.text();
            assert.ok(
                body.includes(':root[data-theme="dark"]'),
                'Should have :root[data-theme="dark"] block for dark theme'
            );
        });

        it('should have prefers-color-scheme dark media query', async () => {
            const response = await fetch(`${baseUrl}/webThemeBridge.css`);
            const body = await response.text();
            assert.ok(
                body.includes('prefers-color-scheme: dark'),
                'Should include prefers-color-scheme: dark media query'
            );
        });

        it('should contain all variables from desktopThemeBridge.css', () => {
            // Read the desktop bridge to extract all variable names
            const desktopBridgePath = path.join(
                path.dirname(require.resolve('@iris-te/webview/package.json')),
                'src',
                'desktopThemeBridge.css'
            );
            const desktopCss = fs.readFileSync(desktopBridgePath, 'utf-8');
            const desktopVars = new Set<string>();
            const varRegex = /(--ite-theme-[\w-]+):/g;
            let match;
            while ((match = varRegex.exec(desktopCss)) !== null) {
                desktopVars.add(match[1]);
            }

            // Read the web bridge
            const webBridgePath = path.join(__dirname, '..', '..', 'public', 'webThemeBridge.css');
            const webCss = fs.readFileSync(webBridgePath, 'utf-8');

            // Check every variable from desktop bridge exists in web bridge
            for (const varName of desktopVars) {
                assert.ok(
                    webCss.includes(varName + ':'),
                    `Missing variable ${varName} from web theme bridge`
                );
            }
        });
    });

    // ============================================
    // Task 5.4: Theme toggle HTML in SPA shell
    // ============================================

    describe('Theme toggle HTML', () => {
        it('should include theme toggle button in the page header', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();
            assert.ok(
                body.includes('id="themeToggle"'),
                'Should include #themeToggle button'
            );
        });

        it('should include theme toggle icon element', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();
            assert.ok(
                body.includes('id="themeToggleIcon"'),
                'Should include #themeToggleIcon element'
            );
        });

        it('should have ite-theme-toggle BEM class on toggle button', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();
            assert.ok(
                body.includes('ite-theme-toggle'),
                'Should use .ite-theme-toggle BEM class'
            );
        });

        it('should have aria-label on toggle button', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();
            assert.ok(
                body.includes('aria-label="Toggle dark mode"'),
                'Should have accessible aria-label on toggle button'
            );
        });
    });

    // ============================================
    // Task 5.5: localStorage key ite-theme-preference used in JS
    // ============================================

    describe('Theme JavaScript', () => {
        it('should serve theme.js with 200', async () => {
            const response = await fetch(`${baseUrl}/theme.js`);
            assert.strictEqual(response.status, 200);

            const contentType = response.headers.get('content-type') || '';
            assert.ok(
                contentType.includes('javascript'),
                `Expected JavaScript content type but got ${contentType}`
            );
        });

        it('should use ite-theme-preference localStorage key', async () => {
            const response = await fetch(`${baseUrl}/theme.js`);
            const body = await response.text();
            assert.ok(
                body.includes('ite-theme-preference'),
                'Should use ite-theme-preference localStorage key'
            );
        });

        it('should expose window.iteTheme with toggle, getTheme, setTheme', async () => {
            const response = await fetch(`${baseUrl}/theme.js`);
            const body = await response.text();
            assert.ok(body.includes('window.iteTheme'), 'Should expose window.iteTheme');
            assert.ok(body.includes('toggle:'), 'Should expose toggle function');
            assert.ok(body.includes('getTheme:'), 'Should expose getTheme function');
            assert.ok(body.includes('setTheme:'), 'Should expose setTheme function');
        });

        it('should reference prefers-color-scheme for OS detection', async () => {
            const response = await fetch(`${baseUrl}/theme.js`);
            const body = await response.text();
            assert.ok(
                body.includes('prefers-color-scheme'),
                'Should check prefers-color-scheme for OS theme detection'
            );
        });
    });

    // ============================================
    // Task 5.6: data-theme attribute is the mechanism for theme switching
    // ============================================

    describe('Theme switching mechanism', () => {
        it('should use data-theme attribute in theme.js', async () => {
            const response = await fetch(`${baseUrl}/theme.js`);
            const body = await response.text();
            assert.ok(
                body.includes('data-theme'),
                'Should use data-theme attribute for theme switching'
            );
        });

        it('should use data-theme attribute in webThemeBridge.css', async () => {
            const response = await fetch(`${baseUrl}/webThemeBridge.css`);
            const body = await response.text();
            assert.ok(
                body.includes('data-theme'),
                'Should use data-theme attribute in CSS for dark theme'
            );
        });

        it('should include theme.js in the SPA shell HTML', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();
            assert.ok(
                body.includes('theme.js'),
                'Should include theme.js in the HTML'
            );
        });

        it('should load webThemeBridge.css before connection-form.css', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();

            const bridgePos = body.indexOf('webThemeBridge.css');
            const formPos = body.indexOf('connection-form.css');
            assert.ok(bridgePos > 0, 'Should include webThemeBridge.css');
            assert.ok(formPos > 0, 'Should include connection-form.css');
            assert.ok(
                bridgePos < formPos,
                'webThemeBridge.css should load before connection-form.css'
            );
        });

        it('should not include desktopThemeBridge.css in the HTML', async () => {
            const response = await fetch(`${baseUrl}/`);
            const body = await response.text();
            assert.ok(
                !body.includes('/webview/desktopThemeBridge.css'),
                'Should NOT include /webview/desktopThemeBridge.css in web HTML (replaced by webThemeBridge.css)'
            );
        });
    });

    // ============================================
    // Connection form CSS consolidation (Task 4.4)
    // ============================================

    describe('Connection form CSS consolidation', () => {
        it('should not define --ite-theme-* variables in connection-form.css', async () => {
            const response = await fetch(`${baseUrl}/connection-form.css`);
            const body = await response.text();

            // The connection-form.css should only have alias --ite-* vars (without -theme-),
            // not define its own --ite-theme-* values
            const themeVarDefs = body.match(/--ite-theme-[\w-]+:\s*#/g);
            assert.strictEqual(
                themeVarDefs,
                null,
                'connection-form.css should not define --ite-theme-* variables with hardcoded values (should come from webThemeBridge.css)'
            );
        });

        it('should have alias layer mapping --ite-* to --ite-theme-* in connection-form.css', async () => {
            const response = await fetch(`${baseUrl}/connection-form.css`);
            const body = await response.text();

            assert.ok(
                body.includes('--ite-fg: var(--ite-theme-fg)'),
                'Should have --ite-fg alias mapping to --ite-theme-fg'
            );
            assert.ok(
                body.includes('--ite-bg: var(--ite-theme-bg)'),
                'Should have --ite-bg alias mapping to --ite-theme-bg'
            );
        });
    });
});
