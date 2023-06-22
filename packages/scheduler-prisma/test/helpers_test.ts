import moment from 'moment-timezone';
import { expect } from 'chai';
import { computeNextRunAt } from '../src/helpers';

describe('helpers', () => {
  describe('compute next run at', () => {
    it('Calculates the next date correctly', () => {
      const every3Hours = 'FREQ=HOURLY;INTERVAL=4;BYMINUTE=0';
      const nextDate = computeNextRunAt(every3Hours);
      expect(nextDate.diff(moment().tz('utc').minute(0), 'hours')).to.equal(3);
    });

    it('Adds defaults if byhour is passed', () => {
      const atFour = 'FREQ=DAILY;BYHOUR=4';
      const nextDate = computeNextRunAt(atFour);
      expect(nextDate.hours()).to.equal(4);
      expect(nextDate.minutes()).to.equal(0);
      expect(nextDate.seconds()).to.equal(0);
    });
  });
});
