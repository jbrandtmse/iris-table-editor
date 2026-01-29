# Story 5.1: Row Selection for Deletion

## Story

**As a** user,
**I want** to select a row and indicate I want to delete it,
**So that** I can remove unwanted records from the table.

## Status

| Field | Value |
|-------|-------|
| Status | done |
| Epic | 5 - Row Deletion |
| Story Points | 3 |
| Prepared | 2026-01-28 |

## Acceptance Criteria

### AC1: Delete Row Button in Toolbar
**Given** the table grid is displayed
**When** I look at the toolbar
**Then** I see a "Delete Row" button (trash icon)
**And** it is disabled when no row is selected

### AC2: Row Selector Affordance
**Given** the grid displays rows
**When** I look at the left edge of each row
**Then** I see a row selector (checkbox or clickable area)

### AC3: Row Selection via Row Selector
**Given** I click on a row selector
**When** the click registers
**Then** the entire row is visually highlighted as selected
**And** the "Delete Row" button becomes enabled

### AC4: Single Row Selection Mode
**Given** a row is selected
**When** I click on a different row's selector
**Then** the new row becomes selected
**And** the previous selection is cleared (single-select mode for MVP)

### AC5: Row Deselection
**Given** a row is selected
**When** I click the row selector again
**Then** the row is deselected
**And** the "Delete Row" button becomes disabled

### AC6: Accessibility Support
**Given** the row selector is focusable
**When** I use keyboard navigation
**Then** I can select/deselect rows with Space or Enter
**And** screen readers announce the selection state

## Requirements Covered

**Functional Requirements:**
- FR26: User can select a row for deletion

**Non-Functional Requirements:**
- NFR4: UI interactions respond within 100ms (no blocking)

**UX Requirements (from UX Design Specification):**
- UX6: Toolbar with icon buttons - Delete Row
- Row selector checkbox column on left (familiar from Excel)
- Single-select mode for MVP

**From Architecture:**
- CSS classes with `ite-` prefix and BEM structure
- Screen reader support via ARIA attributes

## Technical Context

### Current Implementation Analysis

**Grid Structure (grid.js):**
```javascript
// Current state management
class AppState {
    // Cell selection exists but no row selection
    this.selectedCell = { rowIndex: null, colIndex: null };
}

// Row rendering (renderSingleRow function)
function renderSingleRow(grid, row, rowIndex, isNew) {
    const dataRow = document.createElement('div');
    dataRow.className = isNew ? 'ite-grid__row ite-grid__row--new' : 'ite-grid__row';
    dataRow.setAttribute('role', 'row');
    // Currently no row selector column
}
```

**Toolbar Structure (GridPanelManager.ts):**
```html
<!-- Current toolbar buttons -->
<button id="refreshBtn" class="ite-toolbar__button" title="Refresh data">
    <i class="codicon codicon-refresh"></i>
</button>
<button id="addRowBtn" class="ite-toolbar__button" title="Add new row (Ctrl+N)">
    <i class="codicon codicon-add"></i>
</button>
<button id="saveRowBtn" class="ite-toolbar__button" title="Save row (Ctrl+S)" disabled>
    <i class="codicon codicon-save"></i>
</button>
```

**Message Types (IMessages.ts):**
- No delete-related commands or events exist yet
- Pattern established: command from webview → extension → response event

### Design Decisions

**Row Selector Approach:**
Per UX spec, use a checkbox column on the left for row selection (Excel/Access pattern). This provides:
- Clear visual affordance
- Familiar interaction model
- Extensible for future multi-select

**Selection State:**
- Add `selectedRowIndex: number | null` to AppState (separate from cell selection)
- Row selection and cell selection can coexist
- Clicking a cell does NOT select the row (different operations)

**Visual States:**
- `.ite-grid__row--selected` - Entire row highlighted background
- Row selector checkbox shows checked state
- Delete button enabled when row selected

### Files to Modify

| File | Changes |
|------|---------|
| `src/providers/GridPanelManager.ts` | Add Delete Row button to toolbar HTML |
| `media/grid.js` | Add row selection state, row selector column, click handlers |
| `media/grid-styles.css` | Add row selector and row selected styles |

### NO Backend Changes Required
Story 5.1 is purely frontend - no server communication needed. The actual DELETE will be implemented in Story 5.3.

## Tasks

### Task 1: Add Row Selection State to AppState (AC: #3, #4, #5)
- [x] Add `selectedRowIndex: number | null` property to AppState class
- [x] Add `get hasSelectedRow()` computed property
- [x] Add `get selectedRowIsNew()` helper (can't delete new rows)
- [x] Persist selectedRowIndex in vscode state

### Task 2: Add Delete Row Button to Toolbar (AC: #1)
- [x] Add Delete Row button HTML in GridPanelManager.ts
- [x] Use `codicon-trash` icon
- [x] Add tooltip "Delete row (Del)" with keyboard shortcut hint
- [x] Set `disabled` by default
- [x] Position after Save Row button

### Task 3: Add Row Selector Column to Grid (AC: #2)
- [x] Modify renderHeader() to add selector column header (checkbox for "select all" appearance, but just visual for MVP)
- [x] Modify renderSingleRow() to add selector cell as first column
- [x] Use checkbox input or styled div for selector
- [x] Adjust grid-template-columns to include selector column
- [x] Set appropriate width (32-40px)

### Task 4: Implement Row Selection Handlers (AC: #3, #4, #5)
- [x] Add handleRowSelectorClick(rowIndex) function
- [x] Toggle selection on click (select if not selected, deselect if selected)
- [x] Clear previous selection when selecting different row
- [x] Update selectedRowIndex state
- [x] Trigger visual update and button state update

### Task 5: Add Visual Feedback for Selected Row (AC: #3)
- [x] Add `.ite-grid__row--selected` CSS class with highlighted background
- [x] Style checkbox as checked when row selected
- [x] Ensure selection persists across re-renders
- [x] Handle selection when row is scrolled into view

### Task 6: Implement Delete Button State Management (AC: #1, #3, #5)
- [x] Add updateDeleteButtonState() function
- [x] Enable button when selectedRowIndex !== null AND !isNewRow
- [x] Disable button when no row selected or new row selected
- [x] Call on selection change, render, and state restore

### Task 7: Add Keyboard Support for Row Selection (AC: #6)
- [x] Add Delete key handler to select row for deletion (if row selector focused)
- [x] Add Space/Enter on row selector to toggle selection
- [x] Ensure focus management works with Tab navigation

### Task 8: Add ARIA Accessibility Support (AC: #6)
- [x] Add `aria-selected` to rows
- [x] Add `role="checkbox"` to row selector
- [x] Add `aria-checked` to reflect selection state
- [x] Announce selection changes via live region

## Dev Notes

### Row Selector Column Implementation

```javascript
// In renderHeader()
const selectorHeader = document.createElement('div');
selectorHeader.className = 'ite-grid__header-cell ite-grid__header-cell--selector';
selectorHeader.setAttribute('role', 'columnheader');
// Empty or checkbox icon for visual consistency
headerRow.insertBefore(selectorHeader, headerRow.firstChild);

// In renderSingleRow()
const selectorCell = document.createElement('div');
selectorCell.className = 'ite-grid__cell ite-grid__cell--selector';
selectorCell.setAttribute('role', 'gridcell');
selectorCell.setAttribute('tabindex', '0');

const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
checkbox.className = 'ite-row-selector__checkbox';
checkbox.checked = state.selectedRowIndex === rowIndex;
checkbox.setAttribute('aria-label', `Select row ${rowIndex + 1}`);
checkbox.addEventListener('click', (e) => {
    e.stopPropagation(); // Don't trigger cell click
    handleRowSelectorClick(rowIndex);
});

selectorCell.appendChild(checkbox);
dataRow.insertBefore(selectorCell, dataRow.firstChild);
```

### CSS Styles to Add (grid-styles.css)

```css
/* Row Selector Column */
.ite-grid__cell--selector,
.ite-grid__header-cell--selector {
    width: 32px;
    min-width: 32px;
    max-width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
}

.ite-row-selector__checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--vscode-checkbox-selectBackground);
}

/* Selected Row State */
.ite-grid__row--selected {
    background-color: var(--vscode-list-activeSelectionBackground);
}

.ite-grid__row--selected .ite-grid__cell {
    background-color: inherit;
}
```

### Integration with Existing Cell Selection

Row selection and cell selection are **independent**:
- Cell selection (existing): `state.selectedCell = { rowIndex, colIndex }`
- Row selection (new): `state.selectedRowIndex = number | null`

Clicking a cell does NOT select the row.
Clicking the row selector does NOT change cell selection.

This allows users to:
1. Navigate cells with arrow keys (cell selection)
2. Select a row for deletion (row selection)
3. Both can be active simultaneously

### Delete Button Position

```html
<!-- Toolbar order after this story -->
<button id="refreshBtn">...</button>
<button id="addRowBtn">...</button>
<button id="saveRowBtn">...</button>
<button id="deleteRowBtn">...</button>  <!-- NEW -->
```

### Edge Cases to Handle

1. **New row selected**: Delete button should be disabled (use Escape to cancel new row instead)
2. **Pagination change**: Clear row selection (row indices change)
3. **Data refresh**: Clear row selection (data may have changed)
4. **No rows in table**: No row selectors to show

### Testing Checklist

- [ ] Delete button shows in toolbar (disabled by default)
- [ ] Row selector column appears in grid
- [ ] Click row selector → row highlighted, delete button enabled
- [ ] Click different row selector → previous deselected, new selected
- [ ] Click same row selector again → row deselected, delete button disabled
- [ ] Select new row → delete button stays disabled (new rows can't be deleted)
- [ ] Tab to row selector, Space/Enter → toggles selection
- [ ] Screen reader announces row selection state
- [ ] Pagination clears row selection
- [ ] Refresh clears row selection

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debug issues encountered.

### Completion Notes List

**Implementation Summary:**
- Added `selectedRowIndex` state property with computed helpers `hasSelectedRow` and `selectedRowIsNew`
- Added Delete Row button (trash icon) to toolbar, disabled by default
- Added row selector checkbox column as first column in grid
- Implemented single-select toggle behavior with visual feedback
- Row selection independent from cell selection (both can coexist)
- Delete button only enabled for server rows (not new rows)
- Row selection cleared on pagination and data refresh
- Full ARIA support: aria-selected on rows, role="checkbox" with aria-checked on selectors
- Screen reader announcements via live region
- High contrast mode support for row selection
- Space/Enter keyboard support on checkboxes

**Key Design Decisions:**
- Checkbox approach for familiar Excel-like UX
- Separate row selection from cell selection for distinct operations
- New rows cannot be deleted (must cancel with Escape instead)
- Selection persists in VS Code state across webview visibility changes

### Senior Developer Review (AI)

**Review Date:** 2026-01-28
**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)
**Outcome:** APPROVED (after fixes)

**Issues Found & Fixed:**
- [x] HIGH: Delete key handler missing on row selector - Added Delete key support to trigger row deletion
- [x] MEDIUM: clearRowSelection() never called - Now called in handleRefresh() for immediate feedback
- [x] MEDIUM: Missing disabled button styling - Added explicit .ite-toolbar__button:disabled styles

**Issues Deferred (LOW):**
- Redundant role="checkbox" on input element (harmless, ARIA compliant)
- selectRow() function unused (intentional API for future programmatic use)

### File List

| File | Change Type |
|------|-------------|
| `src/providers/GridPanelManager.ts` | Modified - Added Delete Row button to toolbar |
| `media/grid.js` | Modified - Added row selection state, handlers, and checkbox column |
| `media/grid-styles.css` | Modified - Added row selector and selected row styles |

