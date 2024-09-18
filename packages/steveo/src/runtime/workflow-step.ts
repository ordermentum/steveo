import { TaskOptions } from '../types/task-options';

/**
 * Type definition for a single workflow step that defines
 * what the engine is to execute to complete the task, or
 * (optionally), what to execute if the step fails irretrievably.
 */
export interface Step<StepState, StepResult> extends TaskOptions {
  /**
   * The steveo workflow step name that will kick off this
   * step. As the step is part of a workflow, this will
   * be intercepted and executed as a part of the
   * workflow execution engine.
   */
  name: string;

  /**
   * Override topic name
   */
  topic?: string;

  /**
   * Execute the step's implementation
   */
  execute: (state: StepState) => StepResult | Promise<StepResult>;

  /**
   *
   */
  rollback?: (state: StepState) => void | Promise<void>;
}

/**
 * StepUnknown is a requirement for the internal workflow engine
 * implementation as it tracks an array of steps, and as TS does
 * not have runtime type information (RTTI) the generic types
 * are lost.
 * So the above generic Step declaration is purely to aid the
 * fluent interface for development.
 */
export type StepUnknown = Step<unknown, unknown>;
