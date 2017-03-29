// @flow
import type { Task } from '../types';

const Registry = () => {
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
  };
};

export default Registry;
