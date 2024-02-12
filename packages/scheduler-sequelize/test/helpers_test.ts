import moment, { Moment } from 'moment-timezone';
import { expect } from 'chai';
import sinon, { SinonSandbox, SinonFakeTimers } from 'sinon';
import { computeNextRunAt, isHealthy } from '../src/helpers';

describe('helpers', () => {
  let sandbox: SinonSandbox;
  let clock: SinonFakeTimers;

  beforeEach(() => {
    process.env.TZ = 'Australia/Sydney';
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    process.env.TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (clock) clock.restore();
    sandbox.restore();
  });

  describe('compute next run at', () => {
    it('Calculates the next date correctly', () => {
      const every3Hours = 'FREQ=HOURLY;INTERVAL=4;BYMINUTE=0';
      const nextDate = moment(computeNextRunAt(every3Hours));
      expect(nextDate.diff(moment().tz('utc').minute(0), 'hours')).to.equal(3);
    });

    // List of recurrence rules to test
    // comparator that returns boolean
    (
      [
        [
          'FREQ=MINUTELY;INTERVAL=5;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            const diff = m.diff(now, 'minutes');
            return diff === 5;
          },
        ],
        [
          'FREQ=HOURLY;INTERVAL=1;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            const diff = m.diff(now, 'hour');
            return diff === 1;
          },
        ],
        [
          'FREQ=HOURLY;INTERVAL=2;BYMINUTE=0;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            return m.hour() === now.add(2, 'hour').hour() && m.minute() === 0;
          },
        ],
        [
          'FREQ=DAILY;INTERVAL=1;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            const diff = m.diff(now, 'day');
            return diff === 1;
          },
        ],
        [
          'FREQ=DAILY;INTERVAL=2;BYHOUR=0;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            return m.date() === now.add(2, 'day').date() && m.hour() === 0;
          },
        ],
        [
          'FREQ=DAILY;INTERVAL=1;BYHOUR=0;BYMINUTE=15;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            return (
              m.date() === now.date() && m.hour() === 0 && m.minute() === 15
            );
          },
        ],
        [
          'FREQ=WEEKLY;INTERVAL=1;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            const diff = m.diff(now, 'days');
            return diff === 7;
          },
        ],
        [
          'FREQ=WEEKLY;INTERVAL=2;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            const diff = m.diff(now, 'days');
            return diff === 14;
          },
        ],
        [
          'FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            return m.day() === 5;
          },
        ],
        [
          'FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;BYHOUR=0;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            return m.day() === 5 && m.hour() === 0;
          },
        ],
        [
          'FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;BYHOUR=0;BYMINUTE=15;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            return m.day() === 5 && m.hour() === 0 && m.minute() === 15;
          },
        ],
        [
          'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;BYHOUR=16;BYMINUTE=40',
          'Australia/Sydney',
          '2021-01-01',
          (m: Moment) =>
            m.day() === 1 &&
            m.hour() === 16 &&
            m.minute() === 40 &&
            ['+1100', '+1000'].some(x => x === m.format('ZZ')),
        ],
        [
          'FREQ=WEEKLY;INTERVAL=1;BYDAY=WE;BYHOUR=17;BYMINUTE=40;BYSECOND=0',
          'Australia/Sydney',
          '2021-01-01',
          (m: Moment) =>
            m.day() === 3 &&
            m.hour() === 17 &&
            m.minute() === 40 &&
            m.second() === 0 &&
            ['+1100', '+1000'].some(x => x === m.format('ZZ')),
        ],
        [
          'FREQ=MONTHLY;INTERVAL=1;TZID=Australia/Sydney',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, timezone: string) => {
            const now = moment().tz(timezone);
            const diff = m.diff(now, 'months');
            return diff === 1;
          },
        ],
        // Start: January 06, 2024 Saturday
        // Expected: January 12, 2024 Friday
        [
          'DTSTART;TZID=Australia/Sydney:20240106T030000\nRRULE:FREQ=MONTHLY;INTERVAL=2;BYDAY=FR',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, _: string) =>
            m.year() === 2024 &&
            m.month() === 0 &&
            m.date() === 12 &&
            m.day() === 5,
        ],
        [
          'DTSTART;TZID=Australia/Sydney:20240106T030000\nRRULE:FREQ=MONTHLY;INTERVAL=2;BYDAY=FR;BYHOUR=0',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, _: string) =>
            m.year() === 2024 &&
            m.month() === 0 &&
            m.date() === 12 &&
            m.day() === 5 &&
            m.hour() === 0,
        ],
        [
          'DTSTART;TZID=Australia/Sydney:20240106T030000\nRRULE:FREQ=MONTHLY;INTERVAL=2;BYDAY=FR;BYHOUR=0;BYMINUTE=15',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, _: string) =>
            m.year() === 2024 &&
            m.month() === 0 &&
            m.date() === 12 &&
            m.day() === 5 &&
            m.hour() === 0 &&
            m.minute() === 15,
        ],
        // End of February - Leap year
        // Start: February 01, 2024 Saturday
        // Expected: Feb 29, 2024 Friday
        // Note: in lunartick, this scenario returns March 31, 2024
        [
          'DTSTART;TZID=Australia/Sydney:20240201T030000\nRRULE:FREQ=MONTHLY;BYMONTHDAY=-1',
          'Australia/Sydney',
          '2024-02-01',
          (m: Moment, _: string) =>
            m.year() === 2024 &&
            m.month() === 1 &&
            m.date() === 29 &&
            m.day() === 4,
        ],
        // End of February - Non-Leap year
        // Start: February 01, 2023 Saturday
        // Expected: Feb 28, 2023 Friday
        // Note: in lunartick, this scenario returns March 31, 2024
        [
          'DTSTART;TZID=Australia/Sydney:20230201T030000\nRRULE:FREQ=MONTHLY;BYMONTHDAY=-1',
          'Australia/Sydney',
          '2023-02-01',
          (m: Moment, _: string) =>
            m.year() === 2023 &&
            m.month() === 1 &&
            m.date() === 28 &&
            m.day() === 2,
        ],
        [
          'DTSTART;TZID=Australia/Sydney:20230201T030000\nRRULE:FREQ=MONTHLY;BYMONTHDAY=-1;BYHOUR=11;BYMINUTE=55;BYSECOND=0',
          'Australia/Sydney',
          '2024-02-01',
          (m: Moment, _: string) =>
            m.year() === 2024 &&
            m.month() === 1 &&
            m.date() === 29 &&
            m.day() === 4 &&
            m.hour() === 11 &&
            m.minute() === 55 &&
            m.second() === 0,
        ],
        [
          'DTSTART;TZID=Australia/Sydney:20240101T030000\nRRULE:FREQ=YEARLY;INTERVAL=1',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, _: string) =>
            m.year() === 2024 &&
            m.month() === 0 &&
            m.date() === 1 &&
            m.day() === 1,
        ],
        [
          'DTSTART;TZID=Australia/Sydney:20240101T030000\nRRULE:FREQ=YEARLY;BYMONTH=3',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, _: string) =>
            m.year() === 2024 &&
            m.month() === 2 &&
            m.date() === 1 &&
            m.day() === 5,
        ],
        [
          'DTSTART;TZID=Australia/Sydney:20240101T030000\nRRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=-1',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, _: string) =>
            m.year() === 2024 &&
            m.month() === 2 &&
            m.date() === 31 &&
            m.day() === 0,
        ],
        [
          'DTSTART;TZID=Australia/Sydney:20240101T030000\nRRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=-1;BYHOUR=11',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, _: string) =>
            m.year() === 2024 &&
            m.month() === 2 &&
            m.date() === 31 &&
            m.day() === 0 &&
            m.hour() === 11,
        ],
        [
          'DTSTART;TZID=Australia/Sydney:20240101T030000\nRRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=-1;BYHOUR=11;BYMINUTE=55',
          'Australia/Sydney',
          '2024-01-01',
          (m: Moment, _: string) =>
            m.year() === 2024 &&
            m.month() === 2 &&
            m.date() === 31 &&
            m.day() === 0 &&
            m.hour() === 11 &&
            m.minute() === 55,
        ],
      ] as [string, string, string, (m: Moment, timezone: string) => boolean][]
    ).forEach(([rule, timezone, startDate, comparator]) => {
      it(`Calculates the next date for rule ${rule} correctly`, () => {
        // Set the clock to specific date
        const date = new Date(startDate);
        date.setHours(0, 0, 0, 0);
        date.toLocaleString('en-US', { timeZone: timezone });
        clock = sinon.useFakeTimers(new Date(date).getTime());

        expect(comparator(moment(computeNextRunAt(rule, timezone)), timezone))
          .to.be.true;
      });
    });

    it('Can handle fortnightly rrule with a set day', () => {
      // set the current date to a thursday
      // At AEDT this will be 2024-01-25T03:00:00+11:00
      clock = sinon.useFakeTimers(new Date('2024-01-24T16:00:00Z').getTime());
      const rule =
        'FREQ=WEEKLY;INTERVAL=2;BYDAY=WE;BYHOUR=12;BYMINUTE=0;BYSECOND=0';
      const nextDate = moment(computeNextRunAt(rule, 'Australia/Sydney'));
      expect([nextDate.date(), nextDate.month(), nextDate.year()]).to.eqls([
        7, 1, 2024,
      ]);
    });

    it('Can handle DST switchover with a rrule', () => {
      // set the current date to 6th April 2024
      // At AEDT this will be 2024-04-06T03:00:00+11:00
      clock = sinon.useFakeTimers(new Date('2024-04-05T16:00:00Z').getTime());
      const rule =
        'FREQ=WEEKLY;INTERVAL=2;BYDAY=WE;BYHOUR=12;BYMINUTE=0;BYSECOND=0';
      const nextDate = computeNextRunAt(rule, 'Australia/Sydney');
      expect(nextDate).to.eqls('2024-04-17T02:00:00.000Z');
      const parsed = moment(nextDate);
      expect([
        parsed.date(),
        parsed.month(),
        parsed.year(),
        parsed.hours(),
        parsed.minutes(),
        parsed.format('ZZ'),
      ]).to.eqls([17, 3, 2024, 12, 0, '+1000']);
    });

    it('Can handle fortnightly rrule with a dtstart', () => {
      const rule =
        'DTSTART;TZID=Australia/Sydney:20230126T030000\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE;BYHOUR=12;BYMINUTE=0;BYSECOND=0';
      // set the current date to a thursday
      // At AEDT this will be 2024-01-25T03:00:00+11:00
      clock = sinon.useFakeTimers(new Date('2023-01-25T16:00:00Z').getTime());
      let nextDate = moment(computeNextRunAt(rule, 'Australia/Sydney'));
      expect([nextDate.date(), nextDate.month(), nextDate.year()]).to.eqls([
        8, 1, 2023,
      ]);
      clock.restore();
      // After 16/02/2023, starting from 26/01/2023, the next run should be 22/02/2023
      clock = sinon.useFakeTimers(new Date('2023-02-16T16:00:00Z').getTime());
      nextDate = moment(computeNextRunAt(rule, 'Australia/Sydney'));
      expect([nextDate.date(), nextDate.month(), nextDate.year()]).to.eqls([
        22, 1, 2023,
      ]);
    });

    it('Can handle DST switchover with a rrule with DTSTART', () => {
      // set the current date to 6th April 2024
      // At AEDT this will be 2024-04-06T03:00:00+11:00
      clock = sinon.useFakeTimers(new Date('2024-04-05T16:00:00Z').getTime());
      const rule =
        'DTSTART;TZID=Australia/Sydney:20240406T030000\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE;BYHOUR=12;BYMINUTE=0;BYSECOND=0';
      const nextDate = computeNextRunAt(rule, 'Australia/Sydney');
      expect(nextDate).to.eqls('2024-04-17T02:00:00.000Z');
      const parsed = moment(nextDate);
      expect([
        parsed.date(),
        parsed.month(),
        parsed.year(),
        parsed.hours(),
        parsed.minutes(),
        parsed.format('ZZ'),
      ]).to.eqls([17, 3, 2024, 12, 0, '+1000']);
    });
  });

  describe('healthy', () => {
    it('succeeds', () => {
      expect(isHealthy(new Date().getTime(), 50000)).to.be.true;
    });
    it('fails', () => {
      expect(isHealthy(moment().subtract(5, 'hours').unix(), 60 * 1000 * 5)).to
        .be.false;
    });
  });
});
