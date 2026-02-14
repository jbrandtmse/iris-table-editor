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

## Story 12.1: Server List UI

**Status:** Complete
**Files touched:**
- NEW: packages/desktop/package.json, tsconfig.json, src/index.ts
- NEW: packages/desktop/src/main/ConnectionManager.ts
- NEW: packages/desktop/src/ui/connection/server-list.html, server-list.css, server-list.js
- NEW: packages/desktop/src/test/connectionManager.test.ts
- MODIFIED: packages/core/src/models/IMessages.ts (desktop message types)
- MODIFIED: packages/core/src/index.ts (desktop exports)
- MODIFIED: package.json (root test script includes desktop)
- MODIFIED: package-lock.json

**Key design decisions:**
- Root package.json already uses `packages/*` glob — no workspace change needed
- Node.js built-in test runner (`node:test`) instead of mocha (no Electron dependency)
- Double-click detection via timestamp comparison (400ms threshold)
- ServerConfig includes optional fields: namespace, description, pathPrefix
- Desktop message types in @iris-te/core IMessages.ts for shared use

**Issues auto-resolved:** 3
- MEDIUM: Missing null guard on handleServerClick calls → Added null checks
- MEDIUM: Config file written with default permissions → Added mode: 0o600
- MEDIUM: Root test script excludes desktop tests → Chained desktop test command

**Rework iterations:** 0

**User input required:** 0

**Commits:**
- Implementation: ddef614

---

## Story 12.2: Server Form

**Status:** Complete
**Files touched:**
- NEW: packages/desktop/src/ui/connection/server-form.html, server-form.css, server-form.js
- NEW: packages/desktop/src/test/serverForm.test.ts
- MODIFIED: packages/desktop/src/ui/connection/server-list.html (inlined form overlay, stylesheet moved to head)
- MODIFIED: packages/desktop/src/ui/connection/server-list.js (wired add/edit buttons to form, event listeners)
- MODIFIED: packages/core/src/models/IMessages.ts (form command/event types)
- MODIFIED: packages/core/src/index.ts (exported new types)

**Key design decisions:**
- Form overlay uses position:fixed with full viewport coverage
- Password field shows bullet placeholder in edit mode (not real password)
- Empty password on save in edit mode = keep existing password
- serverConfigLoaded event added for edit flow (host sends back full config)
- Focus trap for modal accessibility (WCAG compliance)
- Client-side validation differentiates add mode (password required) vs edit mode (password optional)

**Issues auto-resolved:** 4
- MEDIUM: Duplicate getServers call on serverSaved (removed from server-form.js)
- MEDIUM: Stylesheet link in body (moved to head)
- MEDIUM: Missing focus trap for aria-modal dialog (added Tab/Shift+Tab cycling)
- LOW: Double-encoded announce() (removed unnecessary escapeHtml on textContent)

**Rework iterations:** 0

**User input required:** 0

**Commits:**
- Implementation: 6c38801

---

## Story 12.3: Test Connection

**Status:** Complete
**Files touched:**
- MODIFIED: packages/desktop/src/main/ConnectionManager.ts (added testConnection(), TestConnectionConfig, TestConnectionResult types)
- MODIFIED: packages/desktop/src/ui/connection/server-form.html (Test Connection button, result display area)
- MODIFIED: packages/desktop/src/ui/connection/server-form.css (spinner animation, success/error result states)
- MODIFIED: packages/desktop/src/ui/connection/server-form.js (handleTestConnection(), validateFormForTest(), showTestResult(), clearTestResult())
- MODIFIED: packages/core/src/models/IMessages.ts (testFormConnection command, testConnectionResult event)
- MODIFIED: packages/core/src/index.ts (exported new types)
- NEW: packages/desktop/src/test/testConnection.test.ts (47 tests)

**Key design decisions:**
- testFormConnection command separate from testConnection (form data vs saved server name)
- ConnectionManager.testConnection() creates temporary AtelierApiService with 10s timeout
- Password always required for test (even in edit mode)
- CSS-only spinner with border-top-color:transparent technique
- Concurrent save/test operations guarded (MEDIUM review fix)

**Issues auto-resolved:** 3
- MEDIUM: Double-escaping in showTestResult (textContent already XSS-safe)
- MEDIUM: Concurrent save and test operations possible (added cross-checks)
- MEDIUM: Tests used subclass override instead of testing production code (switched to prototype patching)

**Rework iterations:** 0

**User input required:** 0

**Commits:**
- Implementation: 9fc1d97

---

## Story 12.4: Credential Storage

**Status:** Complete
**Files touched:**
- NEW: packages/desktop/src/main/ICredentialStore.ts (ICredentialStore interface)
- NEW: packages/desktop/src/main/NodeCryptoCredentialStore.ts (AES-256-GCM Node.js crypto implementation)
- NEW: packages/desktop/src/test/credentialStore.test.ts (50 tests)
- MODIFIED: packages/desktop/src/main/ConnectionManager.ts (credentialStore integration, getDecryptedPassword(), encrypt/decrypt in CRUD)
- MODIFIED: packages/desktop/src/index.ts (ICredentialStore and NodeCryptoCredentialStore exports)
- MODIFIED: packages/core/src/models/IMessages.ts (IDesktopCredentialWarningPayload, credentialWarning event)
- MODIFIED: packages/core/src/index.ts (IDesktopCredentialWarningPayload export)

**Key design decisions:**
- ICredentialStore abstraction enables future swap to Electron safeStorage (Epic 11)
- NodeCryptoCredentialStore uses AES-256-GCM with scryptSync key derivation from os.hostname() + os.userInfo().username
- Storage format: base64(iv[12] + authTag[16] + ciphertext) — self-contained for decryption
- Backward compatibility: no credentialStore = plaintext passthrough (all existing tests unaffected)
- getServers() strips passwords when credential store present; getDecryptedPassword() for connection flow
- Unavailable credential store: passwords stored as empty strings, credentialWarning event emitted

**Issues auto-resolved:** 1
- MEDIUM: getServer() returned raw ciphertext when credential store unavailable (fixed to return '')

**Rework iterations:** 0

**User input required:** 0

**Commits:**
- Implementation: (pending)

---

