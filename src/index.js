import 'babel-polyfill';

import kafka from 'no-kafka';
import NULL_LOGGER from 'null-logger';
import Task from './task/kafka';
import Registry from './registry';
import Runner from './runner/kafka';
import Admin from './admin/kafka';
import Producer from './producer/kafka';
import Config from './config';


class Steveo {
  constructor(configuration, logger = NULL_LOGGER) {
    this.logger = logger;
    this.registry = new Registry();
    this.config = new Config(configuration);
    this.getTopicName = null;
    this.admin = new Admin(this.config);
    this.events = this.registry.events;
  }

  task(topic, callBack) {
    const producer = new Producer(this.config, this.registry, this.logger);
    let topicName = topic;
    if (this.getTopicName && typeof getTopicName === 'function') {
      topicName = this.getTopicName(topic);
    }
    return new Task(this.config, this.registry, producer, topicName, callBack);
  }

  runner() {
    return new Runner(this.config, this.registry, this.logger);
  }

  customTopicName = (cb) => {
    this.getTopicName = cb;
  };

  lag() {
    return this.admin.lag;
  }
}

export default (config, logger) => () => new Steveo(config, logger);

export const kafkaCompression = {
  SNAPPY: kafka.COMPRESSION_SNAPPY,
  GZIP: kafka.COMPRESSION_GZIP,
  NONE: kafka.COMPRESSION_NONE,
};

