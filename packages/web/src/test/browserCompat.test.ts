/**
 * Story 19.2: Browser Compatibility Testing
 *
 * Verifies the web app uses only broadly-supported APIs and syntax
 * compatible with Chrome 120+, Firefox 121+, Safari 17+, and Edge 120+.
 *
 * Since these are server-side Node.js tests (no browser), we verify
 * source file patterns and API usage rather than runtime behavior.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const publicDir = path.join(__dirname, '..', '..', 'public');

// Read all public JS files
const jsFiles = fs.readdirSync(publicDir)
    .filter((f: string) => f.endsWith('.js'))
    .map((f: string) => ({
        name: f,
        content: fs.readFileSync(path.join(publicDir, f), 'utf-8'),
    }));

// Read all public CSS files
const cssFiles = fs.readdirSync(publicDir)
    .filter((f: string) => f.endsWith('.css'))
    .map((f: string) => ({
        name: f,
        content: fs.readFileSync(path.join(publicDir, f), 'utf-8'),
    }));

const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf-8');

// ============================================
// Task 2.2: Noscript fallback verification
// ============================================

describe('Noscript fallback (Story 19.2, Task 1)', () => {

    it('index.html contains a <noscript> tag', () => {
        assert.ok(indexHtml.includes('<noscript>'), 'index.html should contain <noscript> tag');
    });

    it('noscript message says JavaScript is required', () => {
        assert.ok(
            indexHtml.includes('JavaScript is required to use IRIS Table Editor'),
            'noscript should contain the required message text',
        );
    });

    it('noscript has inline styles for standalone rendering', () => {
        // Extract noscript block
        const noscriptMatch = indexHtml.match(/<noscript>([\s\S]*?)<\/noscript>/);
        assert.ok(noscriptMatch, 'noscript block should exist');
        const noscriptContent = noscriptMatch[1];
        assert.ok(noscriptContent.includes('style="'), 'noscript content should use inline styles');
    });

    it('noscript appears before main content', () => {
        const noscriptIndex = indexHtml.indexOf('<noscript>');
        const mainContentIndex = indexHtml.indexOf('class="ite-page"');
        assert.ok(noscriptIndex > -1, 'noscript tag should exist');
        assert.ok(mainContentIndex > -1, 'main content should exist');
        assert.ok(
            noscriptIndex < mainContentIndex,
            'noscript should appear before main content div',
        );
    });
});

// ============================================
// Task 2.3 / 2.6: JavaScript syntax compatibility
// ============================================

describe('JavaScript syntax compatibility (Story 19.2, Task 2)', () => {

    it('public JS files exist for testing', () => {
        assert.ok(jsFiles.length > 0, 'Should have public JS files to verify');
    });

    for (const file of jsFiles) {
        describe(file.name, () => {

            it('does not use top-level await', () => {
                // Top-level await would be 'await' at the start of a line (outside function bodies).
                // All files use IIFE pattern, so any 'await' should be inside a function.
                // Check for 'await' that is NOT inside a function — simple heuristic:
                // strip all function bodies and check if 'await' remains at top level.
                // Simpler approach: check that await only appears inside function/async contexts
                const lines = file.content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    // Skip comments
                    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
                        continue;
                    }
                    // A top-level await would be outside any IIFE — check for bare await at indent 0
                    if (/^await\s/.test(line)) {
                        assert.fail(
                            `${file.name} line ${i + 1}: top-level await is not supported in all browsers`,
                        );
                    }
                }
            });

            it('does not use ES module import/export statements', () => {
                const lines = file.content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    // Skip comments
                    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
                        continue;
                    }
                    // Check for module syntax (import/export at line start)
                    assert.ok(
                        !/^import\s/.test(line),
                        `${file.name} line ${i + 1}: ES module 'import' not compatible with IIFE scripts`,
                    );
                    assert.ok(
                        !/^export\s/.test(line),
                        `${file.name} line ${i + 1}: ES module 'export' not compatible with IIFE scripts`,
                    );
                }
            });

            it('uses var declarations (IIFE-compatible)', () => {
                assert.ok(
                    file.content.includes('var '),
                    `${file.name} should use var declarations for broad compatibility`,
                );
            });

            it('does not use optional chaining (?.)', () => {
                // Remove string literals and comments to avoid false positives
                const stripped = file.content
                    .replace(/\/\/.*$/gm, '')          // line comments
                    .replace(/\/\*[\s\S]*?\*\//g, '')  // block comments
                    .replace(/'[^']*'/g, '""')         // single-quoted strings
                    .replace(/"[^"]*"/g, '""');        // double-quoted strings
                assert.ok(
                    !stripped.includes('?.'),
                    `${file.name} should not use optional chaining (?.) for Safari compatibility`,
                );
            });

            it('does not use nullish coalescing (??)', () => {
                const stripped = file.content
                    .replace(/\/\/.*$/gm, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '')
                    .replace(/'[^']*'/g, '""')
                    .replace(/"[^"]*"/g, '""');
                assert.ok(
                    !stripped.includes('??'),
                    `${file.name} should not use nullish coalescing (??) for broader compatibility`,
                );
            });
        });
    }
});

// ============================================
// Task 2.4: WebSocket compatibility
// ============================================

describe('WebSocket compatibility (Story 19.2, Task 2)', () => {

    it('ws-reconnect.js uses standard WebSocket constructor', () => {
        const wsFile = jsFiles.find((f: { name: string }) => f.name === 'ws-reconnect.js');
        assert.ok(wsFile, 'ws-reconnect.js should exist');
        assert.ok(
            wsFile.content.includes('new WebSocket('),
            'Should use standard WebSocket constructor',
        );
    });

    it('ws-reconnect.js does not use MozWebSocket or other vendor prefixes', () => {
        const wsFile = jsFiles.find((f: { name: string }) => f.name === 'ws-reconnect.js');
        assert.ok(wsFile, 'ws-reconnect.js should exist');
        assert.ok(
            !wsFile.content.includes('MozWebSocket'),
            'Should not use deprecated MozWebSocket',
        );
        assert.ok(
            !wsFile.content.includes('webkitWebSocket'),
            'Should not use vendor-prefixed webkitWebSocket',
        );
    });
});

// ============================================
// Task 2.5: CSS compatibility
// ============================================

describe('CSS compatibility (Story 19.2, Task 2)', () => {

    it('public CSS files exist for testing', () => {
        assert.ok(cssFiles.length > 0, 'Should have public CSS files to verify');
    });

    for (const file of cssFiles) {
        describe(file.name, () => {

            it('does not use @container queries', () => {
                assert.ok(
                    !file.content.includes('@container'),
                    `${file.name} should not use @container queries (limited browser support)`,
                );
            });

            it('uses standard CSS custom properties', () => {
                // Verify files use var(-- syntax for custom properties
                if (file.content.includes('var(')) {
                    assert.ok(
                        file.content.includes('var(--'),
                        `${file.name} should use standard var(--name) syntax for custom properties`,
                    );
                }
            });

            it('does not use @layer at-rules', () => {
                assert.ok(
                    !file.content.includes('@layer'),
                    `${file.name} should not use @layer (limited Safari support before 15.4)`,
                );
            });
        });
    }
});

// ============================================
// Task 2.7: Standard API usage
// ============================================

describe('Standard API usage (Story 19.2, Task 2)', () => {

    it('WebMessageBridge.js uses addEventListener for event handling', () => {
        const bridgeFile = jsFiles.find((f: { name: string }) => f.name === 'WebMessageBridge.js');
        assert.ok(bridgeFile, 'WebMessageBridge.js should exist');
        assert.ok(
            bridgeFile.content.includes('addEventListener'),
            'Should use standard addEventListener API',
        );
    });

    it('WebMessageBridge.js uses removeEventListener for cleanup', () => {
        const bridgeFile = jsFiles.find((f: { name: string }) => f.name === 'WebMessageBridge.js');
        assert.ok(bridgeFile, 'WebMessageBridge.js should exist');
        assert.ok(
            bridgeFile.content.includes('removeEventListener'),
            'Should use standard removeEventListener API',
        );
    });

    it('ws-reconnect.js uses standard CustomEvent API', () => {
        const wsFile = jsFiles.find((f: { name: string }) => f.name === 'ws-reconnect.js');
        assert.ok(wsFile, 'ws-reconnect.js should exist');
        assert.ok(
            wsFile.content.includes('CustomEvent'),
            'Should use standard CustomEvent API for dispatching events',
        );
    });

    it('ws-reconnect.js uses standard dispatchEvent API', () => {
        const wsFile = jsFiles.find((f: { name: string }) => f.name === 'ws-reconnect.js');
        assert.ok(wsFile, 'ws-reconnect.js should exist');
        assert.ok(
            wsFile.content.includes('dispatchEvent'),
            'Should use standard dispatchEvent API',
        );
    });
});
