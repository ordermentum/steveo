import { expect } from 'chai';
import { Steveo } from 'steveo';
import { StatsD } from 'hot-shots';
import buildClient from '../src';

describe('statsd', () => {
  it('should build client', () => {
    const steveo = new Steveo({
      engine: 'dummy',
    });
    const statsd = new StatsD();
    buildClient(steveo, statsd);
    expect(1).to.exist;
  });
});
