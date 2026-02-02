# Story 8.2: Cell Editing Shortcuts

## Status: Done
## Epic: 8 - Keyboard Shortcuts

---

## Story

As a **user**,
I want **keyboard shortcuts to enter and exit edit mode quickly**,
So that **I can edit data efficiently without mouse clicks**.

## Acceptance Criteria

**When cell is SELECTED (not in edit mode):**

1. **Given** a cell is selected, **When** I press F2, **Then** cell enters edit mode with cursor at end of content.

2. **Given** a cell is selected, **When** I press Enter, **Then** cell enters edit mode with cursor at end of content.

3. **Given** a cell is selected, **When** I type any printable character, **Then** cell enters edit mode and content is replaced with typed character.

4. **Given** a cell is selected, **When** I press Delete, **Then** cell content is cleared (set to empty string) and saved immediately.

5. **Given** a cell is selected, **When** I press Backspace, **Then** cell enters edit mode with content cleared, ready to type.

**When cell is IN EDIT mode:**

6. **Given** a cell is in edit mode, **When** I press Enter, **Then** change is saved and selection moves DOWN one cell.

7. **Given** a cell is in edit mode, **When** I press Tab, **Then** change is saved and selection moves RIGHT one cell.

8. **Given** a cell is in edit mode, **When** I press Shift+Enter, **Then** change is saved and selection moves UP one cell.

9. **Given** a cell is in edit mode, **When** I press Shift+Tab, **Then** change is saved and selection moves LEFT one cell.

10. **Given** a cell is in edit mode, **When** I press Escape, **Then** edit is cancelled, original value restored, cell stays selected.

11. **Given** a cell is in edit mode, **When** I press Ctrl+Enter, **Then** change is saved and cell stays on current position (no movement).

12. **Given** a cell is in edit mode, **When** I press Ctrl+Z, **Then** the edit is undone (restores original value) and cell remains in edit mode.

---

## Technical Implementation Context

### Current State Analysis

**Already Implemented (Story 3.2):**
- F2 to enter edit mode (cursor at end)
- Printable characters start edit mode (overwrite)
- Backspace enters edit mode with empty content
- Tab/Shift+Tab save and move right/left
- Escape cancels edit

**Missing:**
- Enter (not editing) to enter edit mode
- Delete to clear cell content immediately (not enter edit mode)
- Enter (editing) to save and move DOWN
- Shift+Enter to save and move UP
- Ctrl+Enter to save and stay
- Ctrl+Z to undo in edit mode

### Implementation Approach

#### 1. Add Enter Key to Enter Edit Mode (when selected, not editing)

In `handleCellKeydown()`, add Enter case to enter edit mode:

```javascript
case 'Enter':
    event.preventDefault();
    enterEditMode(rowIndex, colIndex, null, 'end');
    return;
```

#### 2. Change Delete Key Behavior

Currently Delete enters edit mode with empty string. Instead:
- Delete should save empty string immediately (clear cell)
- Keep Backspace as enter-edit-with-clear

#### 3. Modify Enter in Edit Mode to Move Down

In `handleEditInputKeydown()`, change Enter to move down after saving:

```javascript
case 'Enter':
    if (event.shiftKey) {
        // Shift+Enter: Save and move UP
        exitEditMode(true);
        if (rowIndex > 0) selectCell(rowIndex - 1, colIndex);
    } else if (event.ctrlKey || event.metaKey) {
        // Ctrl+Enter: Save and stay
        exitEditMode(true);
    } else {
        // Enter: Save and move DOWN
        exitEditMode(true);
        if (rowIndex < maxRow) selectCell(rowIndex + 1, colIndex);
    }
    break;
```

#### 4. Add Ctrl+Z for Undo in Edit Mode

In `handleEditInputKeydown()`:

```javascript
// Ctrl+Z: Undo (restore original value)
if (event.ctrlKey && event.key === 'z') {
    const input = event.target;
    input.value = state.editOriginalValue ?? '';
    event.preventDefault();
    return;
}
```

---

## Tasks/Subtasks

### Task 1: Enter Key to Start Edit Mode
- [x] Add Enter case in `handleCellKeydown()` to enter edit mode (when not already editing)

### Task 2: Modify Delete Key Behavior
- [x] Change Delete to save empty string immediately (clear without entering edit)
- [x] Keep Backspace as enter-edit-with-clear

### Task 3: Enter Key Navigation in Edit Mode
- [x] Modify Enter in `handleEditInputKeydown()` to save and move DOWN
- [x] Add Shift+Enter to save and move UP
- [x] Add Ctrl+Enter to save and stay on current cell

### Task 4: Add Ctrl+Z for Undo
- [x] Add Ctrl+Z handler in `handleEditInputKeydown()` to restore original value
- [x] Keep cell in edit mode after undo

---

## Testing Checklist

### Manual Testing

**Selection Mode:**
- [ ] F2 enters edit mode (cursor at end)
- [ ] Enter enters edit mode (cursor at end)
- [ ] Typing character enters edit mode with that character
- [ ] Delete clears cell immediately (saves empty string)
- [ ] Backspace enters edit mode with content cleared

**Edit Mode:**
- [ ] Enter saves and moves DOWN
- [ ] Tab saves and moves RIGHT
- [ ] Shift+Enter saves and moves UP
- [ ] Shift+Tab saves and moves LEFT
- [ ] Escape cancels and restores original value
- [ ] Ctrl+Enter saves and stays on current cell
- [ ] Ctrl+Z restores original value (stays in edit mode)

---

## Dev Agent Record

### Implementation Started: 2026-02-02

### Implementation Notes

**Approach taken:**
1. Added Enter case in `handleCellKeydown()` to enter edit mode (non-boolean cells)
2. Changed Delete behavior to save empty string immediately instead of entering edit mode
3. Modified `handleEditInputKeydown()` Enter handler to:
   - Enter: Save and move DOWN
   - Shift+Enter: Save and move UP
   - Ctrl/Meta+Enter: Save and stay on current cell
4. Added Ctrl+Z handler to restore original value while staying in edit mode

### Code Changes

**media/grid.js:**
- Line ~2991: Added Enter case in `handleCellKeydown()` to enter edit mode
- Line ~3076-3080: Changed Delete to save empty immediately
- Line ~2671-2705: Modified Enter handler in `handleEditInputKeydown()` for directional movement
- Line ~2706-2712: Added Ctrl+Z handler for undo

### Testing Results

- [x] Build compiles without errors (`npm run compile`)
