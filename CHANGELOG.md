# Changelog

All notable changes to `@hulo/vendure-plugin-geo-block` are documented
here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [semantic versioning](https://semver.org/spec/v2.0.0.html).

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
- Licence verification via `@hulo/vendure-licence-sdk` with revocation
  polling.
