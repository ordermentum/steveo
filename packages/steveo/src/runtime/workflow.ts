import { v4 } from 'uuid';
import bind from 'lodash.bind';
import assert from 'node:assert';
import { Step, StepUnknown } from './workflow-step';
import { IProducer, IRegistry, Logger } from '../common';
import { WorkflowState } from './workflow-state';
import { Repositories, Storage } from '../storage/storage';
import { Steveo } from '..';
import { WorkflowPayload } from '../types/workflow';
import { TaskOptions } from '../types/task-options';

interface ExecuteContext {
  workflowId: string;

  payload: unknown;

  step: StepUnknown;

  state: WorkflowState;

  repos: Repositories;
}

export class Workflow {
  logger: Logger;

  /**
   * The execution step definitions.
   * Uses an object type as the generic types of the steps
   * will vary from step to step.
   */
  steps: Step<unknown, unknown>[] = [];

  /**
   *
   */
  storage: Storage;

  constructor(
    steveo: Steveo,
    private $name: string,
    private $topic: string,
    private $registry: IRegistry,
    private $producer: IProducer,
    private $options?: TaskOptions
  ) {
    assert($name, `flowId must be specified`);
    assert(
      steveo.storage,
      `storage must be provided to steveo in order to use workflows`
    );

    this.storage = steveo.storage;
    this.logger = steveo.logger;

    // Register the workflow, this will make sure we can start a workflow execution
    this.$registry.addNewTask(this);
  }

  // Support the existing interface ITask by duck typing members
  get name() {
    return this.$name;
  }

  get topic() {
    return this.$topic;
  }

  get options() {
    return this.$options;
  }

  /**
   *
   */
  next<State, Result>(step: Step<State, Result>): Workflow {
    this.steps.push(step as Step<unknown, unknown>);

    const subscribe = bind(this.publish, this);
    const taskName = `${this.name}.${step.name}`;

    this.$registry.addNewTask({
      subscribe,
      name: taskName,
      topic: step.topic ?? taskName,
      options: this.options,
    });

    return this;
  }

  /**
   *
   * @param payload
   */
  async publish<T>(payload: T | T[], context?: { key: string }) {
    await this.storage.transaction(async () => {
      const params = Array.isArray(payload) ? payload : [payload];

      try {
        // sqs calls this method twice
        await this.$producer.initialize(this.topic);

        await Promise.all(
          params.map((data: T) => {
            this.$registry.emit('task_send', this.topic, data);
            return this.$producer.send(this.topic, data, context?.key, context);
          })
        );

        this.$registry.emit('task_success', this.topic, payload);
      } catch (err) {
        this.$registry.emit('task_failure', this.topic, err);
        throw err;
      }
    });
  }

  /**
   * ITask implementation of the subscribe method
   * On a Task this will execute the configured handler, but for a workflow
   * it will load the current state and execute the step, or continue
   * executing the rollback chain if there was an unrecoverable error.
   */
  async subscribe<T extends WorkflowPayload>(payload: T) {
    if (!this.steps.length) {
      throw new Error(
        `Steps must be defined before a flow is executed ${this.$name}`
      );
    }

    await this.storage.transaction(async repos => {
      const workflowId = payload.workflowId ?? `${this.$name}-${v4()}`;

      if (!payload.workflowId) {
        await repos.workflow.workflowInit(workflowId);
      }

      const state = await this.loadState(workflowId, repos);

      if (!state.current) {
        throw new Error(`Workflow ${workflowId} step was undefined`);
      }

      const step = this.steps[state.current];
      const context: ExecuteContext = {
        workflowId,
        payload,
        state,
        step,
        repos,
      };

      // If this step has failed then we pass control over to the rollback executor.
      if (state.errors?.length) {
        await this.executeRollback(context);
        return;
      }

      await this.executeNextStep(context);
    });
  }

  /**
   *
   */
  private async executeNextStep(context: ExecuteContext): Promise<void> {
    const { step, payload, workflowId, state } = context;

    try {
      // TODO: Add `source` to the workflow state to check the current steveo instance service name it is running in  and prevent accidental network boundary crossing
      // TODO: Protect out of order excution or step re-execution

      const result = await step.execute(payload);

      await context.repos.workflow.stepExecuteResult(
        workflowId,
        state.current,
        result
      );

      state.results[state.current] = result;

      // Move execution pointer to next execution step and
      // mark the flow completed if there isn't one.
      const next = this.getNextStep(context.step.name);
      if (!next) {
        await context.repos.workflow.workflowCompleted(workflowId);
        return;
      }

      await context.repos.workflow.stepPointerUpdate(
        state.workflowId,
        next.name
      );
    } catch (err) {
      await context.repos.workflow.stepExecuteError(
        workflowId,
        state.current,
        String(err)
      );

      await this.executeRollback(context);
    }
  }

  /**
   * Called when the workflow has failed and cannot be retried, so each
   * step that has already been called will have its optionally defined
   * rollback method called
   */
  private async executeRollback(context: ExecuteContext): Promise<void> {
    const { step, payload, workflowId, state } = context;

    let current: StepUnknown | undefined = step;

    this.logger.info({
      msg: `Execute rollback`,
      workflowId,
      step: step.name,
      payload,
    });

    while (current) {
      try {
        await step.rollback?.(state);

        const previous = this.getPreviousStep(step.name);

        if (previous) {
          await context.repos.workflow.rollbackStepExecute(
            workflowId,
            previous.name
          );
        } else {
          // There are no more steps, the rollback has completed and so has the workflow
          await context.repos.workflow.workflowCompleted(workflowId);
        }
      } catch (err) {
        await context.repos.workflow.stepExecuteError(
          workflowId,
          state.current,
          String(err)
        );
      }

      current = this.getPreviousStep(current.name);
    }
  }

  /**
   *
   * @param name
   * @returns
   */
  private getPreviousStep(name: string): StepUnknown | undefined {
    const index = this.getStepIndex(name);

    if (index === undefined) {
      throw new Error(`Step ${name} was not found in workflow ${this.name}`);
    }

    if (index === 0) {
      return undefined;
    }

    return this.steps.at(index - 1);
  }

  /**
   *
   * @param name
   * @returns
   */
  private getNextStep(name: string): StepUnknown | undefined {
    const index = this.getStepIndex(name);

    if (index === undefined) {
      throw new Error(`Step ${name} was not found in workflow ${this.name}`);
    }

    if (index >= this.steps.length) {
      return undefined;
    }

    return this.steps.at(index - 1);
  }

  /**
   *
   * @param name
   * @returns
   */
  private getStepIndex(name: string): number | undefined {
    const index = this.steps.findIndex(s => s.name === name);

    return index < 0 ? undefined : index;
  }

  /**
   *
   * @param flowId
   * @returns
   */
  private async loadState(
    flowId: string,
    repos: Repositories
  ): Promise<WorkflowState> {
    const state = await repos.workflow.workflowLoad(flowId);

    if (!flowId) {
      throw new Error(`workflowId was empty for ${this.name} run`);
    }

    if (!state) {
      throw new Error(
        `State was not found for workflowId ${flowId} in workflow ${this.$name}`
      );
    }

    return state;
  }
}
