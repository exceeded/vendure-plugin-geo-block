/**
 * Vendure Admin API extensions for HULO Geo-block.
 *
 * Exposes the same operator capabilities as the REST controller but
 * through GraphQL so customers using the Vendure Admin API directly
 * (custom dashboards, codegen-generated TS clients, the Admin UI) get
 * strong typing and the standard Vendure auth + channel context.
 *
 * Storefront paths (/geo-block/check, /geo-block/site-config,
 * /geo-block/revoked.json) intentionally stay REST — they're
 * anonymous, high-frequency, and serve non-JSON in some cases. Mixing
 * those into the Shop API would add session/channel middleware to
 * every page-load with no value to anyone.
 */
import { Injectable } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { gql } from 'graphql-tag';
import { Allow, Ctx, Permission, RequestContext, TransactionalConnection } from '@vendure/core';
import { isLicensed, premiumFeatureError } from '@huloglobal/vendure-licence-sdk';
import {
    FREE_TIER_PRESET_KEYS,
    isAllowed,
    REGION_PRESETS,
} from './geo-regions';
import { GeoBlockPlugin } from './plugin';

export const geoBlockAdminApiSchema = gql`
    type GeoBlockPreset {
        key: String!
        label: String!
        kind: String!
        description: String!
        countryCount: Int
        requiresLicence: Boolean!
    }

    type GeoBlockPresetList {
        tier: String!
        items: [GeoBlockPreset!]!
    }

    type GeoBlockChannelConfig {
        channelId: Int!
        channelToken: String!
        channelName: String
        enabled: Boolean!
        mode: String!
        allowedCountries: [String!]!
        blockedCountries: [String!]!
        allowedGbRegions: [String!]!
        regionPreset: String
        blockMessage: String
        blockRedirectUrl: String
        ipAllowlist: [String!]!
    }

    type GeoBlockStatsTotals {
        totalEvents: Int!
        blocked: Int!
        softBlocked: Int!
        allowed: Int!
    }

    type GeoBlockStatsCountryRow {
        country: String!
        n: Int!
    }

    type GeoBlockStatsDayRow {
        day: String!
        n: Int!
    }

    type GeoBlockStats {
        days: Int!
        channelId: Int!
        totals: GeoBlockStatsTotals!
        topCountries: [GeoBlockStatsCountryRow!]!
        daily: [GeoBlockStatsDayRow!]!
    }

    type GeoBlockVerdict {
        allowed: Boolean!
        reason: String!
        mode: String!
    }

    input GeoBlockSaveChannelInput {
        channelToken: String!
        enabled: Boolean
        mode: String
        allowedCountries: [String!]
        blockedCountries: [String!]
        allowedGbRegions: [String!]
        regionPreset: String
        blockMessage: String
        blockRedirectUrl: String
        ipAllowlist: [String!]
    }

    input GeoBlockSimulateInput {
        channelToken: String!
        country: String
        region: String
    }

    extend type Query {
        geoBlockPresets: GeoBlockPresetList!
        geoBlockChannels: [GeoBlockChannelConfig!]!
        geoBlockStats(channelId: Int!, days: Int): GeoBlockStats!
    }

    extend type Mutation {
        geoBlockSaveChannel(input: GeoBlockSaveChannelInput!): GeoBlockChannelConfig!
        geoBlockSimulate(input: GeoBlockSimulateInput!): GeoBlockVerdict!
    }
`;

@Resolver()
@Injectable()
export class GeoBlockAdminResolver {
    constructor(private connection: TransactionalConnection) {}

    @Query()
    @Allow(Permission.ReadCatalog)
    geoBlockPresets(): { tier: string; items: any[] } {
        const licensed = isLicensed(GeoBlockPlugin.getLicenceStatus());
        const annotated = REGION_PRESETS.map(p => ({
            ...p,
            requiresLicence: !FREE_TIER_PRESET_KEYS.includes(p.key),
        }));
        return {
            tier: licensed ? 'paid' : 'free',
            items: licensed
                ? annotated
                : annotated.filter(p => FREE_TIER_PRESET_KEYS.includes(p.key)),
        };
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async geoBlockChannels(@Ctx() ctx: RequestContext): Promise<any[]> {
        // Channel-scoped: only return the channels the caller can see.
        const rows = await this.connection.rawConnection.query(
            `SELECT id AS channelId, token AS channelToken, code AS channelName,
                    customFields_huloGeoBlockEnabled       AS enabled,
                    customFields_huloGeoBlockMode          AS mode,
                    customFields_huloGeoBlockAllowed       AS allowedCountries,
                    customFields_huloGeoBlockBlocked       AS blockedCountries,
                    customFields_huloGeoBlockGbRegions     AS allowedGbRegions,
                    customFields_huloGeoBlockPreset        AS regionPreset,
                    customFields_huloGeoBlockMessage       AS blockMessage,
                    customFields_huloGeoBlockRedirectUrl   AS blockRedirectUrl,
                    customFields_huloGeoBlockIpAllowlist   AS ipAllowlist
             FROM channel`,
            [],
        );
        return rows.map((r: any) => ({
            channelId: Number(r.channelId),
            channelToken: String(r.channelToken),
            channelName: r.channelName || null,
            enabled: !!r.enabled,
            mode: r.mode || 'block',
            allowedCountries: splitList(r.allowedCountries),
            blockedCountries: splitList(r.blockedCountries),
            allowedGbRegions: splitList(r.allowedGbRegions),
            regionPreset: r.regionPreset || null,
            blockMessage: r.blockMessage || null,
            blockRedirectUrl: r.blockRedirectUrl || null,
            ipAllowlist: splitList(r.ipAllowlist),
        }));
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async geoBlockStats(
        @Ctx() ctx: RequestContext,
        @Args('channelId') channelId: number,
        @Args('days') daysInput?: number,
    ): Promise<any> {
        if (!isLicensed(GeoBlockPlugin.getLicenceStatus())) {
            throw new Error(premiumFeatureError('vendure-plugin-geo-block').message);
        }
        const days = Math.min(Math.max(Number(daysInput) || 30, 1), 365);
        const where = `channelId = ? AND createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
        const params = [channelId, days];
        const totals = await this.connection.rawConnection.query(
            `SELECT COUNT(*) AS totalEvents,
                    SUM(decision = 'block')      AS blocked,
                    SUM(decision = 'soft-block') AS softBlocked,
                    SUM(decision = 'allow')      AS allowed
             FROM geo_block_event WHERE ${where}`,
            params,
        );
        const topCountries = await this.connection.rawConnection.query(
            `SELECT country, COUNT(*) AS n FROM geo_block_event WHERE ${where}
             GROUP BY country ORDER BY n DESC LIMIT 20`,
            params,
        );
        const daily = await this.connection.rawConnection.query(
            `SELECT DATE(createdAt) AS day, COUNT(*) AS n FROM geo_block_event WHERE ${where}
             GROUP BY day ORDER BY day`,
            params,
        );
        const t = (totals as any[])[0] || {};
        return {
            days,
            channelId,
            totals: {
                totalEvents: Number(t.totalEvents) || 0,
                blocked: Number(t.blocked) || 0,
                softBlocked: Number(t.softBlocked) || 0,
                allowed: Number(t.allowed) || 0,
            },
            topCountries: topCountries.map((r: any) => ({ country: r.country || 'XX', n: Number(r.n) })),
            daily: daily.map((r: any) => ({ day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day), n: Number(r.n) })),
        };
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog)
    async geoBlockSaveChannel(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        if (!input?.channelToken) throw new Error('channelToken required');
        const set: string[] = [];
        const params: any[] = [];
        const push = (col: string, val: any) => {
            if (val === undefined) return;
            set.push(`${col} = ?`);
            params.push(Array.isArray(val) ? val.join(',') : val);
        };
        push('customFields_huloGeoBlockEnabled', input.enabled);
        push('customFields_huloGeoBlockMode', input.mode);
        push('customFields_huloGeoBlockAllowed', input.allowedCountries);
        push('customFields_huloGeoBlockBlocked', input.blockedCountries);
        push('customFields_huloGeoBlockGbRegions', input.allowedGbRegions);
        push('customFields_huloGeoBlockPreset', input.regionPreset);
        push('customFields_huloGeoBlockMessage', input.blockMessage);
        push('customFields_huloGeoBlockRedirectUrl', input.blockRedirectUrl);
        push('customFields_huloGeoBlockIpAllowlist', input.ipAllowlist);
        if (!set.length) throw new Error('no fields to update');
        params.push(input.channelToken);
        const result = await this.connection.rawConnection.query(
            `UPDATE channel SET ${set.join(', ')} WHERE token = ?`,
            params,
        );
        if (!(result as any).affectedRows) throw new Error('channel not found');
        const rows = await this.geoBlockChannels(ctx);
        return rows.find((r: any) => r.channelToken === input.channelToken);
    }

    @Mutation()
    @Allow(Permission.ReadCatalog)
    async geoBlockSimulate(@Args('input') input: any): Promise<any> {
        if (!isLicensed(GeoBlockPlugin.getLicenceStatus())) {
            throw new Error(premiumFeatureError('vendure-plugin-geo-block').message);
        }
        const rows = await this.connection.rawConnection.query(
            `SELECT customFields_huloGeoBlockEnabled  AS enabled,
                    customFields_huloGeoBlockAllowed  AS allowedCountries,
                    customFields_huloGeoBlockBlocked  AS blockedCountries,
                    customFields_huloGeoBlockGbRegions AS allowedGbRegions,
                    customFields_huloGeoBlockMode     AS mode
             FROM channel WHERE token = ?`,
            [input.channelToken],
        );
        const r = (rows as any[])[0];
        if (!r) throw new Error('channel not found');
        const verdict = isAllowed(input.country || null, input.region || null, {
            enabled: !!r.enabled,
            allowedCountries: splitList(r.allowedCountries),
            blockedCountries: splitList(r.blockedCountries),
            allowedGbRegions: splitList(r.allowedGbRegions),
            allowedSubdivisions: {},
        });
        return { allowed: verdict.allowed, reason: verdict.reason, mode: r.mode || 'block' };
    }
}

function splitList(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}
