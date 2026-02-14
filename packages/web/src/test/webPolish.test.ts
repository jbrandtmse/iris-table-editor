/**
 * Story 19.5: Web-Specific Polish Tests
 *
 * Verifies that the web app has proper loading state, WebSocket reconnection UX,
 * responsive layout, and error recovery. These are source-level verification
 * tests that check HTML/CSS/JS file contents.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// __dirname at runtime is dist/test/, so go up to packages/web/ for public
const publicDir = path.join(__dirname, '..', '..', 'public');
// Source files are in src/server/, not dist/server/
const srcDir = path.join(__dirname, '..', '..', 'src');

const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf-8');
const connectionFormJs = fs.readFileSync(path.join(publicDir, 'connection-form.js'), 'utf-8');
const connectionFormCss = fs.readFileSync(path.join(publicDir, 'connection-form.css'), 'utf-8');
const wsReconnectJs = fs.readFileSync(path.join(publicDir, 'ws-reconnect.js'), 'utf-8');
const serverTs = fs.readFileSync(path.join(srcDir, 'server', 'server.ts'), 'utf-8');

// ============================================
// Task 1: Loading State (AC: 1)
// ============================================

describe('Loading state (Task 1)', () => {

    it('index.html has #ite-loading element', () => {
        assert.ok(
            indexHtml.includes('id="ite-loading"'),
            'index.html should have a loading element with id="ite-loading"'
        );
    });

    it('loading element has CSS spinner animation', () => {
        assert.ok(
            indexHtml.includes('ite-loading__spinner'),
            'index.html should have a spinner element'
        );
    });

    it('loading element has loading text', () => {
        assert.ok(
            indexHtml.includes('Loading IRIS Table Editor...'),
            'index.html should have loading text'
        );
    });

    it('inline style defines spinner keyframes animation', () => {
        assert.ok(
            indexHtml.includes('@keyframes ite-loading-spin'),
            'index.html should have inline CSS with spinner keyframes'
        );
    });

    it('loading element appears before main page content', () => {
        const loadingIndex = indexHtml.indexOf('id="ite-loading"');
        const pageIndex = indexHtml.indexOf('class="ite-page"');
        assert.ok(loadingIndex > 0, 'Loading element should exist');
        assert.ok(pageIndex > 0, 'Page element should exist');
        assert.ok(
            loadingIndex < pageIndex,
            'Loading element should appear before main page content'
        );
    });

    it('loading spinner is hidden by connection-form.js', () => {
        assert.ok(
            connectionFormJs.includes("getElementById('ite-loading')"),
            'connection-form.js should reference the loading element'
        );
        assert.ok(
            connectionFormJs.includes("display = 'none'"),
            'connection-form.js should hide the loading element'
        );
    });
});

// ============================================
// Task 2: WebSocket Reconnection UX (AC: 2)
// ============================================

describe('WebSocket reconnection UX (Task 2)', () => {

    it('ws-reconnect.js has reconnection logic', () => {
        assert.ok(
            wsReconnectJs.includes('scheduleReconnect'),
            'ws-reconnect.js should have scheduleReconnect function'
        );
    });

    it('ws-reconnect.js uses exponential backoff', () => {
        assert.ok(
            wsReconnectJs.includes('calculateBackoff'),
            'ws-reconnect.js should have calculateBackoff function'
        );
        assert.ok(
            wsReconnectJs.includes('Math.pow(2'),
            'ws-reconnect.js should use exponential calculation'
        );
    });

    it('ws-reconnect.js has configurable max retries', () => {
        assert.ok(
            wsReconnectJs.includes('MAX_RETRIES'),
            'ws-reconnect.js should have MAX_RETRIES constant'
        );
    });

    it('ws-reconnect.js has jitter for backoff', () => {
        assert.ok(
            wsReconnectJs.includes('JITTER_FACTOR'),
            'ws-reconnect.js should have JITTER_FACTOR for backoff jitter'
        );
    });

    it('connection-form.js has reconnect banner references', () => {
        assert.ok(
            connectionFormCss.includes('.ite-reconnect-banner'),
            'connection-form.css should have .ite-reconnect-banner styles'
        );
    });

    it('index.html has reconnect banner element', () => {
        assert.ok(
            indexHtml.includes('id="reconnectBanner"'),
            'index.html should have reconnect banner element'
        );
    });

    it('reconnect banner has ARIA role="alert"', () => {
        const bannerMatch = indexHtml.match(/id="reconnectBanner"[^>]*/);
        assert.ok(bannerMatch, 'Reconnect banner should exist');
        assert.ok(
            bannerMatch[0].includes('role="alert"'),
            'Reconnect banner should have role="alert" for screen readers'
        );
    });
});

// ============================================
// Task 3: Responsive Layout (AC: 3)
// ============================================

describe('Responsive layout (Task 3)', () => {

    it('connection-form.css has media queries', () => {
        assert.ok(
            connectionFormCss.includes('@media'),
            'connection-form.css should have @media queries'
        );
    });

    it('has @media breakpoint at max-width: 1200px', () => {
        assert.ok(
            connectionFormCss.includes('@media (max-width: 1200px)'),
            'Should have 1200px responsive breakpoint'
        );
    });

    it('has @media breakpoint at max-width: 1024px', () => {
        assert.ok(
            connectionFormCss.includes('@media (max-width: 1024px)'),
            'Should have 1024px responsive breakpoint'
        );
    });

    it('page layout uses flex for flexible sizing', () => {
        const pageMatch = connectionFormCss.match(
            /\.ite-page\s*\{([^}]*)\}/s
        );
        assert.ok(pageMatch, '.ite-page rule should exist');
        assert.ok(
            pageMatch[1].includes('display: flex'),
            '.ite-page should use flex layout'
        );
        assert.ok(
            pageMatch[1].includes('flex-direction: column'),
            '.ite-page should have column direction'
        );
    });

    it('connected view uses flex for flexible sizing', () => {
        const viewMatch = connectionFormCss.match(
            /\.ite-connected-view\s*\{([^}]*)\}/s
        );
        assert.ok(viewMatch, '.ite-connected-view rule should exist');
        assert.ok(
            viewMatch[1].includes('flex: 1'),
            '.ite-connected-view should have flex: 1'
        );
    });

    it('connection form has max-width but no fixed pixel width', () => {
        const formMatch = connectionFormCss.match(
            /\.ite-connection-form\s*\{([^}]*)\}/s
        );
        assert.ok(formMatch, '.ite-connection-form rule should exist');
        assert.ok(
            formMatch[1].includes('width: 100%'),
            '.ite-connection-form should have width: 100%'
        );
        assert.ok(
            formMatch[1].includes('max-width'),
            '.ite-connection-form should have max-width'
        );
    });
});

// ============================================
// Task 4: Error Recovery (AC: 4)
// ============================================

describe('Error recovery (Task 4)', () => {

    it('connection-form.js handles connection errors with user messages', () => {
        assert.ok(
            connectionFormJs.includes('showFormMessage'),
            'connection-form.js should have showFormMessage for user-facing errors'
        );
        assert.ok(
            connectionFormJs.includes("'error'"),
            'connection-form.js should display error type messages'
        );
    });

    it('connection-form.js handles network errors', () => {
        assert.ok(
            connectionFormJs.includes('Network error'),
            'connection-form.js should display network error messages'
        );
    });

    it('connection-form.js announces errors to screen readers', () => {
        assert.ok(
            connectionFormJs.includes('announce('),
            'connection-form.js should use announce() for screen reader announcements'
        );
    });

    it('server.ts has global error handler returning JSON', () => {
        assert.ok(
            serverTs.includes('Global error handler'),
            'server.ts should have a global error handler'
        );
        assert.ok(
            serverTs.includes('.json('),
            'server.ts error handler should return JSON responses'
        );
    });

    it('ws-reconnect.js handles WebSocket errors with reconnection', () => {
        assert.ok(
            wsReconnectJs.includes('ws.onerror'),
            'ws-reconnect.js should handle WebSocket errors'
        );
        assert.ok(
            wsReconnectJs.includes('scheduleReconnect'),
            'ws-reconnect.js should schedule reconnection on error'
        );
    });

    it('ws-reconnect.js handles session expiry separately', () => {
        assert.ok(
            wsReconnectJs.includes('WS_CLOSE_SESSION_EXPIRED'),
            'ws-reconnect.js should distinguish session expiry from network errors'
        );
        assert.ok(
            wsReconnectJs.includes('handleSessionExpired'),
            'ws-reconnect.js should delegate session expiry handling'
        );
    });
});
