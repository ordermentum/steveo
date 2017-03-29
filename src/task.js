// @flow
import events from 'events';
import extend from 'extend';
import C from './constants';
import type { Config, Callback, Reg, Producer } from '../types';

function Task(config: Config, registry: Reg, producer: Producer) {
  let topic: string;
  let subscribeCallback = C.NOOP;
  const eventEmitter = new events.EventEmitter();

  const subscribe = (payload: any) => subscribeCallback(payload);

  const define = async (topicName: string, callBack: Callback) => {
    topic = topicName;
    subscribeCallback = callBack;
    const task = {
      topic,
      subscribe: subscribeCallback,
    };
    registry.addNewTask(task, producer);
    eventEmitter.emit('create', topicName);
    await producer.initialize();
  };

  const publish = async (payload: Object) => {
    try {
      await producer.send(topic, payload);
      eventEmitter.emit('success', topic, payload);
      registry.successCallback(topic, payload);
    } catch (ex) {
      eventEmitter.emit('failure', topic, payload);
      registry.failureCallback(topic, payload);
      throw ex;
    }
  };

  return extend({
    define,
    publish,
    subscribe,
  }, events.EventEmitter.prototype);
}

export default Task;

