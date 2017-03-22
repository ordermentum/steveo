// @flow
import 'babel-polyfill';

import Task from './task';
import Registry from './registry';
import Runner from './runner';

const Steveo = (env: string, kafkaHost: string) => {
  const registeredTopics = {};
  const registry = Registry(registeredTopics);
  const runner = Runner(env, kafkaHost, registry);
  return {
    task: Task(registry, runner),
  };
};

export default Steveo;
