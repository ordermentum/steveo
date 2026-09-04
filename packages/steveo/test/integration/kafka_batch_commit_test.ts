import { expect } from 'chai';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import logger from 'pino';
import { KafkaConfiguration, Steveo } from '../../src';

const sleep = promisify(setTimeout);

const PARTITIONS = 3;
const PER_PARTITION = 2;

type Committed = { partition: number; offset?: number }[];

type TestRunner = {
  createQueues(): Promise<unknown>;
  state: string;
  consumer: unknown;
};

type TestProducer = {
  produce(
    topic: string,
    partition: number,
    value: Buffer,
    key: string | null,
    timestamp: number,
    callback: () => void
  ): void;
};

const committedOffsets = (consumer, topic: string): Promise<Committed> => {
  const toppars = Array.from({ length: PARTITIONS }, (_, partition) => ({
    topic,
    partition,
  }));

  return new Promise((resolve, reject) => {
    consumer.committed(toppars, 5000, (err, result) =>
      err ? reject(err) : resolve(result)
    );
  });
};

const waitFor = async (predicate: () => boolean, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;

  while (!predicate() && Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(100);
  }

  return predicate();
};

describe('Kafka Integration Test - batch commit coverage', () => {
  it('commits every partition the first batch drew from', async () => {
    const topic = `steveo_batch_commit_${randomUUID().replace(/-/g, '')}`;
    const total = PARTITIONS * PER_PARTITION;

    const configuration: KafkaConfiguration = {
      engine: 'kafka' as const,
      shuffleQueue: false,
      bootstrapServers: '0.0.0.0:9092',
      defaultTopicPartitions: PARTITIONS,
      defaultTopicReplicationFactor: 1,
      tasksPath: '.',
      securityProtocol: 'plaintext',
      upperCaseNames: false,
      middleware: [],
      batchProcessing: { enabled: true, batchSize: total },
      consumer: {
        global: { 'group.id': `steveo-batch-commit-${randomUUID()}` },
        topic: { 'auto.offset.reset': 'earliest' },
      },
      producer: { global: {}, topic: {} },
    };

    const steveo = new Steveo(configuration, logger({ level: 'warn' }));
    const runner = steveo.runner() as unknown as TestRunner;

    const handled: number[] = [];
    let firstBatch: number[] | undefined;

    steveo.task(topic, (payload: { partition: number }) => {
      handled.push(payload.partition);
      return Promise.resolve();
    });

    // freeze after the first batch so no later batch can cover for it
    steveo.events.on('batch_processed', () => {
      if (!firstBatch) {
        firstBatch = [...handled];
        runner.state = 'paused';
      }
    });

    await runner.createQueues();
    await steveo.producer.initialize();

    // explicit partitions, so the batch provably spans more than one of them
    const { producer } = steveo.producer as unknown as {
      producer: TestProducer;
    };
    let delivered = 0;
    const onDelivery = () => {
      delivered += 1;
    };

    for (let partition = 0; partition < PARTITIONS; partition++) {
      for (let i = 0; i < PER_PARTITION; i++) {
        producer.produce(
          topic,
          partition,
          Buffer.from(JSON.stringify({ partition, i })),
          null,
          Date.now(),
          onDelivery
        );
      }
    }

    expect(
      await waitFor(() => delivered === total, 20000),
      `only ${delivered} of ${total} messages were delivered`
    ).to.equal(true);

    await steveo.start();

    expect(
      await waitFor(() => firstBatch !== undefined, 30000),
      'no batch was processed'
    ).to.equal(true);

    const batch = firstBatch as number[];
    const drawnFrom = [...new Set(batch)].sort();

    expect(
      drawnFrom.length,
      `first batch only drew from partition ${drawnFrom}, so it cannot show the defect`
    ).to.be.greaterThan(1);

    // commitMessage is queued, so let librdkafka flush before reading back
    const { consumer } = runner;
    const expected = new Map(
      drawnFrom.map(partition => [
        partition,
        batch.filter(p => p === partition).length,
      ])
    );

    // a partition with no commit at all comes back without an offset field
    const shortfall = (committed: Committed) =>
      [...expected]
        .map(([partition, count]) => {
          const offset = committed.find(c => c.partition === partition)?.offset;
          return typeof offset === 'number' && offset >= count
            ? undefined
            : `p${partition} committed ${
                offset ?? 'nothing'
              }, expected ${count}`;
        })
        .filter((entry): entry is string => entry !== undefined);

    const deadline = Date.now() + 10000;
    let committed: Committed = [];

    do {
      // eslint-disable-next-line no-await-in-loop
      committed = await committedOffsets(consumer, topic);
      if (shortfall(committed).length === 0) {
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(200);
    } while (Date.now() < deadline);

    await steveo.stop();

    expect(
      shortfall(committed),
      `first batch was ${JSON.stringify(batch)}`
    ).to.eqls([]);
  }).timeout(120000);
});
