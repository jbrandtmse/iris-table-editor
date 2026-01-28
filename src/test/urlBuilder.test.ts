import * as assert from 'assert';
import { UrlBuilder } from '../utils/UrlBuilder';
import { IServerSpec } from '../models/IServerSpec';

suite('UrlBuilder Test Suite', () => {

    const mockServerSpec: IServerSpec = {
        name: 'test-server',
        host: 'localhost',
        port: 52773,
        pathPrefix: '/api/atelier/',
        username: 'testuser'
    };

    test('UrlBuilder can be used statically', () => {
        assert.ok(UrlBuilder, 'UrlBuilder class should exist');
        assert.ok(typeof UrlBuilder.buildBaseUrl === 'function', 'buildBaseUrl should be a function');
        assert.ok(typeof UrlBuilder.buildQueryUrl === 'function', 'buildQueryUrl should be a function');
        assert.ok(typeof UrlBuilder.encodeNamespace === 'function', 'encodeNamespace should be a function');
    });

    test('buildBaseUrl creates correct URL for standard port', () => {
        const url = UrlBuilder.buildBaseUrl(mockServerSpec);

        assert.strictEqual(url, 'http://localhost:52773/api/atelier/');
    });

    test('buildBaseUrl uses HTTPS for port 443', () => {
        const httpsSpec: IServerSpec = {
            ...mockServerSpec,
            port: 443
        };

        const url = UrlBuilder.buildBaseUrl(httpsSpec);

        assert.ok(url.startsWith('https://'), 'Should use HTTPS for port 443');
        assert.ok(url.includes(':443'), 'Should include port 443');
    });

    test('buildBaseUrl handles missing pathPrefix', () => {
        const specNoPrefix: IServerSpec = {
            name: 'test',
            host: 'localhost',
            port: 52773,
            pathPrefix: ''
        };

        const url = UrlBuilder.buildBaseUrl(specNoPrefix);

        assert.ok(url.includes('/api/atelier/'), 'Should use default pathPrefix');
    });

    test('buildBaseUrl handles pathPrefix without leading slash', () => {
        const specNoSlash: IServerSpec = {
            ...mockServerSpec,
            pathPrefix: 'api/atelier/'
        };

        const url = UrlBuilder.buildBaseUrl(specNoSlash);

        assert.ok(url.includes('/api/atelier/'), 'Should add leading slash');
    });

    test('buildBaseUrl handles pathPrefix without trailing slash', () => {
        const specNoTrailing: IServerSpec = {
            ...mockServerSpec,
            pathPrefix: '/api/atelier'
        };

        const url = UrlBuilder.buildBaseUrl(specNoTrailing);

        assert.ok(url.endsWith('/'), 'Should add trailing slash');
    });

    test('buildQueryUrl creates correct query endpoint', () => {
        const baseUrl = 'http://localhost:52773/api/atelier/';
        const url = UrlBuilder.buildQueryUrl(baseUrl, 'USER');

        assert.strictEqual(url, 'http://localhost:52773/api/atelier/v1/USER/action/query');
    });

    test('buildQueryUrl handles base URL with trailing slash', () => {
        const urlWithSlash = UrlBuilder.buildQueryUrl('http://localhost:52773/api/atelier/', 'USER');
        const urlWithoutSlash = UrlBuilder.buildQueryUrl('http://localhost:52773/api/atelier', 'USER');

        // Both should produce the same result
        assert.strictEqual(urlWithSlash, urlWithoutSlash);
    });

    test('encodeNamespace handles regular namespaces', () => {
        assert.strictEqual(UrlBuilder.encodeNamespace('USER'), 'USER');
        assert.strictEqual(UrlBuilder.encodeNamespace('MyNamespace'), 'MyNamespace');
    });

    test('encodeNamespace encodes % as %25 for system namespaces', () => {
        assert.strictEqual(UrlBuilder.encodeNamespace('%SYS'), '%25SYS');
        assert.strictEqual(UrlBuilder.encodeNamespace('%APPTOOLS'), '%25APPTOOLS');
    });

    test('encodeNamespace handles multiple % characters', () => {
        // Hypothetical namespace with multiple %
        assert.strictEqual(UrlBuilder.encodeNamespace('%TEST%NS'), '%25TEST%25NS');
    });

    test('buildQueryUrl correctly encodes system namespaces', () => {
        const baseUrl = 'http://localhost:52773/api/atelier/';
        const url = UrlBuilder.buildQueryUrl(baseUrl, '%SYS');

        assert.ok(url.includes('%25SYS'), 'Should encode %SYS as %25SYS');
        assert.strictEqual(url, 'http://localhost:52773/api/atelier/v1/%25SYS/action/query');
    });

    test('buildEndpointUrl creates generic endpoint URLs', () => {
        const url = UrlBuilder.buildEndpointUrl(mockServerSpec, 'USER', 'doc');

        assert.strictEqual(url, 'http://localhost:52773/api/atelier/v1/USER/doc');
    });

    test('buildEndpointUrl handles endpoint with leading slash', () => {
        const url = UrlBuilder.buildEndpointUrl(mockServerSpec, 'USER', '/doc');

        assert.strictEqual(url, 'http://localhost:52773/api/atelier/v1/USER/doc');
    });

    test('buildEndpointUrl handles system namespaces', () => {
        const url = UrlBuilder.buildEndpointUrl(mockServerSpec, '%SYS', 'doc');

        assert.ok(url.includes('%25SYS'), 'Should encode system namespace');
    });

    test('Complete URL workflow produces valid URL', () => {
        // Simulate full workflow
        const baseUrl = UrlBuilder.buildBaseUrl(mockServerSpec);
        const queryUrl = UrlBuilder.buildQueryUrl(baseUrl, 'USER');

        // Should be a valid URL that can be parsed
        const parsed = new URL(queryUrl);

        assert.strictEqual(parsed.hostname, 'localhost');
        assert.strictEqual(parsed.port, '52773');
        assert.ok(parsed.pathname.includes('/action/query'));
    });
});
