// @flow
import C from './constants';
import type { Config, Callback, Reg, Producer } from '../types';


const Task = (config: Config, registry: Reg, producer: Producer) => {
  let topic: string;
  let subscribeCallback = C.NOOP;

  const subscribe = (payload: any) => subscribeCallback(payload);

  const define = async (topicName: string, callBack: Callback) => {
    topic = topicName;
    subscribeCallback = callBack;
    const task = {
      topic,
      subscribe: subscribeCallback,
    };
    registry.addNewTask(task, producer);
    await producer.initialize();
  };

  const publish = async (payload: Object) => {
    try {
      await producer.send(topic, payload);
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
  };
};

export default Task;

