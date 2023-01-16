import nullLogger from "null-logger";
import { SQS } from "aws-sdk";
import type newrelic from "newrelic";
import { getSqsInstance } from "../config/sqs";

import {
  Configuration,
  Logger,
  IProducer,
  IRegistry,
  sqsUrls,
  SQSConfiguration,
} from "../common";

import { createMessageMetadata } from "./utils/createMessageMetadata";

class SqsProducer implements IProducer {
  config: Configuration;

  registry: IRegistry;

  logger: Logger;

  producer: SQS;

  sqsUrls: sqsUrls;

  _newrelic?: any;

  constructor(
    config: Configuration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    this.config = config;
    this.producer = getSqsInstance(config);
    this.logger = logger;
    this.registry = registry;
    this.sqsUrls = {};
    this._newrelic = config.traceConfiguration.newrelic;
  }

  async initialize(topic?: string) {
    if (!topic) {
      throw new Error("Topic cannot be empty");
    }

    const config = this.config as SQSConfiguration;

    const data = await this.producer
      .getQueueUrl({ QueueName: topic })
      .promise()
      .catch();

    const queue = data?.QueueUrl;

    if (queue) {
      this.sqsUrls[topic] = queue;
      return queue;
    }
    const params = {
      QueueName: topic,
      Attributes: {
        ReceiveMessageWaitTimeSeconds: config.receiveMessageWaitTimeSeconds,
        MessageRetentionPeriod: config.messageRetentionPeriod,
      },
    };
    const createResponse = await this.producer.createQueue(params).promise();
    this.sqsUrls[topic] = createResponse?.QueueUrl;
    return this.sqsUrls[topic];
  }

  // Why does the _producer_ have a get payload fn??
  getPayload(
    msg: any,
    topic: string,
    transaction?: newrelic.TransactionHandle
  ): any {
    const context = createMessageMetadata(msg, transaction);

    const task = this.registry.getTask(topic);
    const attributes = task ? task.attributes : [];
    const messageAttributes = {
      Timestamp: {
        DataType: "Number",
        StringValue: context.timestamp.toString(),
      },
    };
    if (attributes) {
      attributes.forEach((a) => {
        messageAttributes[a.name] = {
          DataType: a.dataType || "String",
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
    this._newrelic?.startBackgroundTransaction(`${topic}-publish`, async () => {
      try {
        await this.initialize(topic);
      } catch (ex) {
        this._newrelic?.noticeError(ex as Error);
        this.logger.error("Error in initalizing sqs", ex);
        throw ex;
      }

      const transaction = this._newrelic?.getTransaction();
      const data = this.getPayload(payload, topic, transaction);

      try {
        const response = await this.producer.sendMessage(data).promise();
        this.logger.debug("SQS Publish Data", response);
        this.registry.emit("producer_success", topic, data);
      } catch (ex) {
        this._newrelic?.noticeError(ex as Error);
        this.logger.error("Error while sending SQS payload", topic, ex);
        this.registry.emit("producer_failure", topic, ex, data);
        throw ex;
      }
    });
  }

  async disconnect() {}

  async reconnect() {}
}

export default SqsProducer;
