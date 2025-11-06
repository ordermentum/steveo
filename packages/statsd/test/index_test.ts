import { expect } from 'chai';
import { Steveo } from 'steveo';
import buildClient from '../src';

describe('statsd', () => {
  it('should build client', () => {
    const steveo = new Steveo({
      engine: 'dummy',
    });
    const statsd = {
      increment: () => { },
      timing: () => { },
      gauge: () => { },
    };
    buildClient(steveo, statsd);
    expect(1).to.exist;
  });
});
