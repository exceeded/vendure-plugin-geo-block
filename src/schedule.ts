/**
 * Business-hours schedule for the geo-block plugin.
 *
 * Some stores want to shut off outside working hours (B2B, high-touch
 * support, seasonal). Rather than force the operator to add / remove
 * countries by hand every morning and evening, we let them define a
 * weekly recurring schedule per channel. When the current wall-clock
 * time falls OUTSIDE the schedule, the configured `outsideAction`
 * kicks in — either full block, soft-block (banner), or allow (which
 * is a no-op — same as no schedule at all).
 *
 * Stored on the channel as a JSON custom field. Empty / null =
 * no schedule = the plugin acts on country rules alone (default).
 *
 * Deliberately narrow: one recurring weekly window per channel.
 * If you want holiday overrides, a wider schedule model, or per-
 * country schedules, the `maintenanceWindow` plugin option handles
 * one-off closures already.
 */

/** ISO day numbers: 1 = Monday .. 7 = Sunday. Matches
 *  `Intl.DateTimeFormat({ weekday: 'short' })` when combined with
 *  IANA timezone parsing below. */
export type IsoDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface BusinessHoursSchedule {
    /** IANA timezone name, e.g. "Europe/London". If omitted, the
     *  system's default timezone is used — which on a Vendure box
     *  is almost always UTC and probably not what the operator
     *  wanted, so we log a warning at boot when timezone is empty. */
    timezone?: string;
    /** Days when the store is open. Every other day is out-of-hours
     *  (24h). Empty / missing = every day. */
    days?: IsoDay[];
    /** Opening time as `"HH:mm"` (24h). E.g. "09:00". */
    from?: string;
    /** Closing time as `"HH:mm"` (24h). E.g. "17:30". */
    to?: string;
    /** What to do when the current time is outside the window. */
    outsideAction?: 'block' | 'soft' | 'allow';
    /** Human-readable message shown on the block/soft-block page
     *  when the schedule fires. Falls back to a sensible default. */
    outsideMessage?: string;
}

export interface ScheduleVerdict {
    /** True when the current time is inside business hours OR no
     *  schedule is configured. */
    inHours: boolean;
    /** The action to take when outside hours. `null` when in-hours
     *  or when the schedule says `allow`. */
    action: 'block' | 'soft' | null;
    /** Message to surface on the block page. `null` when in-hours. */
    message: string | null;
    /** Diagnostic — the local weekday + time we resolved to, for the
     *  simulator + admin UI to display. */
    localTime: string | null;
    localDay: IsoDay | null;
}

/**
 * Decide whether the current time is inside the configured
 * business-hours window.
 *
 * Pure function of the schedule + a Date — no globals, easily
 * testable with a fixed `now`.
 */
export function checkSchedule(
    schedule: BusinessHoursSchedule | null | undefined,
    now: Date = new Date(),
): ScheduleVerdict {
    if (!schedule || (!schedule.from && !schedule.to && !schedule.days?.length)) {
        return {
            inHours: true,
            action: null,
            message: null,
            localTime: null,
            localDay: null,
        };
    }

    const tz = schedule.timezone || 'UTC';
    // Extract day-of-week + HH:mm in the configured timezone.
    // `Intl.DateTimeFormat` handles DST + IANA zones correctly, no
    // dependency on `Date.getDay()` which is always in system TZ.
    let localDay: IsoDay | null = null;
    let localTime: string | null = null;
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            weekday: 'short',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
        }).formatToParts(now);
        const wd = parts.find(p => p.type === 'weekday')?.value ?? '';
        const hh = parts.find(p => p.type === 'hour')?.value ?? '00';
        const mm = parts.find(p => p.type === 'minute')?.value ?? '00';
        localDay = (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            .indexOf(wd) + 1) as IsoDay;
        localTime = `${hh}:${mm}`;
    } catch {
        // Bad timezone string — treat as in-hours so we don't
        // block real visitors due to a config typo.
        return {
            inHours: true,
            action: null,
            message: null,
            localTime: null,
            localDay: null,
        };
    }

    // Day-of-week filter. If `days` is set + doesn't include today,
    // we're out-of-hours regardless of the time.
    if (Array.isArray(schedule.days) && schedule.days.length) {
        if (!schedule.days.includes(localDay!)) {
            return outOfHoursVerdict(schedule, localTime, localDay);
        }
    }

    // Time-of-day filter.
    if (schedule.from && schedule.to && localTime) {
        const inWindow = timeInRange(localTime, schedule.from, schedule.to);
        if (!inWindow) return outOfHoursVerdict(schedule, localTime, localDay);
    }

    return {
        inHours: true,
        action: null,
        message: null,
        localTime,
        localDay,
    };
}

function outOfHoursVerdict(
    schedule: BusinessHoursSchedule,
    localTime: string | null,
    localDay: IsoDay | null,
): ScheduleVerdict {
    const action = (schedule.outsideAction || 'block');
    if (action === 'allow') {
        return { inHours: true, action: null, message: null, localTime, localDay };
    }
    const message = schedule.outsideMessage
        || defaultOutsideMessage(schedule);
    return {
        inHours: false,
        action: action === 'soft' ? 'soft' : 'block',
        message,
        localTime,
        localDay,
    };
}

function defaultOutsideMessage(s: BusinessHoursSchedule): string {
    const hours = s.from && s.to ? ` (${s.from} – ${s.to})` : '';
    const tz = s.timezone ? ` ${s.timezone}` : '';
    return `We're currently closed for orders${hours}${tz}. Please come back during business hours.`;
}

/**
 * True when `hhmm` (e.g. "09:15") is inside [from, to). Handles
 * overnight ranges (e.g. from 22:00 to 04:00 = 6 hours across
 * midnight) so ops can schedule 24/7 evening deliveries.
 */
function timeInRange(hhmm: string, from: string, to: string): boolean {
    const cur = toMinutes(hhmm);
    const a = toMinutes(from);
    const b = toMinutes(to);
    if (cur < 0 || a < 0 || b < 0) return true; // parse failure — fail-open
    if (a <= b) return cur >= a && cur < b;
    // Overnight range: valid when >= a OR < b.
    return cur >= a || cur < b;
}

function toMinutes(hhmm: string): number {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return -1;
    const h = +m[1], mi = +m[2];
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return -1;
    return h * 60 + mi;
}
