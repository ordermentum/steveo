// @flow
import events from 'events';
import type { Config, Callback, Reg, Producer } from '../types';

function Task(
  config: Config,
  registry: Reg,
  producer: Producer,
  topic: string,
  subscribeCallback: Callback) {
  const eventEmitter = new events.EventEmitter();

  const subscribe = (payload: any) => subscribeCallback(payload);

  const publish = async (payload: Array<Object>) => {
    try {
      await Promise.all(payload.map(data => producer.send(topic, data)));
      eventEmitter.emit('success', topic, payload);
    } catch (ex) {
      eventEmitter.emit('failure', topic, payload);
      throw ex;
    }
  };

  const task = {
    topic,
    subscribe: subscribeCallback,
  };

  registry.addNewTask(task, producer);
  eventEmitter.emit('create', topic);
  producer.initialize();

  return {
    publish,
    subscribe,
    events: eventEmitter,
  };
}

export default Task;
