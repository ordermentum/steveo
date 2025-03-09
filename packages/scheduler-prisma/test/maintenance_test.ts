import { expect } from 'chai';
import { createLogger } from 'bunyan';
import moment from 'moment-timezone';
import { SinonStub, createSandbox, SinonSandbox } from 'sinon';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { MaintenanceScheduler } from '../src/maintenance';

describe('Maintenance task', async () => {
  let maintenanceCallback: MaintenanceScheduler;
  let sandbox: SinonSandbox;
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

  beforeEach(() => {
    sandbox = createSandbox();
    updateManyStub = sandbox.stub().resolves();
    updateStub = sandbox.stub().resolves();
    eventsStub = sandbox.stub().resolves();
    queryStub = sandbox.stub().resolves();

    // Create a mock PrismaClient with required methods
    const client = {
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
    
    maintenanceCallback = new MaintenanceScheduler(
      client,
      createLogger({ name: 'test' }),
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
    await new Promise(resolve => setTimeout(resolve, 100));
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
});
