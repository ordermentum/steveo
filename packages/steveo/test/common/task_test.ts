import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { randomUUID } from 'crypto';
import Task from '../../src/task';

describe('Task', () => {
  let registry;
  let task: Task<{ payload: string }>;
  let producer;
  let subscribe;
  let sandbox;
  let producerSendStub: SinonStub;

  afterEach(() => sandbox.restore());

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    producerSendStub = sandbox.stub();
    producer = {
      send: producerSendStub.resolves(),
      initialize: sandbox.stub().resolves(),
    };
    registry = {
      addNewTask: sandbox.stub(),
      removeTask: sandbox.stub(),
      getTopic: sandbox.stub(),
      emit: sandbox.stub(),
      events: {
        emit: sandbox.stub(),
      },
    };
    subscribe = sandbox.stub();
    task = new Task<{ payload: string }, any>(
      { engine: 'kafka', bootstrapServers: '', tasksPath: '' },
      registry,
      producer,
      'a-simple-task',
      'a-simple-task',
      subscribe
    );
  });

  it('should create a new task instance', () => {
    expect(typeof task).to.equal('object');
    expect(typeof task.publish).to.equal('function');
    expect(typeof task.subscribe).to.equal('function');
  });

  it('should be able to publish array', async () => {
    await task.publish([{ payload: 'something-big' }]);
    expect(producer.send.callCount).to.equal(1);
    expect(registry.emit.callCount).to.equal(2);
  });

  it('should be able to publish object', async () => {
    await task.publish({ payload: 'something-big' });
    expect(producer.send.callCount).to.equal(1);
    expect(registry.emit.callCount).to.equal(2);
  });

  it('should accept non-promise methods', async () => {
    let x;
    const functionTask = new Task<{ payload: string }>(
      { engine: 'kafka', bootstrapServers: '', tasksPath: '' },
      registry,
      producer,
      'test',
      'test',
      () => {
        x = 1;
      }
    );

    await functionTask.subscribe({ payload: 'something-big' });
    expect(x).to.equal(1);
  });

  it('should be able to publish with callback on failure', async () => {
    const failureProducer = {
      send: sandbox.stub().throws(),
      initialize: sandbox.stub().resolves(),
    };
    const failTask = new Task<{ payload: string }>(
      { engine: 'kafka', bootstrapServers: '', tasksPath: '' },
      registry,
      // @ts-ignore
      failureProducer,
      'a-simple-task',
      'a-simple-task',
      subscribe
    );
    let err = false;
    try {
      await failTask.publish([{ payload: 'something-big' }]);
    } catch (ex) {
      expect(failureProducer.send.callCount).to.equal(1);
      expect(registry.emit.callCount).to.equal(2);
      err = true;
    }
    expect(err).to.equal(true);
  });

  it('should have subscribe method to invoke', () => {
    task.subscribe({ payload: 'something-small' });
    expect(subscribe.callCount).to.equal(1);
  });

  it('should be able to publish with a partition key', async () => {
    await task.publish({ payload: 'something-small' }, 'sample key');
    const args = producerSendStub.args[0];
    expect(args[0]).to.equals(task.topic);
    expect(args[1]).to.deep.equals({ payload: 'something-small' });
    expect(args[2]).to.equals('sample key');
  });

  it('should be able to publish a single payload with a partition key resolver', async () => {
    const taskWithKeyResolver = new Task<{ id: string; payload: string }, any>(
      { engine: 'kafka', bootstrapServers: '', tasksPath: '' },
      registry,
      producer,
      'a-simple-task',
      'a-simple-task',
      subscribe,
      {
        partitionKeyResolver: (payload: any) => payload.id,
      }
    );
    const expectedPartitionKey = randomUUID();

    // Publishing a single payload
    await taskWithKeyResolver.publish({
      id: expectedPartitionKey,
      payload: 'something-small',
    });
    const args = producerSendStub.args[0];
    expect(args[0]).to.equals(task.topic);
    expect(args[1]).to.deep.equals({
      id: expectedPartitionKey,
      payload: 'something-small',
    });
    expect(args[2]).to.equals(expectedPartitionKey);
  });

  it('should be able to publish an array of payloads with a partition key resolver', async () => {
    const taskWithKeyResolver = new Task<{ id: string; payload: string }, any>(
      { engine: 'kafka', bootstrapServers: '', tasksPath: '' },
      registry,
      producer,
      'a-simple-task',
      'a-simple-task',
      subscribe,
      {
        partitionKeyResolver: (payload: any) => payload.id,
      }
    );

    // Publishing an array of payloads
    const pk1 = randomUUID();
    const pk2 = randomUUID();
    await taskWithKeyResolver.publish([
      {
        id: pk1,
        payload: 'payload-1',
      },
      {
        id: pk2,
        payload: 'payload-2',
      },
    ]);

    const payload1 = producerSendStub.args[0];
    expect(payload1[0]).to.equals(task.topic);
    expect(payload1[1]).to.deep.equals({
      id: pk1,
      payload: 'payload-1',
    });
    expect(payload1[2]).to.equals(pk1);

    const payload2 = producerSendStub.args[1];
    expect(payload2[0]).to.equals(task.topic);
    expect(payload2[1]).to.deep.equals({
      id: pk2,
      payload: 'payload-2',
    });
    expect(payload2[2]).to.equals(pk2);
  });
});
