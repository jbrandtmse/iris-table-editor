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
            /** @type {Map<string, { rowIndex: number; colIndex: number; oldValue: unknown; pkValue: unknown }>} - Story 3.3: Pending saves tracking */
            this.pendingSaves = new Map();
            /** @type {Array<Record<string, unknown>>} - Story 4.1: New rows pending INSERT */
            this.newRows = [];
            /** @type {number | null} - Story 5.1: Selected row for deletion */
            this.selectedRowIndex = null;
            /** @type {Map<string, string>} - Story 6.2: Filter values per column */
            this.filters = new Map();
            /** @type {boolean} - Story 6.2: Whether filters are currently applied */
            this.filtersEnabled = true;
            /** @type {number} - Story 6.2: Total rows matching current filters (may differ from totalRows) */
            this.totalFilteredRows = 0;
            /** @type {string | null} - Story 6.4: Column currently sorted by */
            this.sortColumn = null;
            /** @type {'asc' | 'desc' | null} - Story 6.4: Current sort direction */
            this.sortDirection = null;
            /** @type {number} - Column width in pixels for data columns */
            this.columnWidth = 150;
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

        /**
         * Check if there are unsaved new rows
         * Story 4.1: New row state helper
         * @returns {boolean}
         */
        get hasNewRows() {
            return this.newRows.length > 0;
        }

        /**
         * Get total display rows (server rows + new rows)
         * Story 4.1: New row state helper
         * @returns {number}
         */
        get totalDisplayRows() {
            return this.rows.length + this.newRows.length;
        }

        /**
         * Check if a row is selected for deletion
         * Story 5.1: Row selection helper
         * @returns {boolean}
         */
        get hasSelectedRow() {
            return this.selectedRowIndex !== null;
        }

        /**
         * Check if selected row is a new (unsaved) row
         * Story 5.1: Can't delete new rows - must be server rows
         * @returns {boolean}
         */
        get selectedRowIsNew() {
            if (this.selectedRowIndex === null) return false;
            return this.selectedRowIndex >= this.rows.length;
        }

        /**
         * Check if any filters are set
         * Story 6.2: Filter state helper
         * @returns {boolean}
         */
        get hasFilters() {
            return this.filters.size > 0 && Array.from(this.filters.values()).some(v => v.trim() !== '');
        }

        /**
         * Check if filters are active (set and enabled)
         * Story 6.2: Filter state helper
         * @returns {boolean}
         */
        get filtersActive() {
            return this.hasFilters && this.filtersEnabled;
        }

        /**
         * Get filter criteria as array for backend
         * Story 6.2: Convert filters to array format
         * @returns {Array<{column: string, value: string}>}
         */
        getFilterCriteria() {
            const criteria = [];
            this.filters.forEach((value, column) => {
                if (value.trim() !== '') {
                    criteria.push({ column, value: value.trim() });
                }
            });
            return criteria;
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
     * @returns {{ display: string; cssClass: string; isNull: boolean; isBoolean?: boolean; boolValue?: boolean|null }}
     */
    function formatCellValue(value, dataType) {
        const upperType = dataType.toUpperCase();

        // Story 7.1: Boolean types - handle specially for checkbox rendering
        // Must check BEFORE general null handling to show indeterminate state
        if (upperType === 'BIT' || upperType === 'BOOLEAN') {
            // Treat null, undefined, and empty string as NULL for booleans
            if (value === null || value === undefined || value === '') {
                return {
                    display: '', // Checkbox will be rendered by createBooleanCheckbox
                    cssClass: 'ite-grid__cell--boolean',
                    isNull: true,
                    isBoolean: true,
                    boolValue: null // NULL boolean shows indeterminate state
                };
            }
            const boolValue = value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
            return {
                display: '', // Checkbox will be rendered by createBooleanCheckbox
                cssClass: 'ite-grid__cell--boolean',
                isNull: false,
                isBoolean: true,
                boolValue: boolValue
            };
        }

        // Story 7.5: Handle null/undefined for non-boolean types - show "NULL" placeholder
        if (value === null || value === undefined) {
            return { display: 'NULL', cssClass: 'ite-grid__cell--null', isNull: true };
        }

        // Story 7.5: Handle empty string - show blank cell (distinct from NULL)
        if (value === '') {
            return { display: '', cssClass: '', isNull: false, isEmpty: true };
        }

        // Number types - format with thousands separators for readability
        // Story 7.4: Enhanced numeric formatting
        if (['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'NUMERIC', 'DECIMAL', 'FLOAT', 'DOUBLE', 'REAL', 'MONEY'].some(t => upperType.includes(t))) {
            const formatted = formatNumericValue(value, dataType);
            return { display: formatted, cssClass: 'ite-grid__cell--number', isNull: false, rawValue: value };
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
    // Story 7.1: Boolean Checkbox Functions
    // ==========================================

    /**
     * Create a boolean checkbox element for a cell
     * Story 7.1: Render checkboxes for boolean (BIT) columns
     * @param {boolean|null} value - true, false, or null (indeterminate)
     * @returns {HTMLElement} Checkbox container element
     */
    function createBooleanCheckbox(value) {
        const container = document.createElement('div');
        container.className = 'ite-checkbox';
        container.setAttribute('role', 'checkbox');
        container.setAttribute('tabindex', '-1'); // Cell itself handles tab navigation

        if (value === null) {
            container.classList.add('ite-checkbox--null');
            container.setAttribute('aria-checked', 'mixed');
            container.textContent = '─'; // Dash for indeterminate/NULL
        } else if (value) {
            container.classList.add('ite-checkbox--checked');
            container.setAttribute('aria-checked', 'true');
            container.textContent = '☑'; // Checked checkbox
        } else {
            container.classList.add('ite-checkbox--unchecked');
            container.setAttribute('aria-checked', 'false');
            container.textContent = '☐'; // Unchecked checkbox
        }

        return container;
    }

    /**
     * Update checkbox visual state
     * Story 7.1: Helper to update checkbox appearance after toggle
     * @param {HTMLElement} checkbox - The checkbox element
     * @param {number|null} value - 1 (checked), 0 (unchecked), or null
     */
    function updateCheckboxVisual(checkbox, value) {
        checkbox.classList.remove('ite-checkbox--checked', 'ite-checkbox--unchecked', 'ite-checkbox--null');

        if (value === null) {
            checkbox.classList.add('ite-checkbox--null');
            checkbox.setAttribute('aria-checked', 'mixed');
            checkbox.textContent = '─';
        } else if (value === 1 || value === true) {
            checkbox.classList.add('ite-checkbox--checked');
            checkbox.setAttribute('aria-checked', 'true');
            checkbox.textContent = '☑';
        } else {
            checkbox.classList.add('ite-checkbox--unchecked');
            checkbox.setAttribute('aria-checked', 'false');
            checkbox.textContent = '☐';
        }
    }

    /**
     * Toggle boolean checkbox value and save to database
     * Story 7.1: Handle checkbox toggle with optimistic update
     * @param {number} rowIndex - Row index
     * @param {number} colIndex - Column index
     */
    function toggleBooleanCheckbox(rowIndex, colIndex) {
        const column = state.columns[colIndex];
        const row = getRowData(rowIndex);
        if (!row) return;

        const currentValue = row[column.name];

        // Determine new value: null -> true (1), true -> false (0), false -> true (1)
        let newValue;
        if (currentValue === null || currentValue === undefined) {
            newValue = 1; // NULL -> checked
        } else {
            const boolValue = currentValue === true || currentValue === 1 || currentValue === '1';
            newValue = boolValue ? 0 : 1; // Toggle
        }

        // Update local state immediately (optimistic update)
        row[column.name] = newValue;

        // Update cell display
        const cell = getCellElement(rowIndex, colIndex);
        if (cell) {
            cell.classList.add('ite-checkbox--saving');
            const checkbox = cell.querySelector('.ite-checkbox');
            if (checkbox) {
                updateCheckboxVisual(checkbox, newValue);
            }
            // Remove saving class after animation
            setTimeout(() => {
                cell.classList.remove('ite-checkbox--saving');
            }, 150);
        }

        // Find primary key column and value for the save
        const pkColumn = findPrimaryKeyColumn();
        const pkValue = row[pkColumn];

        // Track the pending save
        const saveKey = `${pkValue}:${column.name}`;
        state.pendingSaves.set(saveKey, {
            rowIndex,
            colIndex,
            columnName: column.name,
            oldValue: currentValue,
            newValue,
            primaryKeyValue: pkValue
        });

        // Send save command
        sendCommand('saveCell', {
            rowIndex: rowIndex,
            colIndex: colIndex,
            columnName: column.name,
            tableName: state.context.tableName,
            namespace: state.context.namespace,
            value: newValue,
            pkColumn: pkColumn,
            pkValue: pkValue
        });

        console.debug(`${LOG_PREFIX} Boolean toggle: ${column.name} from ${currentValue} to ${newValue}`);
    }

    /**
     * Set boolean cell to NULL
     * Story 7.1: Context menu action to set boolean to NULL
     * @param {number} rowIndex - Row index
     * @param {number} colIndex - Column index
     */
    function setBooleanToNull(rowIndex, colIndex) {
        const column = state.columns[colIndex];
        const row = getRowData(rowIndex);
        if (!row) return;

        // Check if column is nullable
        if (!column.nullable) {
            showToast('This column does not allow NULL values', 'warning');
            return;
        }

        const currentValue = row[column.name];

        // Don't send save if already NULL
        if (currentValue === null || currentValue === undefined) {
            return;
        }

        // Update local state immediately (optimistic update)
        row[column.name] = null;

        // Update cell display
        const cell = getCellElement(rowIndex, colIndex);
        if (cell) {
            cell.classList.add('ite-checkbox--saving');
            const checkbox = cell.querySelector('.ite-checkbox');
            if (checkbox) {
                updateCheckboxVisual(checkbox, null);
            }
            setTimeout(() => {
                cell.classList.remove('ite-checkbox--saving');
            }, 150);
        }

        // Find primary key column and value for the save
        const pkColumn = findPrimaryKeyColumn();
        const pkValue = row[pkColumn];

        // Track the pending save
        const saveKey = `${pkValue}:${column.name}`;
        state.pendingSaves.set(saveKey, {
            rowIndex,
            colIndex,
            columnName: column.name,
            oldValue: currentValue,
            newValue: null,
            primaryKeyValue: pkValue
        });

        // Send save command with null value
        sendCommand('saveCell', {
            rowIndex: rowIndex,
            colIndex: colIndex,
            columnName: column.name,
            tableName: state.context.tableName,
            namespace: state.context.namespace,
            value: null,
            pkColumn: pkColumn,
            pkValue: pkValue
        });

        console.debug(`${LOG_PREFIX} Boolean set to NULL: ${column.name}`);
    }

    /**
     * Set any cell to NULL value
     * Story 7.5: Generic set to NULL for all nullable columns
     * @param {number} rowIndex - Row index
     * @param {number} colIndex - Column index
     */
    function setCellToNull(rowIndex, colIndex) {
        const column = state.columns[colIndex];
        const row = getRowData(rowIndex);
        if (!row) return;

        // Check if column is nullable
        if (!column.nullable) {
            showToast('This column does not allow NULL values', 'warning');
            announce('This column does not allow NULL values');
            return;
        }

        const currentValue = row[column.name];

        // Don't send save if already NULL
        if (currentValue === null || currentValue === undefined) {
            announce('Value is already NULL');
            return;
        }

        // For boolean columns, use the specialized function
        if (isBooleanColumn(colIndex)) {
            setBooleanToNull(rowIndex, colIndex);
            return;
        }

        // Update local state immediately (optimistic update)
        row[column.name] = null;

        // Update cell display
        const cell = getCellElement(rowIndex, colIndex);
        if (cell) {
            cell.classList.add('ite-grid__cell--saving');
            const { display, cssClass } = formatCellValue(null, column.dataType);
            cell.textContent = display;
            cell.className = `ite-grid__cell ${cssClass} ite-grid__cell--selected`.trim();
            cell.title = 'NULL';
            setTimeout(() => {
                cell.classList.remove('ite-grid__cell--saving');
            }, 150);
        }

        // Find primary key column and value for the save
        const pkColumn = findPrimaryKeyColumn();
        const pkValue = row[pkColumn];

        // Track the pending save
        const saveKey = `${pkValue}:${column.name}`;
        state.pendingSaves.set(saveKey, {
            rowIndex,
            colIndex,
            columnName: column.name,
            oldValue: currentValue,
            newValue: null,
            primaryKeyValue: pkValue
        });

        // Send save command with null value
        sendCommand('saveCell', {
            rowIndex: rowIndex,
            colIndex: colIndex,
            columnName: column.name,
            tableName: state.context.tableName,
            namespace: state.context.namespace,
            value: null,
            pkColumn: pkColumn,
            pkValue: pkValue
        });

        announce(`${column.name} set to NULL`);
        console.debug(`${LOG_PREFIX} Cell set to NULL: ${column.name}`);
    }

    /**
     * Save a value to a cell directly (without entering edit mode)
     * Story 8.2: Used by Delete key to clear cell content immediately
     * @param {number} rowIndex - Row index
     * @param {number} colIndex - Column index
     * @param {unknown} newValue - Value to save
     */
    function saveCellValue(rowIndex, colIndex, newValue) {
        const column = state.columns[colIndex];
        const row = getRowData(rowIndex);
        if (!row) return;

        const currentValue = row[column.name];

        // Don't send save if value hasn't changed
        if (String(currentValue ?? '') === String(newValue ?? '')) {
            announce('No changes');
            return;
        }

        // Handle new rows - just update locally
        if (isNewRow(rowIndex)) {
            row[column.name] = newValue;
            const cell = getCellElement(rowIndex, colIndex);
            if (cell) {
                const { display, cssClass } = formatCellValue(newValue, column.dataType);
                cell.textContent = display;
                cell.className = `ite-grid__cell ${cssClass} ite-grid__cell--selected`.trim();
                cell.title = String(newValue ?? 'NULL');
            }
            announce(`${column.name} cleared`);
            return;
        }

        // Update local state immediately (optimistic update)
        row[column.name] = newValue;

        // Update cell display
        const cell = getCellElement(rowIndex, colIndex);
        if (cell) {
            cell.classList.add('ite-grid__cell--saving');
            const { display, cssClass } = formatCellValue(newValue, column.dataType);
            cell.textContent = display;
            cell.className = `ite-grid__cell ${cssClass} ite-grid__cell--selected`.trim();
            cell.title = String(newValue ?? 'NULL');
            setTimeout(() => {
                cell.classList.remove('ite-grid__cell--saving');
            }, 150);
        }

        // Find primary key column and value for the save
        const pkColumn = findPrimaryKeyColumn();
        const pkValue = state.rows[rowIndex][pkColumn];

        // Track the pending save
        const saveKey = `${pkValue}:${column.name}`;
        state.pendingSaves.set(saveKey, {
            rowIndex,
            colIndex,
            columnName: column.name,
            oldValue: currentValue,
            newValue: newValue,
            primaryKeyValue: pkValue
        });

        // Send save command
        sendCommand('saveCell', {
            rowIndex: rowIndex,
            colIndex: colIndex,
            columnName: column.name,
            tableName: state.context.tableName,
            namespace: state.context.namespace,
            value: newValue,
            pkColumn: pkColumn,
            pkValue: pkValue
        });

        announce(`${column.name} cleared`);
        console.debug(`${LOG_PREFIX} Cell value saved directly: ${column.name} = "${newValue}"`);
    }

    /**
     * Check if a column is boolean type
     * Story 7.1: Helper to identify boolean columns
     * @param {number} colIndex - Column index
     * @returns {boolean}
     */
    function isBooleanColumn(colIndex) {
        if (colIndex < 0 || colIndex >= state.columns.length) return false;
        const upperType = state.columns[colIndex].dataType.toUpperCase();
        return upperType === 'BIT' || upperType === 'BOOLEAN';
    }

    /**
     * Check if a column is a date type (DATE only, not TIME/TIMESTAMP)
     * Story 7.2: Helper to identify date columns for date picker
     * @param {number} colIndex - Column index
     * @returns {boolean}
     */
    function isDateColumn(colIndex) {
        if (colIndex < 0 || colIndex >= state.columns.length) return false;
        const upperType = state.columns[colIndex].dataType.toUpperCase();
        // DATE only - TIME, TIMESTAMP, DATETIME are handled by other stories
        return upperType === 'DATE';
    }

    /**
     * Check if column is a TIME type (not TIMESTAMP/DATETIME)
     * Story 7.3: Time field polish
     * @param {number} colIndex - Column index
     * @returns {boolean}
     */
    function isTimeColumn(colIndex) {
        if (colIndex < 0 || colIndex >= state.columns.length) return false;
        const upperType = state.columns[colIndex].dataType.toUpperCase();
        // TIME only - not TIMESTAMP or DATETIME
        return upperType === 'TIME' || (upperType.includes('TIME') && !upperType.includes('TIMESTAMP') && !upperType.includes('DATETIME'));
    }

    // ==========================================
    // Story 7.3: Time Field Functions
    // ==========================================

    /**
     * Parse user time input in various formats
     * Story 7.3: Support multiple time input formats
     * @param {string} input - User input string
     * @returns {{ hours: number; minutes: number; seconds: number }|null} Parsed time or null if invalid
     */
    function parseUserTimeInput(input) {
        if (!input || input.trim() === '') return null;

        const trimmed = input.trim();

        // Try HH:MM:SS (24-hour with seconds)
        const fullMatch = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
        if (fullMatch) {
            const hours = parseInt(fullMatch[1]);
            const minutes = parseInt(fullMatch[2]);
            const seconds = parseInt(fullMatch[3]);
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
                return { hours, minutes, seconds };
            }
        }

        // Try HH:MM (24-hour, no seconds)
        const shortMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
        if (shortMatch) {
            const hours = parseInt(shortMatch[1]);
            const minutes = parseInt(shortMatch[2]);
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                return { hours, minutes, seconds: 0 };
            }
        }

        // Try 12-hour format with AM/PM (optional seconds)
        const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm|a|p)\.?$/i);
        if (ampmMatch) {
            let hours = parseInt(ampmMatch[1]);
            const minutes = parseInt(ampmMatch[2]);
            const seconds = ampmMatch[3] ? parseInt(ampmMatch[3]) : 0;
            const meridian = ampmMatch[4].toUpperCase();
            const isPM = meridian === 'PM' || meridian === 'P';

            // Validate 12-hour range
            if (hours < 1 || hours > 12) return null;

            // Convert to 24-hour
            if (isPM && hours !== 12) hours += 12;
            if (!isPM && hours === 12) hours = 0;

            if (minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
                return { hours, minutes, seconds };
            }
        }

        return null; // Invalid format
    }

    /**
     * Format time object for IRIS storage (HH:MM:SS)
     * Story 7.3: Ensure consistent time format for database
     * @param {{ hours: number; minutes: number; seconds: number }} time - Time object
     * @returns {string} HH:MM:SS formatted string
     */
    function formatTimeForIRIS(time) {
        const { hours, minutes, seconds } = time;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * Check if column is a TIMESTAMP/DATETIME type
     * Story 7.6: Timestamp field polish
     * @param {number} colIndex - Column index
     * @returns {boolean}
     */
    function isTimestampColumn(colIndex) {
        if (colIndex < 0 || colIndex >= state.columns.length) return false;
        const upperType = state.columns[colIndex].dataType.toUpperCase();
        return upperType.includes('TIMESTAMP') || upperType.includes('DATETIME');
    }

    /**
     * Parse user timestamp input in various formats
     * Story 7.6: Support multiple timestamp input formats
     * @param {string} input - User input string
     * @returns {{ date: Date; time: { hours: number; minutes: number; seconds: number } }|null} Parsed timestamp or null if invalid
     */
    function parseUserTimestampInput(input) {
        if (!input || input.trim() === '') return null;

        const trimmed = input.trim();

        // Try ISO format with T separator: YYYY-MM-DDTHH:MM:SS
        const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?)$/);
        if (isoMatch) {
            const date = parseUserDateInput(isoMatch[1]);
            const time = parseUserTimeInput(isoMatch[2]);
            if (date && time) {
                return { date, time };
            }
        }

        // Try space-separated: YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM
        const spaceSplit = trimmed.split(/\s+/);
        if (spaceSplit.length >= 2) {
            // Check if last part looks like time (contains colon)
            const lastPart = spaceSplit[spaceSplit.length - 1];
            const secondLastPart = spaceSplit.length >= 3 ? spaceSplit[spaceSplit.length - 2] : null;

            // Handle "Feb 1, 2026 2:30 PM" style
            if (lastPart.match(/^(AM|PM|am|pm|a|p)\.?$/i) && secondLastPart && secondLastPart.includes(':')) {
                // Natural language with AM/PM
                const timePart = secondLastPart + ' ' + lastPart;
                const datePart = spaceSplit.slice(0, -2).join(' ');
                const date = parseUserDateInput(datePart);
                const time = parseUserTimeInput(timePart);
                if (date && time) {
                    return { date, time };
                }
            } else if (lastPart.includes(':')) {
                // Last part is time
                const timePart = lastPart;
                const datePart = spaceSplit.slice(0, -1).join(' ');
                const date = parseUserDateInput(datePart);
                const time = parseUserTimeInput(timePart);
                if (date && time) {
                    return { date, time };
                }
            }
        }

        // Try date-only input - default time to 00:00:00
        const dateOnly = parseUserDateInput(trimmed);
        if (dateOnly) {
            return { date: dateOnly, time: { hours: 0, minutes: 0, seconds: 0 } };
        }

        return null; // Invalid format
    }

    /**
     * Format timestamp for IRIS storage (YYYY-MM-DD HH:MM:SS)
     * Story 7.6: Ensure consistent timestamp format for database
     * @param {Date} date - Date object
     * @param {{ hours: number; minutes: number; seconds: number }} time - Time object
     * @returns {string} YYYY-MM-DD HH:MM:SS formatted string
     */
    function formatTimestampForIRIS(date, time) {
        const datePart = formatDateForIRIS(date);
        const timePart = formatTimeForIRIS(time);
        return `${datePart} ${timePart}`;
    }

    // ==========================================
    // Story 7.4: Numeric Field Functions
    // ==========================================

    /**
     * Check if column is a numeric type
     * Story 7.4: Numeric field polish
     * @param {number} colIndex - Column index
     * @returns {boolean}
     */
    function isNumericColumn(colIndex) {
        if (colIndex < 0 || colIndex >= state.columns.length) return false;
        const upperType = state.columns[colIndex].dataType.toUpperCase();
        return ['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'NUMERIC', 'DECIMAL', 'FLOAT', 'DOUBLE', 'REAL', 'MONEY'].some(t => upperType.includes(t));
    }

    /**
     * Check if column is an integer type (no decimals allowed)
     * Story 7.4: Numeric field polish
     * @param {number} colIndex - Column index
     * @returns {boolean}
     */
    function isIntegerColumn(colIndex) {
        if (colIndex < 0 || colIndex >= state.columns.length) return false;
        const upperType = state.columns[colIndex].dataType.toUpperCase();
        return ['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT'].some(t => upperType.includes(t));
    }

    /**
     * Format a numeric value for display with thousands separators
     * Story 7.4: Locale-aware number formatting
     * @param {unknown} value - Numeric value
     * @param {string} dataType - Column data type
     * @returns {string} Formatted number string
     */
    function formatNumericValue(value, dataType) {
        const num = Number(value);
        if (isNaN(num)) return String(value);

        const upperType = dataType.toUpperCase();

        // Integer types - no decimal places
        if (['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT'].some(t => upperType.includes(t))) {
            return Math.round(num).toLocaleString();
        }

        // Decimal/float types - preserve decimal places but use locale formatting
        // Limit to reasonable precision to avoid floating point artifacts
        return num.toLocaleString(undefined, { maximumFractionDigits: 10 });
    }

    /**
     * Parse and validate numeric input
     * Story 7.4: Numeric validation
     * @param {string} input - User input string
     * @param {boolean} isInteger - Whether integer type
     * @returns {{ valid: boolean; value?: number; error?: string; rounded?: boolean }|null}
     */
    function parseNumericInput(input, isInteger) {
        if (!input || input.trim() === '') return null;

        // Remove any existing thousands separators (in case user pastes formatted number)
        const cleaned = input.trim().replace(/,/g, '');

        const num = Number(cleaned);
        if (isNaN(num)) {
            return { valid: false, error: 'Invalid number' };
        }

        if (isInteger && !Number.isInteger(num)) {
            // Round to nearest integer
            return { valid: true, value: Math.round(num), rounded: true };
        }

        return { valid: true, value: num };
    }

    // ==========================================
    // Story 7.2: Date Picker Functions
    // ==========================================

    /** @type {HTMLElement|null} Current active date picker */
    let activeDatePicker = null;
    /** @type {function|null} Current date picker close handler for cleanup */
    let activeDatePickerCloseHandler = null;

    /**
     * Parse user date input in various formats
     * Story 7.2: Support multiple date input formats
     * @param {string} input - User input string
     * @returns {Date|null} Parsed date or null if invalid
     */
    function parseUserDateInput(input) {
        if (!input || input.trim() === '') return null;

        const trimmed = input.trim();

        // Try ISO format first: YYYY-MM-DD
        const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (isoMatch) {
            const date = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
            if (!isNaN(date.getTime())) return date;
        }

        // Try DD-MM-YYYY (with dash separator - EU convention)
        // Must come before slash-based formats since dash is unambiguous EU indicator
        const euDashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (euDashMatch) {
            const day = parseInt(euDashMatch[1]);
            const month = parseInt(euDashMatch[2]);
            const year = parseInt(euDashMatch[3]);
            // Validate day/month ranges
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                const date = new Date(year, month - 1, day);
                if (!isNaN(date.getTime())) return date;
            }
        }

        // Try MM/DD/YYYY (with slash separator - US convention)
        // Note: For ambiguous dates like 01/02/2026 where both numbers ≤12,
        // US format (MM/DD) is assumed. Use YYYY-MM-DD or DD-MM-YYYY for clarity.
        const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (usMatch) {
            const month = parseInt(usMatch[1]);
            const day = parseInt(usMatch[2]);
            const year = parseInt(usMatch[3]);
            // Validate as MM/DD/YYYY
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                const date = new Date(year, month - 1, day);
                if (!isNaN(date.getTime())) return date;
            }
            // If first number > 12, try as DD/MM/YYYY (must be day-first)
            if (month > 12 && day >= 1 && day <= 12) {
                const date = new Date(year, day - 1, month);
                if (!isNaN(date.getTime())) return date;
            }
        }

        // Try natural language via Date.parse
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) return parsed;

        return null;
    }

    /**
     * Format a Date object for IRIS storage (YYYY-MM-DD)
     * Story 7.2: Ensure consistent date format for database
     * @param {Date} date - Date object
     * @returns {string} YYYY-MM-DD formatted string
     */
    function formatDateForIRIS(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Create date picker popup
     * Story 7.2: Calendar picker component
     * @param {Date|null} selectedDate - Currently selected date
     * @param {function(Date):void} onSelect - Callback when date is selected
     * @param {function():void} onClose - Callback when picker should close
     * @returns {HTMLElement} Date picker element
     */
    function createDatePicker(selectedDate, onSelect, onClose) {
        const picker = document.createElement('div');
        picker.className = 'ite-date-picker';
        picker.setAttribute('role', 'dialog');
        picker.setAttribute('aria-label', 'Choose date');
        picker.setAttribute('tabindex', '-1');

        // State for the picker
        let viewDate = selectedDate ? new Date(selectedDate) : new Date();
        let focusedDate = selectedDate ? new Date(selectedDate) : new Date();

        function render() {
            picker.innerHTML = '';

            // Header with month/year and navigation
            const header = document.createElement('div');
            header.className = 'ite-date-picker__header';

            const prevBtn = document.createElement('button');
            prevBtn.className = 'ite-date-picker__nav-btn';
            prevBtn.innerHTML = '◀';
            prevBtn.type = 'button';
            prevBtn.setAttribute('aria-label', 'Previous month');
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                viewDate.setMonth(viewDate.getMonth() - 1);
                render();
            });

            const monthYear = document.createElement('span');
            monthYear.className = 'ite-date-picker__month-year';
            monthYear.textContent = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

            const nextBtn = document.createElement('button');
            nextBtn.className = 'ite-date-picker__nav-btn';
            nextBtn.innerHTML = '▶';
            nextBtn.type = 'button';
            nextBtn.setAttribute('aria-label', 'Next month');
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                viewDate.setMonth(viewDate.getMonth() + 1);
                render();
            });

            header.appendChild(prevBtn);
            header.appendChild(monthYear);
            header.appendChild(nextBtn);
            picker.appendChild(header);

            // Day of week headers
            const weekHeader = document.createElement('div');
            weekHeader.className = 'ite-date-picker__week-header';
            const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
            dayNames.forEach(name => {
                const dayHeader = document.createElement('span');
                dayHeader.className = 'ite-date-picker__day-name';
                dayHeader.textContent = name;
                weekHeader.appendChild(dayHeader);
            });
            picker.appendChild(weekHeader);

            // Days grid
            const grid = document.createElement('div');
            grid.className = 'ite-date-picker__grid';
            grid.setAttribute('role', 'grid');
            grid.setAttribute('aria-colcount', '7');

            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();

            // First day of month
            const firstDay = new Date(year, month, 1);
            const startDayOfWeek = firstDay.getDay();

            // Last day of month
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();

            // Calculate row count: header + ceil((startDayOfWeek + daysInMonth) / 7)
            const totalCells = startDayOfWeek + daysInMonth;
            const rowCount = Math.ceil(totalCells / 7);
            grid.setAttribute('aria-rowcount', String(rowCount));

            // Today for comparison
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Add empty cells for days before first of month
            for (let i = 0; i < startDayOfWeek; i++) {
                const empty = document.createElement('span');
                empty.className = 'ite-date-picker__day ite-date-picker__day--empty';
                grid.appendChild(empty);
            }

            // Add day cells
            for (let day = 1; day <= daysInMonth; day++) {
                const dayDate = new Date(year, month, day);
                const dayEl = document.createElement('button');
                dayEl.type = 'button';
                dayEl.className = 'ite-date-picker__day';
                dayEl.textContent = String(day);
                dayEl.setAttribute('data-date', formatDateForIRIS(dayDate));

                // Check if this is today
                if (dayDate.getTime() === today.getTime()) {
                    dayEl.classList.add('ite-date-picker__day--today');
                }

                // Check if this is the selected date
                if (selectedDate && dayDate.toDateString() === selectedDate.toDateString()) {
                    dayEl.classList.add('ite-date-picker__day--selected');
                }

                // Check if this is the focused date
                if (dayDate.toDateString() === focusedDate.toDateString()) {
                    dayEl.classList.add('ite-date-picker__day--focused');
                    dayEl.setAttribute('tabindex', '0');
                } else {
                    dayEl.setAttribute('tabindex', '-1');
                }

                dayEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onSelect(dayDate);
                });

                grid.appendChild(dayEl);
            }

            picker.appendChild(grid);

            // Today button
            const todayBtn = document.createElement('button');
            todayBtn.type = 'button';
            todayBtn.className = 'ite-date-picker__today-btn';
            todayBtn.textContent = 'Today';
            todayBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onSelect(new Date());
            });
            picker.appendChild(todayBtn);

            // Focus the focused day
            const focusedEl = grid.querySelector('.ite-date-picker__day--focused');
            if (focusedEl) {
                setTimeout(() => focusedEl.focus(), 0);
            }
        }

        // Keyboard navigation
        picker.addEventListener('keydown', (e) => {
            let handled = false;

            switch (e.key) {
                case 'ArrowLeft':
                    focusedDate.setDate(focusedDate.getDate() - 1);
                    if (focusedDate.getMonth() !== viewDate.getMonth()) {
                        viewDate.setMonth(viewDate.getMonth() - 1);
                    }
                    handled = true;
                    break;
                case 'ArrowRight':
                    focusedDate.setDate(focusedDate.getDate() + 1);
                    if (focusedDate.getMonth() !== viewDate.getMonth()) {
                        viewDate.setMonth(viewDate.getMonth() + 1);
                    }
                    handled = true;
                    break;
                case 'ArrowUp':
                    focusedDate.setDate(focusedDate.getDate() - 7);
                    if (focusedDate.getMonth() !== viewDate.getMonth()) {
                        viewDate.setMonth(viewDate.getMonth() - 1);
                    }
                    handled = true;
                    break;
                case 'ArrowDown':
                    focusedDate.setDate(focusedDate.getDate() + 7);
                    if (focusedDate.getMonth() !== viewDate.getMonth()) {
                        viewDate.setMonth(viewDate.getMonth() + 1);
                    }
                    handled = true;
                    break;
                case 'PageUp':
                    viewDate.setMonth(viewDate.getMonth() - 1);
                    focusedDate.setMonth(focusedDate.getMonth() - 1);
                    handled = true;
                    break;
                case 'PageDown':
                    viewDate.setMonth(viewDate.getMonth() + 1);
                    focusedDate.setMonth(focusedDate.getMonth() + 1);
                    handled = true;
                    break;
                case 'Home':
                    focusedDate.setDate(1);
                    handled = true;
                    break;
                case 'End':
                    focusedDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
                    handled = true;
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    onSelect(new Date(focusedDate));
                    handled = true;
                    return;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    return;
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
                render();
            }
        });

        render();
        return picker;
    }

    /**
     * Close any active date picker
     * Story 7.2: Cleanup function - removes picker and event listener
     */
    function closeDatePicker() {
        // Remove the close handler event listener to prevent memory leak
        if (activeDatePickerCloseHandler) {
            document.removeEventListener('mousedown', activeDatePickerCloseHandler);
            activeDatePickerCloseHandler = null;
        }
        if (activeDatePicker) {
            activeDatePicker.remove();
            activeDatePicker = null;
        }
    }

    /**
     * Open date picker for a cell
     * Story 7.2: Show date picker positioned near input
     * @param {HTMLElement} input - The input element
     * @param {Date|null} currentDate - Current date value
     * @param {function(Date):void} onSelect - Selection callback
     */
    function openDatePicker(input, currentDate, onSelect) {
        closeDatePicker();

        const picker = createDatePicker(
            currentDate,
            (date) => {
                onSelect(date);
                closeDatePicker();
            },
            () => {
                closeDatePicker();
                input.focus();
            }
        );

        // Position the picker below the input
        const inputRect = input.getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.left = `${inputRect.left}px`;
        picker.style.top = `${inputRect.bottom + 4}px`;

        // Check if picker would go off screen bottom
        document.body.appendChild(picker);
        const pickerRect = picker.getBoundingClientRect();
        if (pickerRect.bottom > window.innerHeight) {
            // Position above input instead
            picker.style.top = `${inputRect.top - pickerRect.height - 4}px`;
        }

        activeDatePicker = picker;

        // Close on click outside - store handler for cleanup in closeDatePicker()
        activeDatePickerCloseHandler = (e) => {
            if (!picker.contains(e.target) && e.target !== input && !input.contains(e.target)) {
                closeDatePicker();
            }
        };
        setTimeout(() => {
            document.addEventListener('mousedown', activeDatePickerCloseHandler);
        }, 0);
    }

    /**
     * Show context menu for cell (Set to NULL option)
     * Story 7.1: Right-click context menu for boolean cells
     * Story 7.5: Extended to work for all nullable cells
     * @param {MouseEvent} event - Right-click event
     * @param {number} rowIndex - Row index
     * @param {number} colIndex - Column index
     */
    function showCellContextMenu(event, rowIndex, colIndex) {
        event.preventDefault();

        const column = state.columns[colIndex];
        if (!column.nullable) {
            // Don't show NULL option for non-nullable columns
            return;
        }

        // Remove any existing context menu
        const existingMenu = document.querySelector('.ite-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create context menu
        const menu = document.createElement('div');
        menu.className = 'ite-context-menu';

        const menuItem = document.createElement('div');
        menuItem.className = 'ite-context-menu__item';
        menuItem.textContent = 'Set to NULL';
        menuItem.setAttribute('role', 'menuitem');
        menuItem.setAttribute('tabindex', '0');

        menu.appendChild(menuItem);
        menu.setAttribute('role', 'menu');

        // Position at mouse pointer
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;

        // Cleanup function to remove all event listeners
        const cleanupMenu = () => {
            menu.remove();
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('keydown', handleEscape);
        };

        // Handle menu item click - use generic setCellToNull for all cells
        const handleMenuClick = () => {
            setCellToNull(rowIndex, colIndex);
            cleanupMenu();
        };

        // Close on click outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                cleanupMenu();
            }
        };

        // Close on Escape
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                cleanupMenu();
            }
        };

        menuItem.addEventListener('click', handleMenuClick);
        menuItem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMenuClick();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanupMenu();
            }
        });

        // Use setTimeout to avoid immediate trigger from the contextmenu event
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);

        document.addEventListener('keydown', handleEscape);

        document.body.appendChild(menu);

        // Focus the menu item for keyboard accessibility
        menuItem.focus();
    }

    /**
     * Handle right-click on cells (context menu)
     * Story 7.1: Show context menu for boolean cells
     * @param {MouseEvent} event
     */
    function handleCellContextMenu(event) {
        const target = /** @type {HTMLElement} */ (event.target);

        const cell = target.closest('.ite-grid__cell');
        if (!cell) return;

        // Don't show context menu for header cells
        if (cell.closest('.ite-grid__header-row')) return;

        // Don't show context menu for selector cells
        if (cell.classList.contains('ite-grid__cell--selector')) return;

        // Find row and column index
        const row = cell.closest('.ite-grid__row');
        if (!row) return;

        const grid = document.getElementById('dataGrid');
        if (!grid) return;

        const rows = Array.from(grid.querySelectorAll('.ite-grid__row'));
        const rowIndex = rows.indexOf(row);
        if (rowIndex < 0) return;

        const cells = Array.from(row.querySelectorAll('.ite-grid__cell:not(.ite-grid__cell--selector)'));
        const colIndex = cells.indexOf(cell);
        if (colIndex < 0) return;

        // Story 7.5: Show context menu for all nullable columns (not just booleans)
        const column = state.columns[colIndex];
        if (column && column.nullable) {
            showCellContextMenu(event, rowIndex, colIndex);
        }
    }

    // ==========================================
    // Story 3.2: Cell Editing Functions
    // ==========================================

    /**
     * Get the raw value of a cell from state
     * Story 3.2: Helper for edit mode
     * Story 4.1: Updated to handle new rows
     * @param {number} rowIndex
     * @param {number} colIndex
     * @returns {unknown}
     */
    function getCellValue(rowIndex, colIndex) {
        if (rowIndex < 0 || rowIndex >= state.totalDisplayRows) return null;
        if (colIndex < 0 || colIndex >= state.columns.length) return null;
        const colName = state.columns[colIndex].name;
        const rowData = getRowData(rowIndex);
        return rowData ? rowData[colName] : null;
    }

    /**
     * Enter edit mode for a cell
     * Story 3.2: Core edit function
     * Story 4.1: Updated to handle new rows
     * @param {number} rowIndex - Row index (0-based)
     * @param {number} colIndex - Column index (0-based)
     * @param {string | null} [initialValue] - Initial value for input (null = use current cell value)
     * @param {'end' | 'select' | 'start'} [cursorPosition='select'] - Where to position cursor
     */
    function enterEditMode(rowIndex, colIndex, initialValue = null, cursorPosition = 'select') {
        // Validate bounds (including new rows)
        if (rowIndex < 0 || rowIndex >= state.totalDisplayRows) return;
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
        // Story 7.4: For numeric columns, show raw value without formatting (no thousands separators)
        let displayValue;
        if (initialValue !== null) {
            displayValue = initialValue;
        } else if (currentValue === null || currentValue === undefined) {
            displayValue = '';
        } else if (isNumericColumn(colIndex)) {
            // Strip any formatting - show raw number
            displayValue = String(currentValue).replace(/,/g, '');
        } else {
            displayValue = String(currentValue);
        }

        // Story 7.2: Check if this is a date column for special handling
        const isDate = isDateColumn(colIndex);

        // Replace cell content
        cell.textContent = '';
        cell.classList.add('ite-grid__cell--editing');
        // Story 3.5: Clear any error state when user starts editing
        cell.classList.remove('ite-grid__cell--error');

        let input;

        if (isDate) {
            // Story 7.2: Date columns get special editor with calendar icon
            const container = document.createElement('div');
            container.className = 'ite-date-editor';

            input = document.createElement('input');
            input.type = 'text';
            input.className = 'ite-date-editor__input';
            input.value = displayValue;
            input.placeholder = 'YYYY-MM-DD';
            input.setAttribute('aria-label', `Edit ${state.columns[colIndex].name}`);

            const calendarBtn = document.createElement('button');
            calendarBtn.type = 'button';
            calendarBtn.className = 'ite-date-editor__calendar-btn';
            calendarBtn.innerHTML = '&#128197;'; // Calendar emoji
            calendarBtn.setAttribute('aria-label', 'Open date picker');
            calendarBtn.setAttribute('tabindex', '-1');

            // Parse current date for the picker
            const currentDate = currentValue ? parseUserDateInput(String(currentValue)) : null;

            calendarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                openDatePicker(input, currentDate || new Date(), (selectedDate) => {
                    input.value = formatDateForIRIS(selectedDate);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.focus();
                });
            });

            container.appendChild(input);
            container.appendChild(calendarBtn);
            cell.appendChild(container);
        } else {
            // Standard text input for non-date columns
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'ite-grid__cell-input';
            input.value = displayValue;
            input.setAttribute('aria-label', `Edit ${state.columns[colIndex].name}`);
            cell.appendChild(input);
        }

        // Setup input event handlers
        input.addEventListener('keydown', handleEditInputKeydown);
        input.addEventListener('blur', handleEditInputBlur);
        // Story 3.4: Track modified state while typing
        input.addEventListener('input', handleEditInputChange);

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
     * Story 3.3: Added server save via saveCell command
     * @param {boolean} saveValue - Whether to save the new value (true) or restore original (false)
     * @returns {{ saved: boolean; oldValue: unknown; newValue: unknown; rowIndex: number; colIndex: number } | null}
     */
    function exitEditMode(saveValue) {
        if (!state.isEditing) return null;

        // Story 7.2: Close any active date picker
        closeDatePicker();

        const { rowIndex, colIndex } = state.editingCell;
        const cell = getCellElement(rowIndex, colIndex);
        // Story 7.2: Handle both regular input and date editor input
        let input = cell?.querySelector('.ite-grid__cell-input');
        if (!input) {
            input = cell?.querySelector('.ite-date-editor__input');
        }

        let result = null;

        if (cell && input) {
            const newValue = /** @type {HTMLInputElement} */ (input).value;
            const oldValue = state.editOriginalValue;
            const colName = state.columns[colIndex].name;

            // Remove input event handlers
            input.removeEventListener('keydown', handleEditInputKeydown);
            input.removeEventListener('blur', handleEditInputBlur);
            input.removeEventListener('input', handleEditInputChange);

            // Restore cell content and remove edit/modified states
            cell.classList.remove('ite-grid__cell--editing');
            cell.classList.remove('ite-grid__cell--modified');

            if (saveValue) {
                // Update local state with new value (optimistic update)
                // Convert empty string to null for proper NULL handling
                let valueToStore = newValue === '' ? null : newValue;

                // Story 7.2: For date columns, validate and normalize the input to IRIS format
                if (isDateColumn(colIndex) && valueToStore !== null) {
                    const parsedDate = parseUserDateInput(valueToStore);
                    if (parsedDate) {
                        // Normalize to IRIS format (YYYY-MM-DD)
                        valueToStore = formatDateForIRIS(parsedDate);
                    } else {
                        // Invalid date format - show error and cancel save
                        console.warn(`${LOG_PREFIX} Invalid date format: "${valueToStore}"`);
                        announce(`Invalid date format. Use YYYY-MM-DD, MM/DD/YYYY, or natural language like "Feb 1, 2026".`);
                        // Restore original value and keep cell selected
                        const { display, cssClass } = formatCellValue(oldValue, state.columns[colIndex].dataType);
                        cell.textContent = display;
                        cell.className = `ite-grid__cell ${cssClass} ite-grid__cell--selected`.trim();
                        cell.title = String(oldValue ?? 'NULL');
                        cell.classList.add('ite-grid__cell--error');
                        state.isEditing = false;
                        state.editingCell = { rowIndex: -1, colIndex: -1 };
                        return { saved: false, oldValue, newValue: valueToStore, rowIndex, colIndex };
                    }
                }

                // Story 7.3: For time columns, validate and normalize the input to IRIS format
                if (isTimeColumn(colIndex) && valueToStore !== null) {
                    const parsedTime = parseUserTimeInput(valueToStore);
                    if (parsedTime) {
                        // Normalize to IRIS format (HH:MM:SS)
                        valueToStore = formatTimeForIRIS(parsedTime);
                    } else {
                        // Invalid time format - show error and cancel save
                        console.warn(`${LOG_PREFIX} Invalid time format: "${valueToStore}"`);
                        announce(`Invalid time format. Use HH:MM, HH:MM:SS, or 12-hour like "2:30 PM".`);
                        // Restore original value and keep cell selected
                        const { display, cssClass } = formatCellValue(oldValue, state.columns[colIndex].dataType);
                        cell.textContent = display;
                        cell.className = `ite-grid__cell ${cssClass} ite-grid__cell--selected`.trim();
                        cell.title = String(oldValue ?? 'NULL');
                        cell.classList.add('ite-grid__cell--error');
                        state.isEditing = false;
                        state.editingCell = { rowIndex: -1, colIndex: -1 };
                        return { saved: false, oldValue, newValue: valueToStore, rowIndex, colIndex };
                    }
                }

                // Story 7.4: For numeric columns, validate and normalize the input
                if (isNumericColumn(colIndex) && valueToStore !== null) {
                    const isInteger = isIntegerColumn(colIndex);
                    const parsed = parseNumericInput(valueToStore, isInteger);
                    if (parsed === null) {
                        // Empty input is handled by null check above
                        valueToStore = null;
                    } else if (parsed.valid) {
                        valueToStore = parsed.value;
                        if (parsed.rounded) {
                            announce(`Value rounded to integer: ${parsed.value}`);
                        }
                    } else {
                        // Invalid number format - show error and cancel save
                        console.warn(`${LOG_PREFIX} Invalid number format: "${valueToStore}"`);
                        announce(`Invalid number format. Please enter a valid number.`);
                        // Restore original value and keep cell selected
                        const { display, cssClass } = formatCellValue(oldValue, state.columns[colIndex].dataType);
                        cell.textContent = display;
                        cell.className = `ite-grid__cell ${cssClass} ite-grid__cell--selected`.trim();
                        cell.title = String(oldValue ?? 'NULL');
                        cell.classList.add('ite-grid__cell--error');
                        state.isEditing = false;
                        state.editingCell = { rowIndex: -1, colIndex: -1 };
                        return { saved: false, oldValue, newValue: valueToStore, rowIndex, colIndex };
                    }
                }

                // Story 7.6: For timestamp columns, validate and normalize the input to IRIS format
                if (isTimestampColumn(colIndex) && valueToStore !== null) {
                    const parsedTimestamp = parseUserTimestampInput(valueToStore);
                    if (parsedTimestamp) {
                        // Normalize to IRIS format (YYYY-MM-DD HH:MM:SS)
                        valueToStore = formatTimestampForIRIS(parsedTimestamp.date, parsedTimestamp.time);
                    } else {
                        // Invalid timestamp format - show error and cancel save
                        console.warn(`${LOG_PREFIX} Invalid timestamp format: "${valueToStore}"`);
                        announce(`Invalid timestamp format. Use "YYYY-MM-DD HH:MM:SS" or "Feb 1, 2026 2:30 PM".`);
                        // Restore original value and keep cell selected
                        const { display, cssClass } = formatCellValue(oldValue, state.columns[colIndex].dataType);
                        cell.textContent = display;
                        cell.className = `ite-grid__cell ${cssClass} ite-grid__cell--selected`.trim();
                        cell.title = String(oldValue ?? 'NULL');
                        cell.classList.add('ite-grid__cell--error');
                        state.isEditing = false;
                        state.editingCell = { rowIndex: -1, colIndex: -1 };
                        return { saved: false, oldValue, newValue: valueToStore, rowIndex, colIndex };
                    }
                }

                // Story 4.1: Handle new rows vs existing rows
                const rowData = getRowData(rowIndex);
                if (rowData) {
                    rowData[colName] = valueToStore;
                }

                // Update display
                const { display, cssClass } = formatCellValue(valueToStore, state.columns[colIndex].dataType);
                cell.textContent = display;
                cell.className = `ite-grid__cell ${cssClass} ite-grid__cell--selected`.trim();
                cell.title = String(valueToStore ?? 'NULL');

                result = { saved: true, oldValue, newValue: valueToStore, rowIndex, colIndex };
                console.debug(`${LOG_PREFIX} Exited edit mode with save: "${oldValue}" -> "${valueToStore}"`);

                // Story 4.1: For new rows, don't send save command yet (handled in Story 4.3)
                // Only send save command for existing (server) rows
                if (!isNewRow(rowIndex)) {
                    // Story 3.3: Send save command to extension if value changed
                    // Check for actual change (handle null comparisons)
                    const hasChanged = String(oldValue ?? '') !== String(valueToStore ?? '');
                    if (hasChanged) {
                        // Find primary key column and value
                        // Look for ID column first, then fall back to first column
                        const pkColumn = findPrimaryKeyColumn();
                        if (pkColumn) {
                            const pkValue = state.rows[rowIndex][pkColumn];
                            // Validate primary key value exists
                            if (pkValue === null || pkValue === undefined) {
                                console.warn(`${LOG_PREFIX} Cannot save: Row has no primary key value`);
                                announce(`Cannot save: Row has no ID value`);
                                rollbackCellValue(rowIndex, colIndex, oldValue);
                            } else {
                                // Track pending save using primary key value as identifier
                                const saveKey = `${pkValue}:${colName}`;
                                state.pendingSaves.set(saveKey, { rowIndex, colIndex, oldValue, pkValue });

                                sendCommand('saveCell', {
                                    rowIndex,
                                    colIndex,
                                    columnName: colName,
                                    oldValue,
                                    newValue: valueToStore,
                                    primaryKeyColumn: pkColumn,
                                    primaryKeyValue: pkValue
                                });
                                // Mark cell as saving (pending server response)
                                cell.classList.add('ite-grid__cell--saving');
                                announce(`Saving ${colName}...`);
                            }
                        } else {
                            // No primary key - can't save
                            console.warn(`${LOG_PREFIX} Cannot save: No primary key column found`);
                            announce(`Cannot save: Table has no ID column`);
                            // Rollback immediately
                            rollbackCellValue(rowIndex, colIndex, oldValue);
                        }
                    } else {
                        // No change - just announce
                        announce(`No changes to ${colName}`);
                    }
                } else {
                    // New row - just acknowledge the edit locally
                    const hasChanged = String(oldValue ?? '') !== String(valueToStore ?? '');
                    if (hasChanged) {
                        announce(`Edited ${colName} (unsaved new row)`);
                    }
                }
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
     * Find the primary key column name
     * Story 3.3: Used for UPDATE WHERE clause
     * @returns {string | null}
     */
    function findPrimaryKeyColumn() {
        // Look for common primary key column names
        const pkNames = ['ID', 'Id', 'id', '%ID'];
        for (const name of pkNames) {
            if (state.columns.some(col => col.name === name)) {
                return name;
            }
        }
        // No primary key found
        return null;
    }

    /**
     * Rollback cell value after failed save
     * Story 3.3: Error handling
     * Story 4.2: Updated to handle new rows
     * @param {number} rowIndex
     * @param {number} colIndex
     * @param {unknown} originalValue
     */
    function rollbackCellValue(rowIndex, colIndex, originalValue) {
        const colName = state.columns[colIndex].name;

        // Story 4.2: Restore state (handles both server rows and new rows)
        const rowData = getRowData(rowIndex);
        if (rowData) {
            rowData[colName] = originalValue;
        }

        // Update display
        const cell = getCellElement(rowIndex, colIndex);
        if (cell) {
            const formatted = formatCellValue(originalValue, state.columns[colIndex].dataType);
            cell.classList.remove('ite-grid__cell--saving');
            cell.classList.remove('ite-grid__cell--save-success');
            cell.classList.remove('ite-checkbox--saving');

            // Story 7.1: Handle boolean cell rollback specially
            if (formatted.isBoolean) {
                // Clear existing content and create new checkbox
                cell.textContent = '';
                const checkboxEl = createBooleanCheckbox(formatted.boolValue);
                cell.appendChild(checkboxEl);
                cell.title = formatted.boolValue === null ? 'NULL' : (formatted.boolValue ? 'True' : 'False');
            } else {
                cell.textContent = formatted.display;
                cell.title = String(originalValue ?? 'NULL');
            }

            // Keep selected state if this cell is selected
            if (state.selectedCell.rowIndex === rowIndex && state.selectedCell.colIndex === colIndex) {
                cell.className = `ite-grid__cell ${formatted.cssClass} ite-grid__cell--selected`.trim();
            } else {
                cell.className = `ite-grid__cell ${formatted.cssClass}`.trim();
            }
        }

        saveState();
    }

    /**
     * Show save success feedback on a cell
     * Story 3.3: Visual feedback
     * @param {number} rowIndex
     * @param {number} colIndex
     */
    function showSaveSuccess(rowIndex, colIndex) {
        const cell = getCellElement(rowIndex, colIndex);
        if (cell) {
            cell.classList.remove('ite-grid__cell--saving');
            // Story 7.1: Also remove checkbox-specific saving class
            cell.classList.remove('ite-checkbox--saving');
            cell.classList.add('ite-grid__cell--save-success');

            // Remove success class after animation completes (matches 500ms CSS animation)
            setTimeout(() => {
                cell.classList.remove('ite-grid__cell--save-success');
            }, 500);
        }
        // Save state after successful save to persist the optimistic update
        saveState();
    }

    /**
     * Handle saveCellResult event from extension
     * Story 3.3: Server response handling with pending saves tracking
     * @param {{ success: boolean; rowIndex: number; colIndex: number; columnName: string; oldValue: unknown; newValue: unknown; primaryKeyValue: unknown; error?: { message: string; code: string } }} payload
     */
    function handleSaveCellResult(payload) {
        const { success, rowIndex, colIndex, columnName, oldValue, primaryKeyValue, error } = payload;

        // Look up the pending save using primary key + column as identifier
        const saveKey = `${primaryKeyValue}:${columnName}`;
        const pendingSave = state.pendingSaves.get(saveKey);

        // Remove from pending saves
        state.pendingSaves.delete(saveKey);

        // Determine the actual row/col to update
        // If pagination changed, try to find the row by its primary key value
        let actualRowIndex = rowIndex;
        let actualColIndex = colIndex;

        if (pendingSave) {
            // Check if indices are still valid
            if (rowIndex < 0 || rowIndex >= state.rows.length ||
                colIndex < 0 || colIndex >= state.columns.length) {
                // Row indices are stale (e.g., pagination happened)
                // Try to find the row by primary key
                const pkColumn = findPrimaryKeyColumn();
                if (pkColumn) {
                    actualRowIndex = state.rows.findIndex(row => row[pkColumn] === primaryKeyValue);
                    if (actualRowIndex >= 0) {
                        actualColIndex = state.columns.findIndex(col => col.name === columnName);
                    }
                }
            }
        }

        if (success) {
            console.debug(`${LOG_PREFIX} Cell saved successfully`);
            if (actualRowIndex >= 0 && actualColIndex >= 0) {
                showSaveSuccess(actualRowIndex, actualColIndex);
                // Remove any error state from previous failed attempt
                const cell = getCellElement(actualRowIndex, actualColIndex);
                if (cell) {
                    cell.classList.remove('ite-grid__cell--error');
                }
            }
            announce(`Saved successfully`);
        } else {
            console.debug(`${LOG_PREFIX} Cell save failed:`, error?.message);
            // Rollback to original value if we can find the row
            if (actualRowIndex >= 0 && actualColIndex >= 0) {
                rollbackCellValue(actualRowIndex, actualColIndex, oldValue);
                // Story 3.5: Add error state to cell
                const cell = getCellElement(actualRowIndex, actualColIndex);
                if (cell) {
                    cell.classList.add('ite-grid__cell--error');
                }
            } else {
                // Can't rollback visually - data will be stale until refresh
                console.warn(`${LOG_PREFIX} Cannot rollback: Row no longer visible`);
            }
            announce(`Save failed: ${error?.message || 'Unknown error'}`);

            // Story 3.5: Show error toast with formatted message
            showError({ message: error?.message || 'Failed to save changes', code: error?.code });
        }
    }

    // ========================================================================
    // Story 5.1: Row Selection Functions
    // ========================================================================

    /**
     * Handle row selector checkbox click
     * Story 5.1: Toggle row selection for deletion
     * @param {number} rowIndex - Row index (0-based)
     */
    function handleRowSelectorClick(rowIndex) {
        // Validate bounds
        if (rowIndex < 0 || rowIndex >= state.totalDisplayRows) return;

        // Toggle selection: if already selected, deselect; otherwise select
        if (state.selectedRowIndex === rowIndex) {
            // Deselect
            state.selectedRowIndex = null;
            announce(`Row ${rowIndex + 1} deselected`);
            console.debug(`${LOG_PREFIX} Row ${rowIndex} deselected`);
        } else {
            // Select new row (clears previous selection)
            state.selectedRowIndex = rowIndex;
            const isNew = isNewRow(rowIndex);
            announce(`Row ${rowIndex + 1} selected${isNew ? ' (new row)' : ''}`);
            console.debug(`${LOG_PREFIX} Row ${rowIndex} selected (isNew: ${isNew})`);
        }

        // Re-render to update visual state
        renderGrid();

        // Update delete button state
        updateDeleteButtonState();

        // Persist state
        saveState();
    }

    /**
     * Select a row programmatically
     * Story 5.1: Row selection helper
     * @param {number} rowIndex - Row index (0-based), or null to deselect
     */
    function selectRow(rowIndex) {
        if (rowIndex === null || rowIndex < 0 || rowIndex >= state.totalDisplayRows) {
            state.selectedRowIndex = null;
        } else {
            state.selectedRowIndex = rowIndex;
        }
        renderGrid();
        updateDeleteButtonState();
        saveState();
    }

    /**
     * Clear row selection
     * Story 5.1: Called on pagination, refresh, etc.
     */
    function clearRowSelection() {
        if (state.selectedRowIndex !== null) {
            state.selectedRowIndex = null;
            updateDeleteButtonState();
            saveState();
        }
    }

    /**
     * Handle delete row button click
     * Story 5.1: Entry point for delete
     * Story 5.2: Show confirmation dialog
     */
    function handleDeleteRowClick() {
        if (!state.hasSelectedRow) {
            announce('No row selected');
            return;
        }

        if (state.selectedRowIsNew) {
            announce('Cannot delete unsaved new rows. Use Escape to discard.');
            return;
        }

        // Story 5.3: Prevent opening dialog if delete is already in progress
        if (isDeleteInProgress) {
            announce('Delete operation in progress');
            return;
        }

        console.debug(`${LOG_PREFIX} Delete row clicked for row ${state.selectedRowIndex}`);
        // Story 5.2: Show confirmation dialog
        showDeleteConfirmDialog();
    }

    // ========================================================================
    // Story 5.2: Delete Confirmation Dialog
    // ========================================================================

    /** @type {HTMLElement | null} - Track focus before dialog opens */
    let dialogPreviousFocus = null;
    /** @type {boolean} - Track if delete dialog is currently open */
    let isDeleteDialogOpen = false;
    /** @type {boolean} - Story 5.3: Track if delete operation is in progress */
    let isDeleteInProgress = false;

    /**
     * Show the delete confirmation dialog
     * Story 5.2: Modal confirmation before deletion
     */
    function showDeleteConfirmDialog() {
        const overlay = document.getElementById('deleteDialogOverlay');
        const cancelBtn = document.getElementById('deleteDialogCancel');

        if (!overlay || !cancelBtn) {
            console.warn(`${LOG_PREFIX} Delete dialog elements not found`);
            return;
        }

        // Save current focus for restoration
        dialogPreviousFocus = /** @type {HTMLElement} */ (document.activeElement);

        // Show dialog
        overlay.style.display = 'flex';
        isDeleteDialogOpen = true;

        // Focus Cancel button (safer default)
        cancelBtn.focus();

        // Announce to screen readers
        announce('Delete confirmation dialog opened. Press Cancel to keep the row, or Delete to remove it.');

        console.debug(`${LOG_PREFIX} Delete confirmation dialog shown`);
    }

    /**
     * Hide the delete confirmation dialog
     * Story 5.2: Close dialog and restore focus
     */
    function hideDeleteConfirmDialog() {
        const overlay = document.getElementById('deleteDialogOverlay');
        if (!overlay) return;

        // Hide dialog
        overlay.style.display = 'none';
        isDeleteDialogOpen = false;

        // Restore focus
        if (dialogPreviousFocus && typeof dialogPreviousFocus.focus === 'function') {
            dialogPreviousFocus.focus();
        }
        dialogPreviousFocus = null;

        console.debug(`${LOG_PREFIX} Delete confirmation dialog hidden`);
    }

    /**
     * Handle Cancel button click in delete dialog
     * Story 5.2: Close dialog, keep row selected
     */
    function handleDeleteDialogCancel() {
        hideDeleteConfirmDialog();
        announce('Deletion cancelled. Row remains unchanged.');
    }

    /**
     * Handle Confirm (Delete) button click in delete dialog
     * Story 5.2: Close dialog and proceed with deletion
     */
    function handleDeleteDialogConfirm() {
        hideDeleteConfirmDialog();
        // Story 5.3 will implement the actual DELETE
        executeDeleteRow();
    }

    /**
     * Execute the row deletion
     * Story 5.3: Send deleteRow command to extension
     */
    function executeDeleteRow() {
        if (!state.hasSelectedRow || state.selectedRowIsNew) {
            return;
        }

        // Story 5.3: Prevent concurrent delete operations
        if (isDeleteInProgress) {
            return;
        }

        const rowIndex = state.selectedRowIndex;
        const row = state.rows[rowIndex];

        if (!row) {
            showToast('Cannot delete: row not found', 'error');
            return;
        }

        // Get primary key column (typically 'ID')
        const pkColumn = findPrimaryKeyColumn();
        if (!pkColumn) {
            showToast('Cannot delete: no primary key column', 'error');
            return;
        }

        const pkValue = row[pkColumn];
        if (pkValue === undefined || pkValue === null) {
            showToast('Cannot delete: row has no primary key value', 'error');
            return;
        }

        console.debug(`${LOG_PREFIX} Executing delete for row ${rowIndex}, PK ${pkColumn}=${pkValue}`);

        // Story 5.3: Mark delete in progress and disable button
        isDeleteInProgress = true;
        const deleteBtn = document.getElementById('deleteRowBtn');
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }

        // Send deleteRow command to extension
        sendCommand('deleteRow', {
            rowIndex: rowIndex,
            primaryKeyColumn: pkColumn,
            primaryKeyValue: pkValue
        });

        announce(`Deleting row ${rowIndex + 1}...`);
    }

    /**
     * Handle keyboard events in delete dialog
     * Story 5.2: Focus trap and Escape handling
     * @param {KeyboardEvent} e
     */
    function handleDeleteDialogKeydown(e) {
        // Story 5.2: Use state variable for robust visibility check
        if (!isDeleteDialogOpen) return;

        const cancelBtn = document.getElementById('deleteDialogCancel');
        const confirmBtn = document.getElementById('deleteDialogConfirm');

        // Escape closes dialog
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            handleDeleteDialogCancel();
            return;
        }

        // Tab: Focus trap between Cancel and Delete
        if (e.key === 'Tab') {
            if (!cancelBtn || !confirmBtn) return;

            if (e.shiftKey) {
                // Shift+Tab: If on Cancel, go to Delete
                if (document.activeElement === cancelBtn) {
                    e.preventDefault();
                    confirmBtn.focus();
                }
            } else {
                // Tab: If on Delete, go to Cancel
                if (document.activeElement === confirmBtn) {
                    e.preventDefault();
                    cancelBtn.focus();
                }
            }
        }
    }

    /**
     * Setup delete dialog event listeners
     * Story 5.2: Initialize dialog handlers
     */
    function setupDeleteDialog() {
        const cancelBtn = document.getElementById('deleteDialogCancel');
        const confirmBtn = document.getElementById('deleteDialogConfirm');
        const overlay = document.getElementById('deleteDialogOverlay');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', handleDeleteDialogCancel);
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', handleDeleteDialogConfirm);
        }

        // Click on overlay (outside dialog) cancels
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                // Only cancel if clicked directly on overlay, not dialog
                if (e.target === overlay) {
                    handleDeleteDialogCancel();
                }
            });
        }

        // Global keydown for focus trap
        document.addEventListener('keydown', handleDeleteDialogKeydown);
    }

    // ========================================================================
    // Story 8.4: Data Operation Helpers
    // ========================================================================

    /**
     * Focus the filter input for a specific column
     * Story 8.4: Used by Ctrl+F shortcut
     * @param {number} colIndex - Column index
     */
    function focusColumnFilter(colIndex) {
        const filterRow = document.querySelector('.ite-grid__filter-row');
        if (!filterRow) {
            announce('No filter row available');
            return;
        }

        // Filter inputs are in order, matching column indexes
        const filterInputs = filterRow.querySelectorAll('.ite-grid__filter-input');
        if (colIndex >= 0 && colIndex < filterInputs.length) {
            const input = /** @type {HTMLInputElement} */ (filterInputs[colIndex]);
            input.focus();
            input.select();
            const colName = state.columns[colIndex]?.name || `Column ${colIndex + 1}`;
            announce(`Filter for ${colName}`);
        }
    }

    /**
     * Show "Go to Row" dialog
     * Story 8.4: Used by Ctrl+G shortcut
     */
    function showGoToRowDialog() {
        // Don't show if no data
        if (state.totalDisplayRows === 0) {
            announce('No rows to navigate to');
            return;
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'ite-dialog-overlay';

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'ite-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'goto-dialog-title');

        dialog.innerHTML = `
            <h3 id="goto-dialog-title" class="ite-dialog__title">Go to Row</h3>
            <div class="ite-dialog__content">
                <label class="ite-dialog__label" for="goto-row-input">
                    Enter row number (1-${state.totalDisplayRows}):
                </label>
                <input type="number"
                    id="goto-row-input"
                    class="ite-dialog__input"
                    min="1"
                    max="${state.totalDisplayRows}"
                    placeholder="Row number"
                    autofocus>
            </div>
            <div class="ite-dialog__actions">
                <button id="goto-cancel-btn" class="ite-btn ite-btn--secondary">Cancel</button>
                <button id="goto-confirm-btn" class="ite-btn ite-btn--primary">Go</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const input = /** @type {HTMLInputElement} */ (document.getElementById('goto-row-input'));
        const confirmBtn = document.getElementById('goto-confirm-btn');
        const cancelBtn = document.getElementById('goto-cancel-btn');

        // Store previous selection for restoration
        const previousCell = { ...state.selectedCell };

        function closeDialog() {
            overlay.remove();
        }

        function handleConfirm() {
            const rowNum = parseInt(input.value, 10);
            if (isNaN(rowNum) || rowNum < 1 || rowNum > state.totalDisplayRows) {
                input.classList.add('ite-dialog__input--error');
                announce(`Invalid row number. Enter 1 to ${state.totalDisplayRows}`);
                input.focus();
                return;
            }

            closeDialog();
            // Navigate to the row (convert to 0-indexed)
            const rowIndex = rowNum - 1;
            selectCell(rowIndex, previousCell.colIndex ?? 0);
            announce(`Navigated to row ${rowNum}`);
        }

        function handleCancel() {
            closeDialog();
            // Restore focus to previous cell
            if (previousCell.rowIndex !== null && previousCell.colIndex !== null) {
                selectCell(previousCell.rowIndex, previousCell.colIndex);
            }
        }

        // Event handlers
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        });

        // Click on overlay closes dialog
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        });

        // Focus input
        setTimeout(() => input.focus(), 50);
    }

    /**
     * Show keyboard shortcuts help dialog
     * Story 8.5: Displays all available keyboard shortcuts organized by category
     */
    function showKeyboardShortcutsHelp() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'ite-dialog-overlay';

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'ite-dialog ite-help-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'help-dialog-title');

        dialog.innerHTML = `
            <h3 id="help-dialog-title" class="ite-dialog__title">Keyboard Shortcuts</h3>
            <p class="ite-help-note">On Mac, use <strong>Cmd</strong> instead of Ctrl</p>
            <div class="ite-dialog__content ite-help-content">
                <div class="ite-help-category">
                    <h4 class="ite-help-category__title">Navigation</h4>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Arrow keys</span>Move to adjacent cell</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Tab</span>Move to next cell</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Shift+Tab</span>Move to previous cell</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Home</span>First cell in row</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">End</span>Last cell in row</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+Home</span>First cell in grid</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+End</span>Last cell in grid</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Page Up/Down</span>Move one page</div>
                </div>

                <div class="ite-help-category">
                    <h4 class="ite-help-category__title">Editing</h4>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Enter</span>Edit cell / Save and move down</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">F2</span>Enter edit mode</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Escape</span>Cancel edit</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Shift+Enter</span>Save and move up</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+Enter</span>Save and stay</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+Z</span>Undo edit</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Delete</span>Clear cell</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Backspace</span>Clear and edit</div>
                </div>

                <div class="ite-help-category">
                    <h4 class="ite-help-category__title">Row Operations</h4>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+N</span>New row</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+D</span>Duplicate row</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+-</span>Delete row</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+S</span>Save new row</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+Shift+N</span>Set cell to NULL</div>
                </div>

                <div class="ite-help-category">
                    <h4 class="ite-help-category__title">Data Operations</h4>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+R / F5</span>Refresh data</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+G</span>Go to row</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+F</span>Focus column filter</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+Shift+F</span>Clear all filters</div>
                </div>

                <div class="ite-help-category">
                    <h4 class="ite-help-category__title">Pagination</h4>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+Page Down</span>Next page</div>
                    <div class="ite-help-shortcut"><span class="ite-help-key">Ctrl+Page Up</span>Previous page</div>
                </div>
            </div>
            <div class="ite-dialog__actions">
                <button id="help-close-btn" class="ite-btn ite-btn--primary">Close</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const closeBtn = document.getElementById('help-close-btn');
        const previousCell = { ...state.selectedCell };

        function closeDialog() {
            overlay.remove();
            // Restore focus to previous cell
            if (previousCell.rowIndex !== null && previousCell.colIndex !== null) {
                selectCell(previousCell.rowIndex, previousCell.colIndex);
            }
        }

        // Event handlers
        closeBtn.addEventListener('click', closeDialog);

        // Keyboard handler
        function handleKeydown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeDialog();
            }
        }
        document.addEventListener('keydown', handleKeydown);

        // Click on overlay closes dialog
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog();
            }
        });

        // Remove keydown listener when dialog closes
        const observer = new MutationObserver((mutations) => {
            if (!document.body.contains(overlay)) {
                document.removeEventListener('keydown', handleKeydown);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });

        // Focus close button
        setTimeout(() => closeBtn.focus(), 50);
    }

    // ========================================================================
    // Story 4.1: New Row Functions
    // ========================================================================

    /**
     * Check if a row index refers to a new (unsaved) row
     * Story 4.1: New row helper
     * @param {number} rowIndex - Row index (0-based)
     * @returns {boolean}
     */
    function isNewRow(rowIndex) {
        return rowIndex >= state.rows.length && rowIndex < state.totalDisplayRows;
    }

    /**
     * Get row data (from either server rows or new rows)
     * Story 4.1: Unified row accessor
     * @param {number} rowIndex - Row index (0-based)
     * @returns {Record<string, unknown> | null}
     */
    function getRowData(rowIndex) {
        if (rowIndex < 0 || rowIndex >= state.totalDisplayRows) return null;
        if (rowIndex < state.rows.length) {
            return state.rows[rowIndex];
        } else {
            const newRowIndex = rowIndex - state.rows.length;
            return state.newRows[newRowIndex];
        }
    }

    /**
     * Add a new empty row to the grid
     * Story 4.1: Core new row creation
     */
    function handleAddRow() {
        // Create empty row with null values for all columns
        const newRow = {};
        state.columns.forEach(col => {
            newRow[col.name] = null;
        });
        console.debug(`${LOG_PREFIX} Creating new row with columns:`, Object.keys(newRow), 'state.columns count:', state.columns.length);

        // Add to newRows array
        state.newRows.push(newRow);

        // Re-render grid to show new row
        renderGrid();

        // Calculate the index of the new row (server rows + new rows - 1)
        const newRowIndex = state.totalDisplayRows - 1;

        // Focus first editable cell of new row
        selectCell(newRowIndex, 0);

        // Enter edit mode automatically
        setTimeout(() => {
            enterEditMode(newRowIndex, 0, '', 'start');
        }, 50);

        announce(`New row added. Row ${newRowIndex + 1} of ${state.totalDisplayRows}`);

        // Story 4.3: Enable save button when there are new rows
        updateSaveButtonState();
        saveState();
    }

    /**
     * Duplicate the current row
     * Story 8.3: Copy row data (excluding primary key) and create new row
     */
    function handleDuplicateRow() {
        const rowIndex = state.selectedCell.rowIndex;
        if (rowIndex === null) {
            announce('No row selected');
            return;
        }

        // Can only duplicate server rows (not new unsaved rows)
        if (isNewRow(rowIndex)) {
            announce('Cannot duplicate unsaved rows. Save the row first.');
            return;
        }

        // Copy the current row data
        const currentRow = state.rows[rowIndex];
        const newRow = {};

        // Copy all fields except primary key
        const pkColumn = findPrimaryKeyColumn();
        state.columns.forEach(col => {
            if (col.name === pkColumn || col.name.toUpperCase() === 'ID' || col.name === '%ID') {
                // Skip primary key - will be auto-generated
                newRow[col.name] = null;
            } else {
                // Copy the value
                newRow[col.name] = currentRow[col.name];
            }
        });

        // Add to newRows array
        state.newRows.push(newRow);

        // Re-render grid to show new row
        renderGrid();

        // Calculate the index of the new row
        const newRowIndex = state.totalDisplayRows - 1;

        // Focus first editable cell of new row
        selectCell(newRowIndex, 0);

        announce(`Row duplicated. New row ${newRowIndex + 1} of ${state.totalDisplayRows}`);

        // Update UI state
        updateSaveButtonState();
        saveState();
    }

    /**
     * Save the selected new row to the database
     * Story 4.3: INSERT new row
     */
    function handleSaveRow() {
        // Find the selected row
        const { rowIndex } = state.selectedCell;
        if (rowIndex === null) {
            announce('No row selected');
            return;
        }

        // Check if it's a new row
        if (!isNewRow(rowIndex)) {
            announce('Only new rows can be saved');
            return;
        }

        // Get the new row data
        const newRowArrayIndex = rowIndex - state.rows.length;
        const rowData = state.newRows[newRowArrayIndex];
        if (!rowData) {
            announce('Row data not found');
            return;
        }

        // Build columns and values arrays
        const columns = [];
        const values = [];
        state.columns.forEach(col => {
            // Skip ID column if it exists (auto-generated by server)
            if (col.name.toUpperCase() === 'ID' || col.name === '%ID') {
                return;
            }
            columns.push(col.name);
            values.push(rowData[col.name]);
        });

        // Send INSERT command to extension
        sendCommand('insertRow', {
            newRowIndex: newRowArrayIndex,
            columns,
            values
        });

        // Mark row as saving
        const row = document.querySelector(`.ite-grid__row[aria-rowindex="${rowIndex + 2}"]`);
        if (row) {
            row.classList.add('ite-grid__row--saving');
        }

        announce(`Saving new row...`);
        console.debug(`${LOG_PREFIX} Saving new row at index ${newRowArrayIndex}`);
    }

    /**
     * Handle insertRowResult event from extension
     * Story 4.3: INSERT result handling
     * @param {{ success: boolean; newRowIndex: number; error?: { message: string; code: string } }} payload
     */
    function handleInsertRowResult(payload) {
        const { success, newRowIndex, error } = payload;

        // Calculate the display row index
        const displayRowIndex = state.rows.length + newRowIndex;
        const row = document.querySelector(`.ite-grid__row[aria-rowindex="${displayRowIndex + 2}"]`);

        if (row) {
            row.classList.remove('ite-grid__row--saving');
        }

        if (success) {
            console.debug(`${LOG_PREFIX} Row inserted successfully`);

            // Remove from newRows array
            const savedRow = state.newRows.splice(newRowIndex, 1)[0];

            // Show success feedback
            if (row) {
                row.classList.add('ite-grid__row--save-success');
            }

            announce(`Row saved successfully`);

            // Update save button state
            updateSaveButtonState();
            saveState();

            // Refresh data from server to get the new row with server-assigned ID
            // Brief delay so user sees success feedback
            setTimeout(() => {
                sendCommand('refresh', {});
            }, 300);
        } else {
            console.debug(`${LOG_PREFIX} Row insert failed:`, error?.message);

            // Keep the row as new (editable)
            if (row) {
                row.classList.add('ite-grid__row--error');
                setTimeout(() => {
                    row.classList.remove('ite-grid__row--error');
                }, 3000);
            }

            announce(`Save failed: ${error?.message || 'Unknown error'}`);

            // Show error toast
            showError({ message: error?.message || 'Failed to save row', code: error?.code });
        }
    }

    /**
     * Handle delete row result from extension
     * Story 5.3: Process deletion result
     * @param {{ success: boolean; rowIndex: number; error?: { message: string; code: string } }} payload
     */
    function handleDeleteRowResult(payload) {
        const { success, rowIndex, error } = payload;

        // Story 5.3: Clear delete in progress state
        isDeleteInProgress = false;

        if (success) {
            console.debug(`${LOG_PREFIX} Row deleted successfully (index: ${rowIndex})`);

            // Clear row selection
            clearRowSelection();

            // Show success feedback
            showToast('Row deleted successfully', 'success');
            announce('Row deleted successfully');

            saveState();

            // Refresh data from server to ensure grid reflects actual database state
            // Brief delay so user sees success feedback
            setTimeout(() => {
                sendCommand('refresh', {});
            }, 300);
        } else {
            console.debug(`${LOG_PREFIX} Row delete failed:`, error?.message);

            // Row remains in grid - just show error
            const errorMessage = error?.message || 'Failed to delete row';
            showToast(errorMessage, 'error');
            announce(`Delete failed: ${errorMessage}`);

            // Story 5.3: Re-enable delete button on failure (row is still selected)
            updateDeleteButtonState();
        }
    }

    /**
     * Cancel/discard a new row
     * Story 4.3: Cancel new row creation
     */
    function handleCancelNewRow() {
        // Find the selected row
        const { rowIndex } = state.selectedCell;
        if (rowIndex === null) {
            return;
        }

        // Check if it's a new row
        if (!isNewRow(rowIndex)) {
            return;
        }

        // Get the new row array index
        const newRowArrayIndex = rowIndex - state.rows.length;

        // Remove from newRows array
        state.newRows.splice(newRowArrayIndex, 1);

        // Clear selection
        state.selectedCell = { rowIndex: null, colIndex: null };

        // Re-render grid
        renderGrid();

        // Update save button state
        updateSaveButtonState();
        saveState();

        announce(`New row discarded`);
        console.debug(`${LOG_PREFIX} Discarded new row at index ${newRowArrayIndex}`);
    }

    /**
     * Update save button enabled state based on new rows
     * Story 4.3: Save button state management
     */
    function updateSaveButtonState() {
        const saveRowBtn = document.getElementById('saveRowBtn');
        if (saveRowBtn) {
            // Enable save button if there are new rows and one is selected
            const hasSelectedNewRow = state.selectedCell.rowIndex !== null &&
                                      isNewRow(state.selectedCell.rowIndex);
            saveRowBtn.disabled = !hasSelectedNewRow;
        }
    }

    /**
     * Update delete button enabled state based on row selection
     * Story 5.1: Delete button state management
     * - Enabled when: row is selected AND row is NOT a new row (server rows only)
     * - Disabled when: no row selected OR selected row is a new row
     */
    function updateDeleteButtonState() {
        const deleteRowBtn = document.getElementById('deleteRowBtn');
        if (deleteRowBtn) {
            // Enable delete button only for existing (server) rows, not new rows
            const canDelete = state.hasSelectedRow && !state.selectedRowIsNew;
            deleteRowBtn.disabled = !canDelete;
        }
    }

    // ========================================================================
    // Story 3.5: Toast Notification System
    // ========================================================================

    /** @type {HTMLElement | null} */
    let activeToast = null;

    /**
     * Format error message based on error code
     * Story 3.5: User-friendly error messages
     * @param {{ message: string; code: string }} error
     * @returns {string}
     */
    function formatErrorMessage(error) {
        switch (error.code) {
            case 'CONNECTION_TIMEOUT':
                return 'Connection timed out. The server may be busy. Try again.';
            case 'SERVER_UNREACHABLE':
                return 'Cannot reach server. Please verify the server is running.';
            case 'AUTH_FAILED':
                return 'Authentication failed. Please reconnect to the server.';
            case 'CONSTRAINT_VIOLATION':
                return `Constraint violation: ${error.message}`;
            case 'INVALID_INPUT':
                return `Invalid value: ${error.message}`;
            case 'CONNECTION_FAILED':
                return 'Connection lost. Please check your connection.';
            default:
                return error.message || 'An unexpected error occurred. Please try again.';
        }
    }

    /**
     * Show toast notification
     * Story 3.5: Dismissable error notifications
     * @param {string} message - Message to display
     * @param {'error' | 'warning' | 'info'} type - Toast type
     * @param {number} duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
     */
    function showToast(message, type = 'error', duration = 5000) {
        // Dismiss any existing toast
        if (activeToast) {
            dismissToast(activeToast, true);
        }

        const container = document.getElementById('toastContainer');
        if (!container) return;

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `ite-toast ite-toast--${type}`;
        toast.setAttribute('role', 'alert');

        // Icon based on type
        const iconMap = { error: '\u26A0', warning: '\u26A0', info: '\u2139', success: '\u2713' }; // ⚠, ⚠, ℹ, ✓
        const icon = document.createElement('span');
        icon.className = 'ite-toast__icon';
        icon.textContent = iconMap[type];
        toast.appendChild(icon);

        // Message
        const messageEl = document.createElement('span');
        messageEl.className = 'ite-toast__message';
        messageEl.textContent = message;
        toast.appendChild(messageEl);

        // Dismiss button
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'ite-toast__dismiss';
        dismissBtn.setAttribute('aria-label', 'Dismiss notification');
        dismissBtn.textContent = '\u2715'; // ✕
        dismissBtn.addEventListener('click', () => dismissToast(toast));
        toast.appendChild(dismissBtn);

        // Add keyboard handler for Escape
        toast.tabIndex = -1;
        toast.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                dismissToast(toast);
            }
        });

        container.appendChild(toast);
        activeToast = toast;

        // Focus the dismiss button for keyboard users
        dismissBtn.focus();

        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => {
                if (activeToast === toast) {
                    dismissToast(toast);
                }
            }, duration);
        }

        console.debug(`${LOG_PREFIX} Toast shown: ${type} - ${message}`);
    }

    /**
     * Dismiss a toast notification
     * @param {HTMLElement} toast - Toast element to dismiss
     * @param {boolean} immediate - Skip animation
     */
    function dismissToast(toast, immediate = false) {
        if (!toast || !toast.parentNode) return;

        if (immediate) {
            toast.remove();
            if (activeToast === toast) activeToast = null;
            return;
        }

        // Add dismissing animation
        toast.classList.add('ite-toast--dismissing');
        setTimeout(() => {
            toast.remove();
            if (activeToast === toast) activeToast = null;
        }, 150); // Match CSS animation duration
    }

    /**
     * Show error message to user
     * Story 3.5: Enhanced error display with toast
     * @param {{ message: string; code?: string }} payload
     */
    function showError(payload) {
        const formattedMessage = formatErrorMessage({
            message: payload.message,
            code: payload.code || 'UNKNOWN_ERROR'
        });
        showToast(formattedMessage, 'error', 8000);

        // Also update status bar briefly
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = `Error: ${payload.message}`;
            statusText.classList.add('ite-status-bar__text--error');

            setTimeout(() => {
                updateStatusBar();
                statusText.classList.remove('ite-status-bar__text--error');
            }, 5000);
        }
    }

    /**
     * Handle input change events to track modified state
     * Story 3.4: Visual feedback for unsaved changes
     * @param {Event} event
     */
    function handleEditInputChange(event) {
        if (!state.isEditing) return;

        const { rowIndex, colIndex } = state.editingCell;
        const cell = getCellElement(rowIndex, colIndex);
        if (!cell) return;

        const currentValue = /** @type {HTMLInputElement} */ (event.target).value;
        // Compare with original value (handle null/undefined)
        const originalStr = state.editOriginalValue === null || state.editOriginalValue === undefined
            ? ''
            : String(state.editOriginalValue);
        const isModified = currentValue !== originalStr;

        if (isModified) {
            cell.classList.add('ite-grid__cell--modified');
        } else {
            cell.classList.remove('ite-grid__cell--modified');
        }
    }

    /**
     * Handle keydown events on the edit input
     * Story 3.2: Edit input keyboard handling
     * Story 8.2: Added Shift+Enter (move up), Ctrl+Enter (stay), Ctrl+Z (undo)
     * @param {KeyboardEvent} event
     */
    function handleEditInputKeydown(event) {
        // Story 8.2: Ctrl+Z to undo (restore original value while staying in edit mode)
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            const input = /** @type {HTMLInputElement} */ (event.target);
            // Restore original value
            const originalValue = state.editOriginalValue;
            input.value = originalValue === null || originalValue === undefined ? '' : String(originalValue);
            // Update modified state indicator
            const cell = getCellElement(state.editingCell.rowIndex, state.editingCell.colIndex);
            if (cell) {
                cell.classList.remove('ite-grid__cell--modified');
            }
            announce('Edit undone');
            return;
        }

        switch (event.key) {
            case 'Enter':
                // Story 8.2: Enter with modifiers for directional movement
                event.preventDefault();
                {
                    const { rowIndex, colIndex } = state.selectedCell;
                    const maxRow = state.totalDisplayRows - 1;

                    exitEditMode(true);

                    if (event.ctrlKey || event.metaKey) {
                        // Ctrl+Enter: Save and stay on current cell
                        // Cell already selected, just announce
                        announce('Saved');
                    } else if (event.shiftKey) {
                        // Shift+Enter: Save and move UP
                        if (rowIndex > 0) {
                            selectCell(rowIndex - 1, colIndex);
                        }
                    } else {
                        // Enter: Save and move DOWN
                        if (rowIndex < maxRow) {
                            selectCell(rowIndex + 1, colIndex);
                        }
                    }
                }
                break;

            case 'Escape':
                // Cancel and exit edit mode
                event.preventDefault();
                exitEditMode(false);
                break;

            case 'Tab':
                // Save and move to next/previous cell
                // Story 4.2: Updated to work with new rows
                event.preventDefault();
                event.stopPropagation(); // Prevent grid's handleCellKeydown from also handling Tab
                exitEditMode(true);
                // Navigate to next/previous cell
                if (state.selectedCell.rowIndex !== null && state.selectedCell.colIndex !== null) {
                    const { rowIndex, colIndex } = state.selectedCell;
                    // Story 4.2: Include new rows in max calculation
                    const maxRow = state.totalDisplayRows - 1;
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

        // Don't process double-clicks on selector cells
        if (cell.classList.contains('ite-grid__cell--selector')) return;

        // Find row and column index
        const row = cell.closest('.ite-grid__row');
        if (!row) return;

        const grid = document.getElementById('dataGrid');
        if (!grid) return;

        const rows = Array.from(grid.querySelectorAll('.ite-grid__row'));
        const rowIndex = rows.indexOf(row);
        if (rowIndex < 0) return;

        // Get data cells only (exclude selector cell) to match getCellElement behavior
        const cells = Array.from(row.querySelectorAll('.ite-grid__cell:not(.ite-grid__cell--selector)'));
        const colIndex = cells.indexOf(cell);
        if (colIndex < 0) return;

        // Story 7.1: Boolean cells toggle on double-click (same as single click)
        if (isBooleanColumn(colIndex)) {
            toggleBooleanCheckbox(rowIndex, colIndex);
            return;
        }

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

        // Get only data cells, excluding the selector cell
        const cells = rows[rowIndex].querySelectorAll('.ite-grid__cell:not(.ite-grid__cell--selector)');
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
     * Story 4.1: Updated to handle new rows
     * @param {number} rowIndex - Row index (0-based, data rows only)
     * @param {number} colIndex - Column index (0-based)
     * @param {boolean} [focus=true] - Whether to focus the cell
     */
    function selectCell(rowIndex, colIndex, focus = true) {
        // Validate bounds (including new rows)
        if (rowIndex < 0 || rowIndex >= state.totalDisplayRows) return;
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
            // Story 8.1: Scroll cell into view when navigating
            newCell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }

        // Announce for screen readers
        const colName = state.columns[colIndex]?.name || `Column ${colIndex + 1}`;
        announce(`${colName}, row ${rowIndex + 1} of ${state.totalDisplayRows}`);

        // Story 4.3: Update save button when selection changes
        updateSaveButtonState();
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

        // Don't process clicks on selector cells (handled by checkbox click handler)
        if (cell.classList.contains('ite-grid__cell--selector')) return;

        // Find row and column index
        const row = cell.closest('.ite-grid__row');
        if (!row) return;

        const grid = document.getElementById('dataGrid');
        if (!grid) return;

        const rows = Array.from(grid.querySelectorAll('.ite-grid__row'));
        const rowIndex = rows.indexOf(row);
        if (rowIndex < 0) return;

        // Get data cells only (exclude selector cell) to match getCellElement behavior
        const cells = Array.from(row.querySelectorAll('.ite-grid__cell:not(.ite-grid__cell--selector)'));
        const colIndex = cells.indexOf(cell);
        if (colIndex < 0) return;

        // Story 3.2: If editing a different cell, exit edit mode first (save)
        if (state.isEditing) {
            if (state.editingCell.rowIndex !== rowIndex || state.editingCell.colIndex !== colIndex) {
                exitEditMode(true);
            }
        }

        // Story 7.1: Boolean cells toggle on click instead of entering edit mode
        if (isBooleanColumn(colIndex)) {
            selectCell(rowIndex, colIndex);
            toggleBooleanCheckbox(rowIndex, colIndex);
            return;
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
        // Ignore if event originated from an input/textarea (e.g., filter inputs)
        const target = event.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            return;
        }

        // Only handle if a cell is selected
        if (state.selectedCell.rowIndex === null || state.selectedCell.colIndex === null) {
            return;
        }

        // Story 3.2: If editing, let the input handle the event
        if (state.isEditing) {
            return;
        }

        const { rowIndex, colIndex } = state.selectedCell;
        // Story 4.1: Include new rows in max calculation
        const maxRow = state.totalDisplayRows - 1;
        const maxCol = state.columns.length - 1;

        // Story 7.1/7.5: Ctrl+Shift+N sets cell to NULL (works for all nullable columns)
        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'n') {
            event.preventDefault();
            setCellToNull(rowIndex, colIndex);
            return;
        }

        switch (event.key) {
            // Story 7.1: Space toggles boolean checkbox
            case ' ':
                if (isBooleanColumn(colIndex)) {
                    event.preventDefault();
                    toggleBooleanCheckbox(rowIndex, colIndex);
                    return;
                }
                break;

            // Story 3.2: F2 to enter edit mode (except for boolean columns)
            case 'F2':
                event.preventDefault();
                // Story 7.1: F2 on boolean just toggles
                if (isBooleanColumn(colIndex)) {
                    toggleBooleanCheckbox(rowIndex, colIndex);
                    return;
                }
                enterEditMode(rowIndex, colIndex, null, 'end');
                return;

            // Story 8.2: Enter to enter edit mode (same as F2)
            case 'Enter':
                event.preventDefault();
                if (isBooleanColumn(colIndex)) {
                    toggleBooleanCheckbox(rowIndex, colIndex);
                    return;
                }
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

            // Story 8.1: Page Up/Down - move by visible page of rows
            case 'PageUp':
                event.preventDefault();
                {
                    const visibleRows = getVisibleRowCount();
                    const newRow = Math.max(0, rowIndex - visibleRows);
                    selectCell(newRow, colIndex);
                }
                break;

            case 'PageDown':
                event.preventDefault();
                {
                    const visibleRows = getVisibleRowCount();
                    const newRow = Math.min(maxRow, rowIndex + visibleRows);
                    selectCell(newRow, colIndex);
                }
                break;

            // Story 8.2: Delete clears cell immediately (saves empty string)
            case 'Delete':
                event.preventDefault();
                if (isBooleanColumn(colIndex)) {
                    // For boolean, Delete sets to NULL
                    setCellToNull(rowIndex, colIndex);
                    return;
                }
                // Save empty string immediately without entering edit mode
                saveCellValue(rowIndex, colIndex, '');
                break;

            // Story 3.2: Backspace enters edit mode with cleared content
            case 'Backspace':
                event.preventDefault();
                if (isBooleanColumn(colIndex)) {
                    return; // No backspace action for boolean
                }
                enterEditMode(rowIndex, colIndex, '', 'start');
                break;

            default:
                // Story 3.2: Printable characters start edit mode (overwrite)
                // Story 7.1: Except for boolean columns which don't support text entry
                // Check if it's a single printable character and no modifier keys
                if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                    if (isBooleanColumn(colIndex)) {
                        // Boolean columns don't support text entry
                        return;
                    }
                    event.preventDefault();
                    enterEditMode(rowIndex, colIndex, event.key, 'end');
                }
                break;
        }
    }

    /**
     * Story 8.1: Calculate number of visible rows in the grid viewport
     * Used for Page Up/Down navigation to move by a screen's worth of rows
     * @returns {number} Approximate number of rows visible in the viewport
     */
    function getVisibleRowCount() {
        const gridBody = document.getElementById('dataGrid');
        if (!gridBody) return 10; // Default fallback

        const row = gridBody.querySelector('.ite-grid__row');
        if (!row) return 10;

        const rowHeight = row.offsetHeight;
        if (rowHeight === 0) return 10;

        const viewportHeight = gridBody.clientHeight;
        return Math.max(1, Math.floor(viewportHeight / rowHeight));
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
     * Story 5.1: Added row selector column header
     * Story 6.2: Added filter row below header
     */
    function renderHeader() {
        const grid = document.getElementById('dataGrid');
        if (!grid || !state.columns.length) {
            return;
        }
        console.debug(`${LOG_PREFIX} renderHeader: state.columns.length=${state.columns.length}, creating ${state.columns.length + 1} header cells (1 selector + ${state.columns.length} data)`);

        const headerRow = document.createElement('div');
        headerRow.className = 'ite-grid__header-row';
        headerRow.setAttribute('role', 'row');

        // Story 5.1: Add row selector column header
        const selectorHeader = document.createElement('div');
        selectorHeader.className = 'ite-grid__header-cell ite-grid__header-cell--selector';
        selectorHeader.setAttribute('role', 'columnheader');
        selectorHeader.setAttribute('aria-label', 'Row selection');
        // Empty header - just visual consistency
        headerRow.appendChild(selectorHeader);

        state.columns.forEach((col, index) => {
            const cell = document.createElement('div');
            cell.className = 'ite-grid__header-cell ite-grid__header-cell--sortable';
            cell.setAttribute('role', 'columnheader');
            cell.setAttribute('aria-colindex', String(index + 2)); // +2 because selector is column 1
            cell.setAttribute('data-column', col.name);
            cell.tabIndex = 0; // Story 6.4: Make sortable headers focusable

            // Story 6.4: Create header content container
            const content = document.createElement('span');
            content.className = 'ite-grid__header-content';
            content.textContent = col.name;
            cell.appendChild(content);

            // Story 6.4: Add sort indicator
            const sortIndicator = document.createElement('span');
            sortIndicator.className = 'ite-grid__sort-indicator';
            if (state.sortColumn === col.name) {
                if (state.sortDirection === 'asc') {
                    sortIndicator.textContent = '\u25B2'; // ▲
                    sortIndicator.classList.add('ite-grid__sort-indicator--active');
                    cell.setAttribute('aria-sort', 'ascending');
                } else if (state.sortDirection === 'desc') {
                    sortIndicator.textContent = '\u25BC'; // ▼
                    sortIndicator.classList.add('ite-grid__sort-indicator--active');
                    cell.setAttribute('aria-sort', 'descending');
                }
            }
            cell.appendChild(sortIndicator);

            cell.title = `${col.name} (${col.dataType}${col.nullable ? ', nullable' : ''}) - Click to sort`;

            // Story 6.4: Add click handler for sorting
            cell.addEventListener('click', () => handleColumnSort(col.name));
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleColumnSort(col.name);
                }
            });

            headerRow.appendChild(cell);
        });

        grid.appendChild(headerRow);

        // Story 6.2: Render filter row
        renderFilterRow(grid);
    }

    /**
     * Render filter row with input for each column (Story 6.2)
     * @param {HTMLElement} grid - Grid container element
     */
    function renderFilterRow(grid) {
        const filterRow = document.createElement('div');
        filterRow.className = 'ite-grid__filter-row';
        if (!state.filtersEnabled) {
            filterRow.classList.add('ite-grid__filter-row--disabled');
        }
        filterRow.setAttribute('role', 'row');
        filterRow.id = 'filterRow';

        // Empty cell for row selector column
        const selectorFilterCell = document.createElement('div');
        selectorFilterCell.className = 'ite-grid__filter-cell ite-grid__filter-cell--selector';
        filterRow.appendChild(selectorFilterCell);

        state.columns.forEach((col, colIndex) => {
            const filterCell = document.createElement('div');
            filterCell.className = 'ite-grid__filter-cell';

            // Check if this is a boolean column - use dropdown instead of text input
            const isBool = isBooleanColumn(colIndex);

            if (isBool) {
                // Create dropdown for boolean filter
                const select = document.createElement('select');
                select.className = 'ite-grid__filter-input ite-grid__filter-select';
                select.setAttribute('aria-label', `Filter ${col.name}`);
                select.setAttribute('data-column', col.name);

                // Add options: All, True, False
                const optAll = document.createElement('option');
                optAll.value = '';
                optAll.textContent = 'All';
                select.appendChild(optAll);

                const optTrue = document.createElement('option');
                optTrue.value = '1';
                optTrue.textContent = 'True';
                select.appendChild(optTrue);

                const optFalse = document.createElement('option');
                optFalse.value = '0';
                optFalse.textContent = 'False';
                select.appendChild(optFalse);

                // Restore filter value if exists
                const existingValue = state.filters.get(col.name) || '';
                select.value = existingValue;
                if (existingValue !== '') {
                    select.classList.add('ite-grid__filter-input--active');
                }

                // Disable if filters are disabled
                if (!state.filtersEnabled) {
                    select.disabled = true;
                }

                // Apply filter on change
                select.addEventListener('change', () => {
                    applyFilter(col.name, select.value);
                });

                filterCell.appendChild(select);
            } else {
                // Create text input for non-boolean columns
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'ite-grid__filter-input';
                input.placeholder = 'Filter...';
                input.setAttribute('aria-label', `Filter ${col.name}`);
                input.setAttribute('data-column', col.name);

                // Restore filter value if exists
                const existingValue = state.filters.get(col.name) || '';
                input.value = existingValue;
                if (existingValue.trim() !== '') {
                    input.classList.add('ite-grid__filter-input--active');
                }

                // Disable input if filters are disabled
                if (!state.filtersEnabled) {
                    input.disabled = true;
                }

                // Apply filter on Enter or blur
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        applyFilter(col.name, input.value);
                    }
                    // Escape clears the current input
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        input.value = '';
                        applyFilter(col.name, '');
                    }
                });

                // Debounce timer for input events
                let debounceTimer = null;

                // Apply filter on input with debounce (300ms delay)
                input.addEventListener('input', () => {
                    console.debug(`${LOG_PREFIX} Filter input event for ${col.name}, value: "${input.value}"`);
                    if (debounceTimer) {
                        clearTimeout(debounceTimer);
                    }
                    debounceTimer = setTimeout(() => {
                        console.debug(`${LOG_PREFIX} Filter debounce applying for ${col.name}`);
                        applyFilter(col.name, input.value);
                    }, 300);
                });

                // Also apply immediately on blur (when tabbing out or clicking away)
                input.addEventListener('blur', () => {
                    console.debug(`${LOG_PREFIX} Filter blur fired for ${col.name}, value: "${input.value}"`);
                    // Clear any pending debounce and apply immediately
                    if (debounceTimer) {
                        clearTimeout(debounceTimer);
                        debounceTimer = null;
                    }
                    applyFilter(col.name, input.value);
                });

                filterCell.appendChild(input);
            }

            filterRow.appendChild(filterCell);
        });

        grid.appendChild(filterRow);
    }

    /**
     * Apply filter for a column (Story 6.2)
     * @param {string} column - Column name
     * @param {string} value - Filter value
     */
    function applyFilter(column, value) {
        console.debug(`${LOG_PREFIX} applyFilter called: column="${column}", value="${value}"`);
        const trimmedValue = value.trim();
        const currentValue = state.filters.get(column) || '';
        console.debug(`${LOG_PREFIX} applyFilter: trimmed="${trimmedValue}", current="${currentValue}"`);

        // Check if value actually changed to avoid unnecessary requests
        if (trimmedValue === currentValue) {
            console.debug(`${LOG_PREFIX} applyFilter: No change, returning early`);
            return;
        }

        console.debug(`${LOG_PREFIX} applyFilter: Applying filter change`);
        if (trimmedValue === '') {
            state.filters.delete(column);
        } else {
            state.filters.set(column, trimmedValue);
        }
        saveState();
        updateFilterInputStyles();
        updateFilterToolbarButtons();
        updateFilterBadge();  // Story 6.3
        renderFilterPanelContent();  // Story 6.3: Update panel if open

        // Reset to page 1 and reload data
        state.currentPage = 1;
        console.debug(`${LOG_PREFIX} applyFilter: Requesting filtered data`);
        requestFilteredData();
    }

    /**
     * Update filter input styles based on active filters (Story 6.2)
     * Updated to handle both text inputs and select dropdowns
     */
    function updateFilterInputStyles() {
        const inputs = document.querySelectorAll('.ite-grid__filter-input');
        inputs.forEach(input => {
            const column = input.getAttribute('data-column');
            const value = state.filters.get(column) || '';
            // Use String() to safely handle any value type
            if (String(value).trim() !== '' && state.filtersEnabled) {
                input.classList.add('ite-grid__filter-input--active');
            } else {
                input.classList.remove('ite-grid__filter-input--active');
            }
        });
    }

    /**
     * Update filter toolbar buttons state (Story 6.2)
     */
    function updateFilterToolbarButtons() {
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');

        if (clearFiltersBtn) {
            clearFiltersBtn.disabled = !state.hasFilters;
        }
        if (toggleFiltersBtn) {
            if (state.filtersEnabled) {
                toggleFiltersBtn.classList.remove('ite-toolbar__button--toggled');
                toggleFiltersBtn.title = 'Disable filters';
            } else {
                toggleFiltersBtn.classList.add('ite-toolbar__button--toggled');
                toggleFiltersBtn.title = 'Enable filters';
            }
        }
    }

    /**
     * Clear all filters (Story 6.2)
     */
    function clearAllFilters() {
        state.filters.clear();
        saveState();

        // Clear all input values
        const inputs = document.querySelectorAll('.ite-grid__filter-input');
        inputs.forEach(input => {
            // @ts-ignore
            input.value = '';
            input.classList.remove('ite-grid__filter-input--active');
        });

        updateFilterToolbarButtons();
        updateFilterBadge();  // Story 6.3
        renderFilterPanelContent();  // Story 6.3: Update panel if open
        state.currentPage = 1;
        requestFilteredData();
        announce('All filters cleared');
    }

    /**
     * Toggle filters on/off (Story 6.2)
     */
    function toggleFilters() {
        state.filtersEnabled = !state.filtersEnabled;
        saveState();

        const filterRow = document.getElementById('filterRow');
        if (filterRow) {
            if (state.filtersEnabled) {
                filterRow.classList.remove('ite-grid__filter-row--disabled');
            } else {
                filterRow.classList.add('ite-grid__filter-row--disabled');
            }
        }

        // Enable/disable inputs
        const inputs = document.querySelectorAll('.ite-grid__filter-input');
        inputs.forEach(input => {
            // @ts-ignore
            input.disabled = !state.filtersEnabled;
        });

        updateFilterInputStyles();
        updateFilterToolbarButtons();
        updateFilterBadge();  // Story 6.3

        // Reload data with or without filters
        state.currentPage = 1;
        requestFilteredData();
        announce(state.filtersEnabled ? 'Filters enabled' : 'Filters disabled');
    }

    /**
     * Request data with current filter and sort criteria (Story 6.2, 6.4)
     * Note: API uses 0-indexed pages, state.currentPage is 1-indexed for UI display
     */
    function requestFilteredData() {
        const filterCriteria = state.filtersEnabled ? state.getFilterCriteria() : [];
        console.debug(`${LOG_PREFIX} requestFilteredData: filters=${JSON.stringify(filterCriteria)}, filtersEnabled=${state.filtersEnabled}`);
        sendCommand('requestData', {
            page: state.currentPage - 1,  // Convert from 1-indexed UI to 0-indexed API
            pageSize: state.pageSize,
            filters: filterCriteria,
            sortColumn: state.sortColumn,
            sortDirection: state.sortDirection
        });
    }

    /**
     * Handle column header click for sorting (Story 6.4)
     * Cycles through: none -> asc -> desc -> none
     * @param {string} columnName - Name of the column to sort by
     */
    function handleColumnSort(columnName) {
        // Determine new sort state
        if (state.sortColumn === columnName) {
            // Same column - cycle through states
            if (state.sortDirection === 'asc') {
                state.sortDirection = 'desc';
            } else if (state.sortDirection === 'desc') {
                // Clear sort
                state.sortColumn = null;
                state.sortDirection = null;
            } else {
                // Was null, now ascending
                state.sortDirection = 'asc';
            }
        } else {
            // Different column - start with ascending
            state.sortColumn = columnName;
            state.sortDirection = 'asc';
        }

        // Reset to page 1 when sort changes (Story 6.4: AC7)
        state.currentPage = 1;
        saveState();

        // Show loading and request new data
        state.loading = true;
        renderLoading();
        requestFilteredData();

        // Announce for accessibility
        if (state.sortColumn) {
            const direction = state.sortDirection === 'asc' ? 'ascending' : 'descending';
            announce(`Sorted by ${state.sortColumn} ${direction}`);
        } else {
            announce('Sort cleared');
        }

        console.log(`${LOG_PREFIX} Sort changed: column=${state.sortColumn}, direction=${state.sortDirection}`);
    }

    /**
     * Toggle filter panel visibility (Story 6.3)
     */
    function toggleFilterPanel() {
        const panel = document.getElementById('filterPanel');
        if (!panel) return;

        const isVisible = panel.style.display !== 'none';
        if (isVisible) {
            panel.style.display = 'none';
            announce('Filter panel closed');
        } else {
            panel.style.display = 'block';
            renderFilterPanelContent();
            announce('Filter panel opened');
        }
    }

    /**
     * Close filter panel (Story 6.3)
     */
    function closeFilterPanel() {
        const panel = document.getElementById('filterPanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    /**
     * Render filter panel content with active filters (Story 6.3)
     */
    function renderFilterPanelContent() {
        const content = document.getElementById('filterPanelContent');
        if (!content) return;

        const filters = state.getFilterCriteria();

        if (filters.length === 0) {
            content.innerHTML = '<p class="ite-filter-panel__empty">No active filters</p>';
            return;
        }

        let html = '';
        filters.forEach(filter => {
            const safeColumn = escapeHtml(filter.column);
            const safeValue = escapeHtml(filter.value);
            html += `
                <div class="ite-filter-chip" data-column="${escapeAttr(filter.column)}">
                    <span class="ite-filter-chip__column">${safeColumn}</span>
                    <span class="ite-filter-chip__value">${safeValue}</span>
                    <button class="ite-filter-chip__remove"
                            title="Remove filter"
                            data-column="${escapeAttr(filter.column)}">
                        <i class="codicon codicon-close"></i>
                    </button>
                </div>
            `;
        });

        content.innerHTML = html;

        // Attach remove handlers
        content.querySelectorAll('.ite-filter-chip__remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const column = btn.getAttribute('data-column');
                if (column) {
                    removeFilterFromPanel(column);
                }
            });
        });
    }

    /**
     * Remove a filter from the panel (Story 6.3)
     * Syncs with inline filter input
     * @param {string} column - Column name to remove filter from
     */
    function removeFilterFromPanel(column) {
        // Remove from state
        state.filters.delete(column);
        saveState();

        // Clear inline input
        const input = document.querySelector(`.ite-grid__filter-input[data-column="${column}"]`);
        if (input) {
            // @ts-ignore
            input.value = '';
            input.classList.remove('ite-grid__filter-input--active');
        }

        // Update UI
        updateFilterInputStyles();
        updateFilterToolbarButtons();
        updateFilterBadge();
        renderFilterPanelContent();

        // Reload data
        state.currentPage = 1;
        requestFilteredData();
        announce(`Filter removed from ${column}`);
    }

    /**
     * Update filter badge count (Story 6.3)
     */
    function updateFilterBadge() {
        const badge = document.getElementById('filterBadge');
        if (!badge) return;

        const filterCount = state.getFilterCriteria().length;
        if (filterCount > 0) {
            badge.textContent = String(filterCount);
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    /**
     * Render grid data rows
     * Story 3.1: Added cell selection support with tabindex and aria-selected
     * Story 4.1: Added new row rendering with visual indicator
     */
    function renderRows() {
        const grid = document.getElementById('dataGrid');
        if (!grid) {
            return;
        }

        // Render server rows
        state.rows.forEach((row, rowIndex) => {
            renderSingleRow(grid, row, rowIndex, false);
        });

        // Story 4.1: Render new rows (pending INSERT)
        state.newRows.forEach((newRow, newRowIdx) => {
            const actualRowIndex = state.rows.length + newRowIdx;
            renderSingleRow(grid, newRow, actualRowIndex, true);
        });
    }

    /**
     * Render a single row (server row or new row)
     * Story 4.1: Extracted row rendering logic
     * Story 5.1: Added row selector column with checkbox
     * @param {HTMLElement} grid - Grid container element
     * @param {Record<string, unknown>} row - Row data
     * @param {number} rowIndex - Actual row index in display
     * @param {boolean} isNew - Whether this is a new (unsaved) row
     */
    function renderSingleRow(grid, row, rowIndex, isNew) {
        const dataRow = document.createElement('div');
        // Story 5.1: Add selected class if this row is selected
        let rowClassName = isNew ? 'ite-grid__row ite-grid__row--new' : 'ite-grid__row';
        if (state.selectedRowIndex === rowIndex) {
            rowClassName += ' ite-grid__row--selected';
        }
        dataRow.className = rowClassName;
        dataRow.setAttribute('role', 'row');
        dataRow.setAttribute('aria-rowindex', String(rowIndex + 2)); // +2 for header row
        // Story 5.1: Add aria-selected for row selection state
        dataRow.setAttribute('aria-selected', state.selectedRowIndex === rowIndex ? 'true' : 'false');

        // Story 5.1: Add row selector cell as first column
        const selectorCell = document.createElement('div');
        selectorCell.className = 'ite-grid__cell ite-grid__cell--selector';
        selectorCell.setAttribute('role', 'gridcell');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'ite-row-selector__checkbox';
        checkbox.checked = state.selectedRowIndex === rowIndex;
        checkbox.setAttribute('aria-label', `Select row ${rowIndex + 1}`);
        checkbox.setAttribute('role', 'checkbox');
        checkbox.setAttribute('aria-checked', state.selectedRowIndex === rowIndex ? 'true' : 'false');
        checkbox.setAttribute('tabindex', '0');

        // Click handler for row selection
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't trigger cell click
            handleRowSelectorClick(rowIndex);
        });

        // Keyboard handler for accessibility
        checkbox.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleRowSelectorClick(rowIndex);
            }
            // Story 5.1: Delete key on row selector triggers delete action
            if (e.key === 'Delete') {
                e.preventDefault();
                e.stopPropagation();
                // First select the row if not already selected
                if (state.selectedRowIndex !== rowIndex) {
                    handleRowSelectorClick(rowIndex);
                }
                // Then trigger delete (will be handled by Story 5.2/5.3)
                handleDeleteRowClick();
            }
        });

        selectorCell.appendChild(checkbox);
        dataRow.appendChild(selectorCell);

        state.columns.forEach((col, colIndex) => {
            const cell = document.createElement('div');
            const formatted = formatCellValue(row[col.name], col.dataType);

            cell.className = `ite-grid__cell ${formatted.cssClass}`.trim();
            cell.setAttribute('role', 'gridcell');
            cell.setAttribute('aria-colindex', String(colIndex + 2)); // +2 because selector is column 1

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

            // Story 7.1: Boolean cells render as checkboxes
            if (formatted.isBoolean) {
                const checkboxEl = createBooleanCheckbox(formatted.boolValue);
                cell.appendChild(checkboxEl);
                cell.title = formatted.boolValue === null ? 'NULL' : (formatted.boolValue ? 'True' : 'False');
            } else {
                // SECURITY: Use textContent instead of innerHTML to prevent XSS
                cell.textContent = formatted.display;
                cell.title = String(row[col.name] ?? 'NULL');
            }

            dataRow.appendChild(cell);
        });

        grid.appendChild(dataRow);
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
     * Format a number with thousands separators (Story 6.5)
     * @param {number} num - Number to format
     * @returns {string} Formatted number string
     */
    function formatNumber(num) {
        return num.toLocaleString();
    }

    /**
     * Create pagination indicator text
     * Story 2.2: Pagination UI
     * Story 6.5: Updated to use thousands separators
     * @returns {string}
     */
    function getPaginationIndicator() {
        if (state.totalRows === 0) return 'No data';
        const start = (state.currentPage - 1) * state.pageSize + 1;
        const end = Math.min(start + state.rows.length - 1, state.totalRows);
        return `Rows ${formatNumber(start)}-${formatNumber(end)} of ${formatNumber(state.totalRows)}`;
    }

    /**
     * Update pagination UI
     * Story 2.2: Pagination controls and indicator with loading state
     * Story 6.5: Enhanced with First/Last buttons and page input
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

        // Story 6.5: Update page input and total label
        const pageInput = document.getElementById('pageInput');
        const pageTotalLabel = document.getElementById('pageTotalLabel');
        if (pageInput && !state.paginationLoading) {
            // Only update if not focused (to avoid overwriting user input)
            if (document.activeElement !== pageInput) {
                pageInput.value = String(state.currentPage);
            }
            pageInput.disabled = state.paginationLoading;
        }
        if (pageTotalLabel) {
            pageTotalLabel.textContent = `of ${formatNumber(state.totalPages)}`;
        }

        // Update button states
        const firstBtn = document.getElementById('firstPageBtn');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const lastBtn = document.getElementById('lastPageBtn');

        // Story 6.5: First and Prev disabled on page 1
        if (firstBtn) {
            firstBtn.disabled = !state.canGoPrev || state.paginationLoading;
            firstBtn.setAttribute('aria-disabled', String(!state.canGoPrev || state.paginationLoading));
        }

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

        // Story 6.5: Next and Last disabled on last page
        if (lastBtn) {
            lastBtn.disabled = !state.canGoNext || state.paginationLoading;
            lastBtn.setAttribute('aria-disabled', String(!state.canGoNext || state.paginationLoading));
        }
    }

    /**
     * Handle paginate next
     * Story 2.2: Pagination navigation
     * Story 5.3: Clear row selection and close delete dialog on pagination
     */
    function handlePaginateNext() {
        if (!state.canGoNext || state.paginationLoading) return;

        console.debug(`${LOG_PREFIX} Paginate next from page ${state.currentPage}`);

        // Story 5.3: Clear row selection - indices will be stale after pagination
        clearRowSelection();
        // Story 5.3: Close delete dialog if open
        if (isDeleteDialogOpen) {
            hideDeleteConfirmDialog();
        }

        state.paginationLoading = true;
        updatePaginationUI();

        // Story 6.2: Include filter criteria in pagination
        // Story 6.4: Include sort parameters in pagination
        const filterCriteria = state.filtersEnabled ? state.getFilterCriteria() : [];
        sendCommand('paginateNext', {
            direction: 'next',
            currentPage: state.currentPage,
            pageSize: state.pageSize,
            filters: filterCriteria,
            sortColumn: state.sortColumn,
            sortDirection: state.sortDirection
        });

        announce(`Loading page ${state.currentPage + 1} of ${state.totalPages}`);
    }

    /**
     * Handle paginate previous
     * Story 2.2: Pagination navigation
     * Story 5.3: Clear row selection and close delete dialog on pagination
     */
    function handlePaginatePrev() {
        if (!state.canGoPrev || state.paginationLoading) return;

        console.debug(`${LOG_PREFIX} Paginate prev from page ${state.currentPage}`);

        // Story 5.3: Clear row selection - indices will be stale after pagination
        clearRowSelection();
        // Story 5.3: Close delete dialog if open
        if (isDeleteDialogOpen) {
            hideDeleteConfirmDialog();
        }

        state.paginationLoading = true;
        updatePaginationUI();

        // Story 6.2: Include filter criteria in pagination
        // Story 6.4: Include sort parameters in pagination
        const filterCriteria = state.filtersEnabled ? state.getFilterCriteria() : [];
        sendCommand('paginatePrev', {
            direction: 'prev',
            currentPage: state.currentPage,
            pageSize: state.pageSize,
            filters: filterCriteria,
            sortColumn: state.sortColumn,
            sortDirection: state.sortDirection
        });

        announce(`Loading page ${state.currentPage - 1} of ${state.totalPages}`);
    }

    /**
     * Handle first page navigation (Story 6.5)
     */
    function handleFirstPage() {
        if (!state.canGoPrev || state.paginationLoading) return;

        console.debug(`${LOG_PREFIX} Navigate to first page from page ${state.currentPage}`);

        clearRowSelection();
        if (isDeleteDialogOpen) {
            hideDeleteConfirmDialog();
        }

        // Navigate to page 1
        state.currentPage = 1;
        state.paginationLoading = true;
        saveState();
        updatePaginationUI();

        const filterCriteria = state.filtersEnabled ? state.getFilterCriteria() : [];
        sendCommand('requestData', {
            page: 0,  // First page is 0-indexed in API
            pageSize: state.pageSize,
            filters: filterCriteria,
            sortColumn: state.sortColumn,
            sortDirection: state.sortDirection
        });

        announce('Loading first page');
    }

    /**
     * Handle last page navigation (Story 6.5)
     */
    function handleLastPage() {
        if (!state.canGoNext || state.paginationLoading) return;

        console.debug(`${LOG_PREFIX} Navigate to last page from page ${state.currentPage}`);

        clearRowSelection();
        if (isDeleteDialogOpen) {
            hideDeleteConfirmDialog();
        }

        // Navigate to last page
        state.currentPage = state.totalPages;
        state.paginationLoading = true;
        saveState();
        updatePaginationUI();

        const filterCriteria = state.filtersEnabled ? state.getFilterCriteria() : [];
        sendCommand('requestData', {
            page: state.totalPages - 1,  // Convert from 1-indexed UI to 0-indexed API
            pageSize: state.pageSize,
            filters: filterCriteria,
            sortColumn: state.sortColumn,
            sortDirection: state.sortDirection
        });

        announce(`Loading last page (${state.totalPages})`);
    }

    /**
     * Handle direct page number input (Story 6.5)
     * @param {string} inputValue - Value from the page input field
     */
    function handleGoToPage(inputValue) {
        const pageInput = document.getElementById('pageInput');
        const pageNum = parseInt(inputValue, 10);

        // Validate input
        if (isNaN(pageNum) || pageNum < 1 || pageNum > state.totalPages) {
            console.debug(`${LOG_PREFIX} Invalid page number: ${inputValue}`);
            // Show error state briefly
            if (pageInput) {
                pageInput.classList.add('ite-pagination__page-input--error');
                setTimeout(() => {
                    pageInput.classList.remove('ite-pagination__page-input--error');
                    pageInput.value = String(state.currentPage);
                }, 500);
            }
            announce('Invalid page number');
            return;
        }

        // If same page, just reset the input
        if (pageNum === state.currentPage) {
            if (pageInput) {
                pageInput.value = String(state.currentPage);
            }
            return;
        }

        console.debug(`${LOG_PREFIX} Navigate to page ${pageNum} from page ${state.currentPage}`);

        clearRowSelection();
        if (isDeleteDialogOpen) {
            hideDeleteConfirmDialog();
        }

        // Navigate to requested page
        state.currentPage = pageNum;
        state.paginationLoading = true;
        saveState();
        updatePaginationUI();

        const filterCriteria = state.filtersEnabled ? state.getFilterCriteria() : [];
        sendCommand('requestData', {
            page: pageNum - 1,  // Convert from 1-indexed UI to 0-indexed API
            pageSize: state.pageSize,
            filters: filterCriteria,
            sortColumn: state.sortColumn,
            sortDirection: state.sortDirection
        });

        announce(`Loading page ${pageNum} of ${state.totalPages}`);
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
     * Update grid column widths based on state.columnWidth
     * Called when slider changes or grid renders
     */
    function updateGridColumns() {
        const grid = document.getElementById('dataGrid');
        if (!grid || state.columns.length === 0) return;

        // Selector column (36px) + data columns with min width from slider
        const gridColumns = `36px repeat(${state.columns.length}, minmax(${state.columnWidth}px, 1fr))`;
        grid.style.gridTemplateColumns = gridColumns;
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
     * Story 4.1: Handle new rows in render logic
     */
    function renderGrid() {
        clearGrid();

        if (state.columns.length === 0) {
            return;
        }

        // Set up CSS Grid columns using current columnWidth setting
        updateGridColumns();

        renderHeader();

        // Story 2.2: Handle empty table edge case
        // Story 4.1: Also show rows if we have new rows pending
        if (state.rows.length === 0 && state.newRows.length === 0) {
            renderEmptyState();
            // Story 3.1: Clear selection when no rows
            state.selectedCell = { rowIndex: null, colIndex: null };
        } else {
            renderRows();

            // Story 3.1: Validate and restore selection after render
            // Story 4.1: Include new rows in bounds check
            // If selection is out of bounds (e.g., after refresh), clear it
            if (state.selectedCell.rowIndex !== null && state.selectedCell.colIndex !== null) {
                if (state.selectedCell.rowIndex >= state.totalDisplayRows ||
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
        // Filter out any columns with empty/invalid names
        const validColumns = payload.columns.filter(col => col.name && col.name.trim());
        console.debug(`${LOG_PREFIX} Received schema:`, validColumns.length, 'columns', validColumns.map(c => c.name));
        state.columns = validColumns;
        state.context = {
            serverName: payload.serverName,
            namespace: payload.namespace,
            tableName: payload.tableName
        };
        // Clear any stale newRows from previous session - they won't match new schema
        state.newRows = [];
        saveState(); // Persist immediately after schema update
    }

    /**
     * Handle tableData event
     * Story 2.2: Updated to use 1-indexed currentPage and clear pagination loading
     * Story 3.1: Clear selection on page change to avoid stale indices
     * Story 5.1: Clear row selection on page change
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
        // Story 5.1: Clear row selection on page change - row indices change
        state.selectedRowIndex = null;

        renderGrid();
        updatePaginationUI();
        // Story 5.1: Update delete button state after clearing selection
        updateDeleteButtonState();
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
     * Story 5.1: Clear row selection immediately on refresh
     */
    function handleRefresh() {
        console.debug(`${LOG_PREFIX} Refresh clicked`);
        // Story 5.1: Clear row selection immediately (don't wait for data)
        clearRowSelection();
        // Story 6.2: Include filter criteria in refresh
        // Story 6.4: Include sort parameters in refresh
        const filterCriteria = state.filtersEnabled ? state.getFilterCriteria() : [];
        sendCommand('refresh', {
            filters: filterCriteria,
            sortColumn: state.sortColumn,
            sortDirection: state.sortDirection
        });
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
            case 'saveCellResult':
                // Story 3.3: Handle cell save result
                handleSaveCellResult(message.payload);
                break;
            case 'insertRowResult':
                // Story 4.3: Handle insert row result
                handleInsertRowResult(message.payload);
                break;
            case 'deleteRowResult':
                // Story 5.3: Handle delete row result
                handleDeleteRowResult(message.payload);
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
            // Story 4.1: Ensure newRows is properly initialized
            if (!state.newRows) {
                state.newRows = [];
            }
            // Story 5.1: Ensure selectedRowIndex is properly initialized
            if (state.selectedRowIndex === undefined) {
                state.selectedRowIndex = null;
            }
            // Story 6.2: Ensure filter state is properly initialized
            if (!state.filters || !(state.filters instanceof Map)) {
                state.filters = new Map();
            }
            if (state.filtersEnabled === undefined) {
                state.filtersEnabled = true;
            }
            if (state.columns.length > 0) {
                renderGrid();
                // Story 5.1: Update delete button state on restore
                updateDeleteButtonState();
                // Story 6.2: Update filter toolbar buttons on restore
                updateFilterToolbarButtons();
                // Story 6.3: Update filter badge on restore
                updateFilterBadge();
            }
        }

        // Listen for messages from extension
        window.addEventListener('message', handleMessage);

        // Setup refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', handleRefresh);
        }

        // Story 4.1: Setup add row button
        const addRowBtn = document.getElementById('addRowBtn');
        if (addRowBtn) {
            addRowBtn.addEventListener('click', handleAddRow);
        }

        // Story 4.3: Setup save row button
        const saveRowBtn = document.getElementById('saveRowBtn');
        if (saveRowBtn) {
            saveRowBtn.addEventListener('click', handleSaveRow);
        }

        // Story 5.1: Setup delete row button
        const deleteRowBtn = document.getElementById('deleteRowBtn');
        if (deleteRowBtn) {
            deleteRowBtn.addEventListener('click', handleDeleteRowClick);
        }

        // Story 6.2: Setup filter buttons
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', clearAllFilters);
        }

        const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
        if (toggleFiltersBtn) {
            toggleFiltersBtn.addEventListener('click', toggleFilters);
        }

        // Story 6.3: Setup filter panel buttons
        const filterPanelBtn = document.getElementById('filterPanelBtn');
        if (filterPanelBtn) {
            filterPanelBtn.addEventListener('click', toggleFilterPanel);
        }

        const filterPanelClose = document.getElementById('filterPanelClose');
        if (filterPanelClose) {
            filterPanelClose.addEventListener('click', closeFilterPanel);
        }

        // Column width slider
        const columnWidthSlider = document.getElementById('columnWidthSlider');
        if (columnWidthSlider) {
            // Initialize slider value from state
            columnWidthSlider.value = String(state.columnWidth);
            columnWidthSlider.addEventListener('input', (e) => {
                // @ts-ignore
                state.columnWidth = parseInt(e.target.value, 10);
                updateGridColumns();
            });
        }

        // Close filter panel when clicking outside
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('filterPanel');
            const panelBtn = document.getElementById('filterPanelBtn');
            if (panel && panel.style.display !== 'none') {
                // @ts-ignore
                if (!panel.contains(e.target) && !panelBtn?.contains(e.target)) {
                    closeFilterPanel();
                }
            }
        });

        // Story 5.2: Setup delete confirmation dialog
        setupDeleteDialog();

        // Story 2.2: Setup pagination buttons
        // Story 6.5: Added First/Last buttons and page input
        const firstPageBtn = document.getElementById('firstPageBtn');
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        const lastPageBtn = document.getElementById('lastPageBtn');
        const pageInput = document.getElementById('pageInput');

        if (firstPageBtn) {
            firstPageBtn.addEventListener('click', handleFirstPage);
        }
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', handlePaginatePrev);
        }
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', handlePaginateNext);
        }
        if (lastPageBtn) {
            lastPageBtn.addEventListener('click', handleLastPage);
        }
        if (pageInput) {
            // Handle Enter key
            pageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGoToPage(pageInput.value);
                }
            });
            // Handle blur (leaving the input)
            pageInput.addEventListener('blur', () => {
                handleGoToPage(pageInput.value);
            });
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
            // Story 7.1: Context menu for boolean cells (right-click)
            grid.addEventListener('contextmenu', handleCellContextMenu);
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
     * Handle keyboard navigation for pagination and global shortcuts
     * Story 2.2: Keyboard shortcuts (Ctrl+PageDown/PageUp or Alt+Right/Left)
     * Story 4.1: Added Ctrl+N / Cmd+N for new row
     * Story 4.3: Added Ctrl+S / Cmd+S for save row, Escape for cancel new row
     * @param {KeyboardEvent} event
     */
    function handleKeyboardNavigation(event) {
        // Ignore if event originated from an input/textarea (e.g., filter inputs, page input)
        const target = event.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            return;
        }

        // Story 4.1: Ctrl+N (or Cmd+N on Mac) for new row
        if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
            event.preventDefault();
            handleAddRow();
            return;
        }

        // Story 8.3: Ctrl+Shift+= (Ctrl+Plus) for new row - alias for Ctrl+N
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === '=' || event.key === '+')) {
            event.preventDefault();
            handleAddRow();
            return;
        }

        // Story 8.3: Ctrl+- (Ctrl+Minus) to delete current row
        if ((event.ctrlKey || event.metaKey) && event.key === '-') {
            event.preventDefault();
            const rowIndex = state.selectedCell.rowIndex;
            if (rowIndex !== null && !isNewRow(rowIndex)) {
                // Select the row for deletion, then trigger delete dialog
                state.selectedRowIndex = rowIndex;
                updateDeleteButtonState();
                handleDeleteRowClick();
            } else if (rowIndex !== null && isNewRow(rowIndex)) {
                // For new rows, just discard them
                handleCancelNewRow();
            }
            return;
        }

        // Story 8.3: Ctrl+D to duplicate current row
        if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
            event.preventDefault();
            handleDuplicateRow();
            return;
        }

        // Story 4.3: Ctrl+S (or Cmd+S on Mac) for save row
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            // Only save if there's a new row selected
            if (state.selectedCell.rowIndex !== null && isNewRow(state.selectedCell.rowIndex)) {
                handleSaveRow();
            }
            return;
        }

        // Story 4.3: Escape to discard new row (when not in edit mode)
        if (event.key === 'Escape' && !state.isEditing) {
            if (state.selectedCell.rowIndex !== null && isNewRow(state.selectedCell.rowIndex)) {
                event.preventDefault();
                handleCancelNewRow();
                return;
            }
        }

        // Story 8.4: Ctrl+R or F5 for refresh
        if (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && event.key === 'r')) {
            event.preventDefault();
            handleRefresh();
            return;
        }

        // Story 8.4: Ctrl+Shift+F to clear all filters
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
            event.preventDefault();
            clearAllFilters();
            announce('All filters cleared');
            return;
        }

        // Story 8.4: Ctrl+F to focus filter input for current column
        if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
            event.preventDefault();
            if (state.selectedCell.colIndex !== null) {
                focusColumnFilter(state.selectedCell.colIndex);
            }
            return;
        }

        // Story 8.4: Ctrl+G for "Go to Row" dialog
        if ((event.ctrlKey || event.metaKey) && event.key === 'g') {
            event.preventDefault();
            showGoToRowDialog();
            return;
        }

        // Story 8.5: ? (Shift+/) or F1 for keyboard shortcuts help
        if (event.key === 'F1' || (event.shiftKey && event.key === '?')) {
            event.preventDefault();
            showKeyboardShortcutsHelp();
            return;
        }

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
