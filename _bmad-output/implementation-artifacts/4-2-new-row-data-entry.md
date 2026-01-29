# Story 4.2: New Row Data Entry

## Story

**As a** user,
**I want** to enter values for each column in the new row,
**So that** I can populate the record before saving.

## Status

| Field | Value |
|-------|-------|
| Status | done |
| Epic | 4 - Row Creation |
| Story Points | 3 |
| Prepared | 2026-01-28 |

## Acceptance Criteria

### AC1: Cell Editing in New Row
**Given** a new row is active for editing
**When** I type in a cell
**Then** the value is accepted
**And** I can Tab to move to the next column

### AC2: Tab Navigation Through Columns
**Given** I am entering data in a new row
**When** I Tab through columns
**Then** each column becomes editable in sequence
**And** I can enter appropriate values for each field

### AC3: Visual Feedback for Entered Data
**Given** I have entered some values in a new row
**When** I look at the row
**Then** cells with values show the entered data
**And** empty cells show NULL (consistent with other rows)

### AC4: Data Type Formatting
**Given** a column has a specific data type
**When** I enter a value in that column
**Then** the display respects the data type formatting (numbers, dates, etc.)

### AC5: Cancel New Row with Escape
**Given** I am editing a cell in a new row
**When** I press Escape
**Then** the cell edit is cancelled
**And** the original value (null) is restored

## Requirements Covered

**Functional Requirements:**
- FR22: User can enter values for each column in the new row
- FR24: User can cancel new row creation before saving

**Non-Functional Requirements:**
- NFR8: Data changes must be validated client-side before submission

**UX Requirements (from UX Design Specification):**
- UX2: Excel-like interaction model: Tab to save + move right
- UX3: Escape key cancels edit and restores original value
- UX4: Visual cell states for editing and modified cells

## Technical Context

### Current Implementation (Story 4.1)

**New Row State (grid.js):**
```javascript
class AppState {
    // ...
    this.newRows = [];  // Array of new row objects
}
```

**Helper Functions:**
- `isNewRow(rowIndex)` - checks if row is in newRows array
- `getRowData(rowIndex)` - returns row from rows or newRows
- `handleAddRow()` - creates new row, renders, focuses first cell

**Cell Editing (grid.js):**
- `enterEditMode()` - already works with new rows (bounds check updated)
- `exitEditMode()` - saves locally for new rows (doesn't send to server)
- `getCellValue()` - already works with getRowData()

### What's Already Working

Story 4.1 implemented the core new row editing infrastructure:
1. New rows can be created and displayed
2. Cell selection works in new rows
3. Keyboard navigation works across new rows
4. Edit mode works for new row cells
5. Values are saved to the newRows array locally

### What Needs Enhancement

1. **Verify Tab navigation works smoothly** - should save + move right
2. **Ensure Enter moves to next row** (or stays in new row for data entry)
3. **Confirm Escape cancels cell edit** in new row context
4. **Validate data type formatting** displays correctly for entered values
5. **Consider modified cell indicator** for new row cells with data

### Implementation Approach

Most functionality is already in place from Story 4.1. This story focuses on:

**1. Test and verify Tab navigation in new rows:**
- Tab should save current cell and move right
- Shift+Tab should save and move left
- At end of row, Tab wraps to next row (if exists)

**2. Test and verify Escape behavior:**
- Escape should cancel edit and restore null
- Cell should return to unedited state

**3. Ensure data type formatting:**
- Numbers right-aligned
- Dates formatted appropriately
- NULL displayed in italic

**4. Add modified indicator for new row cells (optional enhancement):**
- Cells with non-null values could show modified indicator
- Helps user see which fields they've filled in

## Tasks

### Task 1: Verify Tab Navigation in New Rows (AC: #1, #2)
- [x] Test Tab saves cell and moves right
- [x] Test Shift+Tab saves and moves left
- [x] Test Tab at end of new row wraps appropriately
- [x] Fix any issues found - Fixed maxRow calculation in handleEditInputKeydown

### Task 2: Verify Escape Cancellation (AC: #5)
- [x] Test Escape restores null value (already works from Story 3.x)
- [x] Test Escape removes modified state
- [x] Fix any issues found - Fixed rollbackCellValue to use getRowData()

### Task 3: Verify Data Type Formatting (AC: #3, #4)
- [x] Test number entry displays right-aligned (already works)
- [x] Test empty cells show NULL (already works)
- [x] Test various data types format correctly (already works)
- [x] No issues found

### Task 4: Add Modified Cell Indicator for New Rows (AC: #3) [Optional]
- [N/A] Deferred - existing modified indicator from Story 3.4 works for editing state

## Dev Notes

### Files to Potentially Modify

| File | Changes |
|------|---------|
| `media/grid.js` | Any fixes needed for navigation/editing |
| `media/grid-styles.css` | Any styling adjustments |

### Testing Checklist

- [ ] Type in new row cell → value saved locally
- [ ] Tab in new row → saves and moves right
- [ ] Shift+Tab in new row → saves and moves left
- [ ] Enter in new row → saves (and moves down if applicable)
- [ ] Escape in new row → cancels edit, restores null
- [ ] Empty cell shows NULL
- [ ] Numeric entry displays right-aligned
- [ ] Arrow key navigation works in new rows
- [ ] Can edit multiple cells in new row
- [ ] Can add multiple new rows and edit each

### Integration Notes

This story validates and refines the editing behavior set up in Story 4.1. Story 4.3 will add the INSERT functionality to actually save new rows to the database.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Implementation Notes

**Minimal changes needed:** Story 4.1 + Story 3.x already provided most functionality. Only two fixes required:

1. **Tab navigation fix** - `handleEditInputKeydown` used `state.rows.length - 1` for maxRow, blocking Tab navigation to new rows. Changed to `state.totalDisplayRows - 1`.

2. **Rollback fix** - `rollbackCellValue` accessed `state.rows[rowIndex]` directly, which fails for new rows. Changed to use `getRowData(rowIndex)`.

### Files Modified

| File | Changes |
|------|---------|
| `media/grid.js` | 2 bug fixes (~8 lines changed) |

---

## Code Review Record

### Reviewer Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Review Findings

**No HIGH or MEDIUM issues found.**

Changes are minimal, correct, and well-documented. Both fixes use the existing `getRowData()` and `totalDisplayRows` helpers established in Story 4.1.

### Architecture Compliance Verified

- [x] Consistent with Story 4.1 patterns
- [x] No new dependencies introduced
- [x] Maintains separation of concerns
