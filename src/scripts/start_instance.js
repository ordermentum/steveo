const { default: steveo } = require(process.env.INSTANCE); // eslint-disable-line import/no-dynamic-require
require(process.env.TASKS); // eslint-disable-line import/no-dynamic-require
const topic = process.argv[2];

(async () => {
  const runner = steveo.runner();
  while (true) {
    if (runner.registry.getTask(topic)) {
      await runner.process([topic]);
    }
    process.send('success');
  }
})();
