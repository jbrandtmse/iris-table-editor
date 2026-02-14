# Story 12.2: Server Form

Status: review

## Story

As a **user**,
I want **to add and edit server connection details through a form**,
so that **I can configure how the application connects to my IRIS servers**.

## Acceptance Criteria

1. **Given** I click "Add" ([+]) in the server list, **When** the form opens, **Then** I see fields for: Server Name (required, unique), Description (optional), Host (required), Port (required, default 52773), Path Prefix (optional), Use HTTPS (checkbox), Username (required), Password (required, masked)

2. **Given** I fill all required fields and click "Save", **When** validation passes, **Then** the server is added to the list **And** the form closes **And** the new server appears in the sidebar

3. **Given** I leave required fields empty, **When** I click "Save", **Then** validation errors appear on empty fields **And** the form is not submitted

4. **Given** I enter a server name that already exists, **When** I click "Save", **Then** I see error "A server with this name already exists" **And** the form is not submitted

5. **Given** I select an existing server and click "Edit", **When** the form opens, **Then** all fields are pre-populated with current values **And** the password field shows dots (masked)

6. **Given** I am in the form, **When** I click "Cancel", **Then** the form closes without saving **And** no changes are applied

## Tasks / Subtasks

- [x] Task 1: Create server form HTML/CSS component (AC: 1, 5)
  - [x] 1.1: Create `packages/desktop/src/ui/connection/server-form.html` — form markup with all fields
  - [x] 1.2: Create `packages/desktop/src/ui/connection/server-form.css` — form styles using `--ite-*` CSS variables, BEM naming
  - [x] 1.3: Include all form fields: name, description, host, port, pathPrefix, ssl (checkbox), username, password
  - [x] 1.4: Default port value: 52773
  - [x] 1.5: Password field uses `type="password"` for masking
  - [x] 1.6: Save and Cancel buttons at bottom of form

- [x] Task 2: Create server form JS behavior (AC: 1, 2, 3, 4, 5, 6)
  - [x] 2.1: Create `packages/desktop/src/ui/connection/server-form.js` — form behavior
  - [x] 2.2: Implement `openAddForm()` — opens empty form for new server
  - [x] 2.3: Implement `openEditForm(serverConfig)` — opens form pre-populated with server data
  - [x] 2.4: Implement `closeForm()` — closes form without saving (Cancel, AC: 6)
  - [x] 2.5: Implement client-side validation: required fields (name, host, port, username, password for add; name, host, port, username for edit)
  - [x] 2.6: Show inline validation errors on empty required fields (AC: 3)
  - [x] 2.7: On save: collect form data, send via IMessageBridge `sendCommand('saveServer', data)` or `sendCommand('updateServer', data)`
  - [x] 2.8: Handle `serverSaved` and `serverSaveError` events from host
  - [x] 2.9: On duplicate name error, show error message on name field (AC: 4)
  - [x] 2.10: Follow existing patterns: IIFE, event delegation, `escapeHtml()`/`escapeAttr()` for XSS

- [x] Task 3: Wire form into server list UI (AC: 1, 5)
  - [x] 3.1: Update `server-list.js` to open add form when "Add Your First Server" or [+] button is clicked
  - [x] 3.2: Update `server-list.js` to open edit form when "Edit" is selected (context menu or action button)
  - [x] 3.3: After successful save, refresh server list via `getServers` command

- [x] Task 4: Add form message types (AC: 2, 4)
  - [x] 4.1: Add `saveServer` and `updateServer` command types to desktop message types in `@iris-te/core`
  - [x] 4.2: Add `serverSaved`, `serverSaveError` event types
  - [x] 4.3: Export new types from `@iris-te/core`

- [x] Task 5: Write tests (AC: all)
  - [x] 5.1: Test form validation logic (required fields, error display)
  - [x] 5.2: Test form open/close behavior
  - [x] 5.3: Test form pre-population for edit mode
  - [x] 5.4: Tests in `packages/desktop/src/test/`

- [x] Task 6: Validate (AC: all)
  - [x] 6.1: Run `npm run compile` — all packages compile
  - [x] 6.2: Run `npm run lint` — no new lint errors
  - [x] 6.3: Run `npm run test` — all tests pass
  - [x] 6.4: Verify packages/desktop has no `vscode` imports

## Dev Notes

### Architecture Context

The server form is a UI component in `packages/desktop/src/ui/connection/`. It will be loaded into a BrowserWindow alongside the server list (Epic 11). For now, it's standalone HTML/CSS/JS following the same patterns as `server-list.js`.

**IMessageBridge pattern**: The form communicates with the host (future Electron main process) via IMessageBridge. Save operations send commands; results come back as events.

### Important Design Decisions

1. **Form as overlay/panel**: The form should overlay or replace the server list area when opened. When closed, the server list returns. The exact visual approach (modal vs panel slide) is flexible — keep it simple.

2. **Password handling in edit mode**: When editing, the password field should show placeholder dots but NOT contain the actual password (since ConnectionManager stores it encrypted/plaintext separately). If the user doesn't change the password field, the existing password is preserved. If they enter a new value, it replaces the stored password.

3. **Client-side validation only**: This story handles client-side validation (required fields, format). The ConnectionManager already validates unique names on save — so duplicate name errors come back via `serverSaveError` event.

4. **No Electron dependency**: Same as Story 12.1 — plain HTML/CSS/JS, no Electron APIs.

### Previous Story Intelligence (12.1)

**Story 12.1 established:**
- `packages/desktop/` package with `@iris-te/desktop` name
- `ConnectionManager` service at `packages/desktop/src/main/ConnectionManager.ts` with `saveServer()`, `updateServer()`, `getServer()`, `getServers()`, `deleteServer()`, `getServerCount()`, `validateConfig()`
- `ServerConfig` interface: `{ name, hostname, port, username, encryptedPassword, ssl, namespace?, description?, pathPrefix? }`
- Server list UI at `packages/desktop/src/ui/connection/server-list.{html,css,js}`
- Desktop message types in `@iris-te/core` IMessages.ts: `DesktopConnectionCommand`, `DesktopConnectionEvent`
- BEM CSS with `.ite-*` prefix, `--ite-*` CSS variables
- Event delegation, `escapeHtml()`/`escapeAttr()` for XSS prevention
- IMessageBridge for host communication (`sendCommand`, `onEvent`)
- 41 ConnectionManager unit tests + 241 vscode tests = 282 total
- Node.js built-in test runner (`node:test`)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Electron Architecture]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.2: Server Form]
- [Source: 12-1-server-list-ui.md — Previous story implementation]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
N/A - No debug issues encountered during implementation.

### Completion Notes List

- **Task 1 (HTML/CSS):** Created server-form.html with all 8 form fields (name, description, hostname, port, pathPrefix, ssl checkbox, username, password). Form uses overlay pattern with dialog role for accessibility. Created server-form.css with BEM naming (.ite-form__*), --ite-* CSS variables, error states, and visually-hidden utility for screen readers. Default port value is 52773. Password field uses type="password" for masking.

- **Task 2 (JS behavior):** Created server-form.js as an IIFE following server-list.js patterns. Implements openAddForm(), openEditForm(serverConfig), closeForm(). Client-side validation differentiates between add mode (password required) and edit mode (password optional). Inline validation errors appear on each field. Save sends saveServer/updateServer commands via IMessageBridge. Handles serverSaved (closes form, refreshes list) and serverSaveError (shows field-specific or generic error). Escape key closes form. Password field shows bullet placeholder in edit mode. Exposed window.iteServerForm API for integration.

- **Task 3 (Integration):** Updated server-list.html to inline the form overlay markup and include server-form.css/js. Updated server-list.js: [+] button and "Add Your First Server" button now call window.iteServerForm.openAddForm() directly. Edit via context menu still sends editServer command to host, which responds with serverConfigLoaded event; server-list.js listens for this and calls openEditForm(). Added serverSaved listener to refresh server list after save.

- **Task 4 (Message types):** Added to IMessages.ts: IDesktopSaveServerPayload, IDesktopUpdateServerPayload, IDesktopServerSavedPayload, IDesktopServerSaveErrorPayload, IDesktopServerConfigPayload interfaces. Extended DesktopConnectionCommand with saveServer/updateServer. Extended DesktopConnectionEvent with serverSaved/serverSaveError/serverConfigLoaded. All types exported from @iris-te/core index.ts.

- **Task 5 (Tests):** Created serverForm.test.ts with 46 tests covering: validation logic for add/edit modes (13 + 5 tests), form data collection (5 + 3 tests), form state management (5 tests), pre-population for edit mode (4 tests), XSS prevention (2 tests), error display (4 tests), message type payloads (5 tests). All tests use Node.js built-in test runner.

- **Task 6 (Validation):** All packages compile successfully. No lint errors. Full test suite passes: 241 VS Code tests + 87 desktop tests (41 existing + 46 new) = 328 total. No vscode imports in desktop package.

- **Design Decision:** Added serverConfigLoaded event type (not in original story spec) to support the edit form flow. When user clicks "Edit" on a server, the host looks up the full server config and sends it back via serverConfigLoaded event, which the server-form.js then uses to open the edit form pre-populated.

- **Design Decision:** Form overlay uses position:fixed with full viewport coverage, replacing the server list view area when open. This follows the story's "overlay or replace" guidance with the simplest approach.

- **Design Decision:** In edit mode, the password required indicator (*) is hidden and the password field shows bullet placeholder characters instead of the actual password. An empty password on save means "keep existing password."

### File List
- `packages/desktop/src/ui/connection/server-form.html` (new) - Form markup with all fields
- `packages/desktop/src/ui/connection/server-form.css` (new) - Form styles with BEM naming and CSS variables
- `packages/desktop/src/ui/connection/server-form.js` (new) - Form behavior: open/close, validation, save, events
- `packages/desktop/src/ui/connection/server-list.html` (modified) - Inlined form overlay, added form CSS/JS refs
- `packages/desktop/src/ui/connection/server-list.js` (modified) - Wired add/edit buttons to form, added event listeners
- `packages/core/src/models/IMessages.ts` (modified) - Added message types for form commands/events
- `packages/core/src/index.ts` (modified) - Exported new message types
- `packages/desktop/src/test/serverForm.test.ts` (new) - 46 unit tests for form logic
