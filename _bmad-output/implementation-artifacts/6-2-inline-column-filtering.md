# Story 6.2: Inline Column Filtering

## Status: Done
## Epic: 6 - Scalability & Advanced Navigation

---

## Story

As a **user**,
I want **to filter table data by typing in filter boxes below column headers**,
So that **I can quickly find specific records in tables with millions of rows**.

## Acceptance Criteria

1. **Given** the grid is displayed with data, **When** I look below the column headers, **Then** I see a filter row with an input for each column.

2. **Given** I type a filter value (with or without wildcards `*`, `?`), **When** I press Enter or blur the input, **Then** the grid filters to matching rows.

3. **Given** I have set filters on multiple columns, **When** the filter applies, **Then** results match ALL filter conditions (AND logic).

4. **Given** I have active filters, **When** I look at the filter row, **Then** active filter inputs are visually highlighted and I see "Clear all filters" and "Toggle filters" buttons in the toolbar.

5. **Given** I click "Toggle filters" to disable, **Then** filters are temporarily disabled but criteria preserved.

6. **Given** I click "Clear all filters", **Then** all filter criteria is permanently removed.

---

## Technical Design

### Implementation Plan

#### 1. State Management (grid.js)
- Add to AppState:
  - `filters: Map<string, string>` - column name to filter value
  - `filtersEnabled: boolean` - whether filters are active
- State persistence via VS Code API

#### 2. UI Changes (grid.js, grid-styles.css)
- Add filter row below header row
- Filter input per column with placeholder
- Toolbar buttons: Clear All, Toggle On/Off
- Visual highlight for active filters

#### 3. Message Protocol
- New command: `filterData` with payload `{ filters: FilterCriteria[], enabled: boolean }`
- Modified `requestData` to include filter parameters

#### 4. Backend Changes (QueryExecutor.ts, SqlBuilder.ts)
- Extend query building to include WHERE clause
- Support wildcard conversion: `*` → `%`, `?` → `_`
- Parameterized queries for security

---

## Dev Agent Record

### Implementation Started: 2026-01-29
### Implementation Complete: 2026-01-29

### Files Modified:
- `media/grid.js` - Filter state management, filter row rendering, event handlers
- `media/grid-styles.css` - Filter row styles, toolbar separator, active filter highlight
- `src/providers/GridPanelManager.ts` - Filter toolbar buttons, filter parameter passing
- `src/providers/ServerConnectionManager.ts` - Filter parameter passing to API
- `src/services/AtelierApiService.ts` - WHERE clause building with parameterized queries
- `src/models/IMessages.ts` - Filter interfaces and updated payload types

### Key Design Decisions:
1. Parameterized queries for all filter values (SQL injection prevention)
2. Wildcard support: `*` → `%`, `?` → `_` for flexible pattern matching
3. AND logic for multiple column filters (all conditions must match)
4. Filter row rendered below sticky header, also sticky
5. Filter state persisted via VS Code webview state API

### Acceptance Criteria Verified:
- [x] AC1: Filter row with input for each column below headers
- [x] AC2: Wildcard support (* and ?) with Enter/blur to apply
- [x] AC3: Multiple filters use AND logic
- [x] AC4: Active filters visually highlighted, toolbar buttons for clear/toggle
- [x] AC5: Toggle button disables filters while preserving criteria
- [x] AC6: Clear all filters button removes all criteria
