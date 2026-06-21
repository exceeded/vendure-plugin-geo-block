# Changelog

All notable changes to `@huloglobal/vendure-plugin-geo-block` are documented
here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1]

### Changed
- Comprehensive README refresh — documents the full v0.3 feature set
  including the 37 region presets, generic subdivisions catalogue,
  security primitives, and opt-in retention.

## [0.3.0]

### Added
- Generic country-subdivisions schema. New channel custom field
  `geoBlockAllowedSubdivisions` storing a JSON map
  `{ "US": ["CA","NY"], "DE": ["BY"] }`. Storefront enforcement
  checks both the new map and the legacy GB-only field.
- Curated subdivision catalogue for 11 countries (GB, US, CA, AU, DE,
  IT, FR, ES, IN, BR, MX) — 200+ subdivisions, surfaced at
  `GET /geo-block/subdivisions`.
- Admin UI: subdivisions hidden behind a toggle by default; pick any
  country to apply a subdivision filter.
- Rate limiter (120/60s default) on `/site-config` + `/check`.
- HMAC-gated `?country=` override on `/check` (`signingSecret`).
- Hashed audit IPs by default (`hashAuditIps`, `ipSalt`).
- Security headers on every response.
- Opt-in retention sweeper via `options.retention`.

## [0.2.3]

### Changed
- Mobile-friendly admin UI — channel row + tab bar stack and scroll
  horizontally, preset and mode grids collapse to single column.

## [0.2.2]

### Changed
- Republish targeting `@huloglobal/vendure-licence-sdk@^0.2.0`.

## [0.2.1]

### Added
- `UpdateChecker` integration — `/geo-block/status` endpoint returns
  version + update info; admin banner appears on new releases.

## [0.2.0]

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
  Simulate / Stats) with filterable preset picker, soft/hard mode toggle
  and a live simulator.

### Changed
- Admin UI now calls `/geo-block/admin/*` directly (no `/ees/` prefix).
- `isAllowed()` and `ipMatchesAny()` exported for downstream use.

## [0.1.0] — Unreleased

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
- Licence verification via `@huloglobal/vendure-licence-sdk` with revocation
  polling.
