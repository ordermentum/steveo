// @flow
import events from 'events';

import type { Task } from '../types';

const Registry = () => {
  const registeredTasks = {};
  const eventEmitter = new events.EventEmitter();

  const addNewTask = (task: Task) => {
    eventEmitter.emit('task_added', task);
    registeredTasks[task.topic] = task; // eslint-disable-line
  };

  const removeTask = (task: Task) => {
    eventEmitter.emit('task_removed', task);
    delete registeredTasks[task.topic]; // eslint-disable-line
  };

  const getTopics = () => Object.keys(registeredTasks);

  const getTask = (topic: string) => registeredTasks[topic];

  return {
    addNewTask,
    removeTask,
    getTopics,
    events: eventEmitter,
    getTask,
  };
};

export default Registry;
