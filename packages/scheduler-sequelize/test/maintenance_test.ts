import { expect } from 'chai';
import { Op } from 'sequelize';
import { createLogger } from 'bunyan';
import moment from 'moment-timezone';
import { SinonStub, createSandbox, SinonSandbox } from 'sinon';
import * as maintenanceHelpers from '../src/maintenance';

describe('Maintenance task', () => {
  let maintenanceCallback: maintenanceHelpers.MaintenanceScheduler;
  let sandbox: SinonSandbox;
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
    
    const logger = createLogger({ name: 'test' });
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

  it('Works', async () => {
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
    
    // Wait a small amount of time for the maintenance to run
    await new Promise(resolve => setTimeout(resolve, 100));
    
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
});
