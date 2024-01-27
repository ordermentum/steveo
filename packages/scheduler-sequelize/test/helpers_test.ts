import moment, { Moment } from 'moment-timezone';
import { expect } from 'chai';
import sinon, { SinonSandbox } from 'sinon';
import { computeNextRunAt, isHealthy } from '../src/helpers';

describe('helpers', () => {
  let sandbox: SinonSandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
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
      ['FREQ=WEEKLY;BYDAY=TU;INTERVAL=2', 'Australia/Sydney', (m: Moment) => m.day() === 2 && m.diff(moment().tz('Australia/Sydney'), 'week') >= 1 ],
    ] as [string, string, (m: Moment) => boolean][]).forEach( ([rule, timezone, comparator]) => {
      it(`Calculates the next date for rule ${rule} correctly`, () => {
        expect(comparator(moment(computeNextRunAt(rule, timezone)))).to.be.true;
      });
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
