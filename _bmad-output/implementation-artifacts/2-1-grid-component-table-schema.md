# Story 2.1: Grid Component & Table Schema

Status: review

## Story

As a **user**,
I want **to see table data displayed in a grid with column headers**,
So that **I can view my data in a familiar spreadsheet-like format**.

## Acceptance Criteria

1. **Given** I have selected a table in the sidebar (from Epic 1)
   **When** I click/double-click to open the table
   **Then** a grid view opens in the VS Code editor area (as a webview tab)
   **And** I see column headers showing the table's column names

2. **Given** the grid is loading
   **When** data is being fetched
   **Then** I see a loading indicator (progress ring)
   **And** the UI remains responsive (non-blocking)

3. **Given** a table has columns
   **When** the grid displays
   **Then** each column header shows the column name
   **And** columns have reasonable default widths

## Tasks / Subtasks

- [x] Task 1: Add getTableSchema Method to AtelierApiService (AC: #3)
  - [x] Create `getTableSchema(spec, namespace, tableName, username, password)` method
  - [x] Use POST to `/api/atelier/v1/{NAMESPACE}/action/query` endpoint
  - [x] Execute SQL: `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION`
  - [x] Use parameterized query with tableName to prevent SQL injection
  - [x] Parse response `result.content` array into IColumnInfo[]
  - [x] Return `{ success: boolean; schema?: ITableSchema; error?: IUserError }`
  - [x] Handle auth, timeout, and network errors via ErrorHandler

- [x] Task 2: Add getTableData Method to AtelierApiService (AC: #1)
  - [x] Create `getTableData(spec, namespace, tableName, schema, pageSize, offset, username, password)` method
  - [x] Build SELECT query dynamically from schema column names
  - [x] Add `TOP {pageSize}` and offset logic for pagination (IRIS SQL syntax)
  - [x] Execute via POST to query endpoint
  - [x] Parse response `result.content` array
  - [x] Return `{ success: boolean; rows?: Record<string, unknown>[]; totalRows?: number; error?: IUserError }`

- [x] Task 3: Add Schema and Data Methods to ServerConnectionManager (AC: #1, #3)
  - [x] Create `getTableSchema(namespace, tableName)` method
  - [x] Create `getTableData(namespace, tableName, pageSize, offset)` method
  - [x] Use cached credentials from connect() (stored in memory only)
  - [x] Cache schema with 1-hour TTL per architecture (use Map with timestamp)
  - [x] Clear schema cache on disconnect

- [x] Task 4: Create ITableSchema and IColumnInfo Interfaces (AC: #3)
  - [x] Create `src/models/ITableSchema.ts`
  - [x] Define IColumnInfo: `{ name: string; dataType: string; nullable: boolean; maxLength?: number; precision?: number; scale?: number }`
  - [x] Define ITableSchema: `{ tableName: string; namespace: string; columns: IColumnInfo[] }`
  - [x] Export types for use across services

- [x] Task 5: Create ITableData Interface (AC: #1)
  - [x] Create `src/models/ITableData.ts`
  - [x] Define ITableRow: `Record<string, unknown>`
  - [x] Define ITableDataResult: `{ rows: ITableRow[]; totalRows: number; page: number; pageSize: number }`
  - [x] Export types for use in messages

- [x] Task 6: Update IMessages.ts with Grid Types (AC: #1, #2, #3)
  - [x] Add `openTable` command payload: `{ namespace: string; tableName: string }`
  - [x] Add `tableSchema` event payload: `{ schema: ITableSchema }`
  - [x] Add `tableData` event payload: `{ rows: ITableRow[]; totalRows: number; page: number; pageSize: number }`
  - [x] Add `tableLoading` event payload: `{ loading: boolean; context: string }`
  - [x] Update ServerCommand and add GridCommand/GridEvent union types

- [x] Task 7: Create TableEditorWebviewProvider for Editor Tab (AC: #1)
  - [x] Create `src/providers/GridPanelManager.ts` (using WebviewPanel approach per Dev Notes Option A)
  - [x] Use `vscode.window.createWebviewPanel` for editor area display
  - [x] Generate HTML with CSP, nonce, styles, and script references
  - [x] Handle postMessage for command/event communication
  - [x] Track table context (server, namespace, tableName) per webview

- [x] Task 8: Update TableEditorProvider to Open Grid Tabs (AC: #1)
  - [x] Add `openTable` command handler
  - [x] Integrate GridPanelManager for grid panel creation
  - [x] Pass table context (namespace, tableName, server) to GridPanelManager
  - [x] Update sidebar main.js for double-click and Enter key to open tables

- [x] Task 9: Create Grid Webview HTML Structure (AC: #1, #3)
  - [x] Generate HTML in GridPanelManager._getGridHtml()
  - [x] Add context bar with breadcrumb: `server > namespace > table`
  - [x] Add toolbar with Refresh button
  - [x] Add loading indicator container
  - [x] Add main grid container with ARIA attributes (`role="grid"`)

- [x] Task 10: Create Grid Webview JavaScript (AC: #1, #2, #3)
  - [x] Create `media/grid.js`
  - [x] Initialize VS Code API and AppState class
  - [x] Handle `tableSchema` event - store schema, render column headers
  - [x] Handle `tableData` event - populate grid rows
  - [x] Handle `tableLoading` event - show/hide progress ring
  - [x] Render grid using native table elements with VS Code styling
  - [x] Calculate column widths based on data type

- [x] Task 11: Create Grid CSS Styles (AC: #1, #3)
  - [x] Create `media/grid-styles.css`
  - [x] Style context bar `.ite-context-bar`
  - [x] Style grid container `.ite-grid-container`
  - [x] Style loading overlay `.ite-grid-loading`
  - [x] Use VS Code CSS variables for theme compatibility
  - [x] Follow BEM naming with `ite-` prefix

- [x] Task 12: Update Extension Registration (AC: #1)
  - [x] GridPanelManager integrated into TableEditorProvider
  - [x] No separate registration needed (WebviewPanel approach)
  - [x] Proper disposal added on webview dispose

- [x] Task 13: Unit Tests for Schema and Data Methods (AC: #1, #3)
  - [x] Add tests for AtelierApiService.getTableSchema() error cases
  - [x] Add tests for AtelierApiService.getTableData() error cases
  - [x] Add tests for ServerConnectionManager schema/data methods
  - [x] Add tests for connection requirement validation
  - [x] Run `npm run test` - all 105 tests pass

- [x] Task 14: Build Verification (AC: #1-#3)
  - [x] Run `npm run compile` - exits with code 0
  - [x] Run `npm run lint` - passes with no errors
  - [ ] Manual test: Select table in sidebar, grid opens in editor
  - [ ] Manual test: Column headers display correctly
  - [ ] Manual test: Loading indicator shows during fetch

## Dev Notes

### Architecture Compliance

This story implements the first grid display functionality for Epic 2. Per architecture.md:

**New Files to Create:**
- `src/models/ITableSchema.ts` - Schema interfaces
- `src/models/ITableData.ts` - Data interfaces
- `src/providers/TableEditorWebviewProvider.ts` - Grid webview provider (optional, see alternatives below)
- `media/grid.js` - Grid webview logic
- `media/grid-styles.css` - Grid-specific styles (or extend styles.css)

**Existing Files to Modify:**
- `src/services/AtelierApiService.ts` - Add getTableSchema, getTableData methods
- `src/providers/ServerConnectionManager.ts` - Add schema/data wrappers with caching
- `src/providers/TableEditorProvider.ts` - Trigger grid opening on table selection
- `src/models/IMessages.ts` - Add grid message types
- `src/extension.ts` - Register new provider
- `package.json` - Add contribution points if needed

### Grid Opening Strategy - CRITICAL DECISION

**Two viable approaches for opening grid in editor area:**

**Option A: WebviewPanel (Recommended for MVP)**
```typescript
// In TableEditorProvider._handleSelectTable()
const panel = vscode.window.createWebviewPanel(
  'irisTableGrid',
  `${tableName} (${namespace}@${serverName})`,
  vscode.ViewColumn.One,
  {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [this._extensionUri]
  }
);
// Panel gets its own webview with grid HTML
```
- Simpler implementation
- Tab title shows table context
- Each table opens in its own tab
- Easier state management per tab

**Option B: CustomTextEditorProvider**
- More complex setup
- Better for file-based editing
- Overkill for this use case

**Use Option A (WebviewPanel)** for MVP.

### Schema Query - Atelier API

**CRITICAL: Use INFORMATION_SCHEMA.COLUMNS for metadata:**

```typescript
const query = `
  SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH,
    NUMERIC_PRECISION,
    NUMERIC_SCALE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = ?
  ORDER BY ORDINAL_POSITION
`;

// POST to /api/atelier/v1/{NAMESPACE}/action/query
// Body: { query, parameters: [tableName] }
```

**Response parsing:**
```typescript
interface IColumnInfo {
  name: string;        // COLUMN_NAME
  dataType: string;    // DATA_TYPE (e.g., 'VARCHAR', 'INTEGER', 'TIMESTAMP')
  nullable: boolean;   // IS_NULLABLE === 'YES'
  maxLength?: number;  // CHARACTER_MAXIMUM_LENGTH (for strings)
  precision?: number;  // NUMERIC_PRECISION (for numbers)
  scale?: number;      // NUMERIC_SCALE (for decimals)
}
```

### Data Query - IRIS SQL Pagination

**CRITICAL: IRIS uses TOP/START AT for pagination, NOT LIMIT/OFFSET:**

```typescript
// IRIS SQL pagination syntax
const query = `
  SELECT TOP ${pageSize}
    ${columnNames.join(', ')}
  FROM ${tableName}
`; // Note: For offset, use %STARTSWITH or subquery pattern

// For row count:
const countQuery = `SELECT COUNT(*) AS total FROM ${tableName}`;
```

**IMPORTANT: IRIS SQL differences from standard SQL:**
- Use `TOP n` instead of `LIMIT n`
- For offset pagination, use subquery or %VID approach
- String literals use single quotes
- System tables may require %NOCHECK or special permissions

### vscode-data-grid Usage

**Per web research, use the three-part component system:**

```javascript
function renderGrid(schema, rows) {
  const grid = document.getElementById('data-grid');

  // Build header row
  const headerRow = document.createElement('vscode-data-grid-row');
  headerRow.setAttribute('row-type', 'header');

  schema.columns.forEach((col, index) => {
    const cell = document.createElement('vscode-data-grid-cell');
    cell.setAttribute('cell-type', 'columnheader');
    cell.setAttribute('grid-column', String(index + 1));
    cell.textContent = col.name;
    headerRow.appendChild(cell);
  });
  grid.appendChild(headerRow);

  // Build data rows
  rows.forEach(row => {
    const dataRow = document.createElement('vscode-data-grid-row');
    schema.columns.forEach((col, index) => {
      const cell = document.createElement('vscode-data-grid-cell');
      cell.setAttribute('grid-column', String(index + 1));
      cell.textContent = formatValue(row[col.name], col.dataType);
      dataRow.appendChild(cell);
    });
    grid.appendChild(dataRow);
  });
}
```

**Column width calculation:**
```javascript
function calculateColumnWidths(schema) {
  return schema.columns.map(col => {
    // Base width on data type
    switch (col.dataType.toUpperCase()) {
      case 'INTEGER':
      case 'SMALLINT':
        return '80px';
      case 'BIGINT':
        return '120px';
      case 'TIMESTAMP':
      case 'DATE':
        return '180px';
      default:
        // VARCHAR, TEXT - based on maxLength
        const charWidth = Math.min(col.maxLength || 50, 50);
        return `${Math.max(80, charWidth * 8)}px`;
    }
  }).join(' ');
}
```

### Security - Credential Handling (Same as Epic 1)

**CRITICAL: Same patterns apply:**

```typescript
// In ServerConnectionManager methods
public async getTableSchema(namespace: string, tableName: string): Promise<...> {
  // Check cache first
  const cacheKey = `${namespace}.${tableName}`;
  const cached = this._schemaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour TTL
    return { success: true, schema: cached.schema };
  }

  // Get FRESH credentials each time - NEVER store password
  const session = await vscode.authentication.getSession(
    'intersystems-server-credentials',
    [this._connectedServer],
    { createIfNone: false }
  );

  if (!session) {
    return { success: false, error: { /* AUTH_EXPIRED */ } };
  }

  const result = await this._atelierApi.getTableSchema(
    this._serverSpec,
    namespace,
    tableName,
    session.account.id,
    session.accessToken
  );

  // Cache on success
  if (result.success && result.schema) {
    this._schemaCache.set(cacheKey, {
      schema: result.schema,
      timestamp: Date.now()
    });
  }

  return result;
}
```

### Loading State UI

**Per UX spec, show progress ring during data fetch:**

```html
<div class="ite-grid-loading" id="loadingOverlay" style="display: none;">
  <vscode-progress-ring></vscode-progress-ring>
  <p>Loading table data...</p>
</div>
```

```javascript
function setLoading(loading, context) {
  const overlay = document.getElementById('loadingOverlay');
  overlay.style.display = loading ? 'flex' : 'none';
  overlay.querySelector('p').textContent =
    loading ? `Loading ${context}...` : '';
}
```

### Context Bar (Breadcrumb)

**Per UX spec, always show server > namespace > table:**

```html
<div class="ite-context-bar">
  <span class="ite-context-bar__server">${serverName}</span>
  <span class="ite-context-bar__separator">></span>
  <span class="ite-context-bar__namespace">${namespace}</span>
  <span class="ite-context-bar__separator">></span>
  <span class="ite-context-bar__table">${tableName}</span>
</div>
```

### Performance Requirements

**Per PRD NFR1: Table data loads within 2 seconds for tables <500 rows**

- Schema query should complete in <500ms
- Data query (first page) should complete in <1500ms
- UI should remain responsive during loading
- Use async/await, never block the main thread

### What NOT to Do (CRITICAL)

- **Do NOT implement cell editing** (Story 3.2)
- **Do NOT implement pagination controls** (Story 2.2)
- **Do NOT implement data type formatting** (Story 2.3)
- **Do NOT implement theme detection** (Story 2.4)
- **Do NOT store passwords** in any class property or state
- **Do NOT log credentials** (username, password, accessToken)
- **Do NOT use string concatenation for SQL** - use parameterized queries
- **Do NOT use GET for queries** - use POST with SQL body
- **Do NOT hardcode column widths** - calculate from schema

### Previous Story Learnings (from 1.1-1.6)

1. **ESLint uses modern flat config format** (`eslint.config.mjs`)
2. **LOG_PREFIX pattern**: All console output must use `[IRIS-TE]` prefix
3. **XSS prevention**: Always escape HTML with `escapeHtml()` function
4. **Attribute escaping**: Use `escapeAttr()` for data attributes
5. **Disposable cleanup**: Add event listeners to `_disposables` array
6. **State persistence**: Use `vscode.setState()`/`vscode.getState()` for webview state
7. **Screen reader support**: Use `announce()` for state changes
8. **Keyboard navigation**: Support Arrow keys, Enter, Home, End
9. **Focus management**: Focus first/selected item after render
10. **Error handling**: Route all errors through ErrorHandler
11. **Build verification**: Run compile + lint + test before marking complete
12. **Event delegation**: Use event delegation pattern to prevent listener stacking
13. **AUTH_EXPIRED code**: Use AUTH_EXPIRED (not AUTH_FAILED) for session expiration
14. **Service instance reuse**: Reuse single AtelierApiService instance
15. **Re-fetch on restore**: Re-fetch data when webview state is restored

### Project Structure After This Story

```
src/
├── extension.ts                    # Updated: register grid webview
├── providers/
│   ├── TableEditorProvider.ts      # Updated: trigger grid opening
│   ├── ServerConnectionManager.ts  # Updated: schema/data methods + cache
│   └── TableEditorWebviewProvider.ts # NEW: grid webview provider (if separate)
├── services/
│   └── AtelierApiService.ts        # Updated: getTableSchema, getTableData
├── models/
│   ├── IServerSpec.ts              # No changes
│   ├── IMessages.ts                # Updated: grid types
│   ├── ITableSchema.ts             # NEW: schema interfaces
│   └── ITableData.ts               # NEW: data interfaces
├── utils/
│   ├── ErrorHandler.ts             # No changes
│   └── UrlBuilder.ts               # No changes
└── test/
    ├── atelierApiService.test.ts   # Extended: schema/data tests
    └── serverConnectionManager.test.ts # Extended: caching tests
media/
├── webview.html                    # No changes (sidebar)
├── styles.css                      # Extended: grid styles OR
├── grid-styles.css                 # NEW: grid-specific styles
├── main.js                         # No changes (sidebar)
└── grid.js                         # NEW: grid webview logic
```

### Test Cases Required

**AtelierApiService.getTableSchema() Tests:**
1. Success case - Returns column info array
2. Empty table (no columns) - Returns empty array
3. Auth error (401) - Returns AUTH_FAILED error
4. Table not found - Returns TABLE_NOT_FOUND error
5. Parameterized query - tableName is properly escaped

**AtelierApiService.getTableData() Tests:**
1. Success case - Returns rows array
2. Empty table (no data) - Returns empty array
3. Pagination - TOP clause generates correct SQL
4. Column mapping - Row keys match schema column names

**ServerConnectionManager Tests:**
1. Schema caching - Second call returns cached result
2. Cache expiry - Cache invalidates after 1 hour
3. Data fetch - Credentials refreshed each call

### Success Verification Checklist

**Build & Tests:**
- [ ] `npm run compile` exits with code 0
- [ ] `npm run lint` passes with no errors
- [ ] `npm run test` - all tests pass (including new ones)

**Functional Verification:**
- [ ] Selecting table in sidebar opens grid in editor tab
- [ ] Tab title shows "TableName (Namespace@Server)"
- [ ] Column headers display with correct names
- [ ] Loading indicator shows during fetch
- [ ] Context bar shows server > namespace > table
- [ ] Grid loads data within 2 seconds (<500 rows)
- [ ] Multiple tables can open in separate tabs

**Security Verification:**
- [ ] No credentials stored in class properties
- [ ] No credentials in console logs
- [ ] Fresh session obtained for each API call
- [ ] SQL uses parameterized queries (no injection)

**Accessibility Verification:**
- [ ] Grid has proper ARIA attributes (`role="grid"`)
- [ ] Column headers have `role="columnheader"`
- [ ] Focus management works correctly

### References

- [Source: architecture.md#HTTP Client Decision]
- [Source: architecture.md#Extension-Webview Communication]
- [Source: architecture.md#Caching & Performance]
- [Source: architecture.md#Project Directory Structure]
- [Source: epics.md#Story 2.1: Grid Component & Table Schema]
- [Source: prd.md#Data Display FR11-FR15]
- [Source: prd.md#Performance NFR1-NFR5]
- [Source: ux-design-specification.md#Design Direction]
- [Source: ux-design-specification.md#Component Strategy]
- [Source: 1-6-table-browsing.md#Previous Story Learnings]
- [GitHub: vscode-webview-ui-toolkit data-grid README]
- [GitHub: vscode-webview-ui-toolkit#493 - Editable grid discussion]
- [INFORMATION_SCHEMA.COLUMNS - SQL standard metadata table]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation completed without blocking issues

### Completion Notes List

1. **WebviewPanel approach selected** per Dev Notes Option A - simpler than CustomTextEditorProvider
2. **Created GridPanelManager** instead of TableEditorWebviewProvider for better encapsulation
3. **Used native HTML table elements** instead of vscode-data-grid for simpler implementation and better control
4. **IRIS SQL pagination** uses TOP with %VID for offset as noted in Dev Notes
5. **Schema caching** implemented with 1-hour TTL, cleared on disconnect
6. **Double-click and Enter key** both open tables (Enter for accessibility)
7. **All 105 tests pass** including new schema/data method tests
8. **Credentials stored in memory only** during connection session, cleared on disconnect

### File List

**New Files Created:**
- `src/models/ITableSchema.ts` - Schema interfaces (IColumnInfo, ITableSchema)
- `src/models/ITableData.ts` - Data interfaces (ITableRow, ITableDataResult)
- `src/providers/GridPanelManager.ts` - Grid webview panel management
- `media/grid.js` - Grid webview JavaScript logic
- `media/grid-styles.css` - Grid-specific CSS styles

**Files Modified:**
- `src/services/AtelierApiService.ts` - Added getTableSchema(), getTableData(), _getTableRowCount()
- `src/providers/ServerConnectionManager.ts` - Added getTableSchema(), getTableData() with caching
- `src/providers/TableEditorProvider.ts` - Added GridPanelManager integration, openTable handler
- `src/models/IMessages.ts` - Added grid types (IOpenTablePayload, ITableSchemaPayload, etc.)
- `src/test/atelierApiService.test.ts` - Added schema/data tests
- `src/test/serverConnectionManager.test.ts` - Added schema/data tests
- `media/main.js` - Added double-click and Enter key handlers for table opening
