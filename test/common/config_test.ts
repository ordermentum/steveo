//@ts-nocheck
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
    expect(config.consumer.topic).to.eqls({ 'auto.offset.reset': 'earliest' });
    expect(config.consumer.global).to.eqls({
      'socket.keepalive.enable': true,
      'enable.auto.commit': false,
      'group.id': 'KAFKA_CONSUMERS'
    });
    expect(config.producer).to.eqls({ global: {}, topic: {} });
    expect(config.admin).to.eqls({});
    expect(config.defaultTopicParitions).to.eqls(6);
    expect(config.defaultTopicReplicationFactor).to.eqls(3);
  });

  it('sets the values', () => {
    const config = Config({
      engine: 'kafka',
      bootstrapServers: 'kakfa://kafka:9200',
      consumer: {
        global: {
          a: 1,
          'group.id': 'TEST_CONSUMERS'
        },
        topic: {
          b: 1
        }
      },
      producer: {
        global: {
          a: 1,
        },
        topic: {
          b: 1
        }
      },
      defaultTopicParitions: 10
    });
    expect(config.engine).to.eqls('kafka');
    // expect(config.bootstrapServers).to.eqls('kafka://kafka:9200');
    expect(config.consumer.topic).to.eqls({ 'auto.offset.reset': 'earliest', b: 1 });
    expect(config.consumer.global).to.eqls({
      'socket.keepalive.enable': true,
      'enable.auto.commit': false,
      'group.id': 'TEST_CONSUMERS',
      a: 1
    });
    expect(config.producer).to.eqls({
      global: {
        a: 1,
      },
      topic: {
        b: 1
      }
    });
    expect(config.admin).to.eqls({});
    expect(config.defaultTopicParitions).to.eqls(10);
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
});
