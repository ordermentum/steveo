import { expect } from 'chai';
import { Steveo } from 'steveo';

import sinon from 'sinon';
import KMSMiddleware from '../src';

describe('KMSMiddleware', () => {
  let sandbox;
  let middleware;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('add to steveo', () => {
    middleware = new KMSMiddleware('keyId');

    const steveo = new Steveo({
      engine: 'dummy',
      middleware: [middleware],
    });

    expect(steveo.middleware.length).to.equal(1);
  });

  describe('publish', () => {
    it('should encrypt message', async () => {
      sandbox.stub(middleware, 'encrypt').resolves('encrypted');
      const context = { message: 'message' };
      const next = sinon.stub().resolves();
      await middleware.publish(context, next);
      expect(context.message).to.equal('encrypted');
    });
  });

  describe('consume', () => {
    it('should decrypt message', async () => {
      sandbox.stub(middleware, 'decrypt').resolves({ message: 'message' });
      const context = { message: 'data' };
      const next = sinon.stub().resolves();
      await middleware.consume(context, next);
      expect(context.message).to.deep.equal({ message: 'message' });
    });
  });
});
