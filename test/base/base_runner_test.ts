import { expect } from 'chai';
import sinon from 'sinon';
import BaseRunner from '../../src/base/base_runner';

describe('base_runner', function () { // eslint-disable-line
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  describe('checks', () => {
    it('resolves when there are no hooks', async () => {
      const b = new BaseRunner();
      await b.checks();
    });

    it('terminates if the terminationCheck resolves with true', async () => {
      const stub = sandbox.stub(process, 'exit');
      const b = new BaseRunner({
        terminationCheck: () => Promise.resolve(true),
      });
      await b.checks();
      expect(stub.calledOnce).to.equal(true);
    });

    it('calls the onFail callback if healthCheck fails for the <5 time', async () => {
      const onFail = sinon.spy();

      const b = new BaseRunner({
        healthCheck: () => Promise.reject(),
      });

      await b.checks(onFail);
      expect(onFail.calledOnce).to.equal(true);
    });

    it('terminates if healthCheck fails >=5 times', async () => {
      const onFail = sinon.spy();
      const stub = sandbox.stub(process, 'exit');

      const b = new BaseRunner({
        healthCheck: () => Promise.reject(),
      });

      await b.checks(onFail);
      await b.checks(onFail);
      await b.checks(onFail);
      await b.checks(onFail);
      await b.checks(onFail);
      await b.checks(onFail);

      expect(onFail.getCalls().length === 5).to.equal(true);
      expect(stub.calledOnce).to.equal(true);
    });
  });
});
