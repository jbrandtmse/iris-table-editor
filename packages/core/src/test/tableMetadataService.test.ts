/**
 * Unit tests for TableMetadataService.getTableSchema()
 * Validates isPrimaryKey detection from IS_IDENTITY metadata.
 *
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it } from 'node:test';
import * as assert from 'assert';
import { TableMetadataService } from '../services/TableMetadataService';
import { AtelierApiService } from '../services/AtelierApiService';
import type { IServerSpec } from '../models/IServerSpec';
import type { IColumnInfo } from '../models/ITableSchema';

// ============================================
// Mock AtelierApiService
// ============================================

function createMockApiService(rows: Record<string, unknown>[]): AtelierApiService {
    return {
        executeQuery: async () => ({
            success: true,
            data: rows,
        }),
    } as unknown as AtelierApiService;
}

const dummySpec: IServerSpec = { name: 'test', scheme: 'http', host: 'localhost', port: 52773, pathPrefix: '' };

// ============================================
// Tests
// ============================================

describe('TableMetadataService.getTableSchema - isPrimaryKey', () => {

    it('should set isPrimaryKey=true for IS_IDENTITY=YES column', async () => {
        const mockApi = createMockApiService([
            { COLUMN_NAME: 'ID', DATA_TYPE: 'INTEGER', IS_NULLABLE: 'NO', IS_IDENTITY: 'YES', IS_GENERATED: 'NO' },
            { COLUMN_NAME: 'Name', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'YES', IS_IDENTITY: 'NO', IS_GENERATED: 'NO' },
        ]);
        const service = new TableMetadataService(mockApi);
        const result = await service.getTableSchema(dummySpec, 'USER', 'Sample.Person', 'user', 'pass');

        assert.ok(result.success);
        const cols = result.schema!.columns;
        assert.strictEqual(cols[0].isPrimaryKey, true, 'ID column should be isPrimaryKey');
        assert.strictEqual(cols[0].readOnly, true, 'ID column should be readOnly');
        assert.strictEqual(cols[1].isPrimaryKey, undefined, 'Name column should not be isPrimaryKey');
    });

    it('should set isPrimaryKey for custom SqlRowIdName columns', async () => {
        const mockApi = createMockApiService([
            { COLUMN_NAME: 'configuration_id', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'NO', IS_IDENTITY: 'YES', IS_GENERATED: 'NO' },
            { COLUMN_NAME: 'description', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'NO', IS_IDENTITY: 'NO', IS_GENERATED: 'NO' },
        ]);
        const service = new TableMetadataService(mockApi);
        const result = await service.getTableSchema(dummySpec, 'HSCUSTOM', 'MA_Data.Configurations', 'user', 'pass');

        assert.ok(result.success);
        const cols = result.schema!.columns;
        assert.strictEqual(cols[0].isPrimaryKey, true, 'configuration_id should be isPrimaryKey');
        assert.strictEqual(cols[0].readOnly, true, 'configuration_id should be readOnly');
    });

    it('should not set isPrimaryKey for IS_GENERATED=YES columns', async () => {
        const mockApi = createMockApiService([
            { COLUMN_NAME: 'ID', DATA_TYPE: 'INTEGER', IS_NULLABLE: 'NO', IS_IDENTITY: 'YES', IS_GENERATED: 'NO' },
            { COLUMN_NAME: 'FullName', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'YES', IS_IDENTITY: 'NO', IS_GENERATED: 'YES' },
        ]);
        const service = new TableMetadataService(mockApi);
        const result = await service.getTableSchema(dummySpec, 'USER', 'Sample.Person', 'user', 'pass');

        assert.ok(result.success);
        const cols = result.schema!.columns;
        assert.strictEqual(cols[1].readOnly, true, 'Generated column should be readOnly');
        assert.strictEqual(cols[1].isPrimaryKey, undefined, 'Generated column should NOT be isPrimaryKey');
    });

    it('should handle tables where no column has IS_IDENTITY=YES', async () => {
        const mockApi = createMockApiService([
            { COLUMN_NAME: 'Col1', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'YES', IS_IDENTITY: 'NO', IS_GENERATED: 'NO' },
            { COLUMN_NAME: 'Col2', DATA_TYPE: 'INTEGER', IS_NULLABLE: 'YES', IS_IDENTITY: 'NO', IS_GENERATED: 'NO' },
        ]);
        const service = new TableMetadataService(mockApi);
        const result = await service.getTableSchema(dummySpec, 'USER', 'Custom.View', 'user', 'pass');

        assert.ok(result.success);
        const cols = result.schema!.columns;
        assert.strictEqual(cols.every((c: IColumnInfo) => !c.isPrimaryKey), true, 'No column should be isPrimaryKey');
    });

    it('should handle API failure gracefully', async () => {
        const mockApi = {
            executeQuery: async () => ({
                success: false,
                error: { message: 'Connection failed', code: 'CONNECTION_FAILED', recoverable: true, context: 'test' },
            }),
        } as unknown as AtelierApiService;
        const service = new TableMetadataService(mockApi);
        const result = await service.getTableSchema(dummySpec, 'USER', 'Sample.Person', 'user', 'pass');

        assert.strictEqual(result.success, false);
        assert.strictEqual(result.schema, undefined);
    });
});
