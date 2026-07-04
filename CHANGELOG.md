# Changelog

All notable changes to `@huloglobal/vendure-plugin-geo-block` are documented
here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] — 2026-07-04

### Added
- Boot-time compatibility check via the new SDK helper
  `warnIfIncompatibleVendure()`. Logs a non-fatal warning when the runtime
  `@vendure/core` version is outside the tested range. Silent when inside;
  fail-open on unparseable versions.

### Changed
- Peer dep on `@vendure/core` tightened to `>=3.5.0 <4.0.0` — Vendure 3.5,
  3.6 and 3.7 are all covered. Anything under 3.5 has never been tested;
  anything from 4.0 upwards is deferred until the changelog is reviewed.
- Uses `@huloglobal/vendure-licence-sdk@^0.6.0`.

## [0.5.0] — 2026-06-23

### Added
- Vendure Admin API GraphQL extensions. Operator endpoints are now
  first-class GraphQL queries and mutations alongside the existing REST
  admin endpoints: `geoBlockPresets`, `geoBlockChannels`, `geoBlockStats`
  (paid), `geoBlockSaveChannel`, `geoBlockSimulate` (paid).
- Storefront paths (`/geo-block/check`, `/geo-block/site-config`) stay
  REST — they're anonymous, high-frequency, cacheable at the edge, and
  GraphQL was never the right shape for them.

## [0.4.0] — 2026-06-23

### Added
- Tier-gating on every premium feature via the SDK's `isLicensed()`
  helper. Unlicensed installs get:
  - only the 5 free-tier region presets (Worldwide, UK, EU, North
    America, Oceania) instead of all 37;
  - `mode` forced to `block` — no soft-block;
  - no audit log persistence;
  - no subdivision map honoured;
  - 402 on the stats + simulator endpoints.

  Commenting out a boot check no longer unlocks anything — the gates
  are enforced at each call site.
- Anti-tamper heartbeat via the SDK. Anonymous daily fingerprint of
  the embedded public key + verifier source. No personal data.

### Changed
- Relicensed the GitHub source to AGPL-3.0. Published npm builds remain
  under the commercial licence documented at
  <https://huloglobal.com/legal/terms/>.
- npm builds now include Sigstore provenance attestations.

## [0.3.2] — 2026-06-21

### Changed
- 44px minimum tap targets on every interactive element in the admin UI.

## [0.3.1] — 2026-06-21

### Changed
- Comprehensive README refresh — documents the full v0.3 feature set
  including the 37 region presets, generic subdivisions catalogue,
  security primitives, and opt-in retention.

## [0.3.0] — 2026-06-20

### Added
- Generic country-subdivisions schema. New channel custom field
  `geoBlockAllowedSubdivisions` storing a JSON map
  `{ "US": ["CA","NY"], "DE": ["BY"] }`. Storefront enforcement checks
  both the new map and the legacy GB-only field.
- Curated subdivision catalogue for 11 countries (GB, US, CA, AU, DE,
  IT, FR, ES, IN, BR, MX) — 200+ subdivisions, surfaced at
  `GET /geo-block/subdivisions`.
- Admin UI: subdivisions hidden behind a toggle by default; pick any
  country to apply a subdivision filter.
- Rate limiter (120 requests / 60s default) on `/site-config` + `/check`.
- HMAC-gated `?country=` override on `/check` (`signingSecret`).
- Hashed audit IPs by default (`hashAuditIps`, `ipSalt`).
- Security headers on every response.
- Opt-in retention sweeper via `options.retention`.

## [0.2.3] — 2026-06-20

### Changed
- Mobile-friendly admin UI — channel row + tab bar stack and scroll
  horizontally, preset and mode grids collapse to single column.

## [0.2.2] — 2026-06-20

### Changed
- Republish targeting `@huloglobal/vendure-licence-sdk@^0.2.0`.

## [0.2.1] — 2026-06-20

### Added
- `UpdateChecker` integration — `/geo-block/status` endpoint returns
  version + update info; admin banner appears on new releases.

## [0.2.0] — 2026-06-20

### Added
- **37 region presets** (up from 8) — EU, EEA, EFTA, Schengen, Nordic,
  Baltic, Benelux, DACH, Iberia, Balkans, GCC, MENA, ASEAN, APAC, East
  Asia, South Asia, LATAM, Central America, Caribbean, Africa, G7, G20,
  BRICS, OECD, NATO, Five Eyes, Commonwealth, English-speaking, and more.
- **Soft-block mode** — per-channel `mode` field (`block` or `soft`).
  Soft mode renders the storefront with a "we don't ship here" banner
  instead of hiding it.
- **IP allowlist with IPv4 CIDR** — per-channel list of IPs / ranges
  that bypass every rule. For offices, oncall, payment processors.
- **Audit log** — new `GeoBlockEvent` entity records every block
  decision (country, region, IP, UA, reason).
- **Stats endpoint** — `GET /geo-block/admin/stats` returns block totals,
  top blocked countries, daily series and reason breakdown.
- **Simulator endpoint** — `POST /geo-block/admin/simulate` dry-runs a
  hypothetical visitor against current rules without persisting anything.
- **Custom block page** — per-channel `blockMessage`, `blockRedirectUrl`,
  `blockLogoUrl` fields.
- **Scheduled maintenance window** — plugin option for a one-shot
  date-range lockdown (every visitor blocked except the IP allowlist).
- **Per-request `/geo-block/check` endpoint** — visitors can be checked
  on the fly with logging to the audit table.
- **Presets catalogue endpoint** — `GET /geo-block/presets` lists every
  preset with metadata (kind, description, country count).
- Redesigned admin UI: five tabs (Rules / Block page / IP allowlist /
  Simulate / Stats) with filterable preset picker, soft/hard mode
  toggle and a live simulator.

### Changed
- Admin UI now calls `/geo-block/admin/*` directly (no `/ees/` prefix).
- `isAllowed()` and `ipMatchesAny()` exported for downstream use.

## [0.1.0] — 2026-06-19

### Added
- `GeoBlockPlugin` registering five Channel customFields per channel
  (enable toggle, region presets, allowed countries, blocked countries,
  UK region sub-filter).
- Public `/geo-block/site-config` endpoint serving a flat resolved
  allow-list per channel.
- Admin endpoints `/geo-block/admin/channels` and `/geo-block/admin/save`.
- Dedicated admin UI page with mode picker, region preset cards, chip
  pickers, live preview of the resolved allow-list.
- `resolveAllowedCountries` exported as a pure helper.
- Licence verification via `@huloglobal/vendure-licence-sdk` with
  revocation polling.

[0.6.0]: https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v0.6.0
[0.5.0]: https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v0.5.0
[0.4.0]: https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v0.4.0
[0.3.2]: https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v0.3.2
[0.3.1]: https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v0.3.1
[0.3.0]: https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v0.3.0
[0.2.3]: https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v0.2.3
[0.2.2]: https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v0.2.2
[0.2.1]: https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v0.2.1
[0.2.0]: https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v0.2.0
[0.1.0]: https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v0.1.0
