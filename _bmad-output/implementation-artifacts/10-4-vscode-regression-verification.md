# Story 10.4: VS Code Regression Verification

Status: done

## Story

As a **developer**,
I want **to verify the VS Code extension works identically after the monorepo restructure**,
so that **existing users are not impacted by the desktop expansion**.

## Acceptance Criteria

1. **Given** the monorepo restructure is complete (Stories 10.1-10.3), **When** I build the VS Code extension from `packages/vscode`, **Then** `npm run compile` succeeds without errors **And** the extension activates in VS Code Extension Development Host

2. **Given** the restructured extension is running, **When** I perform all operations (connect, browse, edit, filter, sort, paginate, export, import, shortcuts, themes), **Then** each works identically to before the restructure (NOTE: Manual verification by user — agent verifies automated checks only)

3. **Given** all existing tests exist, **When** I run `npm run test`, **Then** all tests pass **And** no test modifications were needed beyond import path changes

4. **Given** the extension is packaged, **When** I run `npm run package` from `packages/vscode`, **Then** a valid .vsix file is produced

## Tasks / Subtasks

- [x] Task 1: Verify build pipeline (AC: 1)
  - [x] 1.1: Run `npm run compile` from root — must succeed
  - [x] 1.2: Run `npm run compile` from `packages/vscode` — must succeed
  - [x] 1.3: Run `npm run compile` from `packages/core` — must succeed
  - [x] 1.4: Verify the extension entry point exists at the expected path after build

- [x] Task 2: Verify test suite (AC: 3)
  - [x] 2.1: Run `npm run lint` — must pass with zero errors
  - [x] 2.2: Run `npm run test` — all tests must pass
  - [x] 2.3: Document test count and results

- [x] Task 3: Verify VSIX packaging (AC: 4)
  - [x] 3.1: Install `@vscode/vsce` if not already available
  - [x] 3.2: Run `npm run package` from `packages/vscode` (or `vsce package` directly)
  - [x] 3.3: Verify a .vsix file is produced
  - [x] 3.4: If packaging fails, identify and fix the issue (likely path or file reference problems in .vscodeignore or package.json)

- [x] Task 4: Architecture compliance audit (AC: 1, 2)
  - [x] 4.1: Verify packages/core has ZERO `vscode` or `electron` imports
  - [x] 4.2: Verify packages/webview has ZERO `acquireVsCodeApi` or `--vscode-*` references
  - [x] 4.3: Verify IMessageBridge is properly exported from @iris-te/core
  - [x] 4.4: Verify VSCodeMessageBridge.js is injected into webview HTML by providers
  - [x] 4.5: Verify CSS load order: theme.css -> vscodeThemeBridge.css -> styles.css -> grid-styles.css

- [x] Task 5: Cross-reference cleanup (AC: 1)
  - [x] 5.1: Check for any stale references to old paths (src/, media/)
  - [x] 5.2: Verify .vscodeignore includes correct paths for new structure
  - [x] 5.3: Verify launch.json points to correct paths
  - [x] 5.4: Fix any issues found

- [x] Task 6: Document verification results (AC: 1, 2, 3, 4)
  - [x] 6.1: Create manual verification checklist for user (14 operations from epic)
  - [x] 6.2: Document all automated verification results
  - [x] 6.3: Note any known limitations or issues

## Dev Notes

### Previous Story Intelligence (10.1, 10.2, 10.3)

**Story 10.1** — Monorepo restructured: packages/core, packages/webview, packages/vscode
**Story 10.2** — Core extraction: AtelierApiService -> thin HTTP transport, new QueryExecutor, TableMetadataService, SqlBuilder, DataTypeFormatter
**Story 10.3** — Theme abstraction: 348 --vscode-* -> --ite-*, IMessageBridge, VSCodeMessageBridge.js, theme bridge CSS files
**All stories**: 241 tests passing, compile and lint clean

### This Story is Primarily Verification

This is NOT a feature implementation story. The work is:
1. Run all automated checks (compile, lint, test, package)
2. Fix any remaining issues from the restructure
3. Prepare verification checklist for manual user testing
4. Document the verification results

### VSIX Packaging Notes

- `vsce package` needs to run from `packages/vscode/` directory
- `.vscodeignore` in packages/vscode/ must correctly exclude non-essential files
- `package.json` in packages/vscode/ must have all VS Code extension fields
- May need `vsce` installed: `npm install -g @vscode/vsce` or use npx

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.4: VS Code Regression Verification]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
N/A - verification story

### Completion Notes List

**Task 1 - Build Pipeline: PASS**
- `npm run compile` succeeds from root (all workspaces), packages/vscode, and packages/core
- Extension entry point `packages/vscode/dist/extension.js` exists (2.4MB bundled)
- No compilation errors or warnings

**Task 2 - Test Suite: PASS**
- `npm run lint` passes with zero errors across core and vscode workspaces
- `npm run test` passes: 241 tests passing across 11 test suites (9s)
- Test suites: UrlBuilder, TableEditorProvider, ServerConnectionManager, GridPanelManager, Extension, ErrorHandler, AtelierApiService, QueryExecutor, TableMetadataService, SqlBuilder, DataTypeFormatter
- No test modifications were needed

**Task 3 - VSIX Packaging: PASS (with fixes applied)**
- vsce 3.7.1 used via npx
- VSIX produced: `iris-table-editor-0.1.1.vsix` (22 files, 551.61 KB)
- **Issues found and fixed:**
  1. vsce always ignores `node_modules/` internally — webview assets from `@iris-te/webview` and `@vscode/codicons` were not included
  2. `resources/icon.svg` and `resources/icon.png` missing from `packages/vscode/`
  3. `LICENSE` file missing from `packages/vscode/`
  4. `src/VSCodeMessageBridge.js` and `src/vscodeThemeBridge.css` excluded by `src/**` in `.vscodeignore`
- **Fixes applied:**
  1. Created `stage-webview.js` script that copies webview assets to `webview-dist/` (non-node_modules path) before packaging
  2. Updated providers (TableEditorProvider, GridPanelManager) to reference `webview-dist/webview/` and `webview-dist/codicons/` instead of `node_modules/`
  3. Copied `resources/` and `LICENSE` to `packages/vscode/`
  4. Updated `.vscodeignore` to keep bridge files from `src/`
  5. Added `stage-webview` to `compile` and `vscode:prepublish` scripts
  6. Updated `.gitignore` with `webview-dist/`, `packages/vscode/resources/`, `packages/vscode/LICENSE`

**Task 4 - Architecture Compliance: PASS**
- packages/core: ZERO `vscode` or `electron` imports confirmed
- packages/webview: ZERO `acquireVsCodeApi` or `--vscode-*` references confirmed
- IMessageBridge exported from `@iris-te/core` via `packages/core/src/index.ts`
- VSCodeMessageBridge.js injected by both TableEditorProvider and GridPanelManager
- CSS load order correct: codicon.css -> theme.css -> vscodeThemeBridge.css -> styles.css/grid-styles.css

**Task 5 - Cross-reference Cleanup: PASS**
- No stale references to old `media/` directory
- No remaining references to old `node_modules/@iris-te/` paths in source
- `.vscodeignore` updated for new structure
- `launch.json` correctly targets `packages/vscode`
- `tasks.json` build task uses root `npm run watch`
- Workspace file correctly configured

**Task 6 - Documentation: PASS**

### Manual Verification Checklist (for user)

The following 14 operations should be manually verified by running the extension in VS Code Extension Development Host:

1. [ ] **Connect** - Select a server from the sidebar and connect successfully
2. [ ] **Browse namespaces** - After connecting, namespace list loads in dropdown
3. [ ] **Browse tables** - After selecting namespace, table list loads
4. [ ] **Open table** - Double-click/open a table to see grid view
5. [ ] **View data** - Table data displays correctly in the grid
6. [ ] **Edit cell** - Click a cell, modify value, press Enter to save
7. [ ] **Filter** - Apply column filters and verify results update
8. [ ] **Sort** - Click column header to sort ascending/descending
9. [ ] **Paginate** - Navigate between pages using pagination controls
10. [ ] **Export CSV** - Export current page or all data to CSV
11. [ ] **Export Excel** - Export current page or all data to Excel
12. [ ] **Import CSV** - Import data from a CSV file
13. [ ] **Keyboard shortcuts** - Ctrl+N (new row), Ctrl+S (save), Del (delete), Ctrl+E (export)
14. [ ] **Themes** - Verify extension respects VS Code light/dark/high-contrast themes

### Automated Verification Summary

| Check | Result | Details |
|-------|--------|---------|
| `npm run compile` (root) | PASS | All workspaces compile |
| `npm run compile` (packages/vscode) | PASS | TypeScript + esbuild |
| `npm run compile` (packages/core) | PASS | TypeScript |
| Entry point exists | PASS | dist/extension.js (2.4MB) |
| `npm run lint` | PASS | Zero errors |
| `npm run test` | PASS | 241 tests, 11 suites, 9s |
| `vsce package` | PASS | 22 files, 551.61 KB |
| Core: no vscode imports | PASS | Zero matches |
| Webview: no VS Code refs | PASS | Zero matches |
| IMessageBridge exported | PASS | core/src/index.ts |
| Bridge JS injected | PASS | Both providers |
| CSS load order | PASS | Correct cascade |
| No stale paths | PASS | Clean |
| launch.json paths | PASS | Correct |

### Known Limitations

- VSIX packaging requires the `stage-webview` script to run before `vsce package` (handled automatically by `vscode:prepublish`)
- The `webview-dist/` directory is a generated staging area and should not be committed (added to `.gitignore`)
- `packages/vscode/resources/` and `packages/vscode/LICENSE` are copies from root (added to `.gitignore`)

### File List

- `packages/vscode/src/providers/GridPanelManager.ts` — Updated webview asset paths from node_modules to webview-dist
- `packages/vscode/src/providers/TableEditorProvider.ts` — Updated webview asset paths from node_modules to webview-dist
- `packages/vscode/package.json` — Added stage-webview script, updated compile and vscode:prepublish
- `packages/vscode/.vscodeignore` — Updated to handle new structure, keep bridge files, exclude unused staged files and test config
- `packages/vscode/stage-webview.js` — NEW: Script to stage webview assets for VSIX packaging (with error handling)
- `.gitignore` — Added webview-dist/, packages/vscode/resources/, packages/vscode/LICENSE

### Code Review Fixes Applied

**[HIGH] `.vscodeignore` missing exclusions** — Added `.vscode-test.mjs` exclusion (test config was in VSIX). Added exclusions for unused staged files: `desktopThemeBridge.css`, `webview.html`, `codicon.csv`, `codicon.html`, `codicon.svg`. Reduced VSIX from 22 files/551KB to 16 files/438KB.

**[MEDIUM] `stage-webview.js` no error handling** — Added existence checks for source directories with actionable error messages directing users to run `npm install` first.
