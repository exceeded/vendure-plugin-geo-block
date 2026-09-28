import { describe, expect, it } from 'vitest';
import { REGION_PRESETS, presetCountries, resolveAllowedCountries } from './geo-regions';
import { resolveAllowedClient } from '../ui/resolve-allowed';

/** The admin UI resolves the allow-list in the browser; it must agree with the server. */
describe('resolveAllowedClient (admin-UI port of resolveAllowedCountries)', () => {
    const catalogue: Record<string, string[] | null> = {};
    for (const p of REGION_PRESETS) catalogue[p.key] = presetCountries(p.key);

    it('exposes countries for every preset (null only for WORLDWIDE)', () => {
        for (const p of REGION_PRESETS) {
            const c = presetCountries(p.key);
            if (p.key === 'WORLDWIDE') expect(c).toBeNull();
            else expect((c || []).length).toBe(p.countryCount);
        }
        expect(presetCountries('NOPE')).toEqual([]);
    });

    it('matches the server resolver for every single preset and for combinations', () => {
        const cases: Array<{ regions: string[]; extraAllowed: string[]; blocked: string[] }> = REGION_PRESETS.map(p => ({
            regions: [p.key], extraAllowed: [], blocked: [],
        }));
        cases.push(
            { regions: ['EU', 'GCC'], extraAllowed: ['jp', ' IL '], blocked: ['DE', 'SA'] },
            { regions: ['uk_only'], extraAllowed: ['GB'], blocked: ['GB'] },
            { regions: [], extraAllowed: ['US'], blocked: [] },
            { regions: [], extraAllowed: [], blocked: ['RU'] },
            { regions: ['WORLDWIDE', 'EU'], extraAllowed: [], blocked: ['KP'] },
        );
        for (const c of cases) {
            const server = resolveAllowedCountries(c);
            const client = resolveAllowedClient({ ...c, catalogue });
            expect(client.allowed).toEqual(server.allowed);
            expect(client.blocked).toEqual(server.blocked);
            expect(client.unknownPresets).toEqual([]);
        }
    });

    it('covers a saved preset missing from the tier-gated catalogue with the server snapshot', () => {
        const free: Record<string, string[] | null> = { WORLDWIDE: null, EU: presetCountries('EU') };
        const server = resolveAllowedCountries({ regions: ['GCC'], extraAllowed: [], blocked: [] });
        const r = resolveAllowedClient({
            regions: ['GCC'], extraAllowed: ['JP'], blocked: ['SA'],
            catalogue: free, serverResolved: server.allowed,
        });
        expect(r.unknownPresets).toEqual(['GCC']);
        expect(r.allowed).toEqual(['AE', 'BH', 'JP', 'KW', 'OM', 'QA']);
    });
});
