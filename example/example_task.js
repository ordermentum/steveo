const { decorate } = require('../lib/');

const handler = async () => {
  console.log('CALLED HANDLER');
};

handler.taskName = 'test';
module.exports = decorate(handler);
