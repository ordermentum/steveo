// @flow
import type { Task, RegistredTopics, Runner } from '../types';

const Registry = (registeredTasks: RegistredTopics) => {
  const addNewTask = (task: Task, runner: Runner) => {
    registeredTasks[task.topic] = task; // eslint-disable-line
    // call initialize consumer
    const topics = Object.keys(registeredTasks);
    runner.initializeConsumer(topics);
  };

  const removeTask = (task: Task, runner: Runner) => {
    delete registeredTasks[task.topic]; // eslint-disable-line
     // call initialize consumer
    const topics = Object.keys(registeredTasks);
    runner.initializeConsumer(topics);
  };

  return {
    addNewTask,
    removeTask,
  };
};

export default Registry;
