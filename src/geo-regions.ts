/**
 * Region presets for the storefront geo-block.
 *
 * Each preset is a hand-curated ISO-3166-1 alpha-2 country list. Admins
 * tick presets in the UI; the resolver unions them, adds any extra
 * countries, removes anything in the denylist, and emits a flat allow
 * list the storefront enforces.
 *
 * `WORLDWIDE` is the special "no country filter" preset — still subject
 * to the denylist, so an admin can ship "everywhere except a few".
 */

const EU_27 = [
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU',
    'IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
] as const;

const EEA_EXTRA = ['IS','LI','NO'] as const;
const EFTA = ['CH','IS','LI','NO'] as const;
const SCHENGEN_NON_EU = ['CH','IS','LI','NO'] as const;

const BRITISH_ISLES = ['GB','IE','IM','JE','GG','FO'] as const;
const UK_CROWN_DEPENDENCIES = ['GB','IM','JE','GG'] as const;

const NON_EU_EUROPE = [
    'GB','CH','NO','IS','LI',
    'AL','AD','BA','BY','FO','GI','IM','JE','GG',
    'MC','ME','MD','MK','RS','SM','UA','VA','XK','RU',
] as const;
const EUROPE = Array.from(new Set([...EU_27, ...NON_EU_EUROPE]));

const NORTH_AMERICA = ['US','CA','MX'] as const;
const CENTRAL_AMERICA = ['BZ','CR','SV','GT','HN','NI','PA'] as const;
const CARIBBEAN = ['AG','BS','BB','CU','DM','DO','GD','HT','JM','KN','LC','VC','TT'] as const;
const SOUTH_AMERICA = ['AR','BO','BR','CL','CO','EC','GY','PY','PE','SR','UY','VE'] as const;
const LATAM = Array.from(new Set([
    ...CENTRAL_AMERICA, ...SOUTH_AMERICA, ...CARIBBEAN, 'MX',
]));

const OCEANIA = ['AU','NZ','FJ','PG','SB','VU','WS','TO'] as const;
const ANZ = ['AU','NZ'] as const;

const GCC = ['BH','KW','OM','QA','SA','AE'] as const;
const MENA = [
    'DZ','BH','EG','IQ','JO','KW','LB','LY','MA','OM','PS','QA','SA',
    'SY','TN','AE','YE',
] as const;

const NORDIC = ['DK','FI','IS','NO','SE'] as const;
const BALTIC = ['EE','LV','LT'] as const;
const BENELUX = ['BE','NL','LU'] as const;
const DACH = ['DE','AT','CH'] as const;
const IBERIA = ['ES','PT'] as const;
const BALKANS = ['AL','BA','BG','HR','GR','XK','ME','MK','RO','RS','SI'] as const;

const ASEAN = ['BN','KH','ID','LA','MY','MM','PH','SG','TH','VN'] as const;
const APAC = [
    'AU','BN','CN','HK','IN','ID','JP','KR','KH','LA','MY','MM','NZ',
    'PH','SG','TH','TW','VN',
] as const;
const EAST_ASIA = ['CN','HK','JP','KR','MO','MN','TW'] as const;
const SOUTH_ASIA = ['BD','BT','IN','MV','NP','LK','PK'] as const;

const AFRICA = [
    'DZ','AO','BJ','BW','BF','BI','CM','CV','CF','TD','KM','CD','CG',
    'CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE',
    'LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG',
    'RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG',
    'ZM','ZW',
] as const;

const G7 = ['CA','FR','DE','IT','JP','GB','US'] as const;
const G20 = [
    'AR','AU','BR','CA','CN','FR','DE','IN','ID','IT','JP','KR','MX',
    'RU','SA','ZA','TR','GB','US',
] as const;
const BRICS = ['BR','RU','IN','CN','ZA'] as const;
const OECD = [
    'AU','AT','BE','CA','CL','CO','CR','CZ','DK','EE','FI','FR','DE',
    'GR','HU','IS','IE','IL','IT','JP','KR','LV','LT','LU','MX','NL',
    'NZ','NO','PL','PT','SK','SI','ES','SE','CH','TR','GB','US',
] as const;

const ENGLISH_SPEAKING = [
    'AU','BS','BB','BZ','CA','DM','FJ','GD','GY','IE','JM','KE','LR',
    'MW','MT','NZ','NG','PG','SC','SG','SL','SB','ZA','LK','TZ','TT',
    'UG','GB','US','ZM','ZW',
] as const;

const COMMONWEALTH = [
    'AG','AU','BS','BD','BB','BZ','BW','BN','CM','CA','CY','DM','SZ',
    'FJ','GM','GH','GD','GY','IN','JM','KE','KI','LS','MW','MY','MV',
    'MT','MU','MZ','NA','NR','NZ','NG','PK','PG','RW','KN','LC','VC',
    'WS','SC','SL','SG','SB','ZA','LK','TZ','TO','TT','TV','UG','GB',
    'VU','ZM',
] as const;

const FIVE_EYES = ['AU','CA','NZ','GB','US'] as const;

const NATO = [
    'AL','BE','BG','CA','HR','CZ','DK','EE','FI','FR','DE','GR','HU',
    'IS','IT','LV','LT','LU','MK','ME','NL','NO','PL','PT','RO','SK',
    'SI','ES','SE','TR','GB','US',
] as const;

export type GeoRegionKey =
    | 'EUROPE' | 'EU' | 'EEA' | 'EFTA' | 'SCHENGEN' | 'NORDIC' | 'BALTIC'
    | 'BENELUX' | 'DACH' | 'IBERIA' | 'BALKANS'
    | 'BRITISH_ISLES' | 'UK_CROWN_DEPENDENCIES' | 'UK_ONLY'
    | 'NORTH_AMERICA' | 'CENTRAL_AMERICA' | 'CARIBBEAN' | 'SOUTH_AMERICA' | 'LATAM'
    | 'OCEANIA' | 'ANZ'
    | 'GCC' | 'MENA'
    | 'ASEAN' | 'APAC' | 'EAST_ASIA' | 'SOUTH_ASIA'
    | 'AFRICA'
    | 'G7' | 'G20' | 'BRICS' | 'OECD' | 'NATO' | 'FIVE_EYES'
    | 'ENGLISH_SPEAKING' | 'COMMONWEALTH'
    | 'WORLDWIDE';

const REGION_TO_COUNTRIES: Record<GeoRegionKey, readonly string[] | null> = {
    EUROPE,
    EU: EU_27,
    EEA: Array.from(new Set([...EU_27, ...EEA_EXTRA])),
    EFTA,
    SCHENGEN: Array.from(new Set([...EU_27, ...SCHENGEN_NON_EU])),
    NORDIC, BALTIC, BENELUX, DACH, IBERIA, BALKANS,
    BRITISH_ISLES,
    UK_CROWN_DEPENDENCIES,
    UK_ONLY: ['GB'],
    NORTH_AMERICA,
    CENTRAL_AMERICA,
    CARIBBEAN,
    SOUTH_AMERICA,
    LATAM,
    OCEANIA,
    ANZ,
    GCC,
    MENA,
    ASEAN,
    APAC,
    EAST_ASIA,
    SOUTH_ASIA,
    AFRICA,
    G7, G20, BRICS, OECD, NATO, FIVE_EYES,
    ENGLISH_SPEAKING,
    COMMONWEALTH,
    WORLDWIDE: null,
};

/**
 * Human-readable metadata for each preset, for the admin UI.
 * `kind` groups presets in the picker UI ("Trade blocs", "Geography", etc).
 */
export interface RegionPresetMeta {
    key: GeoRegionKey;
    label: string;
    kind: 'geography' | 'trade' | 'political' | 'language' | 'all';
    description: string;
    countryCount: number | null;
}

export const REGION_PRESETS: RegionPresetMeta[] = [
    { key: 'WORLDWIDE', label: 'Worldwide', kind: 'all', description: 'Allow every country (denylist still applies).', countryCount: null },

    { key: 'UK_ONLY', label: 'United Kingdom only', kind: 'geography', description: 'GB only — pair with UK-region filter for England-and-Wales setups.', countryCount: 1 },
    { key: 'BRITISH_ISLES', label: 'British Isles', kind: 'geography', description: 'GB + IE + the Crown Dependencies + Faroe Islands.', countryCount: 6 },
    { key: 'UK_CROWN_DEPENDENCIES', label: 'UK + Crown Dependencies', kind: 'geography', description: 'GB plus Isle of Man, Jersey and Guernsey.', countryCount: 4 },
    { key: 'EUROPE', label: 'Geographic Europe', kind: 'geography', description: 'All European countries (EU + non-EU + micro-states + Russia).', countryCount: EUROPE.length },
    { key: 'EU', label: 'European Union (27)', kind: 'trade', description: 'All 27 EU member states.', countryCount: 27 },
    { key: 'EEA', label: 'EEA', kind: 'trade', description: 'EU 27 + Iceland, Liechtenstein, Norway.', countryCount: 30 },
    { key: 'EFTA', label: 'EFTA', kind: 'trade', description: 'Switzerland, Iceland, Liechtenstein, Norway.', countryCount: 4 },
    { key: 'SCHENGEN', label: 'Schengen Area', kind: 'political', description: 'EU 27 (excl. opt-outs) + non-EU Schengen members.', countryCount: 31 },
    { key: 'NORDIC', label: 'Nordic countries', kind: 'geography', description: 'Denmark, Finland, Iceland, Norway, Sweden.', countryCount: 5 },
    { key: 'BALTIC', label: 'Baltic states', kind: 'geography', description: 'Estonia, Latvia, Lithuania.', countryCount: 3 },
    { key: 'BENELUX', label: 'Benelux', kind: 'geography', description: 'Belgium, Netherlands, Luxembourg.', countryCount: 3 },
    { key: 'DACH', label: 'DACH', kind: 'language', description: 'German-speaking: Germany, Austria, Switzerland.', countryCount: 3 },
    { key: 'IBERIA', label: 'Iberian Peninsula', kind: 'geography', description: 'Spain and Portugal.', countryCount: 2 },
    { key: 'BALKANS', label: 'Balkans', kind: 'geography', description: 'South-east Europe — Albania to Slovenia.', countryCount: BALKANS.length },

    { key: 'NORTH_AMERICA', label: 'North America', kind: 'geography', description: 'US, Canada, Mexico.', countryCount: 3 },
    { key: 'CENTRAL_AMERICA', label: 'Central America', kind: 'geography', description: 'Belize to Panama.', countryCount: CENTRAL_AMERICA.length },
    { key: 'CARIBBEAN', label: 'Caribbean', kind: 'geography', description: 'Caribbean island nations.', countryCount: CARIBBEAN.length },
    { key: 'SOUTH_AMERICA', label: 'South America', kind: 'geography', description: 'All 12 South American countries.', countryCount: 12 },
    { key: 'LATAM', label: 'Latin America', kind: 'geography', description: 'Central + South America + Caribbean + Mexico.', countryCount: LATAM.length },

    { key: 'OCEANIA', label: 'Oceania', kind: 'geography', description: 'Australia, NZ, and major Pacific nations.', countryCount: OCEANIA.length },
    { key: 'ANZ', label: 'Australia + New Zealand', kind: 'geography', description: 'AU and NZ only.', countryCount: 2 },

    { key: 'GCC', label: 'GCC', kind: 'trade', description: 'Gulf Cooperation Council: BH, KW, OM, QA, SA, AE.', countryCount: 6 },
    { key: 'MENA', label: 'MENA', kind: 'geography', description: 'Middle East and North Africa.', countryCount: MENA.length },

    { key: 'ASEAN', label: 'ASEAN', kind: 'trade', description: 'South-east Asia: 10 ASEAN member states.', countryCount: 10 },
    { key: 'APAC', label: 'APAC', kind: 'geography', description: 'Broad Asia-Pacific region.', countryCount: APAC.length },
    { key: 'EAST_ASIA', label: 'East Asia', kind: 'geography', description: 'China, Hong Kong, Japan, Korea, Taiwan, Macau, Mongolia.', countryCount: EAST_ASIA.length },
    { key: 'SOUTH_ASIA', label: 'South Asia', kind: 'geography', description: 'Indian subcontinent.', countryCount: SOUTH_ASIA.length },

    { key: 'AFRICA', label: 'Africa', kind: 'geography', description: 'All African nations.', countryCount: AFRICA.length },

    { key: 'G7', label: 'G7', kind: 'political', description: 'Group of Seven advanced economies.', countryCount: 7 },
    { key: 'G20', label: 'G20', kind: 'political', description: 'Group of Twenty.', countryCount: 19 },
    { key: 'BRICS', label: 'BRICS', kind: 'political', description: 'Brazil, Russia, India, China, South Africa.', countryCount: 5 },
    { key: 'OECD', label: 'OECD', kind: 'political', description: 'Organisation for Economic Co-operation and Development.', countryCount: OECD.length },
    { key: 'NATO', label: 'NATO', kind: 'political', description: 'NATO member states.', countryCount: NATO.length },
    { key: 'FIVE_EYES', label: 'Five Eyes', kind: 'political', description: 'AU, CA, NZ, GB, US.', countryCount: 5 },

    { key: 'ENGLISH_SPEAKING', label: 'English-speaking countries', kind: 'language', description: 'Countries where English is an official or dominant language.', countryCount: ENGLISH_SPEAKING.length },
    { key: 'COMMONWEALTH', label: 'Commonwealth of Nations', kind: 'language', description: '56 Commonwealth member states.', countryCount: COMMONWEALTH.length },
];

/**
 * Resolve an admin's geo-block selections into a final country
 * allow-list (or `null` meaning "allow any country").
 *
 *   final = (∪ region.expand for r in regions) ∪ extraAllowed − blocked
 *
 * Returns `null` if WORLDWIDE is among the selected regions — the
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

/**
 * Decide whether a given (country, region) tuple is allowed by the
 * resolved rules. Shared by the controller and the admin "what-if"
 * preview, so the storefront and the simulator never drift apart.
 */
export function isAllowed(
    country: string | null,
    gbRegion: string | null,
    rules: {
        enabled: boolean;
        allowedCountries: string[] | null;
        blockedCountries: string[];
        allowedGbRegions: string[];
    },
): { allowed: boolean; reason: 'disabled' | 'denylist' | 'country-not-allowed' | 'uk-region-not-allowed' | 'ok' } {
    if (!rules.enabled) return { allowed: true, reason: 'disabled' };
    const cc = (country || '').toUpperCase();
    const rr = (gbRegion || '').toUpperCase();
    if (cc && rules.blockedCountries.includes(cc)) {
        return { allowed: false, reason: 'denylist' };
    }
    if (rules.allowedCountries !== null && cc && !rules.allowedCountries.includes(cc)) {
        return { allowed: false, reason: 'country-not-allowed' };
    }
    if (cc === 'GB' && rules.allowedGbRegions.length > 0) {
        if (rr && !rules.allowedGbRegions.includes(rr)) {
            return { allowed: false, reason: 'uk-region-not-allowed' };
        }
    }
    return { allowed: true, reason: 'ok' };
}

/** Lightweight IP-in-CIDR check for the allowlist. Supports IPv4 only —
 * enough for the office IPs / payment-processor ranges that the admin
 * typically allowlists. IPv6 entries are checked as plain string match. */
export function ipMatchesAny(ip: string | null | undefined, list: string[]): boolean {
    if (!ip || !list?.length) return false;
    for (const entry of list) {
        const trimmed = entry.trim();
        if (!trimmed) continue;
        if (trimmed === ip) return true;
        if (trimmed.includes('/') && ip.includes('.')) {
            // IPv4 CIDR
            const [base, bitsStr] = trimmed.split('/');
            const bits = parseInt(bitsStr, 10);
            if (isFinite(bits) && bits >= 0 && bits <= 32) {
                const a = ipv4ToInt(ip);
                const b = ipv4ToInt(base);
                if (a !== null && b !== null) {
                    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
                    if ((a & mask) === (b & mask)) return true;
                }
            }
        }
    }
    return false;
}

function ipv4ToInt(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let n = 0;
    for (const p of parts) {
        const o = parseInt(p, 10);
        if (!isFinite(o) || o < 0 || o > 255) return null;
        n = (n << 8) + o;
    }
    return n >>> 0;
}
