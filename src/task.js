// @flow
import type { Callback } from '../types';

const Task = (registry: Object, runner: Object, logger: Object) => {
  let topic = null;
  let subscribeCallback = () => {};

  const subscribe = (payload: any) => {
    // publish message on topic without delay
    logger.info(payload);
    return subscribeCallback(payload);
  };

  const define = (taskName: string, callback: Callback) => {
    topic = taskName;
    subscribeCallback = callback;
    registry.addNewTask({
      topic,
      subscribe,
    });
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

