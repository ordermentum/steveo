// @flow
import 'babel-polyfill';

import kafka from 'no-kafka';
import path from 'path';
import NULL_LOGGER from 'null-logger';
import Task from './task';
import Registry from './registry';
import runner from './runner';
import metric from './metric';
import producerFactory from './producer';
import Config from './config';
import Loader from './loader';
import { build } from './pool';

import type { ITask, Configuration, Callback, Pool, Logger, ISteveo, IRegistry, IEvent, IMetric, Attribute } from '../types';

class Steveo implements ISteveo {
  config: Configuration;
  logger: Logger;
  registry: IRegistry;
  metric: IMetric;
  events: IEvent;
  pool: Pool;

  constructor(configuration: Configuration, logger: Logger = NULL_LOGGER) {
    this.config = new Config(configuration);
    this.logger = logger;
    this.metric = metric(this.config.engine, this.config, this.logger);
    this.pool = build(this.config.workerConfig);
    const producer = producerFactory(this.config.engine, this.config, this.registry, this.logger);
    this.registry = Registry.getInstance();
    this.registry.setProducer(producer);
    this.events = this.registry.events;
  }

  static build(config: ?string = null, pattern: ?string = null) {
    const root = process.cwd();
    let configPath = config;

    if (!configPath) {
      configPath = path.join(root, '.steveo.json');
    }

    configPath = path.resolve(configPath);

    // $FlowFixMe
    const configuration = require(configPath); // eslint-disable-line

    let searchPattern: string = pattern || configuration.pattern;
    if (!searchPattern) {
      searchPattern = `${root}/tasks/**/*.js`;
    }

    const steveo = new Steveo(configuration);
    const loader = new Loader(steveo, root, searchPattern);
    loader.load();
    return steveo;
  }

  task(name: string, callback: Callback, attributes: Array<Attribute> = []): ITask {
    const task = new Task(name, callback, this.registry, attributes);
    return task;
  }

  runner() {
    return runner(this.config.engine, this.config, this.registry, this.pool, this.logger);
  }

  customTopicName = (callback: Callback) => {
    Registry.getInstance().topicName = callback;
  };

  metric() {
    return this.metric;
  }
}

export default Steveo;
export const builder = (config: Configuration, logger: Logger) => new Steveo(config, logger);

export const decorate = (handler: Callback) => {
  const method = handler;
  const { taskName } = method;
  const task = new Task(taskName, handler, Registry.getInstance());
  method.task = task;
  method.publish = handler.task.publish.bind(task);
  method.subscribe = handler;
  return method;
};

export const kafkaCompression = {
  SNAPPY: kafka.COMPRESSION_SNAPPY,
  GZIP: kafka.COMPRESSION_GZIP,
  NONE: kafka.COMPRESSION_NONE,
};

