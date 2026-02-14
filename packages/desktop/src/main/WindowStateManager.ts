/**
 * WindowStateManager - Window state persistence service
 * Story 11.5: Window State Persistence
 *
 * Manages persistence of window bounds, sidebar state, and theme preference.
 * Uses plain Node.js file I/O (same pattern as ConnectionManager).
 * Stores data in {userData}/window-state.json with mode 0o644 (no sensitive data).
 */
import * as fs from 'fs';
import * as path from 'path';

const LOG_PREFIX = '[IRIS-TE]';
const STATE_FILENAME = 'window-state.json';

// ============================================
// Interfaces
// ============================================

/**
 * Window position and size state.
 */
export interface WindowState {
    /** Window x position (undefined = let OS decide) */
    x?: number;
    /** Window y position (undefined = let OS decide) */
    y?: number;
    /** Window width in pixels */
    width: number;
    /** Window height in pixels */
    height: number;
    /** Whether the window was maximized */
    isMaximized: boolean;
}

/**
 * Sidebar panel state.
 */
export interface SidebarState {
    /** Sidebar width in pixels */
    width: number;
    /** Whether sidebar is visible */
    isVisible: boolean;
}

/**
 * Full application persistent state.
 */
export interface AppPersistentState {
    /** Window bounds and maximized state */
    window: WindowState;
    /** Sidebar width and visibility */
    sidebar: SidebarState;
    /** Theme preference */
    theme: 'light' | 'dark' | 'system';
}

// ============================================
// Defaults
// ============================================

/** Default window state (matches Story 11.1 hardcoded values) */
const DEFAULT_WINDOW_STATE: WindowState = {
    width: 1200,
    height: 800,
    isMaximized: false,
};

/** Default sidebar state (matches Story 11.3 CSS) */
const DEFAULT_SIDEBAR_STATE: SidebarState = {
    width: 280,
    isVisible: true,
};

/** Default application state */
const DEFAULT_STATE: AppPersistentState = {
    window: { ...DEFAULT_WINDOW_STATE },
    sidebar: { ...DEFAULT_SIDEBAR_STATE },
    theme: 'system',
};

// ============================================
// Validation constants
// ============================================

const MIN_WINDOW_WIDTH = 400;
const MIN_WINDOW_HEIGHT = 300;
const MAX_WINDOW_WIDTH = 10000;
const MAX_WINDOW_HEIGHT = 10000;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const VALID_THEMES = new Set(['light', 'dark', 'system']);

// ============================================
// WindowStateManager
// ============================================

/**
 * Manages persistence of window state to a JSON file.
 * Follows the same fs-based pattern as ConnectionManager.
 */
export class WindowStateManager {
    private readonly statePath: string;

    /**
     * @param configDir - Directory where the state file is stored
     *                     (same as ConnectionManager: app.getPath('userData'))
     */
    constructor(configDir: string) {
        this.statePath = path.join(configDir, STATE_FILENAME);
    }

    /**
     * Load the persisted application state from disk.
     * Returns default state if the file is missing, corrupted, or contains invalid data.
     */
    load(): AppPersistentState {
        try {
            if (!fs.existsSync(this.statePath)) {
                console.log(`${LOG_PREFIX} No window state file found, using defaults`);
                return this.getDefaults();
            }

            const data = fs.readFileSync(this.statePath, 'utf-8');
            const parsed = JSON.parse(data);

            if (!parsed || typeof parsed !== 'object') {
                console.warn(`${LOG_PREFIX} Invalid window state format, using defaults`);
                return this.getDefaults();
            }

            return this.validate(parsed);
        } catch (error) {
            console.warn(`${LOG_PREFIX} Failed to load window state from ${this.statePath}: ${error}`);
            return this.getDefaults();
        }
    }

    /**
     * Save the application state to disk.
     * Creates the config directory if it does not exist.
     * Uses mode 0o644 since window state contains no sensitive data.
     */
    save(state: AppPersistentState): void {
        try {
            const dir = path.dirname(this.statePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), {
                encoding: 'utf-8',
                mode: 0o644,
            });
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to save window state to ${this.statePath}: ${error}`);
        }
    }

    /**
     * Get the path to the state file (for testing).
     */
    getStatePath(): string {
        return this.statePath;
    }

    /**
     * Get a fresh copy of the default state.
     */
    getDefaults(): AppPersistentState {
        return {
            window: { ...DEFAULT_WINDOW_STATE },
            sidebar: { ...DEFAULT_SIDEBAR_STATE },
            theme: 'system',
        };
    }

    /**
     * Validate and sanitize loaded state, filling in defaults for missing/invalid values.
     */
    private validate(raw: Record<string, unknown>): AppPersistentState {
        const state = this.getDefaults();

        // Validate window state
        if (raw.window && typeof raw.window === 'object') {
            const w = raw.window as Record<string, unknown>;

            if (typeof w.width === 'number' && w.width >= MIN_WINDOW_WIDTH && w.width <= MAX_WINDOW_WIDTH) {
                state.window.width = Math.round(w.width);
            }

            if (typeof w.height === 'number' && w.height >= MIN_WINDOW_HEIGHT && w.height <= MAX_WINDOW_HEIGHT) {
                state.window.height = Math.round(w.height);
            }

            if (typeof w.x === 'number' && isFinite(w.x)) {
                state.window.x = Math.round(w.x);
            }

            if (typeof w.y === 'number' && isFinite(w.y)) {
                state.window.y = Math.round(w.y);
            }

            if (typeof w.isMaximized === 'boolean') {
                state.window.isMaximized = w.isMaximized;
            }
        }

        // Validate sidebar state
        if (raw.sidebar && typeof raw.sidebar === 'object') {
            const s = raw.sidebar as Record<string, unknown>;

            if (typeof s.width === 'number' && s.width >= MIN_SIDEBAR_WIDTH && s.width <= MAX_SIDEBAR_WIDTH) {
                state.sidebar.width = Math.round(s.width);
            }

            if (typeof s.isVisible === 'boolean') {
                state.sidebar.isVisible = s.isVisible;
            }
        }

        // Validate theme
        if (typeof raw.theme === 'string' && VALID_THEMES.has(raw.theme)) {
            state.theme = raw.theme as 'light' | 'dark' | 'system';
        }

        return state;
    }
}

// ============================================
// Off-screen detection (exported for testability)
// ============================================

/**
 * Display bounds descriptor (mirrors Electron's Display.bounds).
 * Extracted as an interface so the function can be tested without Electron.
 */
export interface DisplayBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Check if a window's center point is visible on any of the given displays.
 * Used to detect if a saved window position is off-screen (e.g., monitor disconnected).
 *
 * @param x - Window x position
 * @param y - Window y position
 * @param width - Window width
 * @param height - Window height
 * @param displays - Array of display bounds to check against
 * @returns true if the window center is on at least one display
 */
export function isOnScreen(
    x: number,
    y: number,
    width: number,
    height: number,
    displays: DisplayBounds[]
): boolean {
    if (displays.length === 0) {
        return false;
    }

    const centerX = x + width / 2;
    const centerY = y + height / 2;

    return displays.some(display => {
        const { x: dx, y: dy, width: dw, height: dh } = display;
        return centerX >= dx && centerX < dx + dw && centerY >= dy && centerY < dy + dh;
    });
}

// ============================================
// Debounce utility (exported for testability)
// ============================================

/**
 * Create a debounced version of a function.
 * The function will only be called after `delay` ms have elapsed since the last invocation.
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Object with `call()` to invoke and `cancel()` to clear pending timeout
 */
export function createDebouncedSave(
    fn: () => void,
    delay: number
): { call: () => void; cancel: () => void } {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return {
        call(): void {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                timeout = null;
                fn();
            }, delay);
        },
        cancel(): void {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
        },
    };
}
