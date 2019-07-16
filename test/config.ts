import { expect } from 'chai';
import Config from '../src/config';

describe('Config', () => {
  it('default values', () => {
    const config = new Config({
      kafkaConnection: 'kakfa://kafka:9200',
      clientId: 'test',
    });
    expect(config.logLevel).to.equal(5);
    expect(config.kafkaSendAttempts).to.equal(2);
    expect(config.kafkaGroupId).to.equal('STEVEO_TASKS');
    expect(config.kafkaSendDelayMin).to.equal(100);
    expect(config.kafkaSendDelayMax).to.equal(300);
  });

  it('sets values', () => {
    const config = new Config({
      kafkaConnection: 'kakfa://kafka:9200',
      clientId: 'test',
      kafkaGroupId: 'test',
      logLevel: 4,
      kafkaSendAttempts: 5,
      kafkaSendDelayMin: 200,
      kafkaSendDelayMax: 500,
    });
    expect(config.logLevel).to.equal(4);
    expect(config.kafkaGroupId).to.equal('test');
    expect(config.kafkaSendAttempts).to.equal(5);
    expect(config.kafkaSendDelayMin).to.equal(200);
    expect(config.kafkaSendDelayMax).to.equal(500);
  });

  it('checks engine values', () => {
    const config = new Config({
      kafkaConnection: 'kakfa://kafka:9200',
      clientId: 'test',
      kafkaGroupId: 'test',
      engine: 'sqs',
    });
    expect(config.engine).to.equal('sqs');
    expect(config.kafkaConnection).to.equal(undefined);
  });
});
