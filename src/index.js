// @flow
import 'babel-polyfill';

import kafka from 'no-kafka';
import NULL_LOGGER from 'null-logger';
import Task from './task';
import Registry from './registry';
import runner from './runner';
import metric from './metric';
import producer from './producer';
import Config from './config';
import { build } from './pool';

import type { ITask, Configuration, Callback, IProducer, Pool, Logger, ISteveo, IRegistry, IEvent, IMetric, Attribute } from '../types';

class Steveo implements ISteveo {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  topicName: Callback;
  producer: IProducer;
  metric: IMetric;
  events: IEvent;
  pool: Pool;

  constructor(configuration: Configuration, logger :Logger = NULL_LOGGER) {
    this.logger = logger;
    this.registry = new Registry();
    this.config = new Config(configuration);
    this.metric = metric(this.config.engine, this.config, this.logger);
    this.pool = build(this.config.workerConfig);
    this.producer = producer(this.config.engine, this.config, this.registry, this.logger);
    this.events = this.registry.events;
  }

  task(name: string, callback: Callback, attributes: Array<Attribute> = []): ITask {
    const topic = this.getTopicName(name);
    const task = new Task(this.producer, name, topic, callback, attributes);
    task.register(this.registry);
    return task;
  }

  runner() {
    return runner(this.config.engine, this.config, this.registry, this.pool, this.logger);
  }

  getTopicName(topic: string): string {
    let topicName = topic;
    if (this.topicName && typeof this.topicName === 'function') {
      topicName = this.getTopicName(topic);
    }
    return topicName;
  }

  customTopicName = (callback: Callback) => {
    this.topicName = callback;
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

