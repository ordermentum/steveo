// @flow
import C from './constants';
import type { Task, RegistredTopics, Runner, PublishCallback } from '../types';

const Registry = (registeredTasks: RegistredTopics,
      publishCallbacks: ?PublishCallback) => {
  const addNewTask = async (task: Task, runner: Runner) => {
    registeredTasks[task.topic] = task; // eslint-disable-line
    await runner.initializeGroupAdmin();
    await runner.initializeProducer();
    await runner.initializeConsumer(Object.keys(registeredTasks));
  };

  const removeTask = async (task: Task, runner: Runner) => {
    delete registeredTasks[task.topic]; // eslint-disable-line
     // call initialize consumer
    const topics = Object.keys(registeredTasks);
    await runner.initializeProducer();
    await runner.initializeGroupAdmin();
    await runner.initializeConsumer(topics);
  };

  return {
    addNewTask,
    removeTask,
    successCallback:
      (publishCallbacks && publishCallbacks.success) ? publishCallbacks.success : C.NOOP,
    failureCallback:
      (publishCallbacks && publishCallbacks.failure) ? publishCallbacks.failure :
      C.NOOP,
  };
};

export default Registry;
