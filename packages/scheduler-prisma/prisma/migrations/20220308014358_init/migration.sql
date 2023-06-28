/*
  Warnings:

  - Made the column `timezone` on table `jobs` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "jobs" ALTER COLUMN "timezone" SET NOT NULL,
ALTER COLUMN "timezone" SET DEFAULT E'UTC';
