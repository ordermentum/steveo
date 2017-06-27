// @flow

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
    this.sqsUrls = {};
  }

  initialize(topic: ?string) {
    return new Promise((resolve: any, reject: any) => {
      const params = {
        QueueName: topic,
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

  getPayload(msg: Object, topic: string) {
    const timestamp = new Date().getTime();
    const task = this.registry.getTask(topic);
    const attributes = task ? task.attributes : [];
    const messageAttributes = {
      Timestamp: {
        DataType: 'Number',
        StringValue: timestamp.toString(),
      },
    };
    if (attributes) {
      attributes.forEach((a) => {
        messageAttributes[a.name] = {
          DataType: a.dataType || 'String',
          StringValue: a.value.toString(),
        };
      });
    }

    return {
      MessageAttributes: messageAttributes,
      MessageBody: JSON.stringify(Object.assign({}, msg, { timestamp })),
      QueueUrl: this.sqsUrls[topic],
    };
  }

  async send(topic: string, payload: Object) {
    try {
      if (!this.sqsUrls[topic]) {
        this.sqsUrls[topic] = await this.initialize(topic);
      }
    } catch (ex) {
      this.logger.error('Error in initalizing sqs', ex);
      throw ex;
    }

    const sqsData = this.getPayload(payload, topic);

    try {
      await new Promise((resolve, reject) => {
        this.producer.sendMessage(sqsData, (err, data) => {
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
