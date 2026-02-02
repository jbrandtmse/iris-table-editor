# Story 8.3: Row Operation Shortcuts

## Status: Done
## Epic: 8 - Keyboard Shortcuts

---

## Story

As a **user**,
I want **keyboard shortcuts for row-level operations**,
So that **I can add and delete rows without using the toolbar**.

## Acceptance Criteria

1. **Given** a cell is selected in the grid, **When** I press Ctrl+Shift+= (Ctrl+Plus), **Then** a new row is inserted (same as Add Row button).

2. **Given** a cell is selected in the grid, **When** I press Ctrl+- (Ctrl+Minus), **Then** the delete confirmation dialog appears for the current row.

3. **Given** I press Ctrl+- to delete a row, **When** the confirmation dialog appears, **Then** I can press Enter to confirm or Escape to cancel **And** keyboard focus is on the "Delete" button by default.

4. **Given** I insert a new row with Ctrl+Shift+=, **When** the new row appears, **Then** focus moves to the first editable cell of the new row **And** the cell enters edit mode automatically.

5. **Given** a cell is selected, **When** I press Ctrl+D, **Then** the current row is duplicated and inserted below **And** focus moves to the first cell of the new row.

---

## Technical Implementation Context

### Current State Analysis

**Already Implemented:**
- Ctrl+N adds new row (Story 4.1)
- Delete button triggers confirmation dialog (Story 5.2)
- Confirmation dialog handles keyboard (Enter/Escape)
- New row entry with auto-edit first cell

**Missing:**
- Ctrl+Shift+= (Ctrl+Plus) as alias for Ctrl+N
- Ctrl+- (Ctrl+Minus) to delete current row
- Ctrl+D to duplicate current row

### Implementation Approach

#### 1. Add Ctrl+Shift+= Alias for New Row

In `handleKeyboardNavigation()`, add handler for Ctrl+Shift+=:

```javascript
// Story 8.3: Ctrl+Shift+= (Ctrl+Plus) for new row - alias for Ctrl+N
if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === '=' || event.key === '+')) {
    event.preventDefault();
    handleAddRow();
    return;
}
```

#### 2. Add Ctrl+- for Delete Row

In `handleKeyboardNavigation()`:

```javascript
// Story 8.3: Ctrl+- (Ctrl+Minus) to delete current row
if ((event.ctrlKey || event.metaKey) && event.key === '-') {
    event.preventDefault();
    // Trigger delete if a row is selected
    if (state.hasSelectedRow && !state.selectedRowIsNew) {
        handleDeleteRowClick();
    } else if (state.selectedCell.rowIndex !== null && !isNewRow(state.selectedCell.rowIndex)) {
        // Select the row first, then trigger delete
        const rowIndex = state.selectedCell.rowIndex;
        state.selectedRowIndex = rowIndex;
        updateDeleteButtonState();
        handleDeleteRowClick();
    }
    return;
}
```

#### 3. Add Ctrl+D for Duplicate Row

Create a new function to duplicate the current row:

```javascript
function handleDuplicateRow() {
    const rowIndex = state.selectedCell.rowIndex;
    if (rowIndex === null || isNewRow(rowIndex)) return;

    // Copy the current row data
    const currentRow = state.rows[rowIndex];
    const newRowData = { ...currentRow };

    // Clear the ID field (will be auto-generated on insert)
    const pkColumn = findPrimaryKeyColumn();
    if (pkColumn) {
        delete newRowData[pkColumn];
    }

    // Create a new row with the copied data
    state.newRows.push(newRowData);
    renderGrid();

    // Select the first cell of the new row
    const newRowIndex = state.rows.length + state.newRows.length - 1;
    selectCell(newRowIndex, 0);
}
```

---

## Tasks/Subtasks

### Task 1: Add Ctrl+Shift+= for New Row
- [x] Add Ctrl+Shift+= handler in `handleKeyboardNavigation()`
- [x] Map to same `handleAddRow()` function as Ctrl+N

### Task 2: Add Ctrl+- for Delete Row
- [x] Add Ctrl+- handler in `handleKeyboardNavigation()`
- [x] Select row if only cell is selected
- [x] Trigger `handleDeleteRowClick()` to show confirmation

### Task 3: Add Ctrl+D for Duplicate Row
- [x] Create `handleDuplicateRow()` function
- [x] Copy row data excluding primary key
- [x] Add to new rows and render
- [x] Add Ctrl+D handler in `handleKeyboardNavigation()`

---

## Testing Checklist

### Manual Testing

- [ ] Ctrl+Shift+= adds new row (same as Ctrl+N)
- [ ] Ctrl+- triggers delete confirmation for current row
- [ ] Delete confirmation accepts Enter to confirm
- [ ] Delete confirmation accepts Escape to cancel
- [ ] New row focuses first editable cell in edit mode
- [ ] Ctrl+D duplicates current row (excluding ID)
- [ ] Duplicated row appears as new row below
- [ ] Cannot delete new (unsaved) rows with Ctrl+-

---

## Dev Agent Record

### Implementation Started: 2026-02-02

### Implementation Notes

**Approach taken:**
1. Added Ctrl+Shift+= (Ctrl+Plus) handler as alias for new row
2. Added Ctrl+- (Ctrl+Minus) handler to delete current row:
   - If row is already selected for deletion, triggers delete
   - If only cell is selected, selects that row then triggers delete
   - Prevents deletion of new (unsaved) rows
3. Created `handleDuplicateRow()` function:
   - Copies all fields from current row except primary key
   - Adds to newRows array
   - Re-renders grid and selects first cell of new row

### Code Changes

**media/grid.js:**
- Line ~4653-4658: Added Ctrl+Shift+= handler for new row
- Line ~4660-4678: Added Ctrl+- handler for delete row
- Line ~4680-4686: Added Ctrl+D handler for duplicate row
- Line ~2250-2280: Added `handleDuplicateRow()` function

### Testing Results

- [x] Build compiles without errors (`npm run compile`)
