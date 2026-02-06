-- Quick commands table (audit log for user one-shot commands)
CREATE TABLE IF NOT EXISTS quick_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  classified_intent JSONB NOT NULL,
  action_taken JSONB NOT NULL,
  status TEXT DEFAULT 'completed', -- completed | failed | pending
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS quick_commands_user_id_idx ON quick_commands(user_id);
CREATE INDEX IF NOT EXISTS quick_commands_created_at_idx ON quick_commands(created_at DESC);

-- Add comment
COMMENT ON TABLE quick_commands IS 'Audit log of user quick commands and their results';
