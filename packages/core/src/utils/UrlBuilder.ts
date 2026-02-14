/**
 * URL construction utility for Atelier API
 * Handles proper encoding and URL building
 */

import { IServerSpec } from '../models/IServerSpec';

/**
 * URL builder for Atelier REST API endpoints
 */
export class UrlBuilder {
    /**
     * Build base URL from server specification
     * @param spec - Server specification with host, port, scheme, etc.
     * @returns Base URL for Atelier API (e.g., "http://localhost:52773/api/atelier/")
     */
    public static buildBaseUrl(spec: IServerSpec): string {
        // Use scheme from spec (provided by Server Manager)
        const protocol = spec.scheme || 'http';

        // Build path prefix - default to /api/atelier/ if none provided
        let pathPrefix = spec.pathPrefix;

        // If pathPrefix is empty or undefined, use default Atelier path
        if (!pathPrefix) {
            pathPrefix = '/api/atelier/';
        } else {
            // Ensure pathPrefix starts with /
            if (!pathPrefix.startsWith('/')) {
                pathPrefix = '/' + pathPrefix;
            }

            // Ensure pathPrefix ends with /
            if (!pathPrefix.endsWith('/')) {
                pathPrefix = pathPrefix + '/';
            }
        }

        return `${protocol}://${spec.host}:${spec.port}${pathPrefix}`;
    }

    /**
     * Build query endpoint URL with encoded namespace
     * CRITICAL: Encode % as %25 for system namespaces like %SYS
     * @param baseUrl - Base Atelier API URL
     * @param namespace - Namespace name (e.g., "USER", "%SYS")
     * @returns Full query endpoint URL
     */
    public static buildQueryUrl(baseUrl: string, namespace: string): string {
        // CRITICAL: Encode % as %25 BEFORE standard URL encoding
        // This is necessary for system namespaces like %SYS
        const encodedNamespace = UrlBuilder.encodeNamespace(namespace);

        // Ensure baseUrl doesn't have trailing slash for clean concatenation
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

        return `${cleanBaseUrl}/v1/${encodedNamespace}/action/query`;
    }

    /**
     * Encode namespace for URL usage
     * Handles special encoding for % character in system namespaces
     * @param namespace - Namespace name
     * @returns URL-encoded namespace
     */
    public static encodeNamespace(namespace: string): string {
        // Replace % with %25 (must be done before other encoding)
        // This handles namespaces like %SYS, %APPTOOLS, etc.
        return namespace.replace(/%/g, '%25');
    }

    /**
     * Build a generic Atelier API endpoint URL
     * @param spec - Server specification
     * @param namespace - Namespace name
     * @param endpoint - API endpoint path (e.g., "doc", "action/query")
     * @returns Full endpoint URL
     */
    public static buildEndpointUrl(spec: IServerSpec, namespace: string, endpoint: string): string {
        const baseUrl = UrlBuilder.buildBaseUrl(spec);
        const encodedNamespace = UrlBuilder.encodeNamespace(namespace);

        // Ensure endpoint doesn't have leading slash
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

        return `${baseUrl}v1/${encodedNamespace}/${cleanEndpoint}`;
    }
}
