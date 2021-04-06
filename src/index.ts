/* eslint-disable no-underscore-dangle */
import NULL_LOGGER from 'null-logger';
import Task from './task';
import Registry from './registry';
import runner from './base/runner';
import metric from './base/metric';
import producer from './base/producer';
import getConfig from './config';
import { build } from './base/pool';

import {
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

export class Steveo implements ISteveo {
  config: Configuration;

  logger: Logger;

  registry: IRegistry;

  getTopicName?: CustomTopicFunction;

  metric: IMetric;

  _producer?: IProducer;

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
  }

  getTopic(topic: string) {
    let topicName = topic;
    if (this.getTopicName && typeof this.getTopicName === 'function') {
      topicName = this.getTopicName(topic);
    }
    return topicName;
  }

  task<T = any, R = any>(
    topic: string,
    callBack: Callback<T, R>,
    attributes: Attribute[] = [],
    doNotRegister: boolean = false
  ): ITask<T> {
    const topicName = this.getTopic(topic);

    return new Task<T, R>(
      this.config,
      this.registry,
      this.producer,
      topicName,
      callBack,
      attributes,
      doNotRegister
    );
  }

  async publish<T = any>(topic: string, payload: T) {
    return this.producer.send<T>(topic, payload);
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
    return runner(
      this.config.engine,
      this.config,
      this.registry,
      this.pool,
      this.logger,
      this.hooks
    );
  }

  customTopicName = (cb: CustomTopicFunction) => {
    this.getTopicName = cb;
  };
}

export default (config: Configuration, logger: Logger, hooks: Hooks) => () =>
  new Steveo(config, logger, hooks);
