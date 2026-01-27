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
