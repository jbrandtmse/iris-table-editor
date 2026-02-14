# Story 17.3: Web Theme Bridge

Status: done

## Story

As a **user**,
I want **the web app to support light and dark themes**,
So that **I can choose my preferred visual mode**.

## Acceptance Criteria

1. When I open the web app for the first time, the theme matches my OS preference (via `prefers-color-scheme` media query)
2. When I click the theme toggle icon in the header, the theme switches between light and dark, all `--ite-*` CSS variables update immediately, and the preference is saved to `localStorage`
3. When I return to the web app after setting a theme preference, my chosen theme is applied (overrides OS preference)
4. When the web theme bridge CSS is applied to the shared webview, all colors use `--ite-*` variables correctly and the visual appearance matches the desktop app's light/dark themes

## Tasks / Subtasks

- [x] Task 1: Create web theme bridge CSS (AC: 1, 4)
  - [x] 1.1: Read `packages/desktop/src/ui/theme/desktopThemeBridge.css` to understand the `--ite-*` CSS variable mapping
  - [x] 1.2: Create `packages/web/public/webThemeBridge.css` that provides the same `--ite-*` variables for light and dark themes
  - [x] 1.3: Use `[data-theme="dark"]` attribute on `<html>` for dark theme (matching the desktop approach)
  - [x] 1.4: Default theme follows `prefers-color-scheme` media query when no user preference exists
  - [x] 1.5: Ensure ALL `--ite-*` variables from the desktop bridge are present in the web bridge
  - [x] 1.6: Include the web theme bridge CSS in `index.html` (before the webview CSS)

- [x] Task 2: Add theme toggle to connection header (AC: 2)
  - [x] 2.1: Add a theme toggle button/icon in the page header (visible on both connection form and connected views)
  - [x] 2.2: Use sun/moon icons or a simple toggle icon (text-based, no external icon library)
  - [x] 2.3: Style the toggle button with BEM classes `.ite-theme-toggle`
  - [x] 2.4: Position the toggle in the top-right corner of the page

- [x] Task 3: Theme toggle JavaScript logic (AC: 2, 3)
  - [x] 3.1: Create theme initialization: check localStorage for `ite-theme-preference`, fall back to `prefers-color-scheme`
  - [x] 3.2: Apply theme by setting `data-theme` attribute on `<html>` element
  - [x] 3.3: On toggle click: switch theme, update `data-theme`, save to localStorage, update toggle icon
  - [x] 3.4: Listen for `prefers-color-scheme` changes (OS theme change) — apply if no user preference set
  - [x] 3.5: Expose for testing: `window.iteTheme = { toggle, getTheme, setTheme }`

- [x] Task 4: Verify shared webview renders correctly in both themes (AC: 4)
  - [x] 4.1: Verify the webview's styles.css uses `--ite-*` variables (it should — same as desktop)
  - [x] 4.2: Verify grid, toolbar, pagination, and form elements all theme correctly
  - [x] 4.3: Verify the connection form also uses themed variables (connection-form.css)
  - [x] 4.4: Update connection-form.css to use webThemeBridge variables instead of its own embedded dark theme variables

- [x] Task 5: Write tests (AC: 1-4)
  - [x] 5.1: Create `packages/web/src/test/webThemeBridge.test.ts`
  - [x] 5.2: Test that webThemeBridge.css is served and contains required `--ite-*` variables
  - [x] 5.3: Test that webThemeBridge.css has both light and dark theme definitions
  - [x] 5.4: Test that the theme toggle HTML exists in the SPA shell
  - [x] 5.5: Test that localStorage key `ite-theme-preference` is used (source verification of JS)
  - [x] 5.6: Test that `data-theme` attribute is the mechanism for theme switching
  - [x] 5.7: Run compile + lint + test to validate

## Dev Notes

- The desktop app uses `packages/desktop/src/ui/theme/desktopThemeBridge.css` to define `--ite-*` variables for light and dark themes
- The web app's `connection-form.css` already has its own embedded `--ite-theme-*` variables — this story should consolidate them into the shared webThemeBridge
- The existing `connection-form.css` uses `[data-theme="dark"]` which matches our approach
- Theme CSS should be loaded BEFORE the webview's styles.css so the variables are available
- The desktop approach: `desktopThemeBridge.css` maps Electron's theme tokens to `--ite-*` variables
- The web approach: `webThemeBridge.css` provides hardcoded light/dark tokens (no host to map from)
- Keep the theme JS in the existing `connection-form.js` IIFE or create a separate `theme.js` file

### Project Structure Notes

- `packages/web/public/webThemeBridge.css` — NEW: web-specific `--ite-*` CSS variables
- `packages/web/public/index.html` — add theme toggle, include webThemeBridge.css
- `packages/web/public/connection-form.js` — add theme logic (or create separate theme.js)
- `packages/web/public/connection-form.css` — remove embedded theme variables (use webThemeBridge instead)
- `packages/web/src/test/webThemeBridge.test.ts` — new test file

### References

- [Source: architecture.md#Theme Bridge] — CSS variable abstraction
- [Source: epics.md#Story 17.3] — Acceptance criteria
- [Source: desktop/src/ui/theme/desktopThemeBridge.css] — Desktop theme bridge (reference)
- [Source: web/public/connection-form.css] — Existing embedded theme variables

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None needed - all tests pass on first run.

### Completion Notes List
- Created `webThemeBridge.css` with all 70+ `--ite-theme-*` variables matching the desktop bridge for both light (`:root`) and dark (`:root[data-theme="dark"]`) themes
- Added `@media (prefers-color-scheme: dark)` block with `:root:not([data-theme])` selector for OS preference detection when no user preference is set
- Created `theme.js` with IIFE containing theme initialization, toggle, persistence to localStorage (`ite-theme-preference` key), OS preference listener, and `window.iteTheme` API exposure
- Added theme toggle button with sun/moon emoji icons in `.ite-page__header`, positioned top-right via flexbox, styled with `.ite-theme-toggle` BEM class
- Updated `connection-form.css` to remove all embedded `--ite-theme-*` hardcoded values, keeping only the alias layer (`--ite-fg: var(--ite-theme-fg)` etc.) that maps from the bridge
- Replaced `/webview/desktopThemeBridge.css` link with `webThemeBridge.css` in `index.html`; theme.js loaded in `<head>` to prevent FOUC
- Updated `spaShell.test.ts` to reflect the CSS link change (webThemeBridge.css instead of desktopThemeBridge.css)
- Created 22 new tests in `webThemeBridge.test.ts` covering CSS serving, variable presence, theme definitions, toggle HTML, JS source verification, and mechanism validation
- All 286 web tests pass, all 241 vscode tests pass; 5 pre-existing desktop test failures (unrelated)

### File List
- `packages/web/public/webThemeBridge.css` (NEW)
- `packages/web/public/theme.js` (NEW)
- `packages/web/src/test/webThemeBridge.test.ts` (NEW)
- `packages/web/public/index.html` (MODIFIED)
- `packages/web/public/connection-form.css` (MODIFIED)
- `packages/web/src/test/spaShell.test.ts` (MODIFIED)
