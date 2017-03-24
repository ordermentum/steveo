// @flow
import type { Task, RegistredTopics } from '../types';

const Registry = (registeredTasks: RegistredTopics) => {
  const addNewTask = (task: Task) => {
    registeredTasks[task.topic] = task; // eslint-disable-line
    // call initialize consumer
  };

  const removeTask = (task: Task) => {
    delete registeredTasks[task.topic]; // eslint-disable-line
     // call initialize consumer
  };

  return {
    addNewTask,
    removeTask,
  };
};

export default Registry;
