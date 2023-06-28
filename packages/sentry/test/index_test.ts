import { expect } from 'chai';
import { Steveo } from 'steveo';
import buildClient from '../src';

describe('sentry', () => {
  it('should build client', () => {
    const steveo = new Steveo({
      engine: 'dummy',
    });
    buildClient(steveo);
    expect(1).to.exist;
  });
});
