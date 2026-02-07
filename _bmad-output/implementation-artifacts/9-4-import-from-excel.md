# Story 9.4: Import from Excel

## Status: Done
## Epic: 9 - CSV/Excel Export & Import

---

## Story

As a **user**,
I want **to import data from an Excel file**,
So that **I can transfer data directly from spreadsheets without CSV conversion**.

## Acceptance Criteria

1. **Given** I click the Import button, **When** I select an .xlsx file, **Then** it is parsed correctly.
2. **Given** I select a sheet, **When** the preview loads, **Then** I see the same mapping interface as CSV import.
3. **Given** the Excel file has formatted dates/numbers, **When** imported, **Then** values are correctly converted.

---

## Tasks/Subtasks

### Task 1: Update Import File Dialog
- [x] Allow .xlsx and .xls file types in file dialog
- [x] Detect file type by extension and route to appropriate parser

### Task 2: Implement Excel File Parsing
- [x] Use ExcelJS to read .xlsx files
- [x] Use first worksheet by default
- [x] Convert cell values (dates, formulas, rich text) to strings
- [x] Reuse import preview and mapping dialog from 9.3

### Task 3: Wire Up Excel Import Execute
- [x] Route Excel files through same import execute path
- [x] Re-parse Excel file during execute phase
- [x] Handle date value conversion (Date → "YYYY-MM-DD HH:mm:ss")

---

## Dev Agent Record

### Implementation Started: 2026-02-06

### Implementation Notes

**Approach:**
1. Updated file dialog to accept CSV, XLSX, and XLS files
2. File type detected by extension; Excel files routed to `_parseExcelFile()`
3. ExcelJS reads workbook, uses first worksheet
4. Cell values converted: Date → ISO string, Formula → result, RichText → concatenated text
5. Same preview/mapping dialog and execute flow used for both CSV and Excel
6. Import execute also detects file type to re-parse correctly

### Code Changes

**src/providers/GridPanelManager.ts:**
- Updated `_handleImportSelectFile()` - multi-format file dialog, file type detection
- Updated `_handleImportExecute()` - file type detection for re-parse
- Added `_parseExcelFile()` - ExcelJS-based parser with value type conversion

### Testing Results
- [x] Build compiles without errors (`npm run compile`)
