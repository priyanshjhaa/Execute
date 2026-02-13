-- Create forms table
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  fields JSONB,
  public_slug VARCHAR(100) UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS forms_user_id_idx ON forms(user_id);
CREATE INDEX IF NOT EXISTS forms_workflow_id_idx ON forms(workflow_id);
CREATE INDEX IF NOT EXISTS forms_public_slug_idx ON forms(public_slug);
CREATE INDEX IF NOT EXISTS forms_is_active_idx ON forms(is_active);

-- Add updated_at trigger for forms
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create form_submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS form_submissions_form_id_idx ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS form_submissions_created_at_idx ON form_submissions(created_at);
