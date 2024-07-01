import nullLogger from 'null-logger';
import { SQS } from 'aws-sdk';
import util from 'util';
import { CreateQueueRequest, QueueAttributeMap } from 'aws-sdk/clients/sqs';
import { getSqsInstance } from '../config/sqs';

import {
  Logger,
  IProducer,
  IRegistry,
  sqsUrls,
  SQSConfiguration,
} from '../common';

import { createMessageMetadata } from '../lib/context';
import { BaseProducer } from './base';

class SqsProducer extends BaseProducer implements IProducer {
  config: SQSConfiguration;

  registry: IRegistry;

  logger: Logger;

  producer: SQS;

  sqsUrls: sqsUrls;

  constructor(
    config: SQSConfiguration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    super(config.middleware ?? []);
    this.config = config;
    this.producer = getSqsInstance(config);
    this.logger = logger;
    this.registry = registry;
    this.sqsUrls = {};
  }

  async initialize(topic: string): Promise<string> {
    this.logger.debug(`Initializing topic: ${topic}`);

    if (!topic) {
      throw new Error('Topic cannot be empty');
    }

    let queueName = topic;

    // task options
    const task = this.registry.getTask(topic);
    const fifo = !!task?.options?.fifo;

    const fifoAttributes: {
      FifoQueue?: string;
      ContentBasedDeduplication?: string;
    } = {};

    if (fifo) {
      queueName = `${queueName}.fifo`;
      fifoAttributes.FifoQueue = 'true';
      fifoAttributes.ContentBasedDeduplication = 'true';
    }

    const getQueueUrlResult = await this.producer
      .getQueueUrl({ QueueName: queueName })
      .promise()
      .catch(_ => undefined);

    const queueUrl = getQueueUrlResult?.QueueUrl;

    if (queueUrl) {
      this.sqsUrls[queueName] = queueUrl;
      return queueUrl;
    }

    const params: CreateQueueRequest = {
      QueueName: queueName,
      Attributes: {
        ReceiveMessageWaitTimeSeconds:
          this.config.receiveMessageWaitTimeSeconds ?? '20',
        MessageRetentionPeriod: this.config.messageRetentionPeriod ?? '604800',
        ...fifoAttributes,
      },
    };

    // Check if queue supports DLQ on the task config
    const redrivePolicy: QueueAttributeMap | null =
      await this.getDeadLetterQueuePolicy(queueName);

    // Append RedrivePolicy if supported
    if (redrivePolicy) {
      params.Attributes = {
        ...params.Attributes,
        RedrivePolicy: JSON.stringify(redrivePolicy),
      };
    }

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

    this.sqsUrls[queueName] = res.QueueUrl;
    return res.QueueUrl;
  }

  async getDeadLetterQueuePolicy(
    queueName: string
  ): Promise<QueueAttributeMap | null> {
    const task = this.registry.getTask(queueName);

    if (!task?.options?.deadLetterQueue) {
      return null;
    }

    const dlQueueName = `${queueName}_DLQ`;
    // try to fetch if there is an existing queueURL for QLQ
    const queueResult = await this.producer
      .getQueueUrl({ QueueName: dlQueueName })
      .promise()
      .catch(_ => undefined);

    let dlQueueUrl = queueResult?.QueueUrl;

    // if we don't have existing DLQ, create one
    if (!dlQueueUrl) {
      const params = {
        QueueName: dlQueueName,
        Attributes: {
          ReceiveMessageWaitTimeSeconds:
            this.config.receiveMessageWaitTimeSeconds ?? '20',
          MessageRetentionPeriod:
            this.config.messageRetentionPeriod ?? '604800',
        },
      };

      this.logger.debug(
        `Creating DLQ for orginal queue ${queueName}`,
        util.inspect(params)
      );

      const res = await this.producer
        .createQueue(params)
        .promise()
        .catch(err => {
          throw new Error(`Failed to call SQS createQueue: ${err}`);
        });

      if (!res.QueueUrl) {
        throw new Error(
          'SQS createQueue response does not contain a queue name'
        );
      }

      dlQueueUrl = res.QueueUrl;
    }

    // get the ARN of the DQL
    const getQueueAttributesParams = {
      QueueUrl: dlQueueUrl,
      AttributeNames: ['QueueArn'],
    };

    const attributesResult = await this.producer
      .getQueueAttributes(getQueueAttributesParams)
      .promise()
      .catch(err => {
        throw new Error(`Failed to call SQS getQueueAttributes: ${err}`);
      });

    const dlQueueArn = attributesResult.Attributes?.QueueArn;

    if (!dlQueueArn) {
      throw new Error('Failed to retrieve the DLQ ARN');
    }

    return {
      deadLetterTargetArn: dlQueueArn,
      maxReceiveCount: (task?.options.maxReceiveCount ?? 5).toString(),
    };
  }

  getPayload(
    msg: any,
    topic: string,
    key?: string
  ): {
    MessageAttributes: any;
    MessageBody: string;
    QueueUrl: string;
    MessageGroupId?: string;
  } {
    const context = createMessageMetadata(msg);

    const task = this.registry.getTask(topic);
    const attributes = task ? task.options.attributes : [];
    const messageAttributes = {
      Timestamp: {
        DataType: 'Number',
        StringValue: context.timestamp.toString(),
      },
    };
    if (attributes) {
      for (const a of attributes) {
        messageAttributes[a.name] = {
          DataType: a.dataType || 'String',
          StringValue: a.value.toString(),
        };
      }
    }

    const fifo = !!task?.options?.fifo;

    const sqsTopic = fifo ? `${topic}.fifo` : topic;

    return {
      MessageAttributes: messageAttributes,
      MessageBody: JSON.stringify({ ...msg, _meta: context }),
      QueueUrl: this.sqsUrls[sqsTopic],
      MessageGroupId: fifo && key ? key : undefined,
    };
  }

  async send<T = any>(topic: string, payload: T, key?: string) {
    try {
      await this.wrap({ topic, payload }, async c => {
        if (!this.sqsUrls[c.topic]) {
          await this.initialize(c.topic);
        }
        const data = this.getPayload(c.payload, c.topic, key);
        await this.producer.sendMessage(data).promise();
        this.registry.emit('producer_success', c.topic, data);
      });
    } catch (ex) {
      this.logger.error('Error while sending Payload', topic, ex);
      this.registry.emit('producer_failure', topic, ex, payload);
      throw ex;
    }
  }
}

export default SqsProducer;
