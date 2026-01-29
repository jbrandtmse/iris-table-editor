# Sprint Change Proposal

**Project:** iris-table-editor
**Date:** 2026-01-29
**Author:** Developer (via PM Agent)
**Status:** Pending Approval

---

## 1. Issue Summary

### Problem Statement

The current IRIS Table Editor design doesn't scale for real-world enterprise usage where namespaces contain thousands of tables and tables contain millions of rows. Two key usability gaps were identified:

| Issue | Current State | Problem |
|-------|---------------|---------|
| **Table Selection** | Flat list of all tables | Unusable with 1000+ tables; no organization by schema |
| **Large Table Navigation** | Prev/Next pagination only | No filtering, no sorting, no direct page access; poor UX with millions of rows |

### Discovery Context

These issues were identified during implementation planning when considering production-scale IRIS environments where:
- Namespaces commonly contain hundreds to thousands of tables
- Production tables frequently contain millions of rows
- Users need to find specific records quickly without writing SQL

### Evidence

**Table Selection:**
- IRIS namespaces in enterprise environments routinely have 500-5000+ tables
- Current flat list design (Story 1.6, UX spec) provides no organization
- No grouping by schema makes finding tables time-consuming

**Large Table Navigation:**
- PRD mentions "tables up to 1000+ rows" but real tables can have millions
- Current pagination (Prev/Next only) requires excessive clicks
- No way to filter data to find specific records
- Column sorting explicitly deferred to "Post-MVP" in current PRD

---

## 2. Impact Analysis

### Epic Impact

| Epic | Status | Impact |
|------|--------|--------|
| Epic 1: Foundation & Connection | Existing | Story 1.6 remains as-is (basic browsing); Epic 6 extends it |
| Epic 2: Data Display | Existing | Story 2.2 remains as-is (basic pagination); Epic 6 extends it |
| Epic 3: Inline Cell Editing | Existing | No change |
| Epic 4: Row Creation | Existing | No change |
| Epic 5: Row Deletion | Existing | No change |
| **Epic 6: Scalability & Advanced Navigation** | **NEW** | Addresses both identified issues |

**Dependencies:** Epic 6 requires Epics 1 & 2 to be complete (sidebar and grid must exist).

### Artifact Conflicts

| Artifact | Changes Required |
|----------|------------------|
| **PRD** | Update Growth Features section with concrete requirements for filtering, sorting, tree view |
| **Architecture** | Add new Commands (`filterData`, `sortData`, `gotoPage`, `loadSchemas`); enhance SqlBuilder for WHERE/ORDER BY |
| **UX Specification** | Add designs for: tree view, inline filter row, filter panel, sort indicators, enhanced pagination |
| **Epics Document** | Add Epic 6 with 6 new stories |

### Technical Impact

| Component | Changes |
|-----------|---------|
| `ServerConnectionManager.ts` | Add schema list retrieval |
| `QueryExecutor.ts` | Add filtering, sorting, pagination parameters |
| `SqlBuilder.ts` | Generate WHERE clauses with LIKE, ORDER BY clauses |
| `IMessages.ts` | Add new Command/Event types |
| `main.js` (webview) | Tree view component, filter row, filter panel, sort UI, enhanced pagination |
| `styles.css` | New component styles (tree view, filter states, sort indicators) |

---

## 3. Recommended Approach

### Selected Path: Direct Adjustment (Add New Epic)

**Rationale:**
- Changes are **additive** - no breaking modifications to MVP (Epics 1-5)
- Aligns with existing PRD "Growth Features" roadmap
- Clean separation: MVP foundation vs. Growth scalability features
- **Low risk** - builds on completed foundation
- **Medium effort** - well-defined scope with 6 stories
- **High value** - essential for enterprise adoption

### Alternatives Considered

| Option | Verdict | Reason |
|--------|---------|--------|
| Modify existing epics | Rejected | Would blur MVP vs Growth boundary |
| Rollback | N/A | No existing work conflicts |
| Reduce MVP | N/A | MVP is already appropriate; this is Growth work |

---

## 4. Detailed Change Proposals

### Epic 6: Scalability & Advanced Navigation

**Goal:** Users can efficiently navigate namespaces with thousands of tables and work with tables containing millions of rows through schema-based browsing, filtering, sorting, and enhanced pagination.

---

### Story 6.1: Schema-Based Table Tree View

As a **user**,
I want **to browse tables organized by schema in a collapsible tree view**,
So that **I can quickly find tables even when there are thousands in the namespace**.

**Acceptance Criteria:**

- Schemas displayed as folder icons at root level, sorted alphabetically
- Click schema folder to expand and show tables within
- Accordion behavior: one schema expanded at a time
- Single-table schemas show table at root level (not nested)
- Expansion state preserved on refresh

---

### Story 6.2: Inline Column Filtering

As a **user**,
I want **to filter table data by typing in filter boxes below column headers**,
So that **I can quickly find specific records in tables with millions of rows**.

**Acceptance Criteria:**

- Filter row with input for each column below headers
- Columns with ≤10 distinct values: checklist dropdown (multi-select)
- Columns with >10 distinct values: text input with wildcard support
- Wildcards: `*` = any characters, `?` = single character
- No wildcard = implicit "contains" search
- Multiple column filters use AND logic
- Active filters visually highlighted
- "Clear all filters" button in toolbar
- "Toggle filters" button to disable/enable without losing criteria
- Disabled state shows criteria grayed out but preserved

---

### Story 6.3: Filter Panel with Advanced Options

As a **user**,
I want **a filter panel that shows all active filters and provides advanced filtering options**,
So that **I can manage complex filter combinations and use operators beyond simple text matching**.

**Acceptance Criteria:**

- "Filter Panel" button (funnel icon) in toolbar
- Collapsible panel showing all columns and their filter values
- Advanced operators: Contains, Starts with, Ends with, Equals, Not equals, Greater than, Less than, Is empty, Is not empty
- Synced with inline filter row (changes in either reflect in both)
- Remove (X) button for each individual filter
- Respects toggle on/off state

---

### Story 6.4: Column Sorting

As a **user**,
I want **to sort table data by clicking column headers**,
So that **I can organize data to find patterns or locate specific records**.

**Acceptance Criteria:**

- Click header: sort ascending (▲)
- Click again: sort descending (▼)
- Click again: clear sort (return to default order)
- Clicking different column switches sort to that column
- Sort applies to filtered results (filters remain active)
- Changing sort resets pagination to page 1
- Server-side sorting (SQL ORDER BY) for performance

---

### Story 6.5: Enhanced Pagination Controls

As a **user**,
I want **pagination controls with first, last, and direct page access**,
So that **I can navigate efficiently through tables with millions of rows**.

**Acceptance Criteria:**

- Controls: Row count | First (⏮) | Prev (◀) | Page input "X of Y" | Next (▶) | Last (⏭)
- First/Prev disabled on page 1; Next/Last disabled on last page
- Page input: type number + Enter (or blur) to navigate directly
- Invalid page numbers show error and revert
- Filter/sort changes reset to page 1
- Row counts formatted with thousands separators

---

### Story 6.6: Lazy Loading Verification & Optimization

As a **user**,
I want **the grid to load data lazily without fetching all rows**,
So that **performance remains fast even with tables containing millions of rows**.

**Acceptance Criteria:**

- Only current page (50 rows) fetched per request
- Total count fetched separately (COUNT query)
- No intermediate pages fetched during navigation
- Server-side filtering and sorting (not client-side)
- Loading indicator during fetches
- Rapid navigation debounced (cancel intermediate requests)

**Performance Targets:**
| Scenario | Target |
|----------|--------|
| Initial page load | < 2 seconds |
| Page navigation | < 1 second |
| Filter/sort apply | < 2 seconds |

---

## 5. Implementation Handoff

### Change Scope Classification: **Moderate**

This change requires:
- New epic added to backlog
- Updates to multiple planning artifacts (PRD, Architecture, UX, Epics)
- No changes to existing MVP implementation

### Handoff Assignments

| Role | Responsibility |
|------|----------------|
| **Product Manager** | Update PRD Growth Features section; finalize Epic 6 in epics.md |
| **Architect** | Update Architecture doc with new message types and SqlBuilder patterns |
| **UX Designer** | Update UX spec with tree view, filter row/panel, pagination designs |
| **Development Team** | Implement Epic 6 stories after artifacts updated |

### Success Criteria

- [ ] PRD updated with scalability requirements
- [ ] Architecture updated with new Commands/Events and query patterns
- [ ] UX spec updated with component designs
- [ ] Epic 6 added to epics.md with all 6 stories
- [ ] Stories implemented and tested
- [ ] Performance targets met for large datasets

### Sequencing

1. Update planning artifacts (PRD, Architecture, UX) - can be parallel
2. Add Epic 6 to epics.md
3. Implement stories 6.1-6.6 (recommended order as numbered)
4. Verify performance with large dataset testing

---

## Approval

**Proposal Status:** APPROVED

- [x] Approved - proceed with implementation
- [ ] Approved with modifications - (specify changes)
- [ ] Rejected - (specify reason)

**Approved by:** Developer
**Date:** 2026-01-29

---

*Generated via BMAD Correct Course workflow*
