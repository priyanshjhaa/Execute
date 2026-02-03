-- Add cancel_requested column to executions table
ALTER TABLE executions ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN DEFAULT FALSE;

-- Create index for faster cancellation checks
CREATE INDEX IF NOT EXISTS executions_cancel_requested_idx ON executions(cancel_requested) WHERE cancel_requested = TRUE;
