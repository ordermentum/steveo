import { expect } from 'chai';
import sinon from 'sinon';
import Steveo, { decorate } from '../src';

describe('Index', () => {
  it('should check steveo import', () => {
    expect(typeof Steveo).to.equal('function');
  });

  it('should create task', () => {
    const steveo = new Steveo({}, console);
    expect(typeof steveo).to.equal('object');
    expect(typeof steveo.task).to.equal('function');
    const task = steveo.task();
    expect(typeof task).to.equal('object');
    expect(typeof steveo.metric).to.equal('object');
  });

  it('should create runner', () => {
    const steveo = new Steveo({ engine: 'sqs' }, console);
    expect(typeof steveo).to.equal('object');
    expect(typeof steveo.runner).to.equal('function');
    const runner = steveo.runner();
    expect(typeof runner).to.equal('object');
  });

  it('should decorate a task', () => {
    const handler = () => {};
    handler.taskName = 'TEST';
    const task = decorate(handler);
    expect(task.task).to.not.equal(undefined);
    expect(task.publish).to.not.equal(undefined);
    expect(task.subscribe).to.not.equal(undefined);
  });
});
