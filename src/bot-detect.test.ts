import { describe, it, expect } from 'vitest';
import { isAllowlistedBot, matchedBotEntry } from './bot-detect';

// Real-world UA snippets copy-pasted from search-engine documentation
// and access logs. Keeping them verbatim (with version numbers) is
// deliberate — the strict list is meant to match the current shape of
// each crawler's UA, and if that shape shifts the tests fail loudly.
const SAMPLE = {
    googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    googleAds: 'AdsBot-Google (+http://www.google.com/adsbot.html)',
    bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    ddg: 'Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckbot)',
    yandex: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    baidu: 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
    facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    linkedin: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Jakarta Commons-HttpClient/3.1 +http://www.linkedin.com)',
    slack: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    twitter: 'Twitterbot/1.0',
    whatsapp: 'WhatsApp/2.19.81 A',
    // Chrome on Windows — the canonical "real user"
    chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    // Bots not in strict list — should NOT match strict, SHOULD match permissive
    randomSpider: 'MegaCorpSpider/4.2 (+https://mega.example.com/bot)',
    scanner: 'Mozilla/5.0 (Linux) InternalCorpScanner/1.0',
};

describe('isAllowlistedBot', () => {
    describe('strict mode (default)', () => {
        it('matches every well-known SEO + social bot', () => {
            for (const [name, ua] of Object.entries(SAMPLE)) {
                if (name === 'chromeWindows' || name === 'safariMac' || name === 'randomSpider' || name === 'scanner') continue;
                expect(isAllowlistedBot(ua)).toBe(true);
            }
        });
        it('rejects real users', () => {
            expect(isAllowlistedBot(SAMPLE.chromeWindows)).toBe(false);
            expect(isAllowlistedBot(SAMPLE.safariMac)).toBe(false);
        });
        it('rejects bots outside the strict list', () => {
            expect(isAllowlistedBot(SAMPLE.randomSpider)).toBe(false);
            expect(isAllowlistedBot(SAMPLE.scanner)).toBe(false);
        });
        it('rejects empty / null UAs', () => {
            expect(isAllowlistedBot('')).toBe(false);
            expect(isAllowlistedBot(null as any)).toBe(false);
            expect(isAllowlistedBot(undefined as any)).toBe(false);
        });
    });

    describe('permissive mode', () => {
        it('matches strict-list bots too', () => {
            expect(isAllowlistedBot(SAMPLE.googlebot, 'permissive')).toBe(true);
            expect(isAllowlistedBot(SAMPLE.bingbot, 'permissive')).toBe(true);
        });
        it('matches self-identifying bots outside the strict list', () => {
            expect(isAllowlistedBot(SAMPLE.randomSpider, 'permissive')).toBe(true);
            expect(isAllowlistedBot(SAMPLE.scanner, 'permissive')).toBe(true);
        });
        it('rejects real users', () => {
            expect(isAllowlistedBot(SAMPLE.chromeWindows, 'permissive')).toBe(false);
            expect(isAllowlistedBot(SAMPLE.safariMac, 'permissive')).toBe(false);
        });
    });

    describe('custom array', () => {
        it('accepts string substrings, case-insensitive', () => {
            expect(isAllowlistedBot('CustomProbe/1.0', ['customprobe'])).toBe(true);
            expect(isAllowlistedBot('CustomProbe/1.0', ['other', 'CUSTOMPROBE'])).toBe(true);
        });
        it('accepts RegExp entries', () => {
            expect(isAllowlistedBot('Uptime-Monitor/3.2', [/Uptime-Monitor\/\d+/i])).toBe(true);
            expect(isAllowlistedBot('Not-A-Match', [/Uptime-Monitor/])).toBe(false);
        });
        it('empty array matches nothing', () => {
            expect(isAllowlistedBot(SAMPLE.googlebot, [])).toBe(false);
        });
    });

    describe('false disables allowlist entirely', () => {
        it('every UA including Googlebot fails', () => {
            expect(isAllowlistedBot(SAMPLE.googlebot, false)).toBe(false);
            expect(isAllowlistedBot('CustomProbe', false)).toBe(false);
        });
    });
});

describe('matchedBotEntry', () => {
    it('returns the first matching pattern source in strict mode', () => {
        const src = matchedBotEntry(SAMPLE.googlebot, 'strict');
        expect(src).toContain('Googlebot');
    });
    it('returns null when nothing matches', () => {
        expect(matchedBotEntry(SAMPLE.chromeWindows, 'strict')).toBeNull();
    });
    it('returns the literal string when a custom string entry matches', () => {
        expect(matchedBotEntry('CustomProbe/1.0', ['customprobe'])).toBe('customprobe');
    });
});
