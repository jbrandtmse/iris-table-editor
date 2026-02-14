# Story 17.4: Responsive Layout

Status: done

## Story

As a **user**,
I want **the web app to use the full browser window for maximum data visibility**,
So that **I can see more data than the sidebar-constrained VS Code panel**.

## Acceptance Criteria

1. When I open the web app in a browser, the grid takes the full width of the viewport (no sidebar), the header bar shows connection context, and the tab bar shows open tables
2. When my browser window is 1920px wide, columns spread to fill available space and more columns are visible than in VS Code's sidebar panel
3. When my browser window is at minimum width (1024px), the toolbar adapts (icons collapse if needed), the grid scrolls horizontally for wide tables, and all functionality remains accessible
4. When the browser is resized, the layout adapts smoothly without layout breaks

## Tasks / Subtasks

- [x] Task 1: Full-width connected view layout (AC: 1, 2)
  - [x] 1.1: Remove centering/padding from `.ite-connected-view__body` so the grid uses full viewport width
  - [x] 1.2: Ensure `.ite-container` fills the full available width (no max-width constraint)
  - [x] 1.3: The grid wrapper (`.ite-grid-wrapper`) should extend to fill the available width
  - [x] 1.4: Verify columns spread to fill available space at wide viewport (1920px+)
  - [x] 1.5: Ensure header bar (`.ite-connection-header`) spans full width (already does)

- [x] Task 2: Minimum viewport width support (AC: 3)
  - [x] 2.1: Add CSS to ensure layout works at minimum 1024px viewport width
  - [x] 2.2: Grid must scroll horizontally when table columns exceed viewport width (already supported via overflow-x: auto)
  - [x] 2.3: Toolbar elements should wrap or collapse at narrow widths if needed
  - [x] 2.4: Connection form should remain usable at 1024px (already max-width: 440px)

- [x] Task 3: Smooth resize behavior (AC: 4)
  - [x] 3.1: Verify no layout breaks when resizing between 1024px and 2560px
  - [x] 3.2: Grid should adapt smoothly (CSS flexbox/grid handles this)
  - [x] 3.3: No horizontal scrollbar on the page itself (only inside the grid if needed)
  - [x] 3.4: Connection header info truncates with ellipsis (already implemented)

- [x] Task 4: Responsive CSS adjustments (AC: 3, 4)
  - [x] 4.1: Add `@media` breakpoint for narrow viewports (max-width: 1200px) to adjust padding/spacing
  - [x] 4.2: Page header padding reduces at narrow widths
  - [x] 4.3: Connected view body reduces padding at narrow widths
  - [x] 4.4: Ensure toolbar doesn't overflow at narrow widths

- [x] Task 5: Write tests (AC: 1-4)
  - [x] 5.1: Create `packages/web/src/test/responsiveLayout.test.ts`
  - [x] 5.2: Test that connected view CSS does not constrain max-width (verify CSS source)
  - [x] 5.3: Test that connection-form.css has responsive media query
  - [x] 5.4: Test that grid wrapper doesn't have fixed widths (verify grid-styles.css source)
  - [x] 5.5: Test that index.html has viewport meta tag (already present)
  - [x] 5.6: Run compile + lint + test to validate

## Dev Notes

- The grid already uses `overflow-x: auto` for horizontal scrolling (grid-styles.css line 605)
- `.ite-connected-view__body` currently has `padding: 48px 24px`, `align-items: center`, and `text-align: center` — these are holdovers from the "empty state" placeholder and should be adjusted for the grid
- The shared webview CSS in `packages/webview/src/` handles internal grid layout — this story only adjusts the *outer container* (the web app shell CSS)
- Don't modify the shared webview CSS — only modify `connection-form.css` (web-specific CSS)
- The tab bar mentioned in AC 1 refers to the existing grid tab bar in the webview, not a new component
- The "columns spread to fill" behavior depends on the grid.js column sizing logic — verify it works at wide viewports
- Minimum 1024px is a soft minimum (documented in NFR38) — below this, horizontal scrolling is acceptable

### Project Structure Notes

- `packages/web/public/connection-form.css` — modify: responsive adjustments to connected view, media queries
- `packages/web/src/test/responsiveLayout.test.ts` — NEW: responsive layout tests
- `packages/web/public/index.html` — verify only (viewport meta tag already present)

### References

- [Source: architecture.md#Theme Bridge] — CSS variable system
- [Source: epics.md#Story 17.4] — Acceptance criteria
- [Source: webview/src/grid-styles.css] — Grid CSS (read-only reference)
- [Source: web/public/connection-form.css] — Web shell CSS to modify

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None needed - CSS changes are straightforward.

### Completion Notes List
- Modified `.ite-connected-view` to include `flex: 1` so it fills available viewport height
- Replaced `.ite-connected-view__body` placeholder styles (centered, padded) with full-width flex layout (`flex: 1`, `min-height: 0`, `padding: 0`)
- Added `.ite-connected-view__body > .ite-container` rule for full-width grid hosting (`flex: 1`, `width: 100%`, `min-height: 0`)
- Added `@media (max-width: 1200px)` breakpoint: reduces header and connection header padding
- Added `@media (max-width: 1024px)` breakpoint: further reduces padding, adjusts page content padding
- Existing `.ite-page__content:has(.ite-connected-view:not([hidden]))` already removes content padding for connected view
- Grid horizontal scrolling already handled by webview's `overflow-x: auto`
- Connection header already has `text-overflow: ellipsis` for long connection info
- Created 13 tests in `responsiveLayout.test.ts` covering full-width layout, media queries, and HTML structure
- All 299 web tests pass; compile and lint clean

### File List
- `packages/web/public/connection-form.css` (MODIFIED)
- `packages/web/src/test/responsiveLayout.test.ts` (NEW)
