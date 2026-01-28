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
     * Format cell value based on data type
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

        // Number types - return raw value (will be set via textContent, not innerHTML)
        if (['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'NUMERIC', 'DECIMAL', 'FLOAT', 'DOUBLE', 'REAL'].some(t => upperType.includes(t))) {
            return { display: String(value), cssClass: 'ite-grid__cell--number', isNull: false };
        }

        // Date/time types
        if (['DATE', 'TIME', 'TIMESTAMP', 'DATETIME'].some(t => upperType.includes(t))) {
            return { display: String(value), cssClass: 'ite-grid__cell--date', isNull: false };
        }

        // Default - text (no escaping needed as we use textContent)
        return { display: String(value), cssClass: '', isNull: false };
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
        emptyCell.setAttribute('colspan', String(state.columns.length));
        emptyCell.textContent = 'No data in table';

        emptyRow.appendChild(emptyCell);
        grid.appendChild(emptyRow);
    }

    /**
     * Render the full grid
     * Story 2.2: Added pagination UI update and empty state handling
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
        } else {
            renderRows();
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
     */
    function init() {
        console.debug(`${LOG_PREFIX} Initializing grid`);

        // Restore state if available
        const previousState = vscode.getState();
        if (previousState) {
            state = Object.assign(new AppState(), previousState);
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

        // Story 2.2: Setup keyboard shortcuts for pagination
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
