# Story 1.3: Server Manager Integration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to see a list of my configured IRIS servers**,
So that **I can choose which server to work with**.

## Acceptance Criteria

1. **Given** the IRIS Table Editor panel is open
   **And** InterSystems Server Manager extension is installed with configured servers
   **When** the panel loads
   **Then** I see a dropdown or list showing all configured server names

2. **Given** Server Manager extension is NOT installed
   **When** the panel loads
   **Then** I see a friendly message: "InterSystems Server Manager extension required"
   **And** I see a button/link to install Server Manager

3. **Given** Server Manager is installed but no servers are configured
   **When** the panel loads
   **Then** I see a message: "No servers configured. Add a server in InterSystems Server Manager."

## Tasks / Subtasks

- [x] Task 1: Install Dependencies (AC: #1)
  - [x] Run `npm install @intersystems-community/intersystems-servermanager`
  - [x] Run `npm install @vscode/codicons` for VS Code icon font
  - [x] Verify package.json shows new dependencies
  - [x] Verify `npm run compile` succeeds with new dependencies

- [x] Task 2: Create ServerConnectionManager Class (AC: #1, #2, #3)
  - [x] Create `src/providers/ServerConnectionManager.ts`
  - [x] Import types from `@intersystems-community/intersystems-servermanager`
  - [x] Implement `isServerManagerInstalled()` method to check extension availability
  - [x] Implement `getServerList()` method using `getServerNames()` API
  - [x] Implement `getServerSpec(serverName: string)` method for server details
  - [x] Follow naming patterns: PascalCase file, get/is prefixes for methods
  - [x] Use LOG_PREFIX `[IRIS-TE]` for all console output

- [x] Task 3: Create Models for Server Data (AC: #1)
  - [x] Create `src/models/IServerSpec.ts` interface matching Server Manager API
  - [x] Create `src/models/IMessages.ts` with Command/Event type definitions
  - [x] Follow interface naming: `I` prefix (e.g., `IServerSpec`, `ICommand`, `IEvent`)

- [x] Task 4: Update TableEditorProvider for Server List (AC: #1, #2, #3)
  - [x] Add `_serverConnectionManager` property to TableEditorProvider
  - [x] Add `_disposables` array for cleanup tracking
  - [x] Inject ServerConnectionManager in constructor or lazy-init
  - [x] Update `resolveWebviewView()` to send initial server list to webview
  - [x] Implement message handling for `getServerList` command from webview
  - [x] Implement message handling for `openServerManager` command
  - [x] Implement `postMessage()` helper for sending events to webview
  - [x] Add message listener to disposables for proper cleanup

- [x] Task 5: Update Webview HTML for Server List (AC: #1, #2, #3)
  - [x] Remove placeholder content from `_getHtmlForWebview()`
  - [x] Add Codicon CSS reference for VS Code icons
  - [x] Add ARIA live region for screen reader announcements
  - [x] Add server list container: `.ite-server-list`
  - [x] Add loading state: `.ite-loading`
  - [x] Add error state container: `.ite-error`
  - [x] Add "Install Server Manager" button with VS Code marketplace link
  - [x] Add "No servers configured" message state

- [x] Task 6: Update Webview JavaScript (AC: #1, #2, #3)
  - [x] Acquire VS Code API: `const vscode = acquireVsCodeApi();`
  - [x] Implement `postCommand()` helper to send commands to extension
  - [x] Add message listener for events from extension
  - [x] Update AppState with server-related properties
  - [x] Implement render functions for each state (loading, servers, no servers, error)
  - [x] Add click event handler for server list item selection
  - [x] Add keyboard event handler (Enter/Space to select, Arrow keys to navigate)
  - [x] Add ARIA live region for screen reader announcements
  - [x] Escape HTML in error messages to prevent XSS
  - [x] Implement state persistence with `vscode.setState()`/`vscode.getState()`
  - [x] Send `getServerList` command on webview initialization

- [x] Task 7: Update Webview CSS (AC: #1, #2, #3)
  - [x] Add `.ite-server-list` styles with VS Code theme variables
  - [x] Add `.ite-server-list__item` for individual server entries
  - [x] Add `.ite-server-list__item--selected` for selection state
  - [x] Add `.ite-server-list__header` with refresh button styling
  - [x] Add `.ite-loading` styles with loading animation
  - [x] Add `.ite-error` styles for error message display
  - [x] Add `.ite-button` styles for action buttons
  - [x] Add `.visually-hidden` utility for screen reader only content
  - [x] Use BEM naming with `ite-` prefix per architecture
  - [x] Include Codicon font reference for VS Code icons

- [x] Task 8: Verify Build and Test (AC: #1, #2, #3)
  - [x] Run `npm run compile` - must exit with code 0
  - [x] Run `npm run lint` - must pass with no errors
  - [x] Add unit tests for ServerConnectionManager
  - [x] Run `npm run test` - all tests must pass

## Dev Notes

### Architecture Compliance

This story implements server discovery per architecture.md specifications:

**File Locations:**
- `src/providers/ServerConnectionManager.ts` - Server Manager API integration
- `src/models/IServerSpec.ts` - Server specification interface
- `src/models/IMessages.ts` - Command/Event type definitions

**Naming Conventions:**
| Type | Convention | Example |
|------|------------|---------|
| Class files | PascalCase | `ServerConnectionManager.ts` |
| Interfaces | PascalCase with `I` prefix | `IServerSpec.ts` |
| Methods | Verb prefixes | `getServerList()`, `isServerManagerInstalled()` |
| CSS classes | BEM with `ite-` prefix | `.ite-server-list__item` |

### Server Manager API

The `@intersystems-community/intersystems-servermanager` package provides:

```typescript
import { getServerNames, getServerSpec, ServerSpec } from '@intersystems-community/intersystems-servermanager';

// Get all configured server names
const servers: string[] = getServerNames(); // ['dev-server', 'prod-server']

// Get server specification
const spec: ServerSpec = getServerSpec('dev-server');
// {
//   host: 'localhost',
//   port: 52773,
//   pathPrefix: '/api/atelier/',
//   username: 'admin',
//   // Note: password is NOT included - must use authentication API
// }
```

**CRITICAL: Credentials are obtained via VS Code authentication API, NOT from ServerSpec:**

```typescript
// Get credentials via VS Code authentication provider
const session = await vscode.authentication.getSession(
  'intersystems-server-credentials', // Server Manager's auth provider ID
  [serverName],
  { createIfNone: true }
);

// session.accessToken contains the base64-encoded credentials
const password = session.accessToken;
```

### Command/Event Message Pattern

Per architecture.md, all webview-extension communication uses typed messages:

```typescript
// Commands (webview → extension)
interface ICommand<T = unknown> {
  command: string;
  payload: T;
}

// Events (extension → webview)
interface IEvent<T = unknown> {
  event: string;
  payload: T;
}

// Specific payloads for this story
interface IServerListPayload {
  servers: string[];
}

interface IErrorPayload {
  message: string;
  code: string;
  recoverable: boolean;
  context: string;
}

// Commands this story implements
type ServerCommands =
  | { command: 'getServerList'; payload: {} }
  | { command: 'selectServer'; payload: { serverName: string } }

// Events this story implements
type ServerEvents =
  | { event: 'serverList'; payload: IServerListPayload }
  | { event: 'serverManagerNotInstalled'; payload: {} }
  | { event: 'noServersConfigured'; payload: {} }
  | { event: 'error'; payload: IErrorPayload }
```

### ServerConnectionManager Implementation

```typescript
// src/providers/ServerConnectionManager.ts
import * as vscode from 'vscode';

const LOG_PREFIX = '[IRIS-TE]';

// Import types - actual implementation uses dynamic import to handle missing extension
interface IServerSpec {
  name: string;
  host: string;
  port: number;
  pathPrefix: string;
  username?: string;
}

export class ServerConnectionManager {
  private _serverManagerApi: typeof import('@intersystems-community/intersystems-servermanager') | undefined;

  constructor() {}

  /**
   * Check if Server Manager extension is installed and active
   */
  public isServerManagerInstalled(): boolean {
    const extension = vscode.extensions.getExtension('intersystems-community.servermanager');
    return extension !== undefined;
  }

  /**
   * Get list of configured server names
   * @returns Array of server names or empty array if none configured
   */
  public async getServerList(): Promise<string[]> {
    if (!this.isServerManagerInstalled()) {
      console.debug(`${LOG_PREFIX} Server Manager not installed`);
      return [];
    }

    try {
      const api = await this._getServerManagerApi();
      if (!api) {
        return [];
      }
      const servers = api.getServerNames();
      console.debug(`${LOG_PREFIX} Found ${servers.length} configured servers`);
      return servers;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error getting server list:`, error);
      return [];
    }
  }

  /**
   * Get server specification by name
   */
  public async getServerSpec(serverName: string): Promise<IServerSpec | undefined> {
    if (!this.isServerManagerInstalled()) {
      return undefined;
    }

    try {
      const api = await this._getServerManagerApi();
      if (!api) {
        return undefined;
      }
      const spec = api.getServerSpec(serverName);
      if (!spec) {
        console.debug(`${LOG_PREFIX} Server '${serverName}' not found`);
        return undefined;
      }
      return {
        name: serverName,
        host: spec.host || 'localhost',
        port: spec.port || 52773,
        pathPrefix: spec.pathPrefix || '/api/atelier/',
        username: spec.username
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} Error getting server spec:`, error);
      return undefined;
    }
  }

  /**
   * Lazy-load the Server Manager API
   */
  private async _getServerManagerApi(): Promise<typeof import('@intersystems-community/intersystems-servermanager') | undefined> {
    if (this._serverManagerApi) {
      return this._serverManagerApi;
    }

    try {
      // Dynamic import to handle case where package isn't available
      this._serverManagerApi = await import('@intersystems-community/intersystems-servermanager');
      return this._serverManagerApi;
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to load Server Manager API:`, error);
      return undefined;
    }
  }
}
```

### Webview Message Handling

Update TableEditorProvider to handle messages:

```typescript
// In TableEditorProvider class

private _serverConnectionManager: ServerConnectionManager;
private _disposables: vscode.Disposable[] = [];

constructor(private readonly _extensionUri: vscode.Uri) {
  this._serverConnectionManager = new ServerConnectionManager();
}

public resolveWebviewView(
  webviewView: vscode.WebviewView,
  _context: vscode.WebviewViewResolveContext,
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

  // Handle messages from webview - ADD TO DISPOSABLES FOR CLEANUP
  this._disposables.push(
    webviewView.webview.onDidReceiveMessage(
      message => this._handleMessage(message)
    )
  );

  // Clean up disposables when view is disposed
  webviewView.onDidDispose(() => {
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  });

  // Send initial server list
  this._sendServerList();
}

private async _handleMessage(message: ICommand): Promise<void> {
  console.debug(`${LOG_PREFIX} Received command: ${message.command}`);

  switch (message.command) {
    case 'getServerList':
      await this._sendServerList();
      break;
    case 'openServerManager':
      // Open Server Manager extension view
      await vscode.commands.executeCommand('workbench.view.extension.intersystems-community-servermanager');
      break;
    // selectServer will be implemented in Story 1.4
  }
}

private async _sendServerList(): Promise<void> {
  if (!this._serverConnectionManager.isServerManagerInstalled()) {
    this._postMessage({ event: 'serverManagerNotInstalled', payload: {} });
    return;
  }

  const servers = await this._serverConnectionManager.getServerList();

  if (servers.length === 0) {
    this._postMessage({ event: 'noServersConfigured', payload: {} });
    return;
  }

  this._postMessage({ event: 'serverList', payload: { servers } });
}

private _postMessage(event: IEvent): void {
  if (this._view) {
    this._view.webview.postMessage(event);
  }
}
```

### Webview JavaScript Update

```javascript
// media/main.js

(function() {
    const LOG_PREFIX = '[IRIS-TE Webview]';

    // Acquire VS Code API
    const vscode = acquireVsCodeApi();

    // Restore previous state if available
    const previousState = vscode.getState() || {};

    // HTML escaping to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Screen reader announcements via ARIA live region
    function announce(message) {
        const liveRegion = document.getElementById('ite-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }

    // Application state
    class AppState {
        constructor(initialState = {}) {
            this._state = {
                servers: [],
                selectedServer: initialState.selectedServer || null,
                isLoading: true,
                loadingContext: 'loadingServers',
                error: null,
                serverManagerInstalled: true,
                serversConfigured: true
            };
            this._listeners = [];
        }

        get state() {
            return this._state;
        }

        update(changes) {
            this._state = { ...this._state, ...changes };
            // Persist state for webview restoration
            vscode.setState({ selectedServer: this._state.selectedServer });
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

    const appState = new AppState(previousState);

    // Message handlers
    function handleMessage(event) {
        const message = event.data;
        console.debug(`${LOG_PREFIX} Received event: ${message.event}`);

        switch (message.event) {
            case 'serverList':
                appState.update({
                    servers: message.payload.servers,
                    isLoading: false,
                    serverManagerInstalled: true,
                    serversConfigured: true
                });
                announce(`${message.payload.servers.length} servers available`);
                break;

            case 'serverManagerNotInstalled':
                appState.update({
                    isLoading: false,
                    serverManagerInstalled: false
                });
                announce('Server Manager extension required');
                break;

            case 'noServersConfigured':
                appState.update({
                    isLoading: false,
                    serverManagerInstalled: true,
                    serversConfigured: false,
                    servers: []
                });
                announce('No servers configured');
                break;

            case 'error':
                appState.update({
                    isLoading: false,
                    error: message.payload
                });
                announce(`Error: ${message.payload.message}`);
                break;
        }
    }

    // Post command to extension
    function postCommand(command, payload = {}) {
        vscode.postMessage({ command, payload });
    }

    // Server selection handler
    function selectServer(serverName) {
        appState.update({ selectedServer: serverName });
        postCommand('selectServer', { serverName });
        announce(`Selected server: ${serverName}`);
    }

    // Render functions
    function render(state) {
        const container = document.querySelector('.ite-container');

        if (state.isLoading) {
            container.innerHTML = renderLoading(state.loadingContext);
            announce('Loading servers');
            return;
        }

        if (!state.serverManagerInstalled) {
            container.innerHTML = renderServerManagerNotInstalled();
            return;
        }

        if (!state.serversConfigured || state.servers.length === 0) {
            container.innerHTML = renderNoServers();
            return;
        }

        if (state.error) {
            container.innerHTML = renderError(state.error);
            return;
        }

        container.innerHTML = renderServerList(state.servers, state.selectedServer);
        attachServerListEvents();
    }

    function renderLoading(_context) {
        return `
            <div class="ite-loading">
                <div class="ite-loading__spinner"></div>
                <p class="ite-loading__text">Loading servers...</p>
            </div>
        `;
    }

    function renderServerManagerNotInstalled() {
        return `
            <div class="ite-message ite-message--warning">
                <h3 class="ite-message__title">InterSystems Server Manager Required</h3>
                <p class="ite-message__text">Install the Server Manager extension to connect to IRIS servers.</p>
                <a href="vscode:extension/intersystems-community.servermanager"
                   class="ite-button ite-button--primary">
                    Install Server Manager
                </a>
            </div>
        `;
    }

    function renderNoServers() {
        return `
            <div class="ite-message">
                <h3 class="ite-message__title">No Servers Configured</h3>
                <p class="ite-message__text">Add a server in InterSystems Server Manager to get started.</p>
                <button class="ite-button ite-button--secondary" onclick="openServerManager()">
                    Open Server Manager
                </button>
            </div>
        `;
    }

    function renderError(error) {
        // SECURITY: Escape error message to prevent XSS
        const safeMessage = escapeHtml(error.message);
        return `
            <div class="ite-message ite-message--error">
                <h3 class="ite-message__title">Error</h3>
                <p class="ite-message__text">${safeMessage}</p>
                <button class="ite-button ite-button--secondary" onclick="refreshServers()">
                    Retry
                </button>
            </div>
        `;
    }

    function renderServerList(servers, selectedServer) {
        const serverItems = servers.map((server, index) => {
            const isSelected = server === selectedServer;
            const selectedClass = isSelected ? 'ite-server-list__item--selected' : '';
            // Escape server name for safety
            const safeName = escapeHtml(server);
            return `
                <div class="ite-server-list__item ${selectedClass}"
                     data-server="${safeName}"
                     data-index="${index}"
                     tabindex="0"
                     role="option"
                     aria-selected="${isSelected}">
                    <span class="ite-server-list__icon codicon codicon-server"></span>
                    <span class="ite-server-list__name">${safeName}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="ite-server-list__header-row">
                <h3 class="ite-server-list__header">Servers</h3>
                <button class="ite-button ite-button--icon" onclick="refreshServers()"
                        title="Refresh server list" aria-label="Refresh server list">
                    <span class="codicon codicon-refresh"></span>
                </button>
            </div>
            <div class="ite-server-list" role="listbox" aria-label="Available servers">
                ${serverItems}
            </div>
        `;
    }

    // Attach event listeners for server list (called after render)
    function attachServerListEvents() {
        const serverList = document.querySelector('.ite-server-list');
        if (!serverList) return;

        // Click handler for server selection
        serverList.addEventListener('click', (e) => {
            const item = e.target.closest('.ite-server-list__item');
            if (item) {
                const serverName = item.dataset.server;
                selectServer(serverName);
            }
        });

        // Keyboard navigation
        serverList.addEventListener('keydown', (e) => {
            const item = e.target.closest('.ite-server-list__item');
            if (!item) return;

            const items = Array.from(serverList.querySelectorAll('.ite-server-list__item'));
            const currentIndex = parseInt(item.dataset.index, 10);

            switch (e.key) {
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    selectServer(item.dataset.server);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (currentIndex < items.length - 1) {
                        items[currentIndex + 1].focus();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (currentIndex > 0) {
                        items[currentIndex - 1].focus();
                    }
                    break;
                case 'Home':
                    e.preventDefault();
                    items[0]?.focus();
                    break;
                case 'End':
                    e.preventDefault();
                    items[items.length - 1]?.focus();
                    break;
            }
        });

        // Focus first item or selected item after render
        const selectedItem = serverList.querySelector('.ite-server-list__item--selected');
        const firstItem = serverList.querySelector('.ite-server-list__item');
        (selectedItem || firstItem)?.focus();
    }

    // Global functions for onclick handlers
    window.openServerManager = function() {
        postCommand('openServerManager');
    };

    window.refreshServers = function() {
        appState.update({ isLoading: true, loadingContext: 'loadingServers', error: null });
        postCommand('getServerList');
    };

    // Initialize
    window.addEventListener('message', handleMessage);
    appState.subscribe(render);

    // Request server list on load
    console.debug(`${LOG_PREFIX} Webview initialized, requesting server list`);
    postCommand('getServerList');
})();
```

### Webview CSS Update

```css
/* media/styles.css */

/* IRIS Table Editor - BEM naming with ite- prefix */

/* Import VS Code Codicons for consistent iconography */
@import url('vscode-codicons/dist/codicon.css');

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

/* Visually hidden utility for screen readers */
.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* Loading State */
.ite-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
}

.ite-loading__spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--vscode-progressBar-background);
    border-top-color: transparent;
    border-radius: 50%;
    animation: ite-spin 1s linear infinite;
}

@keyframes ite-spin {
    to {
        transform: rotate(360deg);
    }
}

.ite-loading__text {
    margin-top: 8px;
    color: var(--vscode-descriptionForeground);
}

/* Message States */
.ite-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 16px;
}

.ite-message__title {
    margin: 0 0 8px 0;
    font-size: 1.1em;
    font-weight: 600;
    color: var(--vscode-foreground);
}

.ite-message__text {
    margin: 0 0 16px 0;
    color: var(--vscode-descriptionForeground);
    line-height: 1.4;
}

.ite-message--warning .ite-message__title {
    color: var(--vscode-editorWarning-foreground);
}

.ite-message--error .ite-message__title {
    color: var(--vscode-errorForeground);
}

/* Buttons */
.ite-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    border: none;
    border-radius: 2px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    cursor: pointer;
    text-decoration: none;
    text-align: center;
}

.ite-button--primary {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}

.ite-button--primary:hover {
    background-color: var(--vscode-button-hoverBackground);
}

.ite-button--secondary {
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}

.ite-button--secondary:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
}

.ite-button--icon {
    padding: 4px;
    background: transparent;
    color: var(--vscode-foreground);
    opacity: 0.7;
}

.ite-button--icon:hover {
    opacity: 1;
    background-color: var(--vscode-toolbar-hoverBackground);
}

.ite-button--icon:focus {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
}

/* Server List */
.ite-server-list__header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding: 0 4px;
}

.ite-server-list__header {
    margin: 0;
    font-size: 0.85em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--vscode-sideBarSectionHeader-foreground);
    letter-spacing: 0.05em;
}

.ite-server-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.ite-server-list__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.1s ease;
}

.ite-server-list__item:hover {
    background-color: var(--vscode-list-hoverBackground);
}

.ite-server-list__item:focus {
    outline: none;
    background-color: var(--vscode-list-focusBackground);
    box-shadow: inset 0 0 0 1px var(--vscode-focusBorder);
}

.ite-server-list__item:focus-visible {
    box-shadow: inset 0 0 0 2px var(--vscode-focusBorder);
}

.ite-server-list__item--selected {
    background-color: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}

.ite-server-list__item--selected:focus {
    background-color: var(--vscode-list-activeSelectionBackground);
}

.ite-server-list__icon {
    font-size: 16px;
    opacity: 0.8;
    flex-shrink: 0;
}

.ite-server-list__name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
    .ite-loading__spinner {
        animation: none;
        border-color: var(--vscode-progressBar-background);
    }

    .ite-server-list__item {
        transition: none;
    }
}
```

### Project Structure Notes

After this story, the project structure will be:

```
src/
├── extension.ts                    # Entry point
├── providers/
│   ├── TableEditorProvider.ts      # WebviewViewProvider (updated)
│   └── ServerConnectionManager.ts  # NEW: Server Manager integration
├── models/
│   ├── IServerSpec.ts              # NEW: Server specification interface
│   └── IMessages.ts                # NEW: Command/Event types
└── test/
    └── extension.test.ts           # Existing tests
media/
├── webview.html                    # Reference template
├── styles.css                      # Updated with server list styles
└── main.js                         # Updated with server list logic
```

### What NOT to Do

- Do NOT implement server authentication/connection (Story 1.4)
- Do NOT implement namespace browsing (Story 1.5)
- Do NOT implement table browsing (Story 1.6)
- Do NOT store passwords or credentials in any state
- Do NOT log sensitive data (usernames, passwords, tokens)
- Do NOT hardcode any colors - always use VS Code CSS variables
- Do NOT skip the `isServerManagerInstalled()` check before using API

### Previous Story Learnings (from 1.1 & 1.2)

1. **ESLint uses modern flat config format** (`eslint.config.mjs`), not legacy `.eslintrc.json`
2. **Use .gitkeep files** for empty directories that need to be tracked
3. **LOG_PREFIX pattern**: All console output must use `[IRIS-TE]` prefix
4. **Build verification**: Always run `npm run compile` and `npm run lint` before marking complete
5. **Test compilation**: Use `npm run compile-tests` script, tests output to `out/` directory
6. **Unused parameters**: Use underscore prefix (e.g., `_context`) for intentionally unused params
7. **CSP implemented**: Webview already has proper Content Security Policy with nonce

### Git Context

Recent commits show:
- `51c0192` feat(story-1.2): Extension shell with sidebar view
- `38c7fa9` feat(story-1.1): Initialize VS Code extension project

This story builds directly on 1.2's sidebar webview infrastructure.

### Success Verification Checklist

**Build & Tests:**
- [ ] `npm install @intersystems-community/intersystems-servermanager` succeeds
- [ ] `npm run compile` exits with code 0
- [ ] `npm run lint` passes with no errors
- [ ] `npm run test` - all tests pass

**Files Created:**
- [ ] `src/providers/ServerConnectionManager.ts`
- [ ] `src/models/IServerSpec.ts`
- [ ] `src/models/IMessages.ts`

**Functional Verification:**
- [ ] Webview displays "Server Manager Required" when extension not installed
- [ ] Webview displays "No servers configured" when no servers exist
- [ ] Webview displays server list when servers are configured
- [ ] Clicking server item selects it (visual highlight)
- [ ] "Open Server Manager" button triggers correct command
- [ ] Refresh button reloads server list

**Keyboard & Accessibility:**
- [ ] Arrow keys navigate between server list items
- [ ] Enter/Space selects focused server
- [ ] Focus indicator visible on server items (2px border)
- [ ] Screen reader announces server count and selection changes

**Code Quality:**
- [ ] Console shows `[IRIS-TE]` prefixed messages
- [ ] All styling uses VS Code CSS variables (no hardcoded colors)
- [ ] BEM naming with `ite-` prefix used consistently
- [ ] No XSS vulnerabilities (HTML escaped in dynamic content)
- [ ] Message listener cleanup on view dispose

### References

- [Source: architecture.md#Extension ↔ Server Manager Boundary]
- [Source: architecture.md#Implementation Patterns & Consistency Rules]
- [Source: architecture.md#Command/Event Message Format]
- [Source: architecture.md#Project Structure & Boundaries]
- [Source: epics.md#Story 1.3: Server Manager Integration]
- [Source: 1-2-extension-shell-with-sidebar-view.md#Previous Story Learnings]
- [Source: ux-design-specification.md#Component Strategy]
- [Source: CLAUDE.md#Server Manager Integration]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debugging issues encountered.

### Completion Notes List

- Installed `@intersystems-community/intersystems-servermanager` and `@vscode/codicons` dependencies
- Created `ServerConnectionManager` class that integrates with Server Manager extension via VS Code extension API
- Discovered the Server Manager package exports a `ServerManagerAPI` interface accessed via extension exports (not direct imports as documented in story notes)
- Created `IServerSpec` and `IMessages` type definitions following `I` prefix convention
- Updated `TableEditorProvider` with message handling, disposable cleanup, and initial server list loading
- Implemented full webview JavaScript with state management, XSS-safe rendering, keyboard navigation, and ARIA announcements
- Added comprehensive CSS with VS Code theme variables, BEM naming, loading animations, and reduced-motion support
- Created unit tests for `ServerConnectionManager` (6 tests) - all passing
- All 10 tests pass (6 new + 4 existing)
- Build and lint pass with no errors

### Learnings for Future Stories

1. **Server Manager API access**: Use `vscode.extensions.getExtension<ServerManagerAPI>('intersystems-community.servermanager').exports` instead of direct package imports
2. **API types**: Import types from package, but access functions via extension exports
3. **getServerNames()** returns `IServerName[]` objects (with `name`, `description`, `detail`), not plain strings

### File List

**New files:**
- `src/providers/ServerConnectionManager.ts` - Server Manager integration class
- `src/models/IServerSpec.ts` - Server specification interface
- `src/models/IMessages.ts` - Command/Event type definitions
- `src/test/serverConnectionManager.test.ts` - Unit tests for ServerConnectionManager

**Modified files:**
- `package.json` - Added dependencies
- `package-lock.json` - Dependency lock file updated
- `src/providers/TableEditorProvider.ts` - Message handling, disposables, server list integration
- `media/main.js` - Full webview JavaScript with state management and rendering
- `media/styles.css` - Server list styles, loading states, message states, buttons

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-27 | Implemented Story 1.3: Server Manager Integration | Claude Opus 4.5 |
| 2026-01-27 | Code Review Fixes: XSS vulnerability in data-server attribute, AC#2 message text, error rendering logic, added 4 negative path tests, removed dead CSS | Claude Opus 4.5 (Review) |
