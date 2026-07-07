/**
 * Storefront-side assets served by the plugin: a drop-in helper JS
 * that a store can `<script src>` to get geo-blocking with zero code,
 * and a self-contained HTML block page that plugin can redirect to.
 *
 * Design goals:
 *   - Both assets have zero runtime deps. Vanilla JS + inline CSS.
 *   - Aggressively cacheable (5 min public + SWR) — the block-check
 *     is a separate call, this file is static per publicBaseUrl.
 *   - Small: the helper is < 3 KB minified; the block page is < 4 KB.
 *   - No PII collection — the helper only calls /geo-block/check and
 *     reads the JSON response.
 */

interface HeloOpts {
    /** Public origin the storefront calls for geo checks. */
    publicBaseUrl: string;
}

/**
 * Storefront helper: a one-line drop-in that enforces geo-block on
 * any HTML page. Reads the channel token from the `<script>` tag's
 * `data-channel-token` attribute, calls `/geo-block/check`, then:
 *
 *   - if allowed: no-op (site renders as normal)
 *   - if blocked with mode=block: redirects to `/geo-block/blocked`
 *     (which renders the branded block page)
 *   - if blocked with mode=soft: injects a top-of-page banner
 *     linking to the block page
 *
 * Optional attributes on the script tag:
 *   data-redirect="/somewhere-else"  — override block redirect
 *   data-timeout-ms="2500"            — network timeout (default 3000)
 *   data-preview                       — logs verdict, no side effects
 *
 * The check runs on `DOMContentLoaded` so it doesn't block first paint.
 * A visitor with JS disabled sees the storefront as normal — the
 * server-side integration (route middleware) is the strong path.
 */
export function buildHuloGeoJs(opts: HeloOpts): string {
    const publicBaseUrl = String(opts.publicBaseUrl || '').replace(/\/+$/, '');
    return `/*! HULO geo-block storefront helper — vendored, no deps.
 * Docs: https://huloglobal.com/vendure-plugins/geo-block */
(function () {
  'use strict';
  var s = (function () {
    var s = document.currentScript;
    if (s) return s;
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if (/hulo-geo\\.js/.test(all[i].src)) return all[i];
    }
    return null;
  })();
  if (!s) return;
  var token = s.getAttribute('data-channel-token') || '';
  var override = s.getAttribute('data-redirect') || '';
  var preview = s.hasAttribute('data-preview');
  var timeoutMs = parseInt(s.getAttribute('data-timeout-ms') || '3000', 10);
  if (!token) { if (preview) console.warn('[hulo-geo] missing data-channel-token'); return; }
  var base = ${JSON.stringify(publicBaseUrl)};
  function log() { if (preview) try { console.info.apply(console, ['[hulo-geo]'].concat([].slice.call(arguments))); } catch (e) {} }
  function go() {
    var url = base + '/geo-block/check';
    var ctl = null;
    if (typeof AbortController !== 'undefined') { ctl = new AbortController(); setTimeout(function () { ctl.abort(); }, timeoutMs); }
    fetch(url, {
      method: 'GET',
      credentials: 'omit',
      headers: { 'vendure-token': token, 'accept': 'application/json' },
      signal: ctl ? ctl.signal : undefined,
    }).then(function (r) { return r.json(); }).then(function (v) {
      log('verdict', v);
      if (!v || v.allowed) return;
      if (preview) return;
      var mode = v.mode || 'block';
      if (mode === 'block') {
        var target = override || v.redirectUrl
          || (base + '/geo-block/blocked?reason=' + encodeURIComponent(v.reason || 'geo')
              + (v.message ? '&msg=' + encodeURIComponent(v.message) : '')
              + '&t=' + encodeURIComponent(token));
        window.location.replace(target);
      } else if (mode === 'soft') {
        injectBanner(v.message || 'This site does not currently ship to your region.',
          override || v.redirectUrl || null);
      }
    }).catch(function (e) { log('fetch error — failing open', e && e.message); });
  }
  function injectBanner(msg, moreHref) {
    if (document.getElementById('hulo-geo-banner')) return;
    var b = document.createElement('div');
    b.id = 'hulo-geo-banner';
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:sticky;top:0;left:0;right:0;z-index:2147483647;'
      + 'background:#0f1419;color:#fff;padding:12px 16px;font:14px system-ui,sans-serif;'
      + 'text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.35);';
    var t = document.createElement('span'); t.textContent = String(msg);
    b.appendChild(t);
    if (moreHref) {
      var a = document.createElement('a');
      a.href = String(moreHref); a.textContent = 'Learn more';
      a.style.cssText = 'color:#f59e0b;margin-left:12px;text-decoration:underline;';
      b.appendChild(a);
    }
    var mount = function () {
      if (!document.body) return setTimeout(mount, 20);
      document.body.insertBefore(b, document.body.firstChild);
    };
    mount();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', go);
  } else { go(); }
})();
`;
}

/**
 * Branded, self-contained HTML block page. Rendered when a visitor
 * hits `/geo-block/blocked?reason=X&msg=…&t=<token>`. Zero dependencies —
 * inline CSS + one image reference (channel logo, optional).
 *
 * Rendered per-request so we can localise the country name and echo
 * the operator's custom message. Safe for browser display — every
 * dynamic value is HTML-escaped at the call site.
 */
export function buildBlockedPageHtml(input: {
    title: string;
    heading: string;
    message: string;
    reason: string;
    country?: string | null;
    logoUrl?: string | null;
    redirectUrl?: string | null;
    supportEmail?: string | null;
}): string {
    const {
        title,
        heading,
        message,
        reason,
        country,
        logoUrl,
        redirectUrl,
        supportEmail,
    } = input;
    // Everything below is already HTML-escaped by the caller. Keep
    // this template literal-only — no template-time substitution.
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${title}</title>
  <style>
    :root {
      --bg: #f8fafc; --ink: #0f172a; --ink-2: #475569; --card: #ffffff;
      --accent: #f59e0b; --accent-dark: #d97706; --border: #e2e8f0;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 18px; max-width: 560px; width: 100%; padding: 40px 32px; box-shadow: 0 1px 3px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.04); text-align: center; }
    .logo { max-width: 140px; height: auto; margin: 0 auto 20px; display: block; }
    .badge { display: inline-block; margin-bottom: 18px; padding: 6px 12px; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; }
    h1 { font-size: 26px; line-height: 1.2; margin: 0 0 12px; letter-spacing: -.01em; color: var(--ink); }
    p { color: var(--ink-2); margin: 0 0 18px; line-height: 1.55; font-size: 15px; }
    .country { color: var(--ink); font-weight: 600; }
    .cta { display: inline-block; margin-top: 6px; padding: 12px 22px; border-radius: 10px; background: var(--accent); color: #fff; text-decoration: none; font-weight: 700; }
    .cta:hover { background: var(--accent-dark); }
    .support { margin-top: 22px; font-size: 13px; color: var(--ink-2); }
    .support a { color: var(--accent-dark); }
    .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="card" role="alertdialog" aria-labelledby="h">
      ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="" aria-hidden="true">` : ''}
      <span class="badge">Not available</span>
      <h1 id="h">${heading}</h1>
      <p>${message}${country ? ` <span class="country">(${country})</span>` : ''}</p>
      ${redirectUrl ? `<a class="cta" href="${redirectUrl}">Continue</a>` : ''}
      ${supportEmail ? `<div class="support">Questions? <a href="mailto:${supportEmail}">${supportEmail}</a></div>` : ''}
      <div class="footer">Ref: ${reason}</div>
    </div>
  </main>
</body>
</html>`;
}
