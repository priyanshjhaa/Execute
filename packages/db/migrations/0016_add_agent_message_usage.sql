-- Model and usage metadata for assistant messages
ALTER TABLE agent_messages
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS model VARCHAR(255),
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER;
