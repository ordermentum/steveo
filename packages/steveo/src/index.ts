/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
import NULL_LOGGER from 'null-logger';
/* eslint-disable no-underscore-dangle */
import assert from 'node:assert';
import Task from './runtime/task';
import Registry from './runtime/registry';
import getRunner from './lib/runner';
import getProducer from './lib/producer';
import getConfig from './config';
import { build } from './lib/pool';
import { Manager } from './lib/manager';

import {
  IRunner,
  ITask,
  Callback,
  Pool,
  Logger,
  ISteveo,
  IRegistry,
  IProducer,
  IEvent,
  KafkaConfiguration,
  RedisConfiguration,
  SQSConfiguration,
  DummyConfiguration,
  Middleware,
} from './common';
import { Storage } from './storage/storage';
import { TaskOptions } from './types/task-options';
import { Workflow } from './runtime/workflow';
import { WorkflowOptions } from './types/workflow';
import { formatTopicName, QueueFormatOptions } from './lib/formatters';

export { Logger } from './common';
export { Storage, Repositories } from './storage/storage';
export { WorkflowStateRepository } from './storage/workflow-repo';
export { WorkflowState } from './runtime/workflow-state';
export { WorkflowPayload } from './types/workflow';

export {
  KafkaConfiguration,
  RedisConfiguration,
  SQSConfiguration,
  DummyConfiguration,
} from './common';

export { Middleware, MiddlewareContext, MiddlewareCallback } from './common';

export class Steveo implements ISteveo {
  config: KafkaConfiguration | RedisConfiguration | SQSConfiguration;

  logger: Logger;

  registry: IRegistry;

  _producer?: IProducer;

  _runner?: IRunner;

  /**
   * General purpose storage engine originally introduced to
   * maintain workflow execution state.
   */
  _storage?: Storage;

  events: IEvent;

  pool: Pool<any>;

  restarts: number;

  exiting: boolean;

  paused: boolean;

  MAX_RESTARTS = 20;

  manager: Manager;

  middleware: Middleware[];

  constructor(
    configuration:
      | KafkaConfiguration
      | RedisConfiguration
      | SQSConfiguration
      | DummyConfiguration,
    logger: Logger = NULL_LOGGER,
    storage: Storage | undefined = undefined
  ) {
    this._storage = storage;
    this.logger = logger;
    this.registry = new Registry();
    this.config = getConfig(configuration);
    this.pool = build(this.registry, this.config.workerConfig);
    this.events = this.registry.events;
    this.restarts = 0;
    this.exiting = false;
    this.paused = false;
    this.manager = new Manager(this);
    this.middleware = configuration.middleware ?? [];
  }

  /**
   * Start the [fluent](https://en.wikipedia.org/wiki/Fluent_interface) declaration
   * and registration of a new workflow.
   * @param topic
   * @returns
   */
  flow(name: string, options: WorkflowOptions = { serviceId: 'DEFAULT' }) {
    const queueFormatOptions: QueueFormatOptions = {
      queueName: options.queueName,
      upperCaseNames: this.config.upperCaseNames,
      queuePrefix: this.config.queuePrefix,
    };
    const topic = formatTopicName(name, queueFormatOptions);

    return new Workflow({
      name,
      topic,
      storage: this.storage,
      logger: this.logger,
      registry: this.registry,
      producer: this.producer,
      options,
    });
  }

  /**
   * Declare a task consumer.
   * Given the steveo instance configuration, this will monitor the topic (queue) for the
   * message `name` and call back the given function.
   * @param name
   * @param callback
   * @param options
   * @returns
   */
  task<T = any, R = any, C = any>(
    name: string,
    callback: Callback<T, R, C>,
    options: TaskOptions = {}
  ): ITask<T> {
    const queueFormatOptions: QueueFormatOptions = {
      queueName: options.queueName,
      upperCaseNames: this.config.upperCaseNames,
      queuePrefix: this.config.queuePrefix,
    };
    const topic = formatTopicName(name, queueFormatOptions);
    const task = new Task<T, R>(
      this.config,
      this.registry,
      this.producer,
      name,
      topic,
      callback,
      options
    );
    this.logger.info(
      { task: task.name, topic: task.topic, taskOptions: options },
      `Registering ${task.name} Task to Steveo.`
    );
    this.registry.addNewTask(task);

    return task;
  }

  /**
   * Publish the given payload to the given topic
   * @param key
   */
  async publish<T = any>(name: string, payload: T, key?: string) {
    const topic = this.registry.getTopic(name);
    return this.producer.send<T>(topic, payload, key);
  }

  /**
   * Formats a topic name to the queue naming convention
   */
  getTopicName(name: string) {
    const withOrWithoutPrefix = this.config.queuePrefix
      ? `${this.config.queuePrefix}_${name}`
      : name;
    const uppercased = this.config.upperCaseNames
      ? withOrWithoutPrefix.toUpperCase()
      : withOrWithoutPrefix;
    return uppercased;
  }

  /**
   * Registers a new topic (queue) with the configured message queue provider.
   * @param name
   * @param topic (Optional) Topic/queue name; if not provided the name will be used
   */
  async registerTopic(name: string, topic?: string) {
    let topicName = topic;
    if (!topicName) {
      topicName = this.getTopicName(name);
    }

    this.registry.addTopic(name, topicName);
    await this.producer.initialize(topicName);
  }

  get storage() {
    assert(this._storage);

    return this._storage;
  }

  get producer() {
    if (!this._producer) {
      this._producer = getProducer(
        this.config.engine,
        this.config,
        this.registry,
        this.logger
      );
    }
    return this._producer;
  }

  async pause() {
    return this.manager.pause();
  }

  async resume() {
    return this.manager.resume();
  }

  async stop() {
    return this.manager.stop();
  }

  /**
   * This pattern allows us to load all tasks in a directory
   * and as part of that they self register with the registry allowing
   */
  async loadTasks() {
    if (typeof this.config.tasksPath === 'undefined') {
      throw new Error('config.tasksPath not defined - failed to load tasks');
    }

    require(this.config.tasksPath);
  }

  async start(customTopics: string[] = []) {
    await this.loadTasks();
    const runner = this.runner();

    if (!runner) {
      throw new Error('No runner found');
    }

    const topics = customTopics.length
      ? customTopics
      : this.registry.getTopics();

    const topicsWithRegisteredTasks = topics.filter(
      topic => !!this.registry.getTask(topic)
    );

    runner.process(topicsWithRegisteredTasks);
  }

  runner() {
    if (!this._runner) {
      this.logger.debug('no runner exists, creating runner');
      const runner = getRunner(this);
      this.logger.debug(`runner created ${runner.name}`);
      this._runner = runner;
    }

    return this._runner;
  }
}

export default (
  config:
    | KafkaConfiguration
    | RedisConfiguration
    | SQSConfiguration
    | DummyConfiguration,
  logger: Logger,
  storage?: Storage
) => new Steveo(config, logger, storage);
