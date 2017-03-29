// @flow
import C from './constants';
import type { Task, PublishCallback } from '../types';

const Registry = (publishCallbacks: ?PublishCallback) => {
  const registeredTasks = {};
  const addNewTask = (task: Task) => {
    registeredTasks[task.topic] = task; // eslint-disable-line
  };

  const removeTask = (task: Task) => {
    delete registeredTasks[task.topic]; // eslint-disable-line
  };

  const getTopics = () => Object.keys(registeredTasks);

  const getTask = (topic: string) => registeredTasks[topic];

  return {
    addNewTask,
    removeTask,
    getTopics,
    getTask,
    successCallback:
      (publishCallbacks && publishCallbacks.success) ? publishCallbacks.success : C.NOOP,
    failureCallback:
      (publishCallbacks && publishCallbacks.failure) ? publishCallbacks.failure :
      C.NOOP,
  };
};

export default Registry;
