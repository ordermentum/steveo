// @flow
import type { Task, RegistredTopics, Runner } from '../types';

const Registry = (registeredTasks: RegistredTopics) => {
  const addNewTask = async (task: Task, runner: Runner) => {
    registeredTasks[task.topic] = task; // eslint-disable-line
    // call initialize consumer
    const topics = Object.keys(registeredTasks);
    await runner.initializeProducer();
    await runner.initializeConsumer(topics);
    await runner.initializeGroupAdmin();
  };

  const removeTask = async (task: Task, runner: Runner) => {
    delete registeredTasks[task.topic]; // eslint-disable-line
     // call initialize consumer
    const topics = Object.keys(registeredTasks);
    await runner.initializeProducer();
    await runner.initializeConsumer(topics);
    await runner.initializeGroupAdmin();
  };

  return {
    addNewTask,
    removeTask,
  };
};

export default Registry;
