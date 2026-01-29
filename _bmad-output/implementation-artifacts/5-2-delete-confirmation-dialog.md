# Story 5.2: Delete Confirmation Dialog

## Story

**As a** user,
**I want** to confirm before a row is deleted,
**So that** I don't accidentally remove important data.

## Status

| Field | Value |
|-------|-------|
| Status | done |
| Epic | 5 - Row Deletion |
| Story Points | 2 |
| Prepared | 2026-01-28 |

## Acceptance Criteria

### AC1: Confirmation Dialog Appears on Delete Click
**Given** a row is selected
**When** I click the "Delete Row" button
**Then** a confirmation dialog appears
**And** the dialog shows "Delete this row? This action cannot be undone."
**And** I see "Cancel" and "Delete" buttons

### AC2: Cancel Button Closes Dialog
**Given** the confirmation dialog is open
**When** I click "Cancel"
**Then** the dialog closes
**And** the row remains in the grid unchanged
**And** the row remains selected

### AC3: Escape Key Closes Dialog
**Given** the confirmation dialog is open
**When** I press Escape
**Then** the dialog closes (same as Cancel)

### AC4: Delete Button Proceeds with Deletion
**Given** the confirmation dialog is open
**When** I click "Delete"
**Then** the deletion proceeds (Story 5.3 handles execution)

### AC5: Dialog Accessibility
**Given** the confirmation dialog is displayed
**When** a screen reader reads it
**Then** it announces the dialog content appropriately
**And** focus is managed correctly (trapped in dialog)

## Requirements Covered

**Functional Requirements:**
- FR27: User can confirm deletion before it executes
- FR28: User can cancel deletion at confirmation prompt

**Non-Functional Requirements:**
- NFR4: UI interactions respond within 100ms (no blocking)

**UX Requirements (from UX Design Specification):**
- UX9: WCAG 2.1 AA compliance
- UX11: ARIA roles and labels (role="dialog", aria-modal)
- UX12: Focus indicators visible at all times

**From Architecture:**
- CSS classes with `ite-` prefix and BEM structure
- Screen reader support via ARIA attributes

## Technical Context

### Current Implementation Analysis

**From Story 5.1 (handleDeleteRowClick):**
```javascript
function handleDeleteRowClick() {
    if (!state.hasSelectedRow) {
        announce('No row selected');
        return;
    }

    if (state.selectedRowIsNew) {
        announce('Cannot delete unsaved new rows. Use Escape to discard.');
        return;
    }

    // Story 5.2 will implement the confirmation dialog
    // Story 5.3 will implement the actual DELETE
    console.debug(`${LOG_PREFIX} Delete row clicked for row ${state.selectedRowIndex}`);
    announce(`Delete requested for row ${state.selectedRowIndex + 1}. Confirmation coming in Story 5.2.`);
}
```

**Existing Toast System (grid.js):**
The grid already has a toast notification system that could inform the dialog pattern, but a modal dialog is different - it blocks interaction until dismissed.

### Design Decisions

**Dialog Approach:**
Use a custom modal dialog element in the webview (not VS Code's showWarningMessage) because:
- Need to control focus trapping
- Need custom styling matching VS Code theme
- Want inline experience without VS Code chrome interruption

**Dialog Structure:**
```html
<div class="ite-dialog-overlay" role="presentation">
    <div class="ite-dialog" role="dialog" aria-modal="true" aria-labelledby="dialogTitle" aria-describedby="dialogDesc">
        <div class="ite-dialog__content">
            <h2 id="dialogTitle" class="ite-dialog__title">Delete Row</h2>
            <p id="dialogDesc" class="ite-dialog__message">Delete this row? This action cannot be undone.</p>
        </div>
        <div class="ite-dialog__actions">
            <button class="ite-dialog__button ite-dialog__button--secondary">Cancel</button>
            <button class="ite-dialog__button ite-dialog__button--danger">Delete</button>
        </div>
    </div>
</div>
```

**Focus Management:**
1. When dialog opens: Save current focus, move focus to Cancel button (safer default)
2. Tab traps within dialog (Cancel → Delete → Cancel)
3. When dialog closes: Restore focus to Delete Row toolbar button

### Files to Modify

| File | Changes |
|------|---------|
| `media/grid.js` | Add dialog show/hide functions, focus management, keyboard handlers |
| `media/grid-styles.css` | Add dialog overlay, dialog box, button styles |
| `src/providers/GridPanelManager.ts` | Add dialog HTML to webview template |

### NO Backend Changes Required
Story 5.2 is purely frontend dialog UI. The actual DELETE execution is Story 5.3.

## Tasks

### Task 1: Add Dialog HTML to Webview Template (AC: #1)
- [x] Add dialog overlay container to GridPanelManager.ts HTML
- [x] Add dialog element with role="dialog" and aria-modal="true"
- [x] Add title, message, and action buttons
- [x] Set dialog initially hidden (display: none)

### Task 2: Add Dialog CSS Styles (AC: #1, #5)
- [x] Add `.ite-dialog-overlay` styles (fixed position, semi-transparent backdrop)
- [x] Add `.ite-dialog` styles (centered modal box, VS Code theme colors)
- [x] Add `.ite-dialog__title` and `.ite-dialog__message` styles
- [x] Add `.ite-dialog__button` styles with secondary and danger variants
- [x] Add focus ring styles for buttons
- [x] Add high contrast mode support

### Task 3: Implement showDeleteConfirmDialog() Function (AC: #1)
- [x] Create showDeleteConfirmDialog() function in grid.js
- [x] Save current activeElement for focus restore
- [x] Show overlay and dialog
- [x] Move focus to Cancel button (safer default)
- [x] Announce dialog to screen readers

### Task 4: Implement Dialog Button Handlers (AC: #2, #4)
- [x] Add Cancel button click handler → close dialog, restore focus
- [x] Add Delete button click handler → close dialog, call executeDeleteRow()
- [x] Create placeholder executeDeleteRow() for Story 5.3

### Task 5: Implement Keyboard Navigation (AC: #3, #5)
- [x] Add Escape key handler → close dialog (same as Cancel)
- [x] Implement focus trap (Tab cycles between Cancel and Delete only)
- [x] Prevent Tab from leaving dialog

### Task 6: Connect Delete Button to Dialog (AC: #1)
- [x] Update handleDeleteRowClick() to call showDeleteConfirmDialog()
- [x] Remove placeholder announcement

### Task 7: Implement hideDeleteConfirmDialog() Function (AC: #2, #3)
- [x] Hide overlay and dialog
- [x] Restore focus to saved element
- [x] Clear any dialog state

## Dev Notes

### Dialog HTML Structure

```html
<!-- Add before </div> closing ite-grid-container -->
<div class="ite-dialog-overlay" id="deleteDialogOverlay" style="display: none;" role="presentation">
    <div class="ite-dialog" role="dialog" aria-modal="true" aria-labelledby="deleteDialogTitle" aria-describedby="deleteDialogDesc">
        <div class="ite-dialog__content">
            <h2 id="deleteDialogTitle" class="ite-dialog__title">Delete Row</h2>
            <p id="deleteDialogDesc" class="ite-dialog__message">Delete this row? This action cannot be undone.</p>
        </div>
        <div class="ite-dialog__actions">
            <button class="ite-dialog__button ite-dialog__button--secondary" id="deleteDialogCancel">Cancel</button>
            <button class="ite-dialog__button ite-dialog__button--danger" id="deleteDialogConfirm">Delete</button>
        </div>
    </div>
</div>
```

### CSS Styles to Add

```css
/* Dialog Overlay */
.ite-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

/* Dialog Box */
.ite-dialog {
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-widget-border);
    border-radius: 6px;
    padding: 20px;
    min-width: 300px;
    max-width: 400px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.ite-dialog__title {
    margin: 0 0 8px 0;
    font-size: 1.1em;
    font-weight: 600;
    color: var(--vscode-foreground);
}

.ite-dialog__message {
    margin: 0 0 20px 0;
    color: var(--vscode-descriptionForeground);
}

.ite-dialog__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.ite-dialog__button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1em;
}

.ite-dialog__button--secondary {
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}

.ite-dialog__button--danger {
    background-color: var(--vscode-inputValidation-errorBackground);
    color: var(--vscode-errorForeground);
    border: 1px solid var(--vscode-inputValidation-errorBorder);
}

.ite-dialog__button:focus {
    outline: 2px solid var(--vscode-focusBorder);
    outline-offset: 2px;
}
```

### Focus Trap Implementation

```javascript
/** @type {HTMLElement | null} */
let dialogPreviousFocus = null;

function showDeleteConfirmDialog() {
    const overlay = document.getElementById('deleteDialogOverlay');
    const cancelBtn = document.getElementById('deleteDialogCancel');

    if (!overlay || !cancelBtn) return;

    // Save current focus
    dialogPreviousFocus = document.activeElement;

    // Show dialog
    overlay.style.display = 'flex';

    // Focus Cancel button (safer default)
    cancelBtn.focus();

    // Announce to screen readers
    announce('Delete confirmation dialog opened. Press Cancel to keep the row, or Delete to remove it.');
}

function hideDeleteConfirmDialog() {
    const overlay = document.getElementById('deleteDialogOverlay');
    if (!overlay) return;

    overlay.style.display = 'none';

    // Restore focus
    if (dialogPreviousFocus && dialogPreviousFocus.focus) {
        dialogPreviousFocus.focus();
    }
    dialogPreviousFocus = null;
}
```

### Testing Checklist

- [ ] Click Delete Row button → confirmation dialog appears
- [ ] Dialog shows correct title and message
- [ ] Cancel button is focused by default
- [ ] Click Cancel → dialog closes, row still selected
- [ ] Press Escape → dialog closes (same as Cancel)
- [ ] Tab key cycles between Cancel and Delete only
- [ ] Click Delete → dialog closes, deletion proceeds (Story 5.3)
- [ ] Screen reader announces dialog content
- [ ] Focus returns to Delete Row button after dialog closes
- [ ] Dialog works in light and dark themes
- [ ] Dialog works in high contrast mode

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debug issues encountered.

### Completion Notes List

**Implementation Summary:**
- Added delete confirmation dialog HTML to GridPanelManager.ts webview template
- Implemented modal dialog with role="dialog", aria-modal="true", and proper ARIA labeling
- Dialog shows title "Delete Row" and message "Delete this row? This action cannot be undone."
- Cancel button (secondary) and Delete button (danger styling)
- Focus management: saves focus before dialog, focuses Cancel by default, restores on close
- Focus trap: Tab cycles between Cancel and Delete only
- Escape key closes dialog (same as Cancel)
- Click outside dialog (on overlay) also cancels
- Screen reader announcements when dialog opens/closes
- CSS styles with VS Code theme variables, high contrast mode support, reduced motion support
- Created executeDeleteRow() placeholder for Story 5.3

**Key Design Decisions:**
- Custom modal dialog in webview (not VS Code showWarningMessage) for better UX control
- Cancel button focused by default (safer - prevents accidental deletion)
- Overlay click cancels (common modal pattern)
- Focus trap ensures keyboard users stay in dialog

### Senior Developer Review (AI)

**Review Date:** 2026-01-28
**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)
**Outcome:** APPROVED (after fixes)

**Issues Found & Fixed:**
- [x] HIGH: Dialog visibility check was fragile (used inline style) - Added `isDeleteDialogOpen` state variable
- [x] MEDIUM: Dialog buttons missing type="button" attribute - Added explicit type
- [x] LOW: Placeholder announcement exposed implementation details - Cleaned up message

**Issues Deferred:**
- None

### File List

| File | Change Type |
|------|-------------|
| `src/providers/GridPanelManager.ts` | Modified - Added dialog HTML to webview template |
| `media/grid.js` | Modified - Added dialog show/hide/handlers, focus management, keyboard support |
| `media/grid-styles.css` | Modified - Added dialog overlay, box, and button styles |

