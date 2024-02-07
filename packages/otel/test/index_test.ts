// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from 'chai';
import { Steveo } from 'steveo';
import OpenTelemetryMiddleware from '../src';

describe('OpenTelemetryMiddleware', () => {
  it('adds to steveo', () => {
    const middleware = new OpenTelemetryMiddleware(console);
    const steveo = new Steveo({
      engine: 'dummy',
      middleware: [middleware],
    });

    expect(steveo.middleware.length).to.equal(1);
  });
});
