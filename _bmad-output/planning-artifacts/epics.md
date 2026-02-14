---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
status: complete
completedAt: '2026-01-27'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# iris-table-editor - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for iris-table-editor, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Server Connection (FR1-FR5)**
- FR1: User can view a list of available IRIS servers from Server Manager
- FR2: User can select an IRIS server to connect to
- FR3: User can authenticate with the selected server using Server Manager credentials
- FR4: User can see the current connection status (connected/disconnected)
- FR5: User can disconnect from the current server

**Table Navigation (FR6-FR10)**
- FR6: User can view a list of namespaces available on the connected server
- FR7: User can select a namespace to browse
- FR8: User can view a list of tables within the selected namespace
- FR9: User can select a table to view its data
- FR10: User can refresh the table list

**Data Display (FR11-FR15)**
- FR11: User can view table data in an Excel-like grid format
- FR12: User can see column headers with column names
- FR13: User can scroll through table rows
- FR14: User can see data formatted appropriately for its type (text, numbers, dates)
- FR15: User can refresh table data to see latest changes

**Data Editing (FR16-FR20)**
- FR16: User can edit a cell value by clicking/double-clicking on it
- FR17: User can save changes to a single cell (UPDATE operation)
- FR18: User can cancel an edit before saving
- FR19: User can see visual feedback when a cell has unsaved changes
- FR20: System confirms successful save operations

**Data Creation (FR21-FR25)**
- FR21: User can initiate creation of a new row
- FR22: User can enter values for each column in the new row
- FR23: User can save the new row (INSERT operation)
- FR24: User can cancel new row creation before saving
- FR25: System validates required fields before saving

**Data Deletion (FR26-FR30)**
- FR26: User can select a row for deletion
- FR27: User can confirm deletion before it executes
- FR28: User can cancel deletion at confirmation prompt
- FR29: System executes DELETE operation upon confirmation
- FR30: System confirms successful deletion

**Error Handling (FR31-FR34)**
- FR31: System displays error messages that identify the failed operation and suggest resolution steps
- FR32: System shows specific error context (which operation failed and why)
- FR33: User can dismiss error notifications
- FR34: System prevents operations that would violate database constraints (with messages identifying the specific constraint violated)

**User Interface (FR35-FR38)**
- FR35: Extension displays correctly in VS Code light theme
- FR36: Extension displays correctly in VS Code dark theme
- FR37: User can access the table editor from VS Code sidebar
- FR38: User can access the table editor via command palette

**Desktop Connection Management (FR39-FR44) — Desktop Target**
- FR39: User can view a list of saved server connections
- FR40: User can add a new server connection with name, host, port, credentials
- FR41: User can edit an existing server connection
- FR42: User can delete a server connection with confirmation
- FR43: User can test a server connection before saving
- FR44: User can connect/disconnect from a saved server

**Desktop Window Management (FR45-FR47) — Desktop Target**
- FR45: User can open multiple tables as tabs within the application window
- FR46: User can switch between open table tabs
- FR47: User can close table tabs (with unsaved changes prompt)

**Desktop Application Lifecycle (FR48-FR50) — Desktop Target**
- FR48: Application remembers window position, size, and state across sessions
- FR49: Application checks for and installs updates automatically
- FR50: Application shows a first-run welcome screen when no servers are configured

### NonFunctional Requirements

**Performance (NFR1-NFR5)**
- NFR1: Table data loads within 2 seconds for tables with <500 rows
- NFR2: Cell edit save operations complete within 1 second
- NFR3: Table list and namespace list load within 1 second
- NFR4: UI interactions respond within 100ms during background data operations (no blocking)
- NFR5: Extension activation adds less than 50ms to VS Code activation time

**Security (NFR6-NFR10)**
- NFR6: Credentials are never stored in extension state or settings
- NFR7: Credentials are obtained exclusively via Server Manager authentication provider
- NFR8: All SQL operations use parameterized queries (no string concatenation)
- NFR9: No sensitive data (passwords, tokens) appears in extension logs
- NFR10: HTTPS is used when available for server connections

**Integration (NFR11-NFR14)**
- NFR11: Extension gracefully handles Server Manager extension not being installed
- NFR12: Extension remains functional across Server Manager version updates
- NFR13: Extension properly encodes namespace names for Atelier API (% → %25)
- NFR14: Extension handles Atelier API version differences gracefully

**Reliability (NFR15-NFR18)**
- NFR15: Failed operations display clear, actionable error messages
- NFR16: Partial failures do not corrupt data or leave UI in inconsistent state
- NFR17: Network disconnection is detected and reported to user
- NFR18: Extension recovers gracefully from server connection loss

**Desktop Performance (NFR19-NFR20) — Desktop Target**
- NFR19: Desktop application launches in under 3 seconds on standard hardware
- NFR20: Installer size is under 200MB

**Desktop Security (NFR21-NFR23) — Desktop Target**
- NFR21: Credentials are encrypted using Electron safeStorage API (OS keychain)
- NFR22: Renderer process runs with context isolation and sandbox enabled
- NFR23: All IPC messages use typed channels (no arbitrary code execution)

**Desktop Reliability (NFR24) — Desktop Target**
- NFR24: Window state (position, size, sidebar width) persists across sessions via electron-store

### Additional Requirements

**From Architecture - Starter Template & Technology Stack**
- AR1: Initialize project using yo code (Yeoman) VS Code extension generator with TypeScript and esbuild
- AR2: Use Node.js native fetch (Node 20+) for HTTP client
- AR3: Implement Command/Event pattern for extension-webview communication with typed payloads
- AR4: Create centralized ErrorHandler class for all error processing
- AR5: Implement session-based metadata caching with 1-hour TTL
- AR6: Use server-side pagination with 50 rows default page size
- AR7: Enforce parameterized queries via SqlBuilder utility (no string concatenation)
- AR8: Follow file naming conventions: PascalCase for classes, camelCase for utilities
- AR9: Use BEM CSS naming with `ite-` prefix for all custom styles
- AR10: Implement project structure per architecture (providers/, services/, models/, utils/, media/)

**From Architecture - Security Requirements**
- AR11: Obtain credentials exclusively via vscode.authentication.getSession() with Server Manager provider
- AR12: Never log sensitive data (passwords, tokens) in extension logs
- AR13: Use LOG_PREFIX '[IRIS-TE]' for all console logging

**From UX - Interaction Requirements**
- UX1: Sidebar panel for server/namespace/table navigation, editor tabs for grid editing
- UX2: Excel-like interaction model: double-click to edit, Tab to save + move right, Enter to save + move down
- UX3: Escape key cancels edit and restores original value
- UX4: Visual cell states: selected (2px border), editing (input field), modified (tinted background), saving (pulse), saved (green flash 200ms), error (red border)
- UX5: Context bar showing breadcrumb: server > namespace > table
- UX6: Toolbar with icon buttons: Refresh, Add Row, Delete Row
- UX7: Empty row at bottom of grid for new row insertion (Access pattern)
- UX8: Pagination bar with row count and prev/next buttons

**From UX - Accessibility Requirements**
- UX9: WCAG 2.1 AA compliance
- UX10: Full keyboard navigation: Arrow keys for cell movement, Tab/Shift+Tab for save+navigate, F2 to edit
- UX11: ARIA roles and labels on grid (role="grid", role="gridcell", aria-selected, aria-invalid)
- UX12: Focus indicators visible at all times (2px solid border)
- UX13: Support VS Code High Contrast theme
- UX14: Respect prefers-reduced-motion for animations

**From UX - Responsive Requirements**
- UX15: Minimum usable panel width: 300px
- UX16: Horizontal scroll for grid when columns exceed panel width
- UX17: Context bar truncates with ellipsis, full text in tooltip
- UX18: Toolbar collapses to icons at narrow widths

**From Architecture - Desktop Target Requirements**
- AR14: Monorepo structure with packages/core, packages/webview, packages/vscode, packages/desktop
- AR15: IMessageBridge abstraction for webview↔host communication (VS Code and Electron implementations)
- AR16: Theme abstraction layer with `--ite-*` CSS variables and per-target bridge CSS
- AR17: Electron main process with context isolation, sandbox, and preload script
- AR18: safeStorage-based credential encryption for desktop connection manager
- AR19: electron-store for persistent settings (window state, theme preference, connection list)
- AR20: electron-builder for Windows .exe and macOS .dmg packaging
- AR21: electron-updater for auto-update via GitHub Releases

**From UX - Desktop Target Requirements**
- UX19: Connection Manager with server list, add/edit/delete server form, test connection
- UX20: First-run welcome screen when no servers configured
- UX21: Desktop navigation layout with sidebar + tab bar
- UX22: Native menu bar (File, Edit, View, Help)
- UX23: Light/dark theme toggle (desktop target)
- UX24: Window state persistence (position, size, sidebar width)

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | View list of IRIS servers from Server Manager |
| FR2 | Epic 1 | Select an IRIS server to connect to |
| FR3 | Epic 1 | Authenticate with Server Manager credentials |
| FR4 | Epic 1 | See connection status (connected/disconnected) |
| FR5 | Epic 1 | Disconnect from current server |
| FR6 | Epic 1 | View list of namespaces |
| FR7 | Epic 1 | Select a namespace to browse |
| FR8 | Epic 1 | View list of tables in namespace |
| FR9 | Epic 1 | Select a table to view data |
| FR10 | Epic 1 | Refresh table list |
| FR11 | Epic 2 | View table data in Excel-like grid |
| FR12 | Epic 2 | See column headers with names |
| FR13 | Epic 2 | Scroll through table rows |
| FR14 | Epic 2 | Data formatted by type |
| FR15 | Epic 2 | Refresh table data |
| FR16 | Epic 3 | Edit cell by clicking/double-clicking |
| FR17 | Epic 3 | Save cell changes (UPDATE) |
| FR18 | Epic 3 | Cancel edit before saving |
| FR19 | Epic 3 | Visual feedback for unsaved changes |
| FR20 | Epic 3 | System confirms successful save |
| FR21 | Epic 4 | Initiate new row creation |
| FR22 | Epic 4 | Enter values for new row columns |
| FR23 | Epic 4 | Save new row (INSERT) |
| FR24 | Epic 4 | Cancel new row creation |
| FR25 | Epic 4 | Validate required fields |
| FR26 | Epic 5 | Select row for deletion |
| FR27 | Epic 5 | Confirm deletion before execution |
| FR28 | Epic 5 | Cancel deletion at prompt |
| FR29 | Epic 5 | Execute DELETE on confirmation |
| FR30 | Epic 5 | Confirm successful deletion |
| FR31 | Epic 3 | Error messages identify operation and suggest resolution |
| FR32 | Epic 3 | Error shows specific context |
| FR33 | Epic 3 | Dismiss error notifications |
| FR34 | Epic 3 | Prevent constraint violations with messages |
| FR35 | Epic 2 | Display correctly in light theme |
| FR36 | Epic 2 | Display correctly in dark theme |
| FR37 | Epic 1 | Access from VS Code sidebar |
| FR38 | Epic 1 | Access via command palette |
| FR39 | Epic 12 | View list of saved server connections (Desktop) |
| FR40 | Epic 12 | Add new server connection (Desktop) |
| FR41 | Epic 12 | Edit existing server connection (Desktop) |
| FR42 | Epic 12 | Delete server connection with confirmation (Desktop) |
| FR43 | Epic 12 | Test server connection before saving (Desktop) |
| FR44 | Epic 12 | Connect/disconnect from saved server (Desktop) |
| FR45 | Epic 11 | Open multiple tables as tabs (Desktop) |
| FR46 | Epic 11 | Switch between open table tabs (Desktop) |
| FR47 | Epic 11 | Close table tabs with unsaved changes prompt (Desktop) |
| FR48 | Epic 11 | Window state persistence across sessions (Desktop) |
| FR49 | Epic 13 | Auto-update from GitHub Releases (Desktop) |
| FR50 | Epic 12 | First-run welcome screen (Desktop) |

## Epic List

### Epic 1: Extension Foundation & Server Connection
Users can install the extension and connect to IRIS servers via Server Manager, browse available namespaces and tables.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR37, FR38
**ARs covered:** AR1, AR2, AR3, AR4, AR8, AR9, AR10, AR11, AR12, AR13
**NFRs addressed:** NFR5, NFR6, NFR7, NFR9, NFR11, NFR12, NFR13, NFR14

### Epic 2: Table Data Display
Users can view table data in an Excel-like grid with proper column headers, scrolling, data formatting, and theme support.

**FRs covered:** FR11, FR12, FR13, FR14, FR15, FR35, FR36
**ARs covered:** AR5, AR6
**NFRs addressed:** NFR1, NFR3, NFR4
**UX covered:** UX4 (selected state), UX5, UX8, UX15, UX16, UX17

### Epic 3: Inline Cell Editing
Users can edit cell values directly and save changes to the database - the core "aha moment" of the product.

**FRs covered:** FR16, FR17, FR18, FR19, FR20, FR31, FR32, FR33, FR34
**ARs covered:** AR7
**NFRs addressed:** NFR2, NFR8, NFR15, NFR16, NFR17, NFR18
**UX covered:** UX2, UX3, UX4, UX6 (Refresh), UX10, UX11, UX12, UX14

### Epic 4: Row Creation
Users can add new rows to tables with field validation.

**FRs covered:** FR21, FR22, FR23, FR24, FR25
**NFRs addressed:** NFR8
**UX covered:** UX6 (Add Row), UX7

### Epic 5: Row Deletion
Users can select and delete rows with confirmation for full CRUD capability.

**FRs covered:** FR26, FR27, FR28, FR29, FR30
**NFRs addressed:** NFR8, NFR16
**UX covered:** UX6 (Delete Row), UX9, UX13

### Epic 6: Scalability & Advanced Navigation (Growth Phase)
Users can efficiently navigate namespaces with thousands of tables and work with tables containing millions of rows through schema-based browsing, filtering, sorting, and enhanced pagination.

**FRs covered:** FR8 (enhanced), FR13 (enhanced)
**NFRs addressed:** NFR1, NFR4
**Growth Features:** Pagination enhancement, Column sorting and filtering, Performance optimization
**Dependencies:** Requires Epics 1 & 2 complete

### Epic 10: Monorepo Restructure & Shared Core Extraction (Desktop Foundation)
Restructure the project into a monorepo with shared packages so that core logic and webview UI can be reused by both the VS Code extension and the standalone desktop application.

**ARs covered:** AR14, AR15, AR16
**NFRs addressed:** NFR1-NFR18 (regression verification)
**UX covered:** UX19-UX24 (theme abstraction foundation)
**Dependencies:** None — foundation epic, must come first

### Epic 11: Electron Shell & Window Management (Desktop Target)
Create the Electron application shell with window management, IPC bridge, tab bar, and native menus.

**FRs covered:** FR45, FR46, FR47, FR48
**ARs covered:** AR17, AR19
**NFRs addressed:** NFR19, NFR22, NFR23, NFR24
**UX covered:** UX21, UX22, UX24
**Dependencies:** Requires Epic 10 (monorepo) and Epic 12 (connection manager)

### Epic 12: Connection Manager (Desktop Target)
Built-in connection management for the desktop application, replacing VS Code Server Manager with a self-contained server CRUD UI and secure credential storage.

**FRs covered:** FR39, FR40, FR41, FR42, FR43, FR44, FR50
**ARs covered:** AR18, AR19
**NFRs addressed:** NFR21
**UX covered:** UX19, UX20, UX23
**Dependencies:** Requires Epic 10 (monorepo)

### Epic 13: Build, Package & Distribution (Desktop Target)
Configure electron-builder for Windows/macOS installers, auto-update via GitHub Releases, and CI/CD pipeline for dual-target builds.

**FRs covered:** FR49
**ARs covered:** AR20, AR21
**NFRs addressed:** NFR19, NFR20
**Dependencies:** Requires Epic 11 (Electron shell)

### Epic 14: Integration Testing & Feature Parity (Desktop Target)
Verify feature parity between VS Code and desktop targets, cross-platform testing, and desktop-specific polish.

**NFRs addressed:** NFR19-NFR24 (verification)
**Dependencies:** Requires Epics 10, 11, 12, 13

---

## Epic 1: Extension Foundation & Server Connection

**Goal:** Users can install the extension and connect to IRIS servers via Server Manager, browse available namespaces and tables.

### Story 1.1: Project Initialization

As a **developer**,
I want **the extension project initialized with VS Code extension scaffolding**,
So that **I have a working foundation to build upon**.

**Acceptance Criteria:**

**Given** a new development environment
**When** I run `npx --package yo --package generator-code -- yo code` with TypeScript and esbuild options
**Then** a valid VS Code extension project is created with:
- TypeScript configuration (strict mode)
- esbuild bundler configuration
- Source directory structure per architecture: `src/providers/`, `src/services/`, `src/models/`, `src/utils/`
- Media directory: `media/`
- Package.json with extension manifest
**And** the extension compiles without errors using `npm run compile`
**And** the extension activates in VS Code Extension Development Host

---

### Story 1.2: Extension Shell with Sidebar View

As a **user**,
I want **to see IRIS Table Editor in the VS Code sidebar**,
So that **I have a dedicated place to access table editing features**.

**Acceptance Criteria:**

**Given** the extension is installed and activated
**When** I open VS Code
**Then** I see "IRIS Table Editor" in the sidebar activity bar
**And** clicking it reveals the IRIS Table Editor panel

**Given** VS Code is open
**When** I open the command palette and type "IRIS Table Editor"
**Then** I see the command "IRIS Table Editor: Open Table Editor"
**And** executing it opens/focuses the sidebar panel

---

### Story 1.3: Server Manager Integration

As a **user**,
I want **to see a list of my configured IRIS servers**,
So that **I can choose which server to work with**.

**Acceptance Criteria:**

**Given** the IRIS Table Editor panel is open
**And** InterSystems Server Manager extension is installed with configured servers
**When** the panel loads
**Then** I see a dropdown or list showing all configured server names

**Given** Server Manager extension is NOT installed
**When** the panel loads
**Then** I see a friendly message: "InterSystems Server Manager extension required"
**And** I see a button/link to install Server Manager

**Given** Server Manager is installed but no servers are configured
**When** the panel loads
**Then** I see a message: "No servers configured. Add a server in InterSystems Server Manager."

---

### Story 1.4: Server Authentication & Connection Status

As a **user**,
I want **to connect to a server and see my connection status**,
So that **I know I'm authenticated and ready to browse data**.

**Acceptance Criteria:**

**Given** I see the server list
**When** I select a server
**Then** the extension authenticates using Server Manager credentials
**And** I see a connection status indicator showing "Connected to [server-name]"

**Given** I am connected to a server
**When** I look at the panel header
**Then** I see the current server name displayed prominently
**And** I see a "Disconnect" button/option

**Given** I am connected
**When** I click "Disconnect"
**Then** I am disconnected from the server
**And** the status shows "Disconnected"
**And** I see the server selection UI again

**Given** authentication fails
**When** I try to connect
**Then** I see a clear error message explaining the failure
**And** I remain on the server selection screen

---

### Story 1.5: Namespace Browsing

As a **user**,
I want **to see and select namespaces on my connected server**,
So that **I can navigate to the database area I want to work with**.

**Acceptance Criteria:**

**Given** I am connected to a server
**When** the connection completes
**Then** I see a list of available namespaces

**Given** I see the namespace list
**When** I select a namespace
**Then** the namespace is highlighted as selected
**And** the UI shows I am now browsing that namespace

**Given** a namespace contains the `%` character (e.g., `%SYS`)
**When** the extension queries the Atelier API
**Then** the namespace is properly encoded (`%` → `%25`)
**And** the query succeeds without errors

---

### Story 1.6: Table Browsing

As a **user**,
I want **to see and select tables in my chosen namespace**,
So that **I can choose which table to view and edit**.

**Acceptance Criteria:**

**Given** I have selected a namespace
**When** the selection completes
**Then** I see a list of tables in that namespace within 1 second

**Given** I see the table list
**When** I click on a table name
**Then** the table is selected/highlighted
**And** the selection is ready to trigger data display (Epic 2)

**Given** I see the table list
**When** I click a "Refresh" button
**Then** the table list reloads from the server
**And** any new tables appear in the list

**Given** the namespace has no tables
**When** I select that namespace
**Then** I see a message: "No tables found in this namespace"

---

## Epic 2: Table Data Display

**Goal:** Users can view table data in an Excel-like grid with proper column headers, scrolling, data formatting, and theme support.

### Story 2.1: Grid Component & Table Schema

As a **user**,
I want **to see table data displayed in a grid with column headers**,
So that **I can view my data in a familiar spreadsheet-like format**.

**Acceptance Criteria:**

**Given** I have selected a table in the sidebar (from Epic 1)
**When** I click/double-click to open the table
**Then** a grid view opens in the VS Code editor area (as a webview tab)
**And** I see column headers showing the table's column names

**Given** the grid is loading
**When** data is being fetched
**Then** I see a loading indicator (progress ring)
**And** the UI remains responsive (non-blocking)

**Given** a table has columns
**When** the grid displays
**Then** each column header shows the column name
**And** columns have reasonable default widths

---

### Story 2.2: Table Data Loading with Pagination

As a **user**,
I want **to see table rows with pagination for large tables**,
So that **I can browse through data without overwhelming the UI**.

**Acceptance Criteria:**

**Given** a table is opened
**When** the data loads
**Then** I see the first page of rows (default 50 rows)
**And** data loads within 2 seconds for tables under 500 rows

**Given** a table has more than 50 rows
**When** the grid displays
**Then** I see pagination controls at the bottom
**And** I see "Rows 1-50 of [total]" indicator

**Given** I am viewing page 1
**When** I click "Next"
**Then** rows 51-100 load and display
**And** the pagination indicator updates

**Given** I am viewing page 2+
**When** I click "Prev"
**Then** the previous page loads
**And** I return to the earlier rows

**Given** I can scroll vertically within the current page
**When** I scroll
**Then** rows scroll smoothly
**And** column headers remain visible (sticky)

---

### Story 2.3: Data Type Formatting

As a **user**,
I want **data displayed appropriately for its type**,
So that **I can easily read and understand the values**.

**Acceptance Criteria:**

**Given** a cell contains text
**When** displayed
**Then** text shows left-aligned
**And** long text truncates with ellipsis

**Given** a cell contains a number
**When** displayed
**Then** numbers show right-aligned

**Given** a cell contains a date/timestamp
**When** displayed
**Then** dates show in a readable format (ISO or locale-appropriate)

**Given** a cell contains NULL
**When** displayed
**Then** the cell shows a distinct visual indicator (e.g., italic "NULL" or empty with subtle background)

**Given** a cell contains a boolean
**When** displayed
**Then** it shows as "true"/"false" or a checkbox indicator

---

### Story 2.4: Theme Support (Light/Dark)

As a **user**,
I want **the grid to match my VS Code theme**,
So that **the extension feels native to my development environment**.

**Acceptance Criteria:**

**Given** VS Code is using a light theme
**When** I view the grid
**Then** the grid uses light backgrounds and appropriate contrast colors
**And** all text is readable

**Given** VS Code is using a dark theme
**When** I view the grid
**Then** the grid uses dark backgrounds and appropriate contrast colors
**And** all text is readable

**Given** VS Code is using High Contrast theme
**When** I view the grid
**Then** the grid respects high contrast colors
**And** focus indicators are clearly visible

**Given** I switch VS Code themes while the grid is open
**When** the theme changes
**Then** the grid updates to match the new theme automatically

---

### Story 2.5: Data Refresh & Context Display

As a **user**,
I want **to refresh data and always see where I am**,
So that **I see current data and know which table I'm viewing**.

**Acceptance Criteria:**

**Given** a table grid is open
**When** I look at the toolbar/header area
**Then** I see a context breadcrumb: "server > namespace > table"
**And** I see a Refresh button

**Given** I click the Refresh button
**When** the refresh executes
**Then** data reloads from the server
**And** I see fresh data (reflecting any external changes)
**And** my current page position is preserved if possible

**Given** the context bar is in a narrow panel
**When** text would overflow
**Then** it truncates with ellipsis
**And** hovering shows the full path in a tooltip

---

## Epic 3: Inline Cell Editing

**Goal:** Users can edit cell values directly and save changes to the database - the core "aha moment" of the product.

### Story 3.1: Cell Selection & Keyboard Navigation

As a **user**,
I want **to select cells and navigate with my keyboard**,
So that **I can work efficiently without reaching for the mouse**.

**Acceptance Criteria:**

**Given** the grid is displayed with data
**When** I click on a cell
**Then** the cell becomes selected with a visible 2px focus border
**And** only one cell is selected at a time

**Given** a cell is selected
**When** I press Arrow Up/Down/Left/Right
**Then** the selection moves to the adjacent cell
**And** the focus border follows

**Given** a cell is selected
**When** I press Tab
**Then** selection moves to the next cell (right, then down)

**Given** a cell is selected
**When** I press Shift+Tab
**Then** selection moves to the previous cell (left, then up)

**Given** the grid has ARIA attributes
**When** a screen reader reads the grid
**Then** it announces the grid structure (`role="grid"`)
**And** selected cells are announced (`aria-selected`)

---

### Story 3.2: Inline Cell Editing

As a **user**,
I want **to edit a cell by double-clicking or pressing F2**,
So that **I can change values directly in the grid**.

**Acceptance Criteria:**

**Given** a cell is selected
**When** I double-click the cell
**Then** the cell enters edit mode
**And** an input field appears with the current value
**And** the cursor is at the end of the text

**Given** a cell is selected
**When** I press F2
**Then** the cell enters edit mode (same as double-click)

**Given** a cell is selected
**When** I start typing any character
**Then** the cell enters edit mode
**And** the typed character replaces the existing value

**Given** a cell is in edit mode
**When** I look at the cell
**Then** I see an input field styled to match the cell
**And** the cell has an "editing" visual state (distinct background)

**Given** a cell is in edit mode
**When** I type or modify the value
**Then** the input accepts my changes
**And** the cell shows a "modified" visual state (tinted background)

---

### Story 3.3: Save Cell Changes (UPDATE)

As a **user**,
I want **to save my edits by pressing Tab or Enter**,
So that **changes persist to the database immediately**.

**Acceptance Criteria:**

**Given** a cell is in edit mode with a modified value
**When** I press Tab
**Then** the change is saved to the database via UPDATE
**And** the save completes within 1 second
**And** selection moves to the next cell (right)

**Given** a cell is in edit mode with a modified value
**When** I press Enter
**Then** the change is saved to the database
**And** selection moves to the cell below

**Given** a cell is in edit mode
**When** I click on another cell
**Then** the current edit is saved
**And** the clicked cell becomes selected

**Given** a save is in progress
**When** the UPDATE executes
**Then** I see a brief saving indicator (pulse animation)
**And** on success, I see a green confirmation flash (200ms)
**And** the cell returns to normal display mode

**Given** I save a cell
**When** checking the database
**Then** the UPDATE used parameterized queries (no SQL injection)
**And** only the modified column was updated

---

### Story 3.4: Edit Cancellation & Visual Feedback

As a **user**,
I want **to cancel an edit and see which cells have pending changes**,
So that **I can undo mistakes and track my modifications**.

**Acceptance Criteria:**

**Given** a cell is in edit mode
**When** I press Escape
**Then** the edit is cancelled
**And** the original value is restored
**And** the cell exits edit mode but remains selected

**Given** I have modified a cell but not yet saved (e.g., still typing)
**When** I look at the cell
**Then** it shows a "modified" visual indicator (tinted background)
**And** this indicates unsaved changes

**Given** a cell shows modified state
**When** I press Escape
**Then** the modification is discarded
**And** the cell returns to its original unmodified appearance

---

### Story 3.5: Error Handling & User Feedback

As a **user**,
I want **clear error messages when saves fail**,
So that **I understand what went wrong and how to fix it**.

**Acceptance Criteria:**

**Given** I try to save a value that violates a constraint
**When** the save fails
**Then** the cell shows an error state (red border)
**And** I see an error message identifying the constraint violated
**And** the message suggests how to fix it

**Given** I try to save an invalid data type (e.g., text in number field)
**When** the save fails
**Then** I see a message like "Invalid value: expected number"
**And** the cell remains in edit mode so I can correct it

**Given** the network disconnects during a save
**When** the save fails
**Then** I see a message: "Connection lost. Please check your connection."
**And** my edit is preserved so I can retry

**Given** an error message is displayed
**When** I click a dismiss button or press Escape
**Then** the error message closes
**And** I can retry the edit or cancel

**Given** a partial save failure occurs
**When** an error happens mid-operation
**Then** the UI remains consistent (no corrupted state)
**And** I can see which cells succeeded vs. failed

---

## Epic 4: Row Creation

**Goal:** Users can add new rows to tables with field validation.

### Story 4.1: New Row Affordance

As a **user**,
I want **a clear way to add a new row**,
So that **I can insert new records into the table**.

**Acceptance Criteria:**

**Given** the table grid is displayed
**When** I look at the toolbar
**Then** I see an "Add Row" button (+ icon)

**Given** the table grid is displayed
**When** I look at the bottom of the grid
**Then** I see an empty row placeholder indicating where new data can be entered

**Given** I click the "Add Row" button
**When** the action executes
**Then** focus moves to the first editable cell in the new row
**And** the new row is visually distinct (e.g., different background)

**Given** I click on the empty row at the bottom
**When** I click any cell in that row
**Then** the row activates for data entry
**And** the clicked cell enters edit mode

---

### Story 4.2: New Row Data Entry

As a **user**,
I want **to enter values for each column in the new row**,
So that **I can populate the record before saving**.

**Acceptance Criteria:**

**Given** a new row is active for editing
**When** I type in a cell
**Then** the value is accepted
**And** I can Tab to move to the next column

**Given** I am entering data in a new row
**When** I Tab through columns
**Then** each column becomes editable in sequence
**And** I can enter appropriate values for each field

**Given** I have entered some values in a new row
**When** I look at the row
**Then** cells with values show the entered data
**And** empty cells remain empty or show placeholder text

**Given** a column has a specific data type
**When** I enter data
**Then** the input accepts type-appropriate values
**And** invalid types are handled gracefully (error on save)

---

### Story 4.3: Save New Row (INSERT)

As a **user**,
I want **to save the new row to the database**,
So that **my new record is persisted**.

**Acceptance Criteria:**

**Given** I have entered values in a new row
**When** I press Enter on the last column or click a "Save" action
**Then** the row is saved to the database via INSERT
**And** I see a success confirmation (green flash)

**Given** I try to save a new row
**When** required fields are empty
**Then** I see validation messages indicating which fields are required
**And** the row is NOT saved until requirements are met

**Given** I have started entering a new row
**When** I press Escape before saving
**Then** the new row entry is cancelled
**And** any entered data is discarded
**And** the empty row placeholder returns

**Given** the INSERT succeeds
**When** I look at the grid
**Then** the new row appears as a regular data row
**And** a new empty row placeholder appears at the bottom

**Given** the INSERT fails due to constraint violation
**When** the error occurs
**Then** I see a clear error message explaining the issue
**And** the new row remains editable so I can fix and retry

**Given** I save a new row
**When** checking the database
**Then** the INSERT used parameterized queries (no SQL injection)

---

## Epic 5: Row Deletion

**Goal:** Users can select and delete rows with confirmation for full CRUD capability.

### Story 5.1: Row Selection for Deletion

As a **user**,
I want **to select a row and indicate I want to delete it**,
So that **I can remove unwanted records from the table**.

**Acceptance Criteria:**

**Given** the table grid is displayed
**When** I look at the toolbar
**Then** I see a "Delete Row" button (trash icon)
**And** it is disabled when no row is selected

**Given** the grid displays rows
**When** I look at the left edge of each row
**Then** I see a row selector (checkbox or clickable area)

**Given** I click on a row selector
**When** the click registers
**Then** the entire row is visually highlighted as selected
**And** the "Delete Row" button becomes enabled

**Given** a row is selected
**When** I click on a different row's selector
**Then** the new row becomes selected
**And** the previous selection is cleared (single-select mode for MVP)

**Given** a row is selected
**When** I click the row selector again
**Then** the row is deselected
**And** the "Delete Row" button becomes disabled

---

### Story 5.2: Delete Confirmation Dialog

As a **user**,
I want **to confirm before a row is deleted**,
So that **I don't accidentally remove important data**.

**Acceptance Criteria:**

**Given** a row is selected
**When** I click the "Delete Row" button
**Then** a confirmation dialog appears
**And** the dialog shows "Delete this row? This action cannot be undone."
**And** I see "Cancel" and "Delete" buttons

**Given** the confirmation dialog is open
**When** I click "Cancel"
**Then** the dialog closes
**And** the row remains in the grid unchanged
**And** the row remains selected

**Given** the confirmation dialog is open
**When** I press Escape
**Then** the dialog closes (same as Cancel)

**Given** the confirmation dialog is open
**When** I click "Delete"
**Then** the deletion proceeds (Story 5.3)

**Given** the confirmation dialog is displayed
**When** a screen reader reads it
**Then** it announces the dialog content appropriately
**And** focus is managed correctly (trapped in dialog)

---

### Story 5.3: Execute DELETE & Feedback

As a **user**,
I want **the row deleted from the database with clear feedback**,
So that **I know the deletion succeeded or failed**.

**Acceptance Criteria:**

**Given** I confirm deletion in the dialog
**When** the DELETE executes
**Then** the row is removed from the database
**And** the row disappears from the grid
**And** I see a success message: "Row deleted successfully"

**Given** the DELETE succeeds
**When** I look at the grid
**Then** the deleted row is no longer visible
**And** the row count updates appropriately
**And** the grid remains functional (no corrupted state)

**Given** the DELETE fails (e.g., foreign key constraint)
**When** the error occurs
**Then** I see a clear error message explaining why deletion failed
**And** the row remains in the grid unchanged
**And** I can dismiss the error and try again or cancel

**Given** I delete a row
**When** checking the database
**Then** the DELETE used parameterized queries (no SQL injection)

**Given** a partial failure occurs during delete
**When** an error happens
**Then** the UI remains consistent
**And** data integrity is preserved (no orphaned states)

---

## Epic 6: Scalability & Advanced Navigation

**Goal:** Users can efficiently navigate namespaces with thousands of tables and work with tables containing millions of rows through schema-based browsing, filtering, sorting, and enhanced pagination.

**Phase:** Growth (Post-MVP)
**Dependencies:** Requires Epic 1 (sidebar) and Epic 2 (grid/pagination) to be complete.

**FRs covered:** FR8 (enhanced), FR13 (enhanced)
**NFRs addressed:** NFR1, NFR4
**Growth Features addressed:** Pagination enhancement, Column sorting and filtering, Performance optimization for large datasets

---

### Story 6.1: Schema-Based Table Tree View

As a **user**,
I want **to browse tables organized by schema in a collapsible tree view**,
So that **I can quickly find tables even when there are thousands in the namespace**.

**Acceptance Criteria:**

**Given** a namespace is selected
**When** the table list loads
**Then** I see schemas displayed as folder icons at the root level
**And** schemas are sorted alphabetically

**Given** a schema contains multiple tables
**When** I click on the schema folder
**Then** it expands to show the tables within that schema
**And** tables are sorted alphabetically within the schema

**Given** a schema is expanded
**When** I click on a different schema
**Then** the previously expanded schema collapses
**And** the clicked schema expands (accordion behavior - one open at a time)

**Given** a schema contains only one table
**When** the table list displays
**Then** that table is shown at the root level (not nested in a folder)

**Given** I have expanded a schema and selected a table
**When** I refresh the table list
**Then** my expansion state is preserved

---

### Story 6.2: Inline Column Filtering

As a **user**,
I want **to filter table data by typing in filter boxes below column headers**,
So that **I can quickly find specific records in tables with millions of rows**.

**Acceptance Criteria:**

**Given** the grid is displayed with data
**When** I look below the column headers
**Then** I see a filter row with an input for each column

**Given** a column has ≤10 distinct values
**When** I click the filter input for that column
**Then** I see a checklist dropdown with all distinct values
**And** I can select/deselect multiple values to filter

**Given** a column has >10 distinct values
**When** I click the filter input for that column
**Then** I see a text input field
**And** I see placeholder text indicating wildcard support (e.g., "Filter... (* = wildcard)")

**Given** I am using text filter with wildcards
**When** I type `John*`
**Then** the grid filters to rows where that column starts with "John"

**Given** I am using text filter with wildcards
**When** I type `*smith*`
**Then** the grid filters to rows where that column contains "smith"

**Given** I am using text filter without wildcards
**When** I type `active`
**Then** the grid filters to rows where that column contains "active" (implicit contains)

**Given** I have set filters on multiple columns
**When** the filter applies
**Then** results match ALL filter conditions (AND logic)

**Given** I have active filters
**When** I look at the filter row
**Then** active filter inputs are visually highlighted
**And** I see a "Clear all filters" button in the toolbar
**And** I see a "Toggle filters" button (on/off) in the toolbar

**Given** I have active filters
**When** I click the "Toggle filters" button to disable
**Then** all filters are temporarily disabled (data shows unfiltered)
**And** the filter row shows my filter criteria grayed out / dimmed
**And** the toggle button shows filters are "off"
**And** my filter criteria is preserved (not cleared)

**Given** filters are disabled (toggled off)
**When** I click the "Toggle filters" button to enable
**Then** all my previous filter criteria is re-applied
**And** the filter row returns to normal appearance
**And** data refreshes with filters active

**Given** I clear a filter input
**When** the input becomes empty
**Then** that column filter is removed and data refreshes

**Given** I click "Clear all filters"
**When** the action executes
**Then** all filter criteria is permanently removed
**And** all filter inputs are cleared
**And** the toggle returns to "on" state

---

### Story 6.3: Filter Panel with Advanced Options

As a **user**,
I want **a filter panel that shows all active filters and provides advanced filtering options**,
So that **I can manage complex filter combinations and use operators beyond simple text matching**.

**Acceptance Criteria:**

**Given** the grid toolbar is visible
**When** I look at the toolbar
**Then** I see a "Filter Panel" button (funnel icon)

**Given** I click the "Filter Panel" button
**When** the panel opens
**Then** I see a collapsible panel (sidebar or dropdown) showing all columns
**And** each column shows its current filter value (if any)
**And** active filters are visually emphasized

**Given** the filter panel is open
**When** I set a filter for a column
**Then** I can choose an operator:

| Operator | Meaning |
|----------|---------|
| Contains | Value contains text |
| Starts with | Value starts with text |
| Ends with | Value ends with text |
| Equals | Exact match |
| Not equals | Excludes exact match |
| Greater than | Numeric/date comparison |
| Less than | Numeric/date comparison |
| Is empty | NULL or empty string |
| Is not empty | Has a value |

**Given** I set a filter in the filter panel
**When** the filter applies
**Then** the inline filter row updates to show the same filter
**And** data refreshes with the filter applied

**Given** I set a filter in the inline filter row
**When** I open the filter panel
**Then** I see that filter reflected in the panel with "Contains" as default operator

**Given** the filter panel shows active filters
**When** I look at each active filter
**Then** I see a remove (X) button to clear that individual filter

**Given** filters are toggled off (disabled)
**When** I open the filter panel
**Then** I see all filter criteria displayed but visually dimmed
**And** I see indication that filters are currently disabled

**Given** the filter panel is open
**When** I click the "Filter Panel" button again or click outside
**Then** the panel closes

---

### Story 6.4: Column Sorting

As a **user**,
I want **to sort table data by clicking column headers**,
So that **I can organize data to find patterns or locate specific records**.

**Acceptance Criteria:**

**Given** the grid displays column headers
**When** I look at a column header
**Then** I see a subtle sort indicator area (or hover reveals sort affordance)

**Given** a column is not currently sorted
**When** I click the column header
**Then** the data sorts by that column in ascending order (A→Z, 0→9)
**And** the header shows an ascending sort indicator (▲)

**Given** a column is sorted ascending
**When** I click the same column header again
**Then** the data sorts by that column in descending order (Z→A, 9→0)
**And** the header shows a descending sort indicator (▼)

**Given** a column is sorted descending
**When** I click the same column header again
**Then** the sort is cleared for that column
**And** the sort indicator is removed
**And** data returns to default order (by primary key)

**Given** column A is currently sorted
**When** I click a different column B header
**Then** sorting switches to column B (ascending)
**And** column A's sort indicator is removed
**And** only column B shows the sort indicator

**Given** I have active filters applied
**When** I sort by a column
**Then** the sort applies to the filtered results
**And** filters remain active

**Given** I am on page 3 of results
**When** I change the sort order
**Then** pagination resets to page 1
**And** the newly sorted data displays from the beginning

**Given** the table has millions of rows
**When** I sort by a column
**Then** the sort is performed server-side (SQL ORDER BY)
**And** only the current page of sorted results is returned

---

### Story 6.5: Enhanced Pagination Controls

As a **user**,
I want **pagination controls with first, last, and direct page access**,
So that **I can navigate efficiently through tables with millions of rows**.

**Acceptance Criteria:**

**Given** a table has multiple pages of data
**When** I look at the pagination bar
**Then** I see the following controls (left to right):
- Row count: "Rows 1-50 of 1,234,567"
- First page button (⏮)
- Previous page button (◀)
- Page input: text field showing current page with "of X" label
- Next page button (▶)
- Last page button (⏭)

**Given** I am on page 1
**When** I look at the pagination controls
**Then** the First (⏮) and Previous (◀) buttons are disabled

**Given** I am on the last page
**When** I look at the pagination controls
**Then** the Next (▶) and Last (⏭) buttons are disabled

**Given** I am on page 5 of 100
**When** I click the First page button (⏮)
**Then** the grid navigates to page 1
**And** the page input updates to "1"

**Given** I am on page 5 of 100
**When** I click the Last page button (⏭)
**Then** the grid navigates to page 100
**And** the page input updates to "100"

**Given** the page input shows "5"
**When** I clear it and type "42" then press Enter
**Then** the grid navigates to page 42
**And** the row count updates to show "Rows 2,051-2,100 of ..."

**Given** I type an invalid page number (e.g., "abc", "0", "-5", or > max pages)
**When** I press Enter
**Then** the input reverts to the current valid page number
**And** a brief error indication shows (red border flash)

**Given** I type a page number
**When** I click outside the input (blur) without pressing Enter
**Then** the page navigation executes (same as Enter)

**Given** filters or sort changes
**When** the data refreshes
**Then** pagination resets to page 1
**And** total row count updates to reflect filtered results

**Given** the table has 1,234,567 rows
**When** the row count displays
**Then** numbers are formatted with thousands separators ("1,234,567")

---

### Story 6.6: Lazy Loading Verification & Optimization

As a **user**,
I want **the grid to load data lazily without fetching all rows**,
So that **performance remains fast even with tables containing millions of rows**.

**Acceptance Criteria:**

**Given** a table has millions of rows
**When** I open the table
**Then** only the first page of rows (50) is fetched from the server
**And** the total row count is fetched separately (COUNT query)
**And** the grid displays within 2 seconds

**Given** I navigate to page 50
**When** the page loads
**Then** only rows 2,451-2,500 are fetched
**And** previously loaded pages are not re-fetched
**And** no intermediate pages are fetched

**Given** I have filters applied reducing results to 500 rows
**When** I view the grid
**Then** only the current page of filtered results is fetched
**And** the COUNT reflects filtered total (500)

**Given** I apply a sort
**When** the grid refreshes
**Then** only the current page of sorted results is fetched
**And** the server performs the sort (ORDER BY), not the client

**Given** network latency is high
**When** I navigate pages
**Then** I see a loading indicator while the page fetches
**And** the UI remains responsive (non-blocking)

**Given** I rapidly click Next multiple times
**When** requests are in flight
**Then** intermediate page requests are cancelled or ignored
**And** only the final requested page displays (debounce/cancel pattern)

**Performance Targets:**

| Scenario | Target |
|----------|--------|
| Initial page load | < 2 seconds |
| Page navigation | < 1 second |
| Filter apply | < 2 seconds |
| Sort apply | < 2 seconds |

---

## Epic 7: Data Type Polish

**Goal:** Users experience intuitive, type-appropriate data entry controls that match familiar patterns from Microsoft Access and Excel, eliminating friction when entering boolean, date, numeric, and null values.

**Phase:** Growth (Post-MVP)
**Dependencies:** Requires Epic 3 (inline cell editing) to be complete.

**FRs addressed:** FR14 (enhanced - data formatted appropriately for its type), FR16 (enhanced - type-specific editing)
**NFRs addressed:** NFR2 (cell edit save operations complete within 1 second)
**UX improvement:** Matches user mental model from Access/Excel for data entry

---

### Story 7.1: Boolean Checkbox Control

As a **user**,
I want **boolean columns to display as clickable checkboxes**,
So that **I can toggle true/false values with a single click instead of typing 1/0**.

**Acceptance Criteria:**

**Given** a table has a boolean column (BIT type in IRIS)
**When** the grid displays
**Then** boolean cells show as checkboxes (checked = true/1, unchecked = false/0)
**And** the checkbox is centered in the cell

**Given** a boolean cell displays a checkbox
**When** I click the checkbox
**Then** the value toggles immediately (checked ↔ unchecked)
**And** the change is saved to the database
**And** I see the save confirmation flash (green 200ms)

**Given** a boolean cell displays a checkbox
**When** I press Space while the cell is selected
**Then** the checkbox toggles (keyboard accessibility)

**Given** a boolean column contains NULL
**When** the grid displays
**Then** the checkbox shows an indeterminate state (dash or empty)
**And** clicking it sets the value to true (checked)

**Given** I need to set a boolean to NULL
**When** I right-click the checkbox cell
**Then** I see a context option "Set to NULL"
**And** selecting it clears the checkbox to indeterminate state

**Given** the database stores 1/0 for booleans
**When** I toggle a checkbox
**Then** the UPDATE query sends 1 (checked) or 0 (unchecked)
**And** the display remains as a checkbox (not raw 1/0)

---

### Story 7.2: Date Picker Control

As a **user**,
I want **date columns to offer a calendar picker for easy date selection**,
So that **I can select dates visually without memorizing the exact format required**.

**Acceptance Criteria:**

**Given** a table has a date column (%Date, DATE type)
**When** I click or double-click to edit the cell
**Then** I see a calendar icon appear next to the input field
**And** I can type a date directly in the input field

**Given** I am editing a date cell
**When** I click the calendar icon
**Then** a date picker popup opens
**And** it shows the current month with selectable days
**And** I can navigate between months using arrow buttons
**And** the currently selected date (if any) is highlighted

**Given** the date picker is open
**When** I click on a day
**Then** the date is selected and inserted into the cell
**And** the picker closes
**And** the date displays in readable format (e.g., "2026-02-01" or locale-appropriate)

**Given** I am editing a date cell
**When** I type a date in common formats (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, "Feb 1, 2026")
**Then** the input is recognized and accepted
**And** dates are stored in IRIS-compatible format

**Given** a date cell contains NULL
**When** the cell displays
**Then** it shows the NULL placeholder (italic gray "NULL")
**And** clicking opens the date picker starting at today's date

**Given** I am editing a date cell
**When** I press Escape
**Then** the date picker closes (if open)
**And** the edit is cancelled

**Given** keyboard navigation
**When** the date picker is open and I press Arrow keys
**Then** I can navigate between days
**And** pressing Enter selects the focused day

---

### Story 7.3: Time Field Polish

As a **user**,
I want **time columns to accept common time formats and display readably**,
So that **I can enter times naturally without strict format requirements**.

**Acceptance Criteria:**

**Given** a table has a time column (%Time, TIME type)
**When** I edit the cell
**Then** I see a text input that accepts time values

**Given** I am editing a time cell
**When** I type time in common formats:
- "14:30" (HH:MM)
- "2:30 PM" (12-hour with AM/PM)
- "14:30:45" (HH:MM:SS)
- "2:30:45 PM"
**Then** the input is recognized and accepted
**And** the value is stored in IRIS-compatible format

**Given** a time cell contains a value
**When** the grid displays
**Then** the time shows in readable format (e.g., "14:30" or "2:30 PM" based on locale)

**Given** I enter an invalid time (e.g., "25:00", "abc")
**When** I try to save
**Then** I see a validation error: "Invalid time format"
**And** the cell remains in edit mode for correction

**Given** a time cell contains NULL
**When** the cell displays
**Then** it shows the NULL placeholder

---

### Story 7.4: Numeric Field Polish

As a **user**,
I want **numeric columns to display with proper alignment and formatting**,
So that **numbers are easy to read and compare visually**.

**Acceptance Criteria:**

**Given** a table has a numeric column (INTEGER, DECIMAL, NUMERIC types)
**When** the grid displays
**Then** numeric values are right-aligned in their cells
**And** large numbers display with thousands separators (e.g., "1,234,567")

**Given** I am editing a numeric cell
**When** the cell enters edit mode
**Then** the input shows the raw number without formatting (e.g., "1234567")
**And** I can edit the digits directly

**Given** I am editing a numeric cell
**When** I type non-numeric characters (except minus sign and decimal point)
**Then** the invalid characters are rejected (not entered)
**Or** I see immediate inline validation feedback

**Given** a column is defined as INTEGER
**When** I enter a decimal value (e.g., "123.45")
**Then** the value is either:
- Rounded to nearest integer on save, OR
- Rejected with validation error "Integer value required"

**Given** a column is defined as DECIMAL with specific precision
**When** I enter a value exceeding the precision
**Then** the value is rounded appropriately
**And** I see a subtle warning if significant digits are lost

**Given** I save a numeric cell
**When** the save completes
**Then** the display returns to formatted view (right-aligned, thousands separators)

---

### Story 7.5: NULL Value Display & Entry

As a **user**,
I want **NULL values to be visually distinct from empty strings**,
So that **I can clearly see which cells have no data vs. intentionally blank data**.

**Acceptance Criteria:**

**Given** a cell contains a NULL value
**When** the grid displays
**Then** the cell shows "NULL" in italic gray text
**And** the text is visually distinct from regular cell content (lighter color, italic)

**Given** a cell contains an empty string ("")
**When** the grid displays
**Then** the cell appears blank (no text)
**And** this is visually different from NULL (no italic "NULL" placeholder)

**Given** a NULL cell is displayed
**When** I click or double-click to edit
**Then** the "NULL" placeholder disappears
**And** I see an empty input field ready for entry
**And** the cursor is positioned in the input

**Given** I am editing a cell with content
**When** I want to set the value to NULL
**Then** I can:
- Clear all content and press a designated key (Ctrl+Shift+N), OR
- Right-click and select "Set to NULL" from context menu
**And** the cell value becomes NULL (not empty string)

**Given** I clear a cell's content and press Tab/Enter to save
**When** the column allows NULLs
**Then** the saved value is empty string (""), not NULL
**And** to explicitly set NULL, I must use the designated action

**Given** I try to set NULL on a column that doesn't allow NULLs
**When** I attempt the NULL action
**Then** I see an error: "This column does not allow NULL values"

**Given** the grid is in light or dark theme
**When** NULL values display
**Then** the italic gray "NULL" text has appropriate contrast for readability
**And** respects the current VS Code theme

---

### Story 7.6: Timestamp/DateTime Field Polish

As a **user**,
I want **timestamp columns to display readably and allow flexible entry**,
So that **I can work with date-time values naturally**.

**Acceptance Criteria:**

**Given** a table has a timestamp/datetime column (%TimeStamp, TIMESTAMP type)
**When** the grid displays
**Then** timestamps show in readable format (e.g., "2026-02-01 14:30:45")

**Given** I am editing a timestamp cell
**When** I click the calendar icon
**Then** a date picker opens
**And** after selecting a date, I can also set the time component
**Or** a combined date-time picker is available

**Given** I am editing a timestamp cell
**When** I type a datetime in common formats:
- "2026-02-01 14:30"
- "2026-02-01 14:30:45"
- "Feb 1, 2026 2:30 PM"
**Then** the input is recognized and accepted

**Given** I enter only a date (no time) in a timestamp field
**When** I save
**Then** the time component defaults to 00:00:00
**Or** the current time is used (implementation choice - document behavior)

---

## Epic 8: Keyboard Shortcuts

**Goal:** Power users can perform all common operations efficiently using keyboard shortcuts, matching the muscle memory patterns from Excel and standard data grid applications.

**Phase:** Growth (Post-MVP)
**Dependencies:** Requires Epic 3 (cell editing) and Epic 5 (row deletion) to be complete.

**PRD reference:** "Keyboard shortcuts for common operations" listed as Growth feature
**UX improvement:** Enables keyboard-centric workflow for developer users

---

### Story 8.1: Grid Navigation Shortcuts

As a **user**,
I want **to navigate the grid entirely with my keyboard**,
So that **I can move quickly without reaching for the mouse**.

**Acceptance Criteria:**

**Given** a cell is selected in the grid
**When** I press the following keys
**Then** navigation occurs as specified:

| Key | Action |
|-----|--------|
| Arrow Up/Down/Left/Right | Move to adjacent cell |
| Tab | Move to next cell (right, then wrap to next row) |
| Shift+Tab | Move to previous cell (left, then wrap to previous row) |
| Home | Move to first cell in current row |
| End | Move to last cell in current row |
| Ctrl+Home | Move to first cell in grid (A1 equivalent) |
| Ctrl+End | Move to last cell with data |
| Page Down | Move down one visible page of rows |
| Page Up | Move up one visible page of rows |

**Given** I am at the edge of the grid
**When** I press an arrow key toward the edge
**Then** the selection does not wrap (stays at edge)
**Or** wraps to next/previous row (configurable behavior)

**Given** I navigate with keyboard
**When** the selection moves
**Then** the newly selected cell is scrolled into view if needed
**And** the focus indicator (2px border) is clearly visible

---

### Story 8.2: Cell Editing Shortcuts

As a **user**,
I want **keyboard shortcuts to enter and exit edit mode quickly**,
So that **I can edit data efficiently without mouse clicks**.

**Acceptance Criteria:**

**Given** a cell is selected (not in edit mode)
**When** I press the following keys
**Then** actions occur as specified:

| Key | Action |
|-----|--------|
| F2 | Enter edit mode, cursor at end of content |
| Enter | Enter edit mode, cursor at end of content |
| Any printable character | Enter edit mode, replacing content with typed character |
| Delete | Clear cell content (set to empty string) |
| Backspace | Enter edit mode, clear content, ready to type |

**Given** a cell is in edit mode
**When** I press the following keys
**Then** actions occur as specified:

| Key | Action |
|-----|--------|
| Enter | Save and move down one cell |
| Tab | Save and move right one cell |
| Shift+Enter | Save and move up one cell |
| Shift+Tab | Save and move left one cell |
| Escape | Cancel edit, restore original value, stay on cell |
| Ctrl+Enter | Save and stay on current cell (no movement) |

**Given** I am editing a cell
**When** I press Ctrl+Z
**Then** the edit is undone (restores original value)
**And** the cell remains in edit mode

---

### Story 8.3: Row Operation Shortcuts

As a **user**,
I want **keyboard shortcuts for row-level operations**,
So that **I can add and delete rows without using the toolbar**.

**Acceptance Criteria:**

**Given** a cell is selected in the grid
**When** I press the following keys
**Then** row operations occur:

| Key | Action |
|-----|--------|
| Ctrl+Shift+= (Ctrl+Plus) | Insert new row (same as Add Row button) |
| Ctrl+- (Ctrl+Minus) | Delete current row (with confirmation) |
| Ctrl+D | Duplicate current row (insert copy below) |

**Given** I press Ctrl+- to delete a row
**When** the delete confirmation dialog appears
**Then** I can press Enter to confirm or Escape to cancel
**And** keyboard focus is on the "Delete" button by default

**Given** I insert a new row with Ctrl+Shift+=
**When** the new row appears
**Then** focus moves to the first editable cell of the new row
**And** the cell enters edit mode automatically

---

### Story 8.4: Data Operation Shortcuts

As a **user**,
I want **keyboard shortcuts for common data operations**,
So that **I can refresh, copy, and manage data quickly**.

**Acceptance Criteria:**

**Given** the grid is focused
**When** I press the following keys
**Then** data operations occur:

| Key | Action |
|-----|--------|
| F5 or Ctrl+R | Refresh table data |
| Ctrl+C | Copy selected cell value to clipboard |
| Ctrl+V | Paste clipboard value into selected cell (enters edit mode) |
| Ctrl+F | Focus filter input for current column (if filtering enabled) |
| Escape (when not editing) | Clear current filter OR deselect row |

**Given** I press Ctrl+C on a cell
**When** the cell content is copied
**Then** I see a brief visual feedback (flash or tooltip "Copied")
**And** the value is in system clipboard

**Given** I press Ctrl+V on a cell
**When** clipboard has content
**Then** the cell enters edit mode with clipboard content
**And** I can modify before saving with Tab/Enter

**Given** I press F5 to refresh
**When** data is refreshing
**Then** I see a loading indicator
**And** my current selection position is preserved after refresh (if possible)

---

### Story 8.5: Shortcut Discovery & Help

As a **user**,
I want **to easily discover available keyboard shortcuts**,
So that **I can learn the shortcuts without memorizing documentation**.

**Acceptance Criteria:**

**Given** the grid toolbar is visible
**When** I look for keyboard help
**Then** I see a keyboard icon or "?" that opens shortcut reference

**Given** I click the keyboard shortcut help
**When** the help panel opens
**Then** I see a list of all available shortcuts organized by category:
- Navigation
- Editing
- Row Operations
- Data Operations
**And** each shortcut shows the key combination and description

**Given** I hover over a toolbar button
**When** the tooltip appears
**Then** it includes the keyboard shortcut (e.g., "Refresh (F5)")

**Given** I press Ctrl+/ or F1 while grid is focused
**When** the shortcut help is triggered
**Then** the keyboard shortcut reference panel opens

**Given** the shortcut help is open
**When** I press Escape
**Then** the help panel closes
**And** focus returns to the grid

---

## Epic 9: CSV/Excel Export & Import

**Goal:** Users can export table data to CSV/Excel formats for offline analysis and import data from files for bulk operations, enabling seamless data exchange with other tools.

**Phase:** Growth (Post-MVP)
**Dependencies:** Requires Epic 2 (data display) to be complete for export; Epic 4 (row creation) for import.

**PRD reference:** "Export to CSV/Excel" listed as Vision feature (accelerated to Growth)
**Differentiator:** Bulk data operations not available in standard IRIS tools

---

### Story 9.1: Export Current View to CSV

As a **user**,
I want **to export the current table view to a CSV file**,
So that **I can analyze data in Excel or share it with colleagues**.

**Acceptance Criteria:**

**Given** a table is displayed in the grid
**When** I look at the toolbar
**Then** I see an "Export" button (download icon)

**Given** I click the Export button
**When** the export menu opens
**Then** I see options:
- "Export Current Page (CSV)"
- "Export All Data (CSV)"
- "Export Filtered Results (CSV)" (if filters active)

**Given** I select "Export Current Page (CSV)"
**When** the export executes
**Then** a CSV file is generated containing only the currently visible rows
**And** the file download dialog opens (or saves to Downloads)
**And** the filename is "{tablename}_{timestamp}.csv"

**Given** I select "Export All Data (CSV)"
**When** the table has many rows
**Then** I see a progress indicator ("Exporting... 50%")
**And** data is streamed/chunked to avoid memory issues
**And** the export completes even for tables with 100k+ rows

**Given** I have filters and/or sort applied
**When** I select "Export Filtered Results (CSV)"
**Then** only the filtered/sorted data is exported
**And** the export respects the current sort order

**Given** the CSV is generated
**When** I open it in Excel
**Then** columns are properly separated
**And** values containing commas are quoted
**And** the file uses UTF-8 encoding with BOM for Excel compatibility

**Given** the table has columns with special characters or commas
**When** exported to CSV
**Then** values are properly escaped/quoted per RFC 4180

---

### Story 9.2: Export to Excel Format

As a **user**,
I want **to export directly to Excel format (.xlsx)**,
So that **I get formatted spreadsheets ready for analysis**.

**Acceptance Criteria:**

**Given** I click the Export button
**When** the export menu opens
**Then** I also see options:
- "Export Current Page (Excel)"
- "Export All Data (Excel)"
- "Export Filtered Results (Excel)" (if filters active)

**Given** I select an Excel export option
**When** the export executes
**Then** an .xlsx file is generated
**And** column headers are bold/styled
**And** columns have appropriate widths based on content
**And** data types are preserved (numbers as numbers, dates as dates)

**Given** the table has date columns
**When** exported to Excel
**Then** dates are formatted as Excel dates (not text)
**And** Excel can sort/filter them as dates

**Given** the table has numeric columns
**When** exported to Excel
**Then** numbers are stored as numeric values
**And** right-aligned by default in Excel

**Given** the table has boolean columns
**When** exported to Excel
**Then** values export as TRUE/FALSE (Excel boolean)
**Or** as "Yes"/"No" text (configurable preference)

---

### Story 9.3: Import from CSV

As a **user**,
I want **to import data from a CSV file into the current table**,
So that **I can bulk-load data without manually entering rows**.

**Acceptance Criteria:**

**Given** a table is displayed in the grid
**When** I look at the toolbar
**Then** I see an "Import" button (upload icon)

**Given** I click the Import button
**When** the import dialog opens
**Then** I see:
- File selection (drag-and-drop zone + browse button)
- Link to "Download sample CSV template"
- Import options (header row yes/no)

**Given** I click "Download sample CSV template"
**When** the template downloads
**Then** it contains column headers matching the current table
**And** includes one sample row showing expected formats
**And** the filename is "{tablename}_template.csv"

**Given** I select a CSV file to import
**When** the file is parsed
**Then** I see a preview of the first 10 rows
**And** I see column mapping: CSV columns → Table columns
**And** I can adjust mappings if column names don't match exactly

**Given** the preview shows data
**When** I review the mapping
**Then** I see warnings for:
- Unmapped CSV columns (will be ignored)
- Required table columns with no mapping (blocking)
- Data type mismatches detected in preview

**Given** the mapping is valid
**When** I click "Import"
**Then** data is inserted row by row
**And** I see progress: "Importing... 50/100 rows"
**And** the import uses parameterized queries (SQL injection safe)

**Given** some rows fail validation during import
**When** the import completes
**Then** I see a summary:
- "Successfully imported: 95 rows"
- "Failed: 5 rows"
- Option to "Download error report" (CSV with failed rows + error reasons)

**Given** I review the error report
**When** I open it
**Then** each failed row shows the original data + specific error message
**And** I can fix the data and re-import just the failed rows

---

### Story 9.4: Import from Excel

As a **user**,
I want **to import data from an Excel file**,
So that **I can transfer data directly from spreadsheets without CSV conversion**.

**Acceptance Criteria:**

**Given** I click the Import button
**When** the import dialog opens
**Then** I can select .xlsx or .xls files in addition to .csv

**Given** I select an Excel file with multiple sheets
**When** the file is parsed
**Then** I see a sheet selector dropdown
**And** I can choose which sheet to import from

**Given** I select a sheet
**When** the preview loads
**Then** I see the same preview/mapping interface as CSV import
**And** Excel data types (dates, numbers) are recognized

**Given** the Excel file has formatted dates
**When** imported
**Then** dates are correctly converted to IRIS date format
**And** not imported as text strings

**Given** the Excel file has formulas
**When** imported
**Then** the calculated values are imported (not the formulas)

---

### Story 9.5: Import Validation & Rollback

As a **user**,
I want **import operations to validate data before committing**,
So that **I don't end up with partial imports or corrupted data**.

**Acceptance Criteria:**

**Given** I start an import
**When** the import settings show
**Then** I see an option: "Validate all rows before importing" (default: on)

**Given** "Validate all rows before importing" is enabled
**When** I click Import
**Then** all rows are validated first (dry run)
**And** if any row would fail, I see all errors upfront
**And** no data is inserted until I confirm

**Given** validation finds errors
**When** I review the validation report
**Then** I can choose:
- "Import valid rows only" (skip errors)
- "Cancel" (import nothing)
- "Download errors and fix" (abort, fix file, retry)

**Given** I choose "Import valid rows only"
**When** the import proceeds
**Then** only valid rows are inserted
**And** I receive the error report for failed rows

**Given** an import is in progress
**When** a database error occurs mid-import (connection lost, constraint violation)
**Then** I see clear error messaging
**And** I'm told how many rows succeeded before the error
**And** I can retry from where it stopped (if possible) or start over

**Given** I need to undo an import
**When** I realize I imported wrong data
**Then** I can use existing delete functionality row-by-row
**Or** (future enhancement) bulk delete by import batch ID

---

### Story 9.6: Export/Import Large Datasets

As a **user**,
I want **export and import to handle large datasets efficiently**,
So that **I can work with tables containing hundreds of thousands of rows**.

**Acceptance Criteria:**

**Given** I export a table with 100,000+ rows
**When** the export runs
**Then** data is streamed in chunks (not loaded all into memory)
**And** the UI remains responsive (non-blocking)
**And** I see progress updates every few seconds

**Given** I import a CSV with 50,000+ rows
**When** the import runs
**Then** rows are processed in batches (e.g., 1000 at a time)
**And** progress updates show: "Imported 10,000 / 50,000 rows"
**And** the import can be cancelled mid-operation

**Given** I cancel a large import mid-operation
**When** the cancellation processes
**Then** rows already imported remain in the database
**And** I'm told "Import cancelled. 12,345 rows were imported before cancellation."

**Given** export/import operations take more than a few seconds
**When** the operation is running
**Then** I can continue viewing (but not editing) the grid
**And** a status indicator shows the operation is in progress

**Performance Targets:**

| Scenario | Target |
|----------|--------|
| Export 10,000 rows to CSV | < 10 seconds |
| Export 10,000 rows to Excel | < 15 seconds |
| Import 10,000 rows from CSV | < 30 seconds |
| Import 10,000 rows from Excel | < 45 seconds |

---

## Epic 10: Monorepo Restructure & Shared Core Extraction

**Goal:** Restructure the project into a monorepo with shared packages so that core logic and webview UI can be reused by both the VS Code extension and the standalone desktop application.

**Phase:** Desktop Application (Foundation)
**Dependencies:** None — must come first before any other desktop epic.

**ARs covered:** AR14, AR15, AR16
**Implementation Sequence:** 10.1 → 10.2 → 10.3 → 10.4

---

### Story 10.1: Monorepo Initialization

As a **developer**,
I want **the project restructured as an npm workspaces monorepo**,
So that **shared code can be consumed by both VS Code and desktop targets**.

**Acceptance Criteria:**

**Given** the current flat project structure
**When** the monorepo restructure is applied
**Then** the root contains a `packages/` directory with:
- `packages/core/` — shared TypeScript services, models, utils
- `packages/webview/` — shared HTML, CSS, JS for the grid UI
- `packages/vscode/` — VS Code extension entry point and providers
**And** the root `package.json` has `"workspaces": ["packages/*"]`
**And** `npm install` at root succeeds and links all packages

**Given** the monorepo is initialized
**When** I run `npm run compile` at root
**Then** all packages compile without errors
**And** the VS Code extension builds to a runnable VSIX

**Given** each package has its own `package.json`
**When** I inspect dependency declarations
**Then** `packages/core` has no VS Code or Electron dependencies
**And** `packages/webview` has no VS Code or Electron dependencies
**And** `packages/vscode` can import from `@iris-table-editor/core` and `@iris-table-editor/webview`

**Given** the monorepo uses npm workspaces
**When** I run `npm run lint` at root
**Then** ESLint runs across all packages
**And** no new lint errors are introduced

---

### Story 10.2: Shared Core Extraction

As a **developer**,
I want **all pure TypeScript services, models, and utilities extracted into packages/core**,
So that **both VS Code and desktop targets share a single source of truth for business logic**.

**Acceptance Criteria:**

**Given** the current `src/services/`, `src/models/`, and `src/utils/` directories
**When** extraction is complete
**Then** the following are in `packages/core/src/`:
- `services/AtelierApiService.ts`
- `services/QueryExecutor.ts`
- `services/TableMetadataService.ts`
- `models/` (all TypeScript interfaces)
- `utils/SqlBuilder.ts`
- `utils/UrlBuilder.ts`
- `utils/ErrorHandler.ts`
- `utils/DataTypeFormatter.ts`
**And** none of these files import from `vscode` or `electron`

**Given** the core package is extracted
**When** `packages/vscode` imports from `@iris-table-editor/core`
**Then** all existing functionality works identically
**And** no runtime errors occur

**Given** the core package exports its public API
**When** I check `packages/core/src/index.ts`
**Then** all services, models, and utilities are re-exported
**And** the package can be consumed as a standard npm module

---

### Story 10.3: Webview Extraction & Theme Abstraction

As a **developer**,
I want **the webview HTML/CSS/JS extracted into packages/webview with `--ite-*` CSS variables replacing `--vscode-*`**,
So that **the grid UI can run identically in both VS Code and Electron targets**.

**Acceptance Criteria:**

**Given** the current `media/` directory contains webview files
**When** extraction is complete
**Then** `packages/webview/` contains:
- `webview.html` — shared grid HTML structure
- `styles.css` — all CSS using `--ite-*` variables (no direct `--vscode-*` references)
- `main.js` — webview logic using IMessageBridge abstraction
- `theme.css` — abstract `--ite-*` variable definitions
- `vscodeThemeBridge.css` — maps `--ite-*` → `--vscode-*`
- `desktopThemeBridge.css` — maps `--ite-*` → hardcoded light/dark tokens

**Given** `styles.css` has been migrated
**When** I search for `--vscode-` in `packages/webview/styles.css`
**Then** zero results are found
**And** all color references use `--ite-*` variables

**Given** `main.js` has been migrated to use IMessageBridge
**When** I search for `acquireVsCodeApi` in `packages/webview/main.js`
**Then** zero results are found
**And** all host communication uses `messageBridge.sendCommand()` and `messageBridge.onEvent()`

**Given** the VS Code target includes `vscodeThemeBridge.css`
**When** the grid renders in VS Code
**Then** the visual appearance is identical to before the migration
**And** all VS Code themes (light, dark, high contrast) render correctly

**Given** the desktop target includes `desktopThemeBridge.css`
**When** the grid renders in Electron
**Then** light theme and dark theme both render correctly
**And** colors match the VS Code dark/light theme appearance closely

---

### Story 10.4: VS Code Regression Verification

As a **developer**,
I want **to verify the VS Code extension works identically after the monorepo restructure**,
So that **existing users are not impacted by the desktop expansion**.

**Acceptance Criteria:**

**Given** the monorepo restructure is complete (Stories 10.1-10.3)
**When** I build the VS Code extension from `packages/vscode`
**Then** `npm run compile` succeeds without errors
**And** the extension activates in VS Code Extension Development Host

**Given** the restructured extension is running
**When** I perform the following operations
**Then** each works identically to before the restructure:

| Operation | Expected Result |
|-----------|-----------------|
| Connect to server | Server Manager authentication works |
| Browse namespaces | Namespaces list loads |
| Browse tables | Schema-based tree view works |
| Open table | Grid displays with data |
| Edit cell | Inline editing + save works |
| Add row | New row insertion works |
| Delete row | Confirmation + deletion works |
| Filter data | Inline + panel filtering works |
| Sort columns | Column sorting works |
| Pagination | Navigation controls work |
| Export CSV/Excel | Export downloads correctly |
| Import CSV/Excel | Import with mapping works |
| Keyboard shortcuts | All shortcuts work |
| Theme switching | Light/dark/HC themes work |

**Given** all existing tests exist
**When** I run `npm run test`
**Then** all tests pass
**And** no test modifications were needed beyond import path changes

**Given** the extension is packaged
**When** I run `npm run package` from `packages/vscode`
**Then** a valid .vsix file is produced
**And** installing it in VS Code works correctly

---

## Epic 11: Electron Shell & Window Management

**Goal:** Create the Electron application shell with window management, IPC bridge, tab bar, and native menus.

**Phase:** Desktop Application
**Dependencies:** Requires Epic 10 (monorepo) and Epic 12 (connection manager).

**FRs covered:** FR45, FR46, FR47, FR48
**ARs covered:** AR17, AR19
**NFRs addressed:** NFR19, NFR22, NFR23, NFR24
**Implementation Sequence:** 11.1 → 11.2 → 11.3 → 11.4 → 11.5

---

### Story 11.1: Electron Bootstrap

As a **developer**,
I want **a minimal Electron application that loads the shared webview**,
So that **we have a working desktop shell to build upon**.

**Acceptance Criteria:**

**Given** `packages/desktop/` exists in the monorepo
**When** I run the desktop application
**Then** an Electron window opens with the shared webview HTML
**And** the window has a title "IRIS Table Editor"

**Given** the Electron main process is configured
**When** I inspect the BrowserWindow options
**Then** `nodeIntegration` is `false`
**And** `contextIsolation` is `true`
**And** `sandbox` is `true`
**And** a preload script is configured

**Given** the preload script is loaded
**When** the renderer process starts
**Then** `window.electronAPI` is available via contextBridge
**And** no Node.js APIs are exposed to the renderer

**Given** the desktop app launches
**When** I measure startup time
**Then** the window is visible within 3 seconds on standard hardware

**Given** the desktop app is running
**When** I check the process tree
**Then** the main process and renderer are separate
**And** the renderer has restricted permissions (sandboxed)

---

### Story 11.2: IPC Bridge

As a **developer**,
I want **a typed IPC bridge connecting the Electron main process to the shared webview**,
So that **the webview can send commands and receive events identically to the VS Code target**.

**Acceptance Criteria:**

**Given** the webview uses IMessageBridge interface
**When** running in Electron
**Then** `ElectronMessageBridge` is injected
**And** `messageBridge.sendCommand()` calls `window.electronAPI.send()`
**And** `messageBridge.onEvent()` registers via `window.electronAPI.on()`

**Given** the main process receives an IPC message
**When** the message type is a known command (e.g., `selectServer`, `loadTables`, `updateRow`)
**Then** the main process routes to the appropriate handler
**And** the handler uses `@iris-table-editor/core` services

**Given** the main process completes an operation
**When** a response or event needs to be sent to the renderer
**Then** the main process sends via `webContents.send()`
**And** the webview receives via `messageBridge.onEvent()`

**Given** all IPC channels are defined
**When** I inspect the type definitions
**Then** each channel has typed payloads (no `any` types)
**And** the preload script only exposes declared channels

**Given** the IPC bridge is functional
**When** the webview sends `loadTables` with a namespace
**Then** the main process queries the IRIS server via AtelierApiService
**And** the result is sent back to the webview
**And** the grid displays the table data

---

### Story 11.3: Tab Bar

As a **user**,
I want **to open multiple tables as tabs within the desktop window**,
So that **I can work with several tables simultaneously**.

**Acceptance Criteria:**

**Given** the desktop application is running and connected to a server
**When** I double-click a table in the sidebar
**Then** a new tab opens in the tab bar with the table name
**And** the grid loads in the main content area

**Given** I have multiple tabs open
**When** I click a different tab
**Then** the active tab changes
**And** the main content area shows that tab's grid
**And** each tab retains its own state (filters, sort, scroll position, page)

**Given** I have a tab open
**When** I click the close button (✕) on the tab
**Then** the tab closes
**And** if there are unsaved changes, a confirmation prompt appears

**Given** the tab bar has many tabs
**When** tabs exceed the available width
**Then** the tab bar scrolls horizontally
**Or** overflow tabs are accessible via a dropdown

**Given** I open a table that is already open in another tab
**When** the table matches by name and namespace
**Then** the existing tab is focused (no duplicate tab created)

**Given** keyboard navigation
**When** I press Ctrl+Tab
**Then** focus moves to the next tab
**And** Ctrl+Shift+Tab moves to the previous tab
**And** Ctrl+W closes the current tab

---

### Story 11.4: Native Menu

As a **user**,
I want **a native menu bar with standard application menus**,
So that **the desktop app feels like a proper native application**.

**Acceptance Criteria:**

**Given** the desktop application is running
**When** I look at the title bar area
**Then** I see a native menu bar with: File, Edit, View, Help

**Given** the File menu
**When** I open it
**Then** I see:
- New Connection (opens server form)
- Disconnect (if connected)
- Close Tab (Ctrl+W)
- Close All Tabs
- Separator
- Exit (Alt+F4)

**Given** the Edit menu
**When** I open it
**Then** I see standard operations:
- Undo (Ctrl+Z)
- Separator
- Copy (Ctrl+C)
- Paste (Ctrl+V)
- Separator
- Set NULL (Ctrl+Shift+N)

**Given** the View menu
**When** I open it
**Then** I see:
- Toggle Sidebar (Ctrl+B)
- Toggle Filter Panel
- Separator
- Light Theme / Dark Theme (radio selection)
- Separator
- Keyboard Shortcuts (Ctrl+/)

**Given** the Help menu
**When** I open it
**Then** I see:
- Keyboard Shortcuts
- About IRIS Table Editor

**Given** menu items with keyboard shortcuts
**When** I use the shortcut directly
**Then** the action fires without opening the menu

---

### Story 11.5: Window State Persistence

As a **user**,
I want **the application to remember my window position and size**,
So that **I don't have to resize and reposition it every time I launch**.

**Acceptance Criteria:**

**Given** I resize the application window
**When** I close and reopen the app
**Then** the window opens at the same position and size

**Given** I maximize the window
**When** I close and reopen the app
**Then** the window opens maximized

**Given** I adjust the sidebar width by dragging
**When** I close and reopen the app
**Then** the sidebar width is restored

**Given** I toggle the sidebar closed
**When** I close and reopen the app
**Then** the sidebar state is restored (closed)

**Given** window state is stored via electron-store
**When** I check the storage location
**Then** settings are in the standard Electron userData directory
**And** no sensitive data is stored in the window state file

**Given** the stored window position is off-screen (e.g., monitor was disconnected)
**When** the app launches
**Then** the window is repositioned to be visible on the primary display

---

## Epic 12: Connection Manager

**Goal:** Built-in connection management for the desktop application, replacing VS Code Server Manager with a self-contained server CRUD UI and secure credential storage.

**Phase:** Desktop Application
**Dependencies:** Requires Epic 10 (monorepo).

**FRs covered:** FR39, FR40, FR41, FR42, FR43, FR44, FR50
**ARs covered:** AR18, AR19
**NFRs addressed:** NFR21
**Implementation Sequence:** 12.1 → 12.2 → 12.3 → 12.4 → 12.5

---

### Story 12.1: Server List UI

As a **user**,
I want **to see a list of my saved IRIS server connections**,
So that **I can choose which server to work with**.

**Acceptance Criteria:**

**Given** the desktop application launches
**When** I have no saved servers
**Then** I see the first-run welcome screen with "Add Your First Server" button

**Given** I have saved servers
**When** the application launches
**Then** I see a server list in the sidebar showing each server with:
- Status indicator (connected/disconnected)
- Server name
- Optional description
- Host:port

**Given** I see the server list
**When** I click on a server
**Then** the server is highlighted as selected
**And** Edit and Delete actions become available

**Given** I see the server list
**When** I double-click a server
**Then** the application connects to that server
**And** namespaces load in the sidebar below

**Given** I right-click a server
**When** the context menu opens
**Then** I see: Connect, Edit, Delete, Test Connection

---

### Story 12.2: Server Form

As a **user**,
I want **to add and edit server connection details through a form**,
So that **I can configure how the application connects to my IRIS servers**.

**Acceptance Criteria:**

**Given** I click the "Add" button ([+]) in the server list
**When** the server form opens
**Then** I see fields for:
- Server Name (required, unique)
- Description (optional)
- Host (required)
- Port (required, default 52773)
- Path Prefix (optional, default empty)
- Use HTTPS (checkbox)
- Username (required)
- Password (required, masked)

**Given** I fill in all required fields
**When** I click "Save"
**Then** the server is added to the list
**And** the form closes
**And** the new server appears in the sidebar

**Given** I leave a required field empty
**When** I click "Save"
**Then** I see validation errors on the empty fields
**And** the form is not submitted

**Given** I try to save a server with a duplicate name
**When** validation runs
**Then** I see "A server with this name already exists"
**And** the form is not submitted

**Given** I select an existing server and click "Edit"
**When** the form opens
**Then** all fields are pre-populated with the server's current values
**And** the password field shows dots (masked, not the actual password)
**And** I can modify any field and save

**Given** I am editing a server form
**When** I click "Cancel"
**Then** the form closes without saving
**And** no changes are applied

---

### Story 12.3: Test Connection

As a **user**,
I want **to test a server connection before saving it**,
So that **I can verify my settings are correct**.

**Acceptance Criteria:**

**Given** the server form is open with all required fields filled
**When** I click "Test Connection"
**Then** the button shows a spinner and "Testing..." text
**And** the button is disabled during the test

**Given** the test connection succeeds
**When** the result returns
**Then** I see a green "Connection successful" message
**And** the message appears near the Test Connection button
**And** the button returns to normal state

**Given** the test connection fails (wrong host, wrong credentials, timeout)
**When** the result returns
**Then** I see a red error message explaining the failure:
- "Could not reach host" (network error)
- "Authentication failed" (wrong credentials)
- "Connection timed out" (timeout)
**And** the button returns to normal state

**Given** the test connection is in progress
**When** the connection attempt takes more than 10 seconds
**Then** the test times out
**And** I see "Connection timed out. Check host and port."

**Given** I test with empty required fields
**When** I click "Test Connection"
**Then** form validation runs first
**And** if fields are missing, validation errors show instead of testing

---

### Story 12.4: Credential Storage

As a **developer**,
I want **server credentials stored securely using Electron's safeStorage API**,
So that **passwords are never stored in plaintext on disk**.

**Acceptance Criteria:**

**Given** a user saves a server with a password
**When** the password is persisted
**Then** it is encrypted using `safeStorage.encryptString()`
**And** the encrypted buffer is stored in electron-store
**And** the plaintext password is never written to disk

**Given** a user connects to a server
**When** the password is needed for authentication
**Then** it is decrypted using `safeStorage.decryptString()`
**And** the plaintext password is only held in memory during the connection attempt

**Given** server connection data is stored
**When** I inspect the electron-store data file
**Then** passwords appear as encrypted binary (not readable text)
**And** server names, hosts, and ports are stored in plaintext (not sensitive)
**And** usernames are stored in plaintext

**Given** safeStorage is available on the OS
**When** `safeStorage.isEncryptionAvailable()` returns true
**Then** encryption is used for all password storage
**And** the app functions normally

**Given** safeStorage is NOT available (rare edge case)
**When** `safeStorage.isEncryptionAvailable()` returns false
**Then** the app warns the user that passwords cannot be securely stored
**And** passwords are not persisted (user must re-enter each session)

---

### Story 12.5: Connection Lifecycle

As a **user**,
I want **to connect, disconnect, and switch between servers**,
So that **I can work with multiple IRIS environments from one application**.

**Acceptance Criteria:**

**Given** I double-click a server in the list (or select "Connect" from context menu)
**When** the connection initiates
**Then** I see "Connecting to [server name]..." with a progress indicator
**And** I see a Cancel button to abort the connection

**Given** the connection succeeds
**When** the server responds
**Then** the server status indicator changes to green (connected)
**And** namespaces load in the sidebar
**And** I can browse tables and open grids

**Given** the connection fails
**When** the error is returned
**Then** I see a clear error message
**And** the server status remains disconnected
**And** I can retry or edit the connection details

**Given** I am connected to a server
**When** I click "Disconnect" (sidebar button or File menu)
**Then** the connection is closed
**And** all open table tabs are closed (with unsaved changes prompt if needed)
**And** the server status returns to disconnected

**Given** I am connected to server A
**When** I double-click server B
**Then** server A is disconnected first (with unsaved changes prompt)
**And** server B connection initiates
**And** only one server is connected at a time (MVP)

**Given** I am connected and the network drops
**When** the next API call fails
**Then** I see "Connection lost. Check your network and try reconnecting."
**And** the server status changes to disconnected (red indicator)
**And** I can click "Reconnect" to attempt recovery

---

## Epic 13: Build, Package & Distribution

**Goal:** Configure electron-builder for Windows/macOS installers, auto-update via GitHub Releases, and CI/CD pipeline for dual-target builds.

**Phase:** Desktop Application
**Dependencies:** Requires Epic 11 (Electron shell).

**FRs covered:** FR49
**ARs covered:** AR20, AR21
**NFRs addressed:** NFR19, NFR20
**Implementation Sequence:** 13.1 → 13.2 → 13.3 → 13.4 (optional)

---

### Story 13.1: Electron Builder Config

As a **developer**,
I want **electron-builder configured to produce Windows and macOS installers**,
So that **end users can install the desktop application easily**.

**Acceptance Criteria:**

**Given** `packages/desktop/` has electron-builder configuration
**When** I run the build command for Windows
**Then** a `.exe` installer is produced (NSIS or Squirrel)
**And** the installer installs the app to Program Files
**And** a desktop shortcut and Start Menu entry are created

**Given** I run the build command for macOS
**When** the build completes
**Then** a `.dmg` installer is produced
**And** the DMG contains the `.app` bundle
**And** the app can be dragged to Applications

**Given** the installer is produced
**When** I check the file size
**Then** the installer is under 200MB

**Given** the build configuration
**When** I inspect `electron-builder.yml` or `package.json` build config
**Then** app ID, product name, and icon are configured
**And** file associations are not needed (no custom file types)

**Given** the app is installed via the installer
**When** I launch it
**Then** the app starts correctly
**And** the window shows "IRIS Table Editor" in the title bar

---

### Story 13.2: Auto-Update

As a **user**,
I want **the application to automatically check for and install updates**,
So that **I always have the latest features and fixes without manual downloads**.

**Acceptance Criteria:**

**Given** the app uses electron-updater
**When** the app launches
**Then** it checks for updates from GitHub Releases in the background
**And** the update check does not block app startup

**Given** an update is available
**When** the check completes
**Then** I see a non-intrusive notification: "Update available (v1.2.0). Restart to update."
**And** I can choose to "Restart Now" or "Later"

**Given** I click "Restart Now"
**When** the update installs
**Then** the app closes, installs the update, and restarts
**And** I see the new version running

**Given** I click "Later"
**When** the app continues
**Then** the update is downloaded in the background
**And** it installs automatically on next app close/restart

**Given** there is no update available
**When** the check completes
**Then** no notification is shown
**And** the app continues normally

**Given** the update check fails (no internet, server down)
**When** the check times out
**Then** no error is shown to the user
**And** the app continues normally
**And** the next check occurs on next launch

---

### Story 13.3: CI/CD Pipeline

As a **developer**,
I want **a CI/CD pipeline that builds both VS Code extension and desktop installers**,
So that **releases are automated and consistent across both targets**.

**Acceptance Criteria:**

**Given** a GitHub Actions workflow is configured
**When** I push a tag (e.g., `v1.0.0`)
**Then** the pipeline:
1. Runs lint and tests for all packages
2. Builds the VS Code extension (.vsix)
3. Builds Windows .exe installer
4. Builds macOS .dmg installer
5. Creates a GitHub Release with all artifacts

**Given** the pipeline runs
**When** it reaches the build step
**Then** each target builds independently
**And** failure in one target does not block others

**Given** a GitHub Release is created
**When** I view the release page
**Then** I see:
- `.vsix` file for VS Code
- `.exe` installer for Windows
- `.dmg` installer for macOS
- Release notes (from tag message or CHANGELOG)

**Given** the pipeline completes
**When** electron-updater checks for updates
**Then** it finds the new version on GitHub Releases
**And** the update flow works end-to-end

---

### Story 13.4: Code Signing (Optional)

As a **developer**,
I want **the desktop installers to be code-signed**,
So that **users don't see "Unknown Publisher" warnings on installation**.

**Acceptance Criteria:**

**Given** code signing certificates are configured
**When** the Windows build runs
**Then** the .exe is signed with the certificate
**And** Windows SmartScreen does not block installation

**Given** code signing certificates are configured
**When** the macOS build runs
**Then** the .app is signed and notarized
**And** macOS Gatekeeper allows installation

**Given** code signing is NOT configured (MVP)
**When** the unsigned builds are distributed
**Then** users see OS warnings but can still install
**And** documentation explains how to bypass the warnings

**Note:** This story is optional for initial release. The app can ship unsigned with known OS warnings.

---

## Epic 14: Integration Testing & Feature Parity

**Goal:** Verify feature parity between VS Code and desktop targets, cross-platform testing, and desktop-specific polish.

**Phase:** Desktop Application
**Dependencies:** Requires Epics 10, 11, 12, 13.

**NFRs addressed:** NFR19-NFR24 (verification)
**Implementation Sequence:** 14.1 → 14.2 → 14.3

---

### Story 14.1: Feature Parity Verification

As a **developer**,
I want **to verify that the desktop app has full feature parity with the VS Code extension**,
So that **users get the same experience regardless of which target they use**.

**Acceptance Criteria:**

**Given** the desktop app is running and connected to a server
**When** I perform each of the following operations
**Then** each works identically to the VS Code extension:

| # | Feature | Expected Behavior |
|---|---------|-------------------|
| 1 | Connect to server | Authentication succeeds, namespaces load |
| 2 | Browse namespaces | All namespaces listed, % encoding works |
| 3 | Browse tables | Schema-based tree view with expand/collapse |
| 4 | Open table | Grid displays with column headers and data |
| 5 | Pagination | First/prev/next/last + page input work |
| 6 | Cell selection | Click and keyboard navigation |
| 7 | Cell editing | Double-click/F2/type to edit, Tab/Enter to save |
| 8 | Edit cancellation | Escape restores original value |
| 9 | Add row | New row affordance, data entry, INSERT |
| 10 | Delete row | Selection, confirmation dialog, DELETE |
| 11 | Boolean checkbox | Single-click toggle, NULL state |
| 12 | Date picker | Calendar popup, flexible input |
| 13 | Time field | Multiple format acceptance |
| 14 | Numeric field | Right-aligned, thousands separators |
| 15 | NULL display | Italic gray "NULL", Set to NULL action |
| 16 | Timestamp field | Combined date-time editing |
| 17 | Inline filtering | Text wildcards, checklist dropdowns |
| 18 | Filter panel | Operators, sync with inline row |
| 19 | Column sorting | Click header cycle: asc → desc → clear |
| 20 | Export CSV | Current page, all data, filtered results |
| 21 | Export Excel | Formatted .xlsx with proper types |
| 22 | Import CSV | Template, mapping, validation, progress |
| 23 | Import Excel | Sheet selection, type recognition |
| 24 | Keyboard shortcuts | All categories work per shortcut reference |

**Given** all 24 checkpoints pass
**When** the verification is complete
**Then** feature parity is confirmed
**And** any discrepancies are documented as bugs

---

### Story 14.2: Cross-Platform Testing

As a **developer**,
I want **to verify the desktop app works correctly on Windows and macOS**,
So that **all target users can use the application reliably**.

**Acceptance Criteria:**

**Given** the Windows .exe installer
**When** installed on Windows 10 and Windows 11
**Then** the app installs, launches, and functions correctly
**And** window management (resize, maximize, minimize) works
**And** native menu bar renders correctly
**And** safeStorage encryption works with Windows Credential Manager

**Given** the macOS .dmg installer
**When** installed on macOS 11+
**Then** the app installs to Applications, launches, and functions correctly
**And** window management works with macOS conventions
**And** native menu bar renders in the macOS menu bar (not in window)
**And** safeStorage encryption works with macOS Keychain

**Given** either platform
**When** I test keyboard shortcuts
**Then** Ctrl-based shortcuts work on Windows
**And** Cmd-based shortcuts work on macOS (standard platform mapping)

**Given** either platform
**When** I test the auto-update flow
**Then** update detection, download, and installation work
**And** the app restarts successfully after update

---

### Story 14.3: Desktop Polish

As a **user**,
I want **the desktop app to feel polished and native**,
So that **it meets the same quality bar as the VS Code extension**.

**Acceptance Criteria:**

**Given** the desktop app is installed
**When** I look at the app icon in taskbar/dock
**Then** it shows the IRIS Table Editor icon (not the default Electron icon)

**Given** the About dialog
**When** I open it from Help menu
**Then** I see the app name, version, and credits

**Given** the first-run experience
**When** I launch the app for the first time
**Then** the welcome screen guides me through adding a server
**And** the flow is intuitive for non-developer users (< 60 seconds to first edit)

**Given** the app is running
**When** I use it for extended periods
**Then** no memory leaks are observed
**And** performance remains consistent

**Given** the dark theme is active
**When** I toggle to light theme
**Then** all UI elements update correctly
**And** no elements retain the wrong theme colors

**Given** error states
**When** connection fails, saves fail, or imports fail
**Then** error messages are clear and actionable
**And** the app recovers gracefully (no stuck states)
