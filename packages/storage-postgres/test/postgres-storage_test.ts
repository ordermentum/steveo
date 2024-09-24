import { NullLogger } from 'null-logger';
import { postgresFactory } from '../src/impl/postgres-storage';
import assert from 'node:assert';
import { expect } from 'chai';

describe('Postgres storage factory', () => {
  it('should create storage instance', () => {
    assert(process.env.DATABASE_URL);

    const storage = postgresFactory({ datasourceUrl: process.env.DATABASE_URL }, new NullLogger());

    expect(storage).not.to.be.undefined;
  });

  it('should execute a transaction with repos instance', async () => {
    assert(process.env.DATABASE_URL);

    const storage = postgresFactory({ datasourceUrl: process.env.DATABASE_URL }, new NullLogger());

    await storage.transaction(repos => {
      expect(repos).not.to.be.undefined;

      return Promise.resolve();
    })

    expect(storage).not.to.be.undefined;
  });
});
