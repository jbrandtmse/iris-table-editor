# Story 4.3: Save New Row (INSERT)

## Story

**As a** user,
**I want** to save the new row to the database,
**So that** my new record is persisted.

## Status

| Field | Value |
|-------|-------|
| Status | done |
| Epic | 4 - Row Creation |
| Story Points | 5 |
| Prepared | 2026-01-28 |

## Acceptance Criteria

### AC1: Save New Row on Action
**Given** I have entered values in a new row
**When** I click a "Save Row" button or press Ctrl+S
**Then** the row is saved to the database via INSERT
**And** I see a success confirmation (green flash)

### AC2: Cancel New Row with Escape
**Given** I have started entering a new row
**When** I press Escape while not in edit mode
**Then** the new row entry is cancelled
**And** any entered data is discarded
**And** the row is removed from the grid

### AC3: New Row Becomes Regular Row
**Given** the INSERT succeeds
**When** I look at the grid
**Then** the new row appears as a regular data row (loses new row styling)
**And** I can add another new row if needed

### AC4: INSERT Error Handling
**Given** the INSERT fails due to constraint violation
**When** the error occurs
**Then** I see a clear error message explaining the issue
**And** the new row remains editable so I can fix and retry

### AC5: Parameterized INSERT
**Given** I save a new row
**When** checking the database
**Then** the INSERT used parameterized queries (no SQL injection)

### AC6: Multiple New Rows
**Given** I have added multiple new rows
**When** I save one
**Then** only that row is saved (not all pending rows)
**And** other unsaved rows remain in pending state

## Requirements Covered

**Functional Requirements:**
- FR23: User can save the new row (INSERT operation)
- FR24: User can cancel new row creation before saving

**Non-Functional Requirements:**
- NFR2: INSERT operations must use parameterized queries
- NFR8: Data changes must be validated client-side before submission

**UX Requirements (from UX Design Specification):**
- UX4: Visual cell states - success feedback with green flash
- Toolbar: Save button affordance

## Technical Context

### Current Implementation

**New Row State (grid.js):**
```javascript
state.newRows = [];  // Array of new row data objects
```

**Helper Functions:**
- `isNewRow(rowIndex)` - checks if row index is in newRows
- `getRowData(rowIndex)` - unified access to server/new rows
- `handleAddRow()` - creates new empty row

**Message Types (IMessages.ts):**
- Current commands: `requestData`, `refresh`, `paginateNext`, `paginatePrev`, `saveCell`
- Current events: `tableSchema`, `tableData`, `tableLoading`, `error`, `saveCellResult`

### What Needs to Be Added

**1. Backend: AtelierApiService.insertRow()**
- Build parameterized INSERT statement
- Execute via Atelier API
- Return inserted row ID (or success flag)

**2. Backend: ServerConnectionManager.insertRow()**
- Connection validation wrapper
- Call AtelierApiService.insertRow()

**3. Backend: GridPanelManager - 'insertRow' command handler**
- Receive row data from webview
- Call ServerConnectionManager.insertRow()
- Send result back to webview

**4. Frontend: grid.js**
- Add "Save Row" button to toolbar
- Add Ctrl+S keyboard shortcut for save
- Add Escape handler to cancel/discard new row
- Add `sendInsertRow()` function
- Add `handleInsertRowResult()` handler
- Convert saved new row to regular row on success

**5. Messages: IMessages.ts**
- Add `IInsertRowPayload` interface
- Add `IInsertRowResultPayload` interface

## Tasks

### Task 1: Add insertRow to AtelierApiService (AC: #5)
- [x] Create insertRow method
- [x] Build parameterized INSERT statement
- [x] Execute via POST to /action/query
- [x] Return success/failure with any error

### Task 2: Add insertRow wrapper to ServerConnectionManager (AC: #1, #4)
- [x] Add insertRow method
- [x] Validate connection state
- [x] Call AtelierApiService.insertRow()
- [x] Handle errors

### Task 3: Add insertRow command handler to GridPanelManager (AC: #1)
- [x] Add case 'insertRow' to _handleGridMessage
- [x] Validate payload
- [x] Call ServerConnectionManager.insertRow()
- [x] Post insertRowResult event to webview

### Task 4: Add message interfaces (AC: #1)
- [x] Add IInsertRowPayload interface
- [x] Add IInsertRowResultPayload interface

### Task 5: Add Save Row button to toolbar (AC: #1)
- [x] Add button HTML in GridPanelManager.ts
- [x] Use codicon-save icon
- [x] Include tooltip with keyboard shortcut hint (disabled by default)

### Task 6: Add save row handlers in grid.js (AC: #1, #3)
- [x] Add click handler for Save Row button
- [x] Add Ctrl+S keyboard shortcut
- [x] Implement handleSaveRow() function
- [x] Implement handleInsertRowResult()
- [x] Remove row from newRows and re-render on success

### Task 7: Add cancel new row functionality (AC: #2)
- [x] Add Escape handler to discard new row (when not editing)
- [x] Remove new row from state.newRows
- [x] Re-render grid

### Task 8: Handle multiple new rows (AC: #6)
- [x] Only save the specific row (by index)
- [x] Keep other new rows in pending state
- [x] Update row indices via splice after successful insert

## Dev Notes

### Files to Modify

| File | Changes |
|------|---------|
| `src/services/AtelierApiService.ts` | Add insertRow method |
| `src/providers/ServerConnectionManager.ts` | Add insertRow wrapper |
| `src/providers/GridPanelManager.ts` | Add insertRow command handler, toolbar button |
| `src/models/IMessages.ts` | Add insert row message interfaces |
| `media/grid.js` | Add save/cancel handlers, message handling |

### INSERT SQL Pattern

```typescript
// Parameterized INSERT - all values passed as parameters
const columnList = escapedColumns.join(', ');
const placeholders = columns.map(() => '?').join(', ');
const query = `INSERT INTO ${escapedTableName} (${columnList}) VALUES (${placeholders})`;
const parameters = columns.map(col => rowData[col.name] ?? null);
```

### New Row Lifecycle

1. **Create**: `handleAddRow()` → add to `state.newRows[]`
2. **Edit**: Existing cell editing updates newRows data
3. **Save**: `sendInsertRow()` → server INSERT → `handleInsertRowResult()`
4. **Success**: Remove from newRows, add to rows, refresh display
5. **Cancel**: Remove from newRows, re-render

### Error Scenarios

- **Constraint violation**: Show error toast, keep new row editable
- **Network error**: Show error toast, keep new row editable
- **Auth error**: Show error, row remains (may need reconnect)

### Testing Checklist

- [ ] Click "Save Row" → row saved to database
- [ ] Ctrl+S → row saved
- [ ] Success shows green flash
- [ ] New row loses special styling after save
- [ ] Error shows toast with message
- [ ] Error keeps row editable
- [ ] Escape discards unsaved new row
- [ ] Multiple new rows - save one, others remain
- [ ] Empty row (all nulls) can be saved if table allows
- [ ] Required field validation (stretch goal)

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Implementation Notes

**Backend INSERT flow:**
1. `AtelierApiService.insertRow()` - builds parameterized INSERT query
2. `ServerConnectionManager.insertRow()` - connection validation wrapper
3. `GridPanelManager._handleInsertRow()` - command handler

**Frontend save flow:**
1. User clicks "Save Row" button or presses Ctrl+S
2. `handleSaveRow()` builds columns/values (skipping ID column)
3. Sends `insertRow` command to extension
4. `handleInsertRowResult()` processes response
5. On success: removes from newRows, re-renders grid
6. On error: shows toast, keeps row editable

**Key design decisions:**
- Save button starts disabled, enabled when new row selected
- ID column auto-skipped (auto-generated by server)
- Escape discards new row when not in edit mode
- Multiple new rows supported - only saves selected row

### Files Modified

| File | Changes |
|------|---------|
| `src/services/AtelierApiService.ts` | Added insertRow method (~140 lines) |
| `src/providers/ServerConnectionManager.ts` | Added insertRow wrapper (~55 lines) |
| `src/providers/GridPanelManager.ts` | Added handler + Save button (~85 lines) |
| `src/models/IMessages.ts` | Added insert row interfaces (~25 lines) |
| `media/grid.js` | Added save/cancel handlers (~180 lines) |
| `media/grid-styles.css` | Added saving/success/error row styles (~25 lines) |

---

## Code Review Record

### Reviewer Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Review Findings

**No HIGH or MEDIUM issues found.**

**Architecture Compliance:**
- [x] Parameterized INSERT (SQL injection prevention)
- [x] Identifier validation and escaping
- [x] Proper error handling with ErrorHandler
- [x] Timeout support with AbortController
- [x] Message interfaces properly typed
- [x] BEM CSS naming maintained
- [x] Screen reader announcements included
