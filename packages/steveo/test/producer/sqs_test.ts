import { expect } from 'chai';
import sinon from 'sinon';
import Producer from '../../src/producers/sqs';
import Registry from '../../src/registry';
import Task from '../../src/task';
import { ITask, TaskOptions } from '../../src/common';
import { createMessageMetadata } from '../../src/lib/context';

describe('SQS Producer', () => {
  let sandbox: sinon.SinonSandbox;
  let producer: Producer;
  let registry: Registry;
  let createQueueStub: sinon.SinonStub;
  let getQueueUrlStub: sinon.SinonStub;
  let sendMessageStub: sinon.SinonStub;

  // AWS SDK v2 has a pattern of `res = foo().promise()` to get a result as a
  // promise
  const awsPromiseResolves = returnValue => ({
    promise: async () => returnValue,
  });

  const awsPromiseRejects = errorMessage => ({
    promise: async () => {
      throw new Error(errorMessage);
    },
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    registry = new Registry();
    producer = new Producer(
      // @ts-ignore
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
  describe('initialize', async () => {
    it(`throws when a topic is not provided`, async () => {
      let didThrow = false;
      try {
        await producer.initialize(undefined as unknown as string);
      } catch (err) {
        didThrow = true;
      }
      expect(didThrow).to.be.true;
    });

    it(`when a queue does not exist, a queue should be created`, async () => {
      await producer.initialize('topic-without-queue');
      expect(createQueueStub.calledOnce, 'createQueue is called').to.be.true;
    });

    it('when a queue exists, it should read and use the existing queue URL', async () => {
      await producer.initialize('topic-with-queue');
      expect(getQueueUrlStub.calledOnce, 'getQueueUrl is called').to.be.true;
      expect(createQueueStub.notCalled, 'createQueue is not called').to.be.true;
    });

    it('when a task config includes deadletterQueue, it should create or fetch an existing queue for RedrivePolicy on main queue', async () => {
      const subscribeStub = sandbox.stub().resolves({ some: 'success' });
      const anotherRegistry = {
        registeredTasks: [],
        addNewTask: () => {},
        removeTask: () => {},
        getTopics: () => [],
        getTaskTopics: () => [],
        getTask: () => ({
          publish: () => {},
          subscribe: subscribeStub,
          options: {
            deadLetterQueue: true,
          },
        }),
        emit: sandbox.stub(),
        events: {
          emit: sandbox.stub(),
        },
      };

      const newProducer = new Producer(
        // @ts-ignore
        {
          engine: 'sqs',
        },
        anotherRegistry
      );

      const createQueueStub = sandbox
        .stub(newProducer.producer, 'createQueue')
        .onCall(0)
        // Creating DLQ
        .returns(
          // @ts-expect-error
          awsPromiseResolves({
            QueueUrl:
              'https://sqs.ap-southeast-2.amazonaws.com/123456123456/dlq-topic_DLQ',
          })
        )
        .onCall(1)
        .returns(
          // @ts-expect-error
          awsPromiseResolves({
            QueueUrl:
              'https://sqs.ap-southeast-2.amazonaws.com/123456123456/dlq-topic',
          })
        );

      const testArn = 'arn:aws:sqs:ap-southeast-2:000000000000:dlq-topic_DLQ';
      const getQueueAttributeStub = sandbox
        .stub(newProducer.producer, 'getQueueAttributes')
        .returns(
          // @ts-expect-error
          awsPromiseResolves({
            Attributes: {
              QueueArn: testArn,
            },
          })
        );

      const getQueueStub = sandbox
        .stub(newProducer.producer, 'getQueueUrl')
        // @ts-expect-error
        .returns(awsPromiseRejects('unable to find existing'));

      await newProducer.initialize('dlq-topic');

      expect(getQueueAttributeStub.called).to.be.true;
      expect(getQueueStub.calledTwice, 'getQueueUrl is called twice').to.be
        .true;
      expect(createQueueStub.calledTwice, 'createQueue is called twice').to.be
        .true;

      const mainQueueCreateArgs: any = createQueueStub.args[1][0];
      expect(
        mainQueueCreateArgs.Attributes.RedrivePolicy,
        'includes RedrivePolicy when DLQ is enabled'
      ).to.equals(`{"deadLetterTargetArn":"${testArn}","maxReceiveCount":"5"}`);
    });
  });

  describe('send', () => {
    let initializeStub: sinon.SinonStub;
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      initializeStub = sandbox.stub(producer, 'initialize');
      clock = sinon.useFakeTimers({
        shouldAdvanceTime: false,
      });
    });

    afterEach(() => {
      initializeStub.restore();
      clock.restore();
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
        { attributes }
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

    it('should merge the context object into payload metadata if context given', async () => {
      const taskOptions: TaskOptions = {};
      const task: ITask = new Task(
        {engine: 'sqs'},
        registry,
        producer,
        'test-task-with-attributes',
        'test-topic',
        () => undefined,
        taskOptions
      );
      registry.addNewTask(task);

      const messagePayload: any = { a: 'payload' };
      const messageContext: any = { any: 'context' };
      const messageGroupId: undefined = undefined;
      const expectedMessageBody = {
        ...messagePayload,
        _meta: { ...createMessageMetadata(messagePayload), ...messageContext },
      }
      const expectedPayload = {
        MessageAttributes: {Timestamp: {DataType: 'Number', StringValue: clock.now.toString()}},
        MessageBody: JSON.stringify(expectedMessageBody),
        QueueUrl: undefined,
        MessageGroupId: undefined,
      };

      await producer.send('test-topic', messagePayload, messageGroupId, messageContext);
      sinon.assert.calledWith(sendMessageStub, expectedPayload);
    });

    it('should use key as MessageGroupId if task is configured as fifo and key is present', async () => {
      const taskOptions: TaskOptions = { fifo: true };
      const task: ITask = new Task(
        {engine: 'sqs'},
        registry,
        producer,
        'test-task-with-attributes',
        'test-topic',
        () => undefined,
        taskOptions
      );
      registry.addNewTask(task);

      const messagePayload: any = { a: 'payload' };
      const messageContext: any = { any: 'context' };
      const messageGroupId: string = 'any-key'
      const expectedMessageBody = {
        ...messagePayload,
        _meta: { ...createMessageMetadata(messagePayload), ...messageContext },
      }

      const expectedPayload = {
        MessageAttributes: {Timestamp: {DataType: 'Number', StringValue: clock.now.toString()}},
        MessageBody: JSON.stringify(expectedMessageBody),
        QueueUrl: undefined,
        MessageGroupId: messageGroupId,
      };

      await producer.send('test-topic', messagePayload, messageGroupId, messageContext);
      sinon.assert.calledWith(sendMessageStub, expectedPayload);
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
        didCatchError = true;
        expect(ex).not.equal(undefined, 'error is not undefined');
        expect(ex).not.equal(null, 'error is not null');
      }
      expect(didCatchError, 'didCatchError is true').to.equal(true);
    });
  });
});
