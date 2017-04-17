// @flow
import type { Config, Callback, Reg, Producer } from '../types';

function Task(
  config: Config,
  registry: Reg,
  producer: Producer,
  topic: string,
  subscribeCallback: Callback) {
  const subscribe = (payload: any) => subscribeCallback(payload);

  const publish = async (payload: Array<Object>) => {
    try {
      await Promise.all(payload.map(data => producer.send(topic, data)));
      registry.events.emit('task_success', topic, payload);
    } catch (ex) {
      registry.events.emit('task_failure', topic, payload);
      throw ex;
    }
  };

  const task = {
    topic,
    subscribe: subscribeCallback,
  };

  registry.addNewTask(task, producer);
  producer.initialize();

  return {
    publish,
    subscribe,
  };
}

export default Task;
