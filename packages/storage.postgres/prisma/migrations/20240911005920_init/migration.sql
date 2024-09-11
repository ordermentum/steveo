-- CreateTable
CREATE TABLE "WorkflowState" (
    "id" SERIAL NOT NULL,
    "flow_id" TEXT NOT NULL,
    "started" TIMESTAMPTZ(6) NOT NULL,
    "current" TEXT NOT NULL,
    "initial" JSONB NOT NULL,
    "results" JSONB,
    "errors" JSONB,

    CONSTRAINT "WorkflowState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowState_flow_id_key" ON "WorkflowState"("flow_id");
