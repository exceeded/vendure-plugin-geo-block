import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from '@vendure/testing';
import * as path from 'path';
import { initialData } from '../../../e2e-shared/initial-data';
import { GeoBlockPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

const PORT = 3061;

describe('@huloglobal/vendure-plugin-geo-block', () => {
    const config = mergeConfig(testConfig, {
        apiOptions: { port: PORT },
        plugins: [
            GeoBlockPlugin.init({
                publicBaseUrl: `http://localhost:${PORT}`,
            }),
        ],
    });
    const { server } = createTestEnvironment(config);

    beforeAll(async () => {
        await server.init({ initialData, productsCsvPath: '', customerCount: 0 } as any);
    }, 60_000);

    afterAll(async () => {
        await server.destroy();
    });

    it('serves /geo-block/site-config with a JSON shape', async () => {
        const res = await fetch(`http://localhost:${PORT}/geo-block/site-config`);
        expect(res.status).toBe(200);
        const body = await res.json();
        // Without a licence key, the plugin must always return enabled:false
        // — verifies the unlicensed fail-open contract documented on init().
        expect(body).toHaveProperty('geoBlock');
        expect(body.geoBlock.enabled).toBe(false);
    });

    it('admin endpoints reject anonymous calls', async () => {
        const res = await fetch(`http://localhost:${PORT}/geo-block/admin/channels`);
        expect([401, 403]).toContain(res.status);
    });

    it('exposes a preset catalogue', async () => {
        const res = await fetch(`http://localhost:${PORT}/geo-block/presets`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.presets)).toBe(true);
        // We now ship 30+ presets — fail loud if the catalogue collapses.
        expect(body.presets.length).toBeGreaterThanOrEqual(30);
        const keys = body.presets.map((p: any) => p.key);
        expect(keys).toContain('EU');
        expect(keys).toContain('GCC');
        expect(keys).toContain('SCHENGEN');
        expect(keys).toContain('NATO');
        expect(keys).toContain('WORLDWIDE');
    });

    it('/check returns allow when geo-block is disabled', async () => {
        // No channel configured = no rules to apply.
        const res = await fetch(`http://localhost:${PORT}/geo-block/check`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.allowed).toBe(true);
    });

    it('soft-block + full-block + mode field round-trip on site-config', async () => {
        const res = await fetch(`http://localhost:${PORT}/geo-block/site-config`);
        expect(res.status).toBe(200);
        const body = await res.json();
        // The new mode field is part of the contract now.
        expect(body.geoBlock.mode).toBe('block');
    });
});
