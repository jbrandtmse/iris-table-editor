# Story 6.4: Column Sorting

## Status: Done
## Epic: 6 - Scalability & Advanced Navigation

---

## Story

As a **user**,
I want **to sort table data by clicking column headers**,
So that **I can organize data to find patterns or locate specific records**.

## Acceptance Criteria

1. **Given** the grid displays column headers, **When** I look at a column header, **Then** I see a subtle sort indicator area (or hover reveals sort affordance).

2. **Given** a column is not currently sorted, **When** I click the column header, **Then** the data sorts by that column in ascending order (A-Z, 0-9) **And** the header shows an ascending sort indicator.

3. **Given** a column is sorted ascending, **When** I click the same column header again, **Then** the data sorts by that column in descending order (Z-A, 9-0) **And** the header shows a descending sort indicator.

4. **Given** a column is sorted descending, **When** I click the same column header again, **Then** the sort is cleared for that column **And** data returns to default order (by primary key).

5. **Given** column A is currently sorted, **When** I click a different column B header, **Then** sorting switches to column B (ascending) **And** column A's sort indicator is removed.

6. **Given** I have active filters applied, **When** I sort by a column, **Then** the sort applies to the filtered results **And** filters remain active.

7. **Given** I am on page 3 of results, **When** I change the sort order, **Then** pagination resets to page 1.

8. **Given** the table has millions of rows, **When** I sort by a column, **Then** the sort is performed server-side (SQL ORDER BY) **And** only the current page of sorted results is returned.

---

## Technical Design

### Implementation Plan

#### 1. State Management (grid.js)
- Add `sortColumn` and `sortDirection` (null | 'asc' | 'desc') to AppState
- Update state persistence/restoration

#### 2. UI Changes (grid.js)
- Add sort indicator to column headers
- Add click handler on column headers for sort toggle
- Update renderGrid to show sort state

#### 3. Backend Changes
- Update IRequestDataPayload with sortColumn/sortDirection
- Update AtelierApiService to include ORDER BY clause
- Pass sort params through GridPanelManager

#### 4. CSS Changes (grid-styles.css)
- Sort indicator styles (triangle icons)
- Hover state for sortable headers

---

## Dev Agent Record

### Implementation Started: 2026-01-29

