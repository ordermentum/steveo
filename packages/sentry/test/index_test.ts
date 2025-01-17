import { expect } from 'chai';
import { Steveo } from 'steveo';
import buildClient from '../src';

describe('sentry', () => {
  it('should build client', () => {
    //@ts-expect-error
    const steveo = new Steveo({
      engine: 'sqs',
    });
    buildClient(steveo);
    expect(1).to.exist;
  });
});
