import { PrismaClient } from '@prisma/client';
import assert from 'node:assert';
import _ from 'lodash';
import { WorkflowState, WorkflowStateRepository } from 'steveo';
import { InputJsonValue } from '@prisma/client/runtime/library';

/**
 *
 */
export class WorkflowStateRepositoryPostgres
  implements WorkflowStateRepository
{
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a brand new workflow state given the identifier.
   * The ID must be unique.
   */
  async workflowInit(workflowId: string): Promise<void> {
    const result = await this.prisma.workflowState.create({
      data: {
        workflowId,
        started: new Date(),
        current: undefined,
      },
    });

    assert(result);
  }

  /**
   *
   */
  async workflowLoad(workflowId: string): Promise<WorkflowState | undefined> {
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
   * @param start
   */
  async workflowStarted(start: {
    workflowId: string;
    current: string;
    initial: unknown;
  }): Promise<void> {
    const result = await this.prisma.workflowState.update({
      where: {
        workflowId: start.workflowId,
      },
      data: {
        current: start.current,
        initial: start.initial as InputJsonValue,
      },
    });

    assert(result);
  }

  /**
   *
   */
  async workflowCompleted(workflowId: string): Promise<void> {
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
  async stepPointerUpdate(workflowId: string, stepName: string): Promise<void> {
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
  async stepExecuteError(
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
  async stepExecuteResult(
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
