// IRIS Table Editor - Webview main script
// This file will be expanded in later stories

(function() {
    const LOG_PREFIX = '[IRIS-TE Webview]';

    // Placeholder AppState class - will be expanded in Epic 2
    class AppState {
        constructor() {
            this._state = {
                server: null,
                namespace: null,
                tables: [],
                selectedTable: null,
                isLoading: false,
                error: null
            };
            this._listeners = [];
        }

        get state() {
            return this._state;
        }

        update(changes) {
            this._state = { ...this._state, ...changes };
            this._notifyListeners();
        }

        subscribe(listener) {
            this._listeners.push(listener);
            return () => {
                this._listeners = this._listeners.filter(l => l !== listener);
            };
        }

        _notifyListeners() {
            this._listeners.forEach(listener => listener(this._state));
        }
    }

    // Initialize
    const appState = new AppState();
    console.debug(`${LOG_PREFIX} Webview initialized`);

    // VS Code API for message passing (will be used in later stories)
    // const vscode = acquireVsCodeApi();
})();
