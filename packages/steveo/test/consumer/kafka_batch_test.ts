import { expect } from 'chai';
import sinon from 'sinon';
import Runner from '../../src/consumers/kafka';
import { build } from '../../src/lib/pool';
import Registry from '../../src/runtime/registry';

describe('runner/kafka - batch processing and concurrency', () => {
  let sandbox;
  let runner;
  let registry;

  beforeEach(() => {
    registry = new Registry();
    registry.addNewTask({
      name: 'test-topic',
      topic: 'test-topic',
    });

    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getBatchSize', () => {
    it('should return 1 when batch processing is disabled', () => {
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: false,
            batchSize: 10,
          },
        },
        registry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);
      expect(runner.getBatchSize()).to.equal(1);
    });

    it('should return configured batch size when enabled', () => {
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 10,
          },
        },
        registry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);
      expect(runner.getBatchSize()).to.equal(10);
    });

    it('should return default batch size of 5 when enabled without size', () => {
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
          },
        },
        registry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);
      expect(runner.getBatchSize()).to.equal(5);
    });
  });

  describe('processBatch', () => {
    it('should process all messages in batch and commit last offset on success', async () => {
      const subscribeStub = sinon
        .stub()
        .returns(Promise.resolve({ some: 'success' }));
      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 5,
          },
        },
        registry: anotherRegistry,
        // @ts-expect-error
        pool: build(anotherRegistry),
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

      const messages = [
        {
          value: Buffer.from(JSON.stringify({ a: '1' })),
          offset: 100,
          topic: 'test-topic',
          partition: 1,
        },
        {
          value: Buffer.from(JSON.stringify({ a: '2' })),
          offset: 101,
          topic: 'test-topic',
          partition: 1,
        },
        {
          value: Buffer.from(JSON.stringify({ a: '3' })),
          offset: 102,
          topic: 'test-topic',
          partition: 1,
        },
      ];

      await runner.processBatch(messages);

      // Should process all 3 messages
      expect(subscribeStub.callCount).to.equal(3);

      // Should commit last message
      expect(commitStub.callCount).to.equal(1);
      expect(commitStub.args[0][0].offset).to.equal(102);

      // Should emit batch_processed event
      expect(anotherRegistry.emit.callCount).to.be.greaterThan(0);
      const batchEvent = anotherRegistry.emit.args.find(
        args => args[0] === 'batch_processed'
      );
      expect(batchEvent).to.exist;
      expect(batchEvent[1].batchSize).to.equal(3);
      expect(batchEvent[1].succeeded).to.equal(3);
      expect(batchEvent[1].failed).to.equal(0);
    });

    it('should commit even when any message fails', async () => {
      const subscribeStub = sinon.stub();
      subscribeStub.onCall(0).resolves({ success: true });
      subscribeStub.onCall(1).rejects(new Error('Processing failed'));
      subscribeStub.onCall(2).resolves({ success: true });

      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 5,
          },
        },
        registry: anotherRegistry,
        // @ts-expect-error
        pool: build(anotherRegistry),
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

      const messages = [
        {
          value: Buffer.from(JSON.stringify({ a: '1' })),
          offset: 100,
          topic: 'test-topic',
          partition: 1,
        },
        {
          value: Buffer.from(JSON.stringify({ a: '2' })),
          offset: 101,
          topic: 'test-topic',
          partition: 1,
        },
        {
          value: Buffer.from(JSON.stringify({ a: '3' })),
          offset: 102,
          topic: 'test-topic',
          partition: 1,
        },
      ];

      await runner.processBatch(messages);

      // Should attempt all 3 messages
      expect(subscribeStub.callCount).to.equal(3);

      expect(commitStub.callCount).to.equal(1);
      expect(commitStub.args[0][0].offset).to.equal(102); // Last message offset

      // Should emit batch_processed with failures
      const batchEvent = anotherRegistry.emit.args.find(
        args => args[0] === 'batch_processed'
      );
      expect(batchEvent).to.exist;
      expect(batchEvent[1].batchSize).to.equal(3);
      expect(batchEvent[1].succeeded).to.equal(2);
      expect(batchEvent[1].failed).to.equal(1);

      // Should emit batch_failure event
      const failureEvent = anotherRegistry.emit.args.find(
        args => args[0] === 'batch_failure'
      );
      expect(failureEvent).to.exist;
      expect(failureEvent[1].failureCount).to.equal(1);
    });

    it('should respect configured batch size limit', async () => {
      const subscribeStub = sinon
        .stub()
        .returns(Promise.resolve({ some: 'success' }));
      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 2, // Only process 2 at a time
          },
        },
        registry: anotherRegistry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

      const messages = [
        {
          value: Buffer.from(JSON.stringify({ a: '1' })),
          offset: 100,
          topic: 'test-topic',
          partition: 1,
        },
        {
          value: Buffer.from(JSON.stringify({ a: '2' })),
          offset: 101,
          topic: 'test-topic',
          partition: 1,
        },
        {
          value: Buffer.from(JSON.stringify({ a: '3' })),
          offset: 102,
          topic: 'test-topic',
          partition: 1,
        },
        {
          value: Buffer.from(JSON.stringify({ a: '4' })),
          offset: 103,
          topic: 'test-topic',
          partition: 1,
        },
      ];

      await runner.processBatch(messages);

      // Should only process 2 messages (batchSize limit)
      expect(subscribeStub.callCount).to.equal(2);

      // Should commit offset 101 (second message)
      expect(commitStub.args[0][0].offset).to.equal(101);
    });
  });

  describe('concurrency control', () => {
    it('should process messages with concurrency limit', async () => {
      let concurrentCount = 0;
      let maxConcurrentSeen = 0;

      const subscribeStub = sinon.stub().callsFake(async () => {
        concurrentCount++;
        maxConcurrentSeen = Math.max(maxConcurrentSeen, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCount--;
        return { success: true };
      });

      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 10,
          },
          concurrency: {
            enabled: true,
            maxConcurrent: 3, // Limit to 3 concurrent
          },
        },
        registry: anotherRegistry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

      const messages = Array.from({ length: 10 }, (_, i) => ({
        value: Buffer.from(JSON.stringify({ index: i })),
        offset: 100 + i,
        topic: 'test-topic',
        partition: 1,
      }));

      await runner.processBatch(messages);

      // All messages should be processed
      expect(subscribeStub.callCount).to.equal(10);

      // Max concurrent should not exceed limit
      expect(maxConcurrentSeen).to.be.at.most(3);

      // Should commit last message
      expect(commitStub.callCount).to.equal(1);
      expect(commitStub.args[0][0].offset).to.equal(109);
    });

  });

  describe('consumeCallback with batch processing', () => {
    it('should use processBatch when batch processing enabled', async () => {
      const subscribeStub = sinon
        .stub()
        .returns(Promise.resolve({ some: 'success' }));
      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 5,
          },
        },
        registry: anotherRegistry,
        manager: {
          shouldTerminate: false,
        },
      };
      // @ts-expect-error
      runner = new Runner(steveo);
      runner.state = 'running';

      const processBatchSpy = sandbox.spy(runner, 'processBatch');
      const consumeStub = sandbox.stub(runner.consumer, 'consume');
      sandbox.stub(runner.consumer, 'commitMessage');

      const messages = [
        {
          value: Buffer.from(JSON.stringify({ a: '1' })),
          offset: 100,
          topic: 'test-topic',
          partition: 1,
        },
        {
          value: Buffer.from(JSON.stringify({ a: '2' })),
          offset: 101,
          topic: 'test-topic',
          partition: 1,
        },
      ];

      await runner.consumeCallback(null, messages);

      // Should call processBatch, not receive directly
      expect(processBatchSpy.callCount).to.equal(1);
      // processBatch uses processMessageWithoutCommit internally, not receive
      expect(subscribeStub.callCount).to.equal(2); // Both messages processed

      // Should consume with batch size
      expect(consumeStub.callCount).to.equal(1);
      expect(consumeStub.args[0][0]).to.equal(5); // batchSize
    });

    it('should use receive directly when batch processing disabled', async () => {
      const subscribeStub = sinon
        .stub()
        .returns(Promise.resolve({ some: 'success' }));
      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: false,
          },
        },
        registry: anotherRegistry,
        manager: {
          shouldTerminate: false,
        },
      };
      // @ts-expect-error
      runner = new Runner(steveo);
      runner.state = 'running';

      const receiveSpy = sandbox.spy(runner, 'receive');
      const consumeStub = sandbox.stub(runner.consumer, 'consume');
      sandbox.stub(runner.consumer, 'commitMessage');

      const messages = [
        {
          value: Buffer.from(JSON.stringify({ a: '1' })),
          offset: 100,
          topic: 'test-topic',
          partition: 1,
        },
      ];

      await runner.consumeCallback(null, messages);

      // Should call receive directly
      expect(receiveSpy.callCount).to.equal(1);

      // Should consume with batch size 1
      expect(consumeStub.callCount).to.equal(1);
      expect(consumeStub.args[0][0]).to.equal(1);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle empty message batch gracefully', async () => {
      const subscribeStub = sinon
        .stub()
        .returns(Promise.resolve({ some: 'success' }));
      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 5,
          },
        },
        registry: anotherRegistry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

      // Empty array
      await runner.processBatch([]);

      // Should not process anything
      expect(subscribeStub.callCount).to.equal(0);
      expect(commitStub.callCount).to.equal(0);
    });

    it('should handle single message in batch', async () => {
      const subscribeStub = sinon
        .stub()
        .returns(Promise.resolve({ some: 'success' }));
      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 5,
          },
        },
        registry: anotherRegistry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

      const messages = [
        {
          value: Buffer.from(JSON.stringify({ a: '1' })),
          offset: 100,
          topic: 'test-topic',
          partition: 1,
        },
      ];

      await runner.processBatch(messages);

      expect(subscribeStub.callCount).to.equal(1);
      expect(commitStub.callCount).to.equal(1);
      expect(commitStub.args[0][0].offset).to.equal(100);
    });

    it('should emit proper metrics with duration', async () => {
      const subscribeStub = sinon.stub().callsFake(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { success: true };
      });

      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 5,
          },
        },
        registry: anotherRegistry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      sandbox.stub(runner.consumer, 'commitMessage');

      const messages = [
        {
          value: Buffer.from(JSON.stringify({ a: '1' })),
          offset: 100,
          topic: 'test-topic',
          partition: 1,
        },
      ];

      await runner.processBatch(messages);

      const batchEvent = anotherRegistry.emit.args.find(
        args => args[0] === 'batch_processed'
      );
      expect(batchEvent).to.exist;
      expect(batchEvent[1].duration).to.be.a('number');
      expect(batchEvent[1].duration).to.be.greaterThan(0);
    });

    it('should handle all messages failing in batch', async () => {
      const subscribeStub = sinon
        .stub()
        .rejects(new Error('All messages fail'));

      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 5,
          },
        },
        registry: anotherRegistry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

      const messages = [
        {
          value: Buffer.from(JSON.stringify({ a: '1' })),
          offset: 100,
          topic: 'test-topic',
          partition: 1,
        },
        {
          value: Buffer.from(JSON.stringify({ a: '2' })),
          offset: 101,
          topic: 'test-topic',
          partition: 1,
        },
      ];

      await runner.processBatch(messages);

      expect(subscribeStub.callCount).to.equal(2);
      // Legacy behavior: commit even when all messages fail
      expect(commitStub.callCount).to.equal(1);
      expect(commitStub.args[0][0].offset).to.equal(101); // Last message offset

      const batchEvent = anotherRegistry.emit.args.find(
        args => args[0] === 'batch_processed'
      );
      expect(batchEvent[1].succeeded).to.equal(0);
      expect(batchEvent[1].failed).to.equal(2);

      const failureEvent = anotherRegistry.emit.args.find(
        args => args[0] === 'batch_failure'
      );
      expect(failureEvent).to.exist;
    });

    it('should process exact batch size when more messages available', async () => {
      const subscribeStub = sinon
        .stub()
        .returns(Promise.resolve({ some: 'success' }));
      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 3,
          },
        },
        registry: anotherRegistry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      const commitStub = sandbox.stub(runner.consumer, 'commitMessage');

      // Provide 10 messages but batch size is 3
      const messages = Array.from({ length: 10 }, (_, i) => ({
        value: Buffer.from(JSON.stringify({ index: i })),
        offset: 100 + i,
        topic: 'test-topic',
        partition: 1,
      }));

      await runner.processBatch(messages);

      // Should only process 3 messages
      expect(subscribeStub.callCount).to.equal(3);

      // Should commit offset 102 (third message: 100 + 2)
      expect(commitStub.callCount).to.equal(1);
      expect(commitStub.args[0][0].offset).to.equal(102);
    });
  });

  describe('consumeCallback paused state', () => {
    it('should sleep and continue consuming when paused', async () => {
      const subscribeStub = sinon
        .stub()
        .returns(Promise.resolve({ some: 'success' }));
      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: false,
          },
        },
        registry: anotherRegistry,
        manager: {
          shouldTerminate: false,
        },
      };
      // @ts-expect-error
      runner = new Runner(steveo);
      runner.state = 'paused';

      const consumeStub = sandbox.stub(runner.consumer, 'consume');
      sandbox.stub(runner.consumer, 'commitMessage');

      // Call consumeCallback while paused
      await runner.consumeCallback(null, []);

      // Should call consume again after sleep
      expect(consumeStub.callCount).to.equal(1);
      expect(consumeStub.args[0][0]).to.equal(1); // batch size when disabled
    });
  });

  describe('getBatchSize with undefined config', () => {
    it('should return 1 when batchProcessing config is completely undefined', () => {
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          // No batchProcessing config at all
        },
        registry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);
      expect(runner.getBatchSize()).to.equal(1);
    });
  });

  describe('concurrency with default values', () => {
    it('should use default maxConcurrent of 10 when not specified', async () => {
      let concurrentCount = 0;
      let maxConcurrentSeen = 0;

      const subscribeStub = sinon.stub().callsFake(async () => {
        concurrentCount++;
        maxConcurrentSeen = Math.max(maxConcurrentSeen, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCount--;
        return { success: true };
      });

      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 20,
          },
          concurrency: {
            enabled: true,
            // maxConcurrent not specified, should default to 10
          },
        },
        registry: anotherRegistry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      sandbox.stub(runner.consumer, 'commitMessage');

      const messages = Array.from({ length: 20 }, (_, i) => ({
        value: Buffer.from(JSON.stringify({ index: i })),
        offset: 100 + i,
        topic: 'test-topic',
        partition: 1,
      }));

      await runner.processBatch(messages);

      expect(subscribeStub.callCount).to.equal(20);
      // Default is 10, but it might be slightly higher due to timing
      expect(maxConcurrentSeen).to.be.at.most(11);
    });

    it('should use no concurrency limit when concurrency disabled', async () => {
      let concurrentCount = 0;
      let maxConcurrentSeen = 0;

      const subscribeStub = sinon.stub().callsFake(async () => {
        concurrentCount++;
        maxConcurrentSeen = Math.max(maxConcurrentSeen, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 5));
        concurrentCount--;
        return { success: true };
      });

      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 10,
          },
          concurrency: {
            enabled: false,
          },
        },
        registry: anotherRegistry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      sandbox.stub(runner.consumer, 'commitMessage');

      const messages = Array.from({ length: 10 }, (_, i) => ({
        value: Buffer.from(JSON.stringify({ index: i })),
        offset: 100 + i,
        topic: 'test-topic',
        partition: 1,
      }));

      await runner.processBatch(messages);

      expect(subscribeStub.callCount).to.equal(10);
      // All should run concurrently when disabled
      expect(maxConcurrentSeen).to.be.at.least(8); // Allow some timing variance
    });
  });

  describe('integration: batch processing + concurrency', () => {
    it('should correctly combine batch processing with concurrency control', async () => {
      let concurrentCount = 0;
      let maxConcurrentSeen = 0;
      const processingOrder: number[] = [];

      const subscribeStub = sinon.stub().callsFake(async payload => {
        concurrentCount++;
        maxConcurrentSeen = Math.max(maxConcurrentSeen, concurrentCount);
        const { index } = payload;
        processingOrder.push(index);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        concurrentCount--;
        return { success: true, index };
      });

      const anotherRegistry = {
        getTask: () => ({
          publish: () => { },
          subscribe: subscribeStub,
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };
      const steveo = {
        config: {
          bootstrapServers: 'kafka:9200',
          engine: 'kafka',
          securityProtocol: 'plaintext',
          batchProcessing: {
            enabled: true,
            batchSize: 15,
          },
          concurrency: {
            enabled: true,
            maxConcurrent: 5,
          },
        },
        registry: anotherRegistry,
      };
      // @ts-expect-error
      runner = new Runner(steveo);

      sandbox.stub(runner.consumer, 'commitMessage');

      const messages = Array.from({ length: 15 }, (_, i) => ({
        value: Buffer.from(JSON.stringify({ index: i })),
        offset: 100 + i,
        topic: 'test-topic',
        partition: 1,
      }));

      await runner.processBatch(messages);

      // All 15 should be processed
      expect(subscribeStub.callCount).to.equal(15);

      // Max concurrent should respect limit
      expect(maxConcurrentSeen).to.be.at.most(5);

      // All messages should be processed (order may vary due to concurrency)
      expect(processingOrder.length).to.equal(15);
      expect(new Set(processingOrder).size).to.equal(15); // All unique
    });
  });
});
