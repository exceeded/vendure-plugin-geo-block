import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from '@vendure/admin-ui/core';

interface WidgetData {
    tier: 'paid' | 'trial' | 'free';
    notice: { kind: string; message: string; daysLeft: number } | null;
    stats: Array<{ label: string; value: string }>;
    route: string;
}

/** Dashboard widget: three 7-day figures, the lifecycle notice and a link
 *  to the Geo Block page. Fed by `GET /geo-block/widget`. */
@Component({
    selector: 'hulo-geo-block-widget',
    standalone: true,
    imports: [SharedModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="gbw">
            <div *ngIf="!data && !error" class="gbw-muted">Loading…</div>
            <div *ngIf="error" class="gbw-muted">Geo Block is not reachable right now.</div>
            <ng-container *ngIf="data">
                <div class="gbw-row">
                    <div class="gbw-stat" *ngFor="let s of data.stats">
                        <div class="gbw-num">{{ s.value }}</div>
                        <div class="gbw-label">{{ s.label }}</div>
                    </div>
                </div>
                <div class="gbw-notice" *ngIf="data.notice">{{ data.notice.message }}</div>
                <div class="gbw-muted" *ngIf="data.tier === 'free' && !data.notice">Free tier — stats need a licence or the free trial.</div>
                <a class="gbw-link" [routerLink]="data.route">Open Geo Block →</a>
            </ng-container>
        </div>
    `,
    styles: [`
        .gbw { display: flex; flex-direction: column; gap: 10px; padding: 4px 2px; }
        .gbw-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 10px; }
        .gbw-stat { min-width: 0; }
        .gbw-num { font-size: 26px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
        .gbw-label { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-text-200, #6b7280); margin-top: 4px; }
        .gbw-notice { font-size: 12.5px; padding: 8px 10px; border-radius: 8px; background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; }
        .gbw-muted { font-size: 12.5px; color: var(--color-text-200, #6b7280); }
        .gbw-link { font-size: 13px; font-weight: 600; text-decoration: none; }
        .gbw-link:hover { text-decoration: underline; }
    `],
})
export class GeoBlockWidgetComponent implements OnInit {
    data: WidgetData | null = null;
    error = false;

    constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

    ngOnInit(): void {
        this.http.get<WidgetData>('/geo-block/widget').subscribe({
            next: d => { this.data = d; this.cdr.markForCheck(); },
            error: () => { this.error = true; this.cdr.markForCheck(); },
        });
    }
}
