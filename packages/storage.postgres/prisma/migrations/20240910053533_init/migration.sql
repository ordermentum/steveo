-- CreateTable
CREATE TABLE "WorkflowState" (
    "id" SERIAL NOT NULL,
    "flow_id" TEXT NOT NULL,
    "started" TIMESTAMPTZ(6) NOT NULL,
    "current" INTEGER NOT NULL,
    "initial" JSONB NOT NULL,
    "results" JSONB,
    "failed_step" INTEGER,
    "failed_err_msg" VARCHAR(255),
    "failed_err_stack" VARCHAR(2000),

    CONSTRAINT "WorkflowState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowState_flow_id_key" ON "WorkflowState"("flow_id");
