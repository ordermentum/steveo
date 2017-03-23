// @flow
const Registry = (registeredTasks: Object) => {
  const addNewTask = (task: Object) => {
    registeredTasks[task.topic] = task; // eslint-disable-line
    // call initialize consumer
  };

  const removeTask = (task: Object) => {
    delete registeredTasks[task.topic]; // eslint-disable-line
     // call initialize consumer
  };

  return {
    addNewTask,
    removeTask,
  };
};

export default Registry;
