import { expect } from 'chai';
import Steveo from '../src';

describe('Index', () => {
  it('should check steveo import', () => {
    expect(typeof Steveo).to.equal('function');
  });

  it('should create task', () => {
    const steveo = Steveo('dev', '127.0.0.1');
    expect(typeof steveo).to.equal('object');
    expect(typeof steveo.task).to.equal('object');
  });
});
