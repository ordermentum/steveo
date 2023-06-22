import moment from 'moment-timezone';
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
