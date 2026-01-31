-- Create steps table
CREATE TABLE IF NOT EXISTS steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type VARCHAR(100) NOT NULL,
  description TEXT,
  input_params JSONB NOT NULL,
  output_result JSONB,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  depends_on JSONB,
  rollback_step JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS steps_execution_id_idx ON steps(execution_id);
CREATE INDEX IF NOT EXISTS steps_status_idx ON steps(status);
