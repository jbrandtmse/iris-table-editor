/**
 * IRIS Table Editor - Sidebar Drag-to-Resize + State Restoration
 * Story 11.5: Window State Persistence
 *
 * Handles:
 * 1. Drag-to-resize of the sidebar via the resize handle
 * 2. Restoration of sidebar state (width, visibility) from the main process
 *
 * Uses IMessageBridge pattern, BEM CSS conventions.
 */
(function () {
    'use strict';

    var LOG_PREFIX = '[IRIS-TE SidebarResize]';
    var MIN_WIDTH = 200;
    var MAX_WIDTH = 400;

    var messageBridge = window.iteMessageBridge;
    if (!messageBridge) {
        console.error(LOG_PREFIX, 'Message bridge not initialized — sidebar resize disabled');
        return;
    }

    var sidebar = document.querySelector('.ite-app-shell__sidebar');
    var resizeHandle = document.getElementById('sidebarResizeHandle');

    if (!sidebar || !resizeHandle) {
        console.warn(LOG_PREFIX, 'Sidebar or resize handle not found');
        return;
    }

    // ============================================
    // Drag-to-resize
    // ============================================

    var isDragging = false;
    var startX = 0;
    var startWidth = 0;

    function onMouseDown(e) {
        // Only respond to left mouse button
        if (e.button !== 0) {
            return;
        }

        isDragging = true;
        startX = e.clientX;
        startWidth = sidebar.getBoundingClientRect().width;

        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        e.preventDefault();
    }

    function onMouseMove(e) {
        if (!isDragging) {
            return;
        }

        var delta = e.clientX - startX;
        var newWidth = Math.round(startWidth + delta);

        // Clamp to min/max
        newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));

        sidebar.style.width = newWidth + 'px';
    }

    function onMouseUp() {
        if (!isDragging) {
            return;
        }

        isDragging = false;

        // Restore user-select and cursor
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        // Send sidebar state to main process for persistence
        var currentWidth = Math.round(sidebar.getBoundingClientRect().width);
        var isVisible = window.getComputedStyle(sidebar).display !== 'none';

        messageBridge.sendCommand('sidebarStateChanged', {
            width: currentWidth,
            isVisible: isVisible,
        });

        console.log(LOG_PREFIX, 'Sidebar resized to', currentWidth + 'px');
    }

    resizeHandle.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // ============================================
    // State Restoration (restoreAppState event)
    // ============================================

    function handleRestoreAppState(payload) {
        if (!payload || !payload.sidebar) {
            return;
        }

        var sidebarState = payload.sidebar;

        // Restore sidebar width
        if (typeof sidebarState.width === 'number') {
            var width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, sidebarState.width));
            sidebar.style.width = width + 'px';
            console.log(LOG_PREFIX, 'Restored sidebar width:', width + 'px');
        }

        // Restore sidebar visibility
        if (typeof sidebarState.isVisible === 'boolean') {
            sidebar.style.display = sidebarState.isVisible ? '' : 'none';
            // Also update resize handle visibility to match
            resizeHandle.style.display = sidebarState.isVisible ? '' : 'none';
            console.log(LOG_PREFIX, 'Restored sidebar visibility:', sidebarState.isVisible);
        }
    }

    messageBridge.onEvent('restoreAppState', handleRestoreAppState);

    console.debug(LOG_PREFIX, 'Sidebar resize handler initialized');
})();
