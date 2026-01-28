-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  webhook_id VARCHAR(255),
  schedule_expression VARCHAR(255),
  last_executed_at TIMESTAMP WITH TIME ZONE,
  total_executions INTEGER DEFAULT 0,
  success_rate INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS workflows_user_id_idx ON workflows(user_id);
CREATE INDEX IF NOT EXISTS workflows_status_idx ON workflows(status);
CREATE INDEX IF NOT EXISTS workflows_trigger_type_idx ON workflows(trigger_type);
CREATE INDEX IF NOT EXISTS workflows_webhook_id_idx ON workflows(webhook_id);
CREATE INDEX IF NOT EXISTS workflows_created_at_idx ON workflows(created_at);

-- Update executions table to reference workflows
ALTER TABLE executions
ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE;

ALTER TABLE executions
ADD COLUMN IF NOT EXISTS trigger_data JSONB;

-- Drop instruction column requirement (make it nullable)
-- For one-off executions without a workflow
ALTER TABLE executions
ALTER COLUMN instruction DROP NOT NULL;

-- Create index on workflow_id
CREATE INDEX IF NOT EXISTS executions_workflow_id_idx ON executions(workflow_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_executions_updated_at BEFORE UPDATE ON executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
