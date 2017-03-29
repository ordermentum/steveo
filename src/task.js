// @flow
import events from 'events';
import C from './constants';
import type { Config, Callback, Reg, Producer } from '../types';

function Task(config: Config, registry: Reg, producer: Producer) {
  let topic: string;
  let subscribeCallback = C.NOOP;
  const eventEmitter = new events.EventEmitter();

  return {
    eventEmitter,
    subscribe(payload: any) { subscribeCallback(payload); },

    async define(topicName: string, callBack: Callback) {
      topic = topicName;
      subscribeCallback = callBack;
      const task = {
        topic,
        subscribe: subscribeCallback,
      };
      registry.addNewTask(task, producer);
      this.eventEmitter.emit('create', topicName);
      await producer.initialize();
    },

    async publish(payload: Object) {
      try {
        await producer.send(topic, payload);
        this.eventEmitter.emit('success', topic, payload);
        registry.successCallback(topic, payload);
      } catch (ex) {
        this.eventEmitter.emit('failure', topic, payload);
        registry.failureCallback(topic, payload);
        throw ex;
      }
    },
  };
}

export default Task;

