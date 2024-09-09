import { v4 } from 'uuid';
import { WorkflowStateRepository, WorkflowState, Database, Transaction } from '@steveojs/common';
import { Step } from "./types/workflow-step";
import assert from 'node:assert';
import { IProducer, IRegistry, Logger, TaskOptions } from './common';
import nullLogger from 'null-logger';
import { Steveo } from '.';

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

  // TODO: Change over to concrete implementations when done
  stateRepo = new WorkflowStateRepository();

  db = new Database();

  constructor(
    steveo: Steveo,
    private _name: string,
    private _topic: string,
    private _registry: IRegistry,
    private _producer: IProducer,
    private _options?: TaskOptions,
  ) {
    assert(_name, `flowId must be specified`);

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
    const transaction = await this.db.transaction();

    try {
      const workflowId = payload.workflowId ?? `${this._name}-${v4()}`;

      if (!payload.workflowId) {
        // TODO: Save new workflow state in DB
        // await this.db.
      }

      await this.executeForward(workflowId, payload, transaction);

      transaction.commit();
    }
    catch (err) {
      transaction.rollback();

      throw err;
    }
  }

  /**
   *
   * @param payload
   */
  async publish<T>(payload: T | T[], context?: { key: string }) {
    const transaction = await this.db.transaction();
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

      transaction.commit();

      this._registry.emit('task_success', this.topic, payload);
    }
    catch (err) {
      transaction.rollback();

      this._registry.emit('task_failure', this.topic, err);
      throw err;
    }
  }

  /**
   *
   */
  private async executeForward(workflowId: string, payload: unknown, transaction: Transaction): Promise<void> {

    if (!this.steps?.length) {
      throw new Error(`Steps must be defined before a flow is executed ${this._name}`);
    }

    const flowState = await this.loadState(workflowId);

    try {

      if (flowState.current < 0) {
        throw new Error(`Workflow ${workflowId} step ${flowState.current} cannot be less than zero`);
      }

      if (flowState.current > flowState.results.length) {
        throw new Error(`Workflow ${workflowId} step ${flowState.current} exceeds available steps ${flowState.results.length}`)
      }

      // If this state has failed then we pass control over to the
      // rollback executor.
      if (flowState.failedStep) {
        return this.rollbackContinue(flowState, transaction);
      }

      // TODO: Add `source` to the workflow state to check the current steveo instance service name it is running in  and prevent accidental network boundary crossing

      // TODO: Protect out of order excution or step re-execution

      const step = this.steps[flowState.current];

      // TODO: Further step validation (What? what were you thinking Paul? 🤦)

      const result = await step.execute(payload);

      // TODO: Update state

      flowState.results[flowState.current] = result;
      flowState.current++;

      this.stateRepo.saveState(flowState.flowId, flowState);

      transaction.commit();
    }
    catch (err) {
      const isError = err instanceof Error;

      flowState.failedStep = flowState.current;
      flowState.failedErrMsg = isError ? err.message : `Unknown error: ${err?.toString()}`;
      flowState.failedErrStack = isError ? err.stack : undefined;

      // TODO: Update database

      // TODO: Start rollback execution

      // TODO: Catch errors in rollback execution

      throw err;
    }
  }

  /**
   *
   */
  private async rollbackContinue(flowState: WorkflowState, _transaction: Transaction): Promise<void> {

    // TODO: Execute rollback function

    flowState.current--;

    // TODO: Update flow state properly
  }

  /**
   *
   * @param flowId
   * @returns
   */
  private async loadState(flowId: string): Promise<WorkflowState> {
    const state = await this.stateRepo.loadState(flowId);

    if (!flowId) {
      throw new Error(`workflowId was empty for ${this.name} run`);
    }

    if (!state) {
      throw new Error(`State was not found for workflowId ${flowId} in workflow ${this._name}`);
    }

    return state;
  }
}


