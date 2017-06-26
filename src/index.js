// @flow
import 'babel-polyfill';

import kafka from 'no-kafka';
import NULL_LOGGER from 'null-logger';
import Task from './task';
import Registry from './registry';
import runner from './base/runner';
import metric from './base/metric';
import producer from './base/producer';
import Config from './config';

import type { ITask, Configuration, Callback, Logger, ISteveo, IRegistry, IEvent, IMetric } from '../types';

class Steveo implements ISteveo {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  getTopicName: Callback;
  metric: IMetric;
  events: IEvent;

  constructor(configuration: Configuration, logger :Logger = NULL_LOGGER) {
    this.logger = logger;
    this.registry = new Registry();
    this.config = new Config(configuration);
    this.metric = metric(this.config.engine, this.config, this.logger);
    this.events = this.registry.events;
  }

  task(topic: string, callBack: Callback): ITask {
    const prod = producer(this.config.engine, this.config, this.registry, this.logger);
    let topicName = topic;
    if (this.getTopicName && typeof this.getTopicName === 'function') {
      topicName = this.getTopicName(topic);
    }
    return new Task(this.config, this.registry, prod, topicName, callBack);
  }

  runner() {
    return runner(this.config.engine, this.config, this.registry, this.logger);
  }

  customTopicName = (cb: Callback) => {
    this.getTopicName = cb;
  };

  metric() {
    return this.metric;
  }
}

export default (config: Configuration, logger: Logger) => () => new Steveo(config, logger);

export const kafkaCompression = {
  SNAPPY: kafka.COMPRESSION_SNAPPY,
  GZIP: kafka.COMPRESSION_GZIP,
  NONE: kafka.COMPRESSION_NONE,
};

