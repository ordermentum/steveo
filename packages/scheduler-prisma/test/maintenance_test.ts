import { expect } from 'chai';
import { Op } from 'sequelize';
import { createLogger } from 'bunyan';
import moment from 'moment-timezone';
import { SinonStub, createSandbox, SinonSandbox } from 'sinon';
import { JobScheduler } from '../src/index';
import initMaintenance from '../src/maintenance';
import * as helpers from '../src/helpers';

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
  let queryStub: SinonStub;
  let updateStub: SinonStub;
  const jobsSafeToRestart = ['A'];
  const jobsRiskyToRestart = ['B'];
  const jobsCustomRestart = {
    D: moment.duration(15, 'minutes'),
  };
  let resetJobStub: SinonStub;

  beforeEach(() => {
    sandbox = createSandbox();
    updateStub = sandbox.stub().resolves();
    eventsStub = sandbox.stub().resolves();
    queryStub = sandbox.stub().resolves([]);
    resetJobStub = sandbox.stub(helpers, 'resetJob').resolves();
    const client = {
      $queryRaw: queryStub,
      job: {
        updateMany: updateStub,
      },
    };
    // @ts-ignore
    maintenanceCallback = initMaintenance(client, {
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
    const customLaggyJobs = jobsRiskyToRestart.map(data => ({
      get: () => data,
      name: data,
    }));
    customLaggyJobs.push({
      get: () => 'D',
      name: 'D',
    });

    queryStub.onFirstCall().resolves([{ id: 2 }, { id: 5 }]);
    queryStub.onSecondCall().resolves([{ id: 2 }, { id: 5 }]);
    queryStub.onThirdCall().resolves([{ id: 3 }, { id: 4, name: 'D' }]);

    await maintenanceCallback();

    expect(updateStub.callCount).to.eql(2);
    expect(resetJobStub.callCount).to.eql(2);
    // Reset blocked risky to restart jobs
    expect(resetJobStub.args[0][1].id).to.eql(2);
  });
});
