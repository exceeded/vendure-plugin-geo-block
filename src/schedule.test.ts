import { describe, it, expect } from 'vitest';
import { checkSchedule, BusinessHoursSchedule } from './schedule';

// Fixed anchor date: Wed 2026-07-08 12:30 UTC.
// UK is BST (+1) at that date so local time reads 13:30 Europe/London.
const ANCHOR = new Date('2026-07-08T12:30:00Z');

describe('checkSchedule', () => {
    it('returns in-hours when no schedule is provided', () => {
        expect(checkSchedule(null).inHours).toBe(true);
        expect(checkSchedule(undefined).inHours).toBe(true);
        expect(checkSchedule({}).inHours).toBe(true);
    });

    it('honours in-window UK business hours (BST)', () => {
        const s: BusinessHoursSchedule = {
            timezone: 'Europe/London',
            days: [1, 2, 3, 4, 5],
            from: '09:00', to: '17:30',
            outsideAction: 'block',
        };
        const v = checkSchedule(s, ANCHOR);
        expect(v.inHours).toBe(true);
        expect(v.action).toBeNull();
        expect(v.localTime).toBe('13:30');
        expect(v.localDay).toBe(3); // Wednesday
    });

    it('blocks outside the window and reports the local wall time', () => {
        const s: BusinessHoursSchedule = {
            timezone: 'Europe/London',
            days: [1, 2, 3, 4, 5],
            from: '17:31', to: '23:00',
            outsideAction: 'block',
        };
        const v = checkSchedule(s, ANCHOR);
        expect(v.inHours).toBe(false);
        expect(v.action).toBe('block');
        expect(v.message).toContain('closed');
        expect(v.localTime).toBe('13:30');
    });

    it('soft-blocks when outsideAction=soft', () => {
        const s: BusinessHoursSchedule = {
            timezone: 'Europe/London',
            days: [1, 2, 3, 4, 5],
            from: '20:00', to: '22:00',
            outsideAction: 'soft',
        };
        const v = checkSchedule(s, ANCHOR);
        expect(v.inHours).toBe(false);
        expect(v.action).toBe('soft');
    });

    it('treats outsideAction=allow as effectively no schedule', () => {
        const s: BusinessHoursSchedule = {
            timezone: 'Europe/London',
            days: [1], // Monday only
            outsideAction: 'allow',
        };
        const v = checkSchedule(s, ANCHOR);
        expect(v.inHours).toBe(true);
        expect(v.action).toBeNull();
    });

    it('respects day-of-week filter (Wednesday not open Sun-only)', () => {
        const s: BusinessHoursSchedule = {
            timezone: 'Europe/London',
            days: [7], // Sunday only
            from: '10:00', to: '16:00',
            outsideAction: 'block',
        };
        const v = checkSchedule(s, ANCHOR);
        expect(v.inHours).toBe(false);
        expect(v.action).toBe('block');
    });

    it('handles overnight windows (22:00 -> 04:00)', () => {
        const s: BusinessHoursSchedule = {
            timezone: 'Europe/London',
            from: '22:00', to: '04:00',
            outsideAction: 'block',
        };
        // 13:30 local is outside the 22:00-04:00 window
        expect(checkSchedule(s, ANCHOR).inHours).toBe(false);
        // 23:00 UTC = 00:00 local — inside the overnight window
        expect(checkSchedule(s, new Date('2026-07-08T23:00:00Z')).inHours).toBe(true);
        // 03:00 UTC = 04:00 local — inside (04:00 is exclusive)
        expect(checkSchedule(s, new Date('2026-07-08T02:59:00Z')).inHours).toBe(true);
    });

    it('honours a custom outsideMessage', () => {
        const s: BusinessHoursSchedule = {
            timezone: 'Europe/London',
            days: [7], // out of hours mid-week
            outsideAction: 'block',
            outsideMessage: 'Weekend orders only',
        };
        expect(checkSchedule(s, ANCHOR).message).toBe('Weekend orders only');
    });

    it('fails open on a bad timezone string (never block a real visitor over config)', () => {
        const s: BusinessHoursSchedule = {
            timezone: 'Not/A/Timezone',
            days: [7],
            outsideAction: 'block',
        };
        expect(checkSchedule(s, ANCHOR).inHours).toBe(true);
    });

    it('fails open on a bad time string', () => {
        const s: BusinessHoursSchedule = {
            timezone: 'UTC',
            from: 'nine', to: 'five', // garbage
            outsideAction: 'block',
        };
        expect(checkSchedule(s, ANCHOR).inHours).toBe(true);
    });

    it('resolves an ambiguous DST spring-forward correctly (UK spring 2026-03-29 01:15 UTC = 02:15 BST)', () => {
        const s: BusinessHoursSchedule = {
            timezone: 'Europe/London',
            from: '02:00', to: '03:00',
            outsideAction: 'block',
        };
        // At 01:15 UTC on the DST switch morning it's 02:15 in London.
        const v = checkSchedule(s, new Date('2026-03-29T01:15:00Z'));
        expect(v.inHours).toBe(true);
        expect(v.localTime).toBe('02:15');
    });
});
