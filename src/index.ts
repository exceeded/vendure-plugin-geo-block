/**
 * `@hulo/vendure-plugin-geo-block` — public exports.
 *
 * `GeoBlockPlugin` registers the per-channel custom fields, controllers
 * and admin UI. `resolveAllowedCountries` is also re-exported so
 * downstream plugins / scripts can compute the resolved country
 * allow-list outside the HTTP path.
 */

export { GeoBlockPlugin, GeoBlockPluginOptions } from './plugin';
export { resolveAllowedCountries, GeoRegionKey } from './geo-regions';
