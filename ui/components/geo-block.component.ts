import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '@vendure/admin-ui/core';

interface ChannelRow {
    id: number;
    code: string;
    token: string;
    enabled: boolean;
    mode: 'block' | 'soft';
    allowedRegions: string[];
    extraAllowed: string[];
    blockedCountries: string[];
    allowedGbRegions: string[];
    ipAllowlist: string[];
    blockMessage: string;
    blockRedirectUrl: string;
    blockLogoUrl: string;
    resolved: { allowedCountries: string[] | null; blockedCountries: string[] };
}

interface PresetMeta { key: string; label: string; kind: string; description: string; countryCount: number | null; }

@Component({
    selector: 'ees-geo-block',
    standalone: false,
    template: `
        <vdr-page-block>
            <vdr-action-bar>
                <vdr-ab-left>
                    <h2>Site access</h2>
                    <p class="subtitle">Per-channel geo-restrictions, IP allowlist, audit log.</p>
                </vdr-ab-left>
                <vdr-ab-right>
                    <button class="btn btn-link" (click)="reload()" [disabled]="loading">
                        <clr-icon shape="refresh"></clr-icon> Refresh
                    </button>
                </vdr-ab-right>
            </vdr-action-bar>
        </vdr-page-block>

        <vdr-page-block *ngIf="updateBanner">
            <div class="update-banner" [class.major]="updateBanner.isMajor">
                <div>
                    <strong>📦 Update available</strong>
                    {{ updateBanner.packageName }} {{ updateBanner.current }} → <strong>{{ updateBanner.latest }}</strong>
                    <span *ngIf="updateBanner.isMajor" class="major-pill">major</span>
                </div>
                <div class="actions">
                    <a [href]="'https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v' + updateBanner.latest" target="_blank" class="btn btn-sm btn-link">Release notes ↗</a>
                    <button class="btn btn-sm" (click)="dismissUpdate()">Dismiss</button>
                </div>
            </div>
        </vdr-page-block>

        <vdr-page-block *ngIf="!loading && current">
            <div class="card top-bar">
                <div class="card-block">
                    <div class="chan-row">
                        <label class="lbl">Channel</label>
                        <select class="form-select" [(ngModel)]="currentToken" (ngModelChange)="onChannelChange()">
                            <option *ngFor="let c of channels" [value]="c.token">{{ c.code }}</option>
                        </select>

                        <span class="status-pill" [class.on]="current.enabled" [class.off]="!current.enabled">
                            {{ current.enabled ? 'GEO-BLOCK ON' : 'GEO-BLOCK OFF' }}
                        </span>
                        <button class="btn btn-sm" [class.btn-warning]="current.enabled" [class.btn-primary]="!current.enabled" (click)="toggleEnabled()">
                            {{ current.enabled ? 'Turn off' : 'Turn on' }}
                        </button>

                        <span class="mode-pill" *ngIf="current.enabled" [class.mode-block]="current.mode === 'block'" [class.mode-soft]="current.mode === 'soft'">
                            {{ current.mode === 'soft' ? 'Soft block (banner)' : 'Full block' }}
                        </span>

                        <span class="dirty-flag" *ngIf="dirty">● Unsaved</span>
                    </div>

                    <div class="tabs">
                        <button class="tab" [class.active]="tab === 'rules'" (click)="tab = 'rules'">Rules</button>
                        <button class="tab" [class.active]="tab === 'message'" (click)="tab = 'message'">Block page</button>
                        <button class="tab" [class.active]="tab === 'allowlist'" (click)="tab = 'allowlist'">IP allowlist</button>
                        <button class="tab" [class.active]="tab === 'simulate'" (click)="tab = 'simulate'">Simulate</button>
                        <button class="tab" [class.active]="tab === 'stats'" (click)="tab = 'stats'; loadStats()">Stats</button>
                    </div>
                </div>
            </div>
        </vdr-page-block>

        <!-- ============================================================= RULES TAB -->
        <ng-container *ngIf="!loading && current && tab === 'rules'">
            <vdr-page-block>
                <div class="card">
                    <div class="card-block">
                        <h3 class="step-title">Mode</h3>
                        <div class="mode-grid">
                            <label class="mode-card" [class.active]="current.mode === 'block'">
                                <input type="radio" name="bmode" value="block" [(ngModel)]="current.mode" (ngModelChange)="markDirty()">
                                <div class="mode-title">Full block</div>
                                <div class="mode-body">Blocked visitors never see the storefront — they get the block page (or are redirected).</div>
                            </label>
                            <label class="mode-card" [class.active]="current.mode === 'soft'">
                                <input type="radio" name="bmode" value="soft" [(ngModel)]="current.mode" (ngModelChange)="markDirty()">
                                <div class="mode-title">Soft block (browse-only)</div>
                                <div class="mode-body">Visitors can browse but a banner explains you don't ship to their country and checkout is hidden.</div>
                            </label>
                        </div>
                    </div>
                </div>
            </vdr-page-block>

            <vdr-page-block>
                <div class="card">
                    <div class="card-block">
                        <h3 class="step-title">Strategy</h3>
                        <div class="mode-grid">
                            <label class="mode-card" [class.active]="strategy === 'specific'">
                                <input type="radio" name="strat" value="specific" [(ngModel)]="strategy" (ngModelChange)="onStrategyChange()">
                                <div class="mode-title">Allow only specific places</div>
                                <div class="mode-body">Pick regions or individual countries — everyone else is blocked.</div>
                            </label>
                            <label class="mode-card" [class.active]="strategy === 'worldwide'">
                                <input type="radio" name="strat" value="worldwide" [(ngModel)]="strategy" (ngModelChange)="onStrategyChange()">
                                <div class="mode-title">Worldwide except blocked</div>
                                <div class="mode-body">Allow everyone except the denylist below.</div>
                            </label>
                        </div>
                    </div>
                </div>
            </vdr-page-block>

            <vdr-page-block *ngIf="strategy === 'specific'">
                <div class="card">
                    <div class="card-block">
                        <h3 class="step-title">Allowed regions <small>({{ pickedRegionCount() }} picked)</small></h3>
                        <p class="hint">One-click presets. Tick as many as you want — they stack.</p>

                        <input class="form-input filter-input" placeholder="Filter presets…" [(ngModel)]="presetFilter">

                        <div class="preset-section" *ngFor="let group of presetGroups">
                            <h4 class="group-title">{{ group.label }}</h4>
                            <div class="preset-grid">
                                <label *ngFor="let p of filteredPresets(group.kind)" class="preset-card" [class.active]="isRegionPicked(p.key)">
                                    <input type="checkbox" [checked]="isRegionPicked(p.key)" (change)="toggleRegion(p.key)">
                                    <div class="preset-label">{{ p.label }}</div>
                                    <div class="preset-hint">{{ p.description }}<span *ngIf="p.countryCount"> · {{ p.countryCount }} countries</span></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </vdr-page-block>

            <vdr-page-block *ngIf="strategy === 'specific'">
                <div class="card">
                    <div class="card-block">
                        <h3 class="step-title">Extra allowed countries <small>(optional)</small></h3>
                        <p class="hint">Add countries that aren't covered by a preset above.</p>
                        <div class="chip-row">
                            <span class="chip" *ngFor="let cc of current.extraAllowed">
                                {{ countryLabel(cc) }}
                                <button class="chip-x" (click)="removeExtra(cc)" title="Remove">×</button>
                            </span>
                            <span *ngIf="!current.extraAllowed.length" class="hint inline">None yet.</span>
                        </div>
                        <div class="picker">
                            <input class="form-input" placeholder="Country code (e.g. JP, IL, BR)" [(ngModel)]="newExtra" (keyup.enter)="addExtra()" maxlength="2" style="text-transform: uppercase">
                            <button class="btn btn-secondary btn-sm" (click)="addExtra()" [disabled]="!newExtra">+ Add</button>
                        </div>
                    </div>
                </div>
            </vdr-page-block>

            <vdr-page-block>
                <div class="card">
                    <div class="card-block">
                        <h3 class="step-title">Always-blocked countries</h3>
                        <p class="hint" *ngIf="strategy === 'specific'">Subtracted from the allow-list — e.g. block 🇷🇺 while allowing &ldquo;Europe&rdquo;.</p>
                        <p class="hint" *ngIf="strategy === 'worldwide'">In worldwide mode this is the <em>only</em> filter — everyone except these countries is allowed.</p>
                        <div class="chip-row">
                            <span class="chip blocked" *ngFor="let cc of current.blockedCountries">
                                {{ countryLabel(cc) }}
                                <button class="chip-x" (click)="removeBlocked(cc)" title="Remove">×</button>
                            </span>
                            <span *ngIf="!current.blockedCountries.length" class="hint inline">None yet.</span>
                        </div>
                        <div class="picker">
                            <input class="form-input" placeholder="Country code (e.g. RU, IR)" [(ngModel)]="newBlocked" (keyup.enter)="addBlocked()" maxlength="2" style="text-transform: uppercase">
                            <button class="btn btn-secondary btn-sm" (click)="addBlocked()" [disabled]="!newBlocked">+ Add</button>
                            <span class="hint inline" style="margin-left: 12px">Common: RU, BY, IR, KP, SY, CU, MM</span>
                        </div>
                    </div>
                </div>
            </vdr-page-block>

            <vdr-page-block *ngIf="isUkResolved()">
                <div class="card">
                    <div class="card-block">
                        <h3 class="step-title">UK subdivisions <small>(only applies when GB is allowed)</small></h3>
                        <p class="hint">Tighten to specific UK regions. Leave empty or pick all four to allow the whole UK.</p>
                        <div class="uk-row">
                            <label *ngFor="let r of ukRegions" class="uk-pill" [class.active]="current.allowedGbRegions.includes(r.value)">
                                <input type="checkbox" [checked]="current.allowedGbRegions.includes(r.value)" (change)="toggleUkRegion(r.value)">
                                {{ r.label }}
                            </label>
                        </div>
                    </div>
                </div>
            </vdr-page-block>

            <vdr-page-block>
                <div class="card preview-card">
                    <div class="card-block">
                        <h3 class="step-title">Resolved allow-list</h3>
                        <div *ngIf="!current.enabled" class="preview-banner preview-off">
                            <strong>Geo-block is OFF</strong> — everyone can visit.
                        </div>
                        <div *ngIf="current.enabled">
                            <div class="preview-banner preview-allow">
                                <strong *ngIf="resolvedAllowed() === null">✅ Allow visitors from anywhere</strong>
                                <strong *ngIf="resolvedAllowed() !== null && resolvedAllowed()!.length">
                                    ✅ Allow visitors from {{ resolvedAllowed()!.length }} {{ resolvedAllowed()!.length === 1 ? 'country' : 'countries' }}
                                </strong>
                                <strong *ngIf="resolvedAllowed() !== null && !resolvedAllowed()!.length" class="warn">
                                    ⚠️ Nothing is allowed — every visitor will be blocked.
                                </strong>
                                <div class="country-chips" *ngIf="resolvedAllowed() !== null && resolvedAllowed()!.length">
                                    <span class="mini-chip" *ngFor="let cc of resolvedAllowed()!">{{ cc }}</span>
                                </div>
                            </div>
                            <div class="preview-banner preview-block" *ngIf="current.blockedCountries.length">
                                <strong>🚫 Always block</strong>
                                <div class="country-chips">
                                    <span class="mini-chip blocked" *ngFor="let cc of current.blockedCountries">{{ cc }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </vdr-page-block>
        </ng-container>

        <!-- ============================================================= BLOCK PAGE TAB -->
        <ng-container *ngIf="!loading && current && tab === 'message'">
            <vdr-page-block>
                <div class="card">
                    <div class="card-block">
                        <h3 class="step-title">Block page</h3>
                        <p class="hint">Customise what blocked visitors see. Leave blank for sensible defaults.</p>

                        <div class="form-row">
                            <label>Custom message <small>(optional)</small></label>
                            <textarea class="form-input" rows="4" [(ngModel)]="current.blockMessage" (ngModelChange)="markDirty()" placeholder="We're sorry — we don't ship to your country yet. Get in touch if you'd like to be notified when we expand."></textarea>
                        </div>

                        <div class="form-row">
                            <label>Redirect URL <small>(optional)</small></label>
                            <input class="form-input" [(ngModel)]="current.blockRedirectUrl" (ngModelChange)="markDirty()" placeholder="https://example.com/sorry">
                            <p class="hint">When set, blocked visitors are redirected here instead of seeing the block page.</p>
                        </div>

                        <div class="form-row">
                            <label>Logo URL <small>(optional)</small></label>
                            <input class="form-input" [(ngModel)]="current.blockLogoUrl" (ngModelChange)="markDirty()" placeholder="https://example.com/logo.svg">
                        </div>
                    </div>
                </div>
            </vdr-page-block>
        </ng-container>

        <!-- ============================================================= IP ALLOWLIST TAB -->
        <ng-container *ngIf="!loading && current && tab === 'allowlist'">
            <vdr-page-block>
                <div class="card">
                    <div class="card-block">
                        <h3 class="step-title">IP allowlist <small>(overrides every rule)</small></h3>
                        <p class="hint">IPs or IPv4 CIDR ranges that bypass all country / region rules. Use for your office, oncall engineers, payment processor probes.</p>
                        <div class="chip-row">
                            <span class="chip mono" *ngFor="let ip of current.ipAllowlist">
                                {{ ip }}
                                <button class="chip-x" (click)="removeIp(ip)" title="Remove">×</button>
                            </span>
                            <span *ngIf="!current.ipAllowlist.length" class="hint inline">No bypass IPs configured.</span>
                        </div>
                        <div class="picker">
                            <input class="form-input mono" placeholder="203.0.113.42 or 203.0.113.0/24" [(ngModel)]="newIp" (keyup.enter)="addIp()" style="min-width: 260px">
                            <button class="btn btn-secondary btn-sm" (click)="addIp()" [disabled]="!newIp">+ Add</button>
                        </div>
                    </div>
                </div>
            </vdr-page-block>
        </ng-container>

        <!-- ============================================================= SIMULATE TAB -->
        <ng-container *ngIf="!loading && current && tab === 'simulate'">
            <vdr-page-block>
                <div class="card">
                    <div class="card-block">
                        <h3 class="step-title">Simulate a visitor</h3>
                        <p class="hint">Test exactly what your current rules will do for a hypothetical visitor — without saving anything to the storefront.</p>
                        <div class="sim-grid">
                            <div>
                                <label>Country code</label>
                                <input class="form-input" [(ngModel)]="sim.country" placeholder="US" maxlength="2" style="text-transform: uppercase">
                            </div>
                            <div>
                                <label>UK region <small>(optional)</small></label>
                                <input class="form-input" [(ngModel)]="sim.region" placeholder="ENG / WLS / SCT / NIR" maxlength="3" style="text-transform: uppercase">
                            </div>
                            <div>
                                <label>IP address <small>(optional)</small></label>
                                <input class="form-input" [(ngModel)]="sim.ip" placeholder="203.0.113.42">
                            </div>
                        </div>
                        <button class="btn btn-primary" (click)="runSim()" [disabled]="simBusy">
                            {{ simBusy ? 'Running…' : 'Run simulation' }}
                        </button>

                        <div class="sim-result" *ngIf="simResult">
                            <div *ngIf="simResult.ipMatchesAllowlist" class="sim-banner allow">
                                <strong>✅ Allowed</strong> — IP matches the allowlist, every other rule is bypassed.
                            </div>
                            <div *ngIf="!simResult.ipMatchesAllowlist && simResult.verdict.allowed" class="sim-banner allow">
                                <strong>✅ Allowed</strong> ({{ simResult.verdict.reason }})
                            </div>
                            <div *ngIf="!simResult.ipMatchesAllowlist && !simResult.verdict.allowed" class="sim-banner deny">
                                <strong>🚫 Blocked</strong> ({{ simResult.verdict.reason }})
                            </div>
                        </div>
                    </div>
                </div>
            </vdr-page-block>
        </ng-container>

        <!-- ============================================================= STATS TAB -->
        <ng-container *ngIf="!loading && current && tab === 'stats'">
            <vdr-page-block>
                <div class="card">
                    <div class="card-block">
                        <h3 class="step-title">Block statistics <small>last {{ statsDays }} days</small></h3>

                        <div *ngIf="!stats" class="hint">Loading…</div>
                        <div *ngIf="stats">
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="num">{{ stats.totals.blocked || 0 }}</div>
                                    <div class="lbl">Full blocks</div>
                                </div>
                                <div class="stat-card">
                                    <div class="num">{{ stats.totals.softBlocked || 0 }}</div>
                                    <div class="lbl">Soft blocks</div>
                                </div>
                                <div class="stat-card">
                                    <div class="num">{{ stats.totals.total || 0 }}</div>
                                    <div class="lbl">Total events</div>
                                </div>
                                <div class="stat-card">
                                    <div class="num">{{ stats.totals.uniqueIps || 0 }}</div>
                                    <div class="lbl">Unique IPs</div>
                                </div>
                            </div>

                            <h4 style="margin-top: 24px">Top blocked countries</h4>
                            <table class="table table-compact" *ngIf="stats.topCountries?.length">
                                <thead><tr><th>Country</th><th style="width: 100px">Blocked</th></tr></thead>
                                <tbody>
                                    <tr *ngFor="let r of stats.topCountries">
                                        <td>{{ r.country || '—' }}</td>
                                        <td>{{ r.n }}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p *ngIf="!stats.topCountries?.length" class="hint">No blocks recorded yet.</p>

                            <h4 style="margin-top: 24px">By reason</h4>
                            <table class="table table-compact" *ngIf="stats.reasons?.length">
                                <thead><tr><th>Reason</th><th style="width: 100px">Count</th></tr></thead>
                                <tbody>
                                    <tr *ngFor="let r of stats.reasons">
                                        <td>{{ r.reason }}</td>
                                        <td>{{ r.n }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </vdr-page-block>
        </ng-container>

        <!-- ============================================================= SAVE BAR -->
        <vdr-page-block *ngIf="!loading && current && tab !== 'simulate' && tab !== 'stats'">
            <div class="save-bar">
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
        .subtitle { font-size: 13px; color: var(--color-component-color-300); margin: 2px 0 0; }

        .top-bar { border-top: 3px solid var(--color-primary-500, #1d4ed8); }
        .chan-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .lbl { font-size: 12px; color: var(--color-component-color-300); }
        .form-select, .form-input {
            padding: 6px 10px; border-radius: 4px; min-width: 180px;
            border: 1px solid var(--color-component-border-200);
            background: var(--color-component-bg-100);
            color: var(--color-text-100, inherit);
        }
        .form-input.mono { font-family: var(--clr-font-family-monospace, monospace); }
        .filter-input { width: 100%; max-width: 360px; margin-bottom: 12px; }
        textarea.form-input { font-family: inherit; min-height: 80px; width: 100%; max-width: 600px; }
        .form-row { margin: 12px 0; }
        .form-row label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 4px; }
        .form-row label small { color: var(--color-component-color-300); font-weight: 400; margin-left: 4px; }

        .status-pill {
            display: inline-block; padding: 3px 12px; border-radius: 12px;
            font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
        }
        .status-pill.on { background: #10b981; color: #fff; }
        .status-pill.off { background: var(--color-component-bg-200); color: var(--color-component-color-300); }
        .mode-pill {
            display: inline-block; padding: 3px 10px; border-radius: 10px;
            font-size: 11px; font-weight: 600;
        }
        .mode-pill.mode-block { background: #fee2e2; color: #991b1b; }
        .mode-pill.mode-soft { background: #fef3c7; color: #92400e; }
        .dirty-flag { color: #f59e0b; font-weight: 600; font-size: 12px; }

        .tabs { display: flex; gap: 4px; margin-top: 16px; border-bottom: 1px solid var(--color-component-border-200); }
        .tab {
            padding: 8px 16px;
            background: transparent; border: 0; border-bottom: 2px solid transparent;
            font-size: 13px; font-weight: 500;
            color: var(--color-component-color-300); cursor: pointer;
            margin-bottom: -1px;
        }
        .tab:hover { color: var(--color-text-100); }
        .tab.active { border-bottom-color: var(--color-primary-500, #1d4ed8); color: var(--color-text-100); font-weight: 600; }

        .hint { font-size: 13px; color: var(--color-component-color-300); margin: 6px 0 12px; }
        .hint.inline { display: inline; margin: 0; }

        .step-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
        .step-title small { color: var(--color-component-color-300); font-weight: 400; margin-left: 6px; }
        .group-title { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--color-component-color-300); margin: 14px 0 8px; }

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

        .preset-section { margin-top: 8px; }
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
        .preset-hint { font-size: 11px; color: var(--color-component-color-300); margin-top: 4px; line-height: 1.4; }

        .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; min-height: 30px; }
        .chip {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 4px 10px; border-radius: 14px;
            background: #dbeafe; color: #1e3a8a; font-size: 12px;
            border: 1px solid #93c5fd;
        }
        .chip.blocked { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
        .chip.mono { font-family: var(--clr-font-family-monospace, monospace); background: var(--color-component-bg-200); color: var(--color-text-100); border-color: var(--color-component-border-200); }
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

        .sim-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0 16px; max-width: 700px; }
        .sim-result { margin-top: 16px; }
        .sim-banner { padding: 12px 16px; border-radius: 6px; font-size: 14px; }
        .sim-banner.allow { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
        .sim-banner.deny { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
        .stat-card {
            padding: 14px 18px;
            border: 1px solid var(--color-component-border-200);
            border-radius: 6px;
            background: var(--color-component-bg-100);
        }
        .stat-card .num { font-size: 24px; font-weight: 700; line-height: 1.2; color: var(--color-primary-500, #1d4ed8); }
        .stat-card .lbl { font-size: 11px; color: var(--color-component-color-300); margin-top: 2px; }

        .save-bar { display: flex; gap: 8px; align-items: center; padding: 12px; background: var(--color-component-bg-100); border: 1px solid var(--color-component-border-200); border-radius: 6px; }

        .update-banner {
            display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap;
            padding: 12px 16px; border-radius: 8px;
            background: #ecfeff; border: 1px solid #67e8f9;
            color: #155e75; font-size: 13px;
        }
        .update-banner.major { background: #fef3c7; border-color: #fde68a; color: #92400e; }
        .update-banner strong { font-weight: 700; }
        .update-banner .major-pill { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 8px; background: #f59e0b; color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .update-banner .actions { display: flex; gap: 8px; align-items: center; }

        /* Mobile-friendly layout under 768px */
        @media (max-width: 767px) {
            .chan-row { flex-direction: column; align-items: stretch; gap: 10px; }
            .chan-row .form-select { width: 100%; min-width: 0; }
            .tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; white-space: nowrap; }
            .tabs::-webkit-scrollbar { height: 4px; }
            .tab { flex-shrink: 0; padding: 10px 14px; min-height: 44px; }
            .mode-grid { grid-template-columns: 1fr; }
            .preset-grid { grid-template-columns: 1fr; }
            .picker { flex-direction: column; align-items: stretch; }
            .picker .form-input { width: 100%; min-width: 0; }
            .picker .btn { width: 100%; }
            .sim-grid { grid-template-columns: 1fr; max-width: 100%; }
            .stats-grid { grid-template-columns: 1fr 1fr; }
            .filter-input { max-width: 100%; }
            textarea.form-input { max-width: 100%; }
            .save-bar { flex-direction: column; align-items: stretch; gap: 8px; }
            .save-bar button { width: 100%; min-height: 44px; }
            table { font-size: 12px; }
            .update-banner { flex-direction: column; align-items: flex-start; }
            .update-banner .actions { width: 100%; justify-content: flex-end; }
            .form-row label { font-size: 14px; }
        }
        @media (max-width: 360px) {
            .stats-grid { grid-template-columns: 1fr; }
            .uk-row { flex-direction: column; }
            .uk-pill { width: 100%; justify-content: center; }
        }
    `],
})
export class GeoBlockComponent implements OnInit {
    loading = true;
    saving = false;
    channels: ChannelRow[] = [];
    currentToken = '';
    current: ChannelRow | null = null;
    dirty = false;

    tab: 'rules' | 'message' | 'allowlist' | 'simulate' | 'stats' = 'rules';
    strategy: 'specific' | 'worldwide' = 'specific';
    presetFilter = '';

    newExtra = '';
    newBlocked = '';
    newIp = '';

    sim = { country: '', region: '', ip: '' };
    simBusy = false;
    simResult: any = null;

    stats: any = null;
    statsDays = 30;

    updateBanner: { packageName: string; current: string; latest: string; isMajor: boolean } | null = null;
    private dismissKey = 'huloglobal-geo-block-update-dismissed';

    presets: PresetMeta[] = [];
    presetGroups = [
        { kind: 'all',        label: 'Everywhere' },
        { kind: 'geography',  label: 'By geography' },
        { kind: 'trade',      label: 'Trade blocs' },
        { kind: 'political',  label: 'Political / economic groups' },
        { kind: 'language',   label: 'Language / cultural' },
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

    ngOnInit() {
        this.http.get<{ presets: PresetMeta[] }>('/geo-block/presets').subscribe({
            next: r => { this.presets = r.presets || []; this.cdr.markForCheck(); },
            error: () => { /* presets are nice-to-have, not required */ },
        });
        this.loadStatus();
        this.reload();
    }

    loadStatus() {
        this.http.get<any>('/geo-block/status').subscribe({
            next: (s) => {
                const u = s?.update;
                if (!u?.updateAvailable || !u.latest) return;
                let dismissed = '';
                try { dismissed = localStorage.getItem(this.dismissKey) || ''; } catch {}
                if (dismissed === u.latest) return;
                this.updateBanner = { packageName: u.packageName, current: u.current, latest: u.latest, isMajor: !!u.isMajor };
                this.cdr.markForCheck();
            },
            error: () => { /* nice-to-have */ },
        });
    }

    dismissUpdate() {
        if (!this.updateBanner) return;
        try { localStorage.setItem(this.dismissKey, this.updateBanner.latest); } catch {}
        this.updateBanner = null;
    }

    reload() {
        this.loading = true;
        this.dirty = false;
        this.http.get<{ channels: ChannelRow[] }>('/geo-block/admin/channels').subscribe({
            next: (res) => {
                this.channels = (res.channels || []).map(c => ({
                    ...c,
                    mode: c.mode || 'block',
                    ipAllowlist: c.ipAllowlist || [],
                    blockMessage: c.blockMessage || '',
                    blockRedirectUrl: c.blockRedirectUrl || '',
                    blockLogoUrl: c.blockLogoUrl || '',
                }));
                if (!this.currentToken && this.channels.length) {
                    this.currentToken = this.channels[0].token;
                }
                this.current = this.channels.find(c => c.token === this.currentToken) || null;
                this.deriveStrategy();
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
        this.deriveStrategy();
        this.stats = null;
        this.simResult = null;
    }

    private deriveStrategy() {
        if (!this.current) return;
        this.strategy = this.current.allowedRegions.includes('WORLDWIDE') ? 'worldwide' : 'specific';
    }

    onStrategyChange() {
        if (!this.current) return;
        if (this.strategy === 'worldwide') {
            this.current.allowedRegions = ['WORLDWIDE'];
            this.current.extraAllowed = [];
        } else {
            this.current.allowedRegions = this.current.allowedRegions.filter(r => r !== 'WORLDWIDE');
            if (!this.current.allowedRegions.length && !this.current.extraAllowed.length) {
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

    pickedRegionCount(): number {
        return this.current?.allowedRegions.length || 0;
    }

    filteredPresets(kind: string): PresetMeta[] {
        const filter = this.presetFilter.trim().toLowerCase();
        return this.presets
            .filter(p => p.kind === kind)
            .filter(p => !filter || p.label.toLowerCase().includes(filter) || p.description.toLowerCase().includes(filter));
    }

    addExtra() {
        if (!this.current || !this.newExtra) return;
        const cc = this.newExtra.trim().toUpperCase();
        if (cc.length === 2 && !this.current.extraAllowed.includes(cc)) {
            this.current.extraAllowed = [...this.current.extraAllowed, cc];
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
        const cc = this.newBlocked.trim().toUpperCase();
        if (cc.length === 2 && !this.current.blockedCountries.includes(cc)) {
            this.current.blockedCountries = [...this.current.blockedCountries, cc];
            this.markDirty();
        }
        this.newBlocked = '';
    }
    removeBlocked(cc: string) {
        if (!this.current) return;
        this.current.blockedCountries = this.current.blockedCountries.filter(c => c !== cc);
        this.markDirty();
    }

    addIp() {
        if (!this.current || !this.newIp) return;
        const ip = this.newIp.trim();
        if (ip && !this.current.ipAllowlist.includes(ip)) {
            this.current.ipAllowlist = [...this.current.ipAllowlist, ip];
            this.markDirty();
        }
        this.newIp = '';
    }
    removeIp(ip: string) {
        if (!this.current) return;
        this.current.ipAllowlist = this.current.ipAllowlist.filter(i => i !== ip);
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

    countryLabel(cc: string): string { return cc; }

    /** Local preview — uses the server-resolved allowed list when no
     *  rule changes are pending. Best-effort otherwise. */
    resolvedAllowed(): string[] | null {
        if (!this.current) return [];
        if (this.current.allowedRegions.includes('WORLDWIDE')) return null;
        return this.current.resolved?.allowedCountries ?? null;
    }

    markDirty() { this.dirty = true; }

    save() {
        if (!this.current) return;
        this.saving = true;
        const body = {
            token: this.current.token,
            enabled: this.current.enabled,
            mode: this.current.mode,
            allowedRegions: this.current.allowedRegions,
            extraAllowed: this.current.extraAllowed,
            blockedCountries: this.current.blockedCountries,
            allowedGbRegions: this.current.allowedGbRegions,
            ipAllowlist: this.current.ipAllowlist,
            blockMessage: this.current.blockMessage,
            blockRedirectUrl: this.current.blockRedirectUrl,
            blockLogoUrl: this.current.blockLogoUrl,
        };
        this.http.post<any>('/geo-block/admin/save', body).subscribe({
            next: () => {
                this.saving = false;
                this.dirty = false;
                this.notify.success('Site access settings saved');
                this.reload();
            },
            error: (err) => {
                this.saving = false;
                this.notify.error(err?.error?.error || 'Save failed');
            },
        });
    }

    runSim() {
        if (!this.current) return;
        this.simBusy = true;
        this.simResult = null;
        this.http.post<any>('/geo-block/admin/simulate', {
            token: this.current.token,
            country: this.sim.country.trim().toUpperCase() || null,
            region: this.sim.region.trim().toUpperCase() || null,
            ip: this.sim.ip.trim() || null,
        }).subscribe({
            next: r => { this.simResult = r; this.simBusy = false; this.cdr.markForCheck(); },
            error: () => { this.simBusy = false; this.notify.error('Simulation failed'); },
        });
    }

    loadStats() {
        if (!this.current) return;
        if (this.stats) return; // load once on first visit
        this.http.get<any>(`/geo-block/admin/stats?days=${this.statsDays}&channelId=${this.current.id}`).subscribe({
            next: s => { this.stats = s; this.cdr.markForCheck(); },
            error: () => this.notify.error('Failed to load stats'),
        });
    }
}
