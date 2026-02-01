# Story 7.2: Date Picker Control

## Status: Done
## Epic: 7 - Data Type Polish

---

## Story

As a **user**,
I want **date columns to offer a calendar picker for easy date selection**,
So that **I can select dates visually without memorizing the exact format required**.

## Acceptance Criteria

1. **Given** a table has a date column (%Date, DATE type), **When** I click or double-click to edit the cell, **Then** I see a calendar icon appear next to the input field **And** I can type a date directly in the input field.

2. **Given** I am editing a date cell, **When** I click the calendar icon, **Then** a date picker popup opens **And** it shows the current month with selectable days **And** I can navigate between months using arrow buttons **And** the currently selected date (if any) is highlighted.

3. **Given** the date picker is open, **When** I click on a day, **Then** the date is selected and inserted into the cell **And** the picker closes **And** the date displays in readable format (e.g., "2026-02-01" or locale-appropriate).

4. **Given** I am editing a date cell, **When** I type a date in common formats (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, "Feb 1, 2026"), **Then** the input is recognized and accepted **And** dates are stored in IRIS-compatible format.

5. **Given** a date cell contains NULL, **When** the cell displays, **Then** it shows the NULL placeholder (italic gray "NULL") **And** clicking opens the date picker starting at today's date.

6. **Given** I am editing a date cell, **When** I press Escape, **Then** the date picker closes (if open) **And** the edit is cancelled.

7. **Given** keyboard navigation, **When** the date picker is open and I press Arrow keys, **Then** I can navigate between days **And** pressing Enter selects the focused day.

---

## Technical Implementation Context

### Current State Analysis

The codebase currently handles date display through `formatCellValue()` in `media/grid.js`:

```javascript
// Date/time types - format for readability
if (['DATE', 'TIME', 'TIMESTAMP', 'DATETIME'].some(t => upperType.includes(t))) {
    const formatted = formatDateTimeValue(value, upperType);
    return { display: formatted, cssClass: 'ite-grid__cell--date', isNull: false };
}
```

And `formatDateTimeValue()` provides locale-aware formatting:
```javascript
function formatDateTimeValue(value, upperType) {
    // ... parses and formats using toLocaleDateString(), toLocaleTimeString()
}
```

Editing currently uses a plain text input. This story enhances date cells with a calendar picker.

### IRIS Date Format

IRIS stores dates in `YYYY-MM-DD` format (ISO 8601). The API returns dates as strings in this format. When saving, we must send dates back in this format.

### Files to Modify

| File | Changes |
|------|---------|
| `media/grid.js` | Add date picker logic, modify `enterEditMode()` for date cells |
| `media/grid-styles.css` | Add date picker popup styles |

### Implementation Approach

#### 1. Detect Date Columns

Create helper similar to `isBooleanColumn()`:

```javascript
function isDateColumn(colIndex) {
    if (colIndex < 0 || colIndex >= state.columns.length) return false;
    const upperType = state.columns[colIndex].dataType.toUpperCase();
    // DATE only, not TIME or TIMESTAMP (those are separate stories)
    return upperType === 'DATE';
}
```

#### 2. Modify enterEditMode for Date Cells

When entering edit mode on a date cell, render:
- Input field (for typing)
- Calendar icon button
- Date picker popup (initially hidden)

```javascript
function createDateEditControl(currentValue, rowIndex, colIndex) {
    const container = document.createElement('div');
    container.className = 'ite-date-editor';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ite-date-editor__input';
    input.value = currentValue || '';
    input.placeholder = 'YYYY-MM-DD';

    const calendarBtn = document.createElement('button');
    calendarBtn.className = 'ite-date-editor__calendar-btn';
    calendarBtn.innerHTML = '📅'; // Or use SVG icon
    calendarBtn.type = 'button';
    calendarBtn.setAttribute('aria-label', 'Open date picker');

    container.appendChild(input);
    container.appendChild(calendarBtn);

    return { container, input, calendarBtn };
}
```

#### 3. Date Picker Popup Component

```javascript
function createDatePicker(selectedDate, onSelect, onClose) {
    const picker = document.createElement('div');
    picker.className = 'ite-date-picker';
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-label', 'Choose date');

    // Header with month/year and navigation
    // Grid of days (7 columns for week)
    // Today button

    return picker;
}
```

#### 4. Date Parsing (Multiple Formats)

```javascript
function parseUserDateInput(input) {
    // Try various formats
    const formats = [
        /^(\d{4})-(\d{2})-(\d{2})$/,           // YYYY-MM-DD (ISO)
        /^(\d{2})\/(\d{2})\/(\d{4})$/,          // MM/DD/YYYY
        /^(\d{2})-(\d{2})-(\d{4})$/,            // DD-MM-YYYY
    ];

    // Also try Date.parse() for natural language
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
        return formatDateForIRIS(parsed);
    }

    return null; // Invalid
}

function formatDateForIRIS(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
```

### CSS Structure

```css
.ite-date-editor {
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
}

.ite-date-editor__input {
    flex: 1;
    /* ... inherit cell input styles */
}

.ite-date-editor__calendar-btn {
    /* Icon button styles */
}

.ite-date-picker {
    position: absolute;
    z-index: 1000;
    background: var(--vscode-dropdown-background);
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px var(--vscode-widget-shadow);
    padding: 8px;
}

.ite-date-picker__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.ite-date-picker__grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
}

.ite-date-picker__day {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 4px;
}

.ite-date-picker__day:hover {
    background: var(--vscode-list-hoverBackground);
}

.ite-date-picker__day--selected {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}

.ite-date-picker__day--today {
    border: 1px solid var(--vscode-focusBorder);
}
```

---

## Tasks/Subtasks

### Task 1: Create Date Column Detection
- [x] Add `isDateColumn(colIndex)` helper function
- [x] Detect DATE type only (not TIME, TIMESTAMP, DATETIME)

### Task 2: Create Date Edit Control with Calendar Icon
- [x] Create date editor inline in `enterEditMode()` for date columns
- [x] Add input field with placeholder "YYYY-MM-DD"
- [x] Add calendar icon button next to input
- [x] Integrate into `enterEditMode()` for date columns

### Task 3: Build Date Picker Popup Component
- [x] Create `createDatePicker(selectedDate, onSelect, onClose)` function
- [x] Render month/year header with navigation arrows
- [x] Render 7-column grid of days with weekday headers
- [x] Highlight currently selected date
- [x] Highlight today's date with border
- [x] Handle month navigation (prev/next)
- [x] Add "Today" button for quick selection

### Task 4: Implement Date Selection and Closing
- [x] Click on day selects date and closes picker
- [x] Clicking outside picker closes it
- [x] Escape key closes picker
- [x] Tab key closes picker via blur handler

### Task 5: Add Keyboard Navigation in Date Picker
- [x] Arrow keys navigate between days
- [x] Enter/Space selects focused day
- [x] Page Up/Down for month navigation
- [x] Home/End for first/last day of month

### Task 6: Implement Date Parsing (Multiple Formats)
- [x] Create `parseUserDateInput(input)` function
- [x] Support YYYY-MM-DD (primary/ISO)
- [x] Support MM/DD/YYYY (US format)
- [x] Support DD-MM-YYYY (EU format with heuristics)
- [x] Support natural language via Date.parse()
- [x] Create `formatDateForIRIS(date)` to output YYYY-MM-DD
- [x] Create `formatDateForDisplay(date)` for locale display

### Task 7: Handle NULL Dates
- [x] NULL dates show italic "NULL" placeholder (existing behavior)
- [x] Opening picker on NULL date starts at today
- [x] Empty input saves NULL (existing behavior via exitEditMode)

### Task 8: Add CSS Styles
- [x] Add `.ite-date-editor` container styles
- [x] Add `.ite-date-editor__input` styles
- [x] Add `.ite-date-editor__calendar-btn` button styles
- [x] Add `.ite-date-picker` popup styles
- [x] Add day grid, header, and state styles
- [x] Add Today button styles
- [x] Ensure VS Code theme compatibility

---

## Testing Checklist

### Manual Testing

- [ ] Date columns show calendar icon when editing
- [ ] Clicking calendar icon opens date picker
- [ ] Date picker shows current month with days
- [ ] Month navigation (prev/next) works
- [ ] Clicking a day selects it and closes picker
- [ ] Selected date displays in cell correctly
- [ ] Typing date directly in input works
- [ ] Various date formats are parsed correctly
- [ ] NULL dates display correctly
- [ ] Escape cancels edit and closes picker
- [ ] Arrow key navigation in picker works
- [ ] Enter key selects focused day
- [ ] Tab moves focus away and saves
- [ ] Works in light and dark themes

### Database Verification

- [ ] Dates are saved in YYYY-MM-DD format
- [ ] Refreshing shows correct date
- [ ] NULL dates are saved correctly

---

## Dev Agent Record

### Implementation Started: 2026-02-01

### Implementation Notes

**Approach taken:**
1. Created `isDateColumn(colIndex)` helper to identify DATE type columns (not TIME/TIMESTAMP/DATETIME)
2. Added date parsing functions:
   - `parseUserDateInput(input)` - parses multiple formats with fallback to Date.parse()
   - `formatDateForIRIS(date)` - outputs YYYY-MM-DD for database storage
   - `formatDateForDisplay(date)` - locale-aware display formatting
3. Created `createDatePicker(selectedDate, onSelect, onClose)` - full calendar popup with:
   - Month/year header with prev/next navigation
   - Day-of-week headers (Su-Sa)
   - 7-column grid of days
   - Today highlighting (border)
   - Selected date highlighting (filled)
   - Focused date outline for keyboard nav
   - "Today" quick-select button
4. Modified `enterEditMode()` to detect date columns and render:
   - Input field with "YYYY-MM-DD" placeholder
   - Calendar icon button that opens picker
5. `openDatePicker()` positions picker below input with viewport boundary handling
6. `closeDatePicker()` cleanup called from `exitEditMode()`
7. Full keyboard navigation: Arrow keys, Page Up/Down, Home/End, Enter/Space, Escape

**Supported Date Formats:**
- YYYY-MM-DD (ISO - primary)
- MM/DD/YYYY (US format)
- DD-MM-YYYY or DD/MM/YYYY (EU format - heuristic: first number > 12 means day-first)
- Natural language via Date.parse() (e.g., "Feb 1, 2026")

### Code Changes

**media/grid.js:**
- Line ~513-523: Added `isDateColumn()` helper
- Line ~525-810: Added all date picker functions:
  - `parseUserDateInput()`
  - `formatDateForIRIS()`
  - `formatDateForDisplay()`
  - `createDatePicker()`
  - `closeDatePicker()`
  - `openDatePicker()`
- Line ~1073-1115: Modified `enterEditMode()` to render date editor with calendar icon
- Line ~1165-1175: Modified `exitEditMode()` to close date picker and find date input

**media/grid-styles.css:**
- Line ~767-920: Added all date editor and date picker styles

### Testing Results

- [x] Build compiles without errors (`npm run compile`)
- [ ] Manual testing pending (date columns show calendar icon)
- [ ] Manual testing pending (date picker opens and displays correctly)
- [ ] Manual testing pending (date selection works)
- [ ] Manual testing pending (keyboard navigation works)
- [ ] Manual testing pending (various date formats parse correctly)
- [ ] Manual testing pending (works in light and dark themes)

### Code Review Fixes Applied (2026-02-01)

**HIGH Issues Fixed:**
1. **Memory leak in date picker** - Added `activeDatePickerCloseHandler` variable to track the mousedown listener; `closeDatePicker()` now removes it to prevent leak when picker is closed via Escape or exitEditMode
2. **No date validation on save** - Added date validation in `exitEditMode()` for date columns; invalid dates show error message and cancel save with visual feedback
3. **Date parsing ambiguity** - Improved EU format detection: DD-MM-YYYY (with dash) is now unambiguous EU; MM/DD/YYYY (with slash) defaults to US format with note about ambiguity

**MEDIUM Issues Fixed:**
1. **Unused formatDateForDisplay** - Removed redundant function; `formatDateTimeValue()` already handles locale-aware display via `toLocaleDateString()`

**LOW Issues Fixed:**
1. **Accessibility aria attributes** - Added `aria-colcount="7"` and `aria-rowcount` (dynamically calculated) to date picker grid for screen readers
