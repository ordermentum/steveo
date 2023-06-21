import { expect } from 'chai';
import sinon from 'sinon';

import Runner from '../../src/consumers/base';
import Registry from '../../src/registry';
import { Steveo } from '../../src';

describe('Base', () => {
  let sandbox;
  let runner: Runner;
  let registry;
  beforeEach(() => {
    registry = new Registry();
    registry.addNewTask({
      name: 'test-topic',
      topic: 'test-topic',
    });

    const steveo = new Steveo({ engine: 'dummy' as const });
    // @ts-ignore
    steveo.registry = registry;
    runner = new Runner(steveo);
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('should create an instance', () => {
    expect(typeof runner).to.equal('object');
  });

  describe('getActiveSubscriptions', () => {
    it('returns empty', () => {
      // @ts-ignore
      runner.steveo.registry = undefined;
      const active = runner.getActiveSubsciptions(['test']);
      expect(active).to.deep.equal([]);
      // @ts-ignore
      runner.steveo.registry = registry;
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
});
