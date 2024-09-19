#!/bin/bash

set -e

DATABASE_INITIALIZATION_URI=postgres://postgres@127.0.0.1/template1

psql $DATABASE_INITIALIZATION_URI -v ON_ERROR_STOP=0 -t <<-EOSQL
  CREATE USER steveo;
  ALTER USER steveo WITH SUPERUSER;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EOSQL

psql $DATABASE_INITIALIZATION_URI -tc "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"";

psql $DATABASE_INITIALIZATION_URI -tc "SELECT 1 FROM pg_database WHERE datname = 'steveo_development'" | grep -q 1 || psql $DATABASE_INITIALIZATION_URI -c "CREATE DATABASE steveo_development"

psql $DATABASE_INITIALIZATION_URI -tc "SELECT 1 FROM pg_database WHERE datname = 'steveo_testing'" | grep -q 1 || psql $DATABASE_INITIALIZATION_URI -c "CREATE DATABASE steveo_testing"

