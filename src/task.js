// @flow
import C from './constants';
import type { Callback, Reg, Runner } from '../types';


const Task = (registry: Reg, runner: Runner, logger: Object) => {
  let topic: string;
  let subscribeCallback = C.NOOP;

  const subscribe = (payload: any) => {
    // publish message on topic without delay
    logger.info(payload);
    return subscribeCallback(payload);
  };

  const define = async (topicName: string, callBack: Callback) => {
    topic = topicName;
    subscribeCallback = callBack;
    const task = {
      topic,
      subscribe: subscribeCallback,
    };
    await registry.addNewTask(task, runner);
  };

  const publish = async (payload: Object) => {
    // check with registry for valid topic
    // publish message on topic
    try {
      await runner.send(topic, payload);
      logger.info('FROM PRODUCER', topic, payload);
      registry.successCallback(topic, payload);
    } catch (ex) {
      registry.failureCallback(topic, payload);
      throw ex;
    }
  };

  return {
    define,
    publish,
    subscribe,
    runner,
  };
};

export default Task;

