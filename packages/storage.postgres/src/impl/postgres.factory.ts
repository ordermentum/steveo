import { Storage, StorageFactory, Logger, TransactionHandle } from 'steveo-steveo';
import { WorkflowStateRepositoryPostgres } from '../repo/workflow.repo';
import { PostgresStorageConfig } from './postgres.config';
import { PrismaClient } from '@prisma/client';

type PostgresTx = { txClient: PrismaClient } & TransactionHandle;

/**
 *
 */
function connect(config: PostgresStorageConfig, logger: Logger): Storage {

  const prisma = new PrismaClient({
    datasourceUrl: config.datasourceUrl,
  })

  return {
    name: 'steveo-postgres',

    /**
     * Executes the given function under the umbrella of a Postgres transaction.
     * @param fn
     */
    async transaction(fn: (tx: TransactionHandle) => Promise<void>): Promise<void> {

      logger.trace({ msg: `Postgres storage transaction begin` });

      //
      await prisma.$transaction(async (txClient) => {

        const tx = { txClient, type: 'steveo-postgres-tx' } as PostgresTx;

        await fn(tx);

        logger.trace({ msg: `Postgres storage transaction complete` });
      });
    },

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

