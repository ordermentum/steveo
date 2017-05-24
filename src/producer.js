// @flow
import Kafka from 'no-kafka';
import moment from 'moment';
import { defineLazyProperty } from 'lazy-object';
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

  const producer = new Kafka.Producer({
    connectionString: config.kafkaConnection,
    codec: config.kafkaCodec,
  });

  const producerPayload = (msg: Object, topic: string) => {
    const timestamp = moment().unix();

    return {
      timestamp,
      topic,
      message: { value: JSON.stringify(Object.assign({}, msg, { timestamp })) },
    };
  };

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

  const initialize = () =>
    defineLazyProperty(producer, { init: producer.init() });

  const send = async (topic: string, payload: Object) => {
    try {
      if (!sqsUrls[topic]) sqsUrls[topic] = await sqsInit(topic, logger);
    } catch (e) {
      logger.error('Error initializing SQS', e)
      throw e;
    }

    const data = producerPayload(payload, topic);
    const sqsData = sqsPayload(payload, topic);

    const sendParams = {
      retries: {
        attempts: config.kafkaSendAttempts,
        delay: {
          min: config.kafkaSendDelayMin,
          max: config.kafkaSendDelayMax,
        },
      },
    };

    try {
      await producer.send(data, sendParams);
    } catch (ex) {
      logger.error('Error while sending kafka payload:', JSON.stringify(payload, null, 2), 'topic :', topic, 'Error :', ex);
    }

    try {
      await new Promise((resolve, reject) => {
        sqs.sendMessage(sqsData, function(err, data) {
          if (err) reject(err);
          logger.info('sqs success', data);
          resolve();
        });
        registry.events.emit('producer_success', topic, payload);
      });
    } catch (ex) {
      logger.error('Error while sending sqs payload:', JSON.stringify(payload, null, 2), 'topic :', topic, 'Error :', e);
      registry.events.emit('producer_failure', topic, ex);
      throw ex;
    }
  };

  return {
    send,
    initialize,
    producer,
    sqs,
  };
};

export default Producer;
