import * as vscode from 'vscode';
import type { ServerManagerAPI, IServerName, IServerSpec as ISMServerSpec } from '@intersystems-community/intersystems-servermanager';
import { IServerSpec } from '../models/IServerSpec';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Manages server connections via InterSystems Server Manager extension
 */
export class ServerConnectionManager {
    private _serverManagerApi: ServerManagerAPI | undefined;

    constructor() {}

    /**
     * Check if Server Manager extension is installed and active
     */
    public isServerManagerInstalled(): boolean {
        const extension = vscode.extensions.getExtension('intersystems-community.servermanager');
        return extension !== undefined;
    }

    /**
     * Get list of configured server names
     * @returns Array of server names or empty array if none configured
     */
    public async getServerList(): Promise<string[]> {
        if (!this.isServerManagerInstalled()) {
            console.debug(`${LOG_PREFIX} Server Manager not installed`);
            return [];
        }

        try {
            const api = await this._getServerManagerApi();
            if (!api) {
                return [];
            }
            const serverNames: IServerName[] = api.getServerNames();
            const names = serverNames.map(s => s.name);
            console.debug(`${LOG_PREFIX} Found ${names.length} configured servers`);
            return names;
        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting server list:`, error);
            return [];
        }
    }

    /**
     * Get server specification by name
     * @param serverName - Name of the server to get specification for
     * @returns Server specification or undefined if not found
     */
    public async getServerSpec(serverName: string): Promise<IServerSpec | undefined> {
        if (!this.isServerManagerInstalled()) {
            return undefined;
        }

        try {
            const api = await this._getServerManagerApi();
            if (!api) {
                return undefined;
            }
            const spec: ISMServerSpec | undefined = await api.getServerSpec(serverName);
            if (!spec) {
                console.debug(`${LOG_PREFIX} Server '${serverName}' not found`);
                return undefined;
            }
            return {
                name: spec.name,
                host: spec.webServer.host || 'localhost',
                port: spec.webServer.port || 52773,
                pathPrefix: spec.webServer.pathPrefix || '/api/atelier/',
                username: spec.username
            };
        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting server spec:`, error);
            return undefined;
        }
    }

    /**
     * Get the Server Manager extension API
     * Activates the extension if not already active
     */
    private async _getServerManagerApi(): Promise<ServerManagerAPI | undefined> {
        if (this._serverManagerApi) {
            return this._serverManagerApi;
        }

        try {
            const extension = vscode.extensions.getExtension<ServerManagerAPI>('intersystems-community.servermanager');
            if (!extension) {
                console.debug(`${LOG_PREFIX} Server Manager extension not found`);
                return undefined;
            }

            // Activate the extension if not already active
            if (!extension.isActive) {
                console.debug(`${LOG_PREFIX} Activating Server Manager extension`);
                await extension.activate();
            }

            this._serverManagerApi = extension.exports;
            return this._serverManagerApi;
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to get Server Manager API:`, error);
            return undefined;
        }
    }
}
