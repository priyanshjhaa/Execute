-- Create executions table
CREATE TABLE IF NOT EXISTS executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instruction TEXT,
  trigger_data JSONB,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  total_steps INTEGER,
  completed_steps INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS executions_workflow_id_idx ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS executions_user_id_idx ON executions(user_id);
CREATE INDEX IF NOT EXISTS executions_status_idx ON executions(status);
CREATE INDEX IF NOT EXISTS executions_created_at_idx ON executions(created_at);
