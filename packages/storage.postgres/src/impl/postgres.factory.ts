import { Storage, Logger, TransactionHandle, WorkflowStateRepository } from 'steveo-steveo';
import { WorkflowStateRepositoryPostgres } from '../repo/workflow.repo';
import { PostgresStorageConfig } from './postgres.config';
import { PrismaClient } from '@prisma/client';

type PostgresTx = { txClient: PrismaClient } & TransactionHandle;

/**
 *
 */
class PostgresStorage extends Storage {

  workflow: WorkflowStateRepository;

  prisma: PrismaClient;

  constructor(
    private config: PostgresStorageConfig,
    private logger: Logger
  ) {
    super('steveo-postgres');

    this.prisma = new PrismaClient({
      datasourceUrl: this.config.datasourceUrl,
    });

    this.workflow = new WorkflowStateRepositoryPostgres();
   }

  /**
   * Executes the given function under the umbrella of a Postgres transaction.
   * @param fn
   */
  async transaction(fn: (tx: TransactionHandle) => Promise<void>): Promise<void> {

    this.logger.trace({ msg: `Postgres storage transaction begin` });

    //
    await this.prisma.$transaction(async (txClient) => {

      const tx = { txClient, type: 'steveo-postgres-tx' } as PostgresTx;

      await fn(tx);

      this.logger.trace({ msg: `Postgres storage transaction complete` });
    });
  }
}

// Create Postgres storage factory method
export function postgresFactory(config: PostgresStorageConfig, logger: Logger): Storage {
  return new PostgresStorage(config, logger);
}

