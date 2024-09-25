-- CreateTable
CREATE TABLE "WorkflowState" (
    "workflowId" UUID NOT NULL,
    "serviceId" TEXT NOT NULL,
    "started" TIMESTAMPTZ(6) NOT NULL,
    "completed" TIMESTAMPTZ(6),
    "current" TEXT NOT NULL,
    "initial" JSONB,
    "results" JSONB,
    "errors" JSONB,

    CONSTRAINT "WorkflowState_pkey" PRIMARY KEY ("workflowId")
);
