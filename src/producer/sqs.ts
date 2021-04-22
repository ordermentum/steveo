import nullLogger from 'null-logger';
import sqsConf from '../config/sqs';

import {
  Configuration,
  Logger,
  IProducer,
  IRegistry,
  sqsUrls,
} from '../common';

import { getMeta } from './utils';

class SqsProducer implements IProducer {
  config: Configuration;

  registry: IRegistry;

  logger: Logger;

  producer: any;

  sqsUrls: sqsUrls;

  constructor(
    config: Configuration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    this.config = config;
    this.producer = sqsConf.sqs(config);
    this.logger = logger;
    this.registry = registry;
    this.sqsUrls = {};
  }

  async initialize(topic?: string) {
    if (!topic) {
      throw new Error('Topic cannot be empty');
    }

    const data = await this.producer
      .getQueueUrlAsync({ QueueName: topic })
      .catch(_ => null);
    const queue = data?.QueueUrl;
    if (queue) {
      this.sqsUrls[topic] = queue;
      return queue;
    }
    const params = {
      QueueName: topic,
      Attributes: {
        ReceiveMessageWaitTimeSeconds: this.config
          .receiveMessageWaitTimeSeconds,
        MessageRetentionPeriod: this.config.messageRetentionPeriod,
      },
    };
    const createResponse = await this.producer.createQueueAsync(params);
    this.sqsUrls[topic] = createResponse?.QueueUrl;
    return this.sqsUrls[topic];
  }

  getPayload(msg: any, topic: string): any {
    const context = getMeta(msg);

    const task = this.registry.getTask(topic);
    const attributes = task ? task.attributes : [];
    const messageAttributes = {
      Timestamp: {
        DataType: 'Number',
        StringValue: context.timestamp.toString(),
      },
    };
    if (attributes) {
      attributes.forEach(a => {
        messageAttributes[a.name] = {
          DataType: a.dataType || 'String',
          StringValue: a.value.toString(),
        };
      });
    }

    return {
      MessageAttributes: messageAttributes,
      MessageBody: JSON.stringify({ ...msg, _meta: context }),
      QueueUrl: this.sqsUrls[topic],
    };
  }

  async send<T = any>(topic: string, payload: T) {
    try {
      await this.initialize(topic);
    } catch (ex) {
      this.logger.error('Error in initalizing sqs', ex);
      throw ex;
    }

    const data = this.getPayload(payload, topic);

    try {
      const response = await this.producer.sendMessageAsync(data);
      this.logger.debug('SQS Publish Data', response);
      this.registry.events.emit('producer_success', topic, data);
    } catch (ex) {
      this.logger.error('Error while sending SQS payload', topic, ex);
      this.registry.events.emit('producer_failure', topic, ex, data);
      throw ex;
    }
  }
}

export default SqsProducer;
