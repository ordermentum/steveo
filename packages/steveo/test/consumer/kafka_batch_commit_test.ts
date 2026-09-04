import { expect } from 'chai';
import sinon from 'sinon';
import { KafkaConsumer } from '@confluentinc/kafka-javascript';
import Runner from '../../src/consumers/kafka';
import { build } from '../../src/lib/pool';

// the runner's own type hides processBatch, which these tests drive directly
type TestRunner = {
  processBatch(messages: unknown[]): Promise<void>;
  consumer: KafkaConsumer;
};

const buildRunner = (sandbox, batchSize = 10) => {
  const subscribeStub = sinon.stub().resolves({ some: 'success' });
  const registry = {
    getTask: () => ({
      publish: sinon.stub(),
      subscribe: subscribeStub,
    }),
    emit: sandbox.stub(),
    events: { emit: sandbox.stub() },
  };
  const steveo = {
    config: {
      bootstrapServers: 'kafka:9200',
      engine: 'kafka',
      securityProtocol: 'plaintext',
      batchProcessing: { enabled: true, batchSize },
    },
    registry,
    // @ts-expect-error registry double only carries what the pool reads
    pool: build(registry),
  };
  // @ts-expect-error steveo double only carries what the runner reads
  const runner = new Runner(steveo) as unknown as TestRunner;
  return { runner, subscribeStub };
};

const message = (topic: string, partition: number, offset: number) => ({
  value: Buffer.from(JSON.stringify({ topic, partition, offset })),
  topic,
  partition,
  offset,
});

const committed = (commitStub: sinon.SinonStub) =>
  commitStub
    .getCalls()
    .map(call => call.args[0])
    .map(({ topic, partition, offset }) => `${topic}/${partition}/${offset}`)
    .sort();

describe('runner/kafka - batch commit coverage', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('commits the highest processed offset for every partition in the batch', async () => {
    const { runner, subscribeStub } = buildRunner(sandbox);
    const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

    await runner.processBatch([
      message('test-topic', 0, 100),
      message('test-topic', 1, 200),
      message('test-topic', 0, 101),
      message('test-topic', 1, 201),
    ]);

    expect(subscribeStub.callCount).to.equal(4);
    expect(committed(commitStub)).to.eqls([
      'test-topic/0/101',
      'test-topic/1/201',
    ]);
  });

  it('commits every topic when a batch spans multiple subscribed topics', async () => {
    const { runner } = buildRunner(sandbox);
    const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

    await runner.processBatch([
      message('topic-a', 0, 10),
      message('topic-b', 0, 20),
    ]);

    expect(committed(commitStub)).to.eqls(['topic-a/0/10', 'topic-b/0/20']);
  });

  it('commits the highest offset even when the batch arrives out of order', async () => {
    const { runner } = buildRunner(sandbox);
    const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

    await runner.processBatch([
      message('test-topic', 4, 702),
      message('test-topic', 4, 700),
      message('test-topic', 4, 701),
    ]);

    expect(committed(commitStub)).to.eqls(['test-topic/4/702']);
  });

  it('commits a single partition batch exactly once', async () => {
    const { runner } = buildRunner(sandbox);
    const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

    await runner.processBatch([
      message('test-topic', 3, 500),
      message('test-topic', 3, 501),
    ]);

    expect(committed(commitStub)).to.eqls(['test-topic/3/501']);
  });
});
