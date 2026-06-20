import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { Ctx, Logger, Permission, RequestContext, TransactionalConnection } from '@vendure/core';
import { Request, Response } from 'express';
import { GeoBlockEvent } from './geo-block-event.entity';
import {
    isAllowed,
    ipMatchesAny,
    REGION_PRESETS,
    resolveAllowedCountries,
} from './geo-regions';
import { GeoBlockPlugin, getOptions } from './plugin';
import { getRealIp, getResolvedCountry, getResolvedRegion } from './proxy-headers';

const loggerCtx = 'GeoBlockController';

function requireAdmin(ctx: RequestContext, res: Response, write = false): boolean {
    if (!ctx?.activeUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return false;
    }
    const needed = write ? [Permission.UpdateCatalog] : [Permission.ReadCatalog];
    if (!ctx.userHasPermissions(needed)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return false;
    }
    return true;
}

interface SiteConfig {
    channelToken: string;
    geoBlock: {
        enabled: boolean;
        mode: 'block' | 'soft';
        allowedCountries: string[] | null;
        blockedCountries: string[];
        allowedGbRegions: string[];
        allowedRegions: string[];
        blockMessage: string;
        blockRedirectUrl: string | null;
        blockLogoUrl: string | null;
    };
    companyData: {
        showCompanyNumber: boolean;
        companyNumber: string;
    };
}

const DEFAULTS: SiteConfig = {
    channelToken: '',
    geoBlock: {
        enabled: false,
        mode: 'block',
        allowedCountries: ['GB'],
        blockedCountries: [],
        allowedGbRegions: ['ENG', 'WLS'],
        allowedRegions: [],
        blockMessage: '',
        blockRedirectUrl: null,
        blockLogoUrl: null,
    },
    companyData: { showCompanyNumber: false, companyNumber: '' },
};

const parseList = (raw: any, fallback: string[] = []): string[] => {
    if (Array.isArray(raw)) return raw.filter(v => typeof v === 'string');
    if (typeof raw !== 'string' || !raw.length) return fallback;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(v => typeof v === 'string');
    } catch {}
    return raw.split(',').map(s => s.trim()).filter(Boolean);
};

/**
 * Public + admin endpoints for the storefront geo-block.
 *
 *  Public:
 *    GET  /geo-block/site-config       — channel-aware rules the storefront caches
 *    GET  /geo-block/check             — per-request decision (with logging)
 *    GET  /geo-block/presets           — preset catalogue for the storefront banner
 *
 *  Admin:
 *    GET  /geo-block/admin/channels    — all channels + their rules
 *    POST /geo-block/admin/save        — save one channel's rules
 *    GET  /geo-block/admin/stats       — block totals + top blocked countries
 *    POST /geo-block/admin/simulate    — "what would happen if a visitor from X visited?"
 *    POST /geo-block/admin/gc          — prune old GeoBlockEvent rows
 */
@Controller('geo-block')
export class GeoBlockController {
    constructor(private connection: TransactionalConnection) {}

    @Get('site-config')
    async getConfig(@Req() req: Request): Promise<SiteConfig> {
        const headerToken = (req.headers['vendure-token'] as string)
            || (req.headers['x-vendure-token'] as string)
            || (req.query.token as string)
            || '';
        const token = headerToken.trim();
        if (!token) return { ...DEFAULTS };

        const row = await this.loadChannelRow(token);
        if (!row) return { ...DEFAULTS, channelToken: token };
        return this.buildConfig(token, row);
    }

    /**
     * Per-request decision endpoint. The storefront calls this on entry
     * (or middleware can call it) with optional `?country=` overrides.
     * Logs the decision so the admin stats panel shows top blocked
     * countries.
     *
     * Returns 200 with `{ allowed: boolean, reason, mode }` regardless —
     * the storefront decides whether to redirect or render a banner.
     */
    @Get('check')
    async check(@Req() req: Request, @Res() res: Response) {
        const headerToken = (req.headers['vendure-token'] as string)
            || (req.headers['x-vendure-token'] as string)
            || (req.query.token as string)
            || '';
        const token = headerToken.trim();
        if (!token) return res.json({ allowed: true, reason: 'no-channel' });
        const row = await this.loadChannelRow(token);
        if (!row) return res.json({ allowed: true, reason: 'unknown-channel' });
        const cfg = this.buildConfig(token, row);

        // Optional override (?country=US) for testing — non-prod only;
        // honoured but logged at the trust level of the caller.
        const ip = getRealIp(req);
        const country = (req.query.country as string)
            || getResolvedCountry(req)
            || null;
        const region = (req.query.region as string)
            || getResolvedRegion(req)
            || null;

        const opts = getOptions();
        const allowlist = parseList(row.ipAllowlist || '');
        const channelId = Number(row.id) || 1;

        // 1. IP allowlist trumps everything else.
        if (ipMatchesAny(ip, allowlist)) {
            return res.json({ allowed: true, reason: 'ip-allowlist', mode: cfg.geoBlock.mode });
        }
        // 2. Scheduled maintenance window.
        if (opts.maintenanceWindow && inWindow(opts.maintenanceWindow)) {
            await this.logEvent({
                channelId, country, region, ip,
                ua: req.headers['user-agent'] as string,
                url: req.originalUrl,
                decision: cfg.geoBlock.mode === 'soft' ? 'soft-block' : 'block',
                reason: 'maintenance',
            });
            return res.json({
                allowed: false,
                reason: 'maintenance',
                mode: cfg.geoBlock.mode,
                message: cfg.geoBlock.blockMessage || 'The site is temporarily unavailable. Please try again later.',
                redirectUrl: cfg.geoBlock.blockRedirectUrl,
            });
        }
        // 3. Channel rules.
        const verdict = isAllowed(country, region, {
            enabled: cfg.geoBlock.enabled,
            allowedCountries: cfg.geoBlock.allowedCountries,
            blockedCountries: cfg.geoBlock.blockedCountries,
            allowedGbRegions: cfg.geoBlock.allowedGbRegions,
        });
        if (!verdict.allowed) {
            await this.logEvent({
                channelId, country, region, ip,
                ua: req.headers['user-agent'] as string,
                url: req.originalUrl,
                decision: cfg.geoBlock.mode === 'soft' ? 'soft-block' : 'block',
                reason: verdict.reason,
            });
            return res.json({
                allowed: false,
                reason: verdict.reason,
                mode: cfg.geoBlock.mode,
                message: cfg.geoBlock.blockMessage || this.defaultMessage(verdict.reason),
                redirectUrl: cfg.geoBlock.blockRedirectUrl,
                logoUrl: cfg.geoBlock.blockLogoUrl,
            });
        }
        return res.json({ allowed: true, reason: verdict.reason, mode: cfg.geoBlock.mode });
    }

    /** Catalogue of available region presets — fed to the admin picker
     * and any storefront that wants to show "we serve <X>". */
    @Get('presets')
    presets(@Res() res: Response) {
        return res.json({ presets: REGION_PRESETS });
    }

    /** Admin: plugin health + update availability. Read by the admin UI
     * banner so the operator sees when a new version is on npm. */
    @Get('status')
    async status(@Ctx() ctx: RequestContext, @Res() res: Response) {
        if (!requireAdmin(ctx, res, false)) return;
        const updater = GeoBlockPlugin.getUpdateChecker();
        const update = updater ? updater.getStatus() : null;
        return res.json({
            packageName: GeoBlockPlugin.getPackageName(),
            version: GeoBlockPlugin.getPackageVersion(),
            update,
            uptimeSec: Math.round(process.uptime()),
        });
    }

    @Get('admin/channels')
    async listChannels(@Ctx() ctx: RequestContext, @Res() res: Response) {
        if (!requireAdmin(ctx, res, false)) return;
        const rows = await this.connection.rawConnection.query(
            `SELECT id, code, token,
                    COALESCE(customFieldsGeoblockenabled, 0)       AS geoBlockEnabled,
                    customFieldsGeoblockmode                       AS geoBlockMode,
                    customFieldsGeoblockallowedregions             AS allowedRegions,
                    customFieldsGeoblockallowedcountries           AS extraAllowed,
                    customFieldsGeoblockblockedcountries           AS blockedCountries,
                    customFieldsGeoblockallowedgbregions           AS allowedGbRegions,
                    customFieldsGeoblockipallowlist                AS ipAllowlist,
                    customFieldsGeoblockblockmessage               AS blockMessage,
                    customFieldsGeoblockblockredirecturl           AS blockRedirectUrl,
                    customFieldsGeoblockblocklogourl               AS blockLogoUrl
             FROM channel
             ORDER BY id`,
        );
        const result = rows.map((r: any) => {
            const allowedRegions = parseList(r.allowedRegions);
            const extraAllowed = parseList(r.extraAllowed);
            const blockedCountries = parseList(r.blockedCountries);
            const resolved = resolveAllowedCountries({
                regions: allowedRegions,
                extraAllowed,
                blocked: blockedCountries,
            });
            return {
                id: r.id,
                code: r.code,
                token: r.token,
                enabled: !!Number(r.geoBlockEnabled || 0),
                mode: (r.geoBlockMode || 'block') as 'block' | 'soft',
                allowedRegions,
                extraAllowed,
                blockedCountries,
                allowedGbRegions: parseList(r.allowedGbRegions),
                ipAllowlist: parseList(r.ipAllowlist),
                blockMessage: r.blockMessage || '',
                blockRedirectUrl: r.blockRedirectUrl || '',
                blockLogoUrl: r.blockLogoUrl || '',
                resolved: { allowedCountries: resolved.allowed, blockedCountries: resolved.blocked },
            };
        });
        return res.json({ channels: result });
    }

    @Post('admin/save')
    async saveChannel(@Ctx() ctx: RequestContext, @Body() body: any, @Res() res: Response) {
        if (!requireAdmin(ctx, res, true)) return;
        if (!body?.token || typeof body.token !== 'string') {
            return res.status(400).json({ error: 'channel token required' });
        }
        const normList = (v: any): string => {
            if (!Array.isArray(v)) return '[]';
            const clean = v.filter(x => typeof x === 'string').map(x => x.trim().toUpperCase()).filter(Boolean);
            return JSON.stringify(Array.from(new Set(clean)));
        };
        const normIpList = (v: any): string => {
            if (!Array.isArray(v)) return '[]';
            const clean = v.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean);
            return JSON.stringify(Array.from(new Set(clean)));
        };
        const mode = body.mode === 'soft' ? 'soft' : 'block';
        const updated = await this.connection.rawConnection.query(
            `UPDATE channel
             SET customFieldsGeoblockenabled = ?,
                 customFieldsGeoblockmode = ?,
                 customFieldsGeoblockallowedregions = ?,
                 customFieldsGeoblockallowedcountries = ?,
                 customFieldsGeoblockblockedcountries = ?,
                 customFieldsGeoblockallowedgbregions = ?,
                 customFieldsGeoblockipallowlist = ?,
                 customFieldsGeoblockblockmessage = ?,
                 customFieldsGeoblockblockredirecturl = ?,
                 customFieldsGeoblockblocklogourl = ?
             WHERE token = ?`,
            [
                body.enabled ? 1 : 0,
                mode,
                normList(body.allowedRegions),
                normList(body.extraAllowed),
                normList(body.blockedCountries),
                normList(body.allowedGbRegions),
                normIpList(body.ipAllowlist),
                String(body.blockMessage || '').slice(0, 4000),
                String(body.blockRedirectUrl || '').slice(0, 2048),
                String(body.blockLogoUrl || '').slice(0, 2048),
                body.token,
            ],
        );
        if (!updated.affectedRows) return res.status(404).json({ error: 'channel not found' });
        return res.json({ ok: true });
    }

    /**
     * Admin: top blocked countries + daily series + totals over the last
     * N days (default 30). Fed straight into the admin Stats panel.
     */
    @Get('admin/stats')
    async stats(@Ctx() ctx: RequestContext, @Req() req: Request, @Res() res: Response) {
        if (!requireAdmin(ctx, res, false)) return;
        const days = Math.min(Math.max(parseInt((req.query as any).days || '30', 10) || 30, 1), 365);
        const channelId = (req.query as any).channelId
            ? parseInt(String((req.query as any).channelId), 10) : null;
        const where = channelId
            ? 'createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY) AND channelId = ?'
            : 'createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)';
        const params = channelId ? [days, channelId] : [days];

        const top = await this.connection.rawConnection.query(
            `SELECT country, COUNT(*) AS n
             FROM geo_block_event WHERE ${where}
             GROUP BY country ORDER BY n DESC LIMIT 20`,
            params,
        );
        const series = await this.connection.rawConnection.query(
            `SELECT DATE(createdAt) AS day,
                    SUM(decision='block') AS blocked,
                    SUM(decision='soft-block') AS softBlocked
             FROM geo_block_event WHERE ${where}
             GROUP BY DATE(createdAt) ORDER BY day`,
            params,
        );
        const totals = await this.connection.rawConnection.query(
            `SELECT
                SUM(decision='block') AS blocked,
                SUM(decision='soft-block') AS softBlocked,
                COUNT(*) AS total,
                COUNT(DISTINCT ip) AS uniqueIps
             FROM geo_block_event WHERE ${where}`,
            params,
        );
        const reasons = await this.connection.rawConnection.query(
            `SELECT reason, COUNT(*) AS n
             FROM geo_block_event WHERE ${where}
             GROUP BY reason ORDER BY n DESC`,
            params,
        );
        return res.json({
            days, channelId,
            totals: totals[0] || {},
            topCountries: top,
            series, reasons,
        });
    }

    /**
     * Admin: dry-run check — "what would happen if a visitor from US
     * with no UK region came in?". Lets the admin sanity-check their
     * rules without standing up a proxy.
     */
    @Post('admin/simulate')
    async simulate(@Ctx() ctx: RequestContext, @Body() body: any, @Res() res: Response) {
        if (!requireAdmin(ctx, res, false)) return;
        if (!body?.token) return res.status(400).json({ error: 'channel token required' });
        const row = await this.loadChannelRow(body.token);
        if (!row) return res.status(404).json({ error: 'channel not found' });
        const cfg = this.buildConfig(body.token, row);
        const verdict = isAllowed(body.country || null, body.region || null, {
            enabled: cfg.geoBlock.enabled,
            allowedCountries: cfg.geoBlock.allowedCountries,
            blockedCountries: cfg.geoBlock.blockedCountries,
            allowedGbRegions: cfg.geoBlock.allowedGbRegions,
        });
        return res.json({
            input: {
                country: body.country || null,
                region: body.region || null,
                ip: body.ip || null,
            },
            verdict,
            ipMatchesAllowlist: ipMatchesAny(body.ip, parseList(row.ipAllowlist || '')),
            effectiveRules: cfg.geoBlock,
        });
    }

    @Post('admin/gc')
    async gc(@Ctx() ctx: RequestContext, @Body() body: any, @Res() res: Response) {
        if (!requireAdmin(ctx, res, true)) return;
        const olderThanDays = Math.max(1, parseInt(body?.olderThanDays || '90', 10) || 90);
        const result = await this.connection.rawConnection.query(
            `DELETE FROM geo_block_event WHERE createdAt < DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [olderThanDays],
        );
        return res.json({ deleted: result?.affectedRows ?? 0, olderThanDays });
    }

    // -- private helpers ---------------------------------------------------

    private async loadChannelRow(token: string): Promise<any | null> {
        const rows = await this.connection.rawConnection.query(
            `SELECT id, token,
                    customFieldsShowcompanynumber           AS showCompanyNumber,
                    customFieldsBusinesscompanynumber       AS companyNumber,
                    customFieldsGeoblockenabled             AS geoBlockEnabled,
                    customFieldsGeoblockmode                AS geoBlockMode,
                    customFieldsGeoblockallowedregions      AS allowedRegions,
                    customFieldsGeoblockallowedcountries    AS extraAllowed,
                    customFieldsGeoblockblockedcountries    AS blockedCountries,
                    customFieldsGeoblockallowedgbregions    AS allowedGbRegions,
                    customFieldsGeoblockipallowlist         AS ipAllowlist,
                    customFieldsGeoblockblockmessage        AS blockMessage,
                    customFieldsGeoblockblockredirecturl    AS blockRedirectUrl,
                    customFieldsGeoblockblocklogourl        AS blockLogoUrl
             FROM channel WHERE token = ? LIMIT 1`,
            [token],
        );
        return rows[0] || null;
    }

    private buildConfig(token: string, r: any): SiteConfig {
        const allowedRegions = parseList(r.allowedRegions);
        const extraAllowed = parseList(r.extraAllowed, ['GB']);
        const blockedCountries = parseList(r.blockedCountries);
        const resolved = resolveAllowedCountries({
            regions: allowedRegions,
            extraAllowed,
            blocked: blockedCountries,
        });
        return {
            channelToken: token,
            geoBlock: {
                enabled: !!Number(r.geoBlockEnabled || 0),
                mode: (r.geoBlockMode === 'soft' ? 'soft' : 'block'),
                allowedCountries: resolved.allowed,
                blockedCountries: resolved.blocked,
                allowedGbRegions: parseList(r.allowedGbRegions, ['ENG', 'WLS']),
                allowedRegions,
                blockMessage: String(r.blockMessage || ''),
                blockRedirectUrl: r.blockRedirectUrl || null,
                blockLogoUrl: r.blockLogoUrl || null,
            },
            companyData: {
                showCompanyNumber: !!Number(r.showCompanyNumber || 0),
                companyNumber: String(r.companyNumber || ''),
            },
        };
    }

    private async logEvent(input: {
        channelId: number;
        country: string | null;
        region: string | null;
        ip: string | null;
        ua: string | undefined;
        url: string;
        decision: 'block' | 'soft-block' | 'allow';
        reason: string;
    }): Promise<void> {
        try {
            const repo = this.connection.rawConnection.getRepository(GeoBlockEvent);
            const row = repo.create({
                channelId: input.channelId,
                country: input.country ? input.country.toUpperCase().slice(0, 8) : null as any,
                region: input.region ? input.region.toUpperCase().slice(0, 8) : null as any,
                ip: input.ip ? input.ip.slice(0, 64) : null as any,
                userAgent: input.ua ? String(input.ua).slice(0, 500) : null as any,
                url: (input.url || '').slice(0, 2048),
                decision: input.decision,
                reason: input.reason.slice(0, 64),
            });
            await repo.save(row);
        } catch (e: any) {
            Logger.warn(`geo-block event log failed: ${e?.message}`, loggerCtx);
        }
    }

    private defaultMessage(reason: string): string {
        switch (reason) {
            case 'denylist':
                return 'This service is not available in your country.';
            case 'country-not-allowed':
                return 'This service is not available in your country.';
            case 'uk-region-not-allowed':
                return 'This service is only available in selected UK regions.';
            case 'maintenance':
                return 'The site is temporarily unavailable. Please try again later.';
            default:
                return 'Access denied.';
        }
    }
}

function inWindow(w: { startsAt: string; endsAt: string; allowedIps?: string[] }): boolean {
    const now = Date.now();
    const start = Date.parse(w.startsAt);
    const end = Date.parse(w.endsAt);
    if (!isFinite(start) || !isFinite(end)) return false;
    return now >= start && now <= end;
}
