export type ExecutionStatus = 'pending' | 'parsing' | 'generating' | 'executing' | 'completed' | 'failed' | 'cancelled';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type StepType = 'database_insert' | 'database_update' | 'database_delete' | 'database_query' | 'http_request' | 'file_write' | 'file_read' | 'file_delete' | 'email_send';

export interface Step {
  id: string;
  executionId: string;
  stepOrder: number;
  stepType: StepType;
  description: string;
  inputParams: any;
  outputResult?: any;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  dependsOn?: string[];
  rollbackStep?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Execution {
  id: string;
  userId: string;
  instruction: string;
  parsedIntent?: any;
  status: ExecutionStatus;
  startedAt?: Date;
  completedAt?: Date;
  totalSteps?: number;
  completedSteps: number;
  errorMessage?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  steps?: Step[];
}

export interface CreateExecutionDTO {
  instruction: string;
  context?: any;
}

export interface ParsedIntent {
  intent: string;
  operations: Array<{
    type: string;
    action: string;
    entity: string;
  }>;
}
