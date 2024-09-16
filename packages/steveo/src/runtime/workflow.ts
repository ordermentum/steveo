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

interface ExecuteContext {
  workflowId: string;

  payload: unknown;

  step: StepUnknown;

  state: WorkflowState;

  repos: Repositories;
}

export class Workflow {
  $name: string;

  $topic: string;

  $storage: Storage;

  $logger: Logger;

  $registry: IRegistry;

  $producer: IProducer;

  $options: WorkflowOptions;

  /**
   * The execution step definitions.
   * Uses an object type as the generic types of the steps
   * will vary from step to step.
   */
  steps: Step<unknown, unknown>[] = [];

  constructor(props: {
    name: string;
    topic: string;
    storage: Storage;
    logger?: Logger;
    registry: IRegistry;
    producer: IProducer;
    options: WorkflowOptions;
  }) {
    this.$name = props.name;
    this.$topic = props.topic;
    this.$storage = props.storage;
    this.$logger = props.logger ?? nullLogger;
    this.$registry = props.registry;
    this.$producer = props.producer;
    this.$options = props.options;

    assert(this.$name, `name must be specified`);

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

    const subscribe = bind(this.subscribe, this);
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
    await this.$storage.transaction(async () => {
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

    await this.$storage.transaction(async repos => {
      const workflowId = payload.workflowId ?? `${this.$name}-${v4()}`;

      if (!payload.workflowId) {
        const firstStep = this.steps[0];

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

      const expectedOrder = executed.every(s => !!state.results[s.name]);
      if (!expectedOrder) {
        throw new Error(
          `Out of order step ${step.name} execution detected on workflow ${workflowId}`
        );
      }

      const result = await step.execute(payload);

      await context.repos.workflow.stepExecuteResult(
        workflowId,
        state.current,
        result
      );

      state.results[state.current] = result;

      // Move execution pointer to next execution step and save, or
      // mark the flow completed if there are no more steps
      const next = this.getNextStep(context.step.name);
      if (!next) {
        await context.repos.workflow.workflowCompleted(workflowId);
        return;
      }

      await context.repos.workflow.stepPointerUpdate(
        state.workflowId,
        next.name
      );

      // Now the state has been successfully updated, publish the
      // next message in the flow
      await this.publish(result);
    } catch (err) {
      this.$logger.error({
        msg: `Error executing next step in workflow ${workflowId}`,
        err,
        context,
      });

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

    this.$logger.info({
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
        this.$logger.error({
          msg: `Error executing rollback step ${current.name} in workflow ${workflowId}`,
          err,
          context,
          state,
        });

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
        `State was not found for workflowId ${flowId} in workflow ${this.$name}`
      );
    }

    return state;
  }
}
