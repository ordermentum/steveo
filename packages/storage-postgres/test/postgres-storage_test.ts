import { NullLogger } from 'null-logger';
import { postgresFactory } from '../src/impl/postgres-storage';
import assert from 'node:assert';
import { expect } from 'chai';
import { PostgresStorageConfig } from '../src/impl/postgres-config';

describe('Postgres storage factory', () => {
  assert(process.env.DATABASE_URL);

  const config: PostgresStorageConfig = {
    databaseUrl: process.env.DATABASE_URL,
    transactionTimeout: 500
  };

  it('should create storage instance', () => {
    const storage = postgresFactory(config, new NullLogger());

    expect(storage).not.to.be.undefined;
  });

  it('should execute a transaction with repos instance', async () => {
    assert(process.env.DATABASE_URL);

    const storage = postgresFactory(config, new NullLogger());

    await storage.transaction(repos => {
      expect(repos).not.to.be.undefined;

      return Promise.resolve();
    })

    expect(storage).not.to.be.undefined;
  });
});
