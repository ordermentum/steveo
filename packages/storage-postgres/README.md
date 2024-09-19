# Overview

This is a Postgres implementation of the Steveo abstract storage interface.

It uses Prisma to manage database access and schema migrations.

## Local development notes

For local development the database URLs will use the following:

- `postgresql://ordermentum@localhost:5432/steveo_development` Used in development application execution
- `postgresql://ordermentum@localhost:5432/steveo_testing` Used in unit test execution

Push migrations locally for development (initialises `_prisma_migrations` table for development etc):

```bash
DATABASE_URL=... npx prisma migrate dev
```

Create a new migration once changes have been made to the `prisma/schema.prisma` file:

```bash
DATABASE_URL=... npx prisma migrate dev --name "<NEW_MIGRATION_NAME>"
```

Reset the database and replay all migrations (DESTRUCTIVE):

```bash
DATABASE_URL=... npx prisma migrate reset
```

## Staging & production notes

Deploy pending migrations to a non-development environment (does not generate scripts, only applies pending migrations):

```bash
DATABASE_URL=... npx prisma migrate deploy
```
