import { expect } from 'chai';
import sinon from 'sinon';
import Steveo from '../src';

describe('Index', () => {
  it('should check steveo import', () => {
    expect(typeof Steveo).to.equal('function');
  });

  it('should create task', () => {
    const steveo = Steveo({})();
    expect(typeof steveo).to.equal('object');
    expect(typeof steveo.task).to.equal('function');
    const task = steveo.task();
    expect(typeof task).to.equal('object');
    expect(typeof steveo.metric).to.equal('object');
  });

  it('should create runner', () => {
    const steveo = Steveo({ engine: 'sqs' })();
    expect(typeof steveo).to.equal('object');
    expect(typeof steveo.runner).to.equal('function');
    const runner = steveo.runner();
    expect(typeof runner).to.equal('object');
  });

  it('should accept callback for customizing topic name', () => {
    const steveo = Steveo({})();
    const topicNameStub = sinon.stub();
    steveo.customTopicName(topicNameStub);
    steveo.task('A_BIG_TOPIC', () => {});
    expect(topicNameStub.callCount).to.equal(1);
  });
});
