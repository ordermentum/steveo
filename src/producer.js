// @flow
import moment from 'moment';
import type { Config, Reg } from '../types';
import { sqs } from '../config';

const sqsInit = (topic, logger) => {
  return new Promise((resolve, reject) => {
    const params = {
      QueueName: topic,
      Attributes: {
        'ReceiveMessageWaitTimeSeconds': '20', // Linger time for long poll connections
        'MessageRetentionPeriod': '604800' // 7 days
      }
    };

    sqs.createQueue(params, function(err, data) {
      // If the queue already exists this function just returns the queue URL
      if (err) return reject(err);
      resolve(data.QueueUrl);
    });
  });
}

const Producer = (config: Config, registry: Reg, logger: Object) => {
  const sqsUrls = {};

  const sqsPayload = (msg: Object, topic: string) => {
    const timestamp = moment().unix();

    return {
      MessageAttributes: {
        Timestamp: {
          DataType: 'Number',
          StringValue: timestamp.toString(),
        }
      },
      MessageBody: JSON.stringify(Object.assign({}, msg, { timestamp })),
      QueueUrl: sqsUrls[topic],
    }
  };

  const initialize = () => {};

  const send = async (topic: string, payload: Object) => {
    try {
      if (!sqsUrls[topic]) sqsUrls[topic] = await sqsInit(topic, logger);
    } catch (e) {
      logger.error('Error initializing SQS', e)
      throw e;
    }

    const sqsData = sqsPayload(payload, topic);

    try {
      await new Promise((resolve, reject) => {
        sqs.sendMessage(sqsData, function(err, data) {
          if (err) reject(err);
          logger.info('sqs success', data);
          resolve();
        });
      });
      registry.events.emit('producer_success', topic, payload);
    } catch (ex) {
      logger.error('Error while sending payload:', JSON.stringify(payload, null, 2), 'topic :', topic, 'Error :', ex);
      registry.events.emit('producer_failure', topic, ex);
      throw ex;
    }
  };

  return {
    send,
    initialize,
    sqs,
  };
};

export default Producer;
