import nullLogger from 'null-logger';
import { SQS } from 'aws-sdk';
import util from 'util';
import { getSqsInstance } from '../config/sqs';

import {
  Logger,
  IProducer,
  IRegistry,
  sqsUrls,
  SQSConfiguration,
  Middleware,
} from '../common';

import { createMessageMetadata } from '../lib/context';
import { BaseProducer } from './base';

class SqsProducer extends BaseProducer implements IProducer {
  config: SQSConfiguration;

  registry: IRegistry;

  logger: Logger;

  producer: SQS;

  sqsUrls: sqsUrls;

  middleware: Middleware[];

  constructor(
    config: SQSConfiguration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    super([]);
    this.config = config;
    this.producer = getSqsInstance(config);
    this.logger = logger;
    this.registry = registry;
    this.middleware = [];
    this.sqsUrls = {};
  }

  async initialize(topic: string): Promise<string> {
    this.logger.debug(`Initializing topic: ${topic}`);
    if (!topic) {
      throw new Error('Topic cannot be empty');
    }

    this.logger.debug(`calling producer: ${topic}`);
    const getQueueUrlResult = await this.producer
      .getQueueUrl({ QueueName: topic })
      .promise()
      .catch(_ => undefined);
    const queueUrl = getQueueUrlResult?.QueueUrl;

    if (queueUrl) {
      this.sqsUrls[topic] = queueUrl;
      return queueUrl;
    }

    const params = {
      QueueName: topic,
      Attributes: {
        ReceiveMessageWaitTimeSeconds:
          this.config.receiveMessageWaitTimeSeconds ?? '20',
        MessageRetentionPeriod: this.config.messageRetentionPeriod ?? '604800',
      },
    };
    this.logger.debug(`Creating queue`, util.inspect(params));
    const res = await this.producer
      .createQueue(params)
      .promise()
      .catch(err => {
        throw new Error(`Failed to call SQS createQueue: ${err}`);
      });
    if (!res.QueueUrl) {
      throw new Error('SQS createQueue response does not contain a queue name');
    }
    this.sqsUrls[topic] = res.QueueUrl;
    return res.QueueUrl;
  }

  getPayload(
    msg: any,
    topic: string
  ): {
    MessageAttributes: any;
    MessageBody: string;
    QueueUrl: string;
  } {
    const context = createMessageMetadata(msg);

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
      await this.wrap(topic, payload, async (t, d) => {
        if (!this.sqsUrls[t]) {
          await this.initialize(t);
        }
        const data = this.getPayload(d, t);
        await this.producer.sendMessage(data).promise();
        this.registry.emit('producer_success', t, data);
      });
    } catch (ex) {
      this.logger.error('Error while sending Payload', topic, ex);
      this.registry.emit('producer_failure', topic, ex, payload);
      throw ex;
    }
  }
}

export default SqsProducer;
