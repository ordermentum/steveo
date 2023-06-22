-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "last_finished_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "repeat_interval" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "fail_reason" JSONB NOT NULL,
    "failed_at" TIMESTAMP(3),
    "queued" BOOLEAN NOT NULL,
    "timezone" TEXT,
    "failures" INTEGER DEFAULT 0

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);
