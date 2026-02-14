/**
 * IRIS Table Editor - Web Theme Toggle
 * Story 17.3: Theme initialization, toggle, and persistence.
 *
 * Reads from localStorage, falls back to prefers-color-scheme,
 * sets data-theme attribute on <html>, and manages toggle icon.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'ite-theme-preference';

    // Sun icon (shown in dark mode, click to switch to light)
    var SUN_ICON = '\u2600\uFE0F';
    // Moon icon (shown in light mode, click to switch to dark)
    var MOON_ICON = '\uD83C\uDF19';

    /**
     * Get the OS preferred color scheme.
     * @returns {'light'|'dark'}
     */
    function getOsTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    /**
     * Get the stored theme preference, or null if none.
     * @returns {string|null}
     */
    function getStoredTheme() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'light' || stored === 'dark') {
                return stored;
            }
        } catch (e) {
            // localStorage unavailable
        }
        return null;
    }

    /**
     * Get the current effective theme.
     * @returns {'light'|'dark'}
     */
    function getTheme() {
        return getStoredTheme() || getOsTheme();
    }

    /**
     * Apply a theme by setting data-theme on <html>.
     * @param {'light'|'dark'} theme
     */
    function applyTheme(theme) {
        // Always set data-theme to prevent the @media (prefers-color-scheme: dark)
        // fallback from activating when the user explicitly chose light mode.
        // The media query only applies when data-theme is absent (first visit, no preference).
        document.documentElement.setAttribute('data-theme', theme);
        updateToggleIcon(theme);
    }

    /**
     * Update the toggle button icon to reflect the current theme.
     * @param {'light'|'dark'} theme
     */
    function updateToggleIcon(theme) {
        var iconEl = document.getElementById('themeToggleIcon');
        if (iconEl) {
            // Show moon in light mode (click to go dark), sun in dark mode (click to go light)
            iconEl.textContent = theme === 'dark' ? SUN_ICON : MOON_ICON;
        }
        var toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-label',
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
            toggleBtn.setAttribute('title',
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        }
    }

    /**
     * Set a theme explicitly and save to localStorage.
     * @param {'light'|'dark'} theme
     */
    function setTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            // localStorage unavailable
        }
        applyTheme(theme);
    }

    /**
     * Toggle between light and dark themes.
     */
    function toggle() {
        var current = getTheme();
        var next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);
    }

    // Initialize theme on load
    var initialTheme = getTheme();
    applyTheme(initialTheme);

    // Bind toggle button when DOM is ready
    function bindToggle() {
        var toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                toggle();
            });
        }
        // Update icon now that DOM is available
        updateToggleIcon(getTheme());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindToggle);
    } else {
        bindToggle();
    }

    // Listen for OS theme changes (Task 3.4)
    if (window.matchMedia) {
        var mql = window.matchMedia('(prefers-color-scheme: dark)');
        var handler = function () {
            // Only apply OS theme if no user preference is set
            if (!getStoredTheme()) {
                var osTheme = getOsTheme();
                applyTheme(osTheme);
            }
        };
        if (mql.addEventListener) {
            mql.addEventListener('change', handler);
        }
    }

    // Expose for testing (Task 3.5)
    window.iteTheme = {
        toggle: toggle,
        getTheme: getTheme,
        setTheme: setTheme
    };
})();
