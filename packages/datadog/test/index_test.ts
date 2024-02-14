import { expect } from 'chai';
import { Steveo } from 'steveo';
import DataDogMiddleware from '../src';

describe('DataDogMiddleware', () => {
  it('add to steveo', () => {
    const middleware = new DataDogMiddleware();
    const steveo = new Steveo({
      engine: 'dummy',
      middleware: [middleware],
    });

    expect(steveo.middleware.length).to.equal(1);
  });
});
