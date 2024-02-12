import moment, { Moment } from 'moment-timezone';
import { expect } from 'chai';
import sinon, { SinonSandbox, SinonFakeTimers } from 'sinon';
import Lunartick from '@ordermentum/lunartick';
import { computeNextRunAt, isHealthy } from '../src/helpers';

const getLunartickDate = (interval: string) => {
  const rule = Lunartick.parse(interval);
  const rrule = new Lunartick(rule);
  return rrule.getNext(new Date()).date.toISOString();
};

describe('Discrepancy', () => {
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

  describe('Matched rrule and lunartick generated dates', () => {
    describe('Monthly', () => {
      (
        [
          [
            'FREQ=MONTHLY;BYMONTHDAY=-1;TZID=Australia/Sydney',
            'Australia/Sydney',
            '2024-01-01',
            (rrule: Moment, lunartick: Moment) => {
              console.log('...rrule', rrule);
              console.log('...lunartick', lunartick);
              return rrule.year() === lunartick.year(); 
            },
          ],
        ] as [
          string,
          string,
          string,
          (m: Moment, lunartick: Moment) => boolean
        ][]
      ).forEach(([rule, timezone, startDate, comparator]) => {
        it(`Calculates the next date for rule ${rule} correctly`, () => {
          // Set the clock to specific date
          const date = new Date(startDate);
          date.setHours(0, 0, 0, 0);
          date.toLocaleString('en-US', { timeZone: timezone });
          clock = sinon.useFakeTimers(new Date(date).getTime());

          const rrule = computeNextRunAt(
            'DTSTART;TZID=Australia/Sydney:20240101T030000\nRRULE:FREQ=MONTHLY;BYMONTHDAY=-1',
            timezone
          );
          const lunartick = getLunartickDate(
            'DTSTART=20240101T030000Z;FREQ=MONTHLY;BYMONTHDAY=-1;TZID=Australia/Sydney'
          );

          expect(comparator(moment(rrule), moment(lunartick))).to.be.true;
        });
      });
    });
    // fornight rules
    // bymonth
  });

  // describe('Rrule and lunartick with DTSTART', () => {
  //   //timezone
  // });

  // describe('Rrule and lunartick with DST with DTSTART', () => {
  //
  // });

  // describe('Rrule and lunartick with leap year', () => {
  //
  // });
});
