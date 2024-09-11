import { Storage, Logger, WorkflowStateRepository } from 'steveo-steveo';
import { WorkflowStateRepositoryPostgres } from '../repo/workflow.repo';
import { PostgresStorageConfig } from './postgres.config';
import { PrismaClient } from '@prisma/client';

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
  async transaction(fn: () => Promise<void>): Promise<void> {

    this.logger.trace({ msg: `Postgres storage transaction begin` });

    //
    await this.prisma.$transaction(async () => {
      await fn();

      this.logger.trace({ msg: `Postgres storage transaction complete` });
    });
  }
}

/**
 * Creates a Postgres storage instance with the given config and logger
 */
export function postgresFactory(config: PostgresStorageConfig, logger: Logger): Storage {
  return new PostgresStorage(config, logger);
}

