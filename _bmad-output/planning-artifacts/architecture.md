---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-13.md
  - docs/initial-prompt.md
  - CLAUDE.md
workflowType: 'architecture'
project_name: 'iris-table-editor'
user_name: 'Developer'
date: '2026-01-26'
lastStep: 8
status: 'complete'
completedAt: '2026-01-26'
lastUpdated: '2026-02-13'
updateReason: 'Sprint Change Proposal - Standalone Desktop Application (Epics 10-14)'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
38 requirements organized into 8 categories covering the complete CRUD lifecycle for IRIS table data:
- Server Connection (5 FRs): Server discovery, selection, authentication via Server Manager, connection status, disconnect
- Table Navigation (5 FRs): Namespace listing, table browsing, selection, refresh
- Data Display (5 FRs): Excel-like grid, column headers, scrolling, type-aware formatting, refresh
- Data Editing (5 FRs): Inline cell editing, UPDATE operations, cancel, visual feedback, save confirmation
- Data Creation (5 FRs): New row initiation, field entry, INSERT operations, validation
- Data Deletion (5 FRs): Row selection, confirmation dialog, DELETE operations
- Error Handling (4 FRs): User-friendly messages, context, dismissible notifications, constraint violation messaging
- User Interface (4 FRs): Light/dark theme support, sidebar access, command palette access

**Non-Functional Requirements:**
24 requirements defining quality attributes:
- Performance: 2s table load (<500 rows), 1s save, 1s list operations, non-blocking UI, no startup delay, desktop launch <3s
- Security: No credential storage in extension state, Server Manager auth (VS Code), safeStorage OS keychain (desktop), parameterized queries, no sensitive logging, HTTPS when available, context isolation (desktop)
- Integration: Graceful Server Manager detection, version compatibility, namespace encoding (%→%25), API version handling
- Reliability: Clear error messages, no data corruption on partial failure, network disconnect detection, connection recovery, window state persistence (desktop)

**Scale & Complexity:**
- Primary domain: Multi-target tool (VS Code Extension + Electron Desktop App) with REST API Integration
- Complexity level: Medium
- Estimated architectural components: ~15 major components (shared core + per-target shells)

### Technical Constraints & Dependencies

| Constraint | Impact |
|------------|--------|
| HTTP-only via Atelier REST API | No superserver port needed; all operations via POST to `/api/atelier/v1/{NAMESPACE}/action/query` |
| Server Manager dependency | Extension cannot function without `intersystems-community.servermanager` installed |
| Webview security | CSP with nonce required; message-passing architecture between extension and webview |
| Namespace encoding | Special handling for `%` character in system namespace names |
| IRIS 2021.1+ compatibility | Must support Atelier API across IRIS versions |

### Cross-Cutting Concerns Identified

1. **Authentication Flow**: Target-dependent — VS Code uses `vscode.authentication.getSession()` with Server Manager provider; desktop uses built-in connection manager with safeStorage credentials
2. **Error Handling**: Unified error parsing from Atelier API `status.errors` array; user-friendly message transformation (shared core)
3. **Theme Compatibility**: Abstracted `--ite-*` CSS variables with per-target bridge files (VS Code maps from `--vscode-*`; desktop provides hardcoded light/dark tokens)
4. **Parameterized Queries**: All SQL operations must use `?` placeholders — enforced in SqlBuilder utility (shared core)
5. **Connection State**: Server selection state affects table list, data display, and all CRUD operations (shared core)
6. **Message Bridge**: IMessageBridge abstraction — webview code never knows which target it's running in; VS Code uses postMessage, Electron uses contextBridge IPC

## Starter Template Evaluation

### Primary Technology Domain

VS Code Extension with Webview - specialized development requiring official tooling

### Starter Options Considered

| Starter | Status | Recommendation |
|---------|--------|----------------|
| yo code (Yeoman) | Official, maintained, esbuild support | **Selected** |
| antfu/starter-vscode | Modern template, no webview | Alternative |
| Manual setup | Labor-intensive | Not recommended |

### Selected Starter: yo code (Yeoman Generator)

**Rationale:**
- Official VS Code extension generator maintained by Microsoft
- Generates standard structure with debugging configuration
- esbuild bundler option aligns with documented requirements
- Minimal additions needed for project-specific dependencies

**Initialization Command:**

```bash
npx --package yo --package generator-code -- yo code
```

**Prompts to Select:**
- Type: New Extension (TypeScript)
- Identifier: iris-table-editor
- Bundle with esbuild: Yes
- Package manager: npm

**Architectural Decisions Provided:**

| Decision | Value |
|----------|-------|
| Language | TypeScript (strict mode) |
| Module Format | CommonJS |
| Target | ES2020+ |
| Bundler | esbuild |
| Source Maps | Enabled |
| Debugging | VS Code F5 configuration |

**Post-Initialization Setup Required:**
1. Add dependencies: @intersystems-community/intersystems-servermanager, @vscode/webview-ui-toolkit
2. Configure extensionDependencies in package.json
3. Add views/viewsContainers for sidebar panel
4. Expand directory structure per documented architecture

## Monorepo Structure & Package Boundaries

### Monorepo Layout

The project uses npm workspaces to share code between VS Code extension and Electron desktop targets.

```
iris-table-editor/
├── package.json                    # Root workspace config
├── packages/
│   ├── core/                       # Shared services, models, utils
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── services/
│   │       │   ├── AtelierApiService.ts
│   │       │   ├── QueryExecutor.ts
│   │       │   ├── TableMetadataService.ts
│   │       │   ├── ExportService.ts
│   │       │   └── ImportService.ts
│   │       ├── models/
│   │       │   ├── IServerSpec.ts
│   │       │   ├── ITableData.ts
│   │       │   ├── ITableSchema.ts
│   │       │   ├── IAtelierResponse.ts
│   │       │   ├── IMessages.ts
│   │       │   ├── IUserError.ts
│   │       │   ├── IColumnTypes.ts
│   │       │   └── IExportImport.ts
│   │       └── utils/
│   │           ├── ErrorHandler.ts
│   │           ├── SqlBuilder.ts
│   │           ├── UrlBuilder.ts
│   │           ├── DataTypeFormatter.ts
│   │           ├── DateParser.ts
│   │           └── CsvParser.ts
│   ├── webview/                    # Shared UI (runs in both targets)
│   │   ├── package.json
│   │   └── src/
│   │       ├── webview.html
│   │       ├── styles.css          # Uses --ite-* variables only
│   │       ├── theme.css           # --ite-* variable definitions
│   │       ├── main.js             # AppState, event handlers, grid
│   │       └── KeyboardShortcuts.ts
│   ├── vscode/                     # VS Code extension target
│   │   ├── package.json            # Extension manifest
│   │   ├── tsconfig.json
│   │   ├── esbuild.js
│   │   └── src/
│   │       ├── extension.ts
│   │       ├── providers/
│   │       │   ├── TableEditorProvider.ts
│   │       │   └── ServerConnectionManager.ts
│   │       └── vscodeThemeBridge.css  # Maps --vscode-* → --ite-theme-*
│   └── desktop/                    # Electron desktop target
│       ├── package.json
│       ├── tsconfig.json
│       ├── electron-builder.yml
│       └── src/
│           ├── main/
│           │   ├── main.ts         # Electron main process entry
│           │   ├── ipc.ts          # IPC handler registration
│           │   ├── ConnectionManager.ts  # Server CRUD + safeStorage
│           │   └── WindowManager.ts      # BrowserWindow + state
│           ├── renderer/
│           │   ├── preload.ts      # contextBridge exposure
│           │   └── desktopThemeBridge.css  # Hardcoded light/dark tokens
│           └── ui/
│               ├── connection/     # Server list, server form
│               └── settings/       # App preferences
```

### Package Dependency Rules

| Package | Can Import From | Cannot Import From |
|---------|----------------|--------------------|
| `@iris-te/core` | Node.js stdlib only | `vscode`, `electron`, `@iris-te/webview` |
| `@iris-te/webview` | `@iris-te/core` (types only) | `vscode`, `electron` |
| `@iris-te/vscode` | `@iris-te/core`, `@iris-te/webview`, `vscode` | `electron` |
| `@iris-te/desktop` | `@iris-te/core`, `@iris-te/webview`, `electron` | `vscode` |

### Root package.json Workspace Config

```json
{
  "name": "iris-table-editor",
  "private": true,
  "workspaces": [
    "packages/core",
    "packages/webview",
    "packages/vscode",
    "packages/desktop"
  ]
}
```

## IMessageBridge Abstraction

The webview code communicates with its host (VS Code extension host or Electron main process) exclusively through the IMessageBridge interface. The webview never knows which target it's running in.

### Interface Definition

```typescript
// packages/core/src/models/IMessageBridge.ts

interface IMessageBridge {
  /** Send a command from webview to host */
  sendCommand(command: string, payload: unknown): void;

  /** Register a handler for events from host */
  onEvent(event: string, handler: (payload: unknown) => void): void;

  /** Remove an event handler */
  offEvent(event: string, handler: (payload: unknown) => void): void;
}
```

### VS Code Implementation

```typescript
// packages/vscode/src/VSCodeMessageBridge.ts

class VSCodeMessageBridge implements IMessageBridge {
  private vscodeApi = acquireVsCodeApi();

  sendCommand(command: string, payload: unknown): void {
    this.vscodeApi.postMessage({ command, payload });
  }

  onEvent(event: string, handler: (payload: unknown) => void): void {
    window.addEventListener('message', (e) => {
      if (e.data.event === event) handler(e.data.payload);
    });
  }

  offEvent(event: string, handler: (payload: unknown) => void): void {
    // Remove matching listener
  }
}
```

### Electron Implementation

```typescript
// packages/desktop/src/renderer/ElectronMessageBridge.ts

class ElectronMessageBridge implements IMessageBridge {
  sendCommand(command: string, payload: unknown): void {
    window.electronAPI.sendCommand(command, payload);
  }

  onEvent(event: string, handler: (payload: unknown) => void): void {
    window.electronAPI.onEvent(event, handler);
  }

  offEvent(event: string, handler: (payload: unknown) => void): void {
    window.electronAPI.offEvent(event, handler);
  }
}
```

### Bridge Injection

The webview's `main.js` receives the bridge at initialization:

```javascript
// packages/webview/src/main.js
let bridge; // IMessageBridge instance

function initializeApp(messageBridge) {
  bridge = messageBridge;
  // All subsequent communication uses bridge.sendCommand() / bridge.onEvent()
}
```

## Theme Abstraction Layer

### CSS Variable Architecture

All shared styles use `--ite-*` variables. Each target provides values via a bridge CSS file.

```css
/* packages/webview/src/theme.css — Abstract variable definitions */
:root {
  --ite-bg: var(--ite-theme-bg);
  --ite-fg: var(--ite-theme-fg);
  --ite-bg-secondary: var(--ite-theme-bg-secondary);
  --ite-border: var(--ite-theme-border);
  --ite-accent: var(--ite-theme-accent);
  --ite-error: var(--ite-theme-error);
  --ite-success: var(--ite-theme-success);
  --ite-input-bg: var(--ite-theme-input-bg);
  --ite-input-fg: var(--ite-theme-input-fg);
  --ite-input-border: var(--ite-theme-input-border);
  --ite-focus-ring: var(--ite-theme-focus-ring);
  --ite-grid-header-bg: var(--ite-theme-grid-header-bg);
  --ite-grid-row-hover: var(--ite-theme-grid-row-hover);
  --ite-grid-row-selected: var(--ite-theme-grid-row-selected);
  --ite-scrollbar-bg: var(--ite-theme-scrollbar-bg);
  --ite-scrollbar-thumb: var(--ite-theme-scrollbar-thumb);
}
```

### VS Code Theme Bridge

```css
/* packages/vscode/src/vscodeThemeBridge.css */
:root {
  --ite-theme-bg: var(--vscode-editor-background);
  --ite-theme-fg: var(--vscode-editor-foreground);
  --ite-theme-bg-secondary: var(--vscode-sideBar-background);
  --ite-theme-border: var(--vscode-panel-border);
  --ite-theme-accent: var(--vscode-focusBorder);
  --ite-theme-error: var(--vscode-errorForeground);
  --ite-theme-success: var(--vscode-testing-iconPassed);
  --ite-theme-input-bg: var(--vscode-input-background);
  --ite-theme-input-fg: var(--vscode-input-foreground);
  --ite-theme-input-border: var(--vscode-input-border);
  --ite-theme-focus-ring: var(--vscode-focusBorder);
  --ite-theme-grid-header-bg: var(--vscode-editorGroupHeader-tabsBackground);
  --ite-theme-grid-row-hover: var(--vscode-list-hoverBackground);
  --ite-theme-grid-row-selected: var(--vscode-list-activeSelectionBackground);
  --ite-theme-scrollbar-bg: var(--vscode-scrollbarSlider-background);
  --ite-theme-scrollbar-thumb: var(--vscode-scrollbarSlider-activeBackground);
}
```

### Desktop Theme Bridge

```css
/* packages/desktop/src/renderer/desktopThemeBridge.css */

/* Light theme (default) */
:root {
  --ite-theme-bg: #ffffff;
  --ite-theme-fg: #1e1e1e;
  --ite-theme-bg-secondary: #f3f3f3;
  --ite-theme-border: #e0e0e0;
  --ite-theme-accent: #0078d4;
  --ite-theme-error: #d32f2f;
  --ite-theme-success: #388e3c;
  --ite-theme-input-bg: #ffffff;
  --ite-theme-input-fg: #1e1e1e;
  --ite-theme-input-border: #cccccc;
  --ite-theme-focus-ring: #0078d4;
  --ite-theme-grid-header-bg: #f5f5f5;
  --ite-theme-grid-row-hover: #e8e8e8;
  --ite-theme-grid-row-selected: #cce5ff;
  --ite-theme-scrollbar-bg: #f0f0f0;
  --ite-theme-scrollbar-thumb: #c1c1c1;
}

/* Dark theme */
:root[data-theme="dark"] {
  --ite-theme-bg: #1e1e1e;
  --ite-theme-fg: #d4d4d4;
  --ite-theme-bg-secondary: #252526;
  --ite-theme-border: #3c3c3c;
  --ite-theme-accent: #0078d4;
  --ite-theme-error: #f44747;
  --ite-theme-success: #89d185;
  --ite-theme-input-bg: #3c3c3c;
  --ite-theme-input-fg: #d4d4d4;
  --ite-theme-input-border: #5a5a5a;
  --ite-theme-focus-ring: #0078d4;
  --ite-theme-grid-header-bg: #2d2d2d;
  --ite-theme-grid-row-hover: #2a2d2e;
  --ite-theme-grid-row-selected: #094771;
  --ite-theme-scrollbar-bg: #1e1e1e;
  --ite-theme-scrollbar-thumb: #424242;
}
```

### Migration Pattern

During Epic 10, all existing `--vscode-*` references in `styles.css` are replaced with `--ite-*` equivalents:

```css
/* BEFORE (current) */
background: var(--vscode-editor-background);

/* AFTER (migrated) */
background: var(--ite-bg);
```

## Electron Architecture

### Main Process Design

```typescript
// packages/desktop/src/main/main.ts

import { app, BrowserWindow } from 'electron';
import { WindowManager } from './WindowManager';
import { ConnectionManager } from './ConnectionManager';
import { registerIpcHandlers } from './ipc';

app.whenReady().then(() => {
  const connectionManager = new ConnectionManager();
  const windowManager = new WindowManager();

  registerIpcHandlers(connectionManager);
  windowManager.createMainWindow();
});
```

### Security Configuration

```typescript
// BrowserWindow creation
const win = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,        // REQUIRED: no Node in renderer
    contextIsolation: true,        // REQUIRED: isolated worlds
    preload: path.join(__dirname, 'preload.js'),
    sandbox: true                  // Additional sandboxing
  }
});
```

### Preload Script (Context Bridge)

```typescript
// packages/desktop/src/renderer/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  sendCommand: (command: string, payload: unknown) => {
    ipcRenderer.send('command', { command, payload });
  },
  onEvent: (event: string, handler: (payload: unknown) => void) => {
    ipcRenderer.on(`event:${event}`, (_e, payload) => handler(payload));
  },
  offEvent: (event: string, handler: (payload: unknown) => void) => {
    ipcRenderer.removeListener(`event:${event}`, handler);
  }
});
```

### IPC Handler Registration

```typescript
// packages/desktop/src/main/ipc.ts
import { ipcMain } from 'electron';

export function registerIpcHandlers(connectionManager: ConnectionManager) {
  ipcMain.on('command', async (event, { command, payload }) => {
    switch (command) {
      case 'selectServer':
        await handleSelectServer(event, payload, connectionManager);
        break;
      case 'loadTables':
        await handleLoadTables(event, payload, connectionManager);
        break;
      // ... all existing commands from IMessages.ts
    }
  });
}

function sendEvent(event: Electron.IpcMainEvent, eventName: string, payload: unknown) {
  event.sender.send(`event:${eventName}`, payload);
}
```

## Credential Storage (Desktop)

### Pattern

```
User enters password
    → safeStorage.encryptString(password)
    → store encrypted blob in electron-store config file
    → on reconnect: safeStorage.decryptString(blob)
    → use decrypted password for Basic Auth header
```

### Implementation

```typescript
// packages/desktop/src/main/ConnectionManager.ts
import { safeStorage } from 'electron';
import Store from 'electron-store';

interface ServerConfig {
  name: string;
  hostname: string;
  port: number;
  namespace: string;
  username: string;
  encryptedPassword: string;  // Base64-encoded encrypted blob
  ssl: boolean;
}

class ConnectionManager {
  private store = new Store<{ servers: ServerConfig[] }>();

  saveServer(config: Omit<ServerConfig, 'encryptedPassword'> & { password: string }): void {
    const encrypted = safeStorage.encryptString(config.password);
    const serverConfig: ServerConfig = {
      ...config,
      encryptedPassword: encrypted.toString('base64')
    };
    // password field is NOT stored
    const servers = this.store.get('servers', []);
    servers.push(serverConfig);
    this.store.set('servers', servers);
  }

  getPassword(serverName: string): string {
    const server = this.getServer(serverName);
    const buffer = Buffer.from(server.encryptedPassword, 'base64');
    return safeStorage.decryptString(buffer);
  }

  getServers(): Omit<ServerConfig, 'encryptedPassword'>[] {
    return this.store.get('servers', []).map(({ encryptedPassword, ...rest }) => rest);
  }
}
```

### Security Guarantees

- Passwords are NEVER stored in plaintext on disk
- `safeStorage` uses OS-level encryption: Windows Credential Manager, macOS Keychain
- Config file (`electron-store`) stores only encrypted blobs
- Passwords are decrypted only in memory, only when needed for authentication
- Desktop app follows same "never log credentials" rule as VS Code extension (NFR9)

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- HTTP Client: Node.js native fetch
- Extension-Webview Communication: Command/Event pattern
- Error Handling: Centralized ErrorHandler class

**Important Decisions (Shape Architecture):**
- Webview State Management: Simple state class with listener pattern
- Metadata Caching: Session-based with 1-hour TTL
- Data Pagination: Server-side pagination (50 rows default)

**Deferred Decisions (Post-MVP):**
- Virtual scrolling for very large datasets
- Offline caching / persistence
- Multi-tab support

### HTTP Client

| Aspect | Decision |
|--------|----------|
| Technology | Node.js native `fetch` |
| Timeout | All fetch calls use `AbortController` with configurable timeout (default 30s) |
| Cancellation | External callers can pass `AbortSignal` to cancel in-flight requests (e.g., cancel connection) |
| Rationale | Zero dependencies, built-in to Node 20+, sufficient for REST API. AbortController is native to Node 20+ and integrates with fetch signal option. |
| Affects | AtelierApiService |

**Timeout/Cancellation Pattern (Story 1.7):**

```typescript
// Centralized fetch wrapper in AtelierApiService
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // If external signal aborts (e.g., user clicks Cancel), abort our controller too
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      if (externalSignal?.aborted) {
        throw new Error('CONNECTION_CANCELLED');
      }
      throw new Error('CONNECTION_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
```

### Extension-Webview Communication

| Aspect | Decision |
|--------|----------|
| Pattern | Command/Event |
| Commands (webview→extension) | selectServer, loadTables, selectTable, updateRow, insertRow, deleteRow, refreshData, cancelConnection |
| Events (extension→webview) | serverList, tableList, tableData, tableSchema, operationSuccess, error, connectionProgress |
| Type Safety | TypeScript interfaces for all message types |
| Rationale | Clear directionality, matches PRD terminology, intuitive for implementation |

**Growth Phase Commands (Epic 6):**

| Command | Payload | Description |
|---------|---------|-------------|
| `loadSchemas` | `{ namespace: string }` | Load schema list for tree view |
| `loadTablesBySchema` | `{ namespace: string, schema: string }` | Load tables within a schema |
| `filterData` | `{ filters: FilterCriteria[], enabled: boolean }` | Apply column filters |
| `sortData` | `{ column: string, direction: 'asc' \| 'desc' \| null }` | Apply column sort |
| `gotoPage` | `{ page: number }` | Navigate to specific page |
| `getDistinctValues` | `{ column: string, limit: number }` | Get distinct values for filter UI |

**Growth Phase Events (Epic 6):**

| Event | Payload | Description |
|-------|---------|-------------|
| `schemaList` | `{ schemas: SchemaInfo[] }` | Available schemas with table counts |
| `distinctValues` | `{ column: string, values: string[], hasMore: boolean }` | Distinct values for filter checklist |
| `dataFiltered` | `{ rows: [], totalFiltered: number, page: number }` | Filtered/sorted data response |

**Growth Phase Commands (Epic 7 - Data Type Polish):**

| Command | Payload | Description |
|---------|---------|-------------|
| `toggleBoolean` | `{ tableName: string, primaryKey: Record<string, unknown>, column: string, newValue: boolean }` | Toggle boolean checkbox |
| `setNull` | `{ tableName: string, primaryKey: Record<string, unknown>, column: string }` | Explicitly set cell to NULL |

**Growth Phase Commands (Epic 8 - Keyboard Shortcuts):**

| Command | Payload | Description |
|---------|---------|-------------|
| `copyCell` | `{ value: unknown }` | Copy cell value to clipboard |
| `pasteCell` | `{ tableName: string, primaryKey: Record<string, unknown>, column: string }` | Request paste into cell |
| `duplicateRow` | `{ tableName: string, primaryKey: Record<string, unknown> }` | Duplicate current row |

**Growth Phase Events (Epic 8 - Keyboard Shortcuts):**

| Event | Payload | Description |
|-------|---------|-------------|
| `clipboardContent` | `{ value: string }` | Clipboard content for paste operation |
| `rowDuplicated` | `{ newRow: Record<string, unknown>, newPrimaryKey: Record<string, unknown> }` | Duplicated row data |

**Growth Phase Commands (Epic 9 - Export/Import):**

| Command | Payload | Description |
|---------|---------|-------------|
| `exportData` | `{ format: 'csv' \| 'xlsx', scope: 'page' \| 'all' \| 'filtered' }` | Export table data |
| `importData` | `{ format: 'csv' \| 'xlsx', data: string, columnMapping: Record<string, string> }` | Import data from file |
| `getImportTemplate` | `{ tableName: string }` | Download import template |
| `validateImport` | `{ data: string, columnMapping: Record<string, string> }` | Validate before import |
| `cancelImport` | `{}` | Cancel in-progress import |

**Growth Phase Events (Epic 9 - Export/Import):**

| Event | Payload | Description |
|-------|---------|-------------|
| `exportReady` | `{ filename: string, data: Blob }` | Export file ready for download |
| `exportProgress` | `{ percent: number, rowsProcessed: number }` | Export progress update |
| `importPreview` | `{ columns: string[], sampleRows: unknown[][], suggestedMapping: Record<string, string> }` | Import preview data |
| `importProgress` | `{ percent: number, rowsImported: number, rowsFailed: number }` | Import progress update |
| `importComplete` | `{ totalImported: number, failed: ImportError[] }` | Import completion summary |
| `importValidation` | `{ valid: boolean, errors: ValidationError[], warnings: ValidationWarning[] }` | Pre-import validation results |

**Filter Criteria Interface:**
```typescript
interface FilterCriteria {
  column: string;
  operator: 'contains' | 'startsWith' | 'endsWith' | 'equals' | 'notEquals' | 'gt' | 'lt' | 'isEmpty' | 'isNotEmpty';
  value: string;
}
```

**Growth Phase Interfaces (Epic 7 - Data Type Polish):**

```typescript
// Column type information for type-appropriate rendering
interface ColumnTypeInfo {
  name: string;
  sqlType: string;           // IRIS SQL type (BIT, DATE, TIME, TIMESTAMP, INTEGER, DECIMAL, VARCHAR, etc.)
  displayType: 'boolean' | 'date' | 'time' | 'timestamp' | 'integer' | 'decimal' | 'text';
  nullable: boolean;
  precision?: number;        // For DECIMAL types
  scale?: number;            // For DECIMAL types
}

// Type mapping from IRIS SQL types to display types
const IRIS_TYPE_MAP: Record<string, ColumnTypeInfo['displayType']> = {
  'BIT': 'boolean',
  'TINYINT': 'boolean',      // When used as boolean
  'DATE': 'date',
  'TIME': 'time',
  'TIMESTAMP': 'timestamp',
  'DATETIME': 'timestamp',
  'INTEGER': 'integer',
  'BIGINT': 'integer',
  'SMALLINT': 'integer',
  'DECIMAL': 'decimal',
  'NUMERIC': 'decimal',
  'DOUBLE': 'decimal',
  'FLOAT': 'decimal',
  'VARCHAR': 'text',
  'CHAR': 'text',
  'LONGVARCHAR': 'text'
};
```

**Growth Phase Interfaces (Epic 9 - Export/Import):**

```typescript
// Export configuration
interface ExportConfig {
  format: 'csv' | 'xlsx';
  scope: 'page' | 'all' | 'filtered';
  includeHeaders: boolean;
  dateFormat?: string;       // e.g., 'YYYY-MM-DD'
  booleanFormat?: 'true/false' | 'yes/no' | '1/0';
}

// Import preview data
interface ImportPreviewData {
  sourceColumns: string[];
  sampleRows: unknown[][];   // First 10 rows
  suggestedMapping: Record<string, string>;  // sourceColumn -> tableColumn
  detectedFormat: 'csv' | 'xlsx';
  totalRows: number;
}

// Import configuration
interface ImportConfig {
  columnMapping: Record<string, string>;  // sourceColumn -> tableColumn
  skipHeaderRow: boolean;
  validateBeforeImport: boolean;
  onError: 'skip' | 'abort';
}

// Import error details
interface ImportError {
  rowNumber: number;
  sourceData: Record<string, unknown>;
  error: string;
  column?: string;
}

// Validation results
interface ValidationError {
  rowNumber: number;
  column: string;
  value: unknown;
  expectedType: string;
  message: string;
}

interface ValidationWarning {
  rowNumber: number;
  column: string;
  message: string;
}
```

### Webview State Management

| Aspect | Decision |
|--------|----------|
| Approach | Simple state class |
| State Properties | server, namespace, tables, selectedTable, rows, schema, pendingEdits, loading, error |
| Update Pattern | Explicit update() method with listener notification |
| Rationale | Encapsulated, testable, appropriate complexity for scope |

**Growth Phase State Properties (Epic 6):**

| Property | Type | Description |
|----------|------|-------------|
| `schemas` | `SchemaInfo[]` | Available schemas for tree view |
| `expandedSchema` | `string \| null` | Currently expanded schema in tree |
| `filters` | `FilterCriteria[]` | Active filter criteria |
| `filtersEnabled` | `boolean` | Whether filters are applied (toggle state) |
| `sort` | `{ column: string, direction: 'asc' \| 'desc' } \| null` | Current sort state |
| `currentPage` | `number` | Current page number (1-based) |
| `totalRows` | `number` | Total rows (may differ from filtered count) |
| `totalFilteredRows` | `number` | Total rows matching current filters |

**Growth Phase State Properties (Epic 7 - Data Type Polish):**

| Property | Type | Description |
|----------|------|-------------|
| `columnTypes` | `Map<string, ColumnTypeInfo>` | Column data type metadata for rendering |

**Growth Phase State Properties (Epic 9 - Export/Import):**

| Property | Type | Description |
|----------|------|-------------|
| `exportInProgress` | `boolean` | Export operation running |
| `exportProgress` | `number` | Export progress percentage (0-100) |
| `importInProgress` | `boolean` | Import operation running |
| `importProgress` | `number` | Import progress percentage (0-100) |
| `importPreview` | `ImportPreviewData \| null` | Preview data for import mapping |

### Error Handling Strategy

| Aspect | Decision |
|--------|----------|
| Pattern | Centralized ErrorHandler class |
| Location | src/utils/ErrorHandler.ts |
| Responsibilities | Parse Atelier errors, map to user-friendly messages, categorize by recoverability |
| Error Categories | Connection, Authentication, SQL, API |
| Rationale | Consistent UX, single point for error message improvements |

### Caching & Performance

| Aspect | Decision |
|--------|----------|
| Metadata Cache | Session-based with 1-hour TTL |
| Cache Scope | Table schemas, column definitions |
| Data Loading | Server-side pagination via Atelier `?max=N` parameter |
| Default Page Size | 50 rows (configurable via settings) |
| Rationale | Balances performance with data freshness, scalable approach |

### Decision Impact Analysis

**Implementation Sequence:**
1. HTTP Client setup in AtelierApiService (foundation for all API calls)
2. Command/Event message types (enables extension-webview integration)
3. ErrorHandler class (needed before any API calls)
4. State class in webview (foundation for UI)
5. Caching layer (optimization, can be added incrementally)

**Cross-Component Dependencies:**
- AtelierApiService depends on ErrorHandler for error transformation
- TableEditorProvider depends on Command/Event types for message handling
- Webview main.js depends on State class and Event types
- QueryExecutor depends on AtelierApiService and caching layer

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Addressed:** 12 areas where AI agents could make different choices

### Naming Patterns

**File Naming Conventions:**

| File Type | Convention | Example |
|-----------|------------|---------|
| Class files (providers, services) | PascalCase | `TableEditorProvider.ts`, `AtelierApiService.ts` |
| Utility files | camelCase | `sqlBuilder.ts`, `errorHandler.ts` |
| Interface files | PascalCase with `I` prefix | `IServerSpec.ts`, `ITableSchema.ts` |
| Webview files | lowercase | `main.js`, `styles.css`, `webview.html` |
| Test files | Source name + `.test.ts` | `AtelierApiService.test.ts` |

**Function/Method Naming:**

| Action | Prefix | Examples |
|--------|--------|----------|
| Retrieve data | `get` | `getTableData()`, `getServerList()`, `getSchema()` |
| Set/update | `set` | `setConnectionState()`, `setSelectedTable()` |
| Boolean check | `is`/`has`/`can` | `isConnected()`, `hasUnsavedChanges()`, `canEdit()` |
| Execute action | `execute` | `executeQuery()`, `executeUpdate()` |
| Handle event | `handle`/`on` | `handleMessage()`, `onCellEdit()`, `onServerSelect()` |
| Build/construct | `build` | `buildSelectQuery()`, `buildUrl()`, `buildAuthHeader()` |
| Parse/transform | `parse`/`map` | `parseError()`, `mapToUserMessage()`, `parseResponse()` |

**CSS Class Naming (BEM with prefix):**

```css
/* Block */
.ite-grid { }
.ite-toolbar { }
.ite-cell { }

/* Element */
.ite-grid__header { }
.ite-grid__row { }
.ite-cell__input { }

/* Modifier */
.ite-cell--editing { }
.ite-cell--modified { }
.ite-row--selected { }
```

### Structure Patterns

**Project Organization:**

```
src/
├── extension.ts                    # Entry point only - minimal code
├── providers/
│   ├── TableEditorProvider.ts      # WebviewViewProvider implementation
│   └── ServerConnectionManager.ts  # Server Manager integration
├── services/
│   ├── AtelierApiService.ts        # HTTP client for Atelier API
│   ├── QueryExecutor.ts            # CRUD operations
│   └── TableMetadataService.ts     # Schema/metadata with caching
├── models/
│   ├── IServerSpec.ts              # One interface per file
│   ├── ITableData.ts
│   ├── ITableSchema.ts
│   ├── IAtelierResponse.ts
│   └── IMessages.ts                # Command/Event type definitions
├── utils/
│   ├── ErrorHandler.ts             # Error parsing and mapping
│   ├── SqlBuilder.ts               # Parameterized query generation
│   └── UrlBuilder.ts               # Atelier URL construction
└── test/
    └── *.test.ts                   # Co-located or in test/ folder
media/
├── webview.html                    # Single HTML file
├── styles.css                      # Single CSS file
└── main.js                         # Single JS file (no bundling for webview)
```

**Test File Organization:**
- Co-located tests: `src/services/AtelierApiService.test.ts`
- Or dedicated folder: `src/test/AtelierApiService.test.ts`
- Test naming: `describe('AtelierApiService')` → `it('should execute query')`

### Format Patterns

**Command/Event Message Format:**

```typescript
// Command interface (webview → extension)
interface ICommand<T = unknown> {
  command: string;
  payload: T;
}

// Event interface (extension → webview)
interface IEvent<T = unknown> {
  event: string;
  payload: T;
}

// Concrete command types
interface ISelectServerPayload {
  serverName: string;
}

interface ILoadTablePayload {
  namespace: string;
  tableName: string;
}

interface IUpdateRowPayload {
  tableName: string;
  primaryKey: Record<string, unknown>;
  changes: Record<string, unknown>;
}

// Concrete event types
interface ITableDataPayload {
  rows: Record<string, unknown>[];
  schema: ITableSchema;
  totalRows: number;
  page: number;
}

interface IErrorPayload {
  message: string;
  code: string;
  recoverable: boolean;
  context: string;
}

// Connection lifecycle types (Story 1.7)
interface ICancelConnectionPayload {} // Empty - cancels current attempt

interface IConnectionProgressPayload {
  status: 'connecting' | 'connected' | 'timeout' | 'cancelled' | 'error';
  serverName: string;
  message?: string; // User-facing status text
}
```

**Error Response Format:**

```typescript
interface IUserError {
  message: string;      // User-friendly message
  code: string;         // Error code for programmatic handling
  recoverable: boolean; // Can user retry?
  context: string;      // What operation failed
}

// Example
{
  message: "Table 'User.Person' not found in namespace 'USER'",
  code: "TABLE_NOT_FOUND",
  recoverable: false,
  context: "loadTable"
}
```

**Error Code Constants:**

```typescript
const ErrorCodes = {
  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_CANCELLED: 'CONNECTION_CANCELLED',
  SERVER_UNREACHABLE: 'SERVER_UNREACHABLE',

  // Authentication errors
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',

  // SQL errors
  TABLE_NOT_FOUND: 'TABLE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  INVALID_QUERY: 'INVALID_QUERY',

  // API errors
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;
```

**Growth Phase: SqlBuilder Query Patterns (Epic 6)**

```typescript
// Filter query generation
interface FilterCriteria {
  column: string;
  operator: 'contains' | 'startsWith' | 'endsWith' | 'equals' | 'notEquals' | 'gt' | 'lt' | 'isEmpty' | 'isNotEmpty';
  value: string;
}

// SqlBuilder.buildFilteredQuery() example output:
{
  query: "SELECT * FROM Schema.Table WHERE Name LIKE ? AND Status = ? ORDER BY CreatedDate DESC",
  parameters: ["%John%", "Active"]
}

// Operator to SQL mapping
const operatorMap = {
  'contains': (col, val) => ({ sql: `${col} LIKE ?`, param: `%${val}%` }),
  'startsWith': (col, val) => ({ sql: `${col} LIKE ?`, param: `${val}%` }),
  'endsWith': (col, val) => ({ sql: `${col} LIKE ?`, param: `%${val}` }),
  'equals': (col, val) => ({ sql: `${col} = ?`, param: val }),
  'notEquals': (col, val) => ({ sql: `${col} != ?`, param: val }),
  'gt': (col, val) => ({ sql: `${col} > ?`, param: val }),
  'lt': (col, val) => ({ sql: `${col} < ?`, param: val }),
  'isEmpty': (col) => ({ sql: `(${col} IS NULL OR ${col} = '')`, param: null }),
  'isNotEmpty': (col) => ({ sql: `(${col} IS NOT NULL AND ${col} != '')`, param: null })
};

// Wildcard conversion for user input
// User types: John*  → SQL: John%
// User types: *smith → SQL: %smith
// User types: J?hn   → SQL: J_hn
function convertWildcards(input: string): string {
  return input.replace(/\*/g, '%').replace(/\?/g, '_');
}

// Combined query with filter, sort, pagination
function buildFilteredQuery(
  table: string,
  filters: FilterCriteria[],
  sort: { column: string, direction: 'asc' | 'desc' } | null,
  page: number,
  pageSize: number
): { query: string, parameters: unknown[] } {
  // Always use parameterized queries - NEVER concatenate user input
}
```

**Schema Query Pattern:**

```sql
-- Get distinct schemas for tree view
SELECT DISTINCT %EXACT(TABLE_SCHEMA) AS schema_name, COUNT(*) AS table_count
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
GROUP BY %EXACT(TABLE_SCHEMA)
ORDER BY schema_name

-- Get tables for a specific schema
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME
```

**Distinct Values Query Pattern:**

```sql
-- Get distinct values for filter checklist (limited)
SELECT DISTINCT TOP 11 column_name FROM Schema.Table
-- If 11 returned, hasMore=true, show text input instead of checklist
```

**Growth Phase: Data Type Formatting Patterns (Epic 7)**

```typescript
// DataTypeFormatter.ts - Type-specific display and input formatting

// Boolean display/input
interface BooleanFormatter {
  toDisplay(value: unknown): 'checked' | 'unchecked' | 'indeterminate';
  toDatabase(checked: boolean): number;  // Returns 1 or 0
  isBoolean(sqlType: string): boolean;
}

// Date/Time parsing and formatting
interface DateFormatter {
  // Flexible parsing - accepts multiple formats
  parse(input: string): Date | null;
  // Standard display format
  toDisplay(value: unknown, type: 'date' | 'time' | 'timestamp'): string;
  // IRIS-compatible format for database
  toDatabase(date: Date, type: 'date' | 'time' | 'timestamp'): string;
}

// Supported date input formats (auto-detected)
const DATE_FORMATS = [
  'YYYY-MM-DD',      // ISO
  'MM/DD/YYYY',      // US
  'DD/MM/YYYY',      // EU
  'MMM D, YYYY',     // "Feb 1, 2026"
  'D MMM YYYY',      // "1 Feb 2026"
];

const TIME_FORMATS = [
  'HH:mm',           // 24-hour
  'HH:mm:ss',        // 24-hour with seconds
  'h:mm A',          // 12-hour "2:30 PM"
  'h:mm:ss A',       // 12-hour with seconds
];

// Numeric formatting
interface NumericFormatter {
  toDisplay(value: number, options?: { thousandsSeparator?: boolean }): string;
  toInput(value: number): string;  // Raw number for editing
  parse(input: string): number | null;
  validate(input: string, type: 'integer' | 'decimal', precision?: number): ValidationResult;
}

// NULL handling
interface NullFormatter {
  isNull(value: unknown): boolean;
  toDisplay(): string;  // Returns italic "NULL" placeholder
  cssClass: string;     // 'ite-cell--null'
}
```

**Growth Phase: Keyboard Shortcut Patterns (Epic 8)**

```typescript
// KeyboardShortcuts.ts - Centralized shortcut definitions

interface KeyboardShortcut {
  key: string;           // e.g., 'F2', 'Enter', 'ArrowDown'
  modifiers?: ('ctrl' | 'shift' | 'alt')[];
  action: string;        // Action identifier
  context: 'grid' | 'editing' | 'global';
  description: string;   // For help display
}

const SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  { key: 'ArrowUp', action: 'moveUp', context: 'grid', description: 'Move to cell above' },
  { key: 'ArrowDown', action: 'moveDown', context: 'grid', description: 'Move to cell below' },
  { key: 'ArrowLeft', action: 'moveLeft', context: 'grid', description: 'Move to cell left' },
  { key: 'ArrowRight', action: 'moveRight', context: 'grid', description: 'Move to cell right' },
  { key: 'Tab', action: 'moveNextCell', context: 'grid', description: 'Move to next cell' },
  { key: 'Tab', modifiers: ['shift'], action: 'movePrevCell', context: 'grid', description: 'Move to previous cell' },
  { key: 'Home', action: 'moveRowStart', context: 'grid', description: 'Move to first cell in row' },
  { key: 'End', action: 'moveRowEnd', context: 'grid', description: 'Move to last cell in row' },
  { key: 'Home', modifiers: ['ctrl'], action: 'moveGridStart', context: 'grid', description: 'Move to first cell' },
  { key: 'End', modifiers: ['ctrl'], action: 'moveGridEnd', context: 'grid', description: 'Move to last cell' },
  { key: 'PageDown', action: 'pageDown', context: 'grid', description: 'Move down one page' },
  { key: 'PageUp', action: 'pageUp', context: 'grid', description: 'Move up one page' },

  // Editing
  { key: 'F2', action: 'startEdit', context: 'grid', description: 'Edit selected cell' },
  { key: 'Enter', action: 'startEdit', context: 'grid', description: 'Edit selected cell' },
  { key: 'Delete', action: 'clearCell', context: 'grid', description: 'Clear cell content' },
  { key: 'Backspace', action: 'clearAndEdit', context: 'grid', description: 'Clear and edit cell' },
  { key: 'Escape', action: 'cancelEdit', context: 'editing', description: 'Cancel edit' },
  { key: 'Enter', action: 'saveAndMoveDown', context: 'editing', description: 'Save and move down' },
  { key: 'Tab', action: 'saveAndMoveRight', context: 'editing', description: 'Save and move right' },
  { key: 'Enter', modifiers: ['ctrl'], action: 'saveAndStay', context: 'editing', description: 'Save and stay' },
  { key: 'z', modifiers: ['ctrl'], action: 'undoEdit', context: 'editing', description: 'Undo edit' },

  // Row operations
  { key: '=', modifiers: ['ctrl', 'shift'], action: 'insertRow', context: 'grid', description: 'Insert new row' },
  { key: '-', modifiers: ['ctrl'], action: 'deleteRow', context: 'grid', description: 'Delete row' },
  { key: 'd', modifiers: ['ctrl'], action: 'duplicateRow', context: 'grid', description: 'Duplicate row' },

  // Data operations
  { key: 'F5', action: 'refresh', context: 'global', description: 'Refresh data' },
  { key: 'r', modifiers: ['ctrl'], action: 'refresh', context: 'global', description: 'Refresh data' },
  { key: 'c', modifiers: ['ctrl'], action: 'copyCell', context: 'grid', description: 'Copy cell value' },
  { key: 'v', modifiers: ['ctrl'], action: 'pasteCell', context: 'grid', description: 'Paste into cell' },
  { key: 'f', modifiers: ['ctrl'], action: 'focusFilter', context: 'global', description: 'Focus filter' },

  // Help
  { key: '/', modifiers: ['ctrl'], action: 'showHelp', context: 'global', description: 'Show keyboard shortcuts' },
  { key: 'F1', action: 'showHelp', context: 'global', description: 'Show keyboard shortcuts' },

  // NULL handling (Epic 7)
  { key: 'n', modifiers: ['ctrl', 'shift'], action: 'setNull', context: 'editing', description: 'Set cell to NULL' },
];

// Shortcut handler in webview
function handleKeyDown(event: KeyboardEvent, context: 'grid' | 'editing'): void {
  const shortcut = findMatchingShortcut(event, context);
  if (shortcut) {
    event.preventDefault();
    executeAction(shortcut.action);
  }
}
```

**Growth Phase: Export/Import Patterns (Epic 9)**

```typescript
// ExportService.ts - Streaming export for large datasets

interface ExportOptions {
  format: 'csv' | 'xlsx';
  scope: 'page' | 'all' | 'filtered';
  onProgress?: (percent: number, rowsProcessed: number) => void;
}

// Chunked export to avoid memory issues
async function exportData(
  table: string,
  columns: ColumnTypeInfo[],
  options: ExportOptions
): Promise<Blob> {
  const CHUNK_SIZE = 1000;
  let offset = 0;
  const chunks: string[] = [];

  // Add headers
  chunks.push(columns.map(c => c.name).join(',') + '\n');

  while (true) {
    const rows = await fetchChunk(table, offset, CHUNK_SIZE, options.scope);
    if (rows.length === 0) break;

    // Format and add rows
    for (const row of rows) {
      chunks.push(formatRowForExport(row, columns, options.format));
    }

    offset += rows.length;
    options.onProgress?.(Math.round((offset / totalRows) * 100), offset);
  }

  return new Blob(chunks, { type: getMimeType(options.format) });
}

// CSV formatting with proper escaping
function formatCsvValue(value: unknown, columnType: ColumnTypeInfo): string {
  if (value === null) return '';
  if (columnType.displayType === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (columnType.displayType === 'date') return formatDate(value as Date, 'YYYY-MM-DD');

  const str = String(value);
  // Escape values containing comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ImportService.ts - Validated import with preview

interface ImportResult {
  success: boolean;
  rowsImported: number;
  rowsFailed: number;
  errors: ImportError[];
}

async function importData(
  table: string,
  data: ParsedImportData,
  mapping: Record<string, string>,
  options: { validateFirst: boolean; onProgress?: (percent: number) => void }
): Promise<ImportResult> {
  const BATCH_SIZE = 100;
  const errors: ImportError[] = [];
  let rowsImported = 0;

  // Validation phase (if enabled)
  if (options.validateFirst) {
    const validationErrors = await validateAllRows(data, mapping, table);
    if (validationErrors.length > 0) {
      return { success: false, rowsImported: 0, rowsFailed: validationErrors.length, errors: validationErrors };
    }
  }

  // Import in batches
  for (let i = 0; i < data.rows.length; i += BATCH_SIZE) {
    const batch = data.rows.slice(i, i + BATCH_SIZE);
    const batchResult = await insertBatch(table, batch, mapping);

    rowsImported += batchResult.success;
    errors.push(...batchResult.errors);

    options.onProgress?.(Math.round(((i + batch.length) / data.rows.length) * 100));
  }

  return {
    success: errors.length === 0,
    rowsImported,
    rowsFailed: errors.length,
    errors
  };
}

// CSV Parser with auto-detection
function parseCsv(content: string): ParsedImportData {
  // Detect delimiter (comma, semicolon, tab)
  const delimiter = detectDelimiter(content);
  // Parse with proper quote handling
  // Return { columns: string[], rows: unknown[][] }
}
```

**Dependencies for Export/Import (Epic 9):**

```json
{
  "dependencies": {
    "xlsx": "^0.18.5"  // For Excel export/import
  }
}
```

Note: CSV parsing/generation uses custom implementation (no external dependency) to keep bundle size small.

### Communication Patterns

**Message Flow Pattern:**

```
┌─────────────┐     Command      ┌─────────────────────┐
│   Webview   │ ───────────────► │  TableEditorProvider │
│  (main.js)  │                  │                     │
│             │ ◄─────────────── │  (extension host)   │
└─────────────┘      Event       └─────────────────────┘
```

**State Update Pattern (Webview):**

```javascript
class AppState {
  constructor() {
    this._state = {
      server: null,
      namespace: null,
      tables: [],
      selectedTable: null,
      rows: [],
      schema: null,
      pendingEdits: new Map(),
      isLoading: false,
      loadingContext: null,
      connectionCancellable: false, // True when connecting, enables Cancel button
      error: null
    };
    this._listeners = [];
  }

  // Always use update() - never mutate directly
  update(changes) {
    this._state = { ...this._state, ...changes };
    this._notifyListeners();
  }

  subscribe(listener) {
    this._listeners.push(listener);
    return () => this._listeners = this._listeners.filter(l => l !== listener);
  }
}
```

### Process Patterns

**Loading State Pattern:**

```typescript
// In webview state
{
  isLoading: true,
  loadingContext: 'loadTable'  // What's loading
}

// Standard loading contexts
type LoadingContext =
  | 'connecting'
  | 'loadingTables'
  | 'loadingData'
  | 'saving'
  | 'deleting'
  | 'inserting';
```

**Error Handling Flow:**

```
Atelier API Error
       │
       ▼
┌─────────────────┐
│  ErrorHandler   │ ──► Parse status.errors[]
│   .parse()      │ ──► Map to error code
└────────┬────────┘ ──► Generate user message
         │
         ▼
┌─────────────────┐
│  Send 'error'   │
│  event to       │
│  webview        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Display in UI  │ ──► Show notification
│  (non-blocking) │ ──► Log to console (debug)
└─────────────────┘
```

**Logging Pattern:**

```typescript
// Prefix all logs with extension identifier
const LOG_PREFIX = '[IRIS-TE]';

// Log levels
console.debug(`${LOG_PREFIX} Connecting to server: ${serverName}`);
console.info(`${LOG_PREFIX} Table loaded: ${tableName}`);
console.warn(`${LOG_PREFIX} Connection slow, retrying...`);
console.error(`${LOG_PREFIX} Query failed:`, error);

// NEVER log sensitive data
// BAD: console.log('Password:', password);
// GOOD: console.debug('Authenticating user:', username);
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow file naming conventions (PascalCase for classes, camelCase for utilities)
2. Use standardized verb prefixes for all functions
3. Use the Command/Event message format with typed payloads
4. Route all errors through ErrorHandler class
5. Use CSS classes with `ite-` prefix and BEM structure
6. Never store or log credentials
7. Always use parameterized queries via SqlBuilder

**Pattern Verification:**
- TypeScript compiler enforces interface usage
- ESLint rules can enforce naming conventions
- Code review checklist includes pattern compliance

### Pattern Examples

**Good Examples:**

```typescript
// ✓ Correct file naming
src/services/AtelierApiService.ts
src/utils/sqlBuilder.ts

// ✓ Correct function naming
async function getTableData(namespace: string, table: string): Promise<ITableData[]>
function buildSelectQuery(table: string, columns: string[]): { query: string; params: unknown[] }
function isConnected(): boolean

// ✓ Correct message format
{ command: 'selectTable', payload: { namespace: 'USER', tableName: 'Person' } }
{ event: 'tableData', payload: { rows: [...], schema: {...}, totalRows: 100 } }

// ✓ Correct error handling
const error = ErrorHandler.parse(atelierResponse);
if (error) {
  this.postMessage({ event: 'error', payload: error });
}
```

**Anti-Patterns (AVOID):**

```typescript
// ✗ Wrong file naming
src/services/atelier-api-service.ts  // Should be PascalCase
src/utils/SqlBuilder.ts              // Should be camelCase

// ✗ Wrong function naming
function data()                      // Missing verb prefix
function get_table_data()            // Wrong case
function retrieveTableData()         // Non-standard verb

// ✗ Wrong message format
{ type: 'SELECT_TABLE', table: 'Person' }  // Wrong structure
{ command: 'selectTable', serverName: 'dev' }  // Missing payload wrapper

// ✗ Direct error exposure
this.postMessage({ event: 'error', payload: atelierResponse.status.errors[0] });
// Should use ErrorHandler to transform
```

## Project Structure & Boundaries

### Complete Project Directory Structure

> **Note:** The project uses a monorepo structure (Epic 10+). The pre-monorepo flat structure is preserved in `packages/vscode/` for reference. See "Monorepo Structure & Package Boundaries" section above for the full monorepo layout.

```
iris-table-editor/
├── .vscode/
│   ├── launch.json                 # F5 debugging for VS Code extension + Electron
│   ├── tasks.json                  # Build tasks (per-target)
│   └── settings.json               # Workspace settings
├── .github/
│   └── workflows/
│       ├── ci.yml                  # CI pipeline: lint, test, build (both targets)
│       └── release.yml             # Release pipeline: desktop installers + VS Code .vsix
├── packages/
│   ├── core/                       # Shared: services, models, utils
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── services/
│   │       │   ├── AtelierApiService.ts
│   │       │   ├── QueryExecutor.ts
│   │       │   ├── TableMetadataService.ts
│   │       │   ├── ExportService.ts
│   │       │   └── ImportService.ts
│   │       ├── models/
│   │       │   ├── IServerSpec.ts
│   │       │   ├── ITableData.ts
│   │       │   ├── ITableSchema.ts
│   │       │   ├── IAtelierResponse.ts
│   │       │   ├── IMessages.ts
│   │       │   ├── IMessageBridge.ts
│   │       │   ├── IUserError.ts
│   │       │   ├── IColumnTypes.ts
│   │       │   └── IExportImport.ts
│   │       ├── utils/
│   │       │   ├── ErrorHandler.ts
│   │       │   ├── SqlBuilder.ts
│   │       │   ├── UrlBuilder.ts
│   │       │   ├── DataTypeFormatter.ts
│   │       │   ├── DateParser.ts
│   │       │   └── CsvParser.ts
│   │       └── test/
│   │           ├── AtelierApiService.test.ts
│   │           ├── QueryExecutor.test.ts
│   │           ├── SqlBuilder.test.ts
│   │           ├── ErrorHandler.test.ts
│   │           ├── DataTypeFormatter.test.ts
│   │           ├── DateParser.test.ts
│   │           ├── ExportService.test.ts
│   │           ├── ImportService.test.ts
│   │           └── mocks/
│   │               └── atelierResponses.ts
│   ├── webview/                    # Shared: UI assets
│   │   ├── package.json
│   │   └── src/
│   │       ├── webview.html
│   │       ├── styles.css          # BEM with ite- prefix, uses --ite-* vars
│   │       ├── theme.css           # --ite-* variable definitions
│   │       ├── main.js             # AppState, event handlers, grid
│   │       └── KeyboardShortcuts.ts
│   ├── vscode/                     # VS Code extension target
│   │   ├── package.json            # Extension manifest
│   │   ├── tsconfig.json
│   │   ├── esbuild.js
│   │   ├── .vscodeignore
│   │   └── src/
│   │       ├── extension.ts
│   │       ├── providers/
│   │       │   ├── TableEditorProvider.ts
│   │       │   └── ServerConnectionManager.ts
│   │       ├── VSCodeMessageBridge.ts
│   │       └── vscodeThemeBridge.css
│   └── desktop/                    # Electron desktop target
│       ├── package.json
│       ├── tsconfig.json
│       ├── electron-builder.yml
│       └── src/
│           ├── main/
│           │   ├── main.ts
│           │   ├── ipc.ts
│           │   ├── ConnectionManager.ts
│           │   └── WindowManager.ts
│           ├── renderer/
│           │   ├── preload.ts
│           │   ├── ElectronMessageBridge.ts
│           │   └── desktopThemeBridge.css
│           └── ui/
│               ├── connection/     # Server list, server form
│               └── settings/       # App preferences
├── resources/
│   └── icon.png                    # Shared icon
├── package.json                    # Root workspace config
├── tsconfig.base.json              # Shared TypeScript config
├── eslint.config.mjs               # ESLint configuration
├── .prettierrc                     # Prettier configuration
├── .gitignore
├── README.md                       # VS Code extension docs
├── README-desktop.md               # Desktop app docs
├── CHANGELOG.md
└── LICENSE
```

### Architectural Boundaries

**Host ↔ Webview Boundary (Both Targets):**

| Boundary | Protocol | Direction |
|----------|----------|-----------|
| Commands | `IMessageBridge.sendCommand()` | Webview → Host |
| Events | `IMessageBridge.onEvent()` | Host → Webview |
| State | Managed in webview `AppState` | Internal to webview |

The webview never calls `vscode.postMessage()` or `ipcRenderer.send()` directly — it uses the IMessageBridge abstraction.

**VS Code Extension ↔ Server Manager Boundary:**

| Integration Point | Method |
|-------------------|--------|
| Get server list | `serverManagerApi.getServerNames()` |
| Get server spec | `serverManagerApi.getServerSpec(name)` |
| Get credentials | `vscode.authentication.getSession()` |
| Pick server UI | `serverManagerApi.pickServer()` |

**Desktop App ↔ Credential Store Boundary:**

| Integration Point | Method |
|-------------------|--------|
| Save credentials | `safeStorage.encryptString()` → `electron-store` |
| Load credentials | `electron-store` → `safeStorage.decryptString()` |
| Server CRUD | `ConnectionManager.saveServer()` / `.getServers()` / `.deleteServer()` |
| Test connection | `ConnectionManager.testConnection()` → `AtelierApiService` |

**Both Targets ↔ IRIS Boundary:**

| Operation | Endpoint | Method |
|-----------|----------|--------|
| All queries | `/api/atelier/v1/{NAMESPACE}/action/query` | POST |
| Authentication | Basic Auth header | Per-request |

### Requirements to Structure Mapping

**Server Connection (FR1-FR5):**
```
src/providers/ServerConnectionManager.ts  # FR1-FR5: All server operations
src/models/IServerSpec.ts                 # Server data model
```

**Table Navigation (FR6-FR10):**
```
src/providers/TableEditorProvider.ts      # FR6-FR10: Orchestrates navigation
src/services/AtelierApiService.ts         # API calls for namespace/table lists
```

**Data Display (FR11-FR15):**
```
media/webview.html                        # FR11-FR14: Grid structure
media/main.js                             # FR11-FR15: Data rendering, refresh
media/styles.css                          # FR14: Type-aware formatting
```

**Data Editing (FR16-FR20):**
```
media/main.js                             # FR16-FR19: Inline editing UI
src/services/QueryExecutor.ts             # FR17: UPDATE execution
src/utils/SqlBuilder.ts                   # FR17: Query generation
```

**Data Creation (FR21-FR25):**
```
media/main.js                             # FR21-FR24: New row form UI
src/services/QueryExecutor.ts             # FR23: INSERT execution
src/utils/SqlBuilder.ts                   # FR23: Query generation
```

**Data Deletion (FR26-FR30):**
```
media/main.js                             # FR26-FR28: Deletion UI, confirmation
src/services/QueryExecutor.ts             # FR29: DELETE execution
src/utils/SqlBuilder.ts                   # FR29: Query generation
```

**Error Handling (FR31-FR34):**
```
src/utils/ErrorHandler.ts                 # FR31-FR34: All error processing
src/models/IUserError.ts                  # Error structure definition
media/main.js                             # FR33: Error display/dismissal
```

**User Interface (FR35-FR38):**
```
packages/webview/src/styles.css           # FR35-FR36: Theme support (via --ite-* vars)
packages/vscode/package.json              # FR37-FR38: View/command registration
packages/vscode/src/extension.ts          # FR38: Command palette registration
```

**Desktop Connection Management (FR39-FR44):**
```
packages/desktop/src/ui/connection/       # FR39-FR42: Server list and form UI
packages/desktop/src/main/ConnectionManager.ts  # FR39-FR44: Server CRUD + test connection
packages/core/src/services/AtelierApiService.ts # FR43: Test connection uses existing API client
```

**Desktop Window Management (FR45-FR47):**
```
packages/desktop/src/main/WindowManager.ts      # FR45-FR47: Tab management, window state
packages/desktop/src/main/main.ts               # FR45: BrowserWindow creation
```

**Desktop Application Lifecycle (FR48-FR50):**
```
packages/desktop/src/main/WindowManager.ts      # FR48: Window state persistence
packages/desktop/src/main/main.ts               # FR49: Auto-update check on startup
packages/desktop/src/ui/connection/              # FR50: First-run welcome screen
```

### Integration Points

**Internal Communication Flow (Multi-Target):**

```
┌─ VS Code Target ──────────────────────────────────────────────────┐
│  ┌─────────────────┐    ┌──────────────────────────────────────┐  │
│  │ extension.ts    │───►│ TableEditorProvider                   │  │
│  │ (entry point)   │    │  ├─► ServerConnectionManager          │  │
│  └─────────────────┘    │  │    └─► Server Manager API          │  │
│                         │  ├─► @iris-te/core services            │  │
│                         │  └─► ErrorHandler                      │  │
│                         └───────────────┬────────────────────────┘  │
│                                         │ VSCodeMessageBridge       │
│                                         ▼                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              @iris-te/webview (shared UI)                     │   │
│  │   main.js (AppState) ◄─► webview.html ◄─► styles.css         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘

┌─ Desktop Target ──────────────────────────────────────────────────┐
│  ┌─────────────────┐    ┌──────────────────────────────────────┐  │
│  │ main.ts         │───►│ IPC Handlers (ipc.ts)                 │  │
│  │ (Electron main) │    │  ├─► ConnectionManager (safeStorage)   │  │
│  └─────────────────┘    │  ├─► @iris-te/core services            │  │
│                         │  └─► ErrorHandler                      │  │
│                         └───────────────┬────────────────────────┘  │
│                                         │ ElectronMessageBridge     │
│                                         │ (preload + contextBridge) │
│                                         ▼                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              @iris-te/webview (shared UI)                     │   │
│  │   main.js (AppState) ◄─► webview.html ◄─► styles.css         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

**External Integrations:**

| Integration | Package/API | Location | Target |
|-------------|-------------|----------|--------|
| Server Manager | `@intersystems-community/intersystems-servermanager` | ServerConnectionManager.ts | VS Code |
| VS Code Auth | `vscode.authentication` | ServerConnectionManager.ts | VS Code |
| Electron safeStorage | `electron.safeStorage` | ConnectionManager.ts | Desktop |
| electron-store | `electron-store` | ConnectionManager.ts | Desktop |
| electron-updater | `electron-updater` | main.ts | Desktop |
| Atelier REST API | Native fetch | AtelierApiService.ts | Both (shared core) |

**Data Flow (Shared — Both Targets):**

```
User Action (webview)
       │
       ▼ bridge.sendCommand()
┌─────────────────────────┐
│ Host Handler             │  (TableEditorProvider OR Electron IPC)
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  QueryExecutor  │────►│   SqlBuilder     │   ← @iris-te/core (shared)
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│ AtelierApiService │──► fetch() ──► IRIS Server   ← @iris-te/core (shared)
└────────┬────────┘
         │
         ▼ Response
┌─────────────────┐
│  ErrorHandler   │ (if error)   ← @iris-te/core (shared)
└────────┬────────┘
         │
         ▼ bridge.onEvent()
┌─────────────────┐
│    Webview      │──► AppState.update() ──► UI Render   ← @iris-te/webview (shared)
└─────────────────┘
```

### File Organization Patterns

**Configuration Files (Root):**

| File | Purpose |
|------|---------|
| `package.json` | Extension manifest, dependencies, scripts, contribution points |
| `tsconfig.json` | TypeScript config (strict, ES2020, CommonJS) |
| `esbuild.js` | Build configuration for extension bundling |
| `.eslintrc.json` | Linting rules enforcement |
| `.vscodeignore` | Exclude dev files from .vsix package |

**Source Organization (Monorepo):**

| Directory | Contents | Naming |
|-----------|----------|--------|
| `packages/core/src/services/` | Shared business logic, API clients | PascalCase |
| `packages/core/src/models/` | Shared TypeScript interfaces | PascalCase with `I` prefix |
| `packages/core/src/utils/` | Shared utility functions | PascalCase for classes, camelCase for modules |
| `packages/webview/src/` | Shared webview assets | lowercase |
| `packages/vscode/src/providers/` | VS Code extension points | PascalCase |
| `packages/vscode/src/` | VS Code-specific adapters | PascalCase |
| `packages/desktop/src/main/` | Electron main process | PascalCase |
| `packages/desktop/src/renderer/` | Electron renderer adapters | PascalCase |
| `packages/desktop/src/ui/` | Desktop-specific UI screens | lowercase directories |

**Test Organization:**

| Location | Test Type | Naming |
|----------|-----------|--------|
| `packages/core/src/test/*.test.ts` | Shared unit tests | `{ClassName}.test.ts` |
| `packages/core/src/test/mocks/` | Mock data | `{category}.ts` |
| `packages/vscode/src/test/*.test.ts` | VS Code integration tests | `{ClassName}.test.ts` |
| `packages/desktop/src/test/*.test.ts` | Desktop integration tests | `{ClassName}.test.ts` |

### Development Workflow Integration

**Development Server (VS Code):**
- Run `npm run watch --workspace=@iris-te/vscode` for continuous esbuild compilation
- Press F5 to launch Extension Development Host
- Changes to TypeScript require rebuild; webview changes are instant with refresh

**Development Server (Desktop):**
- Run `npm run dev --workspace=@iris-te/desktop` for Electron dev mode with hot reload
- Uses electron-reload or similar for fast iteration
- Changes to webview assets reflect immediately; main process changes require restart

**Build Process:**
```bash
# Shared
npm run compile                              # Build all packages
npm run lint                                 # Lint all packages
npm run test                                 # Test all packages

# VS Code target
npm run compile --workspace=@iris-te/vscode  # esbuild → dist/extension.js
npm run package --workspace=@iris-te/vscode  # vsce package → .vsix

# Desktop target
npm run compile --workspace=@iris-te/desktop # esbuild → dist/
npm run dist --workspace=@iris-te/desktop    # electron-builder → installers
```

**Deployment Structure (VS Code):**
```
.vsix package contains:
├── extension/
│   ├── dist/extension.js    # Bundled extension code
│   ├── media/               # Webview assets (copied from @iris-te/webview)
│   ├── resources/           # Icons
│   ├── package.json         # Manifest
│   └── README.md            # Marketplace description
```

**Deployment Structure (Desktop):**
```
Electron installer contains:
├── app/
│   ├── dist/main.js         # Bundled main process
│   ├── dist/preload.js      # Bundled preload script
│   ├── webview/             # Shared webview assets (from @iris-te/webview)
│   ├── ui/                  # Desktop-specific screens
│   ├── package.json
│   └── node_modules/        # Production dependencies only
├── resources/               # App icon, installer assets
└── electron runtime
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices work together without conflicts:
- Node.js native `fetch` (Node 20+) integrates seamlessly with TypeScript/esbuild
- VS Code WebviewViewProvider with Command/Event pattern follows standard extension architecture
- ErrorHandler class serves as single integration point for all API error processing
- Server Manager dependency is properly declared and authentication flow is clear
- No version conflicts identified between chosen technologies

**Pattern Consistency:**
Implementation patterns fully support architectural decisions:
- File naming (PascalCase/camelCase) applied consistently across all directories
- BEM CSS with `ite-` prefix provides collision-free styling
- Command/Event message format standardizes all extension-webview communication
- IUserError structure ensures uniform error presentation
- Verb prefixes (get/set/build/handle/parse) create predictable API surface

**Structure Alignment:**
Project structure enables all architectural decisions:
- `src/providers/` boundary separates VS Code integration from business logic
- `src/services/` layer isolates API and data operations
- `media/` directory maintains webview asset isolation
- Clear data flow: Provider → Service → API → ErrorHandler → Webview

### Requirements Coverage Validation ✅

**Functional Requirements Coverage (50/50):**

| Category | FRs | Architectural Support |
|----------|-----|----------------------|
| Server Connection | FR1-FR5 | ServerConnectionManager.ts + Server Manager API (VS Code) |
| Table Navigation | FR6-FR10 | AtelierApiService.ts + TableEditorProvider.ts / IPC handlers |
| Data Display | FR11-FR15 | webview.html + main.js + styles.css (shared webview) |
| Data Editing | FR16-FR20 | main.js + QueryExecutor.ts + SqlBuilder.ts (shared core) |
| Data Creation | FR21-FR25 | main.js + QueryExecutor.ts (INSERT) (shared core) |
| Data Deletion | FR26-FR30 | main.js + QueryExecutor.ts (DELETE) (shared core) |
| Error Handling | FR31-FR34 | ErrorHandler.ts + IUserError.ts (shared core) |
| User Interface | FR35-FR38 | styles.css (themes) + package.json (views/commands) |
| Desktop Connection Mgmt | FR39-FR44 | ConnectionManager.ts + connection UI (desktop) |
| Desktop Window Mgmt | FR45-FR47 | WindowManager.ts + tab bar (desktop) |
| Desktop App Lifecycle | FR48-FR50 | WindowManager.ts + electron-updater + welcome screen (desktop) |

**Non-Functional Requirements Coverage (24/24):**

| Category | NFRs | Architectural Support |
|----------|------|----------------------|
| Performance | NFR1-NFR5 | Server-side pagination (50 rows), async fetch, esbuild bundling |
| Security | NFR6-NFR10 | Server Manager auth (VS Code), SqlBuilder parameterization, no credential logging |
| Integration | NFR11-NFR14 | Extension dependency, UrlBuilder encoding (%→%25) |
| Reliability | NFR15-NFR18 | ErrorHandler categorization, AppState consistency |
| Desktop Performance | NFR19-NFR20 | Electron 28+ launch optimization, tree-shaking |
| Desktop Security | NFR21-NFR23 | safeStorage API, context isolation, typed IPC channels |
| Desktop Reliability | NFR24 | electron-store for window state persistence |

### Implementation Readiness Validation ✅

**Decision Completeness:**
- ✅ All critical decisions documented with specific technologies and rationale
- ✅ HTTP client specified (Node.js native fetch, Node 20+)
- ✅ Message format defined with TypeScript interfaces
- ✅ Error codes enumerated with categories
- ✅ Caching strategy specified (1-hour TTL, session-based)

**Structure Completeness:**
- ✅ Complete directory tree with all files named (monorepo layout)
- ✅ All ~15 major components mapped to file locations across 4 packages
- ✅ Integration boundaries clearly defined (Host ↔ IMessageBridge ↔ Webview ↔ IRIS)
- ✅ Requirements mapped to specific files (FR→file matrix, including FR39-FR50)

**Pattern Completeness:**
- ✅ Naming conventions cover files, functions, CSS classes
- ✅ Message formats include concrete interface definitions
- ✅ Error handling flow documented with diagram
- ✅ Good/bad examples provided for each pattern category

### Gap Analysis Results

**Critical Gaps:** None identified

**Important Gaps (Addressable during implementation):**
1. **Loading UI patterns** - Loading states defined but skeleton/spinner patterns not specified
2. **Keyboard accessibility** - Standard webview keyboard support assumed but not explicitly documented

**Nice-to-Have Gaps (Post-MVP refinement):**
1. ESLint configuration rules for pattern enforcement
2. Detailed CSP nonce generation pattern for webview.html
3. Unit test mocking patterns for Server Manager API

### Validation Issues Addressed

No blocking issues found during validation. The architecture is coherent and complete.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed (50 FRs, 24 NFRs)
- [x] Scale and complexity assessed (Medium, ~15 components)
- [x] Technical constraints identified (Atelier API, Server Manager dependency)
- [x] Cross-cutting concerns mapped (auth, errors, theming, parameterized queries)

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions (fetch, Node 20+)
- [x] Technology stack fully specified (TypeScript, esbuild, VS Code 1.85+)
- [x] Integration patterns defined (Command/Event, Server Manager API)
- [x] Performance considerations addressed (pagination, caching)

**✅ Implementation Patterns**

- [x] Naming conventions established (file, function, CSS)
- [x] Structure patterns defined (directory organization, test placement)
- [x] Communication patterns specified (ICommand, IEvent interfaces)
- [x] Process patterns documented (error flow, loading states, logging)

**✅ Project Structure**

- [x] Complete directory structure defined (20+ files mapped)
- [x] Component boundaries established (providers/services/utils)
- [x] Integration points mapped (Server Manager, Atelier API)
- [x] Requirements to structure mapping complete (FR→file)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High - based on comprehensive validation results

**Key Strengths:**
- Clear separation of concerns between host and webview via IMessageBridge abstraction
- Single source of truth for error handling (ErrorHandler class in shared core)
- Type-safe message passing with concrete interfaces (same types, both targets)
- Security-first design (no credential storage in extension state; OS keychain for desktop)
- Aligned with existing InterSystems ecosystem (Server Manager integration for VS Code)
- ~80% code reuse between targets via monorepo shared packages
- Theme abstraction layer enables consistent styling across both targets

**Areas for Future Enhancement:**
- Virtual scrolling for very large datasets (1000+ rows)
- Offline mode / connection recovery
- Query builder for custom SELECT statements
- Multi-window support for desktop (multiple independent windows)

**Growth Phase Features (Complete):**
- Data Type Polish (Epic 7): Type-appropriate controls for boolean, date, time, numeric, NULL
- Keyboard Shortcuts (Epic 8): Full keyboard navigation and editing
- Export/Import (Epic 9): CSV/Excel export and import with validation

**Desktop Phase Features (Planned):**
- Monorepo Restructure (Epic 10): npm workspaces, shared core/webview extraction
- Electron Shell (Epic 11): Main process, IPC bridge, tabs, native menus
- Connection Manager (Epic 12): Server CRUD, test connection, safeStorage credentials
- Build & Distribution (Epic 13): electron-builder, auto-update, CI/CD
- Feature Parity & Testing (Epic 14): Cross-platform verification, polish

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect package boundaries (see Package Dependency Rules)
- Use IMessageBridge for all webview↔host communication — never raw postMessage or ipcRenderer
- Use `--ite-*` CSS variables in shared styles — never `--vscode-*` directly
- Refer to this document for all architectural questions
- Prioritize security patterns (parameterized queries, no credential logging, context isolation)

**Next Implementation Priority (Epic 10 — Monorepo Restructure):**
1. Initialize monorepo with npm workspaces root package.json
2. Create packages/core with extracted services, models, utils
3. Create packages/webview with extracted UI assets and theme abstraction
4. Create packages/vscode with remaining VS Code-specific code
5. Verify VS Code extension builds and functions identically

