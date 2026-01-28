// @ts-check
// IRIS Table Editor - Grid Webview JavaScript
// Story 2.1: Grid Component & Table Schema

(function() {
    'use strict';

    const LOG_PREFIX = '[IRIS-TE Grid]';

    // Get VS Code API
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    /**
     * Grid application state
     * Story 2.2: Added pagination state management with computed properties
     * Story 3.1: Added cell selection state
     * Story 3.2: Added cell editing state
     */
    class AppState {
        constructor() {
            /** @type {{ serverName: string; namespace: string; tableName: string } | null} */
            this.context = window.iteContext || null;
            /** @type {Array<{ name: string; dataType: string; nullable: boolean; maxLength?: number }>} */
            this.columns = [];
            /** @type {Array<Record<string, unknown>>} */
            this.rows = [];
            /** @type {number} */
            this.totalRows = 0;
            /** @type {number} - 1-indexed page number for user display */
            this.currentPage = 1;
            /** @type {number} */
            this.pageSize = 50;
            /** @type {boolean} */
            this.loading = false;
            /** @type {boolean} - separate loading state for pagination */
            this.paginationLoading = false;
            /** @type {string | null} */
            this.error = null;
            /** @type {{ rowIndex: number | null, colIndex: number | null }} - Story 3.1: Selected cell tracking */
            this.selectedCell = { rowIndex: null, colIndex: null };
            /** @type {{ rowIndex: number | null, colIndex: number | null }} - Story 3.2: Editing cell tracking */
            this.editingCell = { rowIndex: null, colIndex: null };
            /** @type {unknown} - Story 3.2: Original value for cancel/restore */
            this.editOriginalValue = null;
        }

        /**
         * Calculate total number of pages
         * @returns {number}
         */
        get totalPages() {
            if (this.totalRows === 0) return 0;
            return Math.ceil(this.totalRows / this.pageSize);
        }

        /**
         * Check if user can navigate to next page
         * @returns {boolean}
         */
        get canGoNext() {
            return this.currentPage < this.totalPages;
        }

        /**
         * Check if user can navigate to previous page
         * @returns {boolean}
         */
        get canGoPrev() {
            return this.currentPage > 1;
        }

        /**
         * Check if pagination controls should be shown
         * @returns {boolean}
         */
        get shouldShowPagination() {
            return this.totalRows > this.pageSize;
        }

        /**
         * Check if a cell is currently being edited
         * Story 3.2: Edit state helper
         * @returns {boolean}
         */
        get isEditing() {
            return this.editingCell.rowIndex !== null && this.editingCell.colIndex !== null;
        }
    }

    /** @type {AppState} */
    let state = new AppState();

    /**
     * Save state immediately to VS Code
     * Called after any state change to ensure persistence
     */
    function saveState() {
        vscode.setState(state);
    }

    /**
     * Escape HTML entities to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) {
            return '';
        }
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Announce message to screen readers
     * @param {string} message - Message to announce
     */
    function announce(message) {
        const liveRegion = document.getElementById('ite-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }

    /**
     * Format date/time value to locale-appropriate string
     * Story 2.3: Enhanced date formatting for readability
     * @param {unknown} value - Raw date value from database
     * @param {string} upperType - Uppercase data type
     * @returns {string} Formatted date string or raw value if parsing fails
     */
    function formatDateTimeValue(value, upperType) {
        if (!value) return String(value);

        try {
            const date = new Date(value);
            // Check for invalid date
            if (isNaN(date.getTime())) {
                return String(value);
            }

            // TIME only - show time portion
            if (upperType.includes('TIME') && !upperType.includes('TIMESTAMP') && !upperType.includes('DATETIME')) {
                return date.toLocaleTimeString();
            }
            // DATE only - show date portion
            if (upperType === 'DATE') {
                return date.toLocaleDateString();
            }
            // TIMESTAMP/DATETIME - show both date and time
            return date.toLocaleString();
        } catch {
            // Parsing failed - return raw value
            return String(value);
        }
    }

    /**
     * Format cell value based on data type
     * Story 2.3: Enhanced with proper date formatting and boolean support
     * @param {unknown} value - Cell value
     * @param {string} dataType - Column data type
     * @returns {{ display: string; cssClass: string; isNull: boolean }}
     */
    function formatCellValue(value, dataType) {
        // Handle null/undefined
        if (value === null || value === undefined || value === '') {
            return { display: 'NULL', cssClass: 'ite-grid__cell--null', isNull: true };
        }

        const upperType = dataType.toUpperCase();

        // Boolean types - display as Yes/No
        if (upperType === 'BIT' || upperType === 'BOOLEAN') {
            const boolValue = value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
            return { display: boolValue ? 'Yes' : 'No', cssClass: 'ite-grid__cell--boolean', isNull: false };
        }

        // Number types - return raw value (will be set via textContent, not innerHTML)
        if (['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'NUMERIC', 'DECIMAL', 'FLOAT', 'DOUBLE', 'REAL', 'MONEY'].some(t => upperType.includes(t))) {
            return { display: String(value), cssClass: 'ite-grid__cell--number', isNull: false };
        }

        // Date/time types - format for readability
        if (['DATE', 'TIME', 'TIMESTAMP', 'DATETIME'].some(t => upperType.includes(t))) {
            const formatted = formatDateTimeValue(value, upperType);
            return { display: formatted, cssClass: 'ite-grid__cell--date', isNull: false };
        }

        // Default - text (no escaping needed as we use textContent)
        return { display: String(value), cssClass: '', isNull: false };
    }

    // ==========================================
    // Story 3.2: Cell Editing Functions
    // ==========================================

    /**
     * Get the raw value of a cell from state
     * Story 3.2: Helper for edit mode
     * @param {number} rowIndex
     * @param {number} colIndex
     * @returns {unknown}
     */
    function getCellValue(rowIndex, colIndex) {
        if (rowIndex < 0 || rowIndex >= state.rows.length) return null;
        if (colIndex < 0 || colIndex >= state.columns.length) return null;
        const colName = state.columns[colIndex].name;
        return state.rows[rowIndex][colName];
    }

    /**
     * Enter edit mode for a cell
     * Story 3.2: Core edit function
     * @param {number} rowIndex - Row index (0-based)
     * @param {number} colIndex - Column index (0-based)
     * @param {string | null} [initialValue] - Initial value for input (null = use current cell value)
     * @param {'end' | 'select' | 'start'} [cursorPosition='select'] - Where to position cursor
     */
    function enterEditMode(rowIndex, colIndex, initialValue = null, cursorPosition = 'select') {
        // Validate bounds
        if (rowIndex < 0 || rowIndex >= state.rows.length) return;
        if (colIndex < 0 || colIndex >= state.columns.length) return;

        // If already editing a different cell, exit that first
        if (state.isEditing) {
            if (state.editingCell.rowIndex !== rowIndex || state.editingCell.colIndex !== colIndex) {
                exitEditMode(false); // Cancel without saving
            } else {
                // Already editing this cell, just return
                return;
            }
        }

        // Ensure cell is selected
        if (state.selectedCell.rowIndex !== rowIndex || state.selectedCell.colIndex !== colIndex) {
            selectCell(rowIndex, colIndex, false);
        }

        // Get current cell value and element
        const currentValue = getCellValue(rowIndex, colIndex);
        state.editOriginalValue = currentValue;
        state.editingCell = { rowIndex, colIndex };

        const cell = getCellElement(rowIndex, colIndex);
        if (!cell) return;

        // Determine the value to show in input
        const displayValue = initialValue !== null ? initialValue :
            (currentValue === null || currentValue === undefined) ? '' : String(currentValue);

        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'ite-grid__cell-input';
        input.value = displayValue;
        input.setAttribute('aria-label', `Edit ${state.columns[colIndex].name}`);

        // Replace cell content with input
        cell.textContent = '';
        cell.appendChild(input);
        cell.classList.add('ite-grid__cell--editing');

        // Setup input event handlers
        input.addEventListener('keydown', handleEditInputKeydown);
        input.addEventListener('blur', handleEditInputBlur);

        // Focus and position cursor
        input.focus();
        switch (cursorPosition) {
            case 'end':
                input.setSelectionRange(input.value.length, input.value.length);
                break;
            case 'start':
                input.setSelectionRange(0, 0);
                break;
            case 'select':
            default:
                input.select();
                break;
        }

        announce(`Editing ${state.columns[colIndex].name}`);
        console.debug(`${LOG_PREFIX} Entered edit mode for cell [${rowIndex}, ${colIndex}]`);
    }

    /**
     * Exit edit mode for the current cell
     * Story 3.2: Exit edit function
     * @param {boolean} saveValue - Whether to save the new value (true) or restore original (false)
     * @returns {{ saved: boolean; oldValue: unknown; newValue: unknown; rowIndex: number; colIndex: number } | null}
     */
    function exitEditMode(saveValue) {
        if (!state.isEditing) return null;

        const { rowIndex, colIndex } = state.editingCell;
        const cell = getCellElement(rowIndex, colIndex);
        const input = cell?.querySelector('.ite-grid__cell-input');

        let result = null;

        if (cell && input) {
            const newValue = /** @type {HTMLInputElement} */ (input).value;
            const oldValue = state.editOriginalValue;
            const colName = state.columns[colIndex].name;

            // Remove input event handlers
            input.removeEventListener('keydown', handleEditInputKeydown);
            input.removeEventListener('blur', handleEditInputBlur);

            // Restore cell content
            cell.classList.remove('ite-grid__cell--editing');

            if (saveValue) {
                // Update local state with new value
                // Convert empty string to null for proper NULL handling
                const valueToStore = newValue === '' ? null : newValue;
                state.rows[rowIndex][colName] = valueToStore;

                // Update display
                const { display, cssClass } = formatCellValue(valueToStore, state.columns[colIndex].dataType);
                cell.textContent = display;
                cell.className = `ite-grid__cell ${cssClass} ite-grid__cell--selected`.trim();
                cell.title = String(valueToStore ?? 'NULL');

                result = { saved: true, oldValue, newValue: valueToStore, rowIndex, colIndex };
                console.debug(`${LOG_PREFIX} Exited edit mode with save: "${oldValue}" -> "${valueToStore}"`);

                // Announce save for screen readers
                announce(`Saved ${colName}`);
            } else {
                // Restore original value
                const { display, cssClass } = formatCellValue(oldValue, state.columns[colIndex].dataType);
                cell.textContent = display;
                cell.className = `ite-grid__cell ${cssClass} ite-grid__cell--selected`.trim();
                cell.title = String(oldValue ?? 'NULL');

                result = { saved: false, oldValue, newValue: oldValue, rowIndex, colIndex };
                console.debug(`${LOG_PREFIX} Exited edit mode with cancel`);

                // Announce cancel for screen readers
                announce(`Cancelled editing ${colName}`);
            }

            // Restore cell attributes
            cell.setAttribute('aria-selected', 'true');
            cell.setAttribute('tabindex', '0');
        }

        // Clear edit state BEFORE any callbacks
        state.editingCell = { rowIndex: null, colIndex: null };
        state.editOriginalValue = null;

        // Re-focus the cell
        if (cell) {
            cell.focus();
        }

        // Save state after edit
        saveState();

        return result;
    }

    /**
     * Handle keydown events on the edit input
     * Story 3.2: Edit input keyboard handling
     * @param {KeyboardEvent} event
     */
    function handleEditInputKeydown(event) {
        switch (event.key) {
            case 'Enter':
                // Save and exit edit mode
                event.preventDefault();
                exitEditMode(true);
                break;

            case 'Escape':
                // Cancel and exit edit mode
                event.preventDefault();
                exitEditMode(false);
                break;

            case 'Tab':
                // Save and move to next/previous cell (Story 3.3 will enhance this)
                event.preventDefault();
                exitEditMode(true);
                // Navigate to next/previous cell
                if (state.selectedCell.rowIndex !== null && state.selectedCell.colIndex !== null) {
                    const { rowIndex, colIndex } = state.selectedCell;
                    const maxRow = state.rows.length - 1;
                    const maxCol = state.columns.length - 1;

                    if (event.shiftKey) {
                        // Move to previous cell
                        if (colIndex > 0) {
                            selectCell(rowIndex, colIndex - 1);
                        } else if (rowIndex > 0) {
                            selectCell(rowIndex - 1, maxCol);
                        }
                    } else {
                        // Move to next cell
                        if (colIndex < maxCol) {
                            selectCell(rowIndex, colIndex + 1);
                        } else if (rowIndex < maxRow) {
                            selectCell(rowIndex + 1, 0);
                        }
                    }
                }
                break;

            // Arrow keys should work normally in input for cursor movement
            // Only prevent if at boundaries and we want grid navigation
            case 'ArrowUp':
            case 'ArrowDown':
                // Allow these to work in input normally
                // Future: Could save and navigate to cell above/below
                break;
        }
    }

    /**
     * Handle blur event on edit input
     * Story 3.2: Save on blur (click outside)
     * @param {FocusEvent} event
     */
    function handleEditInputBlur(event) {
        // Check what element is receiving focus
        const relatedTarget = /** @type {HTMLElement | null} */ (event.relatedTarget);

        // If focus is going to another cell in the grid, let click/dblclick handlers manage the transition
        // They will call exitEditMode before entering edit on the new cell
        if (relatedTarget && relatedTarget.closest('.ite-grid__cell')) {
            return;
        }

        // Small delay to allow other handlers to process first
        // This handles cases like clicking toolbar buttons
        setTimeout(() => {
            if (state.isEditing) {
                exitEditMode(true); // Save on blur
            }
        }, 50);
    }

    /**
     * Handle double-click to enter edit mode
     * Story 3.2: Double-click edit entry
     * @param {MouseEvent} event
     */
    function handleCellDoubleClick(event) {
        const target = /** @type {HTMLElement} */ (event.target);

        // If clicking on the input itself, ignore
        if (target.classList.contains('ite-grid__cell-input')) return;

        const cell = target.closest('.ite-grid__cell');
        if (!cell) return;

        // Don't edit header cells
        if (cell.closest('.ite-grid__header-row')) return;

        // Find row and column index
        const row = cell.closest('.ite-grid__row');
        if (!row) return;

        const grid = document.getElementById('dataGrid');
        if (!grid) return;

        const rows = Array.from(grid.querySelectorAll('.ite-grid__row'));
        const rowIndex = rows.indexOf(row);
        if (rowIndex < 0) return;

        const cells = Array.from(row.querySelectorAll('.ite-grid__cell'));
        const colIndex = cells.indexOf(cell);
        if (colIndex < 0) return;

        enterEditMode(rowIndex, colIndex, null, 'select');
    }

    // ==========================================
    // Story 3.1: Cell Selection Functions
    // ==========================================

    /**
     * Get DOM element for a specific cell
     * Story 3.1: Helper for cell selection
     * @param {number} rowIndex - Row index (0-based, data rows only)
     * @param {number} colIndex - Column index (0-based)
     * @returns {HTMLElement | null}
     */
    function getCellElement(rowIndex, colIndex) {
        const grid = document.getElementById('dataGrid');
        if (!grid) return null;

        // Row index + 1 because first row is header
        const rows = grid.querySelectorAll('.ite-grid__row');
        if (rowIndex < 0 || rowIndex >= rows.length) return null;

        const cells = rows[rowIndex].querySelectorAll('.ite-grid__cell');
        if (colIndex < 0 || colIndex >= cells.length) return null;

        return /** @type {HTMLElement} */ (cells[colIndex]);
    }

    /**
     * Get currently selected cell element
     * Story 3.1: Helper for cell selection
     * @returns {HTMLElement | null}
     */
    function getSelectedCellElement() {
        if (state.selectedCell.rowIndex === null || state.selectedCell.colIndex === null) {
            return null;
        }
        return getCellElement(state.selectedCell.rowIndex, state.selectedCell.colIndex);
    }

    /**
     * Select a cell by row and column index
     * Story 3.1: Core selection function
     * @param {number} rowIndex - Row index (0-based, data rows only)
     * @param {number} colIndex - Column index (0-based)
     * @param {boolean} [focus=true] - Whether to focus the cell
     */
    function selectCell(rowIndex, colIndex, focus = true) {
        // Validate bounds
        if (rowIndex < 0 || rowIndex >= state.rows.length) return;
        if (colIndex < 0 || colIndex >= state.columns.length) return;

        // Remove selection from previous cell
        const prevCell = getSelectedCellElement();
        if (prevCell) {
            prevCell.classList.remove('ite-grid__cell--selected');
            prevCell.setAttribute('aria-selected', 'false');
            prevCell.setAttribute('tabindex', '-1');
        }

        // Update state
        state.selectedCell = { rowIndex, colIndex };

        // Add selection to new cell
        const newCell = getCellElement(rowIndex, colIndex);
        if (newCell) {
            newCell.classList.add('ite-grid__cell--selected');
            newCell.setAttribute('aria-selected', 'true');
            newCell.setAttribute('tabindex', '0');
            if (focus) {
                newCell.focus();
            }
        }

        // Announce for screen readers
        const colName = state.columns[colIndex]?.name || `Column ${colIndex + 1}`;
        announce(`${colName}, row ${rowIndex + 1} of ${state.rows.length}`);

        saveState();
    }

    /**
     * Handle cell click for selection
     * Story 3.1: Click selection
     * Story 3.2: Coordinate with edit mode - exit edit before selecting new cell
     * @param {MouseEvent} event
     */
    function handleCellClick(event) {
        const target = /** @type {HTMLElement} */ (event.target);

        // If clicking on edit input, don't process as cell click
        if (target.classList.contains('ite-grid__cell-input')) return;

        const cell = target.closest('.ite-grid__cell');
        if (!cell) return;

        // Don't select header cells
        if (cell.closest('.ite-grid__header-row')) return;

        // Find row and column index
        const row = cell.closest('.ite-grid__row');
        if (!row) return;

        const grid = document.getElementById('dataGrid');
        if (!grid) return;

        const rows = Array.from(grid.querySelectorAll('.ite-grid__row'));
        const rowIndex = rows.indexOf(row);
        if (rowIndex < 0) return;

        const cells = Array.from(row.querySelectorAll('.ite-grid__cell'));
        const colIndex = cells.indexOf(cell);
        if (colIndex < 0) return;

        // Story 3.2: If editing a different cell, exit edit mode first (save)
        if (state.isEditing) {
            if (state.editingCell.rowIndex !== rowIndex || state.editingCell.colIndex !== colIndex) {
                exitEditMode(true);
            }
        }

        selectCell(rowIndex, colIndex);
    }

    /**
     * Handle keyboard navigation for cell selection
     * Story 3.1: Keyboard navigation (Arrow keys, Tab, Shift+Tab)
     * Story 3.2: Added F2 to edit and typing to edit
     * @param {KeyboardEvent} event
     */
    function handleCellKeydown(event) {
        // Only handle if a cell is selected
        if (state.selectedCell.rowIndex === null || state.selectedCell.colIndex === null) {
            return;
        }

        // Story 3.2: If editing, let the input handle the event
        if (state.isEditing) {
            return;
        }

        const { rowIndex, colIndex } = state.selectedCell;
        const maxRow = state.rows.length - 1;
        const maxCol = state.columns.length - 1;

        switch (event.key) {
            // Story 3.2: F2 to enter edit mode
            case 'F2':
                event.preventDefault();
                enterEditMode(rowIndex, colIndex, null, 'end');
                return;

            case 'ArrowUp':
                event.preventDefault();
                if (rowIndex > 0) {
                    selectCell(rowIndex - 1, colIndex);
                }
                break;

            case 'ArrowDown':
                event.preventDefault();
                if (rowIndex < maxRow) {
                    selectCell(rowIndex + 1, colIndex);
                }
                break;

            case 'ArrowLeft':
                event.preventDefault();
                if (colIndex > 0) {
                    selectCell(rowIndex, colIndex - 1);
                }
                break;

            case 'ArrowRight':
                event.preventDefault();
                if (colIndex < maxCol) {
                    selectCell(rowIndex, colIndex + 1);
                }
                break;

            case 'Tab':
                if (event.shiftKey) {
                    // Shift+Tab: Move left, wrap to previous row
                    if (colIndex > 0) {
                        event.preventDefault();
                        selectCell(rowIndex, colIndex - 1);
                    } else if (rowIndex > 0) {
                        event.preventDefault();
                        selectCell(rowIndex - 1, maxCol);
                    }
                    // If at first cell (0,0), allow Tab to exit grid naturally
                } else {
                    // Tab: Move right, wrap to next row
                    if (colIndex < maxCol) {
                        event.preventDefault();
                        selectCell(rowIndex, colIndex + 1);
                    } else if (rowIndex < maxRow) {
                        event.preventDefault();
                        selectCell(rowIndex + 1, 0);
                    }
                    // If at last cell, allow Tab to exit grid naturally
                }
                break;

            case 'Home':
                event.preventDefault();
                if (event.ctrlKey) {
                    // Ctrl+Home: Go to first cell
                    selectCell(0, 0);
                } else {
                    // Home: Go to first cell in row
                    selectCell(rowIndex, 0);
                }
                break;

            case 'End':
                event.preventDefault();
                if (event.ctrlKey) {
                    // Ctrl+End: Go to last cell
                    selectCell(maxRow, maxCol);
                } else {
                    // End: Go to last cell in row
                    selectCell(rowIndex, maxCol);
                }
                break;

            // Story 3.2: Delete/Backspace to clear and edit
            case 'Delete':
            case 'Backspace':
                event.preventDefault();
                enterEditMode(rowIndex, colIndex, '', 'start');
                break;

            default:
                // Story 3.2: Printable characters start edit mode (overwrite)
                // Check if it's a single printable character and no modifier keys
                if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                    event.preventDefault();
                    enterEditMode(rowIndex, colIndex, event.key, 'end');
                }
                break;
        }
    }

    /**
     * Calculate column widths based on data types
     * @param {Array<{ name: string; dataType: string; maxLength?: number }>} columns
     * @returns {string} CSS grid-template-columns value
     */
    function calculateColumnWidths(columns) {
        return columns.map(col => {
            const upperType = col.dataType.toUpperCase();

            if (['INTEGER', 'SMALLINT', 'TINYINT'].some(t => upperType.includes(t))) {
                return '80px';
            }
            if (['BIGINT'].some(t => upperType.includes(t))) {
                return '120px';
            }
            if (['TIMESTAMP', 'DATETIME'].some(t => upperType.includes(t))) {
                return '180px';
            }
            if (['DATE'].some(t => upperType.includes(t))) {
                return '120px';
            }
            if (['TIME'].some(t => upperType.includes(t))) {
                return '100px';
            }
            if (['NUMERIC', 'DECIMAL', 'FLOAT', 'DOUBLE', 'REAL'].some(t => upperType.includes(t))) {
                return '120px';
            }

            // VARCHAR, TEXT - based on maxLength
            const charWidth = Math.min(col.maxLength || 50, 50);
            return `${Math.max(80, charWidth * 8)}px`;
        }).join(' ');
    }

    /**
     * Render grid header row
     */
    function renderHeader() {
        const grid = document.getElementById('dataGrid');
        if (!grid || !state.columns.length) {
            return;
        }

        const headerRow = document.createElement('div');
        headerRow.className = 'ite-grid__header-row';
        headerRow.setAttribute('role', 'row');

        state.columns.forEach((col, index) => {
            const cell = document.createElement('div');
            cell.className = 'ite-grid__header-cell';
            cell.setAttribute('role', 'columnheader');
            cell.setAttribute('aria-colindex', String(index + 1));
            cell.textContent = col.name;
            cell.title = `${col.name} (${col.dataType}${col.nullable ? ', nullable' : ''})`;
            headerRow.appendChild(cell);
        });

        grid.appendChild(headerRow);
    }

    /**
     * Render grid data rows
     * Story 3.1: Added cell selection support with tabindex and aria-selected
     */
    function renderRows() {
        const grid = document.getElementById('dataGrid');
        if (!grid) {
            return;
        }

        state.rows.forEach((row, rowIndex) => {
            const dataRow = document.createElement('div');
            dataRow.className = 'ite-grid__row';
            dataRow.setAttribute('role', 'row');
            dataRow.setAttribute('aria-rowindex', String(rowIndex + 2)); // +2 for header row

            state.columns.forEach((col, colIndex) => {
                const cell = document.createElement('div');
                const { display, cssClass } = formatCellValue(row[col.name], col.dataType);

                cell.className = `ite-grid__cell ${cssClass}`.trim();
                cell.setAttribute('role', 'gridcell');
                cell.setAttribute('aria-colindex', String(colIndex + 1));

                // Story 3.1: Cell selection support
                // Check if this cell should be selected (restored from state)
                const isSelected = state.selectedCell.rowIndex === rowIndex &&
                                   state.selectedCell.colIndex === colIndex;

                if (isSelected) {
                    cell.classList.add('ite-grid__cell--selected');
                    cell.setAttribute('aria-selected', 'true');
                    cell.setAttribute('tabindex', '0');
                } else {
                    cell.setAttribute('aria-selected', 'false');
                    // First cell gets tabindex=0 if no selection, others get -1
                    const isFirstCell = rowIndex === 0 && colIndex === 0;
                    const hasSelection = state.selectedCell.rowIndex !== null;
                    cell.setAttribute('tabindex', (!hasSelection && isFirstCell) ? '0' : '-1');
                }

                // SECURITY: Use textContent instead of innerHTML to prevent XSS
                cell.textContent = display;
                cell.title = String(row[col.name] ?? 'NULL');

                dataRow.appendChild(cell);
            });

            grid.appendChild(dataRow);
        });
    }

    /**
     * Update status bar
     * Story 2.2: Updated to use 1-indexed currentPage
     */
    function updateStatusBar() {
        const statusText = document.getElementById('statusText');
        if (statusText) {
            if (state.loading) {
                statusText.textContent = 'Loading...';
            } else if (state.error) {
                statusText.textContent = `Error: ${state.error}`;
            } else {
                const start = (state.currentPage - 1) * state.pageSize + 1;
                const end = Math.min(start + state.rows.length - 1, state.totalRows);
                statusText.textContent = state.totalRows > 0
                    ? `Showing ${start}-${end} of ${state.totalRows} rows`
                    : 'No data';
            }
        }
    }

    /**
     * Create pagination indicator text
     * Story 2.2: Pagination UI
     * @returns {string}
     */
    function getPaginationIndicator() {
        if (state.totalRows === 0) return 'No data';
        const start = (state.currentPage - 1) * state.pageSize + 1;
        const end = Math.min(start + state.rows.length - 1, state.totalRows);
        return `Rows ${start}-${end} of ${state.totalRows}`;
    }

    /**
     * Update pagination UI
     * Story 2.2: Pagination controls and indicator with loading state
     */
    function updatePaginationUI() {
        const paginationContainer = document.getElementById('paginationContainer');
        if (!paginationContainer) return;

        // Show/hide pagination based on total rows
        if (!state.shouldShowPagination) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'flex';

        // Update indicator text (show loading state)
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) {
            if (state.paginationLoading) {
                paginationInfo.textContent = 'Loading...';
            } else {
                paginationInfo.textContent = getPaginationIndicator();
            }
        }

        // Update button states
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');

        if (prevBtn) {
            prevBtn.disabled = !state.canGoPrev || state.paginationLoading;
            prevBtn.setAttribute('aria-disabled', String(!state.canGoPrev || state.paginationLoading));
            prevBtn.classList.toggle('ite-pagination__button--loading', state.paginationLoading);
        }

        if (nextBtn) {
            nextBtn.disabled = !state.canGoNext || state.paginationLoading;
            nextBtn.setAttribute('aria-disabled', String(!state.canGoNext || state.paginationLoading));
            nextBtn.classList.toggle('ite-pagination__button--loading', state.paginationLoading);
        }
    }

    /**
     * Handle paginate next
     * Story 2.2: Pagination navigation
     */
    function handlePaginateNext() {
        if (!state.canGoNext || state.paginationLoading) return;

        console.debug(`${LOG_PREFIX} Paginate next from page ${state.currentPage}`);
        state.paginationLoading = true;
        updatePaginationUI();

        sendCommand('paginateNext', {
            direction: 'next',
            currentPage: state.currentPage,
            pageSize: state.pageSize
        });

        announce(`Loading page ${state.currentPage + 1} of ${state.totalPages}`);
    }

    /**
     * Handle paginate previous
     * Story 2.2: Pagination navigation
     */
    function handlePaginatePrev() {
        if (!state.canGoPrev || state.paginationLoading) return;

        console.debug(`${LOG_PREFIX} Paginate prev from page ${state.currentPage}`);
        state.paginationLoading = true;
        updatePaginationUI();

        sendCommand('paginatePrev', {
            direction: 'prev',
            currentPage: state.currentPage,
            pageSize: state.pageSize
        });

        announce(`Loading page ${state.currentPage - 1} of ${state.totalPages}`);
    }

    /**
     * Show loading state
     * @param {boolean} loading
     * @param {string} [context]
     */
    function setLoading(loading, context) {
        state.loading = loading;

        const loadingOverlay = document.getElementById('loadingOverlay');
        const gridWrapper = document.getElementById('gridWrapper');
        const loadingText = loadingOverlay?.querySelector('.ite-loading__text');

        if (loadingOverlay) {
            loadingOverlay.style.display = loading ? 'flex' : 'none';
        }
        if (gridWrapper) {
            gridWrapper.style.display = loading ? 'none' : 'block';
        }
        if (loadingText && context) {
            loadingText.textContent = context;
        }

        updateStatusBar();

        if (loading) {
            announce(context || 'Loading table data');
        }
    }

    /**
     * Clear grid content
     */
    function clearGrid() {
        const grid = document.getElementById('dataGrid');
        if (grid) {
            grid.innerHTML = '';
        }
    }

    /**
     * Render empty state message
     * Story 2.2: Edge case handling for empty tables
     */
    function renderEmptyState() {
        const grid = document.getElementById('dataGrid');
        if (!grid) return;

        const emptyRow = document.createElement('div');
        emptyRow.className = 'ite-grid__empty-row';
        emptyRow.setAttribute('role', 'row');

        const emptyCell = document.createElement('div');
        emptyCell.className = 'ite-grid__empty-cell';
        emptyCell.setAttribute('role', 'gridcell');
        // Note: colspan is invalid on div elements; empty cell spans via CSS width: 100%
        emptyCell.textContent = 'No data in table';

        emptyRow.appendChild(emptyCell);
        grid.appendChild(emptyRow);
    }

    /**
     * Render the full grid
     * Story 2.2: Added pagination UI update and empty state handling
     * Story 3.1: Added selection restoration after render
     */
    function renderGrid() {
        clearGrid();

        if (state.columns.length === 0) {
            return;
        }

        renderHeader();

        // Story 2.2: Handle empty table edge case
        if (state.rows.length === 0) {
            renderEmptyState();
            // Story 3.1: Clear selection when no rows
            state.selectedCell = { rowIndex: null, colIndex: null };
        } else {
            renderRows();

            // Story 3.1: Validate and restore selection after render
            // If selection is out of bounds (e.g., after refresh), clear it
            if (state.selectedCell.rowIndex !== null && state.selectedCell.colIndex !== null) {
                if (state.selectedCell.rowIndex >= state.rows.length ||
                    state.selectedCell.colIndex >= state.columns.length) {
                    state.selectedCell = { rowIndex: null, colIndex: null };
                }
            }
        }

        updateStatusBar();
        updatePaginationUI();

        const message = state.rows.length === 0
            ? 'Table is empty'
            : `Table loaded with ${state.rows.length} rows`;
        announce(message);
    }

    /**
     * Handle tableSchema event
     * @param {{ tableName: string; namespace: string; serverName: string; columns: Array<{ name: string; dataType: string; nullable: boolean; maxLength?: number }> }} payload
     */
    function handleTableSchema(payload) {
        console.debug(`${LOG_PREFIX} Received schema:`, payload.columns.length, 'columns');
        state.columns = payload.columns;
        state.context = {
            serverName: payload.serverName,
            namespace: payload.namespace,
            tableName: payload.tableName
        };
        saveState(); // Persist immediately after schema update
    }

    /**
     * Handle tableData event
     * Story 2.2: Updated to use 1-indexed currentPage and clear pagination loading
     * Story 3.1: Clear selection on page change to avoid stale indices
     * @param {{ rows: Array<Record<string, unknown>>; totalRows: number; page: number; pageSize: number }} payload
     */
    function handleTableData(payload) {
        console.debug(`${LOG_PREFIX} Received data:`, payload.rows.length, 'rows');
        state.rows = payload.rows;
        state.totalRows = payload.totalRows;
        // Convert from 0-indexed API page to 1-indexed display page
        state.currentPage = payload.page + 1;
        state.pageSize = payload.pageSize;
        state.error = null;
        state.paginationLoading = false;

        // Story 3.1: Clear selection on page change - indices are page-relative
        state.selectedCell = { rowIndex: null, colIndex: null };
        // Story 3.2: Clear edit state on page change
        state.editingCell = { rowIndex: null, colIndex: null };
        state.editOriginalValue = null;

        renderGrid();
        updatePaginationUI();
        saveState(); // Persist immediately after data update
    }

    /**
     * Handle tableLoading event
     * @param {{ loading: boolean; context: string }} payload
     */
    function handleTableLoading(payload) {
        setLoading(payload.loading, payload.context);
    }

    /**
     * Handle error event
     * Story 2.2: Updated to preserve current view during pagination errors
     * @param {{ message: string; code: string }} payload
     */
    function handleError(payload) {
        console.error(`${LOG_PREFIX} Error:`, payload);
        state.error = payload.message;
        state.loading = false;

        // Story 2.2: If we have data (pagination error), keep the current view
        const wasPaginationError = state.paginationLoading;
        state.paginationLoading = false;

        const loadingOverlay = document.getElementById('loadingOverlay');
        const gridWrapper = document.getElementById('gridWrapper');

        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }

        // Only hide grid if we don't have data to show
        if (!wasPaginationError || state.rows.length === 0) {
            if (gridWrapper) {
                gridWrapper.style.display = 'none';
            }
        } else {
            // Keep current view visible during pagination error
            if (gridWrapper) {
                gridWrapper.style.display = 'block';
            }
        }

        updateStatusBar();
        updatePaginationUI();
        announce(`Error: ${payload.message}`);
        saveState(); // Persist error state
    }

    /**
     * Send command to extension
     * @param {string} command
     * @param {unknown} payload
     */
    function sendCommand(command, payload) {
        vscode.postMessage({ command, payload });
    }

    /**
     * Handle refresh button click
     */
    function handleRefresh() {
        console.debug(`${LOG_PREFIX} Refresh clicked`);
        sendCommand('refresh', {});
    }

    /**
     * Handle messages from extension
     * @param {MessageEvent} event
     */
    function handleMessage(event) {
        const message = event.data;
        console.debug(`${LOG_PREFIX} Received event:`, message.event);

        switch (message.event) {
            case 'tableSchema':
                handleTableSchema(message.payload);
                break;
            case 'tableData':
                handleTableData(message.payload);
                break;
            case 'tableLoading':
                handleTableLoading(message.payload);
                break;
            case 'error':
                handleError(message.payload);
                break;
            default:
                console.debug(`${LOG_PREFIX} Unknown event:`, message.event);
        }
    }

    /**
     * Initialize grid
     * Story 2.2: Added pagination button event listeners and keyboard shortcuts
     * Story 3.1: Added cell selection click and keyboard handlers
     */
    function init() {
        console.debug(`${LOG_PREFIX} Initializing grid`);

        // Restore state if available
        const previousState = vscode.getState();
        if (previousState) {
            state = Object.assign(new AppState(), previousState);
            // Story 3.1: Ensure selectedCell is properly initialized
            if (!state.selectedCell) {
                state.selectedCell = { rowIndex: null, colIndex: null };
            }
            // Story 3.2: Ensure editingCell is properly initialized (never persist edit state)
            state.editingCell = { rowIndex: null, colIndex: null };
            state.editOriginalValue = null;
            if (state.columns.length > 0) {
                renderGrid();
            }
        }

        // Listen for messages from extension
        window.addEventListener('message', handleMessage);

        // Setup refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', handleRefresh);
        }

        // Story 2.2: Setup pagination buttons
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');

        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', handlePaginatePrev);
        }
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', handlePaginateNext);
        }

        // Story 3.1: Setup cell selection click handler (delegated on grid)
        // Story 3.2: Added double-click for edit mode
        // Note: Using named functions allows removeEventListener if needed
        // Event listeners are safe here because init() only runs once per webview load
        const grid = document.getElementById('dataGrid');
        if (grid && !grid.dataset.listenersAttached) {
            grid.addEventListener('click', handleCellClick);
            grid.addEventListener('dblclick', handleCellDoubleClick);
            grid.addEventListener('keydown', handleCellKeydown);
            grid.dataset.listenersAttached = 'true';
        }

        // Story 2.2: Setup keyboard shortcuts for pagination
        // Note: handleKeyboardNavigation handles Ctrl+PageUp/Down for pagination
        // Story 3.1: handleCellKeydown handles arrow keys and Tab for cell navigation
        document.addEventListener('keydown', handleKeyboardNavigation);

        // State is now saved immediately on each data change (event-driven)
        // This replaces the previous interval-based approach for better reliability

        console.debug(`${LOG_PREFIX} Grid initialized`);
    }

    /**
     * Handle keyboard navigation for pagination
     * Story 2.2: Keyboard shortcuts (Ctrl+PageDown/PageUp or Alt+Right/Left)
     * @param {KeyboardEvent} event
     */
    function handleKeyboardNavigation(event) {
        // Ctrl+PageDown or Alt+Right for next page
        if ((event.ctrlKey && event.key === 'PageDown') || (event.altKey && event.key === 'ArrowRight')) {
            event.preventDefault();
            handlePaginateNext();
            return;
        }

        // Ctrl+PageUp or Alt+Left for previous page
        if ((event.ctrlKey && event.key === 'PageUp') || (event.altKey && event.key === 'ArrowLeft')) {
            event.preventDefault();
            handlePaginatePrev();
            return;
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
