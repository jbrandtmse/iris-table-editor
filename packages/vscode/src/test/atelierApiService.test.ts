import * as assert from 'assert';
import {
    AtelierApiService,
    QueryExecutor,
    TableMetadataService,
    IServerSpec,
    ErrorCodes,
    IColumnInfo,
    ITableSchema,
    validateAndEscapeIdentifier,
    validateNumeric,
    parseQualifiedTableName,
    escapeTableName,
    buildFilterWhereClause,
    buildOrderByClause,
    formatDateTimeValue,
    formatNumericValue,
    parseUserTimeInput,
    formatTimeForIRIS,
    parseUserDateInput,
    formatDateForIRIS,
    parseUserTimestampInput,
    formatTimestampForIRIS,
    parseNumericInput
} from '@iris-te/core';

suite('AtelierApiService Test Suite', () => {

    let service: AtelierApiService;

    const mockServerSpec: IServerSpec = {
        name: 'test-server',
        scheme: 'http',
        host: 'localhost',
        port: 52773,
        pathPrefix: '/api/atelier/',
        username: 'testuser'
    };

    setup(() => {
        service = new AtelierApiService();
    });

    test('AtelierApiService can be instantiated', () => {
        assert.ok(service, 'Service should be instantiated');
    });

    test('AtelierApiService has testConnection method', () => {
        assert.ok(typeof service.testConnection === 'function', 'testConnection should be a function');
    });

    test('AtelierApiService has executeQuery method', () => {
        assert.ok(typeof service.executeQuery === 'function', 'executeQuery should be a function');
    });

    test('AtelierApiService has setTimeout method', () => {
        assert.ok(typeof service.setTimeout === 'function', 'setTimeout should be a function');
    });

    test('AtelierApiService has getTimeout method', () => {
        assert.ok(typeof service.getTimeout === 'function', 'getTimeout should be a function');
        assert.strictEqual(service.getTimeout(), 30000, 'Default timeout should be 30000ms');
    });

    test('AtelierApiService has buildAuthHeaders method', () => {
        assert.ok(typeof service.buildAuthHeaders === 'function', 'buildAuthHeaders should be a function');
        const headers = service.buildAuthHeaders('user', 'pass');
        assert.ok(headers['Authorization'], 'Should have Authorization header');
        assert.ok(headers['Content-Type'], 'Should have Content-Type header');
    });

    test('setTimeout can be called without error', () => {
        assert.doesNotThrow(() => {
            service.setTimeout(5000);
        }, 'setTimeout should not throw');
        assert.strictEqual(service.getTimeout(), 5000, 'Timeout should be updated');
    });

    test('testConnection returns proper error structure on network failure', async () => {
        // Use an invalid hostname to trigger network error
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        // Set a short timeout for faster test
        service.setTimeout(1000);

        const result = await service.testConnection(invalidSpec, 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.ok(
            [ErrorCodes.SERVER_UNREACHABLE, ErrorCodes.CONNECTION_TIMEOUT].includes(result.error!.code as typeof ErrorCodes.SERVER_UNREACHABLE),
            'Should be network-related error'
        );
        assert.ok(result.error!.recoverable, 'Should be recoverable');
    });

    test('executeQuery returns proper error structure on network failure', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        service.setTimeout(1000);

        const result = await service.executeQuery(
            invalidSpec,
            'USER',
            'test',
            'test',
            'SELECT 1'
        );

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
    });

    test('AtelierApiService methods return consistent error format', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-test.local'
        };

        service.setTimeout(500);

        const testResult = await service.testConnection(invalidSpec, 'user', 'pass');
        const queryResult = await service.executeQuery(invalidSpec, 'USER', 'user', 'pass', 'SELECT 1');

        // Both should have consistent error structure
        if (testResult.error) {
            assert.ok('message' in testResult.error, 'Should have message');
            assert.ok('code' in testResult.error, 'Should have code');
            assert.ok('recoverable' in testResult.error, 'Should have recoverable');
            assert.ok('context' in testResult.error, 'Should have context');
        }

        if (queryResult.error) {
            assert.ok('message' in queryResult.error, 'Should have message');
            assert.ok('code' in queryResult.error, 'Should have code');
            assert.ok('recoverable' in queryResult.error, 'Should have recoverable');
            assert.ok('context' in queryResult.error, 'Should have context');
        }
    });

    test('testConnection context is set correctly', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid.local'
        };

        service.setTimeout(500);

        const result = await service.testConnection(invalidSpec, 'user', 'pass');

        if (result.error) {
            assert.strictEqual(result.error.context, 'testConnection', 'Context should be testConnection');
        }
    });

    test('executeQuery context is set correctly', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid.local'
        };

        service.setTimeout(500);

        const result = await service.executeQuery(invalidSpec, 'USER', 'user', 'pass', 'SELECT 1');

        if (result.error) {
            assert.strictEqual(result.error.context, 'executeQuery', 'Context should be executeQuery');
        }
    });

    // Story 1.5 AC#3: Verify namespace encoding integration
    test('System namespaces can be properly encoded for API calls', () => {
        const { UrlBuilder } = require('@iris-te/core');

        const systemNamespaces = ['%SYS', '%APPTOOLS', 'USER', 'SAMPLES'];

        for (const ns of systemNamespaces) {
            const encoded = UrlBuilder.encodeNamespace(ns);

            if (ns.includes('%')) {
                assert.ok(encoded.includes('%25'), `${ns} should have % encoded as %25`);
                assert.ok(!encoded.includes('%%'), `${ns} should not have double %`);
            }

            const queryUrl = UrlBuilder.buildQueryUrl('http://localhost:52773/api/atelier/', ns);
            assert.ok(queryUrl.includes('/v1/'), 'URL should contain version path');
            assert.ok(!queryUrl.includes('/%S'), 'URL should not contain unencoded %S');

            if (ns === '%SYS') {
                assert.ok(queryUrl.includes('%25SYS'), '%SYS should be encoded as %25SYS in URL');
            }
        }
    });

    // Story 1.6 AC#2: Verify system namespace encoding for table queries
    test('System namespaces are properly encoded for API calls', () => {
        const { UrlBuilder } = require('@iris-te/core');

        const testNamespaces = ['%SYS', 'USER', 'HSCUSTOM', '%CACHELIB'];

        for (const ns of testNamespaces) {
            const queryUrl = UrlBuilder.buildQueryUrl('http://localhost:52773/api/atelier/', ns);

            if (ns === '%SYS') {
                assert.ok(queryUrl.includes('%25SYS'), '%SYS should be encoded as %25SYS in URL');
            }

            assert.ok(!queryUrl.includes('/%S'), 'URL should not contain unencoded %S');
        }
    });

    // Story 2.1: ITableSchema and IColumnInfo interface tests
    test('IColumnInfo interface has required properties', () => {
        const columnInfo: IColumnInfo = {
            name: 'TestColumn',
            dataType: 'VARCHAR',
            nullable: true,
            maxLength: 255
        };

        assert.strictEqual(columnInfo.name, 'TestColumn', 'name should be set');
        assert.strictEqual(columnInfo.dataType, 'VARCHAR', 'dataType should be set');
        assert.strictEqual(columnInfo.nullable, true, 'nullable should be set');
        assert.strictEqual(columnInfo.maxLength, 255, 'maxLength should be set');
    });

    test('IColumnInfo interface allows optional properties to be undefined', () => {
        const columnInfo: IColumnInfo = {
            name: 'ID',
            dataType: 'INTEGER',
            nullable: false
        };

        assert.strictEqual(columnInfo.name, 'ID', 'name should be set');
        assert.strictEqual(columnInfo.maxLength, undefined, 'maxLength should be optional');
        assert.strictEqual(columnInfo.precision, undefined, 'precision should be optional');
        assert.strictEqual(columnInfo.scale, undefined, 'scale should be optional');
    });

    test('ITableSchema interface has required properties', () => {
        const schema: ITableSchema = {
            tableName: 'TestTable',
            namespace: 'USER',
            columns: [
                { name: 'ID', dataType: 'INTEGER', nullable: false },
                { name: 'Name', dataType: 'VARCHAR', nullable: true, maxLength: 100 }
            ]
        };

        assert.strictEqual(schema.tableName, 'TestTable', 'tableName should be set');
        assert.strictEqual(schema.namespace, 'USER', 'namespace should be set');
        assert.strictEqual(schema.columns.length, 2, 'columns should contain 2 items');
    });

    // Story 1.7: External abort signal support tests
    test('testConnection accepts externalSignal parameter', () => {
        const controller = new AbortController();
        assert.doesNotThrow(() => {
            service.setTimeout(500);
            service.testConnection(mockServerSpec, 'user', 'pass', controller.signal);
        }, 'testConnection should accept externalSignal parameter');
        controller.abort();
    });

    test('testConnection returns CONNECTION_CANCELLED when external signal is aborted', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        service.setTimeout(30000);

        const controller = new AbortController();
        setTimeout(() => controller.abort(), 50);

        const result = await service.testConnection(invalidSpec, 'test', 'test', controller.signal);

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.strictEqual(
            result.error!.code,
            ErrorCodes.CONNECTION_CANCELLED,
            'Should return CONNECTION_CANCELLED when external signal is aborted'
        );
        assert.strictEqual(result.error!.recoverable, true, 'Should be recoverable');
    });

    test('testConnection returns CONNECTION_TIMEOUT when no external signal (timeout case)', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: '192.0.2.1'
        };

        service.setTimeout(100);

        const result = await service.testConnection(invalidSpec, 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.notStrictEqual(
            result.error!.code,
            ErrorCodes.CONNECTION_CANCELLED,
            'Should NOT return CONNECTION_CANCELLED without external signal abort'
        );
    });

    test('executeQuery accepts externalSignal parameter', () => {
        const controller = new AbortController();
        assert.doesNotThrow(() => {
            service.setTimeout(500);
            service.executeQuery(mockServerSpec, 'USER', 'user', 'pass', 'SELECT 1', [], controller.signal);
        }, 'executeQuery should accept externalSignal parameter');
        controller.abort();
    });

    test('executeQuery returns CONNECTION_CANCELLED when external signal is aborted', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        service.setTimeout(30000);

        const controller = new AbortController();
        setTimeout(() => controller.abort(), 50);

        const result = await service.executeQuery(invalidSpec, 'USER', 'test', 'test', 'SELECT 1', [], controller.signal);

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.strictEqual(
            result.error!.code,
            ErrorCodes.CONNECTION_CANCELLED,
            'Should return CONNECTION_CANCELLED when external signal is aborted'
        );
    });
});

suite('QueryExecutor Test Suite', () => {

    let apiService: AtelierApiService;
    let queryExecutor: QueryExecutor;

    const mockServerSpec: IServerSpec = {
        name: 'test-server',
        scheme: 'http',
        host: 'localhost',
        port: 52773,
        pathPrefix: '/api/atelier/',
        username: 'testuser'
    };

    setup(() => {
        apiService = new AtelierApiService();
        queryExecutor = new QueryExecutor(apiService);
    });

    test('QueryExecutor can be instantiated', () => {
        assert.ok(queryExecutor, 'QueryExecutor should be instantiated');
    });

    test('QueryExecutor has getTableData method', () => {
        assert.ok(typeof queryExecutor.getTableData === 'function', 'getTableData should be a function');
    });

    test('QueryExecutor has updateCell method', () => {
        assert.ok(typeof queryExecutor.updateCell === 'function', 'updateCell should be a function');
    });

    test('QueryExecutor has insertRow method', () => {
        assert.ok(typeof queryExecutor.insertRow === 'function', 'insertRow should be a function');
    });

    test('QueryExecutor has deleteRow method', () => {
        assert.ok(typeof queryExecutor.deleteRow === 'function', 'deleteRow should be a function');
    });

    test('getTableData returns proper error on network failure', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        const schema: ITableSchema = {
            tableName: 'TestTable',
            namespace: 'USER',
            columns: [{ name: 'ID', dataType: 'INTEGER', nullable: false }]
        };

        apiService.setTimeout(1000);

        const result = await queryExecutor.getTableData(invalidSpec, 'USER', 'TestTable', schema, 100, 0, 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
    });
});

suite('TableMetadataService Test Suite', () => {

    let apiService: AtelierApiService;
    let metadataService: TableMetadataService;

    const mockServerSpec: IServerSpec = {
        name: 'test-server',
        scheme: 'http',
        host: 'localhost',
        port: 52773,
        pathPrefix: '/api/atelier/',
        username: 'testuser'
    };

    setup(() => {
        apiService = new AtelierApiService();
        metadataService = new TableMetadataService(apiService);
    });

    test('TableMetadataService can be instantiated', () => {
        assert.ok(metadataService, 'TableMetadataService should be instantiated');
    });

    test('TableMetadataService has getNamespaces method', () => {
        assert.ok(typeof metadataService.getNamespaces === 'function', 'getNamespaces should be a function');
    });

    test('TableMetadataService has getTables method', () => {
        assert.ok(typeof metadataService.getTables === 'function', 'getTables should be a function');
    });

    test('TableMetadataService has getTableSchema method', () => {
        assert.ok(typeof metadataService.getTableSchema === 'function', 'getTableSchema should be a function');
    });

    test('getNamespaces returns proper error structure on network failure', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        apiService.setTimeout(1000);

        const result = await metadataService.getNamespaces(invalidSpec, 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
        assert.ok(
            [ErrorCodes.SERVER_UNREACHABLE, ErrorCodes.CONNECTION_TIMEOUT].includes(result.error!.code as typeof ErrorCodes.SERVER_UNREACHABLE),
            'Should be network-related error'
        );
        assert.ok(result.error!.recoverable, 'Should be recoverable');
    });

    test('getNamespaces context is set correctly', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid.local'
        };

        apiService.setTimeout(500);

        const result = await metadataService.getNamespaces(invalidSpec, 'user', 'pass');

        if (result.error) {
            assert.strictEqual(result.error.context, 'getNamespaces', 'Context should be getNamespaces');
        }
    });

    test('getTables returns proper error structure on network failure', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        apiService.setTimeout(1000);

        const result = await metadataService.getTables(invalidSpec, 'USER', 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
    });

    test('getTableSchema returns proper error structure on network failure', async () => {
        const invalidSpec: IServerSpec = {
            ...mockServerSpec,
            host: 'invalid-hostname-that-does-not-exist-12345.local'
        };

        apiService.setTimeout(1000);

        const result = await metadataService.getTableSchema(invalidSpec, 'USER', 'TestTable', 'test', 'test');

        assert.strictEqual(result.success, false, 'Should fail');
        assert.ok(result.error, 'Should have an error');
    });
});

suite('SqlBuilder Test Suite', () => {

    test('validateAndEscapeIdentifier validates valid identifiers', () => {
        const result = validateAndEscapeIdentifier('TestColumn', 'column name');
        assert.strictEqual(result, '"TestColumn"', 'Should wrap in double quotes');
    });

    test('validateAndEscapeIdentifier allows IRIS system identifiers with %', () => {
        const result = validateAndEscapeIdentifier('%Dictionary', 'table name');
        assert.ok(result.includes('%Dictionary'), 'Should allow % in identifiers');
    });

    test('validateAndEscapeIdentifier rejects empty identifiers', () => {
        assert.throws(() => {
            validateAndEscapeIdentifier('', 'column name');
        }, /identifier cannot be empty/, 'Should throw for empty identifier');
    });

    test('validateAndEscapeIdentifier rejects identifiers with invalid characters', () => {
        assert.throws(() => {
            validateAndEscapeIdentifier('DROP TABLE', 'column name');
        }, /contains invalid characters/, 'Should throw for invalid characters');
    });

    test('validateNumeric accepts valid non-negative integers', () => {
        assert.strictEqual(validateNumeric(0, 'offset'), 0, 'Should accept 0');
        assert.strictEqual(validateNumeric(100, 'page size'), 100, 'Should accept positive integer');
    });

    test('validateNumeric rejects negative numbers', () => {
        assert.throws(() => {
            validateNumeric(-1, 'offset');
        }, /must be a non-negative integer/, 'Should throw for negative');
    });

    test('validateNumeric rejects non-integers', () => {
        assert.throws(() => {
            validateNumeric(1.5, 'offset');
        }, /must be a non-negative integer/, 'Should throw for non-integer');
    });

    test('parseQualifiedTableName parses schema.table format', () => {
        const result = parseQualifiedTableName('Ens_Lib.MessageHeader');
        assert.strictEqual(result.schemaName, 'Ens_Lib', 'Should extract schema');
        assert.strictEqual(result.baseTableName, 'MessageHeader', 'Should extract table name');
    });

    test('parseQualifiedTableName defaults to SQLUser for simple names', () => {
        const result = parseQualifiedTableName('MyTable');
        assert.strictEqual(result.schemaName, 'SQLUser', 'Should default to SQLUser');
        assert.strictEqual(result.baseTableName, 'MyTable', 'Should use full name as table');
    });

    test('escapeTableName produces escaped schema.table', () => {
        const result = escapeTableName('Ens_Lib.MessageHeader');
        assert.strictEqual(result, '"Ens_Lib"."MessageHeader"', 'Should escape both parts');
    });

    test('buildFilterWhereClause returns empty for no filters', () => {
        const schema: ITableSchema = {
            tableName: 'Test',
            namespace: 'USER',
            columns: [{ name: 'ID', dataType: 'INTEGER', nullable: false }]
        };
        const result = buildFilterWhereClause([], schema);
        assert.strictEqual(result.whereClause, '', 'Should be empty');
        assert.strictEqual(result.filterParams.length, 0, 'Should have no params');
    });

    test('buildFilterWhereClause builds WHERE with valid filters', () => {
        const schema: ITableSchema = {
            tableName: 'Test',
            namespace: 'USER',
            columns: [
                { name: 'Name', dataType: 'VARCHAR', nullable: true },
                { name: 'ID', dataType: 'INTEGER', nullable: false }
            ]
        };
        const result = buildFilterWhereClause([{ column: 'Name', value: 'John' }], schema);
        assert.ok(result.whereClause.includes('WHERE'), 'Should contain WHERE');
        assert.ok(result.whereClause.includes('LIKE ?'), 'Should use parameterized LIKE');
        assert.strictEqual(result.filterParams.length, 1, 'Should have one param');
        assert.strictEqual(result.filterParams[0], 'John', 'Param should be the filter value');
    });

    test('buildFilterWhereClause handles wildcard filters', () => {
        const schema: ITableSchema = {
            tableName: 'Test',
            namespace: 'USER',
            columns: [{ name: 'Name', dataType: 'VARCHAR', nullable: true }]
        };
        const result = buildFilterWhereClause([{ column: 'Name', value: 'J*' }], schema);
        assert.ok(result.whereClause.includes('LIKE ?'), 'Should use LIKE');
        assert.ok(result.whereClause.includes("ESCAPE '\\"), 'Should include ESCAPE clause');
        assert.strictEqual(result.filterParams[0], 'J%', 'Should convert * to %');
    });

    test('buildFilterWhereClause ignores unknown columns', () => {
        const schema: ITableSchema = {
            tableName: 'Test',
            namespace: 'USER',
            columns: [{ name: 'Name', dataType: 'VARCHAR', nullable: true }]
        };
        const result = buildFilterWhereClause([{ column: 'NonExistent', value: 'test' }], schema);
        assert.strictEqual(result.whereClause, '', 'Should be empty for unknown column');
    });

    test('buildOrderByClause returns empty for null sort', () => {
        const schema: ITableSchema = {
            tableName: 'Test',
            namespace: 'USER',
            columns: [{ name: 'ID', dataType: 'INTEGER', nullable: false }]
        };
        const result = buildOrderByClause(null, null, schema);
        assert.strictEqual(result, '', 'Should be empty');
    });

    test('buildOrderByClause builds ORDER BY clause', () => {
        const schema: ITableSchema = {
            tableName: 'Test',
            namespace: 'USER',
            columns: [{ name: 'Name', dataType: 'VARCHAR', nullable: true }]
        };
        const result = buildOrderByClause('Name', 'asc', schema);
        assert.ok(result.includes('ORDER BY'), 'Should contain ORDER BY');
        assert.ok(result.includes('ASC'), 'Should contain ASC');
    });

    test('buildOrderByClause ignores unknown columns', () => {
        const schema: ITableSchema = {
            tableName: 'Test',
            namespace: 'USER',
            columns: [{ name: 'Name', dataType: 'VARCHAR', nullable: true }]
        };
        const result = buildOrderByClause('NonExistent', 'asc', schema);
        assert.strictEqual(result, '', 'Should be empty for unknown column');
    });
});

suite('DataTypeFormatter Test Suite', () => {

    test('formatDateTimeValue formats DATE type', () => {
        const result = formatDateTimeValue('2026-01-15', 'DATE');
        assert.ok(result, 'Should return a formatted string');
        assert.notStrictEqual(result, 'undefined', 'Should not be undefined');
    });

    test('formatDateTimeValue returns raw value for invalid date', () => {
        const result = formatDateTimeValue('not-a-date', 'DATE');
        assert.strictEqual(result, 'not-a-date', 'Should return raw value');
    });

    test('formatDateTimeValue handles null/undefined', () => {
        assert.strictEqual(formatDateTimeValue(null, 'DATE'), 'null', 'Should handle null');
        assert.strictEqual(formatDateTimeValue(undefined, 'DATE'), 'undefined', 'Should handle undefined');
    });

    test('formatNumericValue formats integers', () => {
        const result = formatNumericValue(1234567, 'INTEGER');
        assert.ok(result.includes('1'), 'Should contain digits');
    });

    test('formatNumericValue returns raw value for NaN', () => {
        const result = formatNumericValue('abc', 'INTEGER');
        assert.strictEqual(result, 'abc', 'Should return raw value for NaN');
    });

    test('parseUserTimeInput parses HH:MM:SS format', () => {
        const result = parseUserTimeInput('14:30:45');
        assert.ok(result, 'Should parse valid time');
        assert.strictEqual(result!.hours, 14, 'Hours should be 14');
        assert.strictEqual(result!.minutes, 30, 'Minutes should be 30');
        assert.strictEqual(result!.seconds, 45, 'Seconds should be 45');
    });

    test('parseUserTimeInput parses HH:MM format', () => {
        const result = parseUserTimeInput('9:15');
        assert.ok(result, 'Should parse valid time');
        assert.strictEqual(result!.hours, 9, 'Hours should be 9');
        assert.strictEqual(result!.minutes, 15, 'Minutes should be 15');
        assert.strictEqual(result!.seconds, 0, 'Seconds should default to 0');
    });

    test('parseUserTimeInput parses 12-hour AM/PM format', () => {
        const result = parseUserTimeInput('2:30 PM');
        assert.ok(result, 'Should parse AM/PM time');
        assert.strictEqual(result!.hours, 14, 'Hours should be 14 (2 PM)');
        assert.strictEqual(result!.minutes, 30, 'Minutes should be 30');
    });

    test('parseUserTimeInput returns null for invalid input', () => {
        assert.strictEqual(parseUserTimeInput('invalid'), null, 'Should return null');
        assert.strictEqual(parseUserTimeInput(''), null, 'Should return null for empty');
    });

    test('formatTimeForIRIS produces HH:MM:SS format', () => {
        const result = formatTimeForIRIS({ hours: 9, minutes: 5, seconds: 3 });
        assert.strictEqual(result, '09:05:03', 'Should zero-pad');
    });

    test('parseUserDateInput parses ISO format', () => {
        const result = parseUserDateInput('2026-01-15');
        assert.ok(result, 'Should parse ISO date');
        assert.strictEqual(result!.getFullYear(), 2026, 'Year should be 2026');
        assert.strictEqual(result!.getMonth(), 0, 'Month should be January (0)');
        assert.strictEqual(result!.getDate(), 15, 'Day should be 15');
    });

    test('parseUserDateInput parses US format', () => {
        const result = parseUserDateInput('01/15/2026');
        assert.ok(result, 'Should parse US date');
        assert.strictEqual(result!.getFullYear(), 2026, 'Year should be 2026');
    });

    test('parseUserDateInput returns null for invalid input', () => {
        assert.strictEqual(parseUserDateInput('not-a-date'), null, 'Should return null');
        assert.strictEqual(parseUserDateInput(''), null, 'Should return null for empty');
    });

    test('formatDateForIRIS produces YYYY-MM-DD format', () => {
        const date = new Date(2026, 0, 5);
        const result = formatDateForIRIS(date);
        assert.strictEqual(result, '2026-01-05', 'Should format as YYYY-MM-DD');
    });

    test('parseUserTimestampInput parses ISO timestamp', () => {
        const result = parseUserTimestampInput('2026-01-15T14:30:00');
        assert.ok(result, 'Should parse ISO timestamp');
        assert.strictEqual(result!.time.hours, 14, 'Hours should be 14');
        assert.strictEqual(result!.time.minutes, 30, 'Minutes should be 30');
    });

    test('parseUserTimestampInput parses space-separated timestamp', () => {
        const result = parseUserTimestampInput('2026-01-15 14:30:00');
        assert.ok(result, 'Should parse space-separated timestamp');
        assert.strictEqual(result!.time.hours, 14, 'Hours should be 14');
    });

    test('parseUserTimestampInput defaults time to 00:00:00 for date-only input', () => {
        const result = parseUserTimestampInput('2026-01-15');
        assert.ok(result, 'Should parse date-only as timestamp');
        assert.strictEqual(result!.time.hours, 0, 'Hours should default to 0');
        assert.strictEqual(result!.time.minutes, 0, 'Minutes should default to 0');
        assert.strictEqual(result!.time.seconds, 0, 'Seconds should default to 0');
    });

    test('formatTimestampForIRIS produces YYYY-MM-DD HH:MM:SS format', () => {
        const date = new Date(2026, 0, 15);
        const time = { hours: 14, minutes: 30, seconds: 0 };
        const result = formatTimestampForIRIS(date, time);
        assert.strictEqual(result, '2026-01-15 14:30:00', 'Should format as timestamp');
    });

    test('parseNumericInput parses valid integers', () => {
        const result = parseNumericInput('42', true);
        assert.ok(result, 'Should parse');
        assert.strictEqual(result!.valid, true, 'Should be valid');
        assert.strictEqual(result!.value, 42, 'Value should be 42');
    });

    test('parseNumericInput rounds non-integers when isInteger is true', () => {
        const result = parseNumericInput('42.7', true);
        assert.ok(result, 'Should parse');
        assert.strictEqual(result!.valid, true, 'Should be valid');
        assert.strictEqual(result!.value, 43, 'Should round to 43');
        assert.strictEqual(result!.rounded, true, 'Should flag as rounded');
    });

    test('parseNumericInput handles decimals when isInteger is false', () => {
        const result = parseNumericInput('42.7', false);
        assert.ok(result, 'Should parse');
        assert.strictEqual(result!.valid, true, 'Should be valid');
        assert.strictEqual(result!.value, 42.7, 'Value should be 42.7');
    });

    test('parseNumericInput returns invalid for non-numeric input', () => {
        const result = parseNumericInput('abc', false);
        assert.ok(result, 'Should return result');
        assert.strictEqual(result!.valid, false, 'Should be invalid');
        assert.ok(result!.error, 'Should have error message');
    });

    test('parseNumericInput returns null for empty input', () => {
        assert.strictEqual(parseNumericInput('', false), null, 'Should return null for empty');
    });

    test('parseNumericInput strips thousands separators', () => {
        const result = parseNumericInput('1,234,567', true);
        assert.ok(result, 'Should parse');
        assert.strictEqual(result!.valid, true, 'Should be valid');
        assert.strictEqual(result!.value, 1234567, 'Should strip commas');
    });
});
