import { v4 } from 'uuid';
import { Step } from "./workflow-step";
import assert from 'node:assert';
import { IProducer, IRegistry, Logger, TaskOptions } from '../common';
import nullLogger from 'null-logger';
import { WorkflowState } from './workflow-state';
import { Storage, TransactionHandle } from '../storage/storage';
import { Steveo } from '../';

export interface WorkflowPayload {
  workflowId?: string;
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
    private _name: string,
    private _topic: string,
    private _registry: IRegistry,
    private _producer: IProducer,
    private _options?: TaskOptions,
  ) {
    assert(_name, `flowId must be specified`);
    assert(steveo.storage, `storage must be provided to steveo in order to use workflows`);

    this.storage = steveo.storage;
    this.logger = steveo?.logger ?? nullLogger;
  }

  // Support the existing interface ITask by duck typing members
  get name() { return this._name; }
  get topic() { return this._topic; }
  get options() { return this._options; }

  /**
   *
   */
  next<State, Result>(step: Step<State, Result>): Workflow {
    this.steps.push(step as Step<unknown, unknown>);

    return this;
  }

  /**
   * ITask implementation of the subscribe method
   * On a Task this will execute the configured handler, but for a workflow
   * it will load the current state and execute the step, or continue
   * executing the rollback chain if there was an unrecoverable error.
   *
   * (Yes the name is confusing, I'm following precedent 😁)
   */
  async subscribe<T extends WorkflowPayload>(payload: T) {
    return this.execute(payload);
  }

  /**
   *
   */
  async execute<T extends WorkflowPayload>(payload: T) {

    if (!this.steps?.length) {
      throw new Error(`Steps must be defined before a flow is executed ${this._name}`);
    }

    await this.storage.transaction(async (transaction) => {
      const workflowId = payload.workflowId ?? `${this._name}-${v4()}`;

      if (!payload.workflowId) {
        await this.storage.workflow.createNewState(workflowId);
      }

      const state = await this.loadState(workflowId);

      if (!state.current) {
        throw new Error(`Workflow ${workflowId} step was undefined`);
      }

      // If this step has failed then we pass control over to the rollback executor.
      if (state.errors?.length) {
        await this.rollbackContinue(workflowId, state, transaction);
      }
      else {
        await this.executeForward(workflowId, payload, state);
      }
    });
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
        await this._producer.initialize(this.topic);

        await Promise.all(
          params.map((data: T) => {
            this._registry.emit('task_send', this.topic, data);
            return this._producer.send(this.topic, data, context?.key, context);
          })
        );

        this._registry.emit('task_success', this.topic, payload);
      }
      catch (err) {
        this._registry.emit('task_failure', this.topic, err);
        throw err;
      }
    });

  }

  /**
   *
   */
  private async executeForward(workflowId: string, payload: unknown, state: WorkflowState): Promise<void> {

    try {
      // TODO: Add `source` to the workflow state to check the current steveo instance service name it is running in  and prevent accidental network boundary crossing

      // TODO: Protect out of order excution or step re-execution

      const step = this.steps[state.current];

      // TODO: Further step validation (What? what were you thinking Paul? 🤦)

      const result = await step.execute(payload);

      await this.storage.workflow.recordStepResult(workflowId, state.current, result);

      state.results[state.current] = result;

      // TODO: Move execution pointer to next execution step
      const newStepId = '<TODO>';

      await this.storage.workflow.updateCurrentStep(state.flowId, newStepId);
    }
    catch (err) {
      await this.storage.workflow.recordError(workflowId, state.current, String(err));

      // TODO: Begin rollback
    }
  }

  /**
   *
   */
  private async rollbackContinue(workflowId: string, state: WorkflowState, _transaction: TransactionHandle): Promise<void> {

    try {
      // TODO: Execute rollback function

      // TODO: Move execution pointer to previous step in rollback

      // TODO: Update flow state properly
    }
    catch (err) {
      await this.storage.workflow.recordError(workflowId, state.current, String(err));

    }
  }

  /**
   *
   * @param flowId
   * @returns
   */
  private async loadState(flowId: string): Promise<WorkflowState> {
    const state = await this.storage.workflow.loadState(flowId);

    if (!flowId) {
      throw new Error(`workflowId was empty for ${this.name} run`);
    }

    if (!state) {
      throw new Error(`State was not found for workflowId ${flowId} in workflow ${this._name}`);
    }

    return state;
  }
}


