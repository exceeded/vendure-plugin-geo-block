/**
 * Bot / crawler allowlist for the geo-block plugin.
 *
 * WHY THIS EXISTS: without this, geo-block silently breaks SEO.
 * If a store restricts itself to (say) the UK, then Googlebot,
 * Bingbot, etc. — which crawl from datacentres all over the world —
 * would get blocked. Their crawls would fail, the store would drop
 * out of the index, and the operator would have no idea until
 * organic traffic tanked.
 *
 * Every real user-agent that we care about here appears in the
 * `robots.txt` conventions of a major search engine, or has a
 * publicly-documented verification method (reverse DNS, ASN, etc.).
 * We DO NOT try to verify — a UA header is trivially spoofable —
 * but the point of an allowlist here is not fraud prevention.
 * The point is:
 *
 *   1. Legitimate crawlers get through (SEO doesn't break).
 *   2. Scraper-adversaries who fake the UA get through TOO, but
 *      they were already going to try to bypass geo-block via
 *      residential proxies. This isn't the layer that stops them.
 *
 * If you want fraud-grade bot filtering, run something upstream
 * (Cloudflare's Bot Management, WAF rules, or a homegrown ASN /
 * reverse-DNS check on the request path).
 */

/** Named preset that matches every well-known SEO / social crawler.
 *  The list is deliberately curated — not exhaustive — because
 *  every extra pattern is a wider bypass surface. If a bot you care
 *  about is missing, use the custom-array form of `botAllowlist`. */
const STRICT_ALLOWLIST_PATTERNS: RegExp[] = [
    // ── Search engines ──────────────────────────────────────────
    /\bGooglebot\b/i,
    /\bGoogle-InspectionTool\b/i,
    /\bGoogle-Read-Aloud\b/i,
    /\bAdsBot-Google\b/i,
    /\bStorebot-Google\b/i,
    /\bMediapartners-Google\b/i,
    /\bBingbot\b/i,
    /\bAdIdxBot\b/i,
    /\bBingPreview\b/i,
    /\bDuckDuckBot\b/i,
    /\bSlurp\b/i,                // Yahoo
    /\bYandexBot\b/i,
    /\bYandexImages\b/i,
    /\bYandexMobileBot\b/i,
    /\bBaiduspider\b/i,
    /\bAppleBot\b/i,
    /\bSeznamBot\b/i,
    /\bnaverbot\b/i,
    /\bYeti\b/i,                 // Naver (KR)
    /\bSogou\b/i,
    /\bqihoobot\b/i,

    // ── Social / link-preview crawlers ──────────────────────────
    // Blocking these breaks Open Graph previews on shared links.
    /\bfacebookexternalhit\b/i,
    /\bfacebookcatalog\b/i,
    /\bMeta-ExternalAgent\b/i,
    /\bTwitterbot\b/i,
    /\bLinkedInBot\b/i,
    /\bSlackbot(-LinkExpanding)?\b/i,
    /\bWhatsApp\b/i,
    /\bDiscordbot\b/i,
    /\bTelegramBot\b/i,
    /\bPinterestbot\b/i,
    /\bredditbot\b/i,
    /\bSkypeUriPreview\b/i,
    /\bembedly\b/i,

    // ── Structured-data / feed validators ───────────────────────
    // Small number of ops-facing crawlers that block Search Console
    // ownership verification / feed submission workflows if geo
    // shuts them out.
    /\bGoogle Search Console\b/i,
    /\bBing Webmaster\b/i,
    /\bfeedfetcher\b/i,
    /\bFeedBurner\b/i,
    /\bschema-markup-validator\b/i,
];

/** Broader net — anything that self-identifies as a bot / crawler /
 *  spider. Deliberately loose (no word-boundaries) so CamelCased
 *  names like `MegaCorpSpider` and `InternalCorpScanner` match. That
 *  is the whole point of permissive mode; use `'strict'` when you
 *  want the tight curated list. */
const PERMISSIVE_ALLOWLIST_PATTERN = /(bot|crawl|spider|indexer|slurp|scanner|http[-_]?client|fetch\/|libwww|curl\/|wget\/|python-requests)/i;

export type BotAllowlist =
    /** No allowlist — every UA is subject to geo rules. Turns off
     *  SEO-crawler bypass entirely; use only if you have an
     *  upstream WAF handling this. */
    | false
    /** Well-known SEO + social crawlers only (default). */
    | 'strict'
    /** Anything that self-identifies as bot / crawler / spider. */
    | 'permissive'
    /** Custom pattern list. Strings are matched case-insensitively
     *  as a substring; RegExp is used as-is. */
    | Array<string | RegExp>;

/**
 * Return true when the given `User-Agent` header should skip the
 * geo-block check.
 *
 * `allowlist` defaults to `'strict'` — the SEO-safe default — when
 * called without an argument. That way an operator who never
 * touches the plugin option still gets crawler-safe geo-blocking.
 */
export function isAllowlistedBot(
    userAgent: string | undefined | null,
    allowlist: BotAllowlist = 'strict',
): boolean {
    if (allowlist === false) return false;
    const ua = String(userAgent || '');
    if (!ua) return false;
    if (allowlist === 'strict') {
        return STRICT_ALLOWLIST_PATTERNS.some(rx => rx.test(ua));
    }
    if (allowlist === 'permissive') {
        return PERMISSIVE_ALLOWLIST_PATTERN.test(ua);
    }
    // Custom array
    for (const pattern of allowlist) {
        if (typeof pattern === 'string') {
            if (ua.toLowerCase().includes(pattern.toLowerCase())) return true;
        } else if (pattern instanceof RegExp) {
            if (pattern.test(ua)) return true;
        }
    }
    return false;
}

/** For diagnostics — return the first matching entry, or null. */
export function matchedBotEntry(
    userAgent: string,
    allowlist: BotAllowlist,
): string | null {
    if (allowlist === false || !userAgent) return null;
    if (allowlist === 'strict') {
        for (const rx of STRICT_ALLOWLIST_PATTERNS) {
            if (rx.test(userAgent)) return rx.source;
        }
        return null;
    }
    if (allowlist === 'permissive') {
        return PERMISSIVE_ALLOWLIST_PATTERN.test(userAgent)
            ? PERMISSIVE_ALLOWLIST_PATTERN.source : null;
    }
    for (const pattern of allowlist) {
        if (typeof pattern === 'string') {
            if (userAgent.toLowerCase().includes(pattern.toLowerCase())) return pattern;
        } else if (pattern instanceof RegExp) {
            if (pattern.test(userAgent)) return pattern.source;
        }
    }
    return null;
}
