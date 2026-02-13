-- Add resume_at column to executions table for delay resume functionality
-- Add 'waiting' to the status enum values

ALTER TABLE "executions" ADD COLUMN "resume_at" timestamp;

-- Add index for efficiently querying executions ready to resume
CREATE INDEX "executions_resume_at_idx" ON "executions" ("resume_at");
