# Story 2.3: Data Type Formatting

Status: review

## Story

As a **user**,
I want **data displayed appropriately for its type**,
So that **I can easily read and understand the values**.

## Acceptance Criteria

1. **Given** a cell contains text
   **When** displayed
   **Then** text shows left-aligned
   **And** long text truncates with ellipsis

2. **Given** a cell contains a number
   **When** displayed
   **Then** numbers show right-aligned

3. **Given** a cell contains a date/timestamp
   **When** displayed
   **Then** dates show in a readable format (ISO or locale-appropriate)

## Tasks / Subtasks

- [x] Task 1: Verify Text Formatting (AC: #1)
  - [x] Verify text cells are left-aligned (CSS default)
  - [x] Verify long text truncates with ellipsis (`text-overflow: ellipsis`)
  - [x] Ensure text cells have proper `max-width` for truncation
  - [x] Add tooltip on hover to show full text value

- [x] Task 2: Verify Number Formatting (AC: #2)
  - [x] Verify `.ite-grid__cell--number` class has `text-align: right`
  - [x] Verify `font-variant-numeric: tabular-nums` for alignment
  - [x] Verify number type detection includes all IRIS numeric types (added MONEY)

- [x] Task 3: Enhance Date/Timestamp Formatting (AC: #3)
  - [x] Parse IRIS date/timestamp values into JavaScript Date objects
  - [x] Format dates using locale-appropriate format (`toLocaleDateString()`)
  - [x] Format timestamps using locale-appropriate format (`toLocaleString()`)
  - [x] Handle invalid date values gracefully (show raw value)
  - [x] Add tooltip showing full ISO timestamp (uses cell title attribute)

- [x] Task 4: Add Boolean Type Formatting
  - [x] Detect BOOLEAN/BIT data types
  - [x] Display as "Yes"/"No"
  - [x] Add `.ite-grid__cell--boolean` CSS class (centered)

- [x] Task 5: Handle NULL Values Consistently (AC: #1-#3)
  - [x] Display NULL as italic "NULL" text
  - [x] Verify `.ite-grid__cell--null` styling
  - [x] Ensure NULL displays same regardless of column type

- [x] Task 6: Build Verification (AC: #1-#3)
  - [x] Run `npm run compile` - exits with code 0
  - [x] Run `npm run lint` - passes with no errors
  - [x] Run `npm run test` - all 139 tests pass
  - [ ] Manual test: Verify text alignment and truncation
  - [ ] Manual test: Verify number right-alignment
  - [ ] Manual test: Verify date formatting

## Dev Notes

### Architecture Compliance

This story enhances the data formatting already partially implemented in Story 2.1. Per architecture.md:

**Files to Modify:**
- `media/grid.js` - Enhance `formatCellValue()` function with proper date parsing
- `media/grid-styles.css` - Add any missing type-specific styles

### Current Implementation Status (from Story 2.1)

The `formatCellValue()` function in grid.js already handles:
- NULL values with `.ite-grid__cell--null` class ✓
- Number types with `.ite-grid__cell--number` class ✓
- Date types with `.ite-grid__cell--date` class ✓
- Text as default ✓

### Date Formatting Enhancement

IRIS returns dates in various formats. Need to parse and format:

```javascript
function formatDateValue(value, dataType) {
    if (!value) return null;

    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            // Invalid date - return raw value
            return String(value);
        }

        const upperType = dataType.toUpperCase();
        if (upperType.includes('TIME') && !upperType.includes('TIMESTAMP')) {
            // TIME only - show time portion
            return date.toLocaleTimeString();
        } else if (upperType.includes('DATE') && !upperType.includes('TIME')) {
            // DATE only - show date portion
            return date.toLocaleDateString();
        } else {
            // TIMESTAMP/DATETIME - show both
            return date.toLocaleString();
        }
    } catch {
        return String(value);
    }
}
```

### IRIS Data Types Reference

**Numeric Types:**
- INTEGER, SMALLINT, BIGINT, TINYINT
- NUMERIC, DECIMAL, FLOAT, DOUBLE, REAL
- MONEY

**Date/Time Types:**
- DATE - date only
- TIME - time only
- TIMESTAMP - date and time
- DATETIME - alias for TIMESTAMP

**String Types:**
- VARCHAR, CHAR, TEXT
- NVARCHAR, NCHAR, NTEXT (Unicode)

**Boolean:**
- BIT, BOOLEAN

### What NOT to Do

- Do NOT over-engineer number formatting (no thousand separators for MVP)
- Do NOT add custom date format selector (use locale default)
- Do NOT format binary/blob types (show length instead)

### Previous Story Learnings

1. **XSS Prevention**: Always use textContent, never innerHTML for cell values
2. **Tooltip for full value**: Cell title attribute shows full value on hover
3. **CSS variables**: Use VS Code theme variables for colors

### Success Verification Checklist

**Build & Tests:**
- [ ] `npm run compile` exits with code 0
- [ ] `npm run lint` passes with no errors
- [ ] `npm run test` - all tests pass

**Functional Verification:**
- [ ] Text displays left-aligned
- [ ] Long text shows ellipsis and full value in tooltip
- [ ] Numbers display right-aligned
- [ ] Dates display in readable locale format
- [ ] NULL values show italic "NULL"

### References

- [Source: epics.md#Story 2.3: Data Type Formatting]
- [Source: architecture.md#Data Display Requirements]
- [Source: 2-1-grid-component-table-schema.md] - Base implementation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Story created as part of epic-cycle workflow

### Completion Notes List

(To be filled during implementation)

### File List

(To be filled during implementation)
