import { expect } from 'chai';
import Steveo from '../src';

describe('Index', () => {
  it('should check steveo import', () => {
    expect(typeof Steveo).to.equal('function');
  });

  it('should create task', () => {
    const steveo = Steveo({}, console);
    expect(typeof steveo).to.equal('object');
    expect(typeof steveo.task).to.equal('function');
    const task = steveo.task();
    expect(typeof task).to.equal('object');
    expect(typeof steveo.lag).to.equal('function');
  });

  it('should create runner', () => {
    const steveo = Steveo({}, console);
    expect(typeof steveo).to.equal('object');
    expect(typeof steveo.runner).to.equal('function');
    const runner = steveo.runner();
    expect(typeof runner).to.equal('object');
  });
});
