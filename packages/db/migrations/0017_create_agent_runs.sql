-- Tracks active model responses so authenticated users can cancel them safely.
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES agent_threads(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_runs_status_check
    CHECK (status IN ('running', 'completed', 'cancelled', 'failed'))
);

CREATE INDEX IF NOT EXISTS agent_runs_user_id_idx
  ON agent_runs(user_id);

CREATE INDEX IF NOT EXISTS agent_runs_user_status_idx
  ON agent_runs(user_id, status);
