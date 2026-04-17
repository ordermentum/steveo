// @ts-nocheck
import { expect } from 'chai';
import Config from '../../src/config';

describe('Config', () => {
  it('default values', () => {
    const config = Config({
      engine: 'kafka',
      bootstrapServers: 'kakfa://kafka:9200',
    });
    expect(config.engine).to.eqls('kafka');
    // expect(config.bootstrapServers).to.eqls('kafka://kafka:9200');
    expect(config.consumer.topic).to.eqls({ 'auto.offset.reset': 'latest' });
    expect(config.consumer.global).to.eqls({
      'socket.keepalive.enable': true,
      'enable.auto.commit': false,
      'group.id': 'KAFKA_CONSUMERS',
    });
    expect(config.producer).to.eqls({ global: {}, topic: {} });
    expect(config.admin).to.eqls({});
    expect(config.defaultTopicPartitions).to.eqls(6);
    expect(config.defaultTopicReplicationFactor).to.eqls(3);
  });

  it('sets the values', () => {
    const config = Config({
      engine: 'kafka',
      bootstrapServers: 'kakfa://kafka:9200',
      consumer: {
        global: {
          a: 1,
          'group.id': 'TEST_CONSUMERS',
        },
        topic: {
          b: 1,
        },
      },
      producer: {
        global: {
          a: 1,
        },
        topic: {
          b: 1,
        },
      },
      defaultTopicPartitions: 10,
    });
    expect(config.engine).to.eqls('kafka');
    // expect(config.bootstrapServers).to.eqls('kafka://kafka:9200');
    expect(config.consumer.topic).to.eqls({
      'auto.offset.reset': 'latest',
      b: 1,
    });
    expect(config.consumer.global).to.eqls({
      'socket.keepalive.enable': true,
      'enable.auto.commit': false,
      'group.id': 'TEST_CONSUMERS',
      a: 1,
    });
    expect(config.producer).to.eqls({
      global: {
        a: 1,
      },
      topic: {
        b: 1,
      },
    });
    expect(config.admin).to.eqls({});
    expect(config.defaultTopicPartitions).to.eqls(10);
    expect(config.defaultTopicReplicationFactor).to.eqls(3);
  });

  it('checks engine values', () => {
    const config = Config({
      bootstrapServers: 'kakfa://kafka:9200',
      engine: 'sqs',
    });
    expect(config.engine).to.equal('sqs');
    expect(config.bootstrapServers).to.equal(undefined);
  });

  describe('queuePrefix', () => {
    afterEach(() => {
      delete process.env.QUEUE_PREFIX;
    });

    it('uses config.queuePrefix when QUEUE_PREFIX env var is not set', () => {
      const config = Config({
        engine: 'sqs',
        queuePrefix: 'testing',
      });
      expect(config.queuePrefix).to.equal('testing');
    });

    it('defaults to empty string when neither env var nor config is set', () => {
      const config = Config({
        engine: 'sqs',
      });
      expect(config.queuePrefix).to.equal('');
    });

    it('QUEUE_PREFIX env var overrides config.queuePrefix', () => {
      process.env.QUEUE_PREFIX = 'sit';
      const config = Config({
        engine: 'sqs',
        queuePrefix: 'testing',
      });
      expect(config.queuePrefix).to.equal('sit');
    });

    it('QUEUE_PREFIX env var is used when config.queuePrefix is not set', () => {
      process.env.QUEUE_PREFIX = 'sit';
      const config = Config({
        engine: 'sqs',
      });
      expect(config.queuePrefix).to.equal('sit');
    });
  });

  describe('CONSUMER_GROUP_PREFIX', () => {
    afterEach(() => {
      delete process.env.CONSUMER_GROUP_PREFIX;
    });

    it('does not modify group.id when env var is not set', () => {
      const config = Config({
        engine: 'kafka',
        bootstrapServers: 'kafka://kafka:9200',
        consumer: {
          global: { 'group.id': 'CREDITS_CONSUMERS' },
          topic: {},
        },
      });
      expect(config.consumer.global['group.id']).to.equal('CREDITS_CONSUMERS');
    });

    it('prefixes group.id with CONSUMER_GROUP_PREFIX when set', () => {
      process.env.CONSUMER_GROUP_PREFIX = 'SIT';
      const config = Config({
        engine: 'kafka',
        bootstrapServers: 'kafka://kafka:9200',
        consumer: {
          global: { 'group.id': 'CREDITS_CONSUMERS' },
          topic: {},
        },
      });
      expect(config.consumer.global['group.id']).to.equal('SIT_CREDITS_CONSUMERS');
    });

    it('prefixes default group.id when no consumer config provided', () => {
      process.env.CONSUMER_GROUP_PREFIX = 'SIT';
      const config = Config({
        engine: 'kafka',
        bootstrapServers: 'kafka://kafka:9200',
      });
      expect(config.consumer.global['group.id']).to.equal('SIT_KAFKA_CONSUMERS');
    });

    it('does not affect SQS config', () => {
      process.env.CONSUMER_GROUP_PREFIX = 'SIT';
      const config = Config({
        engine: 'sqs',
      });
      expect(config.consumer).to.be.undefined;
    });
  });

  describe('healthCheckTimeout', () => {
    it('passes through healthCheckTimeout when provided', () => {
      const config = Config({
        engine: 'kafka',
        bootstrapServers: 'kafka://kafka:9200',
        healthCheckTimeout: 5000,
      });
      expect(config.healthCheckTimeout).to.equal(5000);
    });

    it('does not set healthCheckTimeout when not provided', () => {
      const config = Config({
        engine: 'kafka',
        bootstrapServers: 'kafka://kafka:9200',
      });
      expect(config.healthCheckTimeout).to.be.undefined;
    });
  });
});
