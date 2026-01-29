# Story 6.1: Schema-Based Table Tree View

## Status: Done
## Epic: 6 - Scalability & Advanced Navigation

---

## Story

As a **user**,
I want **to browse tables organized by schema in a collapsible tree view**,
So that **I can quickly find tables even when there are thousands in the namespace**.

## Acceptance Criteria

1. **Given** a namespace is selected, **When** the table list loads, **Then** I see schemas displayed as folder icons at the root level, sorted alphabetically.

2. **Given** a schema contains multiple tables, **When** I click on the schema folder, **Then** it expands to show the tables within that schema, sorted alphabetically.

3. **Given** a schema is expanded, **When** I click on a different schema, **Then** the previously expanded schema collapses and the clicked schema expands (accordion behavior).

4. **Given** a schema contains only one table, **When** the table list displays, **Then** that table is shown at the root level (not nested in a folder).

5. **Given** I have expanded a schema and selected a table, **When** I refresh the table list, **Then** my expansion state is preserved.

---

## Technical Design

### Current State
- Tables returned from `AtelierApiService.getTables()` as flat array: `["Schema1.Table1", "Schema2.Table2"]`
- `main.js` `renderTableList()` renders flat list of all tables
- No hierarchical structure in current state management

### Implementation Plan

#### 1. State Management Changes (main.js)
- Add `expandedSchema: string | null` to AppState
- Parse flat table list into hierarchical structure:
  ```javascript
  {
    schemas: [
      { name: "Schema1", tables: ["Table1", "Table2"], count: 2 },
      { name: "Schema2", tables: ["Table3"], count: 1 }
    ],
    singleTableSchemas: ["Schema3.OnlyTable"] // schemas with 1 table shown at root
  }
  ```

#### 2. Rendering Changes (main.js)
- Replace `renderTableList()` with `renderSchemaTree()`
- Add folder expand/collapse logic
- Handle single-table schemas at root level
- Preserve expansion state on refresh

#### 3. CSS Changes (styles.css)
- Add `.ite-schema-tree` block styles
- Add folder icon and expand/collapse chevron
- Add indentation for nested tables
- Add transition animations for smooth expand/collapse

#### 4. Message Protocol
- No changes needed - table list format remains the same
- Parsing happens client-side in webview

---

## Dev Agent Record

### Implementation Started: 2026-01-29

### Files Modified:
- `media/main.js` - State management and rendering
- `media/styles.css` - Tree view styles

### Design Decisions:
1. Parse schema structure client-side rather than changing API response (minimizes backend changes)
2. Use accordion behavior (one schema open at a time) to prevent overwhelming UI
3. Single-table schemas shown at root level for quick access
4. Preserve expansion state via VS Code webview state API for persistence across refreshes

### Implementation Complete: 2026-01-29

### Changes Made:

**media/main.js:**
- Added `expandedSchema` to AppState for tracking which schema folder is open
- Added `parseTablesBySchema()` function to convert flat "Schema.Table" list to hierarchical structure
- Replaced `renderTableList()` with `renderSchemaTree()` for tree view rendering
- Added `toggleSchema()` function with accordion behavior (only one schema open at a time)
- Added keyboard navigation: Arrow keys, Enter/Space to expand, Left/Right for tree navigation
- State persistence via `vscode.setState()` preserves expansion across reloads

**media/styles.css:**
- Added `.ite-schema-tree` container with proper scrolling
- Added `.ite-schema-tree__schema` for folder items with chevron, folder icon, name, and count badge
- Added `.ite-schema-tree__table` for table items with proper indentation (32px for nested)
- Added high contrast support for Windows High Contrast mode
- Added reduced motion support

### Acceptance Criteria Verified:
- [x] AC1: Schemas displayed as folder icons, sorted alphabetically
- [x] AC2: Clicking schema expands to show tables within, sorted alphabetically
- [x] AC3: Accordion behavior - clicking different schema collapses previous one
- [x] AC4: Single-table schemas shown at root level (not nested)
- [x] AC5: Expansion state preserved on refresh via webview state API
