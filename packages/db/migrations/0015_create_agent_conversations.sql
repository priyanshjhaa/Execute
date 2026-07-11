-- Agent conversation threads
CREATE TABLE IF NOT EXISTS agent_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'New conversation',
  summary TEXT,
  last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_threads_user_id_idx
  ON agent_threads(user_id);

CREATE INDEX IF NOT EXISTS agent_threads_user_last_message_idx
  ON agent_threads(user_id, last_message_at);

CREATE INDEX IF NOT EXISTS agent_threads_last_message_at_idx
  ON agent_threads(last_message_at);

-- Structured messages within an agent thread
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_messages_role_check
    CHECK (role IN ('user', 'assistant', 'system', 'tool'))
);

CREATE INDEX IF NOT EXISTS agent_messages_thread_id_idx
  ON agent_messages(thread_id);

CREATE INDEX IF NOT EXISTS agent_messages_user_id_idx
  ON agent_messages(user_id);

CREATE INDEX IF NOT EXISTS agent_messages_thread_created_at_idx
  ON agent_messages(thread_id, created_at);

-- Reuse the shared updated_at function created by the base migrations.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_agent_threads_updated_at'
  ) THEN
    CREATE TRIGGER update_agent_threads_updated_at
      BEFORE UPDATE ON agent_threads
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;
