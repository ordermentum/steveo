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

  it('should terminate', async () => {
    runner.state = 'running';
    setTimeout(() => {
      runner.state = 'terminated';
    }, 1000);
    await runner.terminate();
  });
});
