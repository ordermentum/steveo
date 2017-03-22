// @flow
const registry = (registeredTasks: Object) => {
  const addNewTask = (task: Object) => {
    registeredTasks[task.topic] = task; // eslint-disable-line
  };

  const removeTask = (task: Object) => {
    delete registeredTasks[task.topic]; // eslint-disable-line
  };

  return {
    addNewTask,
    removeTask,
  };
};

export default registry;
