-- Logged events table (for storing expenses, clients, notes, etc.)
CREATE TABLE IF NOT EXISTS logged_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'client' | 'expense' | 'note' | 'task'
  title TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS logged_events_user_id_idx ON logged_events(user_id);
CREATE INDEX IF NOT EXISTS logged_events_event_type_idx ON logged_events(event_type);
CREATE INDEX IF NOT EXISTS logged_events_created_at_idx ON logged_events(created_at DESC);

-- Add comment
COMMENT ON TABLE logged_events IS 'User logged events: expenses, clients, notes, tasks';
