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
    if(clock) clock.restore();
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
    ([
      ['FREQ=HOURLY;INTERVAL=1', 'UTC', (m: Moment) => moment().tz('utc').diff(m, 'minutes') === -59],
      ['FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;BYHOUR=16;BYMINUTE=40', 'Australia/Sydney', (m: Moment) => m.day() === 1 && m.hour() === 16 && m.minute() === 40 && ['+1100', '+1000'].some(x => x === m.format('ZZ'))],
      ['FREQ=WEEKLY;INTERVAL=1;BYDAY=WE;BYHOUR=17;BYMINUTE=40;BYSECOND=0', 'Australia/Sydney', (m: Moment) => m.day() === 3 && m.hour() === 17 && m.minute() === 40 && m.second() === 0  && ['+1100', '+1000'].some(x => x === m.format('ZZ'))],
    ] as [string, string, (m: Moment) => boolean][]).forEach( ([rule, timezone, comparator]) => {
      it(`Calculates the next date for rule ${rule} correctly`, () => {
        expect(comparator(moment(computeNextRunAt(rule, timezone)))).to.be.true;
      });
    });

    it('Can handle fortnightly rrule with a set day', () => {
      // set the current date to a thursday
      // At AEDT this will be 2024-01-25T03:00:00+11:00
      clock = sinon.useFakeTimers(new Date('2024-01-24T16:00:00Z').getTime());
      const rule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=WE;BYHOUR=12;BYMINUTE=0;BYSECOND=0';
      const nextDate = moment(computeNextRunAt(rule, 'Australia/Sydney'));
      expect([nextDate.date(), nextDate.month(), nextDate.year()]).to.eqls([7, 1, 2024]); 
    });

    it('Can handle DST switchover with a rrule', () => {
      // set the current date to 6th April 2024
      // At AEDT this will be 2024-04-06T03:00:00+11:00
      clock = sinon.useFakeTimers(new Date('2024-04-05T16:00:00Z').getTime());
      const rule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=WE;BYHOUR=12;BYMINUTE=0;BYSECOND=0';
      const nextDate = computeNextRunAt(rule, 'Australia/Sydney');
      expect(nextDate).to.eqls('2024-04-17T02:00:00.000Z');
      const parsed = moment(nextDate);
      expect([parsed.date(), parsed.month(), parsed.year(), parsed.hours(), parsed.minutes(), parsed.format('ZZ')]).to.eqls([17, 3, 2024, 12, 0, '+1000']);
    });

    it('Can handle fortnightly rrule with a dtstart', () => {
      const rule = 'DTSTART;TZID=Australia/Sydney:20230126T030000\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE;BYHOUR=12;BYMINUTE=0;BYSECOND=0';
      // set the current date to a thursday
      // At AEDT this will be 2024-01-25T03:00:00+11:00
      clock = sinon.useFakeTimers(new Date('2023-01-25T16:00:00Z').getTime());
      let nextDate = moment(computeNextRunAt(rule, 'Australia/Sydney'));
      expect([nextDate.date(), nextDate.month(), nextDate.year()]).to.eqls([8, 1, 2023]); 
      clock.restore();
      // After 16/02/2023, starting from 26/01/2023, the next run should be 22/02/2023
      clock = sinon.useFakeTimers(new Date('2023-02-16T16:00:00Z').getTime());
      nextDate = moment(computeNextRunAt(rule, 'Australia/Sydney'));
      expect([nextDate.date(), nextDate.month(), nextDate.year()]).to.eqls([22, 1, 2023]); 
    });

    it('Can handle DST switchover with a rrule with DTSTART', () => {
      // set the current date to 6th April 2024
      // At AEDT this will be 2024-04-06T03:00:00+11:00
      clock = sinon.useFakeTimers(new Date('2024-04-05T16:00:00Z').getTime());
      const rule = 'DTSTART;TZID=Australia/Sydney:20240406T030000\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE;BYHOUR=12;BYMINUTE=0;BYSECOND=0';
      const nextDate = computeNextRunAt(rule, 'Australia/Sydney');
      expect(nextDate).to.eqls('2024-04-17T02:00:00.000Z');
      const parsed = moment(nextDate);
      expect([parsed.date(), parsed.month(), parsed.year(), parsed.hours(), parsed.minutes(), parsed.format('ZZ')]).to.eqls([17, 3, 2024, 12, 0, '+1000']);
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
