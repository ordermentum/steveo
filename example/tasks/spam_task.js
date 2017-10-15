const { decorate } = require('../../lib/');

const handler = async () => {
  console.log('CALLED HANDLER');
};

handler.taskName = 'spam';

module.exports = decorate(handler);
