/**
 * MenuBuilder - Native application menu for the Electron desktop app
 * Story 11.4: Native Menu
 *
 * Builds the application menu with File, Edit, View, Help menus.
 * Provides dynamic state updates for enable/disable of menu items.
 *
 * Menu items with custom actions communicate via callbacks to the main process,
 * which then sends menuAction events to the renderer via IPC.
 */
import { Menu, BrowserWindow } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

const LOG_PREFIX = '[IRIS-TE Menu]';

// ============================================
// Types
// ============================================

/**
 * Callbacks interface for custom menu actions.
 * Each callback is invoked when the corresponding menu item is clicked.
 */
export interface MenuCallbacks {
    onNewConnection: () => void;
    onDisconnect: () => void;
    onCloseTab: () => void;
    onCloseAllTabs: () => void;
    onSetNull: () => void;
    onToggleSidebar: () => void;
    onToggleFilterPanel: () => void;
    onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
    onShowShortcuts: () => void;
    onShowAbout: () => void;
}

/**
 * State used to enable/disable dynamic menu items and check radio buttons.
 */
export interface MenuState {
    isConnected: boolean;
    hasOpenTabs: boolean;
    themeSource: 'light' | 'dark' | 'system';
}

// ============================================
// Menu Builder
// ============================================

/**
 * Build the application menu from template.
 *
 * @param _win - The target BrowserWindow (reserved for future use)
 * @param callbacks - Handlers for custom menu actions
 * @returns The built Menu instance
 */
export function buildApplicationMenu(
    _win: BrowserWindow,
    callbacks: MenuCallbacks
): Menu {
    const template: MenuItemConstructorOptions[] = [
        // ---- File Menu ----
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Connection',
                    click: () => {
                        console.log(`${LOG_PREFIX} New Connection`);
                        callbacks.onNewConnection();
                    },
                },
                {
                    id: 'disconnect',
                    label: 'Disconnect',
                    enabled: false,
                    click: () => {
                        console.log(`${LOG_PREFIX} Disconnect`);
                        callbacks.onDisconnect();
                    },
                },
                { type: 'separator' },
                {
                    id: 'closeTab',
                    label: 'Close Tab',
                    accelerator: 'CommandOrControl+W',
                    registerAccelerator: false,
                    enabled: false,
                    click: () => {
                        console.log(`${LOG_PREFIX} Close Tab`);
                        callbacks.onCloseTab();
                    },
                },
                {
                    id: 'closeAllTabs',
                    label: 'Close All Tabs',
                    accelerator: 'CommandOrControl+Shift+W',
                    enabled: false,
                    click: () => {
                        console.log(`${LOG_PREFIX} Close All Tabs`);
                        callbacks.onCloseAllTabs();
                    },
                },
                { type: 'separator' },
                { label: 'Exit', role: 'quit' },
            ],
        },

        // ---- Edit Menu ----
        {
            label: 'Edit',
            submenu: [
                { label: 'Undo', role: 'undo' },
                { type: 'separator' },
                { label: 'Copy', role: 'copy' },
                { label: 'Paste', role: 'paste' },
                { type: 'separator' },
                {
                    label: 'Set NULL',
                    accelerator: 'CommandOrControl+Shift+N',
                    click: () => {
                        console.log(`${LOG_PREFIX} Set NULL`);
                        callbacks.onSetNull();
                    },
                },
            ],
        },

        // ---- View Menu ----
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Sidebar',
                    accelerator: 'CommandOrControl+B',
                    click: () => {
                        console.log(`${LOG_PREFIX} Toggle Sidebar`);
                        callbacks.onToggleSidebar();
                    },
                },
                {
                    label: 'Toggle Filter Panel',
                    click: () => {
                        console.log(`${LOG_PREFIX} Toggle Filter Panel`);
                        callbacks.onToggleFilterPanel();
                    },
                },
                { type: 'separator' },
                {
                    id: 'themeLight',
                    label: 'Light Theme',
                    type: 'radio',
                    checked: false,
                    click: () => {
                        console.log(`${LOG_PREFIX} Theme: light`);
                        callbacks.onSetTheme('light');
                    },
                },
                {
                    id: 'themeDark',
                    label: 'Dark Theme',
                    type: 'radio',
                    checked: false,
                    click: () => {
                        console.log(`${LOG_PREFIX} Theme: dark`);
                        callbacks.onSetTheme('dark');
                    },
                },
                {
                    id: 'themeSystem',
                    label: 'System Theme',
                    type: 'radio',
                    checked: true,
                    click: () => {
                        console.log(`${LOG_PREFIX} Theme: system`);
                        callbacks.onSetTheme('system');
                    },
                },
                { type: 'separator' },
                {
                    label: 'Keyboard Shortcuts',
                    accelerator: 'CommandOrControl+/',
                    click: () => {
                        console.log(`${LOG_PREFIX} Keyboard Shortcuts`);
                        callbacks.onShowShortcuts();
                    },
                },
            ],
        },

        // ---- Help Menu ----
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Keyboard Shortcuts',
                    click: () => {
                        callbacks.onShowShortcuts();
                    },
                },
                {
                    label: 'About IRIS Table Editor',
                    click: () => {
                        callbacks.onShowAbout();
                    },
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    console.log(`${LOG_PREFIX} Application menu built`);
    return menu;
}

// ============================================
// Dynamic State Updates
// ============================================

/**
 * Update menu item enabled/checked state based on application state.
 * Uses Menu.getApplicationMenu() to find items by ID.
 *
 * @param state - Current menu state
 */
export function updateMenuState(state: MenuState): void {
    const appMenu = Menu.getApplicationMenu();
    if (!appMenu) {
        console.warn(`${LOG_PREFIX} No application menu set — cannot update state`);
        return;
    }

    // Enable/disable Disconnect based on connection state
    const disconnectItem = appMenu.getMenuItemById('disconnect');
    if (disconnectItem) {
        disconnectItem.enabled = state.isConnected;
    }

    // Enable/disable Close Tab / Close All Tabs based on tab state
    const closeTabItem = appMenu.getMenuItemById('closeTab');
    if (closeTabItem) {
        closeTabItem.enabled = state.hasOpenTabs;
    }

    const closeAllTabsItem = appMenu.getMenuItemById('closeAllTabs');
    if (closeAllTabsItem) {
        closeAllTabsItem.enabled = state.hasOpenTabs;
    }

    // Update theme radio buttons
    const themeLightItem = appMenu.getMenuItemById('themeLight');
    if (themeLightItem) {
        themeLightItem.checked = state.themeSource === 'light';
    }

    const themeDarkItem = appMenu.getMenuItemById('themeDark');
    if (themeDarkItem) {
        themeDarkItem.checked = state.themeSource === 'dark';
    }

    const themeSystemItem = appMenu.getMenuItemById('themeSystem');
    if (themeSystemItem) {
        themeSystemItem.checked = state.themeSource === 'system';
    }
}
