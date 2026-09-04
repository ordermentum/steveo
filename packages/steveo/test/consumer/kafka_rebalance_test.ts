import { expect } from 'chai';
import sinon from 'sinon';
import Kafka from '@confluentinc/kafka-javascript';
import Runner from '../../src/consumers/kafka';
import { build } from '../../src/lib/pool';

const { ERR__REVOKE_PARTITIONS, ERR__ASSIGN_PARTITIONS } = Kafka.CODES.ERRORS;

const TOPIC = 'test-topic';

const buildRunner = (sandbox: sinon.SinonSandbox, protocol = 'EAGER') => {
  const registry = {
    getTask: () => ({ publish: () => {}, subscribe: sinon.stub().resolves() }),
    emit: sandbox.stub(),
    events: { emit: sandbox.stub() },
  };
  const steveo = {
    config: {
      bootstrapServers: 'kafka:9200',
      engine: 'kafka',
      securityProtocol: 'plaintext',
      batchProcessing: { enabled: true, batchSize: 10 },
    },
    registry,
    // @ts-expect-error
    pool: build(registry),
  };
  // @ts-expect-error
  const runner: any = new Runner(steveo);
  sandbox.stub(runner.consumer, 'rebalanceProtocol').returns(protocol);
  sandbox.stub(runner.consumer, 'commitMessage');
  return runner;
};

const message = (partition: number, offset: number) => ({
  value: Buffer.from(JSON.stringify({ partition, offset })),
  topic: TOPIC,
  partition,
  offset,
});

// driving globalConfig runs the client's own rebalance handling, so these
// assertions cover our listener and the client's assign/unassign together
const rebalance = (runner, code: number, assignment: unknown[] = []) =>
  runner.consumer.globalConfig.rebalance_cb(code, assignment);

describe('runner/kafka - rebalance', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('eager protocol', () => {
    it('lets the client assign the partitions it was given', () => {
      const runner = buildRunner(sandbox);
      const assign = sandbox.stub(runner.consumer, 'assign');

      rebalance(runner, ERR__ASSIGN_PARTITIONS, [
        { topic: TOPIC, partition: 0 },
      ]);

      expect(assign.calledOnce, 'client did not assign').to.equal(true);
      expect(assign.firstCall.args[0]).to.eqls([
        { topic: TOPIC, partition: 0 },
      ]);
    });

    it('does not commit when partitions are assigned', () => {
      const runner = buildRunner(sandbox);
      const commitSync = sandbox.stub(runner.consumer, 'commitSync');
      sandbox.stub(runner.consumer, 'assign');

      rebalance(runner, ERR__ASSIGN_PARTITIONS, [
        { topic: TOPIC, partition: 0 },
      ]);

      expect(commitSync.called, 'assign must not commit').to.equal(false);
    });
  });

  describe('revoke', () => {
    it('flushes the offsets it processed before the client releases the partitions', async () => {
      const runner = buildRunner(sandbox);
      const commitSync = sandbox.stub(runner.consumer, 'commitSync');
      const unassign = sandbox.stub(runner.consumer, 'unassign');

      await runner.processBatch([
        message(0, 100),
        message(1, 200),
        message(0, 101),
      ]);

      rebalance(runner, ERR__REVOKE_PARTITIONS);

      expect(commitSync.calledOnce, 'commitSync was never called').to.equal(
        true
      );
      expect(commitSync.firstCall.args[0]).to.eqls([
        { topic: TOPIC, partition: 0, offset: 102 },
        { topic: TOPIC, partition: 1, offset: 201 },
      ]);
      expect(
        commitSync.calledBefore(unassign),
        'offsets must be flushed before the partitions are released'
      ).to.equal(true);
    });

    it('does not commit anything it has not processed', () => {
      const runner = buildRunner(sandbox);
      const commitSync = sandbox.stub(runner.consumer, 'commitSync');
      const unassign = sandbox.stub(runner.consumer, 'unassign');

      rebalance(runner, ERR__REVOKE_PARTITIONS);

      expect(
        commitSync.called,
        'nothing was processed, so there is nothing to flush'
      ).to.equal(false);
      expect(unassign.called, 'client did not unassign').to.equal(true);
    });

    it('releases the partitions even when the flush fails', async () => {
      const runner = buildRunner(sandbox);
      sandbox
        .stub(runner.consumer, 'commitSync')
        .throws(new Error('Broker: Unknown member'));
      const unassign = sandbox.stub(runner.consumer, 'unassign');

      await runner.processBatch([message(0, 100)]);
      rebalance(runner, ERR__REVOKE_PARTITIONS);

      expect(unassign.called, 'unassign was skipped').to.equal(true);
    });
  });

  describe('cooperative protocol', () => {
    it('adds only the newly granted partitions', () => {
      const runner = buildRunner(sandbox, 'COOPERATIVE');
      const incrementalAssign = sandbox.stub(
        runner.consumer,
        'incrementalAssign'
      );
      const assign = sandbox.stub(runner.consumer, 'assign');

      rebalance(runner, ERR__ASSIGN_PARTITIONS, [
        { topic: TOPIC, partition: 0 },
      ]);

      expect(
        incrementalAssign.calledOnce,
        'cooperative assign must be incremental'
      ).to.equal(true);
      expect(
        assign.called,
        'a full assign drops partitions the member still owns'
      ).to.equal(false);
    });

    it('releases only the revoked partitions, after flushing', async () => {
      const runner = buildRunner(sandbox, 'COOPERATIVE');
      const commitSync = sandbox.stub(runner.consumer, 'commitSync');
      const incrementalUnassign = sandbox.stub(
        runner.consumer,
        'incrementalUnassign'
      );
      const unassign = sandbox.stub(runner.consumer, 'unassign');

      await runner.processBatch([message(0, 100)]);
      rebalance(runner, ERR__REVOKE_PARTITIONS, [
        { topic: TOPIC, partition: 0 },
      ]);

      expect(
        incrementalUnassign.calledOnce,
        'cooperative revoke must be incremental'
      ).to.equal(true);
      expect(
        unassign.called,
        'a full unassign drops partitions that were not revoked'
      ).to.equal(false);
      expect(
        commitSync.calledBefore(incrementalUnassign),
        'offsets must be flushed before the partitions are released'
      ).to.equal(true);
    });
  });

  it('keeps the consumer alive when the rebalance itself fails', () => {
    const runner = buildRunner(sandbox);
    sandbox.stub(runner.consumer, 'assign').throws(new Error('assign failed'));
    sandbox.stub(runner.consumer, 'isConnected').returns(true);
    const shutdown = sandbox.stub(runner, 'shutdown');

    rebalance(runner, ERR__ASSIGN_PARTITIONS, [{ topic: TOPIC, partition: 0 }]);

    expect(
      shutdown.called,
      'a failed rebalance must not tear the consumer down'
    ).to.equal(false);
  });
});
