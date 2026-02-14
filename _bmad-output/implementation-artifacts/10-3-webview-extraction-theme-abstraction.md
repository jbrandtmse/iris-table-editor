# Story 10.3: Webview Extraction & Theme Abstraction

Status: done

## Story

As a **developer**,
I want **the webview HTML/CSS/JS extracted into packages/webview with `--ite-*` CSS variables replacing `--vscode-*`**,
so that **the grid UI can run identically in both VS Code and Electron targets**.

## Acceptance Criteria

1. **Given** the webview files in packages/webview/src/, **When** extraction is complete, **Then** `packages/webview/` contains:
   - `webview.html` — shared grid HTML structure (already present)
   - `styles.css` — all CSS using `--ite-*` variables (NO direct `--vscode-*` references)
   - `main.js` — webview logic using IMessageBridge abstraction (NO `acquireVsCodeApi`)
   - `theme.css` — abstract `--ite-*` variable definitions
   - `grid.js` — grid logic using IMessageBridge (NO `acquireVsCodeApi`)
   - `grid-styles.css` — grid CSS using `--ite-*` variables (NO `--vscode-*`)

2. **Given** `styles.css` and `grid-styles.css` have been migrated, **When** I search for `--vscode-` in `packages/webview/src/`, **Then** zero results are found **And** all color references use `--ite-*` variables

3. **Given** `main.js` and `grid.js` have been migrated to use IMessageBridge, **When** I search for `acquireVsCodeApi` in `packages/webview/src/`, **Then** zero results are found **And** all host communication uses `messageBridge.sendCommand()` and `messageBridge.onEvent()`

4. **Given** the VS Code target includes `vscodeThemeBridge.css`, **When** the grid renders in VS Code, **Then** the visual appearance is identical to before the migration **And** all VS Code themes (light, dark, high contrast) render correctly

5. **Given** the desktop target will include `desktopThemeBridge.css`, **When** the grid would render in Electron, **Then** light theme and dark theme both render correctly (desktop target built in Epic 11, bridge file created now for readiness)

## Tasks / Subtasks

- [x] Task 1: Create IMessageBridge interface in core (AC: 3)
  - [x] 1.1: Create `packages/core/src/models/IMessageBridge.ts` with the interface per architecture doc:
    ```typescript
    interface IMessageBridge {
      sendCommand(command: string, payload: unknown): void;
      onEvent(event: string, handler: (payload: unknown) => void): void;
      offEvent(event: string, handler: (payload: unknown) => void): void;
    }
    ```
  - [x] 1.2: Export from `packages/core/src/index.ts`

- [x] Task 2: Create VSCodeMessageBridge (AC: 3, 4)
  - [x] 2.1: Create `packages/vscode/src/VSCodeMessageBridge.ts` (or `.js` if webview needs it as plain JS)
  - [x] 2.2: Implement IMessageBridge wrapping `acquireVsCodeApi()`:
    - `sendCommand` → `vscodeApi.postMessage({ command, payload })`
    - `onEvent` → `window.addEventListener('message', ...)` filtering by event name
    - `offEvent` → corresponding removeEventListener
  - [x] 2.3: Also wrap `vscode.getState()`/`vscode.setState()` for webview state persistence
  - [x] 2.4: NOTE: This file runs IN the webview (renderer context), not in the extension host

- [x] Task 3: Refactor main.js to use IMessageBridge (AC: 3)
  - [x] 3.1: Remove `const vscode = acquireVsCodeApi()` from main.js
  - [x] 3.2: Replace all `vscode.postMessage(...)` with `messageBridge.sendCommand(...)`
  - [x] 3.3: Replace all `vscode.getState()`/`vscode.setState()` with bridge methods
  - [x] 3.4: Create `initializeApp(messageBridge)` entry point per architecture doc
  - [x] 3.5: Remove hardcoded Server Manager extension link (`vscode:extension/...`)

- [x] Task 4: Refactor grid.js to use IMessageBridge (AC: 3)
  - [x] 4.1: Remove `const vscode = acquireVsCodeApi()` from grid.js
  - [x] 4.2: Replace all `vscode.postMessage(...)` with `messageBridge.sendCommand(...)`
  - [x] 4.3: Replace all `vscode.getState()`/`vscode.setState()` with bridge methods
  - [x] 4.4: Remove inline `--vscode-*` style references in JS template literals (lines 4881, 5130)

- [x] Task 5: Create theme.css abstract variable definitions (AC: 1, 2)
  - [x] 5.1: Create `packages/webview/src/theme.css` with all `--ite-*` variable definitions per architecture doc
  - [x] 5.2: Map all existing `--vscode-*` variables to `--ite-*` equivalents
  - [x] 5.3: Ensure complete coverage: every `--vscode-*` variable used in styles.css and grid-styles.css has an `--ite-*` mapping

- [x] Task 6: Migrate styles.css to --ite-* variables (AC: 2)
  - [x] 6.1: Replace ALL 89 `--vscode-*` references in `styles.css` with `--ite-*` equivalents
  - [x] 6.2: Verify zero `--vscode-*` references remain after migration
  - [x] 6.3: Map per architecture doc, e.g.:
    - `var(--vscode-editor-background)` → `var(--ite-bg)`
    - `var(--vscode-editor-foreground)` → `var(--ite-fg)`
    - `var(--vscode-input-background)` → `var(--ite-input-bg)`
    - etc.

- [x] Task 7: Migrate grid-styles.css to --ite-* variables (AC: 2)
  - [x] 7.1: Replace ALL 259 `--vscode-*` references in `grid-styles.css` with `--ite-*` equivalents
  - [x] 7.2: Verify zero `--vscode-*` references remain
  - [x] 7.3: Some may need NEW `--ite-*` variables not in the architecture doc — create them following the naming convention

- [x] Task 8: Create VS Code theme bridge CSS (AC: 4)
  - [x] 8.1: Create `packages/vscode/src/vscodeThemeBridge.css` mapping `--ite-theme-*` → `--vscode-*` per architecture doc
  - [x] 8.2: Must cover ALL `--ite-*` variables used by styles.css and grid-styles.css
  - [x] 8.3: This file is loaded by the VS Code webview to provide theme values

- [x] Task 9: Create desktop theme bridge CSS (AC: 5)
  - [x] 9.1: Create `packages/webview/src/desktopThemeBridge.css` (or in a location accessible by future desktop package) with hardcoded light/dark theme tokens per architecture doc
  - [x] 9.2: Light theme (default `:root`) and dark theme (`:root[data-theme="dark"]`)
  - [x] 9.3: Colors should closely match VS Code's default dark/light themes

- [x] Task 10: Update VS Code providers to inject bridge (AC: 4)
  - [x] 10.1: Update `TableEditorProvider.ts` and `GridPanelManager.ts` to inject VSCodeMessageBridge and vscodeThemeBridge.css into the webview HTML
  - [x] 10.2: The webview HTML should load: theme.css → vscodeThemeBridge.css → styles.css → grid-styles.css
  - [x] 10.3: The webview JS should: load VSCodeMessageBridge → initialize app with bridge instance

- [x] Task 11: Validate (AC: 1, 2, 3, 4)
  - [x] 11.1: Run `npm run compile` — all packages compile
  - [x] 11.2: Run `npm run lint` — no new lint errors
  - [x] 11.3: Run `npm run test` — all tests pass
  - [x] 11.4: Grep for `--vscode-` in packages/webview/src/ — zero results
  - [x] 11.5: Grep for `acquireVsCodeApi` in packages/webview/src/ — zero results

## Dev Notes

### Current State (After Story 10.2)

**Webview files in packages/webview/src/:**
- `main.js` — uses `acquireVsCodeApi()` on line 7, `vscode.postMessage()` on line 472, `vscode.getState()`/`setState()`
- `grid.js` — uses `acquireVsCodeApi()` on line 12, `vscode.postMessage()` on line 5472, `vscode.getState()`/`setState()`, plus 2 inline `--vscode-*` style references in JS template literals (lines 4881, 5130)
- `styles.css` — 89 `--vscode-*` references
- `grid-styles.css` — 259 `--vscode-*` references
- `webview.html` — shared HTML structure

**Total migration scope:**
- 350 `--vscode-*` CSS variable references across 3 files
- 2 JS files with `acquireVsCodeApi()` and `vscode.postMessage()` calls

### Architecture Requirements

**IMessageBridge** (from architecture.md):
```typescript
interface IMessageBridge {
  sendCommand(command: string, payload: unknown): void;
  onEvent(event: string, handler: (payload: unknown) => void): void;
  offEvent(event: string, handler: (payload: unknown) => void): void;
}
```

**Theme variable naming** (from architecture.md):
- `--ite-bg` → background
- `--ite-fg` → foreground
- `--ite-bg-secondary` → secondary background
- `--ite-border` → borders
- `--ite-accent` → accent/focus color
- etc. (full list in architecture.md "Theme Abstraction Layer" section)

**CSS load order in webview:**
1. `theme.css` (abstract `--ite-*` definitions)
2. `vscodeThemeBridge.css` or `desktopThemeBridge.css` (provides `--ite-theme-*` values)
3. `styles.css` (main styles using `--ite-*`)
4. `grid-styles.css` (grid styles using `--ite-*`)

### Critical Gotchas

1. **350 CSS variable replacements**: This is a large mechanical change. Create a consistent mapping table and apply systematically. Some `--vscode-*` variables may not have direct `--ite-*` equivalents in the architecture doc — create new ones following the naming convention.

2. **main.js and grid.js are separate IIFE scopes**: Both files create their own `vscode` const. Both need refactoring independently. They may share state via global variables or the DOM.

3. **vscode.getState()/setState()**: The IMessageBridge interface doesn't include state persistence methods. Either extend the bridge interface, or use a separate mechanism (localStorage for desktop, vscode.getState for VS Code).

4. **Inline styles in JS**: grid.js lines 4881 and 5130 use `--vscode-button-background` and `--vscode-button-foreground` inline in template literal HTML. These MUST also be migrated to `--ite-*` variables.

5. **Server Manager link**: main.js line 910 has `vscode:extension/intersystems-community.servermanager` — this is a VS Code-specific URI. For the shared webview, this link should be conditional or removed.

6. **High contrast themes**: VS Code has high contrast themes. The `vscodeThemeBridge.css` handles this automatically because it maps to `--vscode-*` variables. No special handling needed.

### Previous Story Intelligence (10.1, 10.2)

- Package scope: `@iris-te/*`
- Import pattern: `from '@iris-te/core'`
- Webview assets in `packages/webview/src/`
- VS Code providers reference webview assets via `node_modules/@iris-te/webview/src/`
- AtelierApiService reduced to thin HTTP transport; QueryExecutor/TableMetadataService handle business logic
- 241 tests passing

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#IMessageBridge Abstraction]
- [Source: _bmad-output/planning-artifacts/architecture.md#Theme Abstraction Layer]
- [Source: _bmad-output/planning-artifacts/architecture.md#CSS Variable Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#VS Code Theme Bridge]
- [Source: _bmad-output/planning-artifacts/architecture.md#Desktop Theme Bridge]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.3: Webview Extraction & Theme Abstraction]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
N/A

### Completion Notes List

1. **IMessageBridge extended with state methods**: The architecture doc's IMessageBridge didn't include `getState()`/`setState()`. Per story Dev Notes gotcha #3, extended the interface to include these methods for webview state persistence across both VS Code and desktop targets.

2. **VSCodeMessageBridge implemented as plain JS**: Created as `.js` (not `.ts`) since it runs in the webview renderer context where TypeScript is not compiled. Uses a `Map<string, Set<function>>` for efficient event handler management.

3. **Event listener backward compatibility**: Rather than refactoring all event handling logic in main.js and grid.js, wrapped `bridge.onEvent()` callbacks to produce the same `{data: {event, payload}}` structure that the existing `handleMessage()` functions expect. This minimizes risk while achieving full abstraction.

4. **Server Manager install link**: Replaced the VS Code-specific `vscode:extension/` URI with a `<button>` that sends an `installServerManager` command. The extension host handles this via `vscode.commands.executeCommand('workbench.extensions.installExtension', ...)`. This makes the webview target-agnostic.

5. **CSS migration scope**: 348 `--vscode-*` references migrated (89 in styles.css, 259 in grid-styles.css) plus 2 inline JS template literal references in grid.js. Three-layer CSS variable architecture: `--ite-*` (consumed) -> `--ite-theme-*` (intermediate) -> target bridge provides values.

6. **grid-styles.css required multiple sed passes**: Many references had fallback values in `var()` (e.g., `var(--vscode-X, rgba(...))`). Initial pass only caught exact `var(--vscode-X)` patterns. Additional passes with comma-delimited patterns caught all remaining references.

7. **High contrast theme handling**: VS Code high contrast themes work automatically because `vscodeThemeBridge.css` maps to `--vscode-*` variables, which VS Code always sets regardless of theme type. No special handling needed.

8. **All 241 existing tests pass**: No test modifications were needed. The refactoring preserved all existing behavior.

### File List

**New Files:**
- `packages/core/src/models/IMessageBridge.ts` — IMessageBridge interface with sendCommand, onEvent, offEvent, getState, setState
- `packages/vscode/src/VSCodeMessageBridge.js` — VS Code webview implementation of IMessageBridge wrapping acquireVsCodeApi()
- `packages/webview/src/theme.css` — Abstract --ite-* CSS variable definitions (~100+ variables)
- `packages/vscode/src/vscodeThemeBridge.css` — Maps --ite-theme-* to --vscode-* CSS variables for VS Code target
- `packages/webview/src/desktopThemeBridge.css` — Hardcoded light/dark theme tokens for desktop (Electron) target

**Modified Files:**
- `packages/core/src/index.ts` — Added IMessageBridge export
- `packages/webview/src/main.js` — Replaced acquireVsCodeApi with window.iteMessageBridge, migrated all vscode.postMessage/getState/setState to bridge methods, replaced window.addEventListener('message') with per-event bridge.onEvent(), replaced vscode:extension/ link with installServerManager command button
- `packages/webview/src/grid.js` — Same bridge migration as main.js, plus replaced 2 inline --vscode-* style references in JS template literals with --ite-* equivalents
- `packages/webview/src/styles.css` — All 89 --vscode-* references replaced with --ite-* equivalents
- `packages/webview/src/grid-styles.css` — All 259 --vscode-* references replaced with --ite-* equivalents
- `packages/vscode/src/providers/TableEditorProvider.ts` — Added localResourceRoots for src/, added theme.css and vscodeThemeBridge.css to CSS load chain, added VSCodeMessageBridge.js script injection, added bridge initialization, added installServerManager command handler
- `packages/vscode/src/providers/GridPanelManager.ts` — Same provider updates as TableEditorProvider (theme CSS, bridge script, initialization)
