import { expect } from 'chai';
import { Op } from 'sequelize';
import { createLogger } from 'bunyan';
import moment from 'moment-timezone';
import { SinonStub, createSandbox, SinonSandbox } from 'sinon';
import { JobScheduler } from '../src/index';
import initMaintenance, * as maintenance from '../src/maintenance';

describe('Maintenance task', async () => {
  let maintenanceCallback;
  let sandbox: SinonSandbox;
  let eventsStub: SinonStub;
  let JobStub: {
    scope: SinonStub<
      any,
      {
        update: SinonStub;
        findAll: SinonStub;
      }
    >;
  };
  let scopeStub: SinonStub;
  let updateStub: SinonStub;
  let findAllStub: SinonStub;
  const jobsSafeToRestart = ['A'];
  const jobsRiskyToRestart = ['B'];
  const jobsCustomRestart = {
    D: moment.duration(15, 'minutes'),
  };
  let resetJobStub: SinonStub;

  beforeEach(() => {
    sandbox = createSandbox();
    eventsStub = sandbox.stub().resolves();
    updateStub = sandbox.stub();
    findAllStub = sandbox.stub();
    scopeStub = sandbox.stub().returns({
      update: updateStub,
      findAll: findAllStub,
    });
    JobStub = {
      scope: scopeStub,
    };
    resetJobStub = sandbox.stub(maintenance, 'resetJob').resolves();
    // @ts-ignore
    maintenanceCallback = initMaintenance({
      logger: createLogger({
        name: 'test',
      }),
      jobsSafeToRestart,
      jobsCustomRestart,
      jobsRiskyToRestart,
      events: {
        emit: eventsStub,
      },
      Job: JobStub,
    } as JobScheduler);
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
        }))
      );

    const customLaggyJobs = jobsRiskyToRestart.map(data => ({
      get: () => data,
      name: data,
    }));
    customLaggyJobs.push({
      get: () => 'D',
      name: 'D',
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

    await maintenanceCallback();
    expect(JobStub.scope.callCount).to.eql(4);
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

    expect(resetJobStub.callCount).to.eql(2);

    // Reset blocked risky to restart jobs
    expect(resetJobStub.args[0][0].get()).to.eqls('B');

    // Resets laggy risky jobs with custom restart
    expect(resetJobStub.args[1][0].get()).to.eqls('D');

    // Emits an event for laggy jobs and don't have custom restart policy
    expect(eventsStub.args[0][0]).to.eqls('lagged');
    expect(eventsStub.args[0][1]).to.eqls(['B']);
  });
});
