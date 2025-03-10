import { expect } from 'chai';
import { createLogger } from 'bunyan';
import moment from 'moment-timezone';
import { SinonStub, createSandbox, SinonSandbox, SinonFakeTimers } from 'sinon';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { MaintenanceScheduler } from '../src/maintenance';

describe('Maintenance task', async () => {
  let maintenanceCallback: MaintenanceScheduler;
  let sandbox: SinonSandbox;
  let clock: SinonFakeTimers;
  let eventsStub: SinonStub;
  let queryStub: SinonStub;
  let updateStub: SinonStub;
  let updateManyStub: SinonStub;
  const jobsSafeToRestart = ['A', 'C', 'E', 'G', 'I', 'J'];
  const jobsRiskyToRestart = ['B', 'D', 'F', 'H'];
  const jobsCustomRestart = {
    // Simulate custom restart jobs
    I: moment.duration(-15, 'minutes'),
    J: moment.duration(-15, 'minutes'),
  };
  let logger: any;
  let client: any;

  beforeEach(() => {
    sandbox = createSandbox();
    clock = sandbox.useFakeTimers();
    updateManyStub = sandbox.stub().resolves();
    updateStub = sandbox.stub().resolves();
    eventsStub = sandbox.stub().resolves();
    queryStub = sandbox.stub().resolves();

    // Create a mock PrismaClient with required methods
    client = {
      $queryRaw: queryStub,
      job: {
        updateMany: updateManyStub,
        update: updateStub,
      },
      $connect: () => Promise.resolve(),
      $disconnect: () => Promise.resolve(),
      $on: () => {},
      $use: () => {},
      $transaction: () => Promise.resolve(),
    } as unknown as PrismaClient;
    
    // Create a proper EventEmitter mock
    const events = new EventEmitter();
    events.emit = eventsStub;
    
    logger = createLogger({ name: 'test' });
    // Add spies to logger
    logger.error = sandbox.spy(logger, 'error');
    logger.warn = sandbox.spy(logger, 'warn');
    logger.debug = sandbox.spy(logger, 'debug');
    
    maintenanceCallback = new MaintenanceScheduler(
      client,
      logger,
      jobsSafeToRestart,
      jobsCustomRestart, 
      jobsRiskyToRestart,
      events
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Works', async () => {
    const customLaggyJobs = jobsRiskyToRestart.map(data => ({
      get: () => data,
      name: data,
      repeatInterval: 'FREQ=HOURLY;INTERVAL=1'
    }));
    customLaggyJobs.push({
      get: () => 'D',
      name: 'D',
      repeatInterval: 'FREQ=MINUTELY;INTERVAL=15'
    });

    queryStub.onCall(0).resolves([
      { id: 10, name: 'A', repeatInterval: 'FREQ=MINUTELY;INTERVAL=5', count: 1 }, 
      { id: 9, name: 'B', repeatInterval: 'FREQ=MINUTELY;INTERVAL=5', count: 1 }
    ]);
    queryStub.onCall(1).resolves([
      { id: 2, name: 'C', repeatInterval: 'FREQ=HOURLY;INTERVAL=1' }, 
      { id: 5, name: 'D', repeatInterval: 'FREQ=HOURLY;INTERVAL=1' }
    ]);
    queryStub.onCall(2).resolves([
      { id: 2, name: 'E', repeatInterval: 'FREQ=HOURLY;INTERVAL=1' }, 
      { id: 5, name: 'F', repeatInterval: 'FREQ=HOURLY;INTERVAL=1' }
    ]);
    queryStub.onCall(3).resolves([
      { id: 3, name: 'G', repeatInterval: 'FREQ=HOURLY;INTERVAL=1' }, 
      { id: 4, name: 'H', repeatInterval: 'FREQ=MINUTELY;INTERVAL=15' }
    ]);

    queryStub.onCall(4).resolves([
      { id: 3, name: 'I', repeatInterval: 'FREQ=HOURLY;INTERVAL=1' }, 
      { id: 4, name: 'J', repeatInterval: 'FREQ=MINUTELY;INTERVAL=15' }
    ]);

    maintenanceCallback.start();
    
    // Fast-forward time to allow maintenance to run
    await clock.tickAsync(100);
    
    maintenanceCallback.stop();

    // Update expectation to match our two events (pending and reset)
    expect(eventsStub.callCount).to.equal(4);
    
    // Verify 'pending' event
    expect(eventsStub.firstCall.args[0]).to.equal('pending');
    expect(eventsStub.firstCall.args[1]).to.deep.equal({
      'A': 1,
      'B': 1,
    });
    
    // Verify 'reset' event
    expect(eventsStub.secondCall.args[0]).to.equal('reset');
    expect(eventsStub.secondCall.args[1].id).to.equal(2);
    expect(eventsStub.secondCall.args[2]).to.not.be.undefined;
    expect(eventsStub.thirdCall.args[0]).to.equal('reset');
    expect(eventsStub.thirdCall.args[1].id).to.equal(5);
    expect(eventsStub.thirdCall.args[2]).to.not.be.undefined;

    expect(eventsStub.getCalls()[3].args[0]).to.equal('lagged');
    expect(eventsStub.getCalls()[3].args[1].map(j => j.name)).to.eqls(['I', 'J']);
    expect(updateStub.callCount).to.eql(2);
    expect(updateManyStub.callCount).to.eql(2);
  });

  it('should handle maintenance loop with multiple iterations', async () => {
    queryStub.resolves([]);
    
    maintenanceCallback.start();
    
    // Fast-forward time to trigger multiple maintenance cycles
    await clock.tickAsync(65 * 1000); // First cycle
    await clock.tickAsync(65 * 1000); // Second cycle
    
    maintenanceCallback.stop();
    
    // Should have run maintenance at least twice
    expect(queryStub.callCount).to.be.at.least(2);
  });

  it('should handle empty job lists', async () => {
    // No jobs to process
    queryStub.resolves([]);
    
    maintenanceCallback.start();
    await clock.tickAsync(100);
    maintenanceCallback.stop();
    
    // Should still complete without errors
    expect(eventsStub.calledWith('pending', {})).to.be.true;
  });

  it('should handle errors during maintenance run', async () => {
    // Simulate an error during maintenance
    const testError = new Error('Test maintenance error');
    queryStub.rejects(testError);
    
    // Replace logger.warn with a stub that we can test more easily
    const warnStub = sandbox.stub();
    const originalWarn = logger.warn;
    logger.warn = warnStub;
    
    maintenanceCallback.start();
    await clock.tickAsync(100);
    
    // Restore the original warn method
    logger.warn = originalWarn;
    
    // Should have logged the error
    expect(warnStub.calledOnce).to.be.true;
    expect(warnStub.firstCall.args[0].err || warnStub.firstCall.args[0].error).to.equal(testError);
    expect(warnStub.firstCall.args[1]).to.equal('Maintenance failed');
    
    // Reset the queryStub for the next iteration
    queryStub.reset();
    queryStub.resolves([]);
    
    // Advance the clock to trigger the next scheduled maintenance
    await clock.tickAsync(60 * 1000);
    await clock.tickAsync(100); // Give a little extra time for the maintenance to run
    
    maintenanceCallback.stop();
    
    // Should try again
    expect(queryStub.callCount).to.be.at.least(1);
  });

  it('should properly reset jobs with resetJob helper', async () => {
    // Create a job instance with a repeatInterval
    const jobInstance = {
      id: 1,
      name: 'test-job',
      repeatInterval: 'FREQ=DAILY;INTERVAL=1',
      timezone: 'UTC'
    };
        
    // Call resetJob directly if available, otherwise test through updateStub
    updateStub.resolves(jobInstance);
    
    // Test through maintenanceCallback functionality
    queryStub.resolves([jobInstance]);
    
    maintenanceCallback.start();
    await clock.tickAsync(100);
    maintenanceCallback.stop();
    
    // Should have emitted a reset event
    const resetCallIndex = eventsStub.args.findIndex(args => args[0] === 'reset');
    expect(resetCallIndex).to.be.greaterThan(-1);
    expect(eventsStub.args[resetCallIndex][1]).to.deep.include({ id: 1 });
  });

  it('should not reset jobs without repeatInterval', async () => {
    // Create a job instance without a repeatInterval
    const jobInstance = {
      id: 1, 
      name: 'one-time-job',
      repeatInterval: null
    };
    
    // Test through maintenanceCallback functionality
    queryStub.resolves([jobInstance]);
    
    const emitCallCountBefore = eventsStub.callCount;
    
    maintenanceCallback.start();
    await clock.tickAsync(100);
    maintenanceCallback.stop();
    
    // Should not have reset the job
    expect(updateStub.args.every(args => args[0] !== 1)).to.be.true;
    
    // There should be no extra 'reset' events
    const resetCalls = eventsStub.args
      .slice(emitCallCountBefore)
      .filter(args => args[0] === 'reset' && args[1].id === 1);
    expect(resetCalls.length).to.equal(0);
  });

  it('should adjust interval timing based on execution duration', async () => {
    // Create a slow execution to test interval adjustment
    queryStub.callsFake(async () => {
      // Simulate slow execution
      await new Promise(resolve => setTimeout(resolve, 200));
      return [];
    });
    
    maintenanceCallback.start();
    
    // Fast-forward time to include the execution delay
    await clock.tickAsync(300);
    
    // The next scheduled interval should be adjusted to maintain proper timing
    await clock.tickAsync(60 * 1000 - 200); // Should trigger the next maintenance
    
    maintenanceCallback.stop();

    
    // Should have run maintenance six times
    expect(queryStub.callCount).to.equal(6);
  });
});
