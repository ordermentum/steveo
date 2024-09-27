import * as runtime from '@prisma/client/runtime/library.js';
import assert from 'node:assert';
import _ from 'lodash';
import { WorkflowState, WorkflowStateRepository } from 'steveo';
import { InputJsonValue } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';

/**
 *
 */
export class WorkflowStateRepositoryPostgres
  implements WorkflowStateRepository
{
  constructor(private prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) {}

  /**
   * Create a brand new workflow state given the identifier.
   * The ID must be unique.
   * @param workflowId Unique ID to be used for the new workflow execution
   * @param serviceId The identifier for the service the workflow is running on. This does not identify the execution pod, only the service name common across pods
   */
  async workflowInit(props: {
    workflowId: string;
    serviceId: string;
    current: string;
    initial: unknown;
  }): Promise<void> {
    const result = await this.prisma.workflowState.create({
      data: {
        workflowId: props.workflowId,
        serviceId: props.serviceId,
        started: new Date(),
        current: props.current,
        initial: props.initial as InputJsonValue,
      },
    });

    assert(result);
  }

  /**
   *
   */
  async loadWorkflow(workflowId: string): Promise<WorkflowState | undefined> {
    const result = await this.prisma.workflowState.findUnique({
      where: {
        workflowId,
      },
    });

    if (!result) {
      return undefined;
    }

    return result as WorkflowState;
  }

  /**
   *
   */
  async updateWorkflowCompleted(workflowId: string): Promise<void> {
    await this.prisma.workflowState.update({
      where: {
        workflowId,
      },
      data: {
        completed: new Date(),
      },
    });
  }

  /**
   *
   */
  async updateCurrentStep(workflowId: string, stepName: string): Promise<void> {
    const result = await this.prisma.workflowState.update({
      where: {
        workflowId,
      },
      data: {
        current: stepName,
      },
    });

    assert(result);
  }

  /**
   *
   */
  async storeExecuteError(
    workflowId: string,
    identifier: string,
    error: unknown
  ): Promise<void> {
    const existing = await this.prisma.workflowState.findUnique({
      where: {
        workflowId,
      },
      select: {
        errors: true,
      },
    });

    const errors =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (existing?.errors as { identifier: string; error: unknown }[]) ?? [];

    const result = await this.prisma.workflowState.update({
      where: {
        workflowId,
      },
      data: {
        errors: [...errors, { identifier, error }] as InputJsonValue,
      },
    });

    assert(result);
  }

  /**
   *
   */
  async storeStepResult(
    workflowId: string,
    nextStep: string,
    result: unknown
  ): Promise<void> {
    const existing = await this.prisma.workflowState.findUnique({
      where: {
        workflowId,
      },
      select: {
        results: true,
      },
    });

    const results =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (existing?.results as Record<string, unknown>) ?? {};

    results[nextStep] = result;

    await this.prisma.workflowState.update({
      where: {
        workflowId,
      },
      data: {
        current: nextStep,
        results: results as InputJsonValue,
      },
    });
  }

  /**
   *
   */
  async rollbackStepExecute(
    workflowId: string,
    nextStep: string
  ): Promise<void> {
    await this.prisma.workflowState.update({
      where: {
        workflowId,
      },
      data: {
        current: nextStep,
      },
    });
  }
}
