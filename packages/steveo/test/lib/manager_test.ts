import { expect } from 'chai';
import { Steveo } from '../../src';
import { Manager } from '../../src/lib/manager';

describe('Manager', () => {
  describe('pause and resumes', () => {
    it('pauses', async () => {
      const steveo = new Steveo({ engine: 'dummy' as const });
      const manager = new Manager(steveo);
      await manager.pause();
      expect(manager.state).to.equal('paused');
    });

    it('resumes', async () => {
      const steveo = new Steveo({ engine: 'dummy' as const });
      const manager = new Manager(steveo);
      await manager.resume();
      expect(manager.state).to.equal('running');
    });
  });

  describe('shutdown', function () {
    this.timeout(10000);
    it('sets terminating state', async () => {
      const steveo = new Steveo({ engine: 'dummy' as const });
      const manager = new Manager(steveo);
      manager.shutdown();
      expect(manager.state).to.equal('terminating');
      manager.state = 'terminated';
      expect(manager.state).to.equal('terminated');
    });

    it('should terminate when consumers shut down', async () => {
      const steveo = new Steveo({ engine: 'dummy' as const });
      const manager = new Manager(steveo);
      await new Promise<void>((resolve) => {
        setTimeout(()=> {
          manager.terminate();
          resolve();
        }, 5000); // Terminate in 5 seconds
      });
      await manager.shutdown();
      expect(manager.shouldTerminate).to.equal(true);
      manager.state = 'terminated';
    });
  });
});
