// @flow

import moment from 'moment';

import sqs from '../config/sqs';
import type { Configuration, Logger, Producer, IProducer, IRegistry, sqsUrls } from '../../types';

class SqsProducer implements IProducer {
  config: Configuration;
  registry: IRegistry;
  logger: Logger;
  producer: Producer;
  sqsUrls: sqsUrls;

  constructor(config: Configuration, registry: IRegistry, logger: Logger) {
    this.config = config;
    this.producer = sqs(config);
    this.logger = logger;
    this.registry = registry;
  }

  initialize = (topic: ?string) => {
    return new Promise((resolve: any, reject: any) => {
      const params = {
        Quename: topic,
        Attributes: {
          ReceiveMessageWaitTimeSeconds: this.config.receiveMessageWaitTimeSeconds,
          MessageRetentionPeriod: this.config.messageRetentionPeriod,
        },
      };
      this.producer.createQueue(params, (err, data) => {
        if (err) reject(err);
        resolve(data && data.QueueUrl);
      });
    });
  }

  producerPayload(msg: Object, topic: string) {
    this.sqsUrls = {};
    const timestamp = moment().unix();
    return {
      MessageAttributes: {
        Timestamp: {
          DataType: 'Number',
          StringValue: timestamp.toString(),
        },
      },
      MessageBody: JSON.stringify(Object.assign({}, msg, { timestamp })),
      QueueUrl: this.sqsUrls[topic],
    };
  }

  send = async (topic: string, payload: Object) => {
    try {
      if (!this.sqsUrls[topic]) {
        this.sqsUrls[topic] = await this.initialize(topic);
      }
    } catch (ex) {
      this.logger.error('Error in initalizing sqs', ex);
      throw ex;
    }

    const sqsData = this.producerPayload(payload, topic);

    try {
      await new Promise((resolve, reject) => {
        sqs.sendMessage(sqsData, (err, data) => {
          if (err) reject(err);
          this.logger.info('SQS Publish Data', data);
          resolve();
        });
        this.registry.events.emit('producer_success', topic, payload);
      });
    } catch (ex) {
      this.logger.error('Error while sending SQS payload', topic, ex);
      this.registry.events.emit('producer_failure', topic, ex);
      throw ex;
    }
  }
}

export default SqsProducer;
