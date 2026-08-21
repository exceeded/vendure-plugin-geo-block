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
    allowedSubdivisions: Record<string, string[]>;
    ipAllowlist: string[];
    blockMessage: string;
    blockRedirectUrl: string;
    blockLogoUrl: string;
    resolved: { allowedCountries: string[] | null; blockedCountries: string[] };
}

interface SubdivisionDef { code: string; label: string; }

interface PresetMeta { key: string; label: string; kind: string; description: string; countryCount: number | null; }

@Component({
    selector: 'ees-geo-block',
    standalone: false,
    template: `
        <!-- ── HULO brand hero ───────────────────────────────────────
             Consistent header pattern across every HULO plugin.
             Logo + plain-English one-liner + help + refresh in the
             action bar. Keeps the operator anchored on what this
             page does before they see the tabs. -->
        <vdr-page-block>
            <div class="hulo-hero">
                <div class="hulo-hero-logo" aria-hidden="true">
                    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                        <rect width="64" height="64" rx="14" fill="#0f1419"/>
                        <circle cx="32" cy="32" r="17" fill="none" stroke="#ffffff" stroke-width="2.5"/>
                        <ellipse cx="32" cy="32" rx="17" ry="7" fill="none" stroke="#ffffff" stroke-width="2"/>
                        <ellipse cx="32" cy="32" rx="7" ry="17" fill="none" stroke="#ffffff" stroke-width="2"/>
                        <line x1="18" y1="46" x2="46" y2="18" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="hulo-hero-text">
                    <h2 class="hulo-hero-title">Site access</h2>
                    <p class="hulo-hero-sub">Decide who can see this storefront — by country, IP, business hours or bot. All rules apply per channel.</p>
                </div>
                <div class="hulo-hero-actions">
                    <button class="gbtn gbtn-hero hulo-help-btn" (click)="helpOpen = !helpOpen" [attr.aria-expanded]="helpOpen">
                        <clr-icon shape="help"></clr-icon>
                        <span>Help</span>
                    </button>
                    <button class="gbtn gbtn-hero" (click)="reload()" [disabled]="loading">
                        <clr-icon shape="refresh"></clr-icon> Refresh
                    </button>
                </div>
            </div>
        </vdr-page-block>

        <vdr-page-block *ngIf="licMeta && !licMeta.licensed">
            <div class="lic-banner">
                <div *ngIf="licMeta.tier === 'trial'">
                    <strong>⏳ Full-featured evaluation</strong> —
                    <ng-container *ngIf="licMeta.eval?.daysRemaining != null">
                        <strong>{{ licMeta.eval.daysRemaining }} day{{ licMeta.eval.daysRemaining === 1 ? '' : 's' }} left</strong> with everything enabled.
                    </ng-container>
                    <ng-container *ngIf="licMeta.eval?.daysRemaining == null">everything is enabled.</ng-container>
                    Afterwards the plugin drops to the free tier.
                </div>
                <div *ngIf="licMeta.tier !== 'trial'">
                    <strong>🔓 Free tier</strong> — your evaluation has ended. Premium features are paused; your configuration is kept and reactivates instantly with a key.
                </div>
                <div class="lic-actions">
                    <input class="lic-key" type="text" placeholder="Paste licence key (eyJhbGciOi…)" [(ngModel)]="licKeyInput" [disabled]="licActivating">
                    <button class="gbtn gbtn-primary gbtn-sm" (click)="activateLicence()" [disabled]="licActivating || !licKeyInput">{{ licActivating ? 'Verifying…' : 'Activate' }}</button>
                    <a href="https://huloglobal.com/vendure-plugins/geo-block/" target="_blank" class="gbtn gbtn-outline gbtn-sm">Get a licence ↗</a>
                </div>
            </div>
        </vdr-page-block>

        <!-- Help drawer — collapsed by default. Plain-English steps
             + docs + support links so operators don't have to context-
             switch to figure out what a control does. -->
        <vdr-page-block *ngIf="helpOpen">
            <div class="hulo-help-drawer">
                <div class="hulo-help-grid">
                    <div class="hulo-help-card">
                        <div class="hulo-help-num">1</div>
                        <h4>Pick a channel</h4>
                        <p>Every rule below applies to the channel you have selected. Multi-store operators can set different rules per channel.</p>
                    </div>
                    <div class="hulo-help-card">
                        <div class="hulo-help-num">2</div>
                        <h4>Choose your rules</h4>
                        <p>Region presets (EU, GCC, ANZ…) get you started fast, or pick countries and states one by one. Add IPs that always bypass every rule.</p>
                    </div>
                    <div class="hulo-help-card">
                        <div class="hulo-help-num">3</div>
                        <h4>Preview + go live</h4>
                        <p>Use the Simulate tab to check what a visitor from country X would see. When you're happy, flip Site access on. Stats appear as visitors arrive.</p>
                    </div>
                </div>
                <div class="hulo-help-links">
                    <a href="https://huloglobal.com/vendure-plugins/geo-block/docs/" target="_blank">Full docs ↗</a>
                    <a href="https://huloglobal.com/vendure-plugins/geo-block/" target="_blank">Plugin page ↗</a>
                    <a href="mailto:support@huloglobal.com">Email support</a>
                </div>
            </div>
        </vdr-page-block>

        <!-- Empty / first-run panel — shown when the channel exists
             but has never been configured. Gives the operator a
             one-click "turn on with sensible defaults" so they never
             stare at a blank screen. -->
        <vdr-page-block *ngIf="!loading && current && showFirstRun()">
            <div class="hulo-firstrun">
                <div class="hulo-firstrun-emoji">🎉</div>
                <div>
                    <h3>You're all set to configure {{ current.code || 'this channel' }}</h3>
                    <p>Nothing is enforced yet. Pick a region preset below, or flip Site access on to start with an allow-list of Worldwide (nothing blocked).</p>
                </div>
                <button class="gbtn gbtn-primary" (click)="turnOnWithDefaults()">Turn on (Worldwide)</button>
            </div>
        </vdr-page-block>

        <vdr-page-block *ngIf="updateBanner">
            <div class="update-banner" [class.major]="updateBanner.isMajor">
                <div>
                    <strong>📦 Update available</strong>
                    {{ updateBanner.packageName }} {{ updateBanner.current }} → <strong>{{ updateBanner.latest }}</strong>
                    <span *ngIf="updateBanner.isMajor" class="major-pill">major</span>
                </div>
                <div class="actions">
                    <a [href]="'https://github.com/exceeded/vendure-plugin-geo-block/releases/tag/v' + updateBanner.latest" target="_blank" class="gbtn gbtn-ghost gbtn-sm">Release notes ↗</a>
                    <button class="gbtn gbtn-outline gbtn-sm" (click)="dismissUpdate()">Dismiss</button>
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

                        <span class="gb-switch-group">
                            <button class="gb-switch" role="switch" [attr.aria-checked]="current.enabled" [class.on]="current.enabled" (click)="toggleEnabled()" aria-label="Site access enforcement">
                                <span class="gb-switch-knob" aria-hidden="true"></span>
                            </button>
                            <span class="gb-switch-label">{{ current.enabled ? 'Enforcement on' : 'Enforcement off' }}</span>
                        </span>

                        <span class="mode-pill" *ngIf="current.enabled" [class.mode-block]="current.mode === 'block'" [class.mode-soft]="current.mode === 'soft'">
                            {{ current.mode === 'soft' ? 'Soft block (banner)' : 'Full block' }}
                        </span>

                        <span class="dirty-flag" *ngIf="dirty">● Unsaved</span>
                    </div>

                    <!-- Plain-English readout of what the current rules
                         actually DO — recomputed live as the operator
                         edits, so "what does this mean?" is always
                         answered before anything is saved. -->
                    <p class="status-sentence" [class.status-off]="!current.enabled" [class.status-danger]="isLockout()">
                        {{ statusSentence() }}
                    </p>

                    <div class="tabs" role="tablist" aria-label="Site access sections">
                        <button class="tab" role="tab" [attr.aria-selected]="tab === 'rules'" [class.active]="tab === 'rules'" (click)="tab = 'rules'">Rules</button>
                        <button class="tab" role="tab" [attr.aria-selected]="tab === 'message'" [class.active]="tab === 'message'" (click)="tab = 'message'">Block page</button>
                        <button class="tab" role="tab" [attr.aria-selected]="tab === 'allowlist'" [class.active]="tab === 'allowlist'" (click)="tab = 'allowlist'">IP allowlist<span class="tab-count" *ngIf="current.ipAllowlist.length">{{ current.ipAllowlist.length }}</span></button>
                        <button class="tab" role="tab" [attr.aria-selected]="tab === 'simulate'" [class.active]="tab === 'simulate'" (click)="tab = 'simulate'">Simulate</button>
                        <button class="tab" role="tab" [attr.aria-selected]="tab === 'stats'" [class.active]="tab === 'stats'" (click)="tab = 'stats'; loadStats()">Stats</button>
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
                                <button class="chip-x" (click)="removeExtra(cc)" [attr.aria-label]="'Remove ' + countryLabel(cc)">×</button>
                            </span>
                            <span *ngIf="!current.extraAllowed.length" class="hint inline">None yet.</span>
                        </div>
                        <div class="picker">
                            <input class="form-input" placeholder="Country code (e.g. JP, IL, BR)" [(ngModel)]="newExtra" (keyup.enter)="addExtra()" maxlength="2" style="text-transform: uppercase">
                            <button class="gbtn gbtn-outline gbtn-sm" (click)="addExtra()" [disabled]="!newExtra">+ Add</button>
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
                                <button class="chip-x" (click)="removeBlocked(cc)" [attr.aria-label]="'Remove ' + countryLabel(cc)">×</button>
                            </span>
                            <span *ngIf="!current.blockedCountries.length" class="hint inline">None yet.</span>
                        </div>
                        <div class="picker">
                            <input class="form-input" placeholder="Country code (e.g. RU, IR)" [(ngModel)]="newBlocked" (keyup.enter)="addBlocked()" maxlength="2" style="text-transform: uppercase">
                            <button class="gbtn gbtn-outline gbtn-sm" (click)="addBlocked()" [disabled]="!newBlocked">+ Add</button>
                            <span class="hint inline" style="margin-left: 12px">Common: RU, BY, IR, KP, SY, CU, MM</span>
                        </div>
                    </div>
                </div>
            </vdr-page-block>

            <vdr-page-block>
                <div class="card">
                    <div class="card-block">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
                            <div>
                                <h3 class="step-title" style="margin-bottom:0">Country subdivisions <small>(optional)</small></h3>
                                <p class="hint" style="margin:4px 0 0">Tighten to specific regions inside any allowed country — US states, CA provinces, AU states, DE Länder, UK regions, etc.</p>
                            </div>
                            <button class="gbtn gbtn-outline gbtn-sm" (click)="showSubdivisions = !showSubdivisions" [attr.aria-expanded]="showSubdivisions">
                                {{ showSubdivisions ? 'Hide' : 'Show subdivisions' }}
                                <span *ngIf="subdivisionCount() > 0" class="status-pill on" style="margin-left:8px">{{ subdivisionCount() }} configured</span>
                            </button>
                        </div>

                        <div *ngIf="showSubdivisions" style="margin-top:18px">
                            <div class="picker" style="margin-bottom:14px">
                                <label class="lbl">Add a country</label>
                                <select class="form-select" [(ngModel)]="newSubdivisionCountry">
                                    <option value="">— pick a country with known subdivisions —</option>
                                    <option *ngFor="let key of subdivisionCountries()" [value]="key">{{ key }} ({{ subdivisionsCatalogue[key].length }} subdivisions)</option>
                                </select>
                                <button class="gbtn gbtn-outline gbtn-sm" (click)="addSubdivisionCountry()" [disabled]="!newSubdivisionCountry">+ Add</button>
                            </div>

                            <div *ngFor="let cc of activeSubdivisionCountries()" class="card" style="margin:10px 0;background:var(--color-component-bg-100)">
                                <div class="card-block">
                                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                                        <h4 style="margin:0;font-weight:600">{{ cc }} — {{ subdivisionsCatalogue[cc]?.length || 0 }} subdivisions available</h4>
                                        <button class="gbtn gbtn-ghost gbtn-danger gbtn-sm" (click)="removeSubdivisionCountry(cc)">Remove</button>
                                    </div>
                                    <p class="hint">Pick the subdivisions to allow. Leave empty = allow the whole country.</p>
                                    <div class="preset-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
                                        <label *ngFor="let s of subdivisionsCatalogue[cc]" class="preset-card" [class.active]="isSubdivisionPicked(cc, s.code)" style="padding:8px 12px">
                                            <input type="checkbox" [checked]="isSubdivisionPicked(cc, s.code)" (change)="toggleSubdivision(cc, s.code)">
                                            <div style="font-size:13px">{{ s.label }} <span class="sub-code">({{ s.code }})</span></div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div *ngIf="!activeSubdivisionCountries().length" class="hint">No subdivisions configured. Pick a country above to add one.</div>
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
                                <button class="chip-x" (click)="removeIp(ip)" [attr.aria-label]="'Remove ' + ip">×</button>
                            </span>
                            <span *ngIf="!current.ipAllowlist.length" class="hint inline">No bypass IPs configured.</span>
                        </div>
                        <div class="picker">
                            <input class="form-input mono" placeholder="203.0.113.42 or 203.0.113.0/24" [(ngModel)]="newIp" (keyup.enter)="addIp()" style="min-width: 260px">
                            <button class="gbtn gbtn-outline gbtn-sm" (click)="addIp()" [disabled]="!newIp">+ Add</button>
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
                        <button class="gbtn gbtn-primary" (click)="runSim()" [disabled]="simBusy">
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
                            <div class="kpi-row">
                                <div class="kpi">
                                    <div class="kpi-label">Full blocks</div>
                                    <div class="kpi-num">{{ stats.totals.blocked || 0 }}</div>
                                    <div class="kpi-sub">visitors turned away</div>
                                </div>
                                <div class="kpi">
                                    <div class="kpi-label">Soft blocks</div>
                                    <div class="kpi-num">{{ stats.totals.softBlocked || 0 }}</div>
                                    <div class="kpi-sub">saw the banner, could browse</div>
                                </div>
                                <div class="kpi">
                                    <div class="kpi-label">Total events</div>
                                    <div class="kpi-num">{{ stats.totals.total || 0 }}</div>
                                    <div class="kpi-sub">all geo decisions logged</div>
                                </div>
                                <div class="kpi">
                                    <div class="kpi-label">Unique IPs</div>
                                    <div class="kpi-num">{{ stats.totals.uniqueIps || 0 }}</div>
                                    <div class="kpi-sub">distinct blocked addresses</div>
                                </div>
                            </div>

                            <h4 class="subsection-title">Top blocked countries</h4>
                            <table class="table" *ngIf="stats.topCountries?.length">
                                <thead><tr><th>Country</th><th class="num-col" style="width: 140px">Blocked</th></tr></thead>
                                <tbody>
                                    <tr *ngFor="let r of stats.topCountries">
                                        <td>
                                            {{ r.country || '—' }}
                                            <span class="mini-track"><span class="mini-fill" [style.width.%]="statPct(r.n)"></span></span>
                                        </td>
                                        <td class="num-col">{{ r.n | number }}</td>
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
            <div class="save-bar" [class.is-dirty]="dirty">
                <span class="save-msg" *ngIf="dirty"><span class="save-dot" aria-hidden="true"></span> Unsaved changes</span>
                <span class="save-msg quiet" *ngIf="!dirty">All changes saved</span>
                <span class="save-spacer"></span>
                <button class="gbtn gbtn-ghost" (click)="reload()" [disabled]="saving || !dirty">Discard</button>
                <button class="gbtn gbtn-primary" (click)="save()" [disabled]="saving || !dirty">
                    {{ saving ? 'Saving…' : 'Save changes' }}
                </button>
            </div>
        </vdr-page-block>
    `,
    styles: [`
        .lic-banner { display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; padding:12px 16px; border-radius:10px; font-size:13px; background:var(--gb-tint-warn, #fef3c7); border:1px solid var(--gb-line-warn, #fcd34d); }
        .lic-actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
        .lic-key { padding:5px 9px; border:1px solid var(--gb-ui-border, #d1d5db); border-radius:7px; font-size:12.5px; min-width:280px; background:#fff; color:#0f172a; }

        :host { display: block; color: var(--gb-strong); }

        /* ── Verified theme tokens ────────────────────────────────
           The admin shell gives custom pages exactly ONE readable ink
           per theme (light --color-text-100 is only #666666) and its
           border tokens fail WCAG 1.4.11 for control boundaries in
           both themes. So this page carries its own small token set,
           per theme, every pair machine-checked against the real
           admin surface colors: >= 4.5:1 for text, >= 3:1 for control
           boundaries (see contrast-check in the release notes). */
        :host {
            --gb-surface: var(--color-component-bg-100, #fafafa);
            --gb-surface-2: var(--color-component-bg-200, #f2f3f5);
            --gb-line: var(--color-component-border-200, #d5d8de);
            --gb-line-soft: var(--color-component-border-100, #e8eaee);
            --gb-strong: #3d4147;
            --gb-muted: #5d6470;
            --gb-ui-border: #79818f;
            --gb-amber: #f59e0b;
            --gb-amber-hover: #e18f06;
            --gb-amber-edge: #b45309;
            --gb-amber-ink: #231602;
            --gb-danger-ink: #b91c1c;
            --gb-ok: #10b981; --gb-warn: #f59e0b; --gb-bad: #ef4444; --gb-info: #3b82f6;
            --gb-tint-ok:   color-mix(in srgb, var(--gb-ok) 10%, var(--gb-surface));
            --gb-tint-warn: color-mix(in srgb, var(--gb-warn) 12%, var(--gb-surface));
            --gb-tint-bad:  color-mix(in srgb, var(--gb-bad) 10%, var(--gb-surface));
            --gb-tint-info: color-mix(in srgb, var(--gb-info) 10%, var(--gb-surface));
            --gb-line-ok:   color-mix(in srgb, var(--gb-ok) 45%, transparent);
            --gb-line-warn: color-mix(in srgb, var(--gb-warn) 50%, transparent);
            --gb-line-bad:  color-mix(in srgb, var(--gb-bad) 45%, transparent);
            --gb-line-info: color-mix(in srgb, var(--gb-info) 45%, transparent);
            --gb-shadow-1: 0 1px 2px rgba(15, 23, 42, 0.06);
        }
        :host-context([data-theme='dark']) {
            --gb-strong: var(--color-text-100, hsl(210, 16%, 93%));
            --gb-muted: hsl(205, 14%, 74%);
            --gb-ui-border: hsl(203, 12%, 50%);
            --gb-amber-edge: #f59e0b;
            --gb-danger-ink: #f87171;
            --gb-shadow-1: 0 1px 2px rgba(0, 0, 0, 0.35);
        }

        /* ── Self-owned buttons (the admin CSS has no .btn-secondary
           and styles .btn only contextually — never borrow again) ── */
        .gbtn {
            display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            min-height: 36px; padding: 0 16px; border-radius: 8px;
            font-size: 13px; font-weight: 600; line-height: 1.2; white-space: nowrap;
            border: 1px solid transparent; background: none; cursor: pointer;
            color: var(--gb-strong); text-decoration: none;
            transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
        }
        .gbtn:disabled { opacity: 0.45; cursor: not-allowed; }
        .gbtn:focus-visible, .gb-switch:focus-visible, .tab:focus-visible, .chip-x:focus-visible {
            outline: 2px solid var(--gb-amber-edge); outline-offset: 2px;
        }
        .gbtn-sm { min-height: 30px; padding: 0 12px; font-size: 12px; }
        .gbtn-primary {
            background: var(--gb-amber); border-color: var(--gb-amber-edge);
            color: var(--gb-amber-ink); box-shadow: var(--gb-shadow-1);
        }
        .gbtn-primary:hover:not(:disabled) { background: var(--gb-amber-hover); }
        .gbtn-outline { border-color: var(--gb-ui-border); background: var(--gb-surface); }
        .gbtn-outline:hover:not(:disabled) { border-color: var(--gb-amber-edge); background: var(--gb-surface-2); }
        .gbtn-ghost { color: var(--gb-muted); }
        .gbtn-ghost:hover:not(:disabled) { color: var(--gb-strong); background: var(--gb-surface-2); }
        .gbtn-danger { color: var(--gb-danger-ink); }
        .gbtn-danger:hover:not(:disabled) { color: var(--gb-danger-ink); background: var(--gb-tint-bad); }
        .gbtn-hero { color: #e2e8f0; }
        .gbtn-hero:hover:not(:disabled) { color: #ffffff; background: rgba(255, 255, 255, 0.12); }
        .gbtn-hero:focus-visible { outline-color: #f59e0b; }

        /* ── Enforcement switch ──────────────────────────────────── */
        .gb-switch-group { display: inline-flex; align-items: center; gap: 8px; }
        .gb-switch {
            position: relative; width: 44px; height: 24px; flex: 0 0 auto;
            border-radius: 999px; border: 1px solid transparent; padding: 0;
            background: var(--gb-ui-border); cursor: pointer;
            transition: background 0.15s ease, border-color 0.15s ease;
        }
        .gb-switch.on { background: var(--gb-amber); border-color: var(--gb-amber-edge); }
        .gb-switch-knob {
            position: absolute; top: 2px; left: 2px; width: 18px; height: 18px;
            border-radius: 50%; background: #ffffff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.35);
            transition: transform 0.15s ease;
        }
        .gb-switch.on .gb-switch-knob { transform: translateX(20px); }
        .gb-switch-label { font-size: 13px; font-weight: 700; color: var(--gb-strong); }

        /* ── HULO hero (deliberate dark brand island, both themes) ── */
        .hulo-hero {
            display: flex; align-items: center; gap: 18px;
            padding: 20px 22px; border-radius: 14px;
            background: linear-gradient(135deg, #0f1419 0%, #1e293b 100%);
            color: #fff;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15), 0 8px 24px rgba(15, 23, 42, 0.08);
        }
        .hulo-hero-logo { flex: 0 0 auto; width: 56px; height: 56px; }
        .hulo-hero-logo svg { width: 100%; height: 100%; display: block; }
        .hulo-hero-text { flex: 1 1 auto; min-width: 0; }
        .hulo-hero-title { color: #fff; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
        .hulo-hero-sub { color: #cbd5e1; font-size: 13px; line-height: 1.5; margin: 4px 0 0; max-width: 640px; }
        .hulo-hero-actions { display: flex; gap: 6px; align-items: center; flex: 0 0 auto; }
        .hulo-help-btn clr-icon { margin-right: 4px; }

        /* ── Help drawer + first-run ─────────────────────────────── */
        .hulo-help-drawer {
            background: var(--gb-tint-warn); border: 1px solid var(--gb-line-warn);
            border-radius: 12px; padding: 20px 22px; color: var(--gb-strong);
        }
        .hulo-help-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
        .hulo-help-card { background: var(--gb-surface); border-radius: 10px; padding: 16px; border: 1px solid var(--gb-line); }
        .hulo-help-num {
            width: 24px; height: 24px; border-radius: 999px;
            background: var(--gb-amber); color: var(--gb-amber-ink);
            font-weight: 800; font-size: 13px;
            display: grid; place-items: center; margin-bottom: 8px;
        }
        .hulo-help-card h4 { margin: 0 0 4px; font-size: 14px; color: var(--gb-strong); }
        .hulo-help-card p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--gb-muted); }
        .hulo-help-links { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--gb-line-warn); display: flex; gap: 18px; flex-wrap: wrap; font-size: 13px; }
        .hulo-help-links a { color: var(--gb-strong); text-decoration: underline; text-underline-offset: 2px; font-weight: 600; }
        .hulo-help-links a:hover { color: var(--gb-amber-edge); }
        .hulo-firstrun {
            display: flex; align-items: center; gap: 16px;
            padding: 20px 22px; border-radius: 12px;
            background: var(--gb-tint-ok); border: 1px solid var(--gb-line-ok); color: var(--gb-strong);
        }
        .hulo-firstrun-emoji { font-size: 32px; line-height: 1; }
        .hulo-firstrun h3 { margin: 0; font-size: 16px; color: var(--gb-strong); }
        .hulo-firstrun p { margin: 4px 0 0; font-size: 13px; line-height: 1.5; color: var(--gb-muted); max-width: 640px; }
        .hulo-firstrun .gbtn { margin-left: auto; flex: 0 0 auto; }

        /* ── Unified card system ─────────────────────────────────── */
        .card {
            background: var(--gb-surface);
            border: 1px solid var(--gb-line);
            border-radius: 12px; overflow: visible; min-width: 0;
            box-shadow: var(--gb-shadow-1);
        }
        .card + .card { margin-top: 16px; }
        .card-block { padding: 18px 20px; }
        .step-title { font-size: 15px; font-weight: 700; color: var(--gb-strong); margin: 0 0 4px; }
        .step-title small { font-weight: 500; font-size: 12px; color: var(--gb-muted); }
        .subsection-title {
            margin: 24px 0 8px; font-size: 11px; font-weight: 700;
            letter-spacing: 0.06em; text-transform: uppercase;
            color: var(--gb-muted);
        }
        .hint { font-size: 12px; color: var(--gb-muted); margin: 2px 0 12px; }
        .hint.inline { display: inline; margin: 0; }
        .mono { font-family: ui-monospace, monospace; }
        .warn { color: var(--gb-strong); }
        .sub-code { color: var(--gb-muted); font-size: 11px; }

        /* ── Top bar: channel + switch + status + tabs ───────────── */
        .top-bar { border-left: 4px solid var(--gb-amber); }
        .chan-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .lbl {
            font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
            text-transform: uppercase; color: var(--gb-muted);
        }
        .form-select, .form-input {
            padding: 7px 10px; border-radius: 8px; min-height: 36px;
            border: 1px solid var(--gb-ui-border);
            background: var(--gb-surface);
            color: var(--gb-strong); font-size: 13px;
        }
        .form-input::placeholder { color: var(--gb-muted); opacity: 0.8; }
        .form-select { min-width: 180px; }
        .form-select:focus, .form-input:focus {
            outline: none; border-color: var(--gb-amber-edge);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--gb-amber) 30%, transparent);
        }
        .status-pill {
            font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
            padding: 4px 10px; border-radius: 999px; color: var(--gb-strong);
        }
        .status-pill.on { background: var(--gb-tint-ok); border: 1px solid var(--gb-line-ok); }
        .status-pill.off { background: var(--gb-surface-2); color: var(--gb-muted); border: 1px solid var(--gb-line); }
        .mode-pill { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; color: var(--gb-strong); }
        .mode-pill.mode-block { background: var(--gb-tint-bad); border: 1px solid var(--gb-line-bad); }
        .mode-pill.mode-soft { background: var(--gb-tint-warn); border: 1px solid var(--gb-line-warn); }
        .dirty-flag { font-size: 12px; font-weight: 700; color: var(--gb-amber-edge); }
        .status-sentence {
            margin: 12px 0 0; padding: 10px 14px; border-radius: 8px;
            font-size: 13px; line-height: 1.5; color: var(--gb-strong);
            background: var(--gb-tint-ok); border: 1px solid var(--gb-line-ok);
            border-left-width: 4px;
        }
        .status-sentence.status-off {
            background: var(--gb-surface-2); border-color: var(--gb-line);
            color: var(--gb-muted);
        }
        .status-sentence.status-danger {
            background: var(--gb-tint-bad); border-color: var(--gb-line-bad);
            color: var(--gb-strong); font-weight: 600;
        }
        .tabs { display: flex; gap: 4px; margin-top: 14px; flex-wrap: wrap; border-top: 1px solid var(--gb-line-soft); padding-top: 12px; }
        .tab {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 7px 14px; min-height: 34px; border-radius: 999px;
            border: 1px solid transparent; background: none; cursor: pointer;
            font-size: 13px; font-weight: 600;
            color: var(--gb-muted);
            transition: background 0.12s ease, color 0.12s ease;
        }
        .tab:hover { color: var(--gb-strong); background: var(--gb-surface-2); }
        .tab.active { background: var(--gb-amber); border-color: var(--gb-amber-edge); color: var(--gb-amber-ink); }
        .tab-count {
            font-size: 10px; font-weight: 800; min-width: 16px; height: 16px;
            padding: 0 4px; border-radius: 999px; display: inline-grid; place-items: center;
            background: color-mix(in srgb, currentColor 18%, transparent);
        }

        /* ── Selectable cards (mode / strategy / presets) ────────── */
        .mode-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-bottom: 8px; }
        .mode-card {
            display: block; padding: 14px 16px; border-radius: 10px; cursor: pointer;
            border: 1px solid var(--gb-line);
            background: var(--gb-surface);
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .mode-card:hover { border-color: var(--gb-amber-edge); }
        .mode-card.active { border-color: var(--gb-amber-edge); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gb-amber) 30%, transparent); }
        .mode-card:focus-within, .preset-card:focus-within { outline: 2px solid var(--gb-amber-edge); outline-offset: 2px; }
        .mode-card input, .preset-card input { margin-right: 6px; accent-color: var(--gb-amber-edge); }
        .mode-title { font-size: 13px; font-weight: 700; color: var(--gb-strong); display: inline; }
        .mode-body { margin-top: 6px; font-size: 12px; line-height: 1.5; color: var(--gb-muted); }
        .preset-section { margin-bottom: 14px; }
        .group-title {
            margin: 0 0 8px; font-size: 11px; font-weight: 700;
            letter-spacing: 0.06em; text-transform: uppercase;
            color: var(--gb-muted);
        }
        .preset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
        .preset-card {
            display: block; padding: 10px 12px; border-radius: 8px; cursor: pointer;
            border: 1px solid var(--gb-line);
            background: var(--gb-surface);
            transition: border-color 0.15s ease, background 0.15s ease;
        }
        .preset-card:hover { border-color: var(--gb-amber-edge); }
        .preset-card.active { border-color: var(--gb-amber-edge); background: var(--gb-tint-warn); }
        .preset-label { display: inline; font-size: 13px; font-weight: 600; color: var(--gb-strong); }
        .preset-hint { margin-top: 3px; font-size: 11px; line-height: 1.4; color: var(--gb-muted); }
        .filter-input { width: 100%; max-width: 320px; margin-bottom: 12px; }

        /* ── Chips + pickers ─────────────────────────────────────── */
        .chip-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; min-height: 32px; align-items: center; }
        .chip {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 4px 6px 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
            background: var(--gb-surface-2);
            border: 1px solid var(--gb-line);
            color: var(--gb-strong);
        }
        .chip-x {
            display: inline-grid; place-items: center;
            min-width: 22px; min-height: 22px; border-radius: 999px;
            background: none; border: 0; cursor: pointer; font-size: 15px; line-height: 1;
            padding: 0; color: var(--gb-muted);
        }
        .chip-x:hover { color: var(--gb-danger-ink); background: var(--gb-tint-bad); }
        .picker { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .form-row { margin-bottom: 16px; }
        .form-row label { display: block; font-size: 12px; font-weight: 700; color: var(--gb-strong); margin-bottom: 4px; }
        .form-row label small { font-weight: 500; color: var(--gb-muted); }
        .form-row .form-input { width: 100%; max-width: 560px; }
        .form-row textarea.form-input { max-width: 100%; min-height: 0; }

        /* ── Resolved preview / what-it-means banners ────────────── */
        .preview-banner {
            border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;
            font-size: 13px; line-height: 1.5; color: var(--gb-strong);
            border: 1px solid; border-left-width: 4px;
        }
        .preview-off { background: var(--gb-surface-2); border-color: var(--gb-line); color: var(--gb-muted); }
        .preview-allow { background: var(--gb-tint-ok); border-color: var(--gb-line-ok); }
        .preview-block { background: var(--gb-tint-bad); border-color: var(--gb-line-bad); }
        .country-chips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
        .mini-chip {
            font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 5px;
            background: var(--gb-surface); border: 1px solid var(--gb-line-ok);
            color: var(--gb-strong); font-family: ui-monospace, monospace;
        }
        .mini-chip.blocked { border-color: var(--gb-line-bad); }

        /* ── Simulate ────────────────────────────────────────────── */
        .sim-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 14px; }
        .sim-grid label { display: block; font-size: 12px; font-weight: 700; color: var(--gb-strong); margin-bottom: 4px; }
        .sim-grid label small { font-weight: 500; color: var(--gb-muted); }
        .sim-grid .form-input { width: 100%; }
        .sim-result { margin-top: 16px; }
        .sim-banner {
            border-radius: 8px; padding: 12px 14px; font-size: 13px;
            color: var(--gb-strong); border: 1px solid; border-left-width: 4px;
        }
        .sim-banner.allow { background: var(--gb-tint-ok); border-color: var(--gb-line-ok); }
        .sim-banner.deny { background: var(--gb-tint-bad); border-color: var(--gb-line-bad); }

        /* ── Stats KPI tiles + table ─────────────────────────────── */
        .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .kpi {
            background: var(--gb-surface);
            border: 1px solid var(--gb-line);
            border-radius: 12px; padding: 16px 18px; min-width: 0;
        }
        .kpi-label {
            font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
            text-transform: uppercase; color: var(--gb-muted);
        }
        .kpi-num {
            margin-top: 6px; font-size: 26px; font-weight: 700; line-height: 1.1;
            color: var(--gb-strong);
            font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
        }
        .kpi-sub { margin-top: 4px; font-size: 12px; color: var(--gb-muted); }
        .table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .table th {
            text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
            text-transform: uppercase; color: var(--gb-muted);
            padding: 8px 10px; border-bottom: 1px solid var(--gb-line);
        }
        .table td { padding: 9px 10px; border-bottom: 1px solid var(--gb-line-soft); color: var(--gb-strong); }
        .table tbody tr:hover { background: var(--gb-surface-2); }
        .table .num-col { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .table th.num-col { text-align: right; }
        .mini-track {
            display: block; height: 6px; margin-top: 5px; max-width: 240px;
            background: var(--gb-surface-2);
            border-radius: 999px; overflow: hidden;
        }
        .mini-fill { display: block; height: 100%; background: var(--gb-amber); border-radius: 999px; }

        /* ── Save bar — sticky, quiet until dirty ────────────────── */
        .save-bar {
            position: sticky; bottom: 12px; z-index: 5;
            display: flex; align-items: center; gap: 10px;
            padding: 12px 16px; border-radius: 12px;
            background: var(--gb-surface);
            border: 1px solid var(--gb-line);
            box-shadow: var(--gb-shadow-1);
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .save-bar.is-dirty {
            border-color: var(--gb-amber-edge);
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
        }
        .save-msg { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--gb-strong); }
        .save-msg.quiet { color: var(--gb-muted); font-weight: 500; }
        .save-dot {
            width: 8px; height: 8px; border-radius: 50%; background: var(--gb-amber);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--gb-amber) 25%, transparent);
        }
        .save-spacer { flex: 1; }

        /* ── Update banner ───────────────────────────────────────── */
        .update-banner {
            display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap;
            padding: 12px 16px; border-radius: 10px; font-size: 13px; color: var(--gb-strong);
            background: var(--gb-tint-info); border: 1px solid var(--gb-line-info);
        }
        .update-banner.major { background: var(--gb-tint-warn); border-color: var(--gb-line-warn); }
        .major-pill { font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: #b45309; color: #fff; margin-left: 6px; }
        .update-banner .actions { display: flex; gap: 6px; align-items: center; }

        @media (prefers-reduced-motion: reduce) {
            .gbtn, .gb-switch, .gb-switch-knob, .tab, .mode-card, .preset-card, .save-bar { transition: none; }
        }
        @media (max-width: 640px) {
            .hulo-hero { flex-wrap: wrap; }
            .hulo-hero-actions { width: 100%; justify-content: flex-end; }
            .hulo-firstrun { flex-wrap: wrap; }
            .hulo-firstrun .gbtn { margin-left: 0; margin-top: 8px; width: 100%; }
            .form-select { min-width: 0; flex: 1; }
            .save-bar { flex-wrap: wrap; }
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

    /** Subdivisions: hidden by default. The catalogue is loaded from
     *  `/geo-block/subdivisions` on mount. */
    showSubdivisions = false;
    newSubdivisionCountry = '';
    subdivisionsCatalogue: Record<string, SubdivisionDef[]> = {};

    updateBanner: { packageName: string; current: string; latest: string; isMajor: boolean } | null = null;
    private dismissKey = 'huloglobal-geo-block-update-dismissed';
    private firstRunDismissKey = 'huloglobal-geo-block-firstrun-dismissed';

    /** Help drawer toggle. Rendered right under the hero when true. */
    helpOpen = false;

    /**
     * True when the currently-selected channel has never been
     * configured for geo-block AND the operator hasn't dismissed the
     * first-run panel. Cheap check — no rules of any kind set.
     */
    showFirstRun(): boolean {
        try {
            if (localStorage.getItem(this.firstRunDismissKey) === '1') return false;
        } catch { /* localStorage may be disabled */ }
        if (!this.current) return false;
        if (this.current.enabled) return false;
        if (this.current.allowedRegions?.length) return false;
        if (this.current.extraAllowed?.length) return false;
        if (this.current.blockedCountries?.length) return false;
        return true;
    }

    /**
     * "Turn on with sensible defaults" — Worldwide preset + block
     * mode. The panel is destined for the first-time user who wants
     * to see something happen without picking anything. They can
     * always narrow down after.
     */
    turnOnWithDefaults(): void {
        if (!this.current) return;
        this.current.enabled = true;
        this.current.mode = 'block';
        // Worldwide preset — nothing blocked, everything allowed —
        // gives the operator a "geo-block is on but not blocking
        // anyone yet" state so they can layer restrictions on.
        if (!this.current.allowedRegions?.length) {
            this.current.allowedRegions = ['worldwide'];
        }
        try { localStorage.setItem(this.firstRunDismissKey, '1'); } catch {}
        this.markDirty();
    }

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

    licMeta: any = null;
    licKeyInput = '';
    licActivating = false;

    loadLicMeta() {
        this.http.get<any>('/geo-block/licence/status').subscribe({
            next: m => { this.licMeta = m; this.cdr.markForCheck(); },
            error: () => undefined,
        });
    }

    activateLicence() {
        const key = (this.licKeyInput || '').trim();
        if (!key) return;
        this.licActivating = true;
        this.http.post<any>('/geo-block/licence/activate', { key }).subscribe({
            next: r => {
                this.licActivating = false;
                this.licKeyInput = '';
                this.notify.success(r?.message || 'Licence activated — all features enabled');
                this.loadLicMeta();
                this.cdr.markForCheck();
            },
            error: e => {
                this.licActivating = false;
                this.notify.error(e?.error?.message || 'That key did not validate — check it was copied completely');
                this.cdr.markForCheck();
            },
        });
    }

    ngOnInit() {
        this.loadLicMeta();
        this.http.get<{ presets: PresetMeta[] }>('/geo-block/presets').subscribe({
            next: r => { this.presets = r.presets || []; this.cdr.markForCheck(); },
            error: () => { /* presets are nice-to-have, not required */ },
        });
        this.http.get<{ subdivisions: Record<string, SubdivisionDef[]> }>('/geo-block/subdivisions').subscribe({
            next: r => { this.subdivisionsCatalogue = r.subdivisions || {}; this.cdr.markForCheck(); },
            error: () => { /* nice-to-have */ },
        });
        this.loadStatus();
        this.reload();
    }

    subdivisionCountries(): string[] {
        return Object.keys(this.subdivisionsCatalogue).sort();
    }

    activeSubdivisionCountries(): string[] {
        if (!this.current) return [];
        return Object.keys(this.current.allowedSubdivisions || {}).sort();
    }

    subdivisionCount(): number {
        if (!this.current?.allowedSubdivisions) return 0;
        return Object.keys(this.current.allowedSubdivisions).filter(
            k => (this.current!.allowedSubdivisions[k] || []).length > 0,
        ).length;
    }

    isSubdivisionPicked(country: string, code: string): boolean {
        return !!this.current?.allowedSubdivisions?.[country]?.includes(code);
    }

    toggleSubdivision(country: string, code: string) {
        if (!this.current) return;
        const subs = { ...(this.current.allowedSubdivisions || {}) };
        const list = subs[country] ? [...subs[country]] : [];
        const idx = list.indexOf(code);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(code);
        subs[country] = list;
        this.current.allowedSubdivisions = subs;
        this.markDirty();
    }

    addSubdivisionCountry() {
        if (!this.current || !this.newSubdivisionCountry) return;
        const cc = this.newSubdivisionCountry.toUpperCase();
        const subs = { ...(this.current.allowedSubdivisions || {}) };
        if (!subs[cc]) subs[cc] = [];
        this.current.allowedSubdivisions = subs;
        this.newSubdivisionCountry = '';
        this.markDirty();
    }

    removeSubdivisionCountry(cc: string) {
        if (!this.current?.allowedSubdivisions) return;
        const subs = { ...this.current.allowedSubdivisions };
        delete subs[cc];
        this.current.allowedSubdivisions = subs;
        this.markDirty();
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
                    allowedSubdivisions: c.allowedSubdivisions || {},
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

    /** True when the rules would block EVERY visitor — the state an
     *  operator most needs shouting about before they hit save. */
    isLockout(): boolean {
        if (!this.current?.enabled) return false;
        const allowed = this.resolvedAllowed();
        return allowed !== null && allowed.length === 0;
    }

    /** One plain-English sentence describing what the current
     *  configuration actually does. Recomputed live while editing. */
    statusSentence(): string {
        const c = this.current;
        if (!c) return '';
        if (!c.enabled) {
            return 'Geo-block is off — every visitor can browse and buy on this channel.';
        }
        const allowed = this.resolvedAllowed();
        const modeTxt = c.mode === 'soft'
            ? 'others can browse but see a "we don\u2019t ship here" banner'
            : 'others see a block page';
        const bypass = c.ipAllowlist?.length
            ? ` ${c.ipAllowlist.length} IP${c.ipAllowlist.length === 1 ? '' : 's'} always bypass the rules.`
            : '';
        if (this.isLockout()) {
            return '\u26A0\uFE0F Nothing is allowed \u2014 every visitor will be blocked. Add a region or country before saving.';
        }
        if (allowed === null) {
            const blocked = c.blockedCountries?.length
                ? `, except visitors from ${c.blockedCountries.join(', ')} who are always blocked`
                : '';
            return `On \u2014 visitors from anywhere are allowed${blocked}.${bypass}`;
        }
        const preview = allowed.slice(0, 4).join(', ');
        const more = allowed.length > 4 ? ` +${allowed.length - 4} more` : '';
        return `On \u2014 only visitors from ${allowed.length} ${allowed.length === 1 ? 'country' : 'countries'} (${preview}${more}) can use this store; ${modeTxt}.${bypass}`;
    }

    /** Width for the top-blocked-countries mini bars. */
    statPct(n: number): number {
        const max = Math.max(1, ...((this.stats?.topCountries || []).map((r: any) => Number(r.n) || 0)));
        return Math.max(2, (Number(n) / max) * 100);
    }

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
            allowedSubdivisions: this.current.allowedSubdivisions || {},
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
