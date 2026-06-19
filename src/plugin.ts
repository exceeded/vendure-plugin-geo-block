import { LanguageCode, PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { RevocationChecker, verifyLicence } from '@hulo/vendure-licence-sdk';
import { GeoBlockController } from './geo-block.controller';

export interface GeoBlockPluginOptions {
    /** Public-facing host of the Vendure server. Used in licence
     *  domain matching — must match one of the JWT's `allowedDomains`. */
    publicBaseUrl: string;
    /** JWT licence key. Without it, the public site-config endpoint
     *  still resolves the rules but always returns `enabled: false`. */
    licenceKey?: string;
}

const HULO_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoLmNM5UljRqe71drM6lR
Ba5vXrLOcV3GAHkYvnVFQSqdE0avrge/jsD7WdA6x8qQFNRugxQcxDJa2l0+C+BH
SbU9TimGwhA1yusHHfuz9LAXks5IQ48+2e6Pulh7iThXPJUnIKqKZUN5HhL79aaK
vrZKIgSfVhwE5PMPXWZ+Ij5IRf74PLIUn1Er75qhBXlDJ4vF8y8/3owURNC1XiUB
DGElwV/LYNoqAQei4oixe4EAxPGvFi11pgHiGuRxuWckA88y6ZHLt6urfAY9sCkj
kF+2dc2yS3j7lD+SYAaV5LQYYjePP1CYvxCZ7HHRKqthHopxY1hsK2tBtni3f7/c
UwIDAQAB
-----END PUBLIC KEY-----`;

const PLUGIN_ID = 'vendure-plugin-geo-block';
const REVOCATION_URL = process.env.HULO_LICENCE_REVOCATION_URL
    || 'https://elite.charity/licence/revoked.json';

let cachedOptions: GeoBlockPluginOptions = { publicBaseUrl: 'http://localhost:3000' };
export function getOptions(): GeoBlockPluginOptions { return cachedOptions; }

/**
 * `@hulo/vendure-plugin-geo-block`
 *
 * Per-channel geo-restriction for Vendure storefronts. The plugin owns
 * a flat `/geo-block/site-config` endpoint the storefront polls (cached
 * client-side) plus an admin page for configuring region presets,
 * extra allowed countries, denylist, and UK-region subfilter.
 *
 * Add to your Vendure config:
 *
 * ```ts
 * import { GeoBlockPlugin } from '@hulo/vendure-plugin-geo-block';
 *
 * export const config: VendureConfig = {
 *   plugins: [
 *     GeoBlockPlugin.init({
 *       publicBaseUrl: 'https://shop.example.com',
 *       licenceKey: process.env.HULO_LICENCE_KEY,
 *     }),
 *   ],
 * };
 * ```
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [GeoBlockController],
    compatibility: '^3.0.0',
    configuration: config => {
        config.customFields.Channel = (config.customFields.Channel || []).concat([
            {
                name: 'geoBlockEnabled', type: 'boolean', public: true, defaultValue: false,
                label: [{ languageCode: LanguageCode.en, value: 'Site: Geo-block enabled' }],
                description: [{ languageCode: LanguageCode.en, value: 'When on, visitors outside the allowed countries (and UK regions, if GB is allowed) see a "down for maintenance" page instead of the storefront.' }],
            },
            {
                name: 'geoBlockAllowedRegions', type: 'string', list: true, public: true,
                defaultValue: [],
                label: [{ languageCode: LanguageCode.en, value: 'Site: Geo-block allowed regions (presets)' }],
                description: [{ languageCode: LanguageCode.en, value: 'One-click region presets. Combine with extra/blocked countries below.' }],
                options: [
                    { value: 'UK_ONLY', label: [{ languageCode: LanguageCode.en, value: 'United Kingdom only' }] },
                    { value: 'BRITISH_ISLES', label: [{ languageCode: LanguageCode.en, value: 'British Isles (GB, IE, IoM, CI, Faroes)' }] },
                    { value: 'EU', label: [{ languageCode: LanguageCode.en, value: 'European Union (27)' }] },
                    { value: 'EEA', label: [{ languageCode: LanguageCode.en, value: 'EEA (EU + IS, LI, NO)' }] },
                    { value: 'EUROPE', label: [{ languageCode: LanguageCode.en, value: 'Whole Europe (incl. UK, RU, UA, micro-states)' }] },
                    { value: 'NORTH_AMERICA', label: [{ languageCode: LanguageCode.en, value: 'North America (US, CA, MX)' }] },
                    { value: 'OCEANIA', label: [{ languageCode: LanguageCode.en, value: 'Oceania (AU, NZ)' }] },
                    { value: 'WORLDWIDE', label: [{ languageCode: LanguageCode.en, value: 'Worldwide — only blocked countries excluded' }] },
                ],
            },
            {
                name: 'geoBlockAllowedCountries', type: 'string', list: true, public: true,
                defaultValue: [],
                label: [{ languageCode: LanguageCode.en, value: 'Site: Extra allowed countries (ISO 3166-1 alpha-2)' }],
                description: [{ languageCode: LanguageCode.en, value: 'Countries allowed on top of the selected regions. Use ISO codes (GB, IE, FR, US…).' }],
            },
            {
                name: 'geoBlockBlockedCountries', type: 'string', list: true, public: true,
                defaultValue: [],
                label: [{ languageCode: LanguageCode.en, value: 'Site: Always-blocked countries' }],
                description: [{ languageCode: LanguageCode.en, value: 'Subtracted from the resolved allow-list. Useful for blocking specific countries inside a region you otherwise allow.' }],
            },
            {
                name: 'geoBlockAllowedGbRegions', type: 'string', list: true, public: true,
                defaultValue: [],
                label: [{ languageCode: LanguageCode.en, value: 'Site: Geo-block allowed UK regions' }],
                description: [{ languageCode: LanguageCode.en, value: 'When GB is resolved as allowed, additionally restrict to ENG / WLS / SCT / NIR. Empty = whole UK allowed.' }],
            },
        ]);
        return config;
    },
})
export class GeoBlockPlugin {
    private static revocation: RevocationChecker | null = null;

    static init(options: GeoBlockPluginOptions): Type<GeoBlockPlugin> {
        cachedOptions = options;

        if (!GeoBlockPlugin.revocation) {
            GeoBlockPlugin.revocation = new RevocationChecker(REVOCATION_URL);
            GeoBlockPlugin.revocation.start();
        }

        const host = (options.publicBaseUrl || '')
            .replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        const status = verifyLicence({
            licenceKey: options.licenceKey,
            pluginId: PLUGIN_ID,
            host,
            publicKey: HULO_PUBLIC_KEY,
            revokedIds: GeoBlockPlugin.revocation.getRevokedIds(),
        });

        if (!status.valid) {
            // eslint-disable-next-line no-console
            console.warn(
                `[@hulo/vendure-plugin-geo-block] ${status.message}` +
                ` — Running in unlicensed mode (settings still saveable, but the public endpoint always reports enabled=false). Purchase a key at https://elite-software.co.uk/licence/buy/${PLUGIN_ID}`,
            );
        }

        return GeoBlockPlugin;
    }

    static uiExtensions = {
        extensionPath: __dirname + '/../ui',
        ngModules: [
            {
                type: 'lazy' as const,
                route: 'geo-block',
                ngModuleFileName: 'geo-block.module.ts',
                ngModuleName: 'GeoBlockModule',
            },
        ],
    };
}
