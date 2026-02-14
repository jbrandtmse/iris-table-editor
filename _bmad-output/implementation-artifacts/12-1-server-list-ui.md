# Story 12.1: Server List UI

Status: done

## Story

As a **user**,
I want **to see a list of my saved IRIS server connections**,
so that **I can choose which server to work with**.

## Acceptance Criteria

1. **Given** the desktop application launches, **When** I have no saved servers, **Then** I see a first-run welcome screen with "Add Your First Server" button

2. **Given** I have saved servers, **When** the application launches, **Then** I see a server list in the sidebar showing each server with:
   - Status indicator (connected/disconnected)
   - Server name
   - Optional description
   - Host:port

3. **Given** I see the server list, **When** I click on a server, **Then** the server is highlighted as selected **And** Edit and Delete actions become available

4. **Given** I see the server list, **When** I double-click a server, **Then** the application connects to that server **And** namespaces load in the sidebar below

5. **Given** I right-click a server, **When** the context menu opens, **Then** I see: Connect, Edit, Delete, Test Connection

## Tasks / Subtasks

- [x] Task 1: Create packages/desktop package skeleton (AC: all)
  - [x] 1.1: Create `packages/desktop/` directory structure per architecture:
    ```
    packages/desktop/
    ├── package.json       # @iris-te/desktop
    ├── tsconfig.json
    └── src/
        ├── main/          # Electron main process code (future)
        │   └── ConnectionManager.ts  # Server CRUD + persistence
        └── ui/
            └── connection/  # Server list, server form components
    ```
  - [x] 1.2: Create `packages/desktop/package.json` with name `@iris-te/desktop`, dependencies on `@iris-te/core`
  - [x] 1.3: Create `packages/desktop/tsconfig.json`
  - [x] 1.4: Update root `package.json` workspaces to include `packages/desktop`
  - [x] 1.5: Run `npm install` to link the new workspace

- [x] Task 2: Create ConnectionManager service (AC: 1, 2)
  - [x] 2.1: Create `packages/desktop/src/main/ConnectionManager.ts`
  - [x] 2.2: Implement ServerConfig interface (name, hostname, port, pathPrefix, username, description, ssl, encryptedPassword)
  - [x] 2.3: Implement CRUD methods: `getServers()`, `getServer(name)`, `saveServer()`, `updateServer()`, `deleteServer()`, `getServerCount()`
  - [x] 2.4: For now, use a simple JSON file store (NOT electron-store yet, since we don't have Electron installed). Story 12.4 will add safeStorage encryption.
  - [x] 2.5: Passwords stored in plaintext temporarily (Story 12.4 adds encryption)
  - [x] 2.6: Add validation: unique server names, required fields

- [x] Task 3: Create server list HTML/CSS/JS component (AC: 1, 2, 3, 5)
  - [x] 3.1: Create `packages/desktop/src/ui/connection/server-list.html` — server list sidebar markup
  - [x] 3.2: Create `packages/desktop/src/ui/connection/server-list.css` — server list styles using `--ite-*` CSS variables
  - [x] 3.3: Create `packages/desktop/src/ui/connection/server-list.js` — server list behavior:
    - Render server list from data
    - Welcome screen when empty (AC: 1)
    - Click to select (AC: 3)
    - Double-click to connect (AC: 4)
    - Right-click context menu (AC: 5)
    - Status indicator (connected/disconnected)
  - [x] 3.4: Follow existing webview patterns: BEM CSS (`.ite-*`), event delegation, `escapeHtml()` for XSS prevention

- [x] Task 4: Create welcome/empty state component (AC: 1)
  - [x] 4.1: Welcome screen with "Add Your First Server" button
  - [x] 4.2: Brief description of what the app does
  - [x] 4.3: Visually clean and inviting for first-run experience

- [x] Task 5: Wire IMessageBridge communication (AC: 3, 4, 5)
  - [x] 5.1: Define connection manager message types in IMessages or a new interface file:
    - Commands: `getServers`, `selectServer`, `connectServer`, `editServer`, `deleteServer`, `testConnection`
    - Events: `serversLoaded`, `serverSelected`, `connectionStatus`, `serverDeleted`
  - [x] 5.2: Server list JS uses `messageBridge.sendCommand()` for all host communication
  - [x] 5.3: Server list JS uses `messageBridge.onEvent()` to receive server data updates

- [x] Task 6: Write tests (AC: all)
  - [x] 6.1: Unit tests for ConnectionManager service (CRUD operations, validation)
  - [x] 6.2: Tests should be in `packages/desktop/src/test/` or similar

- [x] Task 7: Validate (AC: all)
  - [x] 7.1: Run `npm run compile` — all packages compile
  - [x] 7.2: Run `npm run lint` — no new lint errors
  - [x] 7.3: Run `npm run test` — all tests pass
  - [x] 7.4: Verify packages/desktop has no `vscode` imports

## Dev Notes

### Architecture Context

**packages/desktop/** is a new workspace package for the Electron desktop application. In Epic 12, we build the connection manager service and UI components. Epic 11 will later add the Electron shell (BrowserWindow, IPC, preload, etc.) that hosts these components.

**ConnectionManager** (from architecture.md):
```typescript
// packages/desktop/src/main/ConnectionManager.ts
interface ServerConfig {
  name: string;
  hostname: string;
  port: number;
  namespace: string;
  username: string;
  encryptedPassword: string;  // Will be encrypted in Story 12.4
  ssl: boolean;
}
```

**Package dependency rules** (architecture.md):
| Package | Can Import From | Cannot Import From |
|---------|----------------|--------------------|
| `@iris-te/desktop` | `@iris-te/core`, `@iris-te/webview`, `electron` | `vscode` |

### Important Design Decisions

1. **No Electron yet**: packages/desktop does NOT have Electron as a dependency in this story. The ConnectionManager service uses plain Node.js file I/O for persistence (JSON file). Story 12.4 adds electron-specific `safeStorage` for credentials. Epic 11 adds the full Electron shell.

2. **UI components are standalone HTML/CSS/JS**: Like the webview package, the connection UI components are rendered HTML/CSS/JS that will be loaded into a BrowserWindow later. Use the same `--ite-*` CSS variable system and IMessageBridge pattern.

3. **IMessageBridge pattern**: The connection manager UI communicates via IMessageBridge, same as the grid webview. The desktop's Electron main process will handle these commands via IPC handlers (built in Epic 11).

4. **Testing approach**: Since there's no Electron dependency yet, the ConnectionManager can be tested with plain Node.js test runner (mocha/assert).

### Previous Story Intelligence

- Package scope: `@iris-te/*` (from Epic 10)
- IMessageBridge interface in `@iris-te/core` with sendCommand, onEvent, offEvent, getState, setState
- CSS variables use `--ite-*` prefix
- BEM CSS with `.ite-` prefix
- Event delegation pattern in webview JS
- escapeHtml()/escapeAttr() for XSS prevention

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Electron Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Credential Storage (Desktop)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Monorepo Structure & Package Boundaries]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.1: Server List UI]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- All 41 ConnectionManager unit tests pass (node:test runner)
- Full workspace compile (core, desktop, vscode) succeeds
- Full workspace lint passes with zero warnings/errors
- All 241 existing vscode tests pass (no regressions)
- Verified zero `vscode` imports in packages/desktop

### Completion Notes List
- Created `packages/desktop` workspace package with `@iris-te/desktop` name, TypeScript config matching core patterns
- Root `package.json` already uses `packages/*` glob, so no edit needed for workspace discovery
- `ConnectionManager` implements full CRUD with JSON file persistence, validation for required fields (name, hostname, port, username), unique name enforcement, port range (1-65535), and ssl boolean check
- `ServerConfig` interface includes all spec'd fields plus optional `namespace`, `description`, `pathPrefix`
- Passwords stored in plaintext `encryptedPassword` field per story spec (Story 12.4 adds encryption)
- All getters return defensive copies to prevent external mutation of internal state
- Server list UI follows existing webview patterns: IIFE wrapper, BEM CSS with `.ite-*` prefix, `--ite-*` CSS variables, event delegation on container, `escapeHtml()`/`escapeAttr()` for XSS prevention, ARIA live region for screen reader announcements
- Welcome screen (AC 1) renders when `servers.length === 0` with "Add Your First Server" button and app description
- Server list (AC 2) shows status indicator (connected/disconnected dot), server name, optional description, host:port
- Single click selects server and shows edit/delete actions (AC 3)
- Double click detected via timestamp comparison (400ms threshold) sends `connectServer` command (AC 4)
- Right-click context menu with Connect, Edit, Delete, Test Connection (AC 5) with keyboard nav support
- Desktop message types added to `@iris-te/core` IMessages.ts: `IDesktopServerInfo`, `IDesktopServersLoadedPayload`, `IDesktopServerDeletedPayload`, `IDesktopServerNamePayload`, `DesktopConnectionCommand`, `DesktopConnectionEvent`
- Tests use Node.js built-in test runner (`node:test`) with `describe`/`it`/`beforeEach`/`afterEach`, temp directory per test, cleanup in afterEach
- Test script uses `node --test dist/test/**/*.test.js` to run compiled test output

### File List
- `packages/desktop/package.json` (new)
- `packages/desktop/tsconfig.json` (new)
- `packages/desktop/src/index.ts` (new)
- `packages/desktop/src/main/ConnectionManager.ts` (new)
- `packages/desktop/src/ui/connection/server-list.html` (new)
- `packages/desktop/src/ui/connection/server-list.css` (new)
- `packages/desktop/src/ui/connection/server-list.js` (new)
- `packages/desktop/src/test/connectionManager.test.ts` (new)
- `packages/core/src/models/IMessages.ts` (modified - added desktop message types)
- `packages/core/src/index.ts` (modified - exported desktop message types)
- `package.json` (modified - updated root test script to include desktop tests) [review fix]

### Change Log
- 2026-02-13: Story 12.1 implementation complete - created packages/desktop with ConnectionManager service, server list UI, message types, and 41 unit tests
- 2026-02-13: Code review complete - 3 MEDIUM, 3 LOW findings. All MEDIUM auto-fixed. See review notes below.

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 (Code Review Agent)
**Date:** 2026-02-13
**Verdict:** PASS (all HIGH/MEDIUM issues auto-resolved)

### Git vs Story Discrepancies
- `package-lock.json` modified but not in File List (expected, auto-generated)
- `_bmad-output/implementation-artifacts/epic-cycle-log.md` and `sprint-status.yaml` modified (pipeline files, not story code)
- Root `package.json` NOT listed in File List but was affected by test script update (review fix, not original implementation)

### Acceptance Criteria Verification
| AC | Status | Evidence |
|----|--------|----------|
| AC 1 - Welcome screen | IMPLEMENTED | `renderWelcome()` in server-list.js, conditional on `servers.length === 0`, includes "Add Your First Server" button |
| AC 2 - Server list display | IMPLEMENTED | `renderServerList()` renders status dot, name, description, host:port |
| AC 3 - Click to select | IMPLEMENTED | `handleServerClick()` sets `selectedServer` state, `--selected` class shows edit/delete actions |
| AC 4 - Double-click connect | IMPLEMENTED | Timestamp-based double-click detection (400ms), sends `connectServer` command |
| AC 5 - Context menu | IMPLEMENTED | Right-click handler, context menu with Connect/Edit/Delete/Test Connection, keyboard nav |

### Task Audit
All 7 tasks and 25 subtasks verified as correctly marked [x]. Implementation matches claimed completion.

### Findings

**MEDIUM-1: Missing null guard on `handleServerClick` calls (FIXED)**
- `server-list.js` lines 425, 475: `getAttribute('data-server')` returns `string|null` but was passed directly to `handleServerClick()` without null check. Context menu handler (line 450) correctly checked for null; click and keyboard handlers did not.
- Fix: Added null guard before calling `handleServerClick()` in both click delegation and keyboard event handlers.

**MEDIUM-2: Config file written with default permissions (FIXED)**
- `ConnectionManager.ts` `saveToDisk()`: `servers.json` containing passwords (plaintext per story spec) was written with default OS permissions. On multi-user systems, other users could read the file.
- Fix: Added `mode: 0o600` (owner read/write only) to `writeFileSync` options.

**MEDIUM-3: Root test script excludes desktop tests (FIXED)**
- Root `package.json` `test` script only ran `packages/vscode` tests. Desktop's 41 tests required a separate manual invocation and would not run in CI.
- Fix: Updated root `test` script to chain `packages/desktop` tests after vscode tests.

**LOW-1: `loadFromDisk` does not validate individual server entries (NOT FIXED)**
- When loading from disk, only the store structure (version + servers array) is validated. Individual server entries are not validated against `ServerConfig` requirements. A manually edited or corrupted JSON file could load invalid entries.
- Rationale for not fixing: Risk is low since the file is under user control, and all mutations go through `validateConfig()`. A future hardening story could add entry-level validation on load.

**LOW-2: Synchronous file I/O in ConnectionManager (NOT FIXED)**
- All file operations (`readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync`) are synchronous. For a small config file in Electron main process context this is acceptable.
- Rationale: Story explicitly says "use plain Node.js file I/O." Async conversion is not required for this story's scope.

**LOW-3: Extra properties not stripped from saved config (NOT FIXED)**
- `saveServer` uses `{ ...config }` spread which copies all enumerable properties, potentially persisting properties not in the `ServerConfig` interface. TypeScript types are erased at runtime.
- Rationale: Low risk since callers are typed. Could be addressed in a future hardening pass by picking only known fields.

### Post-Fix Validation
- `npm run compile` - PASS (all 3 workspace packages)
- `npm run lint` - PASS (zero warnings/errors)
- `npm run test` - PASS (241 vscode + 41 desktop = 282 tests, 0 failures)
