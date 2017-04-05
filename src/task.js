// @flow
import events from 'events';
import C from './constants';
import type { Config, Callback, Reg, Producer } from '../types';

function Task(config: Config, registry: Reg, producer: Producer) {
  let topic: string;
  let subscribeCallback = C.NOOP;
  const eventEmitter = new events.EventEmitter();

  const getTopicName = (name: string) => `${process.env.NODE_ENV || 'DEVELOPMENT'}_${name}`.toUpperCase();

  const subscribe = (payload: any) => subscribeCallback(payload);

  const define = (topicName: string, callBack: Callback) => {
    topic = topicName;
    subscribeCallback = callBack;
    const task = {
      topic,
      subscribe: subscribeCallback,
    };
    registry.addNewTask(task, producer);
    eventEmitter.emit('create', topic);
    producer.initialize();
  };

  const publish = async (payload: Array<Object>) => {
    try {
      await Promise.all(payload.map(data => producer.send(topic, data)));
      eventEmitter.emit('success', topic, payload);
    } catch (ex) {
      eventEmitter.emit('failure', topic, payload);
      throw ex;
    }
  };

  return {
    define,
    publish,
    subscribe,
    events: eventEmitter,
    getTopicName,
  };
}

export default Task;
