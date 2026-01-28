# Story 2.4: Theme Support (Light/Dark)

## Story

**As a** user,
**I want** the grid to match my VS Code theme,
**So that** the extension feels native to my development environment.

## Status

| Field | Value |
|-------|-------|
| Status | ready-for-dev |
| Epic | 2 - Table Data Display |
| Story Points | 3 |
| Prepared | 2026-01-28 |

## Acceptance Criteria

### AC1: Light Theme Support
**Given** VS Code is using a light theme
**When** I view the grid
**Then** the grid uses light backgrounds and appropriate contrast colors
**And** all text is readable

### AC2: Dark Theme Support
**Given** VS Code is using a dark theme
**When** I view the grid
**Then** the grid uses dark backgrounds and appropriate contrast colors
**And** all text is readable

### AC3: High Contrast Theme Support
**Given** VS Code is using High Contrast theme
**When** I view the grid
**Then** the grid respects high contrast colors
**And** focus indicators are clearly visible

### AC4: Dynamic Theme Switching
**Given** I switch VS Code themes while the grid is open
**When** the theme changes
**Then** the grid updates to match the new theme automatically

## Requirements Covered

**Functional Requirements:**
- FR35: Extension displays correctly in VS Code light theme
- FR36: Extension displays correctly in VS Code dark theme

**UX Requirements:**
- UX9: WCAG 2.1 AA compliance
- UX12: Focus indicators visible at all times (2px solid border)
- UX13: Support VS Code High Contrast theme
- UX14: Respect prefers-reduced-motion for animations

**Non-Functional Requirements:**
- Theme responsiveness should be instant (no user-perceptible delay)

## Technical Context

### Current Implementation Analysis

The extension already uses VS Code CSS variables throughout both CSS files:

**media/styles.css** (sidebar):
- Uses `--vscode-foreground`, `--vscode-editor-background`, `--vscode-button-*`
- Uses `--vscode-list-*` for selection states
- Has `@media (prefers-reduced-motion: reduce)` support

**media/grid-styles.css** (grid):
- Uses `--vscode-foreground`, `--vscode-editor-background`
- Uses `--vscode-editorWidget-background`, `--vscode-widget-border`
- Uses `--vscode-statusBar-*`, `--vscode-breadcrumb-*`
- Has `@media (prefers-reduced-motion: reduce)` support

### Gap Analysis

1. **High Contrast Mode** - Need to add specific high contrast support with enhanced focus indicators
2. **Focus Visibility** - Ensure 2px solid focus borders on all interactive elements
3. **Color Contrast** - Audit all color combinations for WCAG 2.1 AA compliance (4.5:1 for text, 3:1 for UI)
4. **Dynamic Theme Switch** - VS Code CSS variables automatically update; verify no custom colors bypass this

### Key VS Code Theme CSS Variables

```css
/* Core colors - automatically adapt to theme */
--vscode-foreground
--vscode-editor-background
--vscode-focusBorder

/* High Contrast specific */
--vscode-contrastActiveBorder
--vscode-contrastBorder

/* Focus/Selection colors */
--vscode-list-focusOutline
--vscode-list-focusAndSelectionOutline
```

### Implementation Approach

1. Audit both CSS files for any hardcoded colors
2. Add high contrast media query with enhanced borders
3. Ensure all focusable elements have visible focus indicators
4. Test in Light, Dark, Dark High Contrast, and Light High Contrast themes

## Tasks

### Task 1: Audit CSS for Hardcoded Colors
- [ ] Review grid-styles.css for any non-variable colors
- [ ] Review styles.css for any non-variable colors
- [ ] Document any fallback colors that need high contrast alternatives

### Task 2: Add High Contrast Theme Support
- [ ] Add `@media (forced-colors: active)` support for Windows High Contrast
- [ ] Ensure borders use `--vscode-contrastBorder` in high contrast
- [ ] Ensure focus uses `--vscode-contrastActiveBorder` in high contrast
- [ ] Test grid cell borders are visible in high contrast mode

### Task 3: Enhance Focus Indicators
- [ ] Verify all buttons have 2px focus border
- [ ] Verify grid cells (when clickable) have focus indicator
- [ ] Ensure pagination buttons have clear focus state
- [ ] Add :focus-visible for keyboard-only focus indicators

### Task 4: Test All Theme Combinations
- [ ] Test Light theme (Default Light Modern)
- [ ] Test Dark theme (Default Dark Modern)
- [ ] Test High Contrast Light
- [ ] Test High Contrast Dark
- [ ] Verify dynamic switching between all themes

## Dev Notes

### Files to Modify

| File | Changes |
|------|---------|
| `media/grid-styles.css` | Add high contrast support, verify focus indicators |
| `media/styles.css` | Add high contrast support, verify focus indicators |

### Testing Commands

```bash
# Build and test
npm run compile

# Test in Extension Development Host:
# 1. Press F5
# 2. Open command palette, run "Preferences: Color Theme"
# 3. Test each theme: Light Modern, Dark Modern, High Contrast Light, High Contrast Dark
# 4. With grid open, switch themes rapidly to verify dynamic update
```

### High Contrast Media Query Pattern

```css
/* Windows High Contrast Mode */
@media (forced-colors: active) {
    .ite-grid__cell {
        border-color: CanvasText;
    }

    .ite-toolbar__button:focus {
        outline: 2px solid Highlight;
    }
}

/* VS Code High Contrast Theme detection via CSS variables */
/* High contrast themes set --vscode-contrastBorder */
.ite-grid__cell {
    border-color: var(--vscode-contrastBorder, var(--vscode-widget-border));
}
```

### Acceptance Test Checklist

- [ ] Grid readable in Light theme
- [ ] Grid readable in Dark theme
- [ ] Grid usable in High Contrast Light
- [ ] Grid usable in High Contrast Dark
- [ ] Focus indicators visible in all themes
- [ ] Theme switch while grid open updates colors instantly
- [ ] No flickering during theme switch
- [ ] All text meets WCAG AA contrast requirements

---

## Dev Agent Record

_This section populated during implementation_

### Implementation Notes

**Audit Results:**
- Both CSS files already use VS Code CSS variables exclusively for colors
- No hardcoded colors found that needed replacement
- Dynamic theme switching works automatically via CSS variables

**High Contrast Implementation:**
1. Added support for `--vscode-contrastBorder` and `--vscode-contrastActiveBorder` CSS variables
2. These variables are only set by VS Code in high contrast themes, so we use fallbacks for regular themes
3. Added `@media (forced-colors: active)` for Windows High Contrast mode
4. System colors (Highlight, HighlightText, CanvasText, Canvas, etc.) are used in forced-colors mode

**Focus Indicator Enhancement:**
- Changed `:focus` to `:focus-visible` for keyboard-only focus indicators (better UX)
- Ensured 2px solid focus borders per UX12 requirement
- Focus indicators use `--vscode-contrastActiveBorder` in high contrast mode

### Files Modified

| File | Changes |
|------|---------|
| `media/grid-styles.css` | Added high contrast support, enhanced focus indicators, Windows forced-colors support |
| `media/styles.css` | Added high contrast support, enhanced focus indicators, Windows forced-colors support |

### Key CSS Patterns Used

```css
/* High contrast border pattern */
border-color: var(--vscode-contrastBorder, var(--vscode-widget-border));

/* High contrast focus pattern */
outline: 2px solid var(--vscode-contrastActiveBorder, var(--vscode-focusBorder));

/* Windows High Contrast Mode */
@media (forced-colors: active) {
    /* Uses system colors: Highlight, HighlightText, CanvasText, Canvas, etc. */
}
```

### Testing Performed

- [x] Build compiles successfully (`npm run compile`)
- [ ] Manual testing in Light theme (Default Light Modern)
- [ ] Manual testing in Dark theme (Default Dark Modern)
- [ ] Manual testing in High Contrast Light
- [ ] Manual testing in High Contrast Dark
- [ ] Dynamic theme switching verification

### Issues Encountered

None - the existing codebase was well-structured with VS Code CSS variables, making this enhancement straightforward.
