# Story 10.2: Shared Core Extraction

Status: review

## Story

As a **developer**,
I want **all pure TypeScript services, models, and utilities extracted into packages/core**,
so that **both VS Code and desktop targets share a single source of truth for business logic**.

## Acceptance Criteria

1. **Given** the current `packages/core/src/services/` and `packages/core/src/utils/` directories, **When** extraction is complete, **Then** the following are in `packages/core/src/`:
   - `services/AtelierApiService.ts` (refactored to delegate to focused modules)
   - `services/QueryExecutor.ts` (SQL CRUD operations)
   - `services/TableMetadataService.ts` (schema/column metadata retrieval)
   - `models/` (all TypeScript interfaces)
   - `utils/SqlBuilder.ts` (parameterized query generation, filter/order clause building)
   - `utils/UrlBuilder.ts` (already present)
   - `utils/ErrorHandler.ts` (already present)
   - `utils/DataTypeFormatter.ts` (date, time, timestamp, numeric formatting)
   - **And** none of these files import from `vscode` or `electron`

2. **Given** the core package is extracted, **When** `packages/vscode` imports from `@iris-te/core`, **Then** all existing functionality works identically **And** no runtime errors occur

3. **Given** the core package exports its public API, **When** I check `packages/core/src/index.ts`, **Then** all services, models, and utilities are re-exported **And** the package can be consumed as a standard npm module

## Tasks / Subtasks

- [x] Task 1: Analyze AtelierApiService.ts for extraction points (AC: 1)
  - [x] 1.1: Read the entire `packages/core/src/services/AtelierApiService.ts` (1587 lines) and identify method groupings:
    - SQL building: `_validateAndEscapeIdentifier`, `_buildFilterWhereClause`, `_buildOrderByClause`
    - Query execution: `executeQuery`, `testConnection` (low-level HTTP + SQL dispatch)
    - Metadata: `getNamespaces`, `getTables`, `getTableSchema`
    - CRUD: `getTableData`, `updateCell`, `insertRow`, `deleteRow`, `_getTableRowCount`
    - HTTP: `_buildAuthHeaders`, `setTimeout`
    - Table name parsing: `_parseQualifiedTableName`, `_validateNumeric`
  - [x] 1.2: Determine extraction boundaries — what becomes QueryExecutor, TableMetadataService, SqlBuilder

- [x] Task 2: Create SqlBuilder utility (AC: 1)
  - [x] 2.1: Create `packages/core/src/utils/SqlBuilder.ts`
  - [x] 2.2: Extract from AtelierApiService: `_validateAndEscapeIdentifier`, `_validateNumeric`, `_parseQualifiedTableName`, `_buildFilterWhereClause`, `_buildOrderByClause`
  - [x] 2.3: Make functions static or module-level exports (pure utility, no state)
  - [x] 2.4: All SQL generation MUST use `?` placeholders for user data (architecture requirement)
  - [x] 2.5: Export from `packages/core/src/index.ts`

- [x] Task 3: Create QueryExecutor service (AC: 1)
  - [x] 3.1: Create `packages/core/src/services/QueryExecutor.ts`
  - [x] 3.2: Extract CRUD operations: `getTableData`, `updateCell`, `insertRow`, `deleteRow`, `_getTableRowCount`
  - [x] 3.3: QueryExecutor should depend on AtelierApiService for `executeQuery()` (low-level HTTP transport)
  - [x] 3.4: QueryExecutor uses SqlBuilder for query construction
  - [x] 3.5: Export from `packages/core/src/index.ts`

- [x] Task 4: Create TableMetadataService (AC: 1)
  - [x] 4.1: Create `packages/core/src/services/TableMetadataService.ts`
  - [x] 4.2: Extract metadata operations: `getNamespaces`, `getTables`, `getTableSchema`
  - [x] 4.3: TableMetadataService should depend on AtelierApiService for `executeQuery()` transport
  - [x] 4.4: Export from `packages/core/src/index.ts`

- [x] Task 5: Create DataTypeFormatter utility (AC: 1)
  - [x] 5.1: Create `packages/core/src/utils/DataTypeFormatter.ts`
  - [x] 5.2: Extract and consolidate data type formatting logic that will be shared between VS Code and desktop targets. Look at the grid.js webview for formatting functions that could be shared:
    - `formatDateTimeValue`, `formatCellValue`, `formatNumericValue`
    - `parseUserTimeInput`, `parseUserDateInput`, `parseUserTimestampInput`
    - `formatTimeForIRIS`, `formatDateForIRIS`, `formatTimestampForIRIS`
    - `parseNumericInput`
  - [x] 5.3: NOTE: These functions currently live in webview JS. For this story, create the TypeScript versions in core. The webview will continue using its own JS versions until Story 10.3 bridges them.
  - [x] 5.4: Export from `packages/core/src/index.ts`

- [x] Task 6: Refactor AtelierApiService.ts (AC: 1, 2)
  - [x] 6.1: Remove extracted methods from AtelierApiService
  - [x] 6.2: AtelierApiService becomes a thin HTTP transport layer: `testConnection`, `executeQuery`, `_buildAuthHeaders`, `setTimeout`
  - [x] 6.3: Ensure existing consumers (providers in packages/vscode) work with the new structure
  - [x] 6.4: Update providers to import from new services (QueryExecutor, TableMetadataService) where appropriate

- [x] Task 7: Update barrel exports and consumers (AC: 2, 3)
  - [x] 7.1: Update `packages/core/src/index.ts` to re-export all new modules
  - [x] 7.2: Update all import statements in `packages/vscode/src/` to use new module names
  - [x] 7.3: Ensure no circular dependencies between core modules

- [x] Task 8: Validate (AC: 1, 2, 3)
  - [x] 8.1: Run `npm run compile` — all packages compile
  - [x] 8.2: Run `npm run lint` — no new lint errors
  - [x] 8.3: Run `npm run test` — all tests pass (update test imports if needed)
  - [x] 8.4: Verify zero `vscode` or `electron` imports in `packages/core`

## Dev Notes

### Current State (After Story 10.1)

`packages/core/src/services/AtelierApiService.ts` (1587 lines) is a monolithic file containing:
- HTTP transport (testConnection, executeQuery)
- SQL building (_buildFilterWhereClause, _buildOrderByClause, _validateAndEscapeIdentifier)
- Metadata queries (getNamespaces, getTables, getTableSchema)
- CRUD operations (getTableData, updateCell, insertRow, deleteRow)
- All methods in a single `AtelierApiService` class

### Extraction Strategy

```
BEFORE:  AtelierApiService (everything)
AFTER:   AtelierApiService (HTTP transport only)
         ├── QueryExecutor (CRUD: getTableData, updateCell, insertRow, deleteRow)
         ├── TableMetadataService (getNamespaces, getTables, getTableSchema)
         └── SqlBuilder (utility: filter/order clause building, identifier validation)
         DataTypeFormatter (utility: date/time/numeric formatting)
```

**Dependency direction:**
```
QueryExecutor → AtelierApiService (for executeQuery)
QueryExecutor → SqlBuilder (for query construction)
TableMetadataService → AtelierApiService (for executeQuery)
DataTypeFormatter → (standalone, no dependencies)
SqlBuilder → (standalone, no dependencies)
```

### Architecture Compliance

- Package scope: `@iris-te/core`
- Dependency rules: Core can only use Node.js stdlib. NO `vscode` or `electron` imports.
- SQL: All queries MUST use `?` placeholders (SqlBuilder enforces this)

### Previous Story Intelligence (10.1)

- AtelierApiService.ts has ZERO vscode imports — confirmed in 10.1
- ErrorHandler.ts has ZERO vscode imports — confirmed in 10.1
- Import pattern: `from '@iris-te/core'` for cross-package imports
- Tests in `packages/vscode/src/test/` — atelierApiService.test.ts will need significant updates since the API surface is changing

### Critical Gotchas

1. **Test updates**: `atelierApiService.test.ts` (540 lines) tests the full API surface. After extraction, tests should be split or updated to test the new services.
2. **Constructor parameters**: AtelierApiService takes server connection params. QueryExecutor and TableMetadataService will need the same or a reference to AtelierApiService.
3. **Private methods becoming public**: Methods like `_buildFilterWhereClause` are private. When extracted to SqlBuilder, they become public exports. Review their APIs for external consumption.
4. **IServerSpec interface**: Used across all services for connection params. Already in `packages/core/src/models/IServerSpec.ts`.
5. **grid.js formatting functions**: These are in vanilla JS (not TypeScript) in the webview. For DataTypeFormatter, create TypeScript versions that mirror the logic. Don't modify grid.js in this story — that's Story 10.3.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Monorepo Structure & Package Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture.md#Package Dependency Rules]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.2: Shared Core Extraction]

## Dev Agent Record

### Agent Model Used
claude-opus-4-6

### Debug Log References
N/A

### Completion Notes List
- AtelierApiService reduced from 1587 lines to ~305 lines (thin HTTP transport)
- `buildAuthHeaders` changed from private to public (needed by TableMetadataService.getNamespaces which hits root endpoint directly via GET)
- Added public `getTimeout()` method to AtelierApiService (needed by TableMetadataService for timeout management)
- `TableMetadataService.getNamespaces` uses raw `fetch` to root endpoint (GET request, not POST query) while `getTables` and `getTableSchema` delegate through `executeQuery`
- QueryExecutor constructor takes AtelierApiService dependency for HTTP transport delegation
- SqlBuilder regex updated to allow `%` as starting character for IRIS system identifiers (e.g., `%Dictionary`)
- DataTypeFormatter is standalone with zero dependencies on other core modules
- All 14 ESLint curly-brace warnings in DataTypeFormatter fixed
- 241 tests passing (0 failures), including new suites for QueryExecutor, TableMetadataService, SqlBuilder, and DataTypeFormatter
- Zero `vscode` or `electron` imports in `packages/core` confirmed via grep

### File List
**New files:**
- `packages/core/src/utils/SqlBuilder.ts` - SQL identifier validation, filter/order clause building
- `packages/core/src/services/QueryExecutor.ts` - CRUD operations (getTableData, updateCell, insertRow, deleteRow)
- `packages/core/src/services/TableMetadataService.ts` - Metadata operations (getNamespaces, getTables, getTableSchema)
- `packages/core/src/utils/DataTypeFormatter.ts` - Date/time/timestamp/numeric formatting utilities

**Modified files:**
- `packages/core/src/services/AtelierApiService.ts` - Reduced to thin HTTP transport (testConnection, executeQuery, setTimeout, getTimeout, buildAuthHeaders)
- `packages/core/src/index.ts` - Updated barrel exports for all new modules
- `packages/vscode/src/providers/ServerConnectionManager.ts` - Updated to use QueryExecutor and TableMetadataService
- `packages/vscode/src/test/atelierApiService.test.ts` - Updated with new test suites for extracted modules
