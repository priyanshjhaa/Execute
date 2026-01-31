/**
 * Execution Package
 *
 * Dumb, strict workflow execution engine.
 * Runs steps, logs results, reports failures.
 */

export { WorkflowExecutor, createExecutor, type ExecutionOptions } from './executor.js';
export { TemplateResolver, createContext, templateResolver } from './context.js';
export type {
  ExecutionContext,
  ExecutionStatus,
  StepStatus,
  Step,
  StepResult,
  ExecutionResult,
  StepHandler,
  WorkflowDefinition,
  WorkflowInput,
  CreateExecutionInput,
  CreateStepInput,
} from './types.js';

export { getAllHandlers } from './steps/index.js';
