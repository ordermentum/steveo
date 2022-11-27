import { expect } from 'chai';
import sinon from 'sinon';

import Runner from '../../src/runner/base';
import Registry from '../../src/registry';

describe('Base', () => {
  let sandbox;
  let runner;
  let registry;
  beforeEach(() => {
    registry = new Registry();
    registry.addNewTask({
      name: 'test-topic',
      topic: 'test-topic',
    });

    const steveo = {
      // @ts-ignore
      config: {
        bootstrapServers: 'kafka:9200',
        engine: 'kafka',
        securityProtocol: 'plaintext',
      },
      registry,
    };
    // @ts-ignore
    runner = new Runner(steveo);
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
  });

  it('should pause', async () => {
    runner.state = 'running';
    await runner.pause();
    expect(runner.state).to.equal('paused');
  });

  it('should resume', async () => {
    runner.state = 'paused';
    await runner.resume();
    expect(runner.state).to.equal('running');
  });

  describe('getActiveSubscriptions', () => {
    it('returns empty', () => {
      runner.registry = null;
      const active = runner.getActiveSubsciptions(['test']);
      expect(active).to.deep.equal([]);
      runner.registry = registry;
    });

    it('returns non-filtered', () => {
      const active = runner.getActiveSubsciptions();
      expect(active).to.deep.equal(['test-topic']);
    });

    it('returns missing', () => {
      const active = runner.getActiveSubsciptions(['unknown']);
      expect(active).to.deep.equal([]);
    });

    it('returns filtered', () => {
      registry.addNewTask({
        name: 'test',
        topic: 'test',
      });
      registry.addNewTask({
        name: 'another',
        topic: 'another',
      });
      const active = runner.getActiveSubsciptions(['test']);
      expect(active).to.deep.equal(['test']);
    });
  });

  it('should terminate', async () => {
    runner.state = 'running';
    setTimeout(() => {
      runner.state = 'terminated';
    }, 1000);
    await runner.terminate();
  });
});
