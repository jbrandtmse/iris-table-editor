# Story 19.5: Web-Specific Polish

Status: review

## Story

As a **user**,
I want **the web app to feel polished and handle edge cases gracefully**,
So that **it meets the same quality bar as the other targets**.

## Acceptance Criteria

1. When the web app is loading, there is a loading spinner before the app is interactive
2. When the WebSocket connection drops, unsaved changes are preserved and a reconnection banner appears
3. When the browser window is resized, the layout adapts smoothly at all breakpoints
4. When errors occur, messages are clear and the app recovers gracefully (no stuck UI)

## Tasks / Subtasks

- [x] Task 1: Verify loading state (AC: 1)
  - [x] 1.1: Create `packages/web/src/test/webPolish.test.ts`
  - [x] 1.2: Verify index.html has a loading indicator element (spinner or message)
  - [x] 1.3: If missing, add a CSS-only loading spinner to index.html that is hidden when the app initializes

- [x] Task 2: Verify WebSocket reconnection UX (AC: 2)
  - [x] 2.1: Verify ws-reconnect.js has reconnection logic with exponential backoff
  - [x] 2.2: Verify connection-form.js has reconnect banner code
  - [x] 2.3: Verify connection-form.css has `.ite-reconnect-banner` styles

- [x] Task 3: Verify responsive layout (AC: 3)
  - [x] 3.1: Verify connection-form.css has media queries for responsive breakpoints
  - [x] 3.2: Verify the connected view layout uses flexible sizing (flex/grid)
  - [x] 3.3: Verify no fixed-width elements that would break on small screens

- [x] Task 4: Verify error recovery (AC: 4)
  - [x] 4.1: Verify connection-form.js handles connection errors with user-facing messages
  - [x] 4.2: Verify the error handler middleware returns JSON errors (not HTML)
  - [x] 4.3: Verify WebSocket error handling includes reconnection

- [x] Task 5: Run compile + lint + test to validate
  - [x] 5.1: Run `npm run compile` — must pass
  - [x] 5.2: Run `npm run lint` — must pass
  - [x] 5.3: Run `npm run test --workspace=packages/web` — must pass

## Dev Notes

### What Already Exists
- WebSocket reconnection with exponential backoff (`ws-reconnect.js`)
- Reconnect banner in connection form (`connection-form.js` + `.ite-reconnect-banner` in CSS)
- Responsive media queries in `connection-form.css` (1024px and 1200px breakpoints)
- JSON error responses from error handler middleware (Story 18.5)
- Theme-aware CSS variables from webThemeBridge.css

### What May Need Adding
- A loading spinner in index.html (currently it may just show a blank page until JS loads)
- The loading spinner should be CSS-only (no JS dependency) and should be hidden when the main app initializes

### Loading Spinner Pattern
```html
<!-- In index.html body, before scripts -->
<div id="ite-loading" class="ite-loading">
    <div class="ite-loading__spinner"></div>
    <p class="ite-loading__text">Loading IRIS Table Editor...</p>
</div>
```
```css
/* Inline in index.html or in a small CSS block */
.ite-loading { display:flex; justify-content:center; align-items:center; height:100vh; }
.ite-loading__spinner { width:40px; height:40px; border:3px solid #555; border-top-color:#007acc; border-radius:50%; animation:ite-spin 0.8s linear infinite; }
@keyframes ite-spin { to { transform:rotate(360deg); } }
```

The loading div gets hidden by the app JS when it initializes (connection-form.js or spa-router.js can do `document.getElementById('ite-loading').style.display = 'none'`).

### Project Structure Notes
- `packages/web/public/index.html` — MODIFY: add loading spinner if missing
- `packages/web/src/test/webPolish.test.ts` — NEW: polish verification tests

### References
- [Source: epics.md#Story 19.5] — Acceptance criteria

## Files Changed

- `packages/web/public/index.html` — Added CSS-only loading spinner (inline `<style>` + `#ite-loading` div); updated fallback CSP to allow `'unsafe-inline'` for style-src
- `packages/web/public/connection-form.js` — Added code to hide loading spinner on initialization
- `packages/web/src/test/webPolish.test.ts` — NEW: 24 verification tests across 4 suites (loading state, WS reconnection, responsive layout, error recovery)

## Completion Notes

- Added CSS-only loading spinner to `index.html` with inline `<style>` tag (loads before external CSS)
- Spinner uses `ite-loading-spin` keyframe name (avoids collision with existing `ite-spin` in connection-form.css)
- Spinner uses `--ite-theme-bg` and `--ite-theme-fg` CSS vars with dark fallbacks for theme awareness
- Loading div is hidden by `connection-form.js` during initialization via `display: 'none'`
- Fallback CSP updated: `style-src 'self' 'unsafe-inline'` to allow the inline `<style>` tag (server-side helmet CSP remains unchanged)
- Tasks 2-4 verified existing implementations: WebSocket reconnection with exponential backoff, reconnect banner, responsive media queries, JSON error responses from global error handler
- All 746 web package tests pass (24 new), compile and lint clean
