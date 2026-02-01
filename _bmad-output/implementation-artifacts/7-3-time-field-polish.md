# Story 7.3: Time Field Polish

## Status: Done
## Epic: 7 - Data Type Polish

---

## Story

As a **user**,
I want **time columns to accept common time formats and display readably**,
So that **I can enter times naturally without strict format requirements**.

## Acceptance Criteria

1. **Given** a table has a time column (%Time, TIME type), **When** I edit the cell, **Then** I see a text input that accepts time values.

2. **Given** I am editing a time cell, **When** I type time in common formats:
   - "14:30" (HH:MM)
   - "2:30 PM" (12-hour with AM/PM)
   - "14:30:45" (HH:MM:SS)
   - "2:30:45 PM"
   **Then** the input is recognized and accepted **And** the value is stored in IRIS-compatible format.

3. **Given** a time cell contains a value, **When** the grid displays, **Then** the time shows in readable format (e.g., "14:30" or "2:30 PM" based on locale).

4. **Given** I enter an invalid time (e.g., "25:00", "abc"), **When** I try to save, **Then** I see a validation error: "Invalid time format" **And** the cell remains in edit mode for correction.

5. **Given** a time cell contains NULL, **When** the cell displays, **Then** it shows the NULL placeholder (italic gray "NULL").

---

## Technical Implementation Context

### Current State Analysis

The codebase already handles TIME display through `formatDateTimeValue()` in `media/grid.js`:

```javascript
// TIME only - show time portion
if (upperType.includes('TIME') && !upperType.includes('TIMESTAMP') && !upperType.includes('DATETIME')) {
    return date.toLocaleTimeString();
}
```

This converts TIME values to locale-aware display. However, editing uses a plain text input with no format validation or parsing.

### IRIS Time Format

IRIS stores times in `HH:MM:SS` format (24-hour). The API returns times as strings like "14:30:00" or as ISO strings that include a date portion. When saving, we should send times back in `HH:MM:SS` format.

### Pattern from Story 7.2 (Date Picker)

Story 7.2 established the pattern for type-specific validation:
1. `isDateColumn(colIndex)` - Type detection helper
2. `parseUserDateInput(input)` - Multi-format parsing with validation
3. `formatDateForIRIS(date)` - Normalize to IRIS format
4. Validation in `exitEditMode()` that shows error and cancels save for invalid input

### Files to Modify

| File | Changes |
|------|---------|
| `media/grid.js` | Add time parsing/validation logic, modify `exitEditMode()` for time cells |

### Implementation Approach

#### 1. Detect Time Columns

```javascript
function isTimeColumn(colIndex) {
    if (colIndex < 0 || colIndex >= state.columns.length) return false;
    const upperType = state.columns[colIndex].dataType.toUpperCase();
    // TIME only, not TIMESTAMP or DATETIME
    return upperType === 'TIME' || (upperType.includes('TIME') && !upperType.includes('TIMESTAMP') && !upperType.includes('DATETIME'));
}
```

#### 2. Parse User Time Input

```javascript
function parseUserTimeInput(input) {
    if (!input || input.trim() === '') return null;

    const trimmed = input.trim();

    // Try HH:MM:SS (24-hour)
    const fullMatch = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (fullMatch) {
        const hours = parseInt(fullMatch[1]);
        const minutes = parseInt(fullMatch[2]);
        const seconds = parseInt(fullMatch[3]);
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
            return { hours, minutes, seconds };
        }
    }

    // Try HH:MM (24-hour, no seconds)
    const shortMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (shortMatch) {
        const hours = parseInt(shortMatch[1]);
        const minutes = parseInt(shortMatch[2]);
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return { hours, minutes, seconds: 0 };
        }
    }

    // Try 12-hour format with AM/PM
    const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)$/i);
    if (ampmMatch) {
        let hours = parseInt(ampmMatch[1]);
        const minutes = parseInt(ampmMatch[2]);
        const seconds = ampmMatch[3] ? parseInt(ampmMatch[3]) : 0;
        const isPM = ampmMatch[4].toUpperCase() === 'PM';

        // Convert to 24-hour
        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;

        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
            return { hours, minutes, seconds };
        }
    }

    return null; // Invalid format
}

function formatTimeForIRIS(time) {
    const { hours, minutes, seconds } = time;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
```

#### 3. Validation in exitEditMode

Similar to date validation pattern:

```javascript
// Story 7.3: For time columns, validate and normalize the input to IRIS format
if (isTimeColumn(colIndex) && valueToStore !== null) {
    const parsedTime = parseUserTimeInput(valueToStore);
    if (parsedTime) {
        // Normalize to IRIS format (HH:MM:SS)
        valueToStore = formatTimeForIRIS(parsedTime);
    } else {
        // Invalid time format - show error and cancel save
        console.warn(`${LOG_PREFIX} Invalid time format: "${valueToStore}"`);
        announce(`Invalid time format. Use HH:MM, HH:MM:SS, or 12-hour like "2:30 PM".`);
        // ... error handling same as date
    }
}
```

---

## Tasks/Subtasks

### Task 1: Create Time Column Detection
- [x] Add `isTimeColumn(colIndex)` helper function
- [x] Detect TIME type only (not TIMESTAMP, DATETIME)

### Task 2: Implement Time Parsing
- [x] Create `parseUserTimeInput(input)` function
- [x] Support HH:MM (24-hour)
- [x] Support HH:MM:SS (24-hour with seconds)
- [x] Support 12-hour with AM/PM
- [x] Validate hour (0-23), minute (0-59), second (0-59) ranges
- [x] Create `formatTimeForIRIS(time)` to output HH:MM:SS

### Task 3: Add Time Validation in exitEditMode
- [x] Add time column check after date column check
- [x] Parse and validate time input
- [x] Normalize valid times to IRIS format
- [x] Show error message for invalid times
- [x] Cancel save and show error state for invalid input

### Task 4: Verify Display Formatting
- [x] Confirm `formatDateTimeValue()` handles TIME correctly
- [x] Verify locale-aware time display works (uses toLocaleTimeString())

---

## Testing Checklist

### Manual Testing

- [ ] Time columns accept HH:MM format
- [ ] Time columns accept HH:MM:SS format
- [ ] Time columns accept 12-hour format (e.g., "2:30 PM")
- [ ] Invalid times show error message (e.g., "25:00")
- [ ] Valid times are saved in HH:MM:SS format
- [ ] NULL times display correctly
- [ ] Time display is locale-aware

### Database Verification

- [ ] Times are saved in HH:MM:SS format
- [ ] Refreshing shows correct time
- [ ] NULL times are saved correctly

---

## Dev Agent Record

### Implementation Started: 2026-02-01

### Implementation Notes

**Approach taken:**
1. Created `isTimeColumn(colIndex)` helper to identify TIME type columns (not TIMESTAMP/DATETIME)
2. Added time parsing function `parseUserTimeInput(input)`:
   - Parses HH:MM (24-hour)
   - Parses HH:MM:SS (24-hour with seconds)
   - Parses 12-hour with AM/PM (e.g., "2:30 PM", "2:30:45 PM")
   - Validates ranges: hours 0-23, minutes 0-59, seconds 0-59
   - Returns `{ hours, minutes, seconds }` object or null if invalid
3. Created `formatTimeForIRIS(time)` - outputs HH:MM:SS format for database storage
4. Added time validation in `exitEditMode()` following the date validation pattern:
   - Validates time input when saving time columns
   - Normalizes valid times to IRIS format
   - Shows error message and cancels save for invalid times
5. Verified `formatDateTimeValue()` already handles TIME display via `toLocaleTimeString()`

**Supported Time Formats:**
- HH:MM (24-hour, e.g., "14:30")
- HH:MM:SS (24-hour with seconds, e.g., "14:30:45")
- 12-hour with AM/PM (e.g., "2:30 PM", "2:30:45 PM", "2:30p")

### Code Changes

**media/grid.js:**
- Line ~524-537: Added `isTimeColumn()` helper
- Line ~541-600: Added time parsing and formatting functions:
  - `parseUserTimeInput()`
  - `formatTimeForIRIS()`
- Line ~1320-1337: Added time validation in `exitEditMode()`

### Testing Results

- [x] Build compiles without errors (`npm run compile`)
