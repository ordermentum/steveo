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
  IEvent,
  IMetric,
  Attribute,
} from './common';

class Steveo implements ISteveo {
  config: Configuration;

  logger: Logger;

  registry: IRegistry;

  getTopicName?: Callback;

  metric: IMetric;

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

  task(
    topic: string,
    callBack: Callback,
    attributes: Attribute[] = [],
    doNotRegister: boolean = false
  ): ITask {
    const prod = producer(
      this.config.engine,
      this.config,
      this.registry,
      this.logger
    );
    let topicName = topic;
    if (this.getTopicName && typeof this.getTopicName === 'function') {
      topicName = this.getTopicName(topic);
    }

    return new Task(
      this.config,
      this.registry,
      prod,
      topicName,
      callBack,
      attributes,
      doNotRegister
    );
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

  customTopicName = (cb: Callback) => {
    this.getTopicName = cb;
  };
}

export default (config: Configuration, logger: Logger, hooks: Hooks) => () =>
  new Steveo(config, logger, hooks);
