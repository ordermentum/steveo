import { expect } from 'chai';
import { waitForChange, waitTime } from '../../src/utils/wait';

describe('waitx functionality', () => {
  describe('waitTime', () => {
    it('should wait for a specified amount of time', async () => {
      const startTime = Date.now();
      await waitTime(1000);
      const endTime = Date.now();

      expect(endTime - startTime).gte(1000);
    });
  });

  describe('waitForChange', () => {
    it('should wait for a condition to change', async () => {
      const test = true;

      await waitForChange(() => test);

      expect(test).eq(true);
    });

    it('should timeout without throwing an error', async () => {
      const test = false;

      await waitForChange(() => test, 100);

      expect(test).eq(false);
    });
  });
});
