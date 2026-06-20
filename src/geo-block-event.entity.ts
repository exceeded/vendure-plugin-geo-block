import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * One row per block decision — written every time the
 * `/geo-block/check` (or the storefront's call to `/site-config` followed
 * by a server-side enforcement) decides to refuse a visitor.
 *
 * Cheap to keep around because the admin's stats endpoint aggregates on
 * top of it; older rows can be pruned with `GeoBlockController.gc()`.
 */
@Entity()
export class GeoBlockEvent extends VendureEntity {
    constructor(input?: DeepPartial<GeoBlockEvent>) {
        super(input);
    }

    @Index()
    @Column({ type: 'int', default: 1 })
    channelId!: number;

    @Index()
    @Column({ type: 'varchar', length: 8, nullable: true })
    country!: string;

    @Column({ type: 'varchar', length: 8, nullable: true })
    region!: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    ip!: string;

    @Column({ type: 'text', nullable: true })
    userAgent!: string;

    @Column({ type: 'varchar', length: 2048, nullable: true })
    url!: string;

    @Index()
    @Column({ type: 'varchar', length: 32 })
    decision!: 'block' | 'soft-block' | 'allow';

    /** Which rule rejected (or allowed) the request. */
    @Column({ type: 'varchar', length: 64 })
    reason!: 'denylist' | 'country-not-allowed' | 'uk-region-not-allowed' | 'ip-allowlist' | 'maintenance' | 'ok' | string;
}
