// @flow
import type { Callback, Reg } from '../types';

const Task = (registry: Reg, runner: Object, logger: Object) => {
  let topic = null;
  let subscribeCallback = () => {};

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

  const publish = async (...args: Array<string>) => {
    // check with registry for valid topic
    // publish message on topic
    runner.send(...args);
    logger.info(args, topic);
  };

  return {
    define,
    publish,
    subscribe,
  };
};

export default Task;

