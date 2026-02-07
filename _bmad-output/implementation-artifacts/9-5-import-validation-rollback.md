# Story 9.5: Import Validation & Rollback

## Status: Done
## Epic: 9 - CSV/Excel Export & Import

---

## Story

As a **user**,
I want **import operations to validate data before committing**,
So that **I don't end up with partial imports or corrupted data**.

## Acceptance Criteria

1. **Given** I start an import, **When** the import settings show, **Then** I see a "Validate before importing" checkbox (default: on).
2. **Given** validation is enabled, **When** I click Import, **Then** all rows are validated first **And** I see all errors upfront before any data is inserted.
3. **Given** validation finds errors, **When** I review the results, **Then** I can choose "Import valid rows only" or "Cancel".

---

## Tasks/Subtasks

### Task 1: Add Validation Checkbox to Import Dialog
- [x] Add "Validate before importing" checkbox (default checked)

### Task 2: Implement Dry Run Validation
- [x] Add `importValidate` command that checks rows without inserting
- [x] Return per-row validation results
- [x] Show validation summary with error details

### Task 3: Add Import Options After Validation
- [x] "Import valid rows only" button
- [x] "Cancel" button
- [x] Show error details in scrollable list

---

## Dev Agent Record

### Implementation Started: 2026-02-06

### Implementation Notes

**Approach:**
1. Added "Validate before importing" checkbox (default: checked) to import dialog
2. When checked, clicking Import sends `importValidate` instead of `importExecute`
3. `_handleImportValidate()` re-parses the file, builds column mappings, then validates each row:
   - Checks required (non-nullable) fields are not empty
   - Checks max length constraints for string types
   - Checks numeric types parse correctly
4. Validation results sent back with per-row errors, valid count, and error count
5. If all rows valid, auto-proceeds to import
6. If errors found, shows validation results dialog with:
   - Summary stats (valid/error counts)
   - Scrollable error list (first 50 shown)
   - "Import N valid rows" button and "Cancel" button
7. "Import valid rows only" sends `importExecute` with `skipInvalidRows: true` and `invalidRowNumbers` array
8. `_handleImportExecute()` updated to skip rows whose row numbers are in the invalid set

### Code Changes

**src/providers/GridPanelManager.ts:**
- Added `_handleImportValidate()` - dry-run validation with schema-aware checks
- Updated `_handleImportExecute()` - supports `skipInvalidRows` and `invalidRowNumbers` params
- Updated `importExecute` payload type to include optional skip fields

**media/grid.js:**
- Added `handleImportValidationResult()` - processes validation results
- Added `showValidationResultsDialog()` - validation results UI with import/cancel options
- Added validation checkbox to import dialog
- Updated execute handler to route to validate or execute based on checkbox
- Added `importValidationResult` event handler in message handler
- Added `pendingImportPayload` state variable

**media/grid-styles.css:**
- Added `.ite-import-options`, `.ite-import-checkbox` styles
- Added `.ite-validation-summary`, `.ite-validation-stat` styles
- Added `.ite-validation-errors`, `.ite-validation-error` styles

### Testing Results
- [x] Build compiles without errors (`npm run compile`)
