#!/usr/bin/env python3
"""WCAG 2.1 contrast verification for the geo-block admin page (0.7.4).

Uses the REAL Vendure admin theme values extracted from the built CSS
(styles-JFK44YAO.css) and the exact token values the component will ship
(per-theme via :host-context([data-theme='dark'])). Simulates
color-mix(in srgb, ...) as per-channel lerp of gamma-encoded sRGB.

Targets: >= 4.5 normal text, >= 3.0 large text / UI component boundaries.
"""
import colorsys, sys

def hsl(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l / 100, s / 100)
    return (round(r * 255), round(g * 255), round(b * 255))

def hexc(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))

def mix(a, pct, b):
    f = pct / 100
    return tuple(round(a[i] * f + b[i] * (1 - f)) for i in range(3))

def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(v) for v in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

def fmt(c):
    return '#%02x%02x%02x' % c

AMBER     = hexc('#f59e0b')
OK        = hexc('#10b981')
BAD       = hexc('#ef4444')
INFO      = hexc('#3b82f6')
AMBER_INK = hexc('#231602')
HERO_BG   = hexc('#16202b')

# ── Shipped token values (mirror the component CSS exactly) ─────────
THEMES = {
    'light': {
        'surface':   hexc('#fafafa'),      # --color-component-bg-100
        'bg200':     hexc('#f2f3f5'),
        'strong':    hexc('#3d4147'),      # --gb-strong (headings/body)
        'muted':     hexc('#5d6470'),      # --gb-muted (hints/labels)
        'ui_border': hexc('#79818f'),      # --gb-ui-border (inputs/buttons/switch track)
        'amber_edge':hexc('#b45309'),      # --gb-amber-edge (border on amber controls)
    },
    'dark': {
        'surface':   hsl(201, 30, 18),
        'bg200':     hsl(201, 30, 22),
        'strong':    hsl(210, 16, 93),     # = --color-text-100 dark
        'muted':     hsl(205, 14, 74),     # --gb-muted dark
        'ui_border': hsl(203, 12, 50),     # --gb-ui-border dark
        'amber_edge':AMBER,                # amber itself passes on dark
    },
}
TINT_PCT = {'ok': 10, 'warn': 12, 'bad': 10, 'info': 10}

failures = 0
def check(theme, name, fg, bg, need):
    global failures
    r = ratio(fg, bg)
    if r < need:
        failures += 1
    print(f"  [{theme}] {'PASS' if r >= need else 'FAIL':4s} {r:5.2f} (need {need:.1f})  {name:42s} {fmt(fg)} on {fmt(bg)}")

for theme, T in THEMES.items():
    S = T['surface']
    tints = {k: mix(v, TINT_PCT[k], S) for k, v in
             {'ok': OK, 'warn': AMBER, 'bad': BAD, 'info': INFO}.items()}
    print(f"\n== {theme} ==  surface {fmt(S)}  strong {fmt(T['strong'])}  muted {fmt(T['muted'])}  ui-border {fmt(T['ui_border'])}")
    check(theme, 'strong text on card', T['strong'], S, 4.5)
    check(theme, 'strong text on bg200', T['strong'], T['bg200'], 4.5)
    check(theme, 'muted text on card', T['muted'], S, 4.5)
    check(theme, 'muted text on bg200', T['muted'], T['bg200'], 4.5)
    for k, t in tints.items():
        check(theme, f'strong on tint-{k}', T['strong'], t, 4.5)
        check(theme, f'muted on tint-{k}', T['muted'], t, 4.5)
    check(theme, 'primary/tab ink on amber', AMBER_INK, AMBER, 4.5)
    check(theme, 'amber-edge vs card (UI, 3:1)', T['amber_edge'], S, 3.0)
    check(theme, 'ui-border vs card (UI, 3:1)', T['ui_border'], S, 3.0)
    check(theme, 'switch-off track (=ui-border) vs card', T['ui_border'], S, 3.0)
    check(theme, 'hero title white', hexc('#ffffff'), HERO_BG, 4.5)
    check(theme, 'hero sub #cbd5e1', hexc('#cbd5e1'), HERO_BG, 4.5)
    check(theme, 'hero ghost btn #e2e8f0', hexc('#e2e8f0'), HERO_BG, 4.5)
    check(theme, 'help-num ink on amber', AMBER_INK, AMBER, 4.5)

print(f"\n{'ALL PASS' if failures == 0 else f'{failures} FAILURES'}")
sys.exit(1 if failures else 0)
