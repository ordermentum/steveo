/* eslint-disable no-underscore-dangle */
import { expect } from 'chai';
import sinon from 'sinon';
import create from '../../src';
import DummyProducer from '../../src/producers/dummy';
import { consoleLogger } from '../../src/lib/logger';
import { Configuration, ITask } from '../../lib/common';
import { TaskOptions } from '../../lib/types/task-options';
import { Storage } from '../../lib/storage/storage';
import config from '../../src/config';

describe('Index', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('handles registering tasks', async () => {
    // @ts-ignore
    const steveo = create({ engine: 'dummy' }, consoleLogger, {});
    // @ts-ignore
    const dummy = new DummyProducer({}, steveo.registry, consoleLogger);
    const initializeStub = sandbox.stub(dummy, 'initialize').resolves();
    steveo._producer = dummy;
    await steveo.registerTopic('TEST_TOPIC', 'TEST_TOPIC');
    expect(steveo.registry.items.size).to.equal(1);
    expect(initializeStub.calledOnce).to.equal(true);
  });
  it('handles registering topics', async () => {
    // @ts-ignore
    const steveo = create({ engine: 'dummy' }, consoleLogger, {});
    const registryStub = sandbox.stub(steveo.registry, 'addNewTask').resolves();
    steveo.task('TEST_TOPIC', () => {});
    expect(registryStub.calledOnce).to.equal(true);
  });
  it('handles publishing topics', async () => {
    // @ts-ignore
    const steveo = create({ engine: 'dummy' }, consoleLogger, {});
    steveo.registry.addTopic('TEST_TOPIC');
    // @ts-ignore
    const dummy = new DummyProducer({}, steveo.registry, consoleLogger);
    const sendStub = sandbox.stub(dummy, 'send').resolves();
    steveo._producer = dummy;
    await steveo.publish('TEST_TOPIC', {});
    expect(sendStub.calledOnce).to.equal(true);
  });

  it('handles publishing to named topics', async () => {
    // @ts-ignore
    const steveo = create({ engine: 'dummy' }, consoleLogger, {});
    steveo.registry.addTopic('TEST_TOPIC', 'PRODUCTION_TEST_TOPIC');
    // @ts-ignore
    const dummy = new DummyProducer({}, steveo.registry, consoleLogger);
    const sendStub = sandbox.stub(dummy, 'send').resolves();
    steveo._producer = dummy;
    await steveo.publish('TEST_TOPIC', { hello: 'world' });
    expect(sendStub.calledOnce).to.equal(true);
    expect(
      sendStub.calledWith('PRODUCTION_TEST_TOPIC', { hello: 'world' })
    ).to.equal(true);
  });

  describe('Steveo::task factory', () => {
    it('should return a new task and register task in Steveo', () => {
      const storage: Storage | undefined = undefined;
      const steveoConfig: Configuration = config({
        engine: 'dummy',
        queuePrefix: 'prefix',
        upperCaseNames: false,
      });
      const steveo = create(steveoConfig, consoleLogger, storage);

      const expectedCountBeforeCreateTask: number = 0;
      expect(expectedCountBeforeCreateTask).to.be.equal(
        steveo.registry.getTopics().length
      );

      const myTask: ITask = steveo.task('my-task-name', () => {});
      const expectedRegisteredTask: ITask = steveo.registry.getTask(
        myTask.topic
      ) as ITask;
      const expectedFinalCount: number = 1;
      expect(expectedFinalCount).to.be.equal(
        steveo.registry.getTopics().length
      );
      expect(expectedRegisteredTask).to.be.equal(myTask);
    });

    it('should use queueName in Task::Options, if set, as topic name', () => {
      const storage: Storage | undefined = undefined;
      const steveoConfig: Configuration = config({
        engine: 'dummy',
        upperCaseNames: false,
      });
      const steveo = create(steveoConfig, consoleLogger, storage);

      const taskOptions: TaskOptions = {
        queueName: 'name-in-task-options',
      };
      const myTask: ITask = steveo.task('my-task-name', () => {}, taskOptions);
      const expectedTopicName = 'name-in-task-options';
      expect(expectedTopicName).to.be.equal(myTask.topic);
    });

    it('should format topic to add prefix if queuePrefix is set in Steveo config', () => {
      const storage: Storage | undefined = undefined;
      const steveoConfig: Configuration = config({
        engine: 'dummy',
        queuePrefix: 'prefix',
        upperCaseNames: false,
      });
      const steveo = create(steveoConfig, consoleLogger, storage);

      const myTask: ITask = steveo.task('my-task-name', () => {});
      const expectedTopicName = 'prefix_my-task-name';
      expect(expectedTopicName).to.be.equal(myTask.topic);
    });

    it('should format topic to uppercase if upperCaseNames options is set to true in Steveo config', () => {
      const storage: Storage | undefined = undefined;
      const steveoConfig: Configuration = config({ engine: 'dummy' });
      const steveo = create(steveoConfig, consoleLogger, storage);

      const myTask: ITask = steveo.task('my-task-name', () => {});
      const expectedTopicName = 'MY-TASK-NAME';
      expect(expectedTopicName).to.be.equal(myTask.topic);
    });
  });

  describe('lifecycle methods', () => {
    it('pause and resume', async () => {
      const steveo = create(
        // @ts-ignore
        {
          engine: 'dummy',
          tasksPath: __filename,
        },
        consoleLogger
      );

      const pause = sandbox.stub().resolves();
      const resume = sandbox.stub().resolves();
      // @ts-ignore
      steveo.manager = {
        pause,
        resume,
      };

      await steveo.pause();
      expect(pause.callCount).to.eqls(1);
      await steveo.resume();
      expect(resume.callCount).to.eqls(1);
    });
  });
});
