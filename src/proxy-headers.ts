import { Request } from 'express';

/**
 * Reverse-proxy aware visitor IP extraction.
 *
 * Order of precedence:
 *   1. Cloudflare's `CF-Connecting-IP` (always the real client IP,
 *      regardless of how many proxies sit in front of the worker).
 *   2. `True-Client-IP` (Akamai / Cloudflare Enterprise).
 *   3. `X-Real-IP` (nginx / Caddy default when proxying).
 *   4. First entry in `X-Forwarded-For` (RFC 7239 ancestor; the
 *      left-most entry is the original client when the upstream proxy
 *      is trusted).
 *   5. Express's `req.ip` — only useful when `app.set('trust proxy', ...)`
 *      has been set on the Vendure host, otherwise this is the socket
 *      address of the last hop.
 *
 * Returns `null` if none of the headers are populated and `req.ip`
 * isn't available — the caller should treat this as "unknown" and
 * skip IP-dependent enrichment rather than fail.
 */
export type TrustedIpHeader = 'cf-connecting-ip' | 'true-client-ip' | 'x-real-ip' | 'x-forwarded-for';

/** `::ffff:203.0.113.5` → `203.0.113.5`; IPv6 lower-cased. */
export function normaliseIp(ip: string | null | undefined): string | null {
    const v = String(ip || '').trim();
    if (!v) return null;
    const m = v.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    return (m ? m[1] : v).toLowerCase().slice(0, 64);
}

/**
 * The visitor's IP. By default this is Express's `req.ip`, which honours
 * the host's `trust proxy` setting and cannot be forged by the client.
 * Vendor headers (`CF-Connecting-IP`, `True-Client-IP`, `X-Real-IP`,
 * left-most `X-Forwarded-For`) are only consulted when the host opts in
 * with `trustedIpHeaders` — otherwise anyone could send
 * `X-Forwarded-For: <office IP>` and walk through the IP allowlist.
 */
export function getRealIp(req: Request, trusted: TrustedIpHeader[] = []): string | null {
    const headers = req.headers || {};
    for (const name of trusted) {
        const raw = String(headers[name] || '').trim();
        if (!raw) continue;
        const value = name === 'x-forwarded-for' ? raw.split(',')[0]?.trim() : raw;
        const ip = normaliseIp(value);
        if (ip) return ip;
    }
    return normaliseIp((req as any).ip) || null;
}

/**
 * Cloudflare / Akamai populate the visitor's resolved country on the
 * inbound request when the corresponding feature is enabled. Reading
 * the upstream value avoids a per-request GeoIP lookup. Returns the
 * ISO 3166-1 alpha-2 country code or `null` if no proxy header is
 * present.
 */
export function getResolvedCountry(req: Request): string | null {
    const headers = req.headers || {};
    const cf = String(headers['cf-ipcountry'] || '').trim().toUpperCase();
    if (cf && cf !== 'XX' && cf !== 'T1') return cf;

    const akamai = String(headers['x-akamai-edgescape'] || '').trim();
    if (akamai) {
        const m = akamai.match(/country_code=([A-Z]{2})/i);
        if (m) return m[1].toUpperCase();
    }

    const fastly = String(headers['x-country-code'] || '').trim().toUpperCase();
    if (fastly && /^[A-Z]{2}$/.test(fastly)) return fastly;

    return null;
}

/**
 * Cloudflare's `cf-region-code` carries the ISO 3166-2 subdivision
 * (e.g. `ENG`, `SCT`, `CA`) when the "Send subdivision data" option is
 * enabled in the dashboard. Returns the bare code without the country
 * prefix, or `null` if unavailable.
 */
export function getResolvedRegion(req: Request): string | null {
    const headers = req.headers || {};
    const cf = String(headers['cf-region-code'] || '').trim().toUpperCase();
    if (cf && /^[A-Z0-9]{1,4}$/.test(cf)) return cf;
    return null;
}
