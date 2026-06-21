# @huloglobal/vendure-plugin-geo-block

Per-channel storefront geo-restriction for Vendure. Allow / block by
country, by curated region preset (37 of them: EU, EEA, Schengen, GCC,
ANZ, NATO, Commonwealth, …), by ISO-3166-2 subdivision (US states, CA
provinces, AU states, DE Länder, IT regions, FR regions, ES autonomous
communities, IN states, BR units, MX entities, UK constituent
countries). Soft-block mode, IP allowlist, audit log, simulator and
maintenance windows.

Maintained by Wayne Garrison.

## Buy

7-day free trial then **£9.95/month**, or **£199 one-off lifetime** at
[elite.charity/licence/buy/vendure-plugin-geo-block](https://elite.charity/licence/buy/vendure-plugin-geo-block).

## Install

```bash
yarn add @huloglobal/vendure-plugin-geo-block
```

```ts
import { GeoBlockPlugin } from '@huloglobal/vendure-plugin-geo-block';

export const config: VendureConfig = {
    plugins: [
        GeoBlockPlugin.init({
            publicBaseUrl: 'https://shop.example.com',
            licenceKey: process.env.HULO_LICENCE_KEY_GEO_BLOCK,

            // Optional one-shot maintenance lockdown
            maintenanceWindow: {
                startsAt: '2026-07-15T02:00:00Z',
                endsAt:   '2026-07-15T04:00:00Z',
                allowedIps: ['203.0.113.0/24'],
            },

            // -- Security (recommended in production) --
            signingSecret: process.env.HULO_GEO_BLOCK_SIGNING_SECRET,
            hashAuditIps: true,
            ipSalt: process.env.HULO_IP_SALT,
            rateLimit: { capacity: 120, windowMs: 60_000 },

            // -- Retention (opt-in) --
            retention: { days: 90 },
        }),
    ],
};
```

Add `GeoBlockPlugin.uiExtensions` to your `compileUiExtensions` config.

## Feature tour

### 37 region presets

One-click bundles in five groups:

- **Geographic**: UK_ONLY, BRITISH_ISLES, UK_CROWN_DEPENDENCIES, EUROPE,
  NORDIC, BALTIC, BENELUX, IBERIA, BALKANS, NORTH_AMERICA,
  CENTRAL_AMERICA, CARIBBEAN, SOUTH_AMERICA, LATAM, OCEANIA, ANZ, MENA,
  APAC, EAST_ASIA, SOUTH_ASIA, AFRICA
- **Trade blocs**: EU, EEA, EFTA, GCC, ASEAN
- **Political / economic**: SCHENGEN, G7, G20, BRICS, OECD, NATO, FIVE_EYES
- **Language / cultural**: DACH, ENGLISH_SPEAKING, COMMONWEALTH
- **Everywhere**: WORLDWIDE (with the denylist still applied)

`GET /geo-block/presets` returns the live catalogue with country counts
and descriptions.

### Per-channel rules

Each Vendure channel gets its own rules — perfect for multi-storefront
installs (UK-only channel + EU channel + LATAM channel from one Vendure
instance).

### Soft-block mode

Per-channel `mode` field. `block` hides the storefront entirely;
`soft` renders it with a "we don't ship to your country" banner and
hides the checkout button. The verdict `mode` field is returned on
`/geo-block/check` so the storefront knows how to render.

### Generic subdivisions

JSON map `{ "US": ["CA","NY"], "DE": ["BY"] }` enforced on visitors via
the channel custom field `geoBlockAllowedSubdivisions`. Catalogue at
`GET /geo-block/subdivisions` covers 11 countries (200+ subdivisions).
Legacy GB-only `allowedGbRegions` is preserved for back-compat.

### IP allowlist with IPv4 CIDR

Per-channel list of IPs / ranges that bypass every rule. Use for
offices, oncall, payment-processor probes, monitoring.

### Audit log + stats

Every block decision recorded in `geo_block_event` with country, region,
IP (hashed by default), UA, channel and reason. Admin Stats panel
shows top blocked countries, daily series and reason breakdown.

### "What-if" simulator

`POST /geo-block/admin/simulate` dry-runs a hypothetical visitor against
current rules without persisting anything — try any country / UK
region / IP and see exactly what would happen.

### Custom block page

Per-channel `blockMessage`, `blockRedirectUrl`, `blockLogoUrl`. Falls
back to sensible defaults per block reason.

### Proxy-aware

Reads `cf-ipcountry` / Akamai / Fastly region headers when present.
Saves a MaxMind lookup per request.

### Security

- `signingSecret` HMAC-gates the `?country=` override on `/check` so
  storefront staff (or attackers) can't spoof a location at will.
- Audit IPs are SHA-256 hashed by default.
- Rate limiter on every public endpoint.
- Security headers via the licence-sdk helper on every response.

## HTTP endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/geo-block/site-config` | public | resolved channel rules (cache client-side) |
| `GET` | `/geo-block/check` | public | per-request decision + reason (logs to audit) |
| `GET` | `/geo-block/presets` | public | 37-preset catalogue |
| `GET` | `/geo-block/subdivisions` | public | subdivision catalogue (11 countries) |
| `GET` | `/geo-block/admin/channels` | admin | list channels + rules |
| `POST` | `/geo-block/admin/save` | admin | save a channel's rules |
| `GET` | `/geo-block/admin/stats` | admin | block totals + top countries + series |
| `POST` | `/geo-block/admin/simulate` | admin | dry-run a hypothetical visitor |
| `POST` | `/geo-block/admin/gc` | admin | prune old audit rows |
| `GET` | `/geo-block/status` | admin | version + update status |

## Storefront integration

```ts
// On boot: cache the rules
const cfg = await fetch('https://shop.example.com/geo-block/site-config', {
    headers: { 'vendure-token': CHANNEL_TOKEN },
}).then(r => r.json());

// Per request: get a decision (and audit it)
const verdict = await fetch('https://shop.example.com/geo-block/check', {
    headers: {
        'vendure-token': CHANNEL_TOKEN,
        'cf-ipcountry': req.headers['cf-ipcountry'] ?? '',
    },
}).then(r => r.json());
if (!verdict.allowed) {
    if (verdict.redirectUrl) return res.redirect(302, verdict.redirectUrl);
    return res.render('blocked', { message: verdict.message, mode: verdict.mode });
}
```

## Documentation

User manual + screenshots:
[huloglobal.com/vendure-plugins/geo-block/docs/](https://huloglobal.com/vendure-plugins/geo-block/docs/)

## Licence

Commercial. Buy at
[elite.charity/licence/buy/vendure-plugin-geo-block](https://elite.charity/licence/buy/vendure-plugin-geo-block).
