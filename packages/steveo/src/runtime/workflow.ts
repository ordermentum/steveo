import { v4 } from 'uuid';
import bind from 'lodash.bind';
import assert from 'node:assert';
import nullLogger from 'null-logger';
import take from 'lodash.take';
import { Step, StepUnknown } from './workflow-step';
import { IProducer, IRegistry, Logger } from '../common';
import { WorkflowState } from './workflow-state';
import { Repositories, Storage } from '../storage/storage';
import { WorkflowOptions, WorkflowPayload } from '../types/workflow';
import { formatTopicName } from '../lib/formatters';

/**
 * Contextual grouping object that defines the current execution
 * context of a workflow (only used internally)
 */
interface ExecuteContext {
  workflowId: string;
  payload: unknown;
  step: StepUnknown;
  state: WorkflowState;
  repos: Repositories;
}

interface WorkflowProps {
  name: string;
  topic: string;
  storage: Storage;
  logger?: Logger;
  registry: IRegistry;
  producer: IProducer;
  options: WorkflowOptions;
}

/**
 *
 */
export class Workflow {
  /**
   * The execution step definitions.
   * Uses an object type as the generic types of the steps
   * will vary from step to step.
   */
  steps: StepUnknown[] = [];

  constructor(private props: WorkflowProps) {
    assert(this.name, `name must be specified`);

    // Register the workflow, this will make sure we can start a workflow execution
    this.registry.addNewTask(this);
  }

  // Support the existing interface ITask by duck typing members
  get name() {
    return this.props.name;
  }

  get topic() {
    return this.props.topic;
  }

  get options() {
    return this.props.options;
  }

  protected get logger() {
    return this.props.logger ?? nullLogger;
  }

  protected get registry() {
    return this.props.registry;
  }

  protected get producer() {
    return this.props.producer;
  }

  protected get storage() {
    return this.props.storage;
  }

  /**
   *
   */
  next<State, Result>(step: Step<State, Result>): Workflow {
    this.steps.push(step as Step<unknown, unknown>);

    const subscribe = bind(this.subscribe, this);
    const taskName = this.formatStepMessage(step.name);

    this.registry.addNewTask({
      subscribe,
      name: taskName,
      topic: step.topic ?? taskName,
      options: step,
    });

    return this;
  }

  /**
   *
   * @param payload
   */
  async publish<T>(
    payload: T | T[],
    context?: {
      key?: string;
    }
  ) {
    const step = this.steps[0];

    return this.publishInternal(step.name, payload, context);
  }

  /**
   * Given a workflow state this function will establish what the next step
   * is and invoke the properly formatted message with the given payload.
   */
  protected async publishNextStep<T>(
    current: string,
    workflowId: string,
    payload: T | T[],
    context: ExecuteContext
  ) {
    // Move execution pointer to next execution step and save, or
    // mark the flow completed if there are no more steps
    const next = this.getNextStep(current);
    if (!next) {
      await context.repos.workflow.workflowCompleted(workflowId);
      return;
    }

    await context.repos.workflow.stepPointerUpdate(workflowId, next.name);

    const message = this.formatStepMessage(next.name);

    await this.publishInternal(message, payload);
  }

  /**
   * This handles the underlying (internal) mechanics of publishing a message.
   * It does not control flow, that is expected to be handled by the callers.
   */
  private async publishInternal<T>(
    message: string,
    payload: T | T[],
    context?: {
      key?: string;
    }
  ) {
    const params = Array.isArray(payload) ? payload : [payload];

    try {
      this.logger.info(
        `Workflow ${this.name} publish next step in sequence ${message}`
      );

      // sqs calls this method twice
      await this.producer.initialize(message);

      await Promise.all(
        params.map((data: T) => {
          this.registry.emit('workflow_send', message, data);
          return this.producer.send(message, data, context?.key, context);
        })
      );

      this.registry.emit('workflow_success', message, payload);
    } catch (err) {
      this.logger.error(`Error executing workflow ${this.name} - ${message}`);

      this.registry.emit('workflow_failure', message, err);
      throw err;
    }
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
        `Steps must be defined before a flow is executed ${this.name}`
      );
    }

    await this.storage.transaction(async repos => {
      const workflowId = payload.workflowId ?? `${this.name}-${v4()}`;

      // Initialise new workflow execution?
      if (!payload.workflowId) {
        const firstStep = this.steps[0];

        this.logger.debug(`No workflow in payload, initialising new workflow`);

        await repos.workflow.workflowInit({
          workflowId,
          serviceId: this.options.serviceId,
          current: firstStep.name,
          initial: payload,
        });
      }

      const state = await this.loadState(workflowId, repos);

      if (!state.current) {
        throw new Error(`Workflow ${workflowId} step was undefined`);
      }

      const step = this.steps.find(s => s.name === state.current);
      if (!step) {
        throw new Error(
          `Worflow ${workflowId} could not find step ${state.current}`
        );
      }

      this.logger.debug(
        `Load state for workflow ${workflowId}, step ${step.name}`
      );

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
      // Check the current steveo instance to prevent accidental network boundary crossing
      if (state.serviceId !== this.options.serviceId) {
        throw new Error(
          `Workflow ID ${workflowId} attempted to execute across network boundary. Running service ${this.options.serviceId} while expected ${state.serviceId}`
        );
      }

      // Protect against out of order step excution and step re-execution
      const stepIndex = this.steps.findIndex(s => s.name === step.name);
      const executed = stepIndex > 0 ? take(this.steps, stepIndex - 1) : [];

      const expectedOrder = executed.every(s => !!state.results?.[s.name]);
      if (!expectedOrder) {
        throw new Error(
          `Out of order step ${step.name} execution detected on workflow ${workflowId}`
        );
      }

      this.logger.debug(`Executing workflow ${workflowId}, step ${step.name}`);

      const result = (await step.execute(payload)) as object;

      await context.repos.workflow.stepExecuteResult(
        workflowId,
        state.current,
        result
      );

      // This check is needed as the database type will initialise to null
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!state.results) {
        state.results = {};
      }

      state.results[state.current] = result;

      // Now the state has been successfully updated, publish the
      // next message in the flow
      await this.publishNextStep(
        context.step.name,
        context.workflowId,
        result,
        context
      );
    } catch (err) {
      this.logger.error(`Error executing next step in workflow ${workflowId}`);

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
    const { step, workflowId, state } = context;

    let current: StepUnknown | undefined = step;

    this.logger.info(
      `Execute rollback for workflow ${workflowId}, step ${step.name}`
    );

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
        this.logger.error(
          `Error executing rollback step ${current.name} in workflow ${workflowId}`
        );

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

    const nextIndex = index + 1;

    if (nextIndex >= this.steps.length) {
      return undefined;
    }

    return this.steps.at(nextIndex);
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
   */
  private formatStepMessage(name: string): string {
    return formatTopicName(`${this.name}__${name}`, this.options);
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
    if (!flowId) {
      throw new Error(`workflowId was empty for ${this.name} run`);
    }

    const state = await repos.workflow.workflowLoad(flowId);

    if (!state) {
      throw new Error(
        `State was not found for workflowId ${flowId} in workflow ${this.name}`
      );
    }

    return state;
  }
}
