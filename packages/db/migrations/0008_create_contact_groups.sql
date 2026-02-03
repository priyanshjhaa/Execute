-- Create contact_groups table
CREATE TABLE IF NOT EXISTS contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  contact_ids JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS contact_groups_user_id_idx ON contact_groups(user_id);

-- Add updated_at trigger for contact_groups
CREATE TRIGGER update_contact_groups_updated_at BEFORE UPDATE ON contact_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
