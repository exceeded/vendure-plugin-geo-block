/**
 * Region presets for the storefront geo-block.
 *
 * Each key is the value stored in the channel customField
 * `geoBlockAllowedRegions`; the array is the ISO 3166-1 alpha-2
 * country list it expands to. The site-config resolver unions the
 * countries from every selected region, adds the admin's "extra
 * allowed countries", then removes anything in the "blocked
 * countries" list — giving a single flat allow-list the storefront
 * checks each visitor against.
 *
 * `WORLDWIDE` is the special "no country filter" preset (still
 * subject to the blocked-countries list, so the admin can ship
 * "everywhere except these few" by picking WORLDWIDE + a denylist).
 */
export type GeoRegionKey =
    | 'EUROPE' | 'EU' | 'EEA' | 'BRITISH_ISLES' | 'UK_ONLY'
    | 'NORTH_AMERICA' | 'OCEANIA' | 'WORLDWIDE';

const EU_27: string[] = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
    'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT',
    'RO', 'SK', 'SI', 'ES', 'SE',
];

const EEA_EXTRA = ['IS', 'LI', 'NO']; // EEA non-EU members
const NON_EU_EUROPE: string[] = [
    // The rest of geographic Europe — micro-states, Western Balkans,
    // Eastern Europe. Russia/Belarus included so the admin has a
    // single switch + the freedom to add them to the denylist if
    // they don't want to sell there.
    'GB', 'CH', 'NO', 'IS', 'LI',
    'AL', 'AD', 'BA', 'BY', 'FO', 'GI', 'IM', 'JE', 'GG',
    'MC', 'ME', 'MD', 'MK', 'RS', 'SM', 'UA', 'VA', 'XK', 'RU',
];

const EUROPE: string[] = Array.from(new Set([...EU_27, ...NON_EU_EUROPE]));

const REGION_TO_COUNTRIES: Record<GeoRegionKey, string[] | null> = {
    EUROPE,
    EU: EU_27,
    EEA: Array.from(new Set([...EU_27, ...EEA_EXTRA])),
    BRITISH_ISLES: ['GB', 'IE', 'IM', 'JE', 'GG', 'FO'],
    UK_ONLY: ['GB'],
    NORTH_AMERICA: ['US', 'CA', 'MX'],
    OCEANIA: ['AU', 'NZ'],
    WORLDWIDE: null, // null = no country restriction; denylist still applies
};

/**
 * Resolve an admin's geo-block selections into a final country
 * allow-list (or `null` meaning "allow any country").
 *
 *   final = (∪ region.expand for r in regions) ∪ extraAllowed − blocked
 *
 * Returns `null` if WORLDWIDE is among the selected regions AND there's
 * no other constraint that would make the resolved set finite — the
 * caller then skips the country check and only applies the denylist.
 */
export function resolveAllowedCountries(input: {
    regions: string[];
    extraAllowed: string[];
    blocked: string[];
}): { allowed: string[] | null; blocked: string[] } {
    const norm = (s: string) => s.trim().toUpperCase();
    const regions = (input.regions || []).map(norm) as GeoRegionKey[];
    const extra = (input.extraAllowed || []).map(norm);
    const blocked = (input.blocked || []).map(norm);

    // Worldwide short-circuits — denylist is the only constraint.
    if (regions.includes('WORLDWIDE')) {
        return { allowed: null, blocked };
    }

    const allowed = new Set<string>();
    for (const r of regions) {
        const countries = REGION_TO_COUNTRIES[r];
        if (countries) for (const c of countries) allowed.add(c);
    }
    for (const c of extra) allowed.add(c);
    for (const c of blocked) allowed.delete(c);
    return { allowed: Array.from(allowed).sort(), blocked };
}
