import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Ctx, Permission, RequestContext, TransactionalConnection } from '@vendure/core';
import { Request, Response } from 'express';
import { resolveAllowedCountries } from './geo-regions';

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
        /** Resolved flat allow-list of ISO 3166-1 alpha-2 country codes
         *  the storefront should let through, or `null` meaning "no
         *  country restriction" (WORLDWIDE preset). */
        allowedCountries: string[] | null;
        /** Countries the admin always blocks regardless of region. The
         *  resolved `allowedCountries` already has these subtracted —
         *  this field is exposed for diagnostics + so the storefront can
         *  enforce it even when allowedCountries is `null`. */
        blockedCountries: string[];
        /** UK subdivisions that must additionally match when the visitor
         *  resolves to GB. Empty = "any UK region allowed". */
        allowedGbRegions: string[];
        /** The raw region presets the admin selected — exposed for
         *  diagnostics (and so the frontend can display the admin's
         *  intent in any debug UI). */
        allowedRegions: string[];
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
        allowedCountries: ['GB'],
        blockedCountries: [],
        allowedGbRegions: ['ENG', 'WLS'],
        allowedRegions: [],
    },
    companyData: { showCompanyNumber: false, companyNumber: '' },
};

/**
 * Public endpoint serving the storefront-facing site config for a given
 * channel. The storefront calls GET /ees/site-config and identifies the
 * channel via the standard `vendure-token` header (the same one shop-api
 * uses), or via ?token=<channelToken> as a fallback for static fetchers.
 *
 * Returned shape is deliberately small + flat so the frontend can cache
 * it in module memory and re-fetch every 60s without much overhead.
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
        if (!token) {
            return { ...DEFAULTS };
        }

        const rows = await this.connection.rawConnection.query(
            `SELECT token,
                    customFieldsShowcompanynumber       AS showCompanyNumber,
                    customFieldsBusinesscompanynumber   AS companyNumber,
                    customFieldsGeoblockenabled         AS geoBlockEnabled,
                    customFieldsGeoblockallowedregions  AS allowedRegions,
                    customFieldsGeoblockallowedcountries AS extraAllowed,
                    customFieldsGeoblockblockedcountries AS blockedCountries,
                    customFieldsGeoblockallowedgbregions AS allowedGbRegions
             FROM channel
             WHERE token = ?
             LIMIT 1`,
            [token],
        );
        if (!rows.length) {
            return { ...DEFAULTS, channelToken: token };
        }
        const r = rows[0];
        const parseList = (raw: any, fallback: string[]): string[] => {
            if (Array.isArray(raw)) return raw.filter(v => typeof v === 'string');
            if (typeof raw !== 'string' || !raw.length) return fallback;
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.filter(v => typeof v === 'string');
            } catch {}
            // MariaDB stores list customFields as a JSON-encoded text. Be
            // forgiving of a CSV fallback for older rows.
            return raw.split(',').map(s => s.trim()).filter(Boolean);
        };

        const allowedRegions = parseList(r.allowedRegions, []);
        const extraAllowed = parseList(r.extraAllowed, ['GB']);
        const blockedCountries = parseList(r.blockedCountries, []);

        // Resolve regions + extras − blocked into a single flat allow-list.
        // `allowed === null` means WORLDWIDE — no country filter, only the
        // denylist applies.
        const resolved = resolveAllowedCountries({
            regions: allowedRegions,
            extraAllowed,
            blocked: blockedCountries,
        });

        return {
            channelToken: token,
            geoBlock: {
                enabled: !!Number(r.geoBlockEnabled || 0),
                allowedCountries: resolved.allowed,
                blockedCountries: resolved.blocked,
                allowedGbRegions: parseList(r.allowedGbRegions, ['ENG', 'WLS']),
                allowedRegions,
            },
            companyData: {
                showCompanyNumber: !!Number(r.showCompanyNumber || 0),
                companyNumber: String(r.companyNumber || ''),
            },
        };
    }

    /**
     * Admin: list every channel with its current geo-block settings.
     * Used by the dedicated Vendure admin page so the admin can switch
     * between Elite / LicenseDock / any future channel from a single
     * screen.
     */
    @Get('admin/channels')
    async listChannels(@Ctx() ctx: RequestContext, @Res() res: Response) {
        if (!requireAdmin(ctx, res, false)) return;
        const rows = await this.connection.rawConnection.query(
            `SELECT id, code, token,
                    COALESCE(customFieldsGeoblockenabled, 0)       AS geoBlockEnabled,
                    customFieldsGeoblockallowedregions             AS allowedRegions,
                    customFieldsGeoblockallowedcountries           AS extraAllowed,
                    customFieldsGeoblockblockedcountries           AS blockedCountries,
                    customFieldsGeoblockallowedgbregions           AS allowedGbRegions
             FROM channel
             ORDER BY id`,
        );
        const parseList = (raw: any, fallback: string[]): string[] => {
            if (Array.isArray(raw)) return raw.filter(v => typeof v === 'string');
            if (typeof raw !== 'string' || !raw.length) return fallback;
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.filter(v => typeof v === 'string');
            } catch {}
            return raw.split(',').map(s => s.trim()).filter(Boolean);
        };
        const result = rows.map((r: any) => {
            const allowedRegions = parseList(r.allowedRegions, []);
            const extraAllowed = parseList(r.extraAllowed, []);
            const blockedCountries = parseList(r.blockedCountries, []);
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
                allowedRegions,
                extraAllowed,
                blockedCountries,
                allowedGbRegions: parseList(r.allowedGbRegions, []),
                resolved: { allowedCountries: resolved.allowed, blockedCountries: resolved.blocked },
            };
        });
        return res.json({ channels: result });
    }

    /**
     * Admin: save the geo-block settings for one channel. Body shape
     * mirrors what `listChannels` returns (minus the resolved preview).
     */
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
        const enabled = body.enabled ? 1 : 0;
        const regions = normList(body.allowedRegions);
        const extras = normList(body.extraAllowed);
        const blocked = normList(body.blockedCountries);
        const gbRegions = normList(body.allowedGbRegions);
        const updated = await this.connection.rawConnection.query(
            `UPDATE channel
             SET customFieldsGeoblockenabled = ?,
                 customFieldsGeoblockallowedregions = ?,
                 customFieldsGeoblockallowedcountries = ?,
                 customFieldsGeoblockblockedcountries = ?,
                 customFieldsGeoblockallowedgbregions = ?
             WHERE token = ?`,
            [enabled, regions, extras, blocked, gbRegions, body.token],
        );
        if (!updated.affectedRows) {
            return res.status(404).json({ error: 'channel not found' });
        }
        return res.json({ ok: true });
    }
}
