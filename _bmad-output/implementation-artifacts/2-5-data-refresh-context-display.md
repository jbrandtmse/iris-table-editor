# Story 2.5: Data Refresh & Context Display

## Story

**As a** user,
**I want** to refresh data and always see where I am,
**So that** I see current data and know which table I'm viewing.

## Status

| Field | Value |
|-------|-------|
| Status | ready-for-dev |
| Epic | 2 - Table Data Display |
| Story Points | 2 |
| Prepared | 2026-01-28 |

## Acceptance Criteria

### AC1: Context Breadcrumb Display
**Given** a table grid is open
**When** I look at the toolbar/header area
**Then** I see a context breadcrumb: "server > namespace > table"
**And** I see a Refresh button

### AC2: Refresh Functionality
**Given** I click the Refresh button
**When** the refresh executes
**Then** data reloads from the server
**And** I see fresh data (reflecting any external changes)
**And** my current page position is preserved if possible

### AC3: Context Bar Overflow Handling
**Given** the context bar is in a narrow panel
**When** text would overflow
**Then** it truncates with ellipsis
**And** hovering shows the full path in a tooltip

## Requirements Covered

**Functional Requirements:**
- FR15: User can refresh table data to see latest changes

**UX Requirements:**
- UX5: Context bar showing breadcrumb: server > namespace > table
- UX17: Context bar truncates with ellipsis, full text in tooltip
- UX15: Minimum usable panel width: 300px

## Technical Context

### Current Implementation Analysis

**Already Implemented (Epic 2 - Stories 2.1/2.2):**

1. **Context Bar** - GridPanelManager.ts:346-352
   ```html
   <div class="ite-context-bar">
       <span class="ite-context-bar__server">serverName</span>
       <span class="ite-context-bar__separator">&gt;</span>
       <span class="ite-context-bar__namespace">namespace</span>
       <span class="ite-context-bar__separator">&gt;</span>
       <span class="ite-context-bar__table">tableName</span>
   </div>
   ```

2. **Refresh Button** - GridPanelManager.ts:355-358
   - Toolbar with refresh button using codicon-refresh icon

3. **Refresh Handler** - grid.js:575-578, GridPanelManager.ts:147-149
   - `handleRefresh()` sends 'refresh' command
   - GridPanelManager handles 'refresh' and calls `_loadTableData` with current page/size

4. **Page Position Preservation** - GridPanelManager.ts:148
   - Already uses `context.currentPage` and `context.pageSize` on refresh

### Gap Analysis

| Feature | Status | Work Needed |
|---------|--------|-------------|
| Breadcrumb display | ✅ Exists | None |
| Refresh button | ✅ Exists | None |
| Refresh preserves page | ✅ Exists | None |
| Ellipsis truncation | ❌ Missing | Add CSS |
| Tooltip on hover | ❌ Missing | Add HTML title attribute |

### Implementation Approach

1. Add CSS for truncation in narrow widths (flex-shrink, text-overflow)
2. Add title attribute to context bar for full path tooltip
3. Verify all existing functionality works correctly

## Tasks

### Task 1: Add Truncation Styling to Context Bar
- [ ] Add `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` to breadcrumb items
- [ ] Set appropriate `max-width` and `flex` properties for responsive behavior
- [ ] Ensure separators don't wrap

### Task 2: Add Tooltip for Full Path
- [ ] Add `title` attribute to `.ite-context-bar` with full path
- [ ] Update GridPanelManager.ts to include title in HTML generation

### Task 3: Verify Existing Functionality
- [ ] Test refresh button preserves page position
- [ ] Test breadcrumb displays correct server/namespace/table
- [ ] Test data refreshes correctly

## Dev Notes

### Files to Modify

| File | Changes |
|------|---------|
| `media/grid-styles.css` | Add truncation styles for context bar |
| `src/providers/GridPanelManager.ts` | Add title attribute for tooltip |

### CSS Pattern for Truncation

```css
.ite-context-bar {
    overflow: hidden;
    min-width: 0; /* Allow shrinking below content size */
}

.ite-context-bar__server,
.ite-context-bar__namespace {
    flex: 0 1 auto; /* Can shrink, basis auto */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}

.ite-context-bar__table {
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ite-context-bar__separator {
    flex-shrink: 0; /* Don't shrink separators */
}
```

### Tooltip Pattern

```html
<div class="ite-context-bar" title="serverName > namespace > tableName">
    ...
</div>
```

### Acceptance Test Checklist

- [ ] Breadcrumb shows "server > namespace > table"
- [ ] Refresh button visible in toolbar
- [ ] Click refresh reloads data
- [ ] Page position preserved after refresh
- [ ] Narrow panel: breadcrumb truncates with ellipsis
- [ ] Hover on truncated breadcrumb shows full path tooltip

---

## Dev Agent Record

_This section populated during implementation_

### Implementation Notes

**What Was Already Done (Stories 2.1/2.2):**
- Context bar with breadcrumb structure
- Refresh button in toolbar
- Refresh handler preserving page position
- Grid data loading with pagination

**New Implementation:**
1. Added CSS truncation to context bar items (flex-shrink, text-overflow: ellipsis)
2. Added `title` attribute to context bar and each breadcrumb item for tooltip
3. Set appropriate min/max widths for balanced truncation
4. Separators marked as `flex-shrink: 0` to prevent wrapping

### Files Modified

| File | Changes |
|------|---------|
| `media/grid-styles.css` | Added truncation styles (flex, overflow, text-overflow, min/max-width) |
| `src/providers/GridPanelManager.ts` | Added title attributes to context bar and breadcrumb items |

### CSS Changes Summary

```css
.ite-context-bar {
    overflow: hidden;
    min-width: 0;
}

.ite-context-bar__server,
.ite-context-bar__namespace {
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
}

.ite-context-bar__table {
    flex: 1 1 auto; /* Table name gets more priority */
    overflow: hidden;
    text-overflow: ellipsis;
}

.ite-context-bar__separator {
    flex-shrink: 0; /* Separators don't shrink */
}
```

### Testing Performed

- [x] Build compiles successfully (`npm run compile`)
- [ ] Manual testing: Context bar truncation in narrow panel
- [ ] Manual testing: Tooltip shows full path on hover
- [ ] Manual testing: Refresh preserves page position

### Issues Encountered

None - implementation was straightforward. Most functionality (refresh, breadcrumb display) was already in place from Stories 2.1/2.2.
