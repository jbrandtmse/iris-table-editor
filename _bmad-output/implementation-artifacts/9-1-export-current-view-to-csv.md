# Story 9.1: Export Current View to CSV

## Status: Done
## Epic: 9 - CSV/Excel Export & Import

---

## Story

As a **user**,
I want **to export the current table view to a CSV file**,
So that **I can analyze data in Excel or share it with colleagues**.

## Acceptance Criteria

1. **Given** a table is displayed in the grid, **When** I look at the toolbar, **Then** I see an "Export" button (download icon).

2. **Given** I click the Export button, **When** the export menu opens, **Then** I see options: "Export Current Page (CSV)", "Export All Data (CSV)", "Export Filtered Results (CSV)" (if filters active).

3. **Given** I select "Export Current Page (CSV)", **When** the export executes, **Then** a CSV file is generated containing only the currently visible rows **And** a save dialog opens.

4. **Given** I select "Export All Data (CSV)", **When** the table has many rows, **Then** I see a progress indicator **And** data is fetched in chunks to avoid memory issues.

5. **Given** the CSV is generated, **When** I open it in Excel, **Then** columns are properly separated **And** values containing commas are quoted **And** the file uses UTF-8 encoding with BOM for Excel compatibility.

---

## Technical Implementation Context

### Current State Analysis

- No export functionality exists
- Toolbar has buttons for Refresh, Add Row, Save Row, Delete Row, Filter controls
- Data is available in `state.rows` (current page) and `state.columns` (schema)
- Webview communicates with extension via `sendCommand()`/`handleMessage()`
- Extension handles messages in `GridPanelManager._handleGridMessage()`

### Implementation Approach

#### Client-side CSV for Current Page
- Use `state.rows` and `state.columns` to generate CSV directly in webview
- Create Blob with UTF-8 BOM for Excel compatibility
- Trigger download via anchor element click
- No server round-trip needed for current page

#### Server-side CSV for All Data / Filtered Results
- Send `exportAllCsv` command to extension with filters/sort
- Extension fetches all data (paginated chunks of 1000) and builds CSV
- Extension uses `vscode.window.showSaveDialog()` for file save
- Extension writes file with `vscode.workspace.fs.writeFile()`
- Sends progress and result events back to webview

---

## Tasks/Subtasks

### Task 1: Add Export Button and Dropdown Menu to Toolbar
- [x] Add Export button to GridPanelManager HTML template
- [x] Add CSS styles for export dropdown menu
- [x] Add event listener in grid.js init()

### Task 2: Implement Client-Side CSV Export (Current Page)
- [x] Create `generateCsvContent()` function
- [x] Create `downloadCsv()` function with Blob and UTF-8 BOM
- [x] Handle proper CSV escaping (commas, quotes, newlines per RFC 4180)

### Task 3: Implement Server-Side CSV Export (All Data / Filtered)
- [x] Add `exportAllCsv` command handler in GridPanelManager
- [x] Add `_handleExportAllCsv()` with chunked data fetching (1000 rows/chunk)
- [x] Use `vscode.window.showSaveDialog()` for file selection
- [x] Write CSV file with UTF-8 BOM encoding
- [x] Send progress and result events back to webview

### Task 4: Add Export Keyboard Shortcut
- [x] Add Ctrl+E for export menu toggle
- [x] Add Ctrl+E to keyboard shortcuts help dialog

---

## Testing Checklist

### Manual Testing

- [ ] Export button appears in toolbar
- [ ] Clicking Export shows dropdown menu with options
- [ ] "Export Current Page (CSV)" downloads CSV of visible rows
- [ ] "Export All Data (CSV)" opens save dialog and exports all rows
- [ ] "Export Filtered Results (CSV)" appears only when filters are active
- [ ] CSV file opens correctly in Excel
- [ ] Values with commas are properly quoted
- [ ] UTF-8 characters display correctly
- [ ] Progress bar shows during large exports
- [ ] Ctrl+E toggles export menu
- [ ] Export menu closes when clicking outside

---

## Dev Agent Record

### Implementation Started: 2026-02-06

### Implementation Notes

**Approach taken:**
1. Added Export toolbar button with dropdown menu (3 options)
2. Current page export is client-side using Blob + download link (no server round-trip)
3. All data / filtered export is server-side via extension command handler
4. Server-side export uses chunked fetching (1000 rows per chunk) with progress events
5. Extension uses `vscode.window.showSaveDialog()` for file selection and `vscode.workspace.fs.writeFile()` for writing
6. CSV escaping per RFC 4180 (quotes, commas, newlines)
7. UTF-8 BOM for Excel compatibility

### Code Changes

**src/providers/GridPanelManager.ts:**
- Added Export button + dropdown menu to toolbar HTML template
- Added `exportAllCsv` case in `_handleGridMessage()`
- Added `_handleExportAllCsv()` method for server-side export
- Added `_csvEscapeValue()` utility method

**media/grid.js:**
- Added export functions: `toggleExportMenu()`, `closeExportMenu()`, `csvEscapeValue()`, `generateCsvContent()`, `downloadCsv()`
- Added handlers: `handleExportCurrentPageCsv()`, `handleExportAllCsv()`, `handleExportFilteredCsv()`
- Added progress/result handlers: `handleExportProgress()`, `handleExportResult()`
- Added event listeners in `init()` for export button and menu items
- Added click-outside handler for export menu
- Added Ctrl+E shortcut in `handleKeyboardNavigation()`
- Added Ctrl+E to keyboard shortcuts help dialog

**media/grid-styles.css:**
- Added `.ite-export-menu` and `.ite-export-menu__item` styles
- Added `.ite-export-progress` styles

### Testing Results

- [x] Build compiles without errors (`npm run compile`)
