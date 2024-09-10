import { Storage, StorageFactory } from 'steveo-steveo';
import { Transaction } from './db-context';
import { WorkflowStateRepositoryPostgres } from './workflow.repo';

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
function connect(): Storage {
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
export const postgresFactory = (): StorageFactory => ({ connect, migrate });

