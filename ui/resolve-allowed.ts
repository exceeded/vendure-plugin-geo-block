/**
 * Client-side port of `resolveAllowedCountries` (src/geo-regions.ts) so
 * the admin page can preview the resolved allow-list live while editing,
 * instead of showing the list the server computed at load time.
 *
 *   final = (∪ preset.countries for r in regions) ∪ extraAllowed − blocked
 *
 * `catalogue` maps a preset key to its countries (`null` = WORLDWIDE, i.e.
 * no country filter). `/geo-block/presets` only lists the presets the
 * current tier may pick, so a saved preset can be missing from it: its
 * countries are then taken from `serverResolved` (what the server resolved
 * for the saved rules), which keeps the preview a superset of the truth.
 *
 * Pure and framework-free — unit-tested against the server implementation.
 */
export function resolveAllowedClient(input: {
    regions: string[];
    extraAllowed: string[];
    blocked: string[];
    catalogue: Record<string, string[] | null>;
    serverResolved?: string[] | null;
}): { allowed: string[] | null; blocked: string[]; unknownPresets: string[] } {
    const norm = (s: string) => String(s || '').trim().toUpperCase();
    const regions = (input.regions || []).map(norm).filter(Boolean);
    const extra = (input.extraAllowed || []).map(norm).filter(Boolean);
    const blocked = (input.blocked || []).map(norm).filter(Boolean);

    if (regions.includes('WORLDWIDE')) return { allowed: null, blocked, unknownPresets: [] };

    const allowed = new Set<string>();
    const unknownPresets: string[] = [];
    for (const r of regions) {
        const countries = input.catalogue[r];
        if (countries === undefined) { unknownPresets.push(r); continue; }
        if (countries === null) return { allowed: null, blocked, unknownPresets: [] };
        for (const c of countries) allowed.add(norm(c));
    }
    if (unknownPresets.length && input.serverResolved) {
        for (const c of input.serverResolved) allowed.add(norm(c));
    }
    for (const c of extra) allowed.add(c);
    for (const c of blocked) allowed.delete(c);
    return { allowed: Array.from(allowed).sort(), blocked, unknownPresets };
}
