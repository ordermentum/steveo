import { expect } from 'chai';
import { Op } from 'sequelize';
import { createLogger } from 'bunyan';
import moment from 'moment-timezone';
import { SinonStub, createSandbox, SinonSandbox, SinonFakeTimers } from 'sinon';
import * as maintenanceHelpers from '../src/maintenance';

describe('Maintenance task', () => {
  let maintenanceCallback: maintenanceHelpers.MaintenanceScheduler;
  let sandbox: SinonSandbox;
  let clock: SinonFakeTimers;
  let eventsStub: SinonStub;
  let scopeStub: SinonStub;
  let updateStub: SinonStub;
  let findAllStub: SinonStub;
  const jobsSafeToRestart = ['A'];
  const jobsRiskyToRestart = ['B'];
  const jobsCustomRestart = {
    D: moment.duration(15, 'minutes'),
  };
  let findPendingJobsStub: SinonStub;
  let logger: any;
  let JobStub: {
    scope: SinonStub<
      any,
      {
        update: SinonStub;
        findAll: SinonStub;
      }
    >;
  };

  beforeEach(() => {
    sandbox = createSandbox();
    clock = sandbox.useFakeTimers();
    findPendingJobsStub = sandbox.stub();
    eventsStub = sandbox.stub().resolves();
    updateStub = sandbox.stub();
    findAllStub = sandbox.stub();
    scopeStub = sandbox.stub().returns({
      update: updateStub,
      findAll: findAllStub,
    });
    
    // Create a minimal JobModel stub that satisfies the type requirements
    JobStub = Object.assign(
      function() {} as any,
      {
        scope: scopeStub,
        findAll: findPendingJobsStub,
        prototype: {},
        tableName: 'jobs',
        primaryKeyAttribute: 'id',
        primaryKeyAttributes: ['id'],
        associations: {},
        getTableName: () => 'jobs',
        // Add any other required Model static methods/properties
      }
    );
    
    logger = createLogger({ name: 'test' });
    // Add spies to logger
    logger.error = sandbox.spy(logger, 'error');
    logger.warn = sandbox.spy(logger, 'warn');
    logger.debug = sandbox.spy(logger, 'debug');
    
    const events = {
      emit: eventsStub
    };

    const MaintenanceScheduler = require('../src/maintenance').MaintenanceScheduler;
    maintenanceCallback = new MaintenanceScheduler(
      JobStub,
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

  it('handles basic maintenance flow correctly', async () => {
    updateStub.resolves();
    // Blocked jobs risky to restart
    findAllStub
      .withArgs({
        where: {
          name: jobsRiskyToRestart,
        },
      })
      .resolves(
        jobsRiskyToRestart.map(data => ({
          get: () => data,
          name: data,
          repeatInterval: 'FREQ=HOURLY;INTERVAL=1',
          update: sandbox.stub().resolves(),
        }))
      );

    const customLaggyJobs = jobsRiskyToRestart.map(data => ({
      get: () => data,
      name: data,
      repeatInterval: 'FREQ=HOURLY;INTERVAL=1',
      update: sandbox.stub().resolves(),
    }));
    customLaggyJobs.push({
      get: () => 'D',
      name: 'D',
      repeatInterval: 'FREQ=MINUTELY;INTERVAL=15',
      update: sandbox.stub().resolves(),
      //@ts-expect-error
      acceptedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    });

    // Laggy jobs
    findAllStub
      .withArgs({
        where: {
          name: {
            [Op.ne]: 'check',
          },
        },
      })
      .resolves(customLaggyJobs);
    findPendingJobsStub.resolves([{
      get: () => ({
        name: 'pending',
        count: '120'
      }),
      repeatInterval: 'FREQ=MINUTELY;INTERVAL=5',
      update: sandbox.stub().resolves(),
    }]);

    maintenanceCallback.start();
    
    // Fast-forward time to allow maintenance to run
    await clock.tickAsync(100);
    
    maintenanceCallback.stop();

    // Verify basic call counts
    expect(JobStub.scope.callCount).to.eql(4);
    expect(findPendingJobsStub.callCount).to.eql(1);
    expect(updateStub.callCount).to.eqls(2);

    // Restarts safe to restart blocked jobs
    expect(updateStub.args[0][0].lastFinishedAt).to.be.undefined;
    expect(updateStub.args[0][0].nextRunAt).to.not.be.undefined;
    expect(updateStub.args[0][0].queued).to.be.false;
    expect(updateStub.args[0][1]).to.eqls({
      where: {
        name: jobsSafeToRestart,
      },
    });

    // Restarts safe to restart laggy jobs
    expect(updateStub.args[1][0].lastFinishedAt).to.not.be.undefined;
    expect(updateStub.args[1][0].nextRunAt).to.not.be.undefined;
    expect(updateStub.args[1][0].queued).to.be.false;
    expect(updateStub.args[1][1]).to.eqls({
      where: {
        name: jobsSafeToRestart,
      },
    });

    // Events emitted in order:
    // 1. Pending jobs
    expect(eventsStub.args[0][0]).to.eqls('pending');
    expect(eventsStub.args[0][1]).to.eqls({
      pending: 120
    });

    // 2. Reset events for each blocked risky job
    expect(eventsStub.args[1][0]).to.eqls('reset');
    expect(eventsStub.args[1][1]).to.eqls('B');
    expect(eventsStub.args[1][2]).to.not.be.undefined; // nextRunAt

    // 3. Reset events for each laggy job
    expect(eventsStub.args[2][0]).to.eqls('reset');
    expect(eventsStub.args[2][1]).to.eqls('D');
    expect(eventsStub.args[2][2]).to.not.be.undefined; // nextRunAt

    expect(eventsStub.args[3][0]).to.eqls('lagged');
    expect(eventsStub.args[3][1]).to.eqls(['B']);
  });

  it('should handle maintenance loop with multiple iterations', async () => {
    updateStub.resolves();
    findAllStub.resolves([]);
    findPendingJobsStub.resolves([]);
    
    maintenanceCallback.start();
    
    // Fast-forward time to trigger multiple maintenance cycles
    await clock.tickAsync(65 * 1000); // First cycle
    await clock.tickAsync(65 * 1000); // Second cycle
    
    maintenanceCallback.stop();
    
    // Should have run maintenance at least twice
    expect(findPendingJobsStub.callCount).to.be.at.least(2);
  });

  it('should handle empty job lists', async () => {
    // No jobs to process
    findPendingJobsStub.resolves([]);
    findAllStub.resolves([]);
    
    maintenanceCallback.start();
    await clock.tickAsync(100);
    maintenanceCallback.stop();
    
    // Should still complete without errors
    expect(eventsStub.calledWith('pending', {})).to.be.true;
  });

  it('should handle errors during maintenance run', async () => {
    // Simulate an error during maintenance
    const testError = new Error('Test maintenance error');
    findPendingJobsStub.rejects(testError);
    
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
    expect(warnStub.firstCall.args[0].error).to.equal(testError);
    expect(warnStub.firstCall.args[1]).to.equal('Maintenance failed');
    
    // Reset the findPendingJobsStub for the next iteration
    findPendingJobsStub.reset();
    findPendingJobsStub.resolves([]);
    
    // Advance the clock to trigger the next scheduled maintenance
    await clock.tickAsync(60 * 1000);
    await clock.tickAsync(100); // Give a little extra time for the maintenance to run
    
    maintenanceCallback.stop();
    
    // Should try again
    expect(findPendingJobsStub.callCount).to.be.at.least(1);
  });

  it('should properly reset jobs with resetJob helper', async () => {
    // Create a job instance with a repeatInterval
    const jobInstance = {
      get: () => ({ id: 1, name: 'test-job' }),
      repeatInterval: 'FREQ=DAILY;INTERVAL=1',
      timezone: 'UTC',
      update: sandbox.stub().resolves()
    };
    
    const events = { emit: eventsStub };
    
    // Call resetJob directly
    await maintenanceHelpers.resetJob(jobInstance as any, events as any);
    
    // Should have updated the job with new nextRunAt and queued=false
    expect(jobInstance.update.calledOnce).to.be.true;
    expect(jobInstance.update.firstCall.args[0].queued).to.be.false;
    expect(jobInstance.update.firstCall.args[0].nextRunAt).to.not.be.undefined;
    
    // Should have emitted a reset event
    expect(eventsStub.calledWith('reset')).to.be.true;
  });

  it('should not reset jobs without repeatInterval', async () => {
    // Create a job instance without a repeatInterval
    const jobInstance = {
      get: () => ({ id: 1, name: 'one-time-job' }),
      repeatInterval: null,
      update: sandbox.stub().resolves()
    };
    
    const events = { emit: eventsStub };
    
    // Call resetJob directly
    await maintenanceHelpers.resetJob(jobInstance as any, events as any);
    
    // Should not have updated the job or emitted events
    expect(jobInstance.update.called).to.be.false;
    expect(eventsStub.called).to.be.false;
  });

  it('should adjust interval timing based on execution duration', async () => {
    // Create a slow execution to test interval adjustment
    findPendingJobsStub.callsFake(async () => {
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
    
    // Should have run maintenance twice
    expect(findPendingJobsStub.callCount).to.equal(2);
  });
});
