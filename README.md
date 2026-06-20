# @huloglobal/vendure-plugin-geo-block

Per-channel storefront geo-restriction for Vendure. Allow / block traffic
by country, by curated region preset (EU, EEA, British Isles, all of
Europe, North America, Oceania, Worldwide-with-denylist), and by UK
subdivision (England / Wales / Scotland / Northern Ireland).

Maintained by Wayne Garrison.

## What you get

- **Five clean Channel customFields** registered automatically — the
  consumer doesn't have to repeat them in their `vendure-config.ts`.
- **Public flat endpoint** at `GET /geo-block/site-config` returning the
  resolved allow-list as JSON, intended to be polled (and cached) by
  the storefront. Identifies the channel via the standard
  `vendure-token` header (same one shop-api uses).
- **Admin endpoints** at `/geo-block/admin/channels` (read) and
  `/geo-block/admin/save` (write) backing the dedicated admin page.
- **Dedicated admin UI** under EES Plugins nav: mode-picker (allow
  specific places / allow worldwide except blocked), preset cards
  (one-click region bundles), chip pickers for extras and blocks, live
  preview of the resolved allow-list, UK-region sub-filter when GB is
  resolved as allowed.
- **Reusable resolver**: `resolveAllowedCountries({ regions,
  extraAllowed, blocked })` is exported as a pure function for
  downstream code.

## Install

```bash
yarn add @huloglobal/vendure-plugin-geo-block
```

## Wire up

```ts
import { GeoBlockPlugin } from '@huloglobal/vendure-plugin-geo-block';

export const config: VendureConfig = {
  plugins: [
    GeoBlockPlugin.init({
      publicBaseUrl: 'https://shop.example.com',
      licenceKey: process.env.HULO_LICENCE_KEY,
    }),
  ],
};
```

Add the admin UI extension:

```ts
import { GeoBlockPlugin } from '@huloglobal/vendure-plugin-geo-block';

compileUiExtensions({
  outputPath: 'admin-ui',
  extensions: [GeoBlockPlugin.uiExtensions /* + your other extensions */],
});
```

## Storefront integration

The plugin only manages **configuration**. Your storefront enforces the
block by polling the resolved allow-list and comparing it to the
visitor's resolved country. A Qwik / Next / Nuxt example using
MaxMind GeoLite2 for the lookup:

```ts
// Fetch + cache the per-channel config (60s TTL).
const cfg = await fetch('https://shop.example.com/geo-block/site-config?token=' + channelToken)
  .then(r => r.json());

if (cfg.geoBlock.enabled) {
  const visitorCountry = /* run a MaxMind lookup on the visitor IP */;
  const allowed =
    cfg.geoBlock.allowedCountries === null
    || cfg.geoBlock.allowedCountries.includes(visitorCountry);
  if (!allowed || cfg.geoBlock.blockedCountries.includes(visitorCountry)) {
    return new Response('Site temporarily unavailable.', { status: 503 });
  }
}
```

## Behind Cloudflare / nginx / Akamai

The geo-block plugin itself doesn't need an IP — it just serves a
resolved allow-list per channel. The **storefront** does the visitor
lookup. Two paths to wire it up:

### Path 1: use Cloudflare's resolved country header (zero infrastructure)

When the "IP Geolocation → Send country data to origin" toggle is on
in your Cloudflare dashboard (free plan), every request arrives with
`CF-IPCountry: GB` already populated. Read it directly in your
storefront:

```ts
const country = req.headers['cf-ipcountry'] || null;
if (cfg.geoBlock.enabled && !cfg.geoBlock.allowedCountries?.includes(country)) {
  return new Response('Site temporarily unavailable.', { status: 503 });
}
```

Enable "Send subdivision data" too to also get `CF-Region-Code`
(`ENG`, `WLS`, `SCT`, `NIR`) for UK subdivision filtering.

### Path 2: self-hosted GeoIP lookup (works behind nginx / any proxy)

If you're not on Cloudflare, look the visitor IP up via MaxMind
GeoLite2-City in the storefront. The free `geolite2-redist` npm
package mirrors the database without requiring a MaxMind account:

```ts
import { open } from 'geolite2-redist';
import { Reader } from '@maxmind/geoip2-node';

const reader = await open('GeoLite2-City', p => Reader.open(p));

// Real IP from nginx / Caddy. The plugin's proxy-headers helper does
// the same precedence as the email-tracking plugin's IP extractor:
//   cf-connecting-ip → true-client-ip → x-real-ip → x-forwarded-for[0]
const ip = req.headers['cf-connecting-ip']
        || req.headers['x-real-ip']
        || (req.headers['x-forwarded-for'] || '').split(',')[0].trim();

const r = reader.city(ip);
const country = r.country?.isoCode || null;
```

Both paths are documented end-to-end in the plugin's example
storefront snippets at [the README on GitHub](https://github.com/exceeded/vendure-plugin-geo-block).

## Init options

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `publicBaseUrl` | `string` | yes | Public hostname of your Vendure server. Used in licence host-match. |
| `licenceKey` | `string` | no* | JWT licence key. Without it `enabled` is forced to `false`. |

\* Required for production use. Buy at
`https://elite-software.co.uk/licence/buy/vendure-plugin-geo-block`.

## Licence

Commercial — see [LICENSE](./LICENSE). Requires an active subscription
($9.95/mo) or a perpetual licence.
