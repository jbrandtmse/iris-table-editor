# Story 9.3: Import from CSV

## Status: Done
## Epic: 9 - CSV/Excel Export & Import

---

## Story

As a **user**,
I want **to import data from a CSV file into the current table**,
So that **I can bulk-load data without manually entering rows**.

## Acceptance Criteria

1. **Given** a table is displayed in the grid, **When** I look at the toolbar, **Then** I see an "Import" button (upload icon).
2. **Given** I click the Import button, **When** I select a CSV file, **Then** I see a preview with column mapping.
3. **Given** the mapping is valid, **When** I click "Import", **Then** data is inserted row by row with progress.
4. **Given** some rows fail, **When** the import completes, **Then** I see a success/failure summary.

---

## Tasks/Subtasks

### Task 1: Add Import Button to Toolbar
- [x] Add Import button to GridPanelManager HTML template

### Task 2: Implement Import File Selection and Parsing
- [x] Add `importSelectFile` command handler using `vscode.window.showOpenDialog()`
- [x] Implement RFC 4180 CSV parser (`_parseCsv()`)
- [x] Auto-detect column mapping (case-insensitive name match)
- [x] Send preview data to webview

### Task 3: Implement Import Dialog in Webview
- [x] Create `showImportDialog()` with column mapping UI
- [x] Show preview table of first 10 rows
- [x] Column mapping dropdowns (CSV → table columns or skip)
- [x] Add CSS styles for import dialog

### Task 4: Implement Server-Side Batch Import
- [x] Add `importExecute` command handler
- [x] Insert rows one by one using existing `insertRow()` mechanism
- [x] Progress reporting every 10 rows
- [x] Per-row error tracking and summary

### Task 5: Wire Up Events
- [x] Handle `importPreview`, `importProgress`, `importResult` events in webview
- [x] Auto-refresh data after successful import

---

## Dev Agent Record

### Implementation Started: 2026-02-06

### Implementation Notes

**Approach:**
1. Import button opens OS file dialog via extension (`showOpenDialog`)
2. Extension parses CSV and sends preview + auto-mapped columns to webview
3. Webview shows mapping dialog where user can adjust CSV→table column mappings
4. On execute, extension re-reads file and inserts rows one by one
5. Progress updates every 10 rows, errors collected per-row
6. Grid auto-refreshes after successful import

### Code Changes

**src/providers/GridPanelManager.ts:**
- Added Import button to toolbar HTML
- Added `importSelectFile` and `importExecute` cases in message handler
- Added `_handleImportSelectFile()` - file dialog, parse, preview
- Added `_handleImportExecute()` - batch row insert with progress
- Added `_parseCsv()` - RFC 4180 compliant CSV parser

**media/grid.js:**
- Added import state variable and functions
- Added `handleImportClick()`, `handleImportPreview()`, `showImportDialog()`
- Added `handleImportProgress()`, `handleImportResult()`
- Added event listeners and message handlers

**media/grid-styles.css:**
- Added `.ite-import-dialog`, `.ite-import-mapping`, `.ite-import-preview` styles

### Testing Results
- [x] Build compiles without errors (`npm run compile`)
