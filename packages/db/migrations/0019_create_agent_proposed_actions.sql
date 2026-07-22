-- Persists tenant-scoped agent actions that require an explicit user decision.
CREATE TABLE IF NOT EXISTS agent_proposed_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  assistant_message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP,
  decided_at TIMESTAMP,
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_proposed_actions_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS agent_proposed_actions_user_id_idx
  ON agent_proposed_actions(user_id);

CREATE INDEX IF NOT EXISTS agent_proposed_actions_thread_id_idx
  ON agent_proposed_actions(thread_id);

CREATE INDEX IF NOT EXISTS agent_proposed_actions_user_status_idx
  ON agent_proposed_actions(user_id, status);

CREATE INDEX IF NOT EXISTS agent_proposed_actions_thread_created_at_idx
  ON agent_proposed_actions(thread_id, created_at);
