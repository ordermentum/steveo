import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../../src/producer/sqs';
import Registry from '../../src/registry';
import Task from '../../src/task';

describe('SQS Producer', () => {
  let sandbox: sinon.SinonSandbox;
  let producer: Producer;
  let registry: Registry;
  let createQueueStub: sinon.SinonStub;
  let getQueueUrlStub: sinon.SinonStub;
  let sendMessageStub: sinon.SinonStub;

  // const promiseResolves = async resolves => resolves;

  // const promiseRejects = async rejects => {
  //   throw rejects;
  // };

  // AWS SDK v2 has a pattern of `res = foo().promise()` to get a result as a
  // promise
  const awsPromiseResolves = resolves => ({
    promise: async () => resolves,
  });

  const awsPromiseRejects = rejects => ({
    promise: async () => {
      throw rejects;
    },
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    registry = new Registry();
    producer = new Producer(
      {
        engine: 'sqs',
      },
      registry
    );
    createQueueStub = sandbox
      .stub(producer.producer, 'createQueue')
      // @ts-ignore
      .callsFake(({ QueueName }) => {
        if (QueueName === 'topic-with-existing-queue') {
          return awsPromiseRejects('Queue exists');
        }
        return awsPromiseResolves({
          QueueUrl:
            'https://sqs.ap-southeast-2.amazonaws.com/123456123456/test-topic',
        });
      });

    getQueueUrlStub = sandbox
      .stub(producer.producer, 'getQueueUrl')
      // @ts-ignore
      .callsFake(({ QueueName }) => {
        if (QueueName === 'topic-without-queue') {
          return awsPromiseRejects('Queue does not exist');
        }
        return awsPromiseResolves({
          QueueUrl:
            'https://sqs.ap-southeast-2.amazonaws.com/123456123456/test-topic',
        });
      });

    sendMessageStub = sandbox
      .stub(producer.producer, 'sendMessage')
      // @ts-ignore
      .callsFake(({ MessageBody }: { MessageBody: string }) => {
        if (MessageBody.includes('bad-message')) {
          console.log('returning rejections');
          return awsPromiseRejects('Bad message');
        }
        return awsPromiseResolves({
          MD5OfMessageBody: '00000000000000000000000000000000',
          MessageId: '00000000-1111-2222-3333-444444444444',
        });
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#initialize', () => {
    it(`when a queue does not exist, a queue should be created`, async () => {
      await producer.initialize('topic-without-queue');
      expect(createQueueStub.calledOnce, 'createQueue is called').to.be.true;
    });

    it('when a queue exists, it should read and use the existing queue URL', async () => {
      await producer.initialize('topic-with-queue');
      expect(getQueueUrlStub.calledOnce, 'getQueueUrl is called').to.be.true;
      expect(createQueueStub.notCalled, 'createQueue is not called').to.be.true;
    });
  });

  describe('#send', () => {
    let initializeStub: sinon.SinonStub;

    beforeEach(() => {
      initializeStub = sandbox.stub(producer, 'initialize');
    });

    it(`when the topic's SQS URL is not known, initialize() should be called`, async () => {
      registry.addTopic('topic-without-queue');
      await producer.send('topic-without-queue', { foo: 'bar' });

      expect(initializeStub.calledOnce, 'initalise is called').to.be.true;
      expect(sendMessageStub.calledOnce, 'sendMessage is called').to.be.true;
    });

    it(`when the topic's SQS URL is know, initialize() should not be called`, async () => {
      registry.addTopic('topic-with-queue');
      producer.sqsUrls['topic-with-queue'] =
        'https://sqs.ap-southeast-2.amazonaws.com/123456123456/registered-topic-with-queue';
      await producer.send('topic-with-queue', { foo: 'bar' });

      expect(initializeStub.notCalled, 'initalise is not called').to.be.true;
      expect(sendMessageStub.calledOnce, 'sendMessage is called').to.be.true;
    });

    it('should include attributes in the message payload', async () => {
      const attributes = [
        {
          name: 'Hello',
          dataType: 'String',
          value: 'abc',
        },
      ];
      const task = new Task(
        { engine: 'sqs' },
        registry,
        producer,
        'test-task-with-attributes',
        'test-topic',
        () => undefined,
        attributes
      );
      registry.addNewTask(task);

      await producer.send('test-topic', { a: 'payload' });

      const sentAttributes =
        sendMessageStub.getCall(0).args[0].MessageAttributes[
          attributes[0].name
        ];
      const sentDataType = sentAttributes.DataType;
      const sentStringValue = sentAttributes.StringValue;

      expect(sendMessageStub.calledOnce, 'sendMessage is called').to.be.true;
      expect(sentAttributes, 'attributes are passed in MessageAttributes').to.be
        .not.undefined;
      expect(sentDataType, 'dataType is passed in MessageAttributes').to.equal(
        attributes[0].dataType
      );
      expect(
        sentStringValue,
        'stringValue is passed in MessageAttributes'
      ).to.equal(attributes[0].value);
    });

    it('should throw an error if initialize() throws an error', async () => {
      initializeStub.throws();

      const task = new Task(
        { engine: 'sqs' },
        registry,
        producer,
        'test-task',
        'test-topic',
        () => undefined
      );
      registry.addNewTask(task);

      let didCatchError = false;
      try {
        await producer.send('test-topic', { a: 'payload' });
      } catch (ex) {
        didCatchError = true;
        expect(ex).not.equal(undefined, 'error is not undefined');
        expect(ex).not.equal(null, 'error is not null');
      }
      expect(didCatchError, 'didCatchError is true').to.equal(true);
    });

    it('should throw an error if sendMessage() throws an error', async () => {
      initializeStub.resolves();

      const task = new Task(
        { engine: 'sqs' },
        registry,
        producer,
        'test-task',
        'test-topic',
        () => undefined
      );
      registry.addNewTask(task);

      let didCatchError = false;
      try {
        await producer.send('test-topic', { message: 'bad-message' });
      } catch (ex) {
        console.log('caught error', ex);
        didCatchError = true;
        expect(ex).not.equal(undefined, 'error is not undefined');
        expect(ex).not.equal(null, 'error is not null');
      }
      expect(didCatchError, 'didCatchError is true').to.equal(true);
    });

    afterEach(() => {
      initializeStub.restore();
    });
  });
});
