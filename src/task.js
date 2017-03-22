// @flow
import type { CB } from '../types';

const Task = (registry: Object, runner: Object) => {
  let topic = null;
  let subscribeCallback = () => {};

  const subscribe = (payload: any) => {
    // publish message on topic without delay
    console.log(payload);
    return subscribeCallback(payload);
  };

  const define = (taskName: string, callback: CB) => {
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
    console.log(args, topic);
  };

  return {
    define,
    publish,
    subscribe,
  };
};

export default Task;

