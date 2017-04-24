// @flow
import 'babel-polyfill';

import kafka from 'no-kafka';
import NULL_LOGGER from 'null-logger';
import Task from './task';
import Registry from './registry';
import Runner from './runner';
import Admin from './admin';
import Producer from './producer';
import Config from './config';

import type { Callback, Configuration } from '../types';

const Steveo = (config: Configuration, logger: Object = NULL_LOGGER) => () => {
  const registry = Registry();
  config = new Config(config);
  let getTopicName = null;

  const task = (topic: string, callBack: Callback) => {
    const producer = Producer(config, registry, logger);
    let topicName = topic;
    if (getTopicName && typeof getTopicName === 'function') {
      topicName = getTopicName(topic);
    }
    return Task(config, registry, producer, topicName, callBack);
  };

  const customTopicName = (cb: Callback) => {
    getTopicName = cb;
  };

  const runner = () => Runner(config, registry, logger);

  return {
    task,
    lag: Admin(config).lag,
    runner,
    customTopicName,
    events: registry.events,
  };
};

export const kafkaCompression = {
  SNAPPY: kafka.COMPRESSION_SNAPPY,
  GZIP: kafka.COMPRESSION_GZIP,
  NONE: kafka.COMPRESSION_NONE,
};

export default Steveo;
