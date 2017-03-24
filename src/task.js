// @flow
import C from './constants';
import type { Callback, Reg } from '../types';


const Task = (registry: Reg, runner: Object, logger: Object) => {
  let topic = null;
  let subscribeCallback = C.NOOP;

  const subscribe = (payload: any) => {
    // publish message on topic without delay
    logger.info(payload);
    return subscribeCallback(payload);
  };

  const define = (topicName: string, callBack: Callback) => {
    topic = topicName;
    subscribeCallback = callBack;
    const task = {
      topic,
      subscribe: subscribeCallback,
    };
    registry.addNewTask(task);
  };

  const publish = async (payload: Object) => {
    // check with registry for valid topic
    // publish message on topic
    await runner.send(topic, payload);
    logger.info(topic, payload);
  };

  return {
    define,
    publish,
    subscribe,
  };
};

export default Task;

