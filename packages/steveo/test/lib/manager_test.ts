import { expect } from 'chai';
import { Steveo } from '../../src';
import { Manager } from '../../src/lib/manager';

describe('Manager', () => {
  describe('pause and resumes', () => {
    it('pauses', () => {
      //@ts-expect-error
      const steveo = new Steveo({ engine: 'sqs' as const });
      const manager = new Manager(steveo);
      manager.pause();
      expect(manager.state).to.equal('paused');
    });

    it('resumes', () => {
      //@ts-expect-error
      const steveo = new Steveo({ engine: 'sqs' as const });
      const manager = new Manager(steveo);
      manager.resume();
      expect(manager.state).to.equal('running');
    });
  });

  describe('shutdown', () => {
    it('sets terminating state', () => {
      //@ts-expect-error
      const steveo = new Steveo({ engine: 'sqs' as const });
      const manager = new Manager(steveo);
      manager.shutdown();
      expect(manager.state).to.equal('terminating');
      manager.state = 'terminated';
      expect(manager.state).to.equal('terminated');
    });

    it('shouldTerminate', () => {
      //@ts-expect-error
      const steveo = new Steveo({ engine: 'sqs' as const });
      const manager = new Manager(steveo);
      manager.shutdown();
      expect(manager.shouldTerminate).to.equal(true);
      manager.state = 'terminated';
    });
  });
});
