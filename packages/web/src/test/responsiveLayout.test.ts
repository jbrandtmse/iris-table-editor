/**
 * Story 17.4: Responsive Layout Tests
 *
 * Verifies that the web app CSS provides full-width layout for the connected view
 * and responsive adjustments for different viewport widths.
 *
 * Since these are server-side Node.js tests (no browser rendering), we verify
 * CSS source properties and HTML structure rather than visual behavior.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const publicDir = path.join(__dirname, '..', '..', 'public');
const connectionFormCss = fs.readFileSync(path.join(publicDir, 'connection-form.css'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf-8');

describe('Responsive Layout (Story 17.4)', () => {

    // ============================================
    // Task 5.2: Connected view CSS does not constrain width
    // ============================================

    describe('Full-width connected view (Task 1)', () => {

        it('connected view has flex: 1 to fill available height', () => {
            const match = connectionFormCss.match(
                /\.ite-connected-view\s*\{[^}]*flex:\s*1[^}]*\}/s
            );
            assert.ok(match, '.ite-connected-view should have flex: 1');
        });

        it('connected view body has no centering constraints', () => {
            const bodyMatch = connectionFormCss.match(
                /\.ite-connected-view__body\s*\{([^}]*)\}/s
            );
            assert.ok(bodyMatch, '.ite-connected-view__body rule should exist');
            const bodyContent = bodyMatch[1];
            assert.ok(!bodyContent.includes('align-items: center'), 'Should not center-align items');
            assert.ok(!bodyContent.includes('text-align: center'), 'Should not center text');
            assert.ok(!bodyContent.includes('justify-content: center'), 'Should not center-justify');
        });

        it('connected view body has flex: 1 and no padding', () => {
            const bodyMatch = connectionFormCss.match(
                /\.ite-connected-view__body\s*\{([^}]*)\}/s
            );
            assert.ok(bodyMatch, '.ite-connected-view__body rule should exist');
            const bodyContent = bodyMatch[1];
            assert.ok(bodyContent.includes('flex: 1'), 'Should have flex: 1');
            assert.ok(bodyContent.includes('padding: 0'), 'Should have padding: 0');
        });

        it('ite-container fills full width inside connected view body', () => {
            const containerMatch = connectionFormCss.match(
                /\.ite-connected-view__body\s*>\s*\.ite-container\s*\{([^}]*)\}/s
            );
            assert.ok(containerMatch, '.ite-container rule inside connected view body should exist');
            const containerContent = containerMatch[1];
            assert.ok(containerContent.includes('width: 100%'), 'Should have width: 100%');
            assert.ok(containerContent.includes('flex: 1'), 'Should have flex: 1');
        });

        it('connected view has no fixed max-width constraint', () => {
            const match = connectionFormCss.match(
                /\.ite-connected-view\s*\{([^}]*)\}/s
            );
            assert.ok(match, '.ite-connected-view rule should exist');
            const content = match[1];
            // max-width: 100% is acceptable; fixed pixel value is not
            if (content.includes('max-width')) {
                assert.ok(content.includes('max-width: 100%'), 'max-width should be 100% if present');
            }
        });
    });

    // ============================================
    // Task 5.3: Responsive media query in connection-form.css
    // ============================================

    describe('Responsive media queries (Task 2, 4)', () => {

        it('has @media breakpoint at max-width: 1200px', () => {
            assert.ok(
                connectionFormCss.includes('@media (max-width: 1200px)'),
                'Should have 1200px breakpoint'
            );
        });

        it('has @media breakpoint at max-width: 1024px', () => {
            assert.ok(
                connectionFormCss.includes('@media (max-width: 1024px)'),
                'Should have 1024px breakpoint'
            );
        });

        it('1200px breakpoint adjusts page header padding', () => {
            const mediaMatch = connectionFormCss.match(
                /@media\s*\(max-width:\s*1200px\)\s*\{([\s\S]*?)\n\}/
            );
            assert.ok(mediaMatch, '1200px media query should exist');
            assert.ok(
                mediaMatch[1].includes('.ite-page__header'),
                'Should adjust page header in 1200px breakpoint'
            );
        });

        it('1200px breakpoint adjusts connection header padding', () => {
            const mediaMatch = connectionFormCss.match(
                /@media\s*\(max-width:\s*1200px\)\s*\{([\s\S]*?)\n\}/
            );
            assert.ok(mediaMatch, '1200px media query should exist');
            assert.ok(
                mediaMatch[1].includes('.ite-connection-header'),
                'Should adjust connection header in 1200px breakpoint'
            );
        });

        it('1024px breakpoint adjusts page content padding', () => {
            const mediaMatch = connectionFormCss.match(
                /@media\s*\(max-width:\s*1024px\)\s*\{([\s\S]*?)\n\}/
            );
            assert.ok(mediaMatch, '1024px media query should exist');
            assert.ok(
                mediaMatch[1].includes('.ite-page__content'),
                'Should adjust page content in 1024px breakpoint'
            );
        });

        it('page content removes padding when connected view is shown', () => {
            assert.ok(
                connectionFormCss.includes('.ite-page__content:has(.ite-connected-view:not([hidden]))'),
                'Should have :has() rule to remove padding when connected'
            );
            const hasMatch = connectionFormCss.match(
                /\.ite-page__content:has\(\.ite-connected-view:not\(\[hidden\]\)\)\s*\{([^}]*)\}/s
            );
            assert.ok(hasMatch, ':has() rule should exist');
            assert.ok(hasMatch[1].includes('padding: 0'), 'Should set padding: 0 when connected');
        });
    });

    // ============================================
    // Task 5.4: Grid wrapper has no fixed widths
    // ============================================

    describe('Grid wrapper flexibility (shared webview CSS)', () => {

        it('grid wrapper has no fixed pixel width', () => {
            const gridCssPath = path.join(
                path.dirname(require.resolve('@iris-te/webview/package.json')),
                'src',
                'grid-styles.css'
            );
            const css = fs.readFileSync(gridCssPath, 'utf-8');

            const wrapperMatch = css.match(
                /\.ite-grid-wrapper\s*\{([^}]*)\}/s
            );
            assert.ok(wrapperMatch, '.ite-grid-wrapper rule should exist');
            const hasFixedWidth = /\bwidth:\s*\d+px/.test(wrapperMatch[1]);
            assert.ok(!hasFixedWidth, 'Grid wrapper should not have a fixed pixel width');
        });

        it('grid wrapper has flex: 1', () => {
            const gridCssPath = path.join(
                path.dirname(require.resolve('@iris-te/webview/package.json')),
                'src',
                'grid-styles.css'
            );
            const css = fs.readFileSync(gridCssPath, 'utf-8');

            const wrapperMatch = css.match(
                /\.ite-grid-wrapper\s*\{([^}]*)\}/s
            );
            assert.ok(wrapperMatch, '.ite-grid-wrapper rule should exist');
            assert.ok(wrapperMatch[1].includes('flex: 1'), 'Grid wrapper should flex to fill space');
        });
    });

    // ============================================
    // Task 5.5: Viewport meta tag in index.html
    // ============================================

    describe('Viewport meta tag (Task 3)', () => {

        it('index.html has viewport meta tag', () => {
            assert.ok(
                indexHtml.includes('name="viewport"'),
                'index.html should have viewport meta tag'
            );
        });

        it('viewport sets width=device-width and initial-scale=1.0', () => {
            assert.ok(
                indexHtml.includes('width=device-width, initial-scale=1.0'),
                'Viewport should set width=device-width and initial-scale=1.0'
            );
        });

        it('connected view body contains ite-container div', () => {
            assert.ok(
                indexHtml.includes('ite-connected-view__body'),
                'Should have connected view body'
            );
            assert.ok(
                indexHtml.includes('ite-container'),
                'Should have ite-container inside connected view'
            );
        });

        it('connection header spans full width', () => {
            const headerMatch = connectionFormCss.match(
                /\.ite-connection-header\s*\{([^}]*)\}/s
            );
            assert.ok(headerMatch, '.ite-connection-header rule should exist');
            assert.ok(headerMatch[1].includes('width: 100%'), 'Should span full width');
        });
    });

    // ============================================
    // Page overflow prevention (Task 3.3)
    // ============================================

    describe('Page overflow prevention', () => {

        it('page has overflow-x: hidden to prevent horizontal scrollbar', () => {
            const pageMatch = connectionFormCss.match(
                /\.ite-page\s*\{([^}]*)\}/s
            );
            assert.ok(pageMatch, '.ite-page rule should exist');
            assert.ok(
                pageMatch[1].includes('overflow-x: hidden'),
                'Page should prevent horizontal scrollbar'
            );
        });
    });
});
