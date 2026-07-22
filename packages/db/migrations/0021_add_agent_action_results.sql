-- Stores the outcome of approved agent actions for idempotency and UI reporting.
ALTER TABLE agent_proposed_actions
  ADD COLUMN IF NOT EXISTS execution_started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS execution_completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS result JSONB,
  ADD COLUMN IF NOT EXISTS error_message TEXT;
