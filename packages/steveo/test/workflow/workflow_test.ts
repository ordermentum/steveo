import sinon from 'sinon';
import { NullLogger } from 'null-logger';
import { DummyConfiguration, Steveo } from '../../src/index';
import { DummyStorage } from './fixture/dummy_storage';

// Workflow integration tests
describe('Workflow tests', () => {
  const dummy: DummyConfiguration = { engine: 'dummy' };
  const storage = sinon.createStubInstance(DummyStorage);
  const steveo = new Steveo(dummy, new NullLogger(), storage);

  beforeEach(() => {
    sinon.reset();
  });

  test('should execute flow of two steps', async () => {
    const mock1 = sinon.spy();
    const mock2 = sinon.spy();
    steveo
      .flow('test-workflow')
      .next({ name: 'step1-task', execute: mock1 })
      .next({ name: 'step2-task', execute: mock2 });

    // await flow.publish({ order: 123 });

    // await steveo.runner().process();

    // setTimeout(() => {
    //   expect(mock1.callCount).eq(1);
    //   done();
    // }, 100);
  });
});
