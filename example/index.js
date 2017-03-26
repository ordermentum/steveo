const Steveo = require('steveo').default;
const { kafkaCompression } = require('steveo');

const env = Object.assign({}, process.env, { KAFKA_CODEC: kafkaCompression.GZIP });

const steveo = Steveo(env, console);

// wait for the kafka consumer to call the subscribe action
const subscribe = async (payload) => {
  console.log('Here is the payload', payload);
};

// define task
steveo.task.define('test-topic', subscribe);

// publish task
steveo.task.publish({ here: 'is a payload' });

process.exit();
