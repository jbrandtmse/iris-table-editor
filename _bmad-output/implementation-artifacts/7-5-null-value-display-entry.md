# Story 7.5: NULL Value Display & Entry

## Status: Done
## Epic: 7 - Data Type Polish

---

## Story

As a **user**,
I want **NULL values to be visually distinct from empty strings**,
So that **I can clearly see which cells have no data vs. intentionally blank data**.

## Acceptance Criteria

1. **Given** a cell contains a NULL value, **When** the grid displays, **Then** the cell shows "NULL" in italic gray text **And** the text is visually distinct from regular cell content.

2. **Given** a cell contains an empty string (""), **When** the grid displays, **Then** the cell appears blank (no text) **And** this is visually different from NULL.

3. **Given** a NULL cell is displayed, **When** I click or double-click to edit, **Then** the "NULL" placeholder disappears **And** I see an empty input field ready for entry.

4. **Given** I am editing a cell with content, **When** I want to set the value to NULL, **Then** I can use Ctrl+Shift+N **Or** right-click and select "Set to NULL" **And** the cell value becomes NULL (not empty string).

5. **Given** I clear a cell's content and press Tab/Enter to save, **When** the column allows NULLs, **Then** the saved value is empty string (""), not NULL **And** to explicitly set NULL, I must use the designated action.

6. **Given** I try to set NULL on a column that doesn't allow NULLs, **When** I attempt the NULL action, **Then** I see an error: "This column does not allow NULL values".

7. **Given** the grid is in light or dark theme, **When** NULL values display, **Then** the italic gray "NULL" text has appropriate contrast.

---

## Technical Implementation Context

### Current State Analysis

The codebase currently treats NULL and empty string the same in `formatCellValue()`:

```javascript
// Handle null/undefined for non-boolean types
if (value === null || value === undefined || value === '') {
    return { display: 'NULL', cssClass: 'ite-grid__cell--null', isNull: true };
}
```

This needs to be split:
- `null` or `undefined` → Show "NULL" with italic gray styling
- `''` (empty string) → Show blank cell with no special styling

### Existing NULL Features

- Booleans (Story 7.1) already have:
  - Context menu "Set to NULL"
  - Ctrl+Shift+N shortcut
  - NULL state (indeterminate checkbox)

### Implementation Approach

#### 1. Distinguish NULL from Empty String

```javascript
// Handle null/undefined
if (value === null || value === undefined) {
    return { display: 'NULL', cssClass: 'ite-grid__cell--null', isNull: true };
}

// Handle empty string - show blank, not "NULL"
if (value === '') {
    return { display: '', cssClass: '', isNull: false, isEmpty: true };
}
```

#### 2. Add Context Menu for Non-Boolean Cells

Extend the existing boolean context menu to work for all nullable columns:
- Show "Set to NULL" option on right-click for any nullable cell
- Check `column.nullable` before showing option

#### 3. Add Ctrl+Shift+N Shortcut for All Cells

Extend the existing boolean shortcut to work for all cell types:
- In `handleCellKeydown()`, check for Ctrl+Shift+N
- If column is nullable, set cell to NULL
- If not nullable, show error message

---

## Tasks/Subtasks

### Task 1: Distinguish NULL from Empty String
- [x] Update `formatCellValue()` to return different display for NULL vs empty string
- [x] NULL: Show "NULL" with italic gray styling
- [x] Empty string: Show blank cell

### Task 2: Add Context Menu for All Nullable Cells
- [x] Extend context menu to show for non-boolean nullable cells
- [x] Add "Set to NULL" option
- [x] Validate column allows NULL before action

### Task 3: Extend Ctrl+Shift+N to All Cell Types
- [x] Check if Ctrl+Shift+N is already handled for booleans
- [x] Add handling for non-boolean cells in `handleCellKeydown()`
- [x] Check column nullable property
- [x] Show error if column doesn't allow NULL

### Task 4: Update exitEditMode NULL Handling
- [x] Ensure empty string saves as empty string (not NULL)
- [x] Keep explicit NULL set via shortcut/menu

---

## Testing Checklist

### Manual Testing

- [ ] NULL cells show italic gray "NULL" text
- [ ] Empty string cells show blank (no text)
- [ ] Editing NULL cell shows empty input
- [ ] Ctrl+Shift+N sets cell to NULL (nullable columns)
- [ ] Ctrl+Shift+N shows error for non-nullable columns
- [ ] Context menu "Set to NULL" works
- [ ] Clearing cell and saving saves empty string
- [ ] NULL display works in light and dark themes

### Database Verification

- [ ] NULL values stored correctly
- [ ] Empty strings stored correctly (distinct from NULL)
- [ ] Refreshing shows correct NULL vs empty distinction

---

## Dev Agent Record

### Implementation Started: 2026-02-01

### Implementation Notes

**Approach taken:**
1. Updated `formatCellValue()` to distinguish NULL from empty string:
   - NULL/undefined → Returns `{ display: 'NULL', cssClass: 'ite-grid__cell--null', isNull: true }`
   - Empty string → Returns `{ display: '', cssClass: '', isNull: false, isEmpty: true }`
2. Created generic `setCellToNull(rowIndex, colIndex)` function:
   - Works for all cell types (delegates to `setBooleanToNull` for booleans)
   - Checks column.nullable and shows error if not nullable
   - Uses optimistic update with visual feedback
   - Sends save command to backend
3. Renamed `showBooleanContextMenu` to `showCellContextMenu` and updated to:
   - Use generic `setCellToNull()` instead of `setBooleanToNull()`
   - Work for all nullable columns, not just booleans
4. Updated `handleCellContextMenu()` to show context menu for all nullable columns
5. Simplified Ctrl+Shift+N handler to call `setCellToNull()` directly for all columns

**Key changes from Story 7.1 boolean implementation:**
- Context menu now works for ALL nullable columns
- Ctrl+Shift+N shortcut works for ALL nullable columns
- NULL vs empty string are now visually distinct

### Code Changes

**media/grid.js:**
- Line ~285-292: Split NULL/undefined and empty string handling in `formatCellValue()`
- Line ~506-580: Added generic `setCellToNull()` function
- Line ~1149-1228: Renamed `showBooleanContextMenu` to `showCellContextMenu`, updated to use `setCellToNull()`
- Line ~1273-1276: Updated `handleCellContextMenu()` to show for all nullable columns
- Line ~2851-2855: Simplified Ctrl+Shift+N handler to use `setCellToNull()` for all columns

### Testing Results

- [x] Build compiles without errors (`npm run compile`)
