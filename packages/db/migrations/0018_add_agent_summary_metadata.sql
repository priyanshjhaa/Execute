-- Tracks how much thread history has already been folded into rolling memory.
ALTER TABLE agent_threads
  ADD COLUMN IF NOT EXISTS summary_message_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMP;

ALTER TABLE agent_threads
  DROP CONSTRAINT IF EXISTS agent_threads_summary_message_count_check;

ALTER TABLE agent_threads
  ADD CONSTRAINT agent_threads_summary_message_count_check
  CHECK (summary_message_count >= 0);
