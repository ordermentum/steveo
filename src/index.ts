import NULL_LOGGER from 'null-logger';
import {
  IRunner,
  Hooks,
  ITask,
  Configuration,
  Callback,
  Pool,
  Logger,
  ISteveo,
  IRegistry,
  CustomTopicFunction,
  IProducer,
  IEvent,
  IMetric,
  Attribute,
} from './common';
/* eslint-disable no-underscore-dangle */
import Task from './task';
import Registry from './registry';
import runner from './base/runner';
import metric from './base/metric';
import producer from './base/producer';
import getConfig from './config';
import { build } from './base/pool';
import KafkaAdminClientFactory from './adminClient/kafka';

export class Steveo implements ISteveo {
  config: Configuration;

  logger: Logger;

  registry: IRegistry;

  getTopicName?: CustomTopicFunction;

  metric: IMetric | null;

  _producer?: IProducer;

  _runner?: IRunner;

  events: IEvent;

  pool: Pool;

  hooks: Hooks;

  constructor(
    configuration: Configuration,
    logger: Logger = NULL_LOGGER,
    hooks: Hooks
  ) {
    this.logger = logger;
    this.registry = new Registry();
    this.config = getConfig(configuration);
    this.metric = metric(this.config.engine, this.config, this.logger);
    this.pool = build(this.config.workerConfig);
    this.events = this.registry.events;
    this.hooks = hooks;

    // Add a termination check when no hooks are present
    if (!this.hooks?.healthCheck && !this.hooks?.terminationCheck) {
      for (const signal of ['SIGTERM', 'SIGINT'] as const) {
        process.on(signal, async () => {
          this.logger.info(
            `Received ${signal} -- Disconnecting and terminating`
          );
          setTimeout(() => process.exit(0), 100);
          this.disconnect();
        });
      }
    }
  }

  getTopic(topic: string) {
    let topicName = topic;
    if (this.getTopicName && typeof this.getTopicName === 'function') {
      topicName = this.getTopicName(topic);
    }
    return topicName;
  }

  task<T = any, R = any>(
    name: string,
    callback: Callback<T, R>,
    attributes: Attribute[] = [],
    doNotRegister: boolean = false
  ): ITask<T> {
    const topic = this.getTopic(name);
    const task = new Task<T, R>(
      this.config,
      this.registry,
      this.producer,
      name,
      topic,
      callback,
      attributes
    );

    if (!doNotRegister) {
      this.registry.addNewTask(task);
    }

    return task;
  }

  async publish<T = any>(name: string, payload: T, key?: string) {
    const topic = this.registry.getTopic(name);
    return this.producer.send<T>(topic, payload, key);
  }

  async registerTopic(name: string, topic?: string) {
    const topicName = topic ?? name;
    this.registry.addTopic(name, topic);
    await this.producer.initialize(topicName);
  }

  get producer() {
    if (!this._producer) {
      this._producer = producer(
        this.config.engine,
        this.config,
        this.registry,
        this.logger
      );
    }
    return this._producer;
  }

  runner() {
    if (!this._runner) {
      this._runner = runner(
        this.config.engine,
        this.config,
        this.registry,
        this.pool,
        this.logger,
        this.hooks
      );
    }
    return this._runner;
  }

  adminClient() {
    if (this.config.engine !== 'kafka') {
      throw new Error(
        'Admin client is only meant to be used with kafka, please use "steveo.runner().createQueues()" for other engines'
      );
    }
    return KafkaAdminClientFactory(this.config);
  }

  customTopicName = (cb: CustomTopicFunction) => {
    this.getTopicName = cb;
  };

  disconnect() {
    this._producer?.disconnect();
    this._runner?.disconnect();
  }
}

export default (config: Configuration, logger: Logger, hooks: Hooks) => () =>
  new Steveo(config, logger, hooks);
