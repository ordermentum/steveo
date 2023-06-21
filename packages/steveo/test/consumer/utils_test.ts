import { expect } from 'chai';
import { safeParseInt } from '../../src/lib/utils';

describe('utils', () => {
  describe('safeParseInt', () => {
    it('returns if can', () => {
      const result = safeParseInt('1');
      expect(result).to.equal(1);
    });
    it('returns if cannot parse', () => {
      const result = safeParseInt('x', 5);
      expect(result).to.equal(5);
    });
  });
});
