/**
 * Server specification interface matching the Server Manager API
 */
export interface IServerSpec {
    name: string;
    scheme: 'http' | 'https';
    host: string;
    port: number;
    pathPrefix: string;
    username?: string;
}
