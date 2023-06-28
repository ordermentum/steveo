import { expect } from 'chai';
import { Steveo } from 'steveo';
import NewrelicMiddleware from '../src';

describe('NewrelicMiddleware', () => {
  it('add to steveo', () => {
    const middleware = new NewrelicMiddleware();
    const steveo = new Steveo({
      engine: 'dummy',
      middleware: [middleware],
    });

    expect(steveo.middleware.length).to.equal(1);
  });
});
