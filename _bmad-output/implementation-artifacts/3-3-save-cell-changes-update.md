# Story 3.3: Save Cell Changes (UPDATE)

## Story

**As a** user,
**I want** my cell edits to be saved to the database,
**So that** changes persist beyond my editing session.

## Status

| Field | Value |
|-------|-------|
| Status | done |
| Epic | 3 - Inline Cell Editing |
| Story Points | 5 |
| Prepared | 2026-01-28 |
| Implemented | 2026-01-28 |

## Acceptance Criteria

### AC1: Tab/Enter Triggers Save
**Given** a cell is in edit mode with changed value
**When** I press Tab or Enter
**Then** the new value is sent to the database via UPDATE query
**And** the cell exits edit mode

### AC2: UPDATE Query Uses Parameters
**Given** an UPDATE query is constructed
**When** the query is sent to the server
**Then** it uses parameterized query (?) placeholders
**And** values are passed in parameters array (SECURITY)

### AC3: Primary Key Used in WHERE Clause
**Given** the table has an ID column (primary key)
**When** the UPDATE query is constructed
**Then** it uses WHERE ID = ? to target the specific row
**And** only one row is affected

### AC4: Success Feedback
**Given** the UPDATE query executes successfully
**When** the server responds with success
**Then** the user sees brief visual confirmation (cell flash green)
**And** the local state is updated

### AC5: Optimistic Update with Rollback
**Given** I edit a cell and press Tab/Enter
**When** the UI updates immediately (optimistic)
**And** the server request fails
**Then** the original value is restored
**And** an error message is shown

## Requirements Covered

**Functional Requirements:**
- FR18: Tab/Enter on editing cell triggers UPDATE query
- FR19: UPDATE sent via Atelier REST API with parameterized query
- FR20: Successful save shows brief visual confirmation

**Security Requirements:**
- All user input must use parameterized queries
- Validate identifier names before query construction

**Architecture Requirements:**
- AR8: Parameterized queries for UPDATE
- AR10: Atelier REST API via HTTP POST

## Technical Context

### Current Implementation (Story 3.2)

**Edit State (grid.js):**
- `state.editingCell = { rowIndex, colIndex }` tracks editing
- `state.editOriginalValue` stores value before edit for rollback
- `exitEditMode(true)` saves locally and returns `{ saved, oldValue, newValue, rowIndex, colIndex }`
- Currently only updates local display, not server

**GridPanelManager (extension):**
- `_handleGridMessage()` handles commands from webview
- `_postMessage()` sends events to webview
- Has access to `_serverConnectionManager` for API calls

**AtelierApiService:**
- `executeQuery()` method exists for running SQL
- Uses parameterized queries with `?` placeholders
- `_validateAndEscapeIdentifier()` for table/column names

### Implementation Approach

**1. Add updateCell Method to AtelierApiService:**
```typescript
public async updateCell(
    spec: IServerSpec,
    namespace: string,
    tableName: string,
    columnName: string,
    newValue: unknown,
    primaryKeyColumn: string,
    primaryKeyValue: unknown,
    username: string,
    password: string
): Promise<{ success: boolean; error?: IUserError }>
```

**2. Add updateCell to ServerConnectionManager:**
Wrapper that handles connection context.

**3. Add saveCell Command Handler in GridPanelManager:**
```typescript
case 'saveCell': {
    const payload = message.payload as ISaveCellPayload;
    const result = await this._serverConnectionManager.updateCell(
        context.namespace,
        context.tableName,
        payload.columnName,
        payload.newValue,
        payload.primaryKeyColumn,
        payload.primaryKeyValue
    );
    // Send success/error event back
}
```

**4. Modify exitEditMode in grid.js:**
When `saveValue=true`, send `saveCell` command to extension:
```javascript
if (saveValue && newValue !== oldValue) {
    // Get primary key value for WHERE clause
    const pkValue = state.rows[rowIndex].ID;
    sendCommand('saveCell', {
        rowIndex,
        colIndex,
        columnName: state.columns[colIndex].name,
        oldValue,
        newValue,
        primaryKeyColumn: 'ID',
        primaryKeyValue: pkValue
    });
}
```

**5. Handle saveCellResult Event:**
```javascript
case 'saveCellResult':
    if (payload.success) {
        showSuccessFeedback(payload.rowIndex, payload.colIndex);
    } else {
        rollbackCell(payload.rowIndex, payload.colIndex, payload.oldValue);
        showError(payload.error);
    }
```

## Tasks

### Task 1: Add updateCell to AtelierApiService (AC: #2, #3)
- [x] Add `updateCell()` method with parameterized UPDATE query
- [x] Use `_validateAndEscapeIdentifier()` for table/column names
- [x] Use `?` placeholder for value and primary key
- [x] Parse qualified table name (schema.table)
- [x] Return success/error result

### Task 2: Add updateCell to ServerConnectionManager (AC: #2)
- [x] Add `updateCell()` wrapper method
- [x] Handle connection context (spec, credentials)
- [x] Delegate to AtelierApiService

### Task 3: Add IMessages Types (AC: #1)
- [x] Add `ISaveCellPayload` interface
- [x] Add `ISaveCellResultPayload` interface
- [x] Export from IMessages.ts

### Task 4: Handle saveCell in GridPanelManager (AC: #1, #4, #5)
- [x] Add `saveCell` case to `_handleGridMessage()`
- [x] Call `_serverConnectionManager.updateCell()`
- [x] Send `saveCellResult` event with success/error

### Task 5: Send saveCell Command from grid.js (AC: #1)
- [x] Modify `exitEditMode()` to send command when value changed
- [x] Include all required payload fields
- [x] Only send if newValue !== oldValue

### Task 6: Handle saveCellResult in grid.js (AC: #4, #5)
- [x] Add `saveCellResult` case to `handleMessage()`
- [x] On success: show green flash feedback, update state
- [x] On error: rollback to original value, show error

### Task 7: Add Visual Success Feedback (AC: #4)
- [x] Add `showSaveSuccess()` function with CSS animation
- [x] Green flash on cell for ~500ms
- [x] Add `.ite-grid__cell--save-success` CSS class

### Task 8: Implement Rollback on Error (AC: #5)
- [x] Add `rollbackCellValue()` function
- [x] Restore `state.rows[row][col]` to original
- [x] Re-render cell with original value
- [x] Show error toast/notification

## Dev Notes

### Files to Modify

| File | Changes |
|------|---------|
| `src/services/AtelierApiService.ts` | Add `updateCell()` method |
| `src/providers/ServerConnectionManager.ts` | Add `updateCell()` wrapper |
| `src/providers/GridPanelManager.ts` | Add `saveCell` command handler |
| `src/models/IMessages.ts` | Add payload interfaces |
| `media/grid.js` | Add save command, handle result, visual feedback |
| `media/grid-styles.css` | Add success animation CSS |

### SQL Pattern for UPDATE

```sql
UPDATE "Schema"."TableName"
SET "ColumnName" = ?
WHERE "ID" = ?
```

Parameters: `[newValue, primaryKeyValue]`

### Primary Key Discovery

For Story 3.3, we'll assume the table has an `ID` column. The architecture notes:
> Tables without clear primary keys should be read-only (future enhancement)

For now:
1. Check if `ID` column exists in schema
2. If yes, use it for WHERE clause
3. If no, refuse to update (send error)

### CSS for Success Animation

```css
@keyframes ite-save-success {
    0% { background-color: var(--vscode-list-activeSelectionBackground); }
    50% { background-color: var(--vscode-testing-iconPassed); }
    100% { background-color: var(--vscode-list-activeSelectionBackground); }
}

.ite-grid__cell--save-success {
    animation: ite-save-success 0.5s ease-out;
}
```

### Error Handling Strategy

1. **Network Error**: Show "Failed to save. Check connection."
2. **SQL Error**: Show IRIS error message from response
3. **Validation Error**: Show "Invalid value for column type"
4. **Constraint Violation**: Show constraint error from IRIS

### Message Flow

```
grid.js                    GridPanelManager            AtelierApiService
   |                             |                            |
   | saveCell command            |                            |
   |---------------------------→ |                            |
   |                             | updateCell()               |
   |                             |---------------------------→ |
   |                             |                            | POST /query
   |                             |                            |-------------→ IRIS
   |                             |                            | ←------------ response
   |                             | ←---------------------------|
   | saveCellResult event        |                            |
   | ←---------------------------|                            |
   |                             |                            |
```

### Architecture Compliance

- [x] Parameterized queries (AR8)
- [x] Atelier REST API via HTTP (AR10)
- [x] VS Code CSS variables for theme compatibility
- [x] Error handling with user-friendly messages
- [x] Optimistic update with rollback

### Testing Checklist

- [ ] Edit cell, press Enter → value saved to database
- [ ] Edit cell, press Tab → value saved, moves to next cell
- [ ] Successful save → green flash animation
- [ ] Network error → rollback to original, error shown
- [ ] SQL error → rollback to original, error shown
- [ ] Edit unchanged value → no UPDATE sent
- [ ] Table without ID column → error message

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Implementation Notes

**Full stack implementation for cell saving:**

**Backend (TypeScript):**
1. `AtelierApiService.updateCell()` - Parameterized UPDATE query with identifier validation
2. `ServerConnectionManager.updateCell()` - Wrapper handling connection context
3. `GridPanelManager._handleSaveCell()` - Command handler with success/error response
4. `IMessages.ts` - Added `ISaveCellPayload` and `ISaveCellResultPayload` interfaces

**Frontend (JavaScript):**
1. `exitEditMode()` - Enhanced to send `saveCell` command when value changes
2. `findPrimaryKeyColumn()` - Looks for ID column for WHERE clause
3. `handleSaveCellResult()` - Handles success/error from server
4. `showSaveSuccess()` - Green flash animation on successful save
5. `rollbackCellValue()` - Restores original value on error
6. `showError()` - Basic error display in status bar

**Security:**
- All identifiers validated with `_validateAndEscapeIdentifier()`
- User values passed as query parameters, never interpolated
- Primary key value also passed as parameter

**CSS:**
- `.ite-grid__cell--saving` for pending state
- `.ite-grid__cell--save-success` with keyframe animation
- `.ite-status-bar__text--error` for error display

### Files Modified

| File | Changes |
|------|---------|
| `src/services/AtelierApiService.ts` | Added `updateCell()` ~120 lines |
| `src/providers/ServerConnectionManager.ts` | Added `updateCell()` ~55 lines |
| `src/providers/GridPanelManager.ts` | Added `_handleSaveCell()` ~70 lines |
| `src/models/IMessages.ts` | Added payload interfaces and types |
| `media/grid.js` | Added save/rollback/feedback functions ~150 lines |
| `media/grid-styles.css` | Added save animation CSS |

### Testing Performed

- [x] Build compiles successfully (`npm run compile`)
- [ ] Manual testing required with actual IRIS database

### Issues Encountered

None during initial implementation.

---

## Code Review Record

### Reviewer Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Review Findings

**HIGH Priority (3 issues - all fixed):**

1. **Race condition: Stale row/col indices after pagination** - If user navigates away during async save, `rowIndex/colIndex` may point to wrong cell or be out of bounds
   - **Fix**: Added `state.pendingSaves` Map to track pending saves by primary key + column name; `handleSaveCellResult` now looks up the correct row by primary key value if indices are stale

2. **No validation of primaryKeyValue before sending** - If row has null/undefined primary key value, UPDATE would fail silently
   - **Fix**: Added explicit check in `exitEditMode()` that rolls back immediately if `pkValue` is null/undefined

3. **Missing bounds check in handleSaveCellResult** - `rollbackCellValue` and `showSaveSuccess` didn't verify indices were still valid
   - **Fix**: `handleSaveCellResult` now validates indices and attempts to find row by primary key if indices are stale

**MEDIUM Priority (2 issues - addressed):**

4. **Stale edit state if multiple rapid edits** - Multiple cells could have `--saving` class simultaneously
   - **Status**: Addressed by tracking saves by primary key + column name, each save result is correctly matched to its originating cell

5. **saveState() called before server confirmation** - Optimistic update was persisted immediately
   - **Fix**: Added `saveState()` call in `showSaveSuccess()` to ensure state is saved after confirmed success; rollback already called `saveState()`

**LOW Priority (1 issue - fixed):**

6. **Animation timing mismatch** - setTimeout was 600ms but CSS animation was 500ms
   - **Fix**: Changed setTimeout to 500ms to match CSS animation duration

### Changes Made During Review

| File | Changes |
|------|---------|
| `src/models/IMessages.ts` | Added `columnName` and `primaryKeyValue` to `ISaveCellResultPayload` |
| `src/providers/GridPanelManager.ts` | Updated all `saveCellResult` responses to include new fields |
| `media/grid.js` | Added `pendingSaves` Map to state; Updated `exitEditMode()` with PK value validation; Rewrote `handleSaveCellResult()` with proper tracking; Fixed animation timing |

### Architecture Compliance Verified

- [x] Parameterized queries (AR8) - Values never interpolated into SQL
- [x] Identifier validation - Schema, table, column names validated before use
- [x] Atelier REST API (AR10) - Uses POST to /action/query endpoint
- [x] Theme compatibility - Uses VS Code CSS variables
- [x] Error handling - User-friendly messages, proper rollback
- [x] Optimistic updates - Applied immediately, rolled back on error
