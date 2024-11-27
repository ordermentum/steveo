import { v4 } from 'uuid';
import assert from 'node:assert';
import { bind, take } from '../lib/not-lodash';
import { Step, StepUnknown } from './workflow-step';
import { IProducer, IRegistry } from '../common';
import { WorkflowState } from './workflow-state';
import { Repositories, Storage } from '../storage/storage';
import { WorkflowOptions, WorkflowPayload } from '../types/workflow';
import { formatTopicName } from '../lib/formatters';
import { consoleLogger, Logger } from '../lib/logger';
import { AppError } from '../lib/app-error';

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
    assert(this.name, `Name must be specified`);

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
    return this.props.logger ?? consoleLogger;
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
  async publish<T extends WorkflowPayload>(
    payload: T | T[],
    context?: {
      key?: string;
    }
  ) {
    const step = this.steps[0];

    return this.publishInternal(
      step.name,
      payload,
      context,
      this.logger.child({
        current: step.name,
        workflow: this.name,
        workflows: Array.isArray(payload)
          ? payload.map(p => p.workflowId)
          : [payload.workflowId],
      })
    );
  }

  /**
   * Given a workflow state this function will establish what the next step
   * is and invoke the properly formatted message with the given payload.
   */
  protected async publishNextStep<T>(
    current: string,
    workflowId: string,
    payload: T | T[],
    context: ExecuteContext,
    log: Logger
  ) {
    // Move execution pointer to next execution step and save, or
    // mark the flow completed if there are no more steps
    const next = this.getNextStep(current, log);
    if (!next) {
      await context.repos.workflow.updateWorkflowCompleted(workflowId);
      return;
    }

    log.debug({ current, next: next.name }, 'Publish next workflow step');

    await context.repos.workflow.updateCurrentStep(workflowId, next.name);

    const message = this.formatStepMessage(next.name);

    await this.publishInternal(
      message,
      { workflowId, ...payload },
      undefined,
      log
    );
  }

  /**
   * This handles the underlying (internal) mechanics of publishing a message.
   * It does not control flow, that is expected to be handled by the callers.
   */
  private async publishInternal<T extends WorkflowPayload>(
    message: string,
    payload: T | T[],
    context:
      | {
          key?: string;
        }
      | undefined,
    log: Logger
  ) {
    const payloadArray = Array.isArray(payload) ? payload : [payload];

    try {
      log.info(`Workflow publish internal start`);

      // TODO: Understand and document the significance of this comment (it was copypasta'd from the original task implementation)
      // SQS calls this method twice
      await this.producer.initialize(message);

      await Promise.all(
        payloadArray.map(data => {
          this.registry.emit('workflow_send', message, data);

          return this.producer.send(message, data, context?.key, context);
        })
      );

      this.registry.emit('workflow_success', message, payload);

      log.debug(`Workflow completed publish internal`);
    } catch (err) {
      log.error(`Workflow execution error`);

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
  async subscribe<T extends WorkflowPayload>(payload: T, log: Logger) {
    try {
      if (!this.steps.length) {
        throw new AppError(
          log,
          `Steps must be defined before a flow is executed`
        );
      }

      const workflowId = payload.workflowId ?? `${this.name}-${v4()}`;

      return await this.storage.transaction<string>(async repos =>
        this.processPayload(
          workflowId,
          repos,
          payload,
          log.child({
            workflowId,
            workflowName: this.name,
          })
        )
      );
    } catch (err) {
      log.error(
        { workflowId: payload.workflowId, err },
        'Subscribe processor error'
      );

      throw err;
    }
  }

  /**
   * Processes a single message payload
   */
  private async processPayload<T extends WorkflowPayload>(
    workflowId: string,
    repos: Repositories,
    payload: T,
    log: Logger
  ) {
    // Initialise new workflow execution?
    if (!payload.workflowId) {
      const firstStep = this.steps[0];

      log.debug(`No workflow in payload, initialising new workflow`);

      await repos.workflow.workflowInit({
        workflowId,
        serviceId: this.options.serviceId,
        current: firstStep.name,
        initial: payload,
      });
    }

    const state = await this.loadState(workflowId, repos, log);

    if (!state.current) {
      throw new AppError(log, `Workflow state was not found`);
    }

    const step = this.steps.find(s => s.name === state.current);
    if (!step) {
      throw new AppError(log, `Worflow could not find current step`, {
        current: state.current,
      });
    }

    log.debug({ stepName: step.name }, `Load state for workflow step`);

    const context: ExecuteContext = {
      workflowId,
      payload,
      state,
      step,
      repos,
    };

    // If this step has failed then we pass control over to the rollback executor.
    const childLog = log.child({ step: step.name });

    if (state.errors?.length) {
      await this.executeRollback(context, childLog);
    } else {
      await this.executeNextStep(context, childLog);
    }

    return workflowId;
  }

  /**
   *
   */
  private async executeNextStep(
    context: ExecuteContext,
    log: Logger
  ): Promise<void> {
    const { step, payload, workflowId, state } = context;

    try {
      // Check the current steveo instance to prevent accidental network boundary crossing
      if (state.serviceId !== this.options.serviceId) {
        throw new AppError(
          log,
          `Workflow attempted to execute across network boundary`,
          {
            optionsServiceId: this.options.serviceId,
            stateServiceId: state.serviceId,
          }
        );
      }

      // Protect against out of order step excution and step re-execution
      const stepIndex = this.steps.findIndex(s => s.name === step.name);
      const executed = stepIndex > 0 ? take(this.steps, stepIndex - 1) : [];

      const expectedOrder = executed.every(s => !!state.results?.[s.name]);
      if (!expectedOrder) {
        throw new AppError(
          log,
          `Out of order step execution detected on workflow`
        );
      }

      log.debug(`Executing workflow step function`);

      const result = (await step.execute(payload)) as object;

      await context.repos.workflow.storeStepResult(
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
        context,
        log
      );
    } catch (err) {
      log.error(`Error executing next step in workflow`);

      await context.repos.workflow.storeExecuteError(
        workflowId,
        state.current,
        String(err)
      );

      await this.executeRollback(context, log);
    }
  }

  /**
   * Called when the workflow has failed and cannot be retried, so each
   * step that has already been called will have its optionally defined
   * rollback method called
   */
  private async executeRollback(
    context: ExecuteContext,
    log: Logger
  ): Promise<void> {
    const { step, workflowId, state } = context;

    let current: StepUnknown | undefined = step;

    log.info(`Execute rollback for workflow step`);

    while (current) {
      try {
        await step.rollback?.(state);

        const previous = this.getPreviousStep(step.name, log);
        if (previous) {
          await context.repos.workflow.rollbackStepExecute(
            workflowId,
            previous.name
          );
        } else {
          // There are no more steps, the rollback has completed and so has the workflow
          await context.repos.workflow.updateWorkflowCompleted(workflowId);
        }
      } catch (err) {
        log.error(`Error executing rollback step in workflow`);

        await context.repos.workflow.storeExecuteError(
          workflowId,
          state.current,
          String(err)
        );

        throw err;
      }

      current = this.getPreviousStep(current.name, log);
    }
  }

  /**
   *
   * @param stepName
   * @returns
   */
  private getPreviousStep(
    stepName: string,
    log: Logger
  ): StepUnknown | undefined {
    const index = this.getStepIndex(stepName);

    if (index === undefined) {
      throw new AppError(log, `Step was not found in workflow`);
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
  private getNextStep(stepName: string, log: Logger): StepUnknown | undefined {
    const index = this.getStepIndex(stepName);

    if (index === undefined) {
      throw new AppError(log, `Step was not found in workflow`);
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
    repos: Repositories,
    log: Logger
  ): Promise<WorkflowState> {
    if (!flowId) {
      throw new AppError(log, `WorkflowId was empty for run`);
    }

    const state = await repos.workflow.loadWorkflow(flowId);
    if (!state) {
      throw new AppError(log, `State was not found for workflowId`);
    }

    return state;
  }
}
