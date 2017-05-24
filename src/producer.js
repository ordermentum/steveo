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
    const payload = JSON.stringify(Object.assign({}, msg, { timestamp }));
    const size = Buffer.from(payload, 'utf-8');
    logger.info('Payload Size:', topic, size.length);
    return {
      timestamp,
      topic,
      message: {
        value: payload,
      },
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
      await new Promise((resolve, reject) => {
        sqs.sendMessage(sqsData, function(err, data) {
          if (err) reject(err);
          logger.info('sqs success', data);
          resolve();
        });
      });
    } catch (e) {
      logger.error('sqs failure', e)
    }

    try {
      await producer.send(data, sendParams);
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
    producer,
    sqs,
  };
};

export default Producer;
