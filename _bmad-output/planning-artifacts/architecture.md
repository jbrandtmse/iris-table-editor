---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - docs/initial-prompt.md
  - CLAUDE.md
workflowType: 'architecture'
project_name: 'iris-table-editor'
user_name: 'Developer'
date: '2026-01-26'
lastStep: 8
status: 'complete'
completedAt: '2026-01-26'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
38 requirements organized into 8 categories covering the complete CRUD lifecycle for IRIS table data:
- Server Connection (5 FRs): Server discovery, selection, authentication via Server Manager, connection status, disconnect
- Table Navigation (5 FRs): Namespace listing, table browsing, selection, refresh
- Data Display (5 FRs): Excel-like grid, column headers, scrolling, type-aware formatting, refresh
- Data Editing (5 FRs): Inline cell editing, UPDATE operations, cancel, visual feedback, save confirmation
- Data Creation (5 FRs): New row initiation, field entry, INSERT operations, validation
- Data Deletion (5 FRs): Row selection, confirmation dialog, DELETE operations
- Error Handling (4 FRs): User-friendly messages, context, dismissible notifications, constraint violation messaging
- User Interface (4 FRs): Light/dark theme support, sidebar access, command palette access

**Non-Functional Requirements:**
18 requirements defining quality attributes:
- Performance: 2s table load (<500 rows), 1s save, 1s list operations, non-blocking UI, no startup delay
- Security: No credential storage, Server Manager auth provider only, parameterized queries, no sensitive logging, HTTPS when available
- Integration: Graceful Server Manager detection, version compatibility, namespace encoding (%→%25), API version handling
- Reliability: Clear error messages, no data corruption on partial failure, network disconnect detection, connection recovery

**Scale & Complexity:**
- Primary domain: VS Code Extension with REST API Integration
- Complexity level: Low-Medium
- Estimated architectural components: ~10 major components

### Technical Constraints & Dependencies

| Constraint | Impact |
|------------|--------|
| HTTP-only via Atelier REST API | No superserver port needed; all operations via POST to `/api/atelier/v1/{NAMESPACE}/action/query` |
| Server Manager dependency | Extension cannot function without `intersystems-community.servermanager` installed |
| Webview security | CSP with nonce required; message-passing architecture between extension and webview |
| Namespace encoding | Special handling for `%` character in system namespace names |
| IRIS 2021.1+ compatibility | Must support Atelier API across IRIS versions |

### Cross-Cutting Concerns Identified

1. **Authentication Flow**: Affects all data operations; credentials obtained via `vscode.authentication.getSession()` with Server Manager provider
2. **Error Handling**: Unified error parsing from Atelier API `status.errors` array; user-friendly message transformation
3. **Theme Compatibility**: CSS variables for VS Code theme colors throughout webview UI
4. **Parameterized Queries**: All SQL operations must use `?` placeholders - enforced in SqlBuilder utility
5. **Connection State**: Server selection state affects table list, data display, and all CRUD operations

## Starter Template Evaluation

### Primary Technology Domain

VS Code Extension with Webview - specialized development requiring official tooling

### Starter Options Considered

| Starter | Status | Recommendation |
|---------|--------|----------------|
| yo code (Yeoman) | Official, maintained, esbuild support | **Selected** |
| antfu/starter-vscode | Modern template, no webview | Alternative |
| Manual setup | Labor-intensive | Not recommended |

### Selected Starter: yo code (Yeoman Generator)

**Rationale:**
- Official VS Code extension generator maintained by Microsoft
- Generates standard structure with debugging configuration
- esbuild bundler option aligns with documented requirements
- Minimal additions needed for project-specific dependencies

**Initialization Command:**

```bash
npx --package yo --package generator-code -- yo code
```

**Prompts to Select:**
- Type: New Extension (TypeScript)
- Identifier: iris-table-editor
- Bundle with esbuild: Yes
- Package manager: npm

**Architectural Decisions Provided:**

| Decision | Value |
|----------|-------|
| Language | TypeScript (strict mode) |
| Module Format | CommonJS |
| Target | ES2020+ |
| Bundler | esbuild |
| Source Maps | Enabled |
| Debugging | VS Code F5 configuration |

**Post-Initialization Setup Required:**
1. Add dependencies: @intersystems-community/intersystems-servermanager, @vscode/webview-ui-toolkit
2. Configure extensionDependencies in package.json
3. Add views/viewsContainers for sidebar panel
4. Expand directory structure per documented architecture

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- HTTP Client: Node.js native fetch
- Extension-Webview Communication: Command/Event pattern
- Error Handling: Centralized ErrorHandler class

**Important Decisions (Shape Architecture):**
- Webview State Management: Simple state class with listener pattern
- Metadata Caching: Session-based with 1-hour TTL
- Data Pagination: Server-side pagination (50 rows default)

**Deferred Decisions (Post-MVP):**
- Virtual scrolling for very large datasets
- Offline caching / persistence
- Multi-tab support

### HTTP Client

| Aspect | Decision |
|--------|----------|
| Technology | Node.js native `fetch` |
| Timeout | All fetch calls use `AbortController` with configurable timeout (default 30s) |
| Cancellation | External callers can pass `AbortSignal` to cancel in-flight requests (e.g., cancel connection) |
| Rationale | Zero dependencies, built-in to Node 20+, sufficient for REST API. AbortController is native to Node 20+ and integrates with fetch signal option. |
| Affects | AtelierApiService |

**Timeout/Cancellation Pattern (Story 1.7):**

```typescript
// Centralized fetch wrapper in AtelierApiService
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // If external signal aborts (e.g., user clicks Cancel), abort our controller too
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      if (externalSignal?.aborted) {
        throw new Error('CONNECTION_CANCELLED');
      }
      throw new Error('CONNECTION_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
```

### Extension-Webview Communication

| Aspect | Decision |
|--------|----------|
| Pattern | Command/Event |
| Commands (webview→extension) | selectServer, loadTables, selectTable, updateRow, insertRow, deleteRow, refreshData, cancelConnection |
| Events (extension→webview) | serverList, tableList, tableData, tableSchema, operationSuccess, error, connectionProgress |
| Type Safety | TypeScript interfaces for all message types |
| Rationale | Clear directionality, matches PRD terminology, intuitive for implementation |

**Growth Phase Commands (Epic 6):**

| Command | Payload | Description |
|---------|---------|-------------|
| `loadSchemas` | `{ namespace: string }` | Load schema list for tree view |
| `loadTablesBySchema` | `{ namespace: string, schema: string }` | Load tables within a schema |
| `filterData` | `{ filters: FilterCriteria[], enabled: boolean }` | Apply column filters |
| `sortData` | `{ column: string, direction: 'asc' \| 'desc' \| null }` | Apply column sort |
| `gotoPage` | `{ page: number }` | Navigate to specific page |
| `getDistinctValues` | `{ column: string, limit: number }` | Get distinct values for filter UI |

**Growth Phase Events (Epic 6):**

| Event | Payload | Description |
|-------|---------|-------------|
| `schemaList` | `{ schemas: SchemaInfo[] }` | Available schemas with table counts |
| `distinctValues` | `{ column: string, values: string[], hasMore: boolean }` | Distinct values for filter checklist |
| `dataFiltered` | `{ rows: [], totalFiltered: number, page: number }` | Filtered/sorted data response |

**Growth Phase Commands (Epic 7 - Data Type Polish):**

| Command | Payload | Description |
|---------|---------|-------------|
| `toggleBoolean` | `{ tableName: string, primaryKey: Record<string, unknown>, column: string, newValue: boolean }` | Toggle boolean checkbox |
| `setNull` | `{ tableName: string, primaryKey: Record<string, unknown>, column: string }` | Explicitly set cell to NULL |

**Growth Phase Commands (Epic 8 - Keyboard Shortcuts):**

| Command | Payload | Description |
|---------|---------|-------------|
| `copyCell` | `{ value: unknown }` | Copy cell value to clipboard |
| `pasteCell` | `{ tableName: string, primaryKey: Record<string, unknown>, column: string }` | Request paste into cell |
| `duplicateRow` | `{ tableName: string, primaryKey: Record<string, unknown> }` | Duplicate current row |

**Growth Phase Events (Epic 8 - Keyboard Shortcuts):**

| Event | Payload | Description |
|-------|---------|-------------|
| `clipboardContent` | `{ value: string }` | Clipboard content for paste operation |
| `rowDuplicated` | `{ newRow: Record<string, unknown>, newPrimaryKey: Record<string, unknown> }` | Duplicated row data |

**Growth Phase Commands (Epic 9 - Export/Import):**

| Command | Payload | Description |
|---------|---------|-------------|
| `exportData` | `{ format: 'csv' \| 'xlsx', scope: 'page' \| 'all' \| 'filtered' }` | Export table data |
| `importData` | `{ format: 'csv' \| 'xlsx', data: string, columnMapping: Record<string, string> }` | Import data from file |
| `getImportTemplate` | `{ tableName: string }` | Download import template |
| `validateImport` | `{ data: string, columnMapping: Record<string, string> }` | Validate before import |
| `cancelImport` | `{}` | Cancel in-progress import |

**Growth Phase Events (Epic 9 - Export/Import):**

| Event | Payload | Description |
|-------|---------|-------------|
| `exportReady` | `{ filename: string, data: Blob }` | Export file ready for download |
| `exportProgress` | `{ percent: number, rowsProcessed: number }` | Export progress update |
| `importPreview` | `{ columns: string[], sampleRows: unknown[][], suggestedMapping: Record<string, string> }` | Import preview data |
| `importProgress` | `{ percent: number, rowsImported: number, rowsFailed: number }` | Import progress update |
| `importComplete` | `{ totalImported: number, failed: ImportError[] }` | Import completion summary |
| `importValidation` | `{ valid: boolean, errors: ValidationError[], warnings: ValidationWarning[] }` | Pre-import validation results |

**Filter Criteria Interface:**
```typescript
interface FilterCriteria {
  column: string;
  operator: 'contains' | 'startsWith' | 'endsWith' | 'equals' | 'notEquals' | 'gt' | 'lt' | 'isEmpty' | 'isNotEmpty';
  value: string;
}
```

**Growth Phase Interfaces (Epic 7 - Data Type Polish):**

```typescript
// Column type information for type-appropriate rendering
interface ColumnTypeInfo {
  name: string;
  sqlType: string;           // IRIS SQL type (BIT, DATE, TIME, TIMESTAMP, INTEGER, DECIMAL, VARCHAR, etc.)
  displayType: 'boolean' | 'date' | 'time' | 'timestamp' | 'integer' | 'decimal' | 'text';
  nullable: boolean;
  precision?: number;        // For DECIMAL types
  scale?: number;            // For DECIMAL types
}

// Type mapping from IRIS SQL types to display types
const IRIS_TYPE_MAP: Record<string, ColumnTypeInfo['displayType']> = {
  'BIT': 'boolean',
  'TINYINT': 'boolean',      // When used as boolean
  'DATE': 'date',
  'TIME': 'time',
  'TIMESTAMP': 'timestamp',
  'DATETIME': 'timestamp',
  'INTEGER': 'integer',
  'BIGINT': 'integer',
  'SMALLINT': 'integer',
  'DECIMAL': 'decimal',
  'NUMERIC': 'decimal',
  'DOUBLE': 'decimal',
  'FLOAT': 'decimal',
  'VARCHAR': 'text',
  'CHAR': 'text',
  'LONGVARCHAR': 'text'
};
```

**Growth Phase Interfaces (Epic 9 - Export/Import):**

```typescript
// Export configuration
interface ExportConfig {
  format: 'csv' | 'xlsx';
  scope: 'page' | 'all' | 'filtered';
  includeHeaders: boolean;
  dateFormat?: string;       // e.g., 'YYYY-MM-DD'
  booleanFormat?: 'true/false' | 'yes/no' | '1/0';
}

// Import preview data
interface ImportPreviewData {
  sourceColumns: string[];
  sampleRows: unknown[][];   // First 10 rows
  suggestedMapping: Record<string, string>;  // sourceColumn -> tableColumn
  detectedFormat: 'csv' | 'xlsx';
  totalRows: number;
}

// Import configuration
interface ImportConfig {
  columnMapping: Record<string, string>;  // sourceColumn -> tableColumn
  skipHeaderRow: boolean;
  validateBeforeImport: boolean;
  onError: 'skip' | 'abort';
}

// Import error details
interface ImportError {
  rowNumber: number;
  sourceData: Record<string, unknown>;
  error: string;
  column?: string;
}

// Validation results
interface ValidationError {
  rowNumber: number;
  column: string;
  value: unknown;
  expectedType: string;
  message: string;
}

interface ValidationWarning {
  rowNumber: number;
  column: string;
  message: string;
}
```

### Webview State Management

| Aspect | Decision |
|--------|----------|
| Approach | Simple state class |
| State Properties | server, namespace, tables, selectedTable, rows, schema, pendingEdits, loading, error |
| Update Pattern | Explicit update() method with listener notification |
| Rationale | Encapsulated, testable, appropriate complexity for scope |

**Growth Phase State Properties (Epic 6):**

| Property | Type | Description |
|----------|------|-------------|
| `schemas` | `SchemaInfo[]` | Available schemas for tree view |
| `expandedSchema` | `string \| null` | Currently expanded schema in tree |
| `filters` | `FilterCriteria[]` | Active filter criteria |
| `filtersEnabled` | `boolean` | Whether filters are applied (toggle state) |
| `sort` | `{ column: string, direction: 'asc' \| 'desc' } \| null` | Current sort state |
| `currentPage` | `number` | Current page number (1-based) |
| `totalRows` | `number` | Total rows (may differ from filtered count) |
| `totalFilteredRows` | `number` | Total rows matching current filters |

**Growth Phase State Properties (Epic 7 - Data Type Polish):**

| Property | Type | Description |
|----------|------|-------------|
| `columnTypes` | `Map<string, ColumnTypeInfo>` | Column data type metadata for rendering |

**Growth Phase State Properties (Epic 9 - Export/Import):**

| Property | Type | Description |
|----------|------|-------------|
| `exportInProgress` | `boolean` | Export operation running |
| `exportProgress` | `number` | Export progress percentage (0-100) |
| `importInProgress` | `boolean` | Import operation running |
| `importProgress` | `number` | Import progress percentage (0-100) |
| `importPreview` | `ImportPreviewData \| null` | Preview data for import mapping |

### Error Handling Strategy

| Aspect | Decision |
|--------|----------|
| Pattern | Centralized ErrorHandler class |
| Location | src/utils/ErrorHandler.ts |
| Responsibilities | Parse Atelier errors, map to user-friendly messages, categorize by recoverability |
| Error Categories | Connection, Authentication, SQL, API |
| Rationale | Consistent UX, single point for error message improvements |

### Caching & Performance

| Aspect | Decision |
|--------|----------|
| Metadata Cache | Session-based with 1-hour TTL |
| Cache Scope | Table schemas, column definitions |
| Data Loading | Server-side pagination via Atelier `?max=N` parameter |
| Default Page Size | 50 rows (configurable via settings) |
| Rationale | Balances performance with data freshness, scalable approach |

### Decision Impact Analysis

**Implementation Sequence:**
1. HTTP Client setup in AtelierApiService (foundation for all API calls)
2. Command/Event message types (enables extension-webview integration)
3. ErrorHandler class (needed before any API calls)
4. State class in webview (foundation for UI)
5. Caching layer (optimization, can be added incrementally)

**Cross-Component Dependencies:**
- AtelierApiService depends on ErrorHandler for error transformation
- TableEditorProvider depends on Command/Event types for message handling
- Webview main.js depends on State class and Event types
- QueryExecutor depends on AtelierApiService and caching layer

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Addressed:** 12 areas where AI agents could make different choices

### Naming Patterns

**File Naming Conventions:**

| File Type | Convention | Example |
|-----------|------------|---------|
| Class files (providers, services) | PascalCase | `TableEditorProvider.ts`, `AtelierApiService.ts` |
| Utility files | camelCase | `sqlBuilder.ts`, `errorHandler.ts` |
| Interface files | PascalCase with `I` prefix | `IServerSpec.ts`, `ITableSchema.ts` |
| Webview files | lowercase | `main.js`, `styles.css`, `webview.html` |
| Test files | Source name + `.test.ts` | `AtelierApiService.test.ts` |

**Function/Method Naming:**

| Action | Prefix | Examples |
|--------|--------|----------|
| Retrieve data | `get` | `getTableData()`, `getServerList()`, `getSchema()` |
| Set/update | `set` | `setConnectionState()`, `setSelectedTable()` |
| Boolean check | `is`/`has`/`can` | `isConnected()`, `hasUnsavedChanges()`, `canEdit()` |
| Execute action | `execute` | `executeQuery()`, `executeUpdate()` |
| Handle event | `handle`/`on` | `handleMessage()`, `onCellEdit()`, `onServerSelect()` |
| Build/construct | `build` | `buildSelectQuery()`, `buildUrl()`, `buildAuthHeader()` |
| Parse/transform | `parse`/`map` | `parseError()`, `mapToUserMessage()`, `parseResponse()` |

**CSS Class Naming (BEM with prefix):**

```css
/* Block */
.ite-grid { }
.ite-toolbar { }
.ite-cell { }

/* Element */
.ite-grid__header { }
.ite-grid__row { }
.ite-cell__input { }

/* Modifier */
.ite-cell--editing { }
.ite-cell--modified { }
.ite-row--selected { }
```

### Structure Patterns

**Project Organization:**

```
src/
├── extension.ts                    # Entry point only - minimal code
├── providers/
│   ├── TableEditorProvider.ts      # WebviewViewProvider implementation
│   └── ServerConnectionManager.ts  # Server Manager integration
├── services/
│   ├── AtelierApiService.ts        # HTTP client for Atelier API
│   ├── QueryExecutor.ts            # CRUD operations
│   └── TableMetadataService.ts     # Schema/metadata with caching
├── models/
│   ├── IServerSpec.ts              # One interface per file
│   ├── ITableData.ts
│   ├── ITableSchema.ts
│   ├── IAtelierResponse.ts
│   └── IMessages.ts                # Command/Event type definitions
├── utils/
│   ├── ErrorHandler.ts             # Error parsing and mapping
│   ├── SqlBuilder.ts               # Parameterized query generation
│   └── UrlBuilder.ts               # Atelier URL construction
└── test/
    └── *.test.ts                   # Co-located or in test/ folder
media/
├── webview.html                    # Single HTML file
├── styles.css                      # Single CSS file
└── main.js                         # Single JS file (no bundling for webview)
```

**Test File Organization:**
- Co-located tests: `src/services/AtelierApiService.test.ts`
- Or dedicated folder: `src/test/AtelierApiService.test.ts`
- Test naming: `describe('AtelierApiService')` → `it('should execute query')`

### Format Patterns

**Command/Event Message Format:**

```typescript
// Command interface (webview → extension)
interface ICommand<T = unknown> {
  command: string;
  payload: T;
}

// Event interface (extension → webview)
interface IEvent<T = unknown> {
  event: string;
  payload: T;
}

// Concrete command types
interface ISelectServerPayload {
  serverName: string;
}

interface ILoadTablePayload {
  namespace: string;
  tableName: string;
}

interface IUpdateRowPayload {
  tableName: string;
  primaryKey: Record<string, unknown>;
  changes: Record<string, unknown>;
}

// Concrete event types
interface ITableDataPayload {
  rows: Record<string, unknown>[];
  schema: ITableSchema;
  totalRows: number;
  page: number;
}

interface IErrorPayload {
  message: string;
  code: string;
  recoverable: boolean;
  context: string;
}

// Connection lifecycle types (Story 1.7)
interface ICancelConnectionPayload {} // Empty - cancels current attempt

interface IConnectionProgressPayload {
  status: 'connecting' | 'connected' | 'timeout' | 'cancelled' | 'error';
  serverName: string;
  message?: string; // User-facing status text
}
```

**Error Response Format:**

```typescript
interface IUserError {
  message: string;      // User-friendly message
  code: string;         // Error code for programmatic handling
  recoverable: boolean; // Can user retry?
  context: string;      // What operation failed
}

// Example
{
  message: "Table 'User.Person' not found in namespace 'USER'",
  code: "TABLE_NOT_FOUND",
  recoverable: false,
  context: "loadTable"
}
```

**Error Code Constants:**

```typescript
const ErrorCodes = {
  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_CANCELLED: 'CONNECTION_CANCELLED',
  SERVER_UNREACHABLE: 'SERVER_UNREACHABLE',

  // Authentication errors
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',

  // SQL errors
  TABLE_NOT_FOUND: 'TABLE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  INVALID_QUERY: 'INVALID_QUERY',

  // API errors
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;
```

**Growth Phase: SqlBuilder Query Patterns (Epic 6)**

```typescript
// Filter query generation
interface FilterCriteria {
  column: string;
  operator: 'contains' | 'startsWith' | 'endsWith' | 'equals' | 'notEquals' | 'gt' | 'lt' | 'isEmpty' | 'isNotEmpty';
  value: string;
}

// SqlBuilder.buildFilteredQuery() example output:
{
  query: "SELECT * FROM Schema.Table WHERE Name LIKE ? AND Status = ? ORDER BY CreatedDate DESC",
  parameters: ["%John%", "Active"]
}

// Operator to SQL mapping
const operatorMap = {
  'contains': (col, val) => ({ sql: `${col} LIKE ?`, param: `%${val}%` }),
  'startsWith': (col, val) => ({ sql: `${col} LIKE ?`, param: `${val}%` }),
  'endsWith': (col, val) => ({ sql: `${col} LIKE ?`, param: `%${val}` }),
  'equals': (col, val) => ({ sql: `${col} = ?`, param: val }),
  'notEquals': (col, val) => ({ sql: `${col} != ?`, param: val }),
  'gt': (col, val) => ({ sql: `${col} > ?`, param: val }),
  'lt': (col, val) => ({ sql: `${col} < ?`, param: val }),
  'isEmpty': (col) => ({ sql: `(${col} IS NULL OR ${col} = '')`, param: null }),
  'isNotEmpty': (col) => ({ sql: `(${col} IS NOT NULL AND ${col} != '')`, param: null })
};

// Wildcard conversion for user input
// User types: John*  → SQL: John%
// User types: *smith → SQL: %smith
// User types: J?hn   → SQL: J_hn
function convertWildcards(input: string): string {
  return input.replace(/\*/g, '%').replace(/\?/g, '_');
}

// Combined query with filter, sort, pagination
function buildFilteredQuery(
  table: string,
  filters: FilterCriteria[],
  sort: { column: string, direction: 'asc' | 'desc' } | null,
  page: number,
  pageSize: number
): { query: string, parameters: unknown[] } {
  // Always use parameterized queries - NEVER concatenate user input
}
```

**Schema Query Pattern:**

```sql
-- Get distinct schemas for tree view
SELECT DISTINCT %EXACT(TABLE_SCHEMA) AS schema_name, COUNT(*) AS table_count
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
GROUP BY %EXACT(TABLE_SCHEMA)
ORDER BY schema_name

-- Get tables for a specific schema
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME
```

**Distinct Values Query Pattern:**

```sql
-- Get distinct values for filter checklist (limited)
SELECT DISTINCT TOP 11 column_name FROM Schema.Table
-- If 11 returned, hasMore=true, show text input instead of checklist
```

**Growth Phase: Data Type Formatting Patterns (Epic 7)**

```typescript
// DataTypeFormatter.ts - Type-specific display and input formatting

// Boolean display/input
interface BooleanFormatter {
  toDisplay(value: unknown): 'checked' | 'unchecked' | 'indeterminate';
  toDatabase(checked: boolean): number;  // Returns 1 or 0
  isBoolean(sqlType: string): boolean;
}

// Date/Time parsing and formatting
interface DateFormatter {
  // Flexible parsing - accepts multiple formats
  parse(input: string): Date | null;
  // Standard display format
  toDisplay(value: unknown, type: 'date' | 'time' | 'timestamp'): string;
  // IRIS-compatible format for database
  toDatabase(date: Date, type: 'date' | 'time' | 'timestamp'): string;
}

// Supported date input formats (auto-detected)
const DATE_FORMATS = [
  'YYYY-MM-DD',      // ISO
  'MM/DD/YYYY',      // US
  'DD/MM/YYYY',      // EU
  'MMM D, YYYY',     // "Feb 1, 2026"
  'D MMM YYYY',      // "1 Feb 2026"
];

const TIME_FORMATS = [
  'HH:mm',           // 24-hour
  'HH:mm:ss',        // 24-hour with seconds
  'h:mm A',          // 12-hour "2:30 PM"
  'h:mm:ss A',       // 12-hour with seconds
];

// Numeric formatting
interface NumericFormatter {
  toDisplay(value: number, options?: { thousandsSeparator?: boolean }): string;
  toInput(value: number): string;  // Raw number for editing
  parse(input: string): number | null;
  validate(input: string, type: 'integer' | 'decimal', precision?: number): ValidationResult;
}

// NULL handling
interface NullFormatter {
  isNull(value: unknown): boolean;
  toDisplay(): string;  // Returns italic "NULL" placeholder
  cssClass: string;     // 'ite-cell--null'
}
```

**Growth Phase: Keyboard Shortcut Patterns (Epic 8)**

```typescript
// KeyboardShortcuts.ts - Centralized shortcut definitions

interface KeyboardShortcut {
  key: string;           // e.g., 'F2', 'Enter', 'ArrowDown'
  modifiers?: ('ctrl' | 'shift' | 'alt')[];
  action: string;        // Action identifier
  context: 'grid' | 'editing' | 'global';
  description: string;   // For help display
}

const SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  { key: 'ArrowUp', action: 'moveUp', context: 'grid', description: 'Move to cell above' },
  { key: 'ArrowDown', action: 'moveDown', context: 'grid', description: 'Move to cell below' },
  { key: 'ArrowLeft', action: 'moveLeft', context: 'grid', description: 'Move to cell left' },
  { key: 'ArrowRight', action: 'moveRight', context: 'grid', description: 'Move to cell right' },
  { key: 'Tab', action: 'moveNextCell', context: 'grid', description: 'Move to next cell' },
  { key: 'Tab', modifiers: ['shift'], action: 'movePrevCell', context: 'grid', description: 'Move to previous cell' },
  { key: 'Home', action: 'moveRowStart', context: 'grid', description: 'Move to first cell in row' },
  { key: 'End', action: 'moveRowEnd', context: 'grid', description: 'Move to last cell in row' },
  { key: 'Home', modifiers: ['ctrl'], action: 'moveGridStart', context: 'grid', description: 'Move to first cell' },
  { key: 'End', modifiers: ['ctrl'], action: 'moveGridEnd', context: 'grid', description: 'Move to last cell' },
  { key: 'PageDown', action: 'pageDown', context: 'grid', description: 'Move down one page' },
  { key: 'PageUp', action: 'pageUp', context: 'grid', description: 'Move up one page' },

  // Editing
  { key: 'F2', action: 'startEdit', context: 'grid', description: 'Edit selected cell' },
  { key: 'Enter', action: 'startEdit', context: 'grid', description: 'Edit selected cell' },
  { key: 'Delete', action: 'clearCell', context: 'grid', description: 'Clear cell content' },
  { key: 'Backspace', action: 'clearAndEdit', context: 'grid', description: 'Clear and edit cell' },
  { key: 'Escape', action: 'cancelEdit', context: 'editing', description: 'Cancel edit' },
  { key: 'Enter', action: 'saveAndMoveDown', context: 'editing', description: 'Save and move down' },
  { key: 'Tab', action: 'saveAndMoveRight', context: 'editing', description: 'Save and move right' },
  { key: 'Enter', modifiers: ['ctrl'], action: 'saveAndStay', context: 'editing', description: 'Save and stay' },
  { key: 'z', modifiers: ['ctrl'], action: 'undoEdit', context: 'editing', description: 'Undo edit' },

  // Row operations
  { key: '=', modifiers: ['ctrl', 'shift'], action: 'insertRow', context: 'grid', description: 'Insert new row' },
  { key: '-', modifiers: ['ctrl'], action: 'deleteRow', context: 'grid', description: 'Delete row' },
  { key: 'd', modifiers: ['ctrl'], action: 'duplicateRow', context: 'grid', description: 'Duplicate row' },

  // Data operations
  { key: 'F5', action: 'refresh', context: 'global', description: 'Refresh data' },
  { key: 'r', modifiers: ['ctrl'], action: 'refresh', context: 'global', description: 'Refresh data' },
  { key: 'c', modifiers: ['ctrl'], action: 'copyCell', context: 'grid', description: 'Copy cell value' },
  { key: 'v', modifiers: ['ctrl'], action: 'pasteCell', context: 'grid', description: 'Paste into cell' },
  { key: 'f', modifiers: ['ctrl'], action: 'focusFilter', context: 'global', description: 'Focus filter' },

  // Help
  { key: '/', modifiers: ['ctrl'], action: 'showHelp', context: 'global', description: 'Show keyboard shortcuts' },
  { key: 'F1', action: 'showHelp', context: 'global', description: 'Show keyboard shortcuts' },

  // NULL handling (Epic 7)
  { key: 'n', modifiers: ['ctrl', 'shift'], action: 'setNull', context: 'editing', description: 'Set cell to NULL' },
];

// Shortcut handler in webview
function handleKeyDown(event: KeyboardEvent, context: 'grid' | 'editing'): void {
  const shortcut = findMatchingShortcut(event, context);
  if (shortcut) {
    event.preventDefault();
    executeAction(shortcut.action);
  }
}
```

**Growth Phase: Export/Import Patterns (Epic 9)**

```typescript
// ExportService.ts - Streaming export for large datasets

interface ExportOptions {
  format: 'csv' | 'xlsx';
  scope: 'page' | 'all' | 'filtered';
  onProgress?: (percent: number, rowsProcessed: number) => void;
}

// Chunked export to avoid memory issues
async function exportData(
  table: string,
  columns: ColumnTypeInfo[],
  options: ExportOptions
): Promise<Blob> {
  const CHUNK_SIZE = 1000;
  let offset = 0;
  const chunks: string[] = [];

  // Add headers
  chunks.push(columns.map(c => c.name).join(',') + '\n');

  while (true) {
    const rows = await fetchChunk(table, offset, CHUNK_SIZE, options.scope);
    if (rows.length === 0) break;

    // Format and add rows
    for (const row of rows) {
      chunks.push(formatRowForExport(row, columns, options.format));
    }

    offset += rows.length;
    options.onProgress?.(Math.round((offset / totalRows) * 100), offset);
  }

  return new Blob(chunks, { type: getMimeType(options.format) });
}

// CSV formatting with proper escaping
function formatCsvValue(value: unknown, columnType: ColumnTypeInfo): string {
  if (value === null) return '';
  if (columnType.displayType === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (columnType.displayType === 'date') return formatDate(value as Date, 'YYYY-MM-DD');

  const str = String(value);
  // Escape values containing comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ImportService.ts - Validated import with preview

interface ImportResult {
  success: boolean;
  rowsImported: number;
  rowsFailed: number;
  errors: ImportError[];
}

async function importData(
  table: string,
  data: ParsedImportData,
  mapping: Record<string, string>,
  options: { validateFirst: boolean; onProgress?: (percent: number) => void }
): Promise<ImportResult> {
  const BATCH_SIZE = 100;
  const errors: ImportError[] = [];
  let rowsImported = 0;

  // Validation phase (if enabled)
  if (options.validateFirst) {
    const validationErrors = await validateAllRows(data, mapping, table);
    if (validationErrors.length > 0) {
      return { success: false, rowsImported: 0, rowsFailed: validationErrors.length, errors: validationErrors };
    }
  }

  // Import in batches
  for (let i = 0; i < data.rows.length; i += BATCH_SIZE) {
    const batch = data.rows.slice(i, i + BATCH_SIZE);
    const batchResult = await insertBatch(table, batch, mapping);

    rowsImported += batchResult.success;
    errors.push(...batchResult.errors);

    options.onProgress?.(Math.round(((i + batch.length) / data.rows.length) * 100));
  }

  return {
    success: errors.length === 0,
    rowsImported,
    rowsFailed: errors.length,
    errors
  };
}

// CSV Parser with auto-detection
function parseCsv(content: string): ParsedImportData {
  // Detect delimiter (comma, semicolon, tab)
  const delimiter = detectDelimiter(content);
  // Parse with proper quote handling
  // Return { columns: string[], rows: unknown[][] }
}
```

**Dependencies for Export/Import (Epic 9):**

```json
{
  "dependencies": {
    "xlsx": "^0.18.5"  // For Excel export/import
  }
}
```

Note: CSV parsing/generation uses custom implementation (no external dependency) to keep bundle size small.

### Communication Patterns

**Message Flow Pattern:**

```
┌─────────────┐     Command      ┌─────────────────────┐
│   Webview   │ ───────────────► │  TableEditorProvider │
│  (main.js)  │                  │                     │
│             │ ◄─────────────── │  (extension host)   │
└─────────────┘      Event       └─────────────────────┘
```

**State Update Pattern (Webview):**

```javascript
class AppState {
  constructor() {
    this._state = {
      server: null,
      namespace: null,
      tables: [],
      selectedTable: null,
      rows: [],
      schema: null,
      pendingEdits: new Map(),
      isLoading: false,
      loadingContext: null,
      connectionCancellable: false, // True when connecting, enables Cancel button
      error: null
    };
    this._listeners = [];
  }

  // Always use update() - never mutate directly
  update(changes) {
    this._state = { ...this._state, ...changes };
    this._notifyListeners();
  }

  subscribe(listener) {
    this._listeners.push(listener);
    return () => this._listeners = this._listeners.filter(l => l !== listener);
  }
}
```

### Process Patterns

**Loading State Pattern:**

```typescript
// In webview state
{
  isLoading: true,
  loadingContext: 'loadTable'  // What's loading
}

// Standard loading contexts
type LoadingContext =
  | 'connecting'
  | 'loadingTables'
  | 'loadingData'
  | 'saving'
  | 'deleting'
  | 'inserting';
```

**Error Handling Flow:**

```
Atelier API Error
       │
       ▼
┌─────────────────┐
│  ErrorHandler   │ ──► Parse status.errors[]
│   .parse()      │ ──► Map to error code
└────────┬────────┘ ──► Generate user message
         │
         ▼
┌─────────────────┐
│  Send 'error'   │
│  event to       │
│  webview        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Display in UI  │ ──► Show notification
│  (non-blocking) │ ──► Log to console (debug)
└─────────────────┘
```

**Logging Pattern:**

```typescript
// Prefix all logs with extension identifier
const LOG_PREFIX = '[IRIS-TE]';

// Log levels
console.debug(`${LOG_PREFIX} Connecting to server: ${serverName}`);
console.info(`${LOG_PREFIX} Table loaded: ${tableName}`);
console.warn(`${LOG_PREFIX} Connection slow, retrying...`);
console.error(`${LOG_PREFIX} Query failed:`, error);

// NEVER log sensitive data
// BAD: console.log('Password:', password);
// GOOD: console.debug('Authenticating user:', username);
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow file naming conventions (PascalCase for classes, camelCase for utilities)
2. Use standardized verb prefixes for all functions
3. Use the Command/Event message format with typed payloads
4. Route all errors through ErrorHandler class
5. Use CSS classes with `ite-` prefix and BEM structure
6. Never store or log credentials
7. Always use parameterized queries via SqlBuilder

**Pattern Verification:**
- TypeScript compiler enforces interface usage
- ESLint rules can enforce naming conventions
- Code review checklist includes pattern compliance

### Pattern Examples

**Good Examples:**

```typescript
// ✓ Correct file naming
src/services/AtelierApiService.ts
src/utils/sqlBuilder.ts

// ✓ Correct function naming
async function getTableData(namespace: string, table: string): Promise<ITableData[]>
function buildSelectQuery(table: string, columns: string[]): { query: string; params: unknown[] }
function isConnected(): boolean

// ✓ Correct message format
{ command: 'selectTable', payload: { namespace: 'USER', tableName: 'Person' } }
{ event: 'tableData', payload: { rows: [...], schema: {...}, totalRows: 100 } }

// ✓ Correct error handling
const error = ErrorHandler.parse(atelierResponse);
if (error) {
  this.postMessage({ event: 'error', payload: error });
}
```

**Anti-Patterns (AVOID):**

```typescript
// ✗ Wrong file naming
src/services/atelier-api-service.ts  // Should be PascalCase
src/utils/SqlBuilder.ts              // Should be camelCase

// ✗ Wrong function naming
function data()                      // Missing verb prefix
function get_table_data()            // Wrong case
function retrieveTableData()         // Non-standard verb

// ✗ Wrong message format
{ type: 'SELECT_TABLE', table: 'Person' }  // Wrong structure
{ command: 'selectTable', serverName: 'dev' }  // Missing payload wrapper

// ✗ Direct error exposure
this.postMessage({ event: 'error', payload: atelierResponse.status.errors[0] });
// Should use ErrorHandler to transform
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
iris-table-editor/
├── .vscode/
│   ├── launch.json                 # F5 debugging configuration
│   ├── tasks.json                  # Build tasks
│   └── settings.json               # Workspace settings
├── .github/
│   └── workflows/
│       └── ci.yml                  # CI pipeline (lint, test, build)
├── src/
│   ├── extension.ts                # Entry point - activation, command registration
│   ├── providers/
│   │   ├── TableEditorProvider.ts  # WebviewViewProvider - main UI orchestration
│   │   └── ServerConnectionManager.ts # Server Manager API integration
│   ├── services/
│   │   ├── AtelierApiService.ts    # HTTP client for Atelier REST API
│   │   ├── QueryExecutor.ts        # CRUD operations (SELECT, INSERT, UPDATE, DELETE)
│   │   ├── TableMetadataService.ts # Schema retrieval with TTL caching
│   │   ├── ExportService.ts        # (Epic 9) CSV/Excel export with streaming
│   │   └── ImportService.ts        # (Epic 9) CSV/Excel import with validation
│   ├── models/
│   │   ├── IServerSpec.ts          # Server connection interface
│   │   ├── ITableData.ts           # Table row data interface
│   │   ├── ITableSchema.ts         # Column metadata interface
│   │   ├── IAtelierResponse.ts     # Atelier API response interface
│   │   ├── IMessages.ts            # Command/Event type definitions
│   │   ├── IUserError.ts           # Error payload interface
│   │   ├── IColumnTypes.ts         # (Epic 7) Column type mapping interfaces
│   │   └── IExportImport.ts        # (Epic 9) Export/Import interfaces
│   ├── utils/
│   │   ├── ErrorHandler.ts         # Error parsing and user message mapping
│   │   ├── SqlBuilder.ts           # Parameterized query generation
│   │   ├── UrlBuilder.ts           # Atelier URL construction with encoding
│   │   ├── DataTypeFormatter.ts    # (Epic 7) Type-specific display/input formatting
│   │   ├── DateParser.ts           # (Epic 7) Flexible date/time parsing
│   │   ├── CsvParser.ts            # (Epic 9) CSV parsing and generation
│   │   └── KeyboardShortcuts.ts    # (Epic 8) Keyboard shortcut definitions
│   └── test/
│       ├── AtelierApiService.test.ts
│       ├── QueryExecutor.test.ts
│       ├── SqlBuilder.test.ts
│       ├── ErrorHandler.test.ts
│       ├── DataTypeFormatter.test.ts  # (Epic 7)
│       ├── DateParser.test.ts         # (Epic 7)
│       ├── ExportService.test.ts      # (Epic 9)
│       ├── ImportService.test.ts      # (Epic 9)
│       └── mocks/
│           └── atelierResponses.ts # Mock API responses for testing
├── media/
│   ├── webview.html                # Webview HTML with CSP and nonce
│   ├── styles.css                  # VS Code theme-aware styles (BEM with ite- prefix)
│   └── main.js                     # Webview client logic (AppState, event handlers)
├── resources/
│   └── icon.png                    # Extension icon for marketplace
├── package.json                    # Extension manifest, commands, views, settings
├── tsconfig.json                   # TypeScript configuration (strict mode)
├── esbuild.js                      # Build configuration
├── .eslintrc.json                  # ESLint configuration
├── .prettierrc                     # Prettier configuration
├── .gitignore                      # Git ignore patterns
├── .vscodeignore                   # Files to exclude from .vsix package
├── README.md                       # User documentation
├── CHANGELOG.md                    # Version history
└── LICENSE                         # License file
```

### Architectural Boundaries

**Extension Host ↔ Webview Boundary:**

| Boundary | Protocol | Direction |
|----------|----------|-----------|
| Commands | `vscode.postMessage()` | Webview → Extension |
| Events | `webview.postMessage()` | Extension → Webview |
| State | Managed in webview `AppState` | Internal to webview |

**Extension ↔ Server Manager Boundary:**

| Integration Point | Method |
|-------------------|--------|
| Get server list | `serverManagerApi.getServerNames()` |
| Get server spec | `serverManagerApi.getServerSpec(name)` |
| Get credentials | `vscode.authentication.getSession()` |
| Pick server UI | `serverManagerApi.pickServer()` |

**Extension ↔ IRIS Boundary:**

| Operation | Endpoint | Method |
|-----------|----------|--------|
| All queries | `/api/atelier/v1/{NAMESPACE}/action/query` | POST |
| Authentication | Basic Auth header | Per-request |

### Requirements to Structure Mapping

**Server Connection (FR1-FR5):**
```
src/providers/ServerConnectionManager.ts  # FR1-FR5: All server operations
src/models/IServerSpec.ts                 # Server data model
```

**Table Navigation (FR6-FR10):**
```
src/providers/TableEditorProvider.ts      # FR6-FR10: Orchestrates navigation
src/services/AtelierApiService.ts         # API calls for namespace/table lists
```

**Data Display (FR11-FR15):**
```
media/webview.html                        # FR11-FR14: Grid structure
media/main.js                             # FR11-FR15: Data rendering, refresh
media/styles.css                          # FR14: Type-aware formatting
```

**Data Editing (FR16-FR20):**
```
media/main.js                             # FR16-FR19: Inline editing UI
src/services/QueryExecutor.ts             # FR17: UPDATE execution
src/utils/SqlBuilder.ts                   # FR17: Query generation
```

**Data Creation (FR21-FR25):**
```
media/main.js                             # FR21-FR24: New row form UI
src/services/QueryExecutor.ts             # FR23: INSERT execution
src/utils/SqlBuilder.ts                   # FR23: Query generation
```

**Data Deletion (FR26-FR30):**
```
media/main.js                             # FR26-FR28: Deletion UI, confirmation
src/services/QueryExecutor.ts             # FR29: DELETE execution
src/utils/SqlBuilder.ts                   # FR29: Query generation
```

**Error Handling (FR31-FR34):**
```
src/utils/ErrorHandler.ts                 # FR31-FR34: All error processing
src/models/IUserError.ts                  # Error structure definition
media/main.js                             # FR33: Error display/dismissal
```

**User Interface (FR35-FR38):**
```
media/styles.css                          # FR35-FR36: Theme support
package.json                              # FR37-FR38: View/command registration
src/extension.ts                          # FR38: Command palette registration
```

### Integration Points

**Internal Communication Flow:**

```
┌──────────────────────────────────────────────────────────────────┐
│                         Extension Host                            │
│  ┌─────────────────┐    ┌──────────────────────────────────────┐ │
│  │ extension.ts    │───►│ TableEditorProvider                   │ │
│  │ (entry point)   │    │  ├─► ServerConnectionManager          │ │
│  └─────────────────┘    │  │    └─► Server Manager API          │ │
│                         │  │    └─► vscode.authentication       │ │
│                         │  ├─► AtelierApiService                │ │
│                         │  │    └─► fetch() → IRIS Server       │ │
│                         │  ├─► QueryExecutor                    │ │
│                         │  │    ├─► SqlBuilder                  │ │
│                         │  │    └─► AtelierApiService           │ │
│                         │  ├─► TableMetadataService             │ │
│                         │  │    └─► AtelierApiService           │ │
│                         │  └─► ErrorHandler                     │ │
│                         └───────────────┬──────────────────────┘ │
│                                         │ postMessage            │
│                                         ▼                        │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                        Webview                                ││
│  │   main.js (AppState) ◄─► webview.html ◄─► styles.css         ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

**External Integrations:**

| Integration | Package/API | Location |
|-------------|-------------|----------|
| Server Manager | `@intersystems-community/intersystems-servermanager` | ServerConnectionManager.ts |
| VS Code Auth | `vscode.authentication` | ServerConnectionManager.ts |
| Atelier REST API | Native fetch | AtelierApiService.ts |

**Data Flow:**

```
User Action (webview)
       │
       ▼ Command
┌─────────────────┐
│ TableEditorProvider │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  QueryExecutor  │────►│   SqlBuilder     │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│ AtelierApiService │──► fetch() ──► IRIS Server
└────────┬────────┘
         │
         ▼ Response
┌─────────────────┐
│  ErrorHandler   │ (if error)
└────────┬────────┘
         │
         ▼ Event
┌─────────────────┐
│    Webview      │──► AppState.update() ──► UI Render
└─────────────────┘
```

### File Organization Patterns

**Configuration Files (Root):**

| File | Purpose |
|------|---------|
| `package.json` | Extension manifest, dependencies, scripts, contribution points |
| `tsconfig.json` | TypeScript config (strict, ES2020, CommonJS) |
| `esbuild.js` | Build configuration for extension bundling |
| `.eslintrc.json` | Linting rules enforcement |
| `.vscodeignore` | Exclude dev files from .vsix package |

**Source Organization:**

| Directory | Contents | Naming |
|-----------|----------|--------|
| `src/providers/` | VS Code extension points | PascalCase |
| `src/services/` | Business logic, API clients | PascalCase |
| `src/models/` | TypeScript interfaces | PascalCase with `I` prefix |
| `src/utils/` | Pure utility functions | PascalCase for classes, camelCase for modules |
| `media/` | Webview assets | lowercase |

**Test Organization:**

| Location | Test Type | Naming |
|----------|-----------|--------|
| `src/test/*.test.ts` | Unit tests | `{ClassName}.test.ts` |
| `src/test/mocks/` | Mock data | `{category}.ts` |

### Development Workflow Integration

**Development Server:**
- Run `npm run watch` for continuous esbuild compilation
- Press F5 to launch Extension Development Host
- Changes to TypeScript require rebuild; webview changes are instant with refresh

**Build Process:**
```bash
npm run compile     # esbuild → dist/extension.js
npm run package     # vsce package → iris-table-editor-{version}.vsix
```

**Deployment Structure:**
```
.vsix package contains:
├── extension/
│   ├── dist/extension.js    # Bundled extension code
│   ├── media/               # Webview assets
│   ├── resources/           # Icons
│   ├── package.json         # Manifest
│   └── README.md            # Marketplace description
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices work together without conflicts:
- Node.js native `fetch` (Node 20+) integrates seamlessly with TypeScript/esbuild
- VS Code WebviewViewProvider with Command/Event pattern follows standard extension architecture
- ErrorHandler class serves as single integration point for all API error processing
- Server Manager dependency is properly declared and authentication flow is clear
- No version conflicts identified between chosen technologies

**Pattern Consistency:**
Implementation patterns fully support architectural decisions:
- File naming (PascalCase/camelCase) applied consistently across all directories
- BEM CSS with `ite-` prefix provides collision-free styling
- Command/Event message format standardizes all extension-webview communication
- IUserError structure ensures uniform error presentation
- Verb prefixes (get/set/build/handle/parse) create predictable API surface

**Structure Alignment:**
Project structure enables all architectural decisions:
- `src/providers/` boundary separates VS Code integration from business logic
- `src/services/` layer isolates API and data operations
- `media/` directory maintains webview asset isolation
- Clear data flow: Provider → Service → API → ErrorHandler → Webview

### Requirements Coverage Validation ✅

**Functional Requirements Coverage (38/38):**

| Category | FRs | Architectural Support |
|----------|-----|----------------------|
| Server Connection | FR1-FR5 | ServerConnectionManager.ts + Server Manager API |
| Table Navigation | FR6-FR10 | AtelierApiService.ts + TableEditorProvider.ts |
| Data Display | FR11-FR15 | webview.html + main.js + styles.css |
| Data Editing | FR16-FR20 | main.js + QueryExecutor.ts + SqlBuilder.ts |
| Data Creation | FR21-FR25 | main.js + QueryExecutor.ts (INSERT) |
| Data Deletion | FR26-FR30 | main.js + QueryExecutor.ts (DELETE) |
| Error Handling | FR31-FR34 | ErrorHandler.ts + IUserError.ts |
| User Interface | FR35-FR38 | styles.css (themes) + package.json (views/commands) |

**Non-Functional Requirements Coverage (18/18):**

| Category | NFRs | Architectural Support |
|----------|------|----------------------|
| Performance | NFR1-NFR5 | Server-side pagination (50 rows), async fetch, esbuild bundling |
| Security | NFR6-NFR10 | Server Manager auth, SqlBuilder parameterization, no credential logging |
| Integration | NFR11-NFR14 | Extension dependency, UrlBuilder encoding (%→%25) |
| Reliability | NFR15-NFR18 | ErrorHandler categorization, AppState consistency |

### Implementation Readiness Validation ✅

**Decision Completeness:**
- ✅ All critical decisions documented with specific technologies and rationale
- ✅ HTTP client specified (Node.js native fetch, Node 20+)
- ✅ Message format defined with TypeScript interfaces
- ✅ Error codes enumerated with categories
- ✅ Caching strategy specified (1-hour TTL, session-based)

**Structure Completeness:**
- ✅ Complete directory tree with all files named
- ✅ All 10 major components mapped to file locations
- ✅ Integration boundaries clearly defined (Extension ↔ Webview ↔ IRIS)
- ✅ Requirements mapped to specific files (FR→file matrix)

**Pattern Completeness:**
- ✅ Naming conventions cover files, functions, CSS classes
- ✅ Message formats include concrete interface definitions
- ✅ Error handling flow documented with diagram
- ✅ Good/bad examples provided for each pattern category

### Gap Analysis Results

**Critical Gaps:** None identified

**Important Gaps (Addressable during implementation):**
1. **Loading UI patterns** - Loading states defined but skeleton/spinner patterns not specified
2. **Keyboard accessibility** - Standard webview keyboard support assumed but not explicitly documented

**Nice-to-Have Gaps (Post-MVP refinement):**
1. ESLint configuration rules for pattern enforcement
2. Detailed CSP nonce generation pattern for webview.html
3. Unit test mocking patterns for Server Manager API

### Validation Issues Addressed

No blocking issues found during validation. The architecture is coherent and complete.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed (38 FRs, 18 NFRs)
- [x] Scale and complexity assessed (Low-Medium, ~10 components)
- [x] Technical constraints identified (Atelier API, Server Manager dependency)
- [x] Cross-cutting concerns mapped (auth, errors, theming, parameterized queries)

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions (fetch, Node 20+)
- [x] Technology stack fully specified (TypeScript, esbuild, VS Code 1.85+)
- [x] Integration patterns defined (Command/Event, Server Manager API)
- [x] Performance considerations addressed (pagination, caching)

**✅ Implementation Patterns**

- [x] Naming conventions established (file, function, CSS)
- [x] Structure patterns defined (directory organization, test placement)
- [x] Communication patterns specified (ICommand, IEvent interfaces)
- [x] Process patterns documented (error flow, loading states, logging)

**✅ Project Structure**

- [x] Complete directory structure defined (20+ files mapped)
- [x] Component boundaries established (providers/services/utils)
- [x] Integration points mapped (Server Manager, Atelier API)
- [x] Requirements to structure mapping complete (FR→file)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High - based on comprehensive validation results

**Key Strengths:**
- Clear separation of concerns between extension host and webview
- Single source of truth for error handling (ErrorHandler class)
- Type-safe message passing with concrete interfaces
- Security-first design (no credential storage, parameterized queries)
- Aligned with existing InterSystems ecosystem (Server Manager integration)

**Areas for Future Enhancement:**
- Virtual scrolling for very large datasets (1000+ rows)
- Offline mode / connection recovery
- Query builder for custom SELECT statements

**Growth Phase Features (Now Planned):**
- Data Type Polish (Epic 7): Type-appropriate controls for boolean, date, time, numeric, NULL
- Keyboard Shortcuts (Epic 8): Full keyboard navigation and editing
- Export/Import (Epic 9): CSV/Excel export and import with validation

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions
- Prioritize security patterns (parameterized queries, no credential logging)

**First Implementation Priority:**
```bash
npx --package yo --package generator-code -- yo code
# Select: TypeScript, esbuild, iris-table-editor
```

Then expand with:
1. Add Server Manager dependency to package.json
2. Create src/providers/ServerConnectionManager.ts
3. Create src/services/AtelierApiService.ts
4. Create media/webview.html with CSP headers

