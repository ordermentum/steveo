/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
import NULL_LOGGER from 'null-logger';
import {
  IRunner,
  Hooks,
  ITask,
  Callback,
  Pool,
  Logger,
  ISteveo,
  IRegistry,
  IProducer,
  IEvent,
  Attribute,
  TaskOpts,
  KafkaConfiguration,
  RedisConfiguration,
  SQSConfiguration,
  DummyConfiguration,
} from './common';
/* eslint-disable no-underscore-dangle */
import Task from './task';
import Registry from './registry';
import getRunner from './lib/runner';
import getProducer from './lib/producer';
import getConfig from './config';
import { build } from './lib/pool';

export class Steveo implements ISteveo {
  config: KafkaConfiguration | RedisConfiguration | SQSConfiguration;

  logger: Logger;

  registry: IRegistry;

  _producer?: IProducer;

  _runner?: IRunner;

  events: IEvent;

  pool: Pool<any>;

  hooks?: Hooks;

  restarts: number;

  exiting: boolean;

  paused: boolean;

  MAX_RESTARTS = 20;

  constructor(
    configuration:
      | KafkaConfiguration
      | RedisConfiguration
      | SQSConfiguration
      | DummyConfiguration,
    logger: Logger = NULL_LOGGER, // eslint-disable-line default-param-last
    hooks?: Hooks
  ) {
    this.logger = logger;
    this.registry = new Registry();
    this.config = getConfig(configuration);
    this.pool = build(this.config.workerConfig);
    this.events = this.registry.events;
    this.hooks = hooks;
    this.restarts = 0;
    this.exiting = false;
    this.paused = false;
  }

  task<T = any, R = any, C = any>(
    name: string,
    callback: Callback<T, R, C>,
    sqsAttributes: Attribute[] = [],
    attributes: TaskOpts = {}
  ): ITask<T> {
    const topic =
      attributes.queueName ??
      (this.config.queuePrefix ? `${this.config.queuePrefix}_${name}` : name);

    const task = new Task<T, R>(
      this.config,
      this.registry,
      this.producer,
      name,
      this.config.upperCaseNames ? topic.toUpperCase() : topic,
      callback,
      sqsAttributes
    );
    this.registry.addNewTask(task);

    return task;
  }

  async publish<T = any>(name: string, payload: T, key?: string) {
    const topic = this.registry.getTopic(name);
    return this.producer.send<T>(topic, payload, key);
  }

  getTopicName(name: string) {
    const withOrWithoutPrefix = this.config.queuePrefix
      ? `${this.config.queuePrefix}_${name}`
      : name;
    const uppercased = this.config.upperCaseNames
      ? withOrWithoutPrefix.toUpperCase()
      : withOrWithoutPrefix;
    return uppercased;
  }

  async registerTopic(name: string, topic?: string) {
    let topicName = topic;
    if (!topicName) {
      topicName = this.getTopicName(name);
    }

    this.registry.addTopic(name, topicName);
    await this.producer.initialize(topicName);
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

  // allow runner and producer to gracefully stop processing
  async terminate() {
    this.exiting = true;
    return this.disconnect();
  }

  async pause() {
    this.paused = true;
    const runner = this.runner();
    return runner.pause();
  }

  async resume() {
    this.paused = false;
    const runner = this.runner();
    return runner.resume();
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

    const topics = customTopics?.length
      ? customTopics
      : this.registry.getTopics();

    const topicsWithRegisteredTasks = topics.filter(
      topic => !!this.registry.getTask(topic)
    );

    runner.process(topicsWithRegisteredTasks);
  }

  runner() {
    if (!this._runner) {
      this._runner = getRunner(this);
    }
    return this._runner;
  }

  async disconnect() {
    return Promise.all([
      this._producer?.disconnect(),
      this._runner?.disconnect(),
    ]);
  }
}

export default (
  config:
    | KafkaConfiguration
    | RedisConfiguration
    | SQSConfiguration
    | DummyConfiguration,
  logger: Logger,
  hooks?: Hooks
) => new Steveo(config, logger, hooks);
