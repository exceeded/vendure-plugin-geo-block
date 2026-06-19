import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '@vendure/admin-ui/core';

interface ChannelRow {
    id: number;
    code: string;
    token: string;
    enabled: boolean;
    allowedRegions: string[];
    extraAllowed: string[];
    blockedCountries: string[];
    allowedGbRegions: string[];
    resolved: { allowedCountries: string[] | null; blockedCountries: string[] };
}

interface RegionDef { value: string; label: string; hint: string; countries: number; }
interface CountryDef { value: string; label: string; flag: string; }

@Component({
    selector: 'ees-geo-block',
    standalone: false,
    template: `
        <vdr-page-block>
            <vdr-action-bar>
                <vdr-ab-left><h2>Site access (geo-block)</h2></vdr-ab-left>
                <vdr-ab-right>
                    <button class="btn btn-link" (click)="reload()" [disabled]="loading">
                        <clr-icon shape="refresh"></clr-icon> Refresh
                    </button>
                </vdr-ab-right>
            </vdr-action-bar>
        </vdr-page-block>

        <vdr-page-block>
            <div class="card" *ngIf="!loading && current">
                <div class="card-block">
                    <div class="chan-row">
                        <label class="lbl">Channel</label>
                        <select class="form-select" [(ngModel)]="currentToken" (ngModelChange)="onChannelChange()">
                            <option *ngFor="let c of channels" [value]="c.token">{{ c.code }}</option>
                        </select>

                        <span class="status-pill" [class.on]="current.enabled" [class.off]="!current.enabled">
                            {{ current.enabled ? 'GEO-BLOCK ON' : 'GEO-BLOCK OFF' }}
                        </span>
                        <button class="btn btn-sm btn-link" (click)="toggleEnabled()">
                            {{ current.enabled ? 'Turn off' : 'Turn on' }}
                        </button>
                    </div>

                    <p class="hint" *ngIf="!current.enabled">
                        Geo-block is <strong>off</strong> — everyone can visit the storefront, regardless of the settings below.
                        Use the toggle above to turn it on.
                    </p>
                </div>
            </div>
        </vdr-page-block>

        <vdr-page-block *ngIf="!loading && current">
            <div class="card">
                <div class="card-block">
                    <h3 class="step-title">1 · Choose a mode</h3>
                    <p class="hint">Pick one — the rest of the page changes based on what you select.</p>

                    <div class="mode-grid">
                        <label class="mode-card" [class.active]="mode === 'specific'">
                            <input type="radio" name="mode" value="specific" [(ngModel)]="mode" (ngModelChange)="onModeChange()">
                            <div class="mode-title">Allow only specific places</div>
                            <div class="mode-body">Pick regions and / or individual countries. Everyone else is blocked. Best for &ldquo;UK only&rdquo; or &ldquo;UK + Europe&rdquo;.</div>
                        </label>

                        <label class="mode-card" [class.active]="mode === 'worldwide'">
                            <input type="radio" name="mode" value="worldwide" [(ngModel)]="mode" (ngModelChange)="onModeChange()">
                            <div class="mode-title">Allow worldwide, except blocked</div>
                            <div class="mode-body">Everyone is welcome <em>except</em> the countries you add to the block list. Best for &ldquo;serve everyone but sanction-targeted countries&rdquo;.</div>
                        </label>
                    </div>
                </div>
            </div>
        </vdr-page-block>

        <vdr-page-block *ngIf="!loading && current && mode === 'specific'">
            <div class="card">
                <div class="card-block">
                    <h3 class="step-title">2 · Allowed regions <small>(one click)</small></h3>
                    <p class="hint">Each preset adds a whole group of countries. Tick as many as you want — they stack.</p>

                    <div class="preset-grid">
                        <label *ngFor="let r of regionDefs" class="preset-card" [class.active]="isRegionPicked(r.value)">
                            <input type="checkbox" [checked]="isRegionPicked(r.value)" (change)="toggleRegion(r.value)">
                            <div class="preset-label">{{ r.label }}</div>
                            <div class="preset-hint">{{ r.hint }}<span *ngIf="r.countries"> · {{ r.countries }} countries</span></div>
                        </label>
                    </div>
                </div>
            </div>
        </vdr-page-block>

        <vdr-page-block *ngIf="!loading && current && mode === 'specific'">
            <div class="card">
                <div class="card-block">
                    <h3 class="step-title">3 · Add extra countries <small>(optional)</small></h3>
                    <p class="hint">Countries that aren't in any preset above — for example: add 🇯🇵 Japan or 🇮🇱 Israel while keeping &ldquo;UK only&rdquo; selected.</p>

                    <div class="chip-row">
                        <span class="chip" *ngFor="let cc of current.extraAllowed">
                            {{ flag(cc) }} {{ countryLabel(cc) }}
                            <button class="chip-x" (click)="removeExtra(cc)" title="Remove">×</button>
                        </span>
                        <span *ngIf="!current.extraAllowed.length" class="hint inline">None yet.</span>
                    </div>

                    <div class="picker">
                        <select class="form-select" [(ngModel)]="newExtra">
                            <option value="">— pick a country —</option>
                            <option *ngFor="let c of unpickedExtras()" [value]="c.value">{{ c.flag }} {{ c.label }}</option>
                        </select>
                        <button class="btn btn-secondary btn-sm" (click)="addExtra()" [disabled]="!newExtra">+ Add</button>
                    </div>
                </div>
            </div>
        </vdr-page-block>

        <vdr-page-block *ngIf="!loading && current">
            <div class="card">
                <div class="card-block">
                    <h3 class="step-title">{{ mode === 'specific' ? '4' : '2' }} · Block specific countries</h3>
                    <p class="hint" *ngIf="mode === 'specific'">Countries in this list are always blocked, even if they would otherwise be allowed by a preset. Useful for sanctioned countries inside a region you allow (e.g. block 🇷🇺 Russia while allowing &ldquo;Europe&rdquo;).</p>
                    <p class="hint" *ngIf="mode === 'worldwide'">In worldwide mode this list is the <em>only</em> filter — everyone except these countries can visit.</p>

                    <div class="chip-row">
                        <span class="chip blocked" *ngFor="let cc of current.blockedCountries">
                            {{ flag(cc) }} {{ countryLabel(cc) }}
                            <button class="chip-x" (click)="removeBlocked(cc)" title="Remove">×</button>
                        </span>
                        <span *ngIf="!current.blockedCountries.length" class="hint inline">None yet.</span>
                    </div>

                    <div class="picker">
                        <select class="form-select" [(ngModel)]="newBlocked">
                            <option value="">— pick a country —</option>
                            <option *ngFor="let c of unpickedBlocked()" [value]="c.value">{{ c.flag }} {{ c.label }}</option>
                        </select>
                        <button class="btn btn-secondary btn-sm" (click)="addBlocked()" [disabled]="!newBlocked">+ Add</button>
                    </div>
                </div>
            </div>
        </vdr-page-block>

        <vdr-page-block *ngIf="!loading && current && mode === 'specific' && isUkResolved()">
            <div class="card">
                <div class="card-block">
                    <h3 class="step-title">5 · UK subdivisions <small>(only if 🇬🇧 is allowed)</small></h3>
                    <p class="hint">Tighten the UK further. Leave all four ticked (or all unchecked) to allow the whole of the UK.</p>

                    <div class="uk-row">
                        <label *ngFor="let r of ukRegions" class="uk-pill" [class.active]="current.allowedGbRegions.includes(r.value)">
                            <input type="checkbox"
                                [checked]="current.allowedGbRegions.includes(r.value)"
                                (change)="toggleUkRegion(r.value)">
                            {{ r.label }}
                        </label>
                    </div>
                </div>
            </div>
        </vdr-page-block>

        <vdr-page-block *ngIf="!loading && current">
            <div class="card preview-card">
                <div class="card-block">
                    <h3 class="step-title">Resolved allow-list <small>(what will happen when you save)</small></h3>

                    <div *ngIf="!current.enabled" class="preview-banner preview-off">
                        <strong>Geo-block is OFF</strong> — everyone can visit. Nothing below applies.
                    </div>

                    <div *ngIf="current.enabled">
                        <div class="preview-banner preview-allow">
                            <strong *ngIf="resolvedAllowed() === null">
                                ✅ Allow visitors from anywhere
                            </strong>
                            <strong *ngIf="resolvedAllowed() !== null && resolvedAllowed()!.length">
                                ✅ Allow visitors from {{ resolvedAllowed()!.length }} {{ resolvedAllowed()!.length === 1 ? 'country' : 'countries' }}
                            </strong>
                            <strong *ngIf="resolvedAllowed() !== null && !resolvedAllowed()!.length" class="warn">
                                ⚠️ Nothing is allowed — every visitor will see the maintenance page.
                            </strong>

                            <div class="country-chips" *ngIf="resolvedAllowed() !== null && resolvedAllowed()!.length">
                                <span class="mini-chip" *ngFor="let cc of resolvedAllowed()!">{{ flag(cc) }} {{ cc }}</span>
                            </div>
                        </div>

                        <div class="preview-banner preview-block" *ngIf="current.blockedCountries.length">
                            <strong>🚫 Block {{ current.blockedCountries.length }} {{ current.blockedCountries.length === 1 ? 'country' : 'countries' }}</strong>
                            <div class="country-chips">
                                <span class="mini-chip blocked" *ngFor="let cc of current.blockedCountries">{{ flag(cc) }} {{ cc }}</span>
                            </div>
                        </div>

                        <div class="preview-banner preview-uk" *ngIf="isUkResolved() && current.allowedGbRegions.length">
                            <strong>🏴 Within the UK, allow only:</strong>
                            <span class="mini-chip" *ngFor="let r of current.allowedGbRegions">{{ ukLabel(r) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </vdr-page-block>

        <vdr-page-block *ngIf="!loading && current">
            <div style="display:flex;gap:8px;align-items:center">
                <button class="btn btn-primary" (click)="save()" [disabled]="saving">
                    {{ saving ? 'Saving…' : 'Save changes' }}
                </button>
                <button class="btn btn-link" (click)="reload()" [disabled]="saving">Discard</button>
                <span class="hint inline" *ngIf="dirty">Unsaved changes</span>
            </div>
        </vdr-page-block>
    `,
    styles: [`
        :host { color: var(--color-text-100, inherit); display: block; }
        .chan-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .chan-row .lbl { font-size: 12px; color: var(--color-component-color-300); }
        .form-select {
            padding: 6px 10px; border-radius: 4px; min-width: 200px;
            border: 1px solid var(--color-component-border-200);
            background: var(--color-component-bg-100);
            color: var(--color-text-100, inherit);
        }
        .status-pill {
            display: inline-block; padding: 3px 12px; border-radius: 12px;
            font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
        }
        .status-pill.on { background: #10b981; color: #fff; }
        .status-pill.off { background: var(--color-component-bg-200); color: var(--color-component-color-300); }

        .hint { font-size: 13px; color: var(--color-component-color-300); margin: 6px 0 12px; }
        .hint.inline { display: inline; margin: 0; }

        .step-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
        .step-title small { color: var(--color-component-color-300); font-weight: 400; }

        .mode-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .mode-card {
            display: block; padding: 16px;
            border: 2px solid var(--color-component-border-200);
            border-radius: 8px; cursor: pointer;
            background: var(--color-component-bg-100);
            transition: border-color .15s;
        }
        .mode-card.active { border-color: var(--color-primary-500, #1d4ed8); }
        .mode-card input { margin-right: 8px; }
        .mode-card .mode-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
        .mode-card .mode-body { font-size: 12px; color: var(--color-component-color-300); line-height: 1.5; }

        .preset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
        .preset-card {
            display: block; padding: 12px;
            border: 1px solid var(--color-component-border-200);
            border-radius: 6px; cursor: pointer;
            background: var(--color-component-bg-100);
        }
        .preset-card.active { border-color: var(--color-primary-500, #1d4ed8); background: var(--color-component-bg-200); }
        .preset-card input { float: right; }
        .preset-label { font-weight: 600; font-size: 13px; }
        .preset-hint { font-size: 11px; color: var(--color-component-color-300); margin-top: 4px; }

        .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; min-height: 30px; }
        .chip {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 4px 10px; border-radius: 14px;
            background: #dbeafe; color: #1e3a8a; font-size: 12px;
            border: 1px solid #93c5fd;
        }
        .chip.blocked { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
        .chip-x {
            background: transparent; border: none; cursor: pointer; padding: 0 0 0 2px;
            color: inherit; font-size: 16px; line-height: 1;
        }
        .picker { display: flex; gap: 8px; align-items: center; }

        .uk-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .uk-pill {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 14px; border-radius: 18px; cursor: pointer;
            border: 1px solid var(--color-component-border-200);
            background: var(--color-component-bg-100);
            font-size: 13px;
        }
        .uk-pill.active { border-color: var(--color-primary-500, #1d4ed8); background: #dbeafe; color: #1e3a8a; }

        .preview-card { border-left: 4px solid var(--color-primary-500, #1d4ed8); }
        .preview-banner {
            padding: 12px; border-radius: 6px; margin: 10px 0;
            background: var(--color-component-bg-200);
        }
        .preview-banner .warn { color: #ef4444; }
        .preview-banner .country-chips { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
        .mini-chip {
            display: inline-block; padding: 2px 6px; border-radius: 4px;
            background: var(--color-component-bg-100); font-size: 11px;
            border: 1px solid var(--color-component-border-200);
            font-family: var(--clr-font-family-monospace, monospace);
        }
        .mini-chip.blocked { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
    `],
})
export class GeoBlockComponent implements OnInit {
    loading = true;
    saving = false;
    channels: ChannelRow[] = [];
    currentToken = '';
    current: ChannelRow | null = null;
    /** UI mode derived from underlying fields. */
    mode: 'specific' | 'worldwide' = 'specific';
    dirty = false;
    newExtra = '';
    newBlocked = '';

    /** Canonical region definitions — must match values in the channel
     *  customField options so existing rows round-trip cleanly. */
    regionDefs: RegionDef[] = [
        { value: 'UK_ONLY',       label: '🇬🇧 United Kingdom only',         hint: 'Just GB.',                                       countries: 1 },
        { value: 'BRITISH_ISLES', label: '🏴 British Isles',                hint: 'UK, Ireland, Isle of Man, Channel Islands, Faroes.', countries: 6 },
        { value: 'EU',            label: '🇪🇺 European Union (27)',          hint: 'All current EU member states.',                  countries: 27 },
        { value: 'EEA',           label: '🇪🇺 EEA',                          hint: 'EU + Iceland, Liechtenstein, Norway.',           countries: 30 },
        { value: 'EUROPE',        label: '🌍 All of Europe',                hint: 'Whole continent incl. UK, RU, UA, micro-states.', countries: 51 },
        { value: 'NORTH_AMERICA', label: '🌎 North America',                hint: 'US, Canada, Mexico.',                            countries: 3 },
        { value: 'OCEANIA',       label: '🌏 Oceania',                      hint: 'Australia, New Zealand.',                        countries: 2 },
    ];

    /** Curated country list — matches the dropdown options on the
     *  channel customField, plus a few common extras. */
    countryDefs: CountryDef[] = [
        { value: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
        { value: 'IE', label: 'Ireland',        flag: '🇮🇪' },
        { value: 'FR', label: 'France',         flag: '🇫🇷' },
        { value: 'DE', label: 'Germany',        flag: '🇩🇪' },
        { value: 'NL', label: 'Netherlands',    flag: '🇳🇱' },
        { value: 'BE', label: 'Belgium',        flag: '🇧🇪' },
        { value: 'LU', label: 'Luxembourg',     flag: '🇱🇺' },
        { value: 'ES', label: 'Spain',          flag: '🇪🇸' },
        { value: 'PT', label: 'Portugal',       flag: '🇵🇹' },
        { value: 'IT', label: 'Italy',          flag: '🇮🇹' },
        { value: 'AT', label: 'Austria',        flag: '🇦🇹' },
        { value: 'CH', label: 'Switzerland',    flag: '🇨🇭' },
        { value: 'DK', label: 'Denmark',        flag: '🇩🇰' },
        { value: 'SE', label: 'Sweden',         flag: '🇸🇪' },
        { value: 'NO', label: 'Norway',         flag: '🇳🇴' },
        { value: 'FI', label: 'Finland',        flag: '🇫🇮' },
        { value: 'IS', label: 'Iceland',        flag: '🇮🇸' },
        { value: 'PL', label: 'Poland',         flag: '🇵🇱' },
        { value: 'CZ', label: 'Czechia',        flag: '🇨🇿' },
        { value: 'US', label: 'United States',  flag: '🇺🇸' },
        { value: 'CA', label: 'Canada',         flag: '🇨🇦' },
        { value: 'AU', label: 'Australia',      flag: '🇦🇺' },
        { value: 'NZ', label: 'New Zealand',    flag: '🇳🇿' },
        { value: 'JP', label: 'Japan',          flag: '🇯🇵' },
        { value: 'IL', label: 'Israel',         flag: '🇮🇱' },
        // Sanction-list defaults — useful in the block picker.
        { value: 'RU', label: 'Russia',         flag: '🇷🇺' },
        { value: 'BY', label: 'Belarus',        flag: '🇧🇾' },
        { value: 'UA', label: 'Ukraine',        flag: '🇺🇦' },
        { value: 'IR', label: 'Iran',           flag: '🇮🇷' },
        { value: 'KP', label: 'North Korea',    flag: '🇰🇵' },
        { value: 'SY', label: 'Syria',          flag: '🇸🇾' },
        { value: 'CU', label: 'Cuba',           flag: '🇨🇺' },
        { value: 'CN', label: 'China',          flag: '🇨🇳' },
    ];

    ukRegions = [
        { value: 'ENG', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England' },
        { value: 'WLS', label: '🏴󠁧󠁢󠁷󠁬󠁳󠁿 Wales' },
        { value: 'SCT', label: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland' },
        { value: 'NIR', label: '🇬🇧 Northern Ireland' },
    ];

    constructor(
        private http: HttpClient,
        private notify: NotificationService,
        private cdr: ChangeDetectorRef,
    ) {}

    ngOnInit() { this.reload(); }

    reload() {
        this.loading = true;
        this.dirty = false;
        this.http.get<{ channels: ChannelRow[] }>('/ees/geo-block/admin/channels').subscribe({
            next: (res) => {
                this.channels = res.channels || [];
                if (!this.currentToken && this.channels.length) {
                    this.currentToken = this.channels[0].token;
                }
                this.current = this.channels.find(c => c.token === this.currentToken) || null;
                this.deriveMode();
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this.notify.error('Failed to load channels');
            },
        });
    }

    onChannelChange() {
        this.current = this.channels.find(c => c.token === this.currentToken) || null;
        this.dirty = false;
        this.deriveMode();
    }

    private deriveMode() {
        if (!this.current) return;
        this.mode = this.current.allowedRegions.includes('WORLDWIDE') ? 'worldwide' : 'specific';
    }

    onModeChange() {
        if (!this.current) return;
        if (this.mode === 'worldwide') {
            // Replace presets with just WORLDWIDE (the resolver short-circuits).
            this.current.allowedRegions = ['WORLDWIDE'];
            this.current.extraAllowed = [];
        } else {
            this.current.allowedRegions = this.current.allowedRegions.filter(r => r !== 'WORLDWIDE');
            if (!this.current.allowedRegions.length && !this.current.extraAllowed.length) {
                // Sensible default when switching back.
                this.current.allowedRegions = ['UK_ONLY'];
            }
        }
        this.markDirty();
    }

    toggleEnabled() {
        if (!this.current) return;
        this.current.enabled = !this.current.enabled;
        this.markDirty();
    }

    isRegionPicked(r: string): boolean {
        return !!this.current?.allowedRegions.includes(r);
    }

    toggleRegion(r: string) {
        if (!this.current) return;
        if (this.isRegionPicked(r)) {
            this.current.allowedRegions = this.current.allowedRegions.filter(x => x !== r);
        } else {
            this.current.allowedRegions = [...this.current.allowedRegions, r];
        }
        this.markDirty();
    }

    unpickedExtras(): CountryDef[] {
        return this.countryDefs.filter(c => !this.current?.extraAllowed.includes(c.value));
    }
    unpickedBlocked(): CountryDef[] {
        return this.countryDefs.filter(c => !this.current?.blockedCountries.includes(c.value));
    }

    addExtra() {
        if (!this.current || !this.newExtra) return;
        if (!this.current.extraAllowed.includes(this.newExtra)) {
            this.current.extraAllowed = [...this.current.extraAllowed, this.newExtra];
            this.markDirty();
        }
        this.newExtra = '';
    }
    removeExtra(cc: string) {
        if (!this.current) return;
        this.current.extraAllowed = this.current.extraAllowed.filter(c => c !== cc);
        this.markDirty();
    }

    addBlocked() {
        if (!this.current || !this.newBlocked) return;
        if (!this.current.blockedCountries.includes(this.newBlocked)) {
            this.current.blockedCountries = [...this.current.blockedCountries, this.newBlocked];
            this.markDirty();
        }
        this.newBlocked = '';
    }
    removeBlocked(cc: string) {
        if (!this.current) return;
        this.current.blockedCountries = this.current.blockedCountries.filter(c => c !== cc);
        this.markDirty();
    }

    toggleUkRegion(r: string) {
        if (!this.current) return;
        if (this.current.allowedGbRegions.includes(r)) {
            this.current.allowedGbRegions = this.current.allowedGbRegions.filter(x => x !== r);
        } else {
            this.current.allowedGbRegions = [...this.current.allowedGbRegions, r];
        }
        this.markDirty();
    }

    isUkResolved(): boolean {
        const allowed = this.resolvedAllowed();
        return allowed === null || allowed.includes('GB');
    }

    flag(cc: string): string {
        return this.countryDefs.find(c => c.value === cc)?.flag || cc;
    }
    countryLabel(cc: string): string {
        return this.countryDefs.find(c => c.value === cc)?.label || cc;
    }
    ukLabel(r: string): string {
        return this.ukRegions.find(u => u.value === r)?.label || r;
    }

    /** Re-compute the resolved allow-list locally so the preview matches
     *  exactly what the backend resolver will produce on save. */
    resolvedAllowed(): string[] | null {
        if (!this.current) return [];
        const regions = this.current.allowedRegions.map(r => r.toUpperCase());
        if (regions.includes('WORLDWIDE')) return null;
        const RM = REGION_TO_COUNTRIES;
        const set = new Set<string>();
        for (const r of regions) {
            const cs = RM[r as keyof typeof RM];
            if (cs) for (const c of cs) set.add(c);
        }
        for (const c of this.current.extraAllowed) set.add(c.toUpperCase());
        for (const c of this.current.blockedCountries) set.delete(c.toUpperCase());
        return Array.from(set).sort();
    }

    private markDirty() { this.dirty = true; }

    save() {
        if (!this.current) return;
        this.saving = true;
        const body = {
            token: this.current.token,
            enabled: this.current.enabled,
            allowedRegions: this.current.allowedRegions,
            extraAllowed: this.current.extraAllowed,
            blockedCountries: this.current.blockedCountries,
            allowedGbRegions: this.current.allowedGbRegions,
        };
        this.http.post<any>('/ees/geo-block/admin/save', body).subscribe({
            next: () => {
                this.saving = false;
                this.dirty = false;
                this.notify.success('Geo-block settings saved');
            },
            error: (err) => {
                this.saving = false;
                this.notify.error(err?.error?.error || 'Save failed');
            },
        });
    }
}

// Mirrors src/plugins/ees/geo-regions.ts so the live preview matches the
// backend resolver exactly. Kept in-file to avoid an admin-UI import of
// backend code.
const EU_27 = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
const EEA_EXTRA = ['IS','LI','NO'];
const NON_EU_EUROPE = ['GB','CH','NO','IS','LI','AL','AD','BA','BY','FO','GI','IM','JE','GG','MC','ME','MD','MK','RS','SM','UA','VA','XK','RU'];
const REGION_TO_COUNTRIES: Record<string, string[]> = {
    EUROPE: Array.from(new Set([...EU_27, ...NON_EU_EUROPE])),
    EU: EU_27,
    EEA: Array.from(new Set([...EU_27, ...EEA_EXTRA])),
    BRITISH_ISLES: ['GB','IE','IM','JE','GG','FO'],
    UK_ONLY: ['GB'],
    NORTH_AMERICA: ['US','CA','MX'],
    OCEANIA: ['AU','NZ'],
};
