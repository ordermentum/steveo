import { Storage, StorageFactory, Logger } from 'steveo-steveo';
import { Transaction } from './db-context';
import { WorkflowStateRepositoryPostgres } from '../repo/workflow.repo';
import { PostgresStorageConfig } from './postgres.config';

class PostgresTransaction implements Transaction {
  commit(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  rollback(): Promise<void> {
    throw new Error('Method not implemented.');
  }

}

/**
 *
 */
function connect(_config: PostgresStorageConfig, _logger: Logger): Storage {



  return {
    name: 'steveo-postgres',

    transaction: () => Promise.resolve(new PostgresTransaction()),

    workflow: new WorkflowStateRepositoryPostgres(),
  }
}

/**
 *
 */
function migrate(): void {

  // TODO: Run Prisma migrations here....
}

// Create Postgres storage factory method
export function postgresFactory(config: PostgresStorageConfig, logger: Logger): StorageFactory {

  return {
    connect: () => connect(config, logger),
    migrate
  }
}

