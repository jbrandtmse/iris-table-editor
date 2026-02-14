/**
 * AutoUpdateManager - Manages automatic updates via electron-updater
 * Story 13.2: Auto-Update
 *
 * Wraps electron-updater's autoUpdater singleton to check GitHub Releases
 * for new versions, download updates in the background, and prompt the
 * user to restart when an update is ready.
 *
 * Designed for testability: accepts an optional mock updater in the
 * constructor so tests can run without electron-updater installed.
 */
import { dialog } from 'electron';
import type { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';

const LOG_PREFIX = '[IRIS-TE Update]';

/**
 * Minimal logger interface for AutoUpdateManager.
 */
export interface AutoUpdateLogger {
    info: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}

/**
 * Options for constructing an AutoUpdateManager instance.
 */
export interface AutoUpdateManagerOptions {
    /** The main BrowserWindow to parent dialogs against. */
    win: BrowserWindow;
    /** Optional logger; defaults to console with LOG_PREFIX. */
    logger?: AutoUpdateLogger;
    /** Optional updater EventEmitter for testing; production uses real autoUpdater. */
    updater?: EventEmitter;
}

/**
 * Manages the auto-update lifecycle:
 * 1. Configures electron-updater settings
 * 2. Registers event handlers for update progress
 * 3. Shows a restart dialog when an update has been downloaded
 * 4. Supports both background (silent) and interactive (menu-triggered) checks
 */
export class AutoUpdateManager {
    private win: BrowserWindow;
    private logger: AutoUpdateLogger;
    private updater: EventEmitter & {
        autoDownload?: boolean;
        autoInstallOnAppQuit?: boolean;
        logger?: unknown;
        checkForUpdates?: () => Promise<unknown>;
        quitAndInstall?: () => void;
    };
    private isInteractive = false;
    private eventHandlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

    constructor(options: AutoUpdateManagerOptions) {
        this.win = options.win;
        this.logger = options.logger ?? {
            info: (...args: unknown[]) => console.log(LOG_PREFIX, ...args),
            error: (...args: unknown[]) => console.error(LOG_PREFIX, ...args),
        };

        if (options.updater) {
            // Test mode: use injected mock
            this.updater = options.updater as typeof this.updater;
        } else {
            // Production: lazy-import electron-updater
            try {
                const { autoUpdater } = require('electron-updater');
                this.updater = autoUpdater;
            } catch {
                // electron-updater not available (e.g., tests without it)
                this.logger.error('electron-updater not available — auto-update disabled');
                this.updater = new EventEmitter() as typeof this.updater;
            }
        }
    }

    /**
     * Configure autoUpdater settings and register event handlers.
     * Must be called before checkForUpdates().
     */
    initialize(): void {
        // Configure settings
        this.updater.autoDownload = true;
        this.updater.autoInstallOnAppQuit = true;
        this.updater.logger = this.logger;

        // Register event handlers
        this.on('checking-for-update', () => {
            this.logger.info('Checking for update...');
        });

        this.on('update-available', (...args: unknown[]) => {
            const info = args[0] as { version?: string } | undefined;
            this.logger.info(`Update available: v${info?.version ?? 'unknown'}`);
            // Reset interactive flag — update-available means an update IS available,
            // so the "no updates" dialog path in update-not-available won't fire.
            // Without this reset, the flag stays true and causes a spurious dialog
            // on the next background check if no update is available then.
            this.isInteractive = false;
        });

        this.on('update-not-available', (...args: unknown[]) => {
            const info = args[0] as { version?: string } | undefined;
            this.logger.info(`No update available (current: v${info?.version ?? 'unknown'})`);

            if (this.isInteractive) {
                this.isInteractive = false;
                if (!this.win.isDestroyed()) {
                    dialog.showMessageBox(this.win, {
                        type: 'info',
                        title: 'No Updates',
                        message: 'You are up to date.',
                        detail: `Version ${info?.version ?? 'unknown'} is the latest version.`,
                        buttons: ['OK'],
                    });
                }
            }
        });

        this.on('download-progress', (...args: unknown[]) => {
            const progress = args[0] as { percent?: number } | undefined;
            this.logger.info(`Download progress: ${Math.round(progress?.percent ?? 0)}%`);
        });

        this.on('update-downloaded', (...args: unknown[]) => {
            const info = args[0] as { version?: string } | undefined;
            this.logger.info(`Update downloaded: v${info?.version ?? 'unknown'}`);

            if (this.win.isDestroyed()) {
                return;
            }

            dialog.showMessageBox(this.win, {
                type: 'info',
                title: 'Update Available',
                message: `Update v${info?.version ?? 'unknown'} has been downloaded.`,
                detail: 'Restart now to apply the update, or it will be installed when you quit.',
                buttons: ['Restart Now', 'Later'],
                defaultId: 0,
                cancelId: 1,
            }).then(({ response }) => {
                if (response === 0) {
                    this.updater.quitAndInstall?.();
                }
            }).catch((err: unknown) => {
                // AC 6: silently log dialog errors (e.g., window destroyed mid-dialog)
                this.logger.error('Failed to show update dialog:', err);
            });
        });

        this.on('error', (...args: unknown[]) => {
            const err = args[0] as Error | undefined;
            this.logger.error('Update error:', err?.message ?? err);
            // AC 6: No user notification on error
        });

        this.logger.info('AutoUpdateManager initialized');
    }

    /**
     * Check for updates in the background. Errors are silently logged.
     * Called automatically on app startup.
     */
    async checkForUpdates(): Promise<void> {
        try {
            await this.updater.checkForUpdates?.();
        } catch (err) {
            this.logger.error('Background update check failed:', err);
        }
    }

    /**
     * Check for updates interactively (from the menu).
     * Shows a "no updates available" dialog if already up to date.
     */
    async checkForUpdatesInteractive(): Promise<void> {
        this.isInteractive = true;
        try {
            await this.updater.checkForUpdates?.();
        } catch (err) {
            this.isInteractive = false;
            this.logger.error('Interactive update check failed:', err);
        }
    }

    /**
     * Clean up event listeners.
     */
    dispose(): void {
        for (const { event, handler } of this.eventHandlers) {
            this.updater.removeListener(event, handler);
        }
        this.eventHandlers = [];
        this.logger.info('AutoUpdateManager disposed');
    }

    /**
     * Register an event handler and track it for disposal.
     */
    private on(event: string, handler: (...args: unknown[]) => void): void {
        this.updater.on(event, handler);
        this.eventHandlers.push({ event, handler });
    }
}
