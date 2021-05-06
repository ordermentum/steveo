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
  IProducer,
  IEvent,
  Attribute,
  TaskOpts,
} from './common';
/* eslint-disable no-underscore-dangle */
import Task from './task';
import Registry from './registry';
import runner from './base/runner';
import producer from './base/producer';
import getConfig from './config';
import { build } from './base/pool';

export class Steveo implements ISteveo {
  config: Configuration;

  logger: Logger;

  registry: IRegistry;

  _producer?: IProducer;

  _runner?: IRunner;

  events: IEvent;

  pool: Pool<any>;

  hooks: Hooks;

  constructor(
    configuration: Configuration,
    logger: Logger = NULL_LOGGER,
    hooks: Hooks
  ) {
    this.logger = logger;
    this.registry = new Registry();
    this.config = getConfig(configuration);
    this.pool = build(this.config.workerConfig);
    this.events = this.registry.events;
    this.hooks = hooks;
  }

  task<T = any, R = any>(
    name: string,
    callback: Callback<T, R>,
    sqsAttributes: Attribute[] = [],
    attributes: TaskOpts = {}
  ): ITask<T> {
    const topic =
      attributes.queueName ??
      (this.config.queuePrefix ? `${this.config.queuePrefix}_name` : name);
    const task = new Task<T, R>(
      this.config,
      this.registry,
      this.producer,
      name,
      topic,
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

  disconnect() {
    this._producer?.disconnect();
    this._runner?.disconnect();
  }
}

export default (config: Configuration, logger: Logger, hooks: Hooks) => () =>
  new Steveo(config, logger, hooks);
