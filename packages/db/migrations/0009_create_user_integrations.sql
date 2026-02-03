-- Create user_integrations table
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS user_integrations_user_id_idx ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS user_integrations_type_idx ON user_integrations(type);
CREATE INDEX IF NOT EXISTS user_integrations_user_type_idx ON user_integrations(user_id, type);

-- Add updated_at trigger for user_integrations
CREATE TRIGGER update_user_integrations_updated_at BEFORE UPDATE ON user_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
