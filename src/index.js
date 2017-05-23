// @flow
import 'babel-polyfill';

import NULL_LOGGER from 'null-logger';
import Task from './task';
import Registry from './registry';
import Runner from './runner';
import Producer from './producer';

import type { Config, Callback } from '../types';

const Steveo = (config: Config, logger: Object = NULL_LOGGER) => () => {
  const registry = Registry();
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
    runner,
    customTopicName,
    events: registry.events,
  };
};

export default Steveo;
