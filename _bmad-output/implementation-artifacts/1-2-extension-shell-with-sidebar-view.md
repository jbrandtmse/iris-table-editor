# Story 1.2: Extension Shell with Sidebar View

Status: done

## Story

As a **user**,
I want **to see IRIS Table Editor in the VS Code sidebar**,
So that **I have a dedicated place to access table editing features**.

## Acceptance Criteria

1. **Given** the extension is installed and activated
   **When** I open VS Code
   **Then** I see "IRIS Table Editor" in the sidebar activity bar (left icon bar)
   **And** clicking it reveals the IRIS Table Editor panel

2. **Given** VS Code is open
   **When** I open the command palette and type "IRIS Table Editor"
   **Then** I see the command "IRIS Table Editor: Open Table Editor"
   **And** executing it opens/focuses the sidebar panel

## Tasks / Subtasks

- [x] Task 1: Configure Activity Bar Container in package.json (AC: #1)
  - [x] Add `viewsContainers.activitybar` entry with id `iris-table-editor`
  - [x] Configure icon path to `resources/icon.svg` (create SVG icon)
  - [x] Set title to "IRIS Table Editor"

- [x] Task 2: Configure Sidebar View in package.json (AC: #1)
  - [x] Add `views.iris-table-editor` with webview view entry
  - [x] Set view id to `iris-table-editor.mainView`
  - [x] Set view name to "IRIS Table Editor"
  - [x] Set view type to `webview`

- [x] Task 3: Create TableEditorProvider Class (AC: #1)
  - [x] Create `src/providers/TableEditorProvider.ts`
  - [x] Implement `vscode.WebviewViewProvider` interface
  - [x] Implement `resolveWebviewView()` method
  - [x] Configure webview options: `enableScripts: true`, `localResourceRoots`
  - [x] Set initial HTML content with placeholder message

- [x] Task 4: Register Provider in extension.ts (AC: #1)
  - [x] Import `TableEditorProvider` class
  - [x] Call `vscode.window.registerWebviewViewProvider()` with view id
  - [x] Add to `context.subscriptions` for proper cleanup

- [x] Task 5: Add Command to Focus Sidebar (AC: #2)
  - [x] Add command `iris-table-editor.openTableEditor` to package.json contributes.commands
  - [x] Set command title to "IRIS Table Editor: Open Table Editor"
  - [x] Register command in extension.ts to reveal/focus the sidebar view
  - [x] Remove or replace placeholder "helloWorld" command

- [x] Task 6: Create Placeholder Webview Content (AC: #1)
  - [x] Create `media/webview.html` with basic structure
  - [x] Add CSP meta tag with nonce placeholder
  - [x] Create `media/styles.css` with VS Code theme variables
  - [x] Create `media/main.js` with placeholder AppState class
  - [x] Wire up HTML to reference CSS and JS files

- [x] Task 7: Verify Build and Test (AC: #1, #2)
  - [x] Run `npm run compile` - must exit with code 0
  - [ ] Press F5 to launch Extension Development Host (manual verification required)
  - [ ] Verify activity bar icon appears (manual verification required)
  - [ ] Click icon and verify panel opens (manual verification required)
  - [ ] Open command palette, run "IRIS Table Editor: Open Table Editor" (manual verification required)
  - [ ] Verify panel focuses when command executed (manual verification required)

## Dev Notes

### Architecture Compliance

This story implements the foundation for the sidebar navigation panel. Per architecture.md:
- WebviewViewProvider goes in `src/providers/`
- Webview assets go in `media/`
- Use `[IRIS-TE]` LOG_PREFIX for all console output
- Use BEM CSS naming with `ite-` prefix

### package.json Additions

Add to `contributes` section:

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "iris-table-editor",
          "title": "IRIS Table Editor",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "iris-table-editor": [
        {
          "type": "webview",
          "id": "iris-table-editor.mainView",
          "name": "IRIS Table Editor"
        }
      ]
    },
    "commands": [
      {
        "command": "iris-table-editor.openTableEditor",
        "title": "IRIS Table Editor: Open Table Editor"
      }
    ]
  }
}
```

Remove the placeholder "helloWorld" command from package.json.

### Icon Creation

Create `resources/icon.svg` - a simple table/grid icon. Use monochrome design that works with VS Code's icon theming. Example:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" fill="none" stroke-width="1.5"/>
  <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5"/>
  <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" stroke-width="1.5"/>
  <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" stroke-width="1.5"/>
  <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" stroke-width="1.5"/>
</svg>
```

### TableEditorProvider Implementation

```typescript
// src/providers/TableEditorProvider.ts
import * as vscode from 'vscode';

const LOG_PREFIX = '[IRIS-TE]';

export class TableEditorProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'iris-table-editor.mainView';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        console.debug(`${LOG_PREFIX} Resolving webview view`);

        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    public revealView(): void {
        if (this._view) {
            this._view.show(true);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>IRIS Table Editor</title>
</head>
<body>
    <div class="ite-container">
        <div class="ite-placeholder">
            <h2>IRIS Table Editor</h2>
            <p>Server connection coming in Story 1.3</p>
        </div>
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
```

### Extension Registration

Update `src/extension.ts`:

```typescript
import * as vscode from 'vscode';
import { TableEditorProvider } from './providers/TableEditorProvider';

const LOG_PREFIX = '[IRIS-TE]';

export function activate(context: vscode.ExtensionContext) {
    console.debug(`${LOG_PREFIX} Extension activating`);

    // Register the webview view provider
    const provider = new TableEditorProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            TableEditorProvider.viewType,
            provider
        )
    );

    // Register command to open/focus the panel
    context.subscriptions.push(
        vscode.commands.registerCommand('iris-table-editor.openTableEditor', () => {
            console.debug(`${LOG_PREFIX} Open Table Editor command executed`);
            // Reveal the sidebar view
            vscode.commands.executeCommand('workbench.view.extension.iris-table-editor');
        })
    );

    console.debug(`${LOG_PREFIX} Extension activated`);
}

export function deactivate() {
    console.debug(`${LOG_PREFIX} Extension deactivated`);
}
```

### Webview Files

**media/styles.css:**
```css
/* IRIS Table Editor - BEM naming with ite- prefix */

body {
    padding: 0;
    margin: 0;
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
}

.ite-container {
    padding: 8px;
    height: 100%;
    box-sizing: border-box;
}

.ite-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--vscode-descriptionForeground);
}

.ite-placeholder h2 {
    margin: 0 0 8px 0;
    font-size: 1.2em;
    font-weight: 600;
    color: var(--vscode-foreground);
}

.ite-placeholder p {
    margin: 0;
    font-size: 0.9em;
}
```

**media/main.js:**
```javascript
// IRIS Table Editor - Webview main script
// This file will be expanded in later stories

(function() {
    const LOG_PREFIX = '[IRIS-TE Webview]';

    // Placeholder AppState class - will be expanded in Epic 2
    class AppState {
        constructor() {
            this._state = {
                server: null,
                namespace: null,
                tables: [],
                selectedTable: null,
                isLoading: false,
                error: null
            };
            this._listeners = [];
        }

        get state() {
            return this._state;
        }

        update(changes) {
            this._state = { ...this._state, ...changes };
            this._notifyListeners();
        }

        subscribe(listener) {
            this._listeners.push(listener);
            return () => {
                this._listeners = this._listeners.filter(l => l !== listener);
            };
        }

        _notifyListeners() {
            this._listeners.forEach(listener => listener(this._state));
        }
    }

    // Initialize
    const appState = new AppState();
    console.debug(`${LOG_PREFIX} Webview initialized`);

    // VS Code API for message passing (will be used in later stories)
    // const vscode = acquireVsCodeApi();
})();
```

### File Naming Conventions (from Story 1.1)

| File Type | Convention | Example |
|-----------|------------|---------|
| Class files | PascalCase | `TableEditorProvider.ts` |
| Utility modules | camelCase | `sqlBuilder.ts` |
| Interface files | PascalCase with `I` prefix | `IServerSpec.ts` |
| Webview files | lowercase | `main.js`, `styles.css` |

### What NOT to Do

- Do NOT install `@intersystems-community/intersystems-servermanager` npm package (Story 1.3)
- Do NOT implement Server Manager integration (Story 1.3)
- Do NOT implement server list or namespace browsing (Stories 1.3-1.6)
- Do NOT use `vscode.window.createWebviewPanel()` - use WebviewViewProvider for sidebar
- Do NOT hardcode colors - always use VS Code CSS variables

### Previous Story Learnings (from 1.1)

1. **ESLint uses modern flat config format** (`eslint.config.mjs`), not legacy `.eslintrc.json`
2. **Use .gitkeep files** for empty directories that need to be tracked
3. **Yeoman generator** may not create all expected files - be prepared to manually create configuration
4. **LOG_PREFIX pattern**: All console output must use `[IRIS-TE]` prefix
5. **Build verification**: Always run `npm run compile` and `npm run lint` before marking complete

### Success Verification Checklist

- [ ] Activity bar shows IRIS Table Editor icon when extension is active
- [ ] Clicking icon opens sidebar panel with placeholder content
- [ ] Command palette shows "IRIS Table Editor: Open Table Editor" command
- [ ] Executing command opens/focuses the sidebar panel
- [ ] `npm run compile` exits with code 0
- [ ] `npm run lint` passes with no errors
- [ ] Webview displays correctly in both light and dark themes
- [ ] Console shows `[IRIS-TE]` prefixed messages during activation

### References

- [Source: architecture.md#Project Structure & Boundaries]
- [Source: architecture.md#Implementation Patterns & Consistency Rules]
- [Source: architecture.md#Extension-Webview Communication]
- [Source: ux-design-specification.md#Platform Strategy]
- [Source: ux-design-specification.md#Design System Foundation]
- [Source: epics.md#Story 1.2: Extension Shell with Sidebar View]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build output: `npm run compile` completed successfully with no errors
- Lint output: `npm run lint` completed successfully with no errors

### Completion Notes List

1. **Task 1 & 2 (package.json configuration)**: Added viewsContainers.activitybar and views configuration. Replaced placeholder "helloWorld" command with "openTableEditor" command.

2. **Task 3 (TableEditorProvider)**: Created WebviewViewProvider implementation following architecture guidelines:
   - Uses `[IRIS-TE]` LOG_PREFIX for console output
   - Implements CSP with nonce for security
   - Uses VS Code theme variables for styling
   - Sets localResourceRoots to media folder

3. **Task 4 (Provider Registration)**: Updated extension.ts to register TableEditorProvider with proper subscription cleanup.

4. **Task 5 (Command Registration)**: Added openTableEditor command that reveals the sidebar view using `workbench.view.extension.iris-table-editor`.

5. **Task 6 (Webview Content)**: Created placeholder webview files:
   - media/styles.css with BEM naming (ite- prefix) and VS Code CSS variables
   - media/main.js with placeholder AppState class
   - media/webview.html as reference template

6. **Task 7 (Build Verification)**: Both `npm run compile` and `npm run lint` pass without errors. Unit tests added for TableEditorProvider.

### Implementation Notes

- All code follows the established LOG_PREFIX pattern `[IRIS-TE]`
- BEM CSS naming with `ite-` prefix used consistently
- CSP implemented with nonce for script security
- No hardcoded colors - all styling uses VS Code CSS variables
- Tests added to validate provider viewType and instantiation

### Change Log

- 2026-01-27: Implemented Story 1.2 - Extension Shell with Sidebar View
- 2026-01-27: Code review fixes applied (see Senior Developer Review below)

### File List

**New Files:**
- resources/icon.svg
- src/providers/TableEditorProvider.ts
- media/styles.css
- media/main.js
- media/webview.html

**Modified Files:**
- package.json (added viewsContainers, views, updated commands, added compile-tests script)
- src/extension.ts (added provider registration and command, uses revealView())
- src/test/extension.test.ts (added tests for TableEditorProvider, fixed activation-dependent test)
- src/providers/TableEditorProvider.ts (fixed unused parameter naming)
- media/webview.html (added documentation comment)
- resources/icon.svg (removed misleading fill attribute)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-27
**Outcome:** APPROVED (after fixes)

### Issues Found and Fixed

| ID | Severity | Issue | Resolution |
|----|----------|-------|------------|
| 1 | CRITICAL | Tests not running - build config missing compile-tests step | Added `compile-tests` script to package.json, tests now compile to `out/` and run correctly (4 passing) |
| 2 | MEDIUM | `revealView()` method never called | Wired up command handler to use `provider.revealView()` after revealing sidebar container |
| 3 | MEDIUM | Unused `context` parameter in `resolveWebviewView` | Renamed to `_context` following TypeScript convention |
| 4 | MEDIUM | `media/webview.html` has unresolved placeholders | Added documentation comment explaining it's a reference template |
| 5 | MEDIUM | SVG has misleading `fill="currentColor"` on root | Removed unused fill attribute |
| 6 | LOW | Tests improved | Removed noisy `showInformationMessage`, fixed activation-dependent command test |

### LOW Issues Not Fixed (Deferred)

| ID | Issue | Reason |
|----|-------|--------|
| 6 | AppState missing architecture properties | Placeholder - will be expanded in Epic 2 |
| 9 | CSS height may not work in webview | Will be verified in manual testing |
| 10 | VS Code API not acquired | Will be implemented when message passing is needed (Story 1.3+) |

### Verification

- `npm run compile` ✅ passes
- `npm run lint` ✅ passes
- `npm run test` ✅ 4 tests passing
- All CRITICAL and MEDIUM issues resolved

