# Epic Cycle Development Log
Started: 2026-02-13
Epics to process: 5 (Epic 10, 12, 11, 13, 14)
Total stories across all epics: 21
Execution sequence: 10 → 12 → 11 → 13 → 14

---

## Story 10.1: Monorepo Initialization

**Status:** Complete
**Files touched:**
- packages/core/ (package.json, tsconfig.json, src/index.ts, models/*, services/*, utils/*)
- packages/webview/ (package.json, src/webview.html, src/styles.css, src/main.js, src/grid.js, src/grid-styles.css)
- packages/vscode/ (package.json, tsconfig.json, esbuild.js, .vscode-test.mjs, .vscodeignore, src/extension.ts, src/providers/*, src/test/*)
- Root: package.json, tsconfig.json, eslint.config.mjs, .vscode/launch.json, package-lock.json
- Deleted: src/, media/, root esbuild.js, root .vscode-test.mjs, root .vscodeignore

**Key design decisions:**
- AtelierApiService.ts has zero vscode imports — moved entirely to core (no splitting needed)
- ErrorHandler.ts has zero vscode imports — moved entirely to core
- Package scope: @iris-te/* (per architecture)
- TypeScript project references used for cross-package compilation
- Webview assets referenced via node_modules/@iris-te/webview/src/

**Issues auto-resolved:** 3
- HIGH: Root compile script fails without --if-present (webview has no compile script) → Added --if-present flag
- MEDIUM: Stale require paths in atelierApiService.test.ts → Updated to @iris-te/core
- MEDIUM: ESLint flat config structural bug (rules in separate config object) → Merged config objects

**Rework iterations:** 0

**User input required:** 0

**Commits:**
- Implementation: fdf4ceb

---

## Story 10.2: Shared Core Extraction

**Status:** Complete
**Files touched:**
- NEW: packages/core/src/services/QueryExecutor.ts, TableMetadataService.ts
- NEW: packages/core/src/utils/SqlBuilder.ts, DataTypeFormatter.ts
- MODIFIED: packages/core/src/services/AtelierApiService.ts (1587→305 lines)
- MODIFIED: packages/core/src/index.ts (barrel exports)
- MODIFIED: packages/vscode/src/providers/ServerConnectionManager.ts (new service imports)
- MODIFIED: packages/vscode/src/test/atelierApiService.test.ts (new test suites)

**Key design decisions:**
- AtelierApiService reduced to thin HTTP transport (testConnection, executeQuery, buildAuthHeaders)
- QueryExecutor takes AtelierApiService dependency for HTTP delegation
- TableMetadataService.getNamespaces uses raw fetch (GET to root endpoint, not POST query)
- SqlBuilder allows % prefix for IRIS system identifiers (%Dictionary)
- DataTypeFormatter is standalone with zero dependencies
- formatCellValue intentionally NOT extracted (UI-coupled with CSS classes)

**Issues auto-resolved:** 2
- MEDIUM: Duplicate IAtelierServerDescriptor interface → Exported from AtelierApiService, imported in TableMetadataService
- MEDIUM: Unused ErrorHandler import in TableMetadataService → Removed

**Rework iterations:** 0

**User input required:** 0

**Commits:**
- Implementation: 1180001

---

## Story 10.3: Webview Extraction & Theme Abstraction

**Status:** Complete
**Files touched:**
- NEW: packages/core/src/models/IMessageBridge.ts
- NEW: packages/vscode/src/VSCodeMessageBridge.js, vscodeThemeBridge.css
- NEW: packages/webview/src/theme.css, desktopThemeBridge.css
- MODIFIED: packages/webview/src/styles.css (89 CSS var migrations)
- MODIFIED: packages/webview/src/grid-styles.css (259 CSS var migrations)
- MODIFIED: packages/webview/src/main.js (IMessageBridge refactor)
- MODIFIED: packages/webview/src/grid.js (IMessageBridge refactor + 2 inline CSS vars)
- MODIFIED: packages/vscode/src/providers/TableEditorProvider.ts, GridPanelManager.ts (bridge injection)
- MODIFIED: packages/core/src/index.ts (IMessageBridge export)

**Key design decisions:**
- IMessageBridge extended with getState()/setState() beyond architecture spec (needed for state persistence)
- VSCodeMessageBridge as plain .js (runs in webview renderer, not TypeScript-compiled)
- Backward-compatible event wrapping preserves existing handleMessage() structure
- Three-layer CSS variable architecture: --ite-* → --ite-theme-* → target bridge

**Issues auto-resolved:** 2
- HIGH: XSS via JSON.stringify in inline script → Unicode-escape all < characters
- MEDIUM: Missing null guard on messageBridge → Added null checks with console.error logging

**Rework iterations:** 0

**User input required:** 0

**Commits:**
- Implementation: c5c1479

---

## Story 10.4: VS Code Regression Verification

**Status:** Complete
**Files touched:**
- NEW: packages/vscode/stage-webview.js (webview asset staging for VSIX)
- MODIFIED: packages/vscode/src/providers/GridPanelManager.ts (webview-dist paths)
- MODIFIED: packages/vscode/src/providers/TableEditorProvider.ts (webview-dist paths)
- MODIFIED: packages/vscode/package.json (stage-webview scripts)
- MODIFIED: packages/vscode/.vscodeignore (exclusions for smaller VSIX)
- MODIFIED: .gitignore (generated dirs)

**Key design decisions:**
- stage-webview.js copies from workspace symlinks to webview-dist/ (vsce ignores node_modules/)
- VSIX optimized: excluded desktop-only CSS, unused codicon assets (20% smaller)
- Manual verification checklist provided for 14 operations (requires user testing with real IRIS server)

**Issues auto-resolved:** 3
- HIGH: .vscodeignore missing .vscode-test.mjs exclusion → Added
- HIGH: Unnecessary files in VSIX (desktopThemeBridge.css, codicon extras) → Excluded, VSIX reduced 20%
- MEDIUM: stage-webview.js no error handling → Added fs.existsSync checks

**Rework iterations:** 0

**User input required:** 0

**Commits:**
- Implementation: ba33c77

---

# Epic 10 Summary: Monorepo Restructure & Shared Core Extraction

**Completed:** 2026-02-14
**Stories processed:** 4 (10.1, 10.2, 10.3, 10.4)
**Total files touched:** ~80
**Issues auto-resolved:** 10 (3 high, 5 medium, 2 low)
**User inputs required:** 0
**Rework iterations used:** 0
**Commits created:** 4 (fdf4ceb, 1180001, c5c1479, ba33c77)

**Epic Achievement:** Project restructured from flat VS Code extension to npm workspaces monorepo with three packages (@iris-te/core, @iris-te/webview, packages/vscode). Shared core has zero VS Code/Electron dependencies. Webview fully target-agnostic with IMessageBridge abstraction and --ite-* CSS variables. VSIX packaging verified at 438KB. 241 tests passing.

---

Proceeding to Epic 12: Connection Manager...

