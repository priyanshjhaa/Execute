CREATE TABLE IF NOT EXISTS "failure_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "execution_id" uuid NOT NULL REFERENCES "executions"("id") ON DELETE CASCADE,
  "workflow_id" uuid REFERENCES "workflows"("id") ON DELETE SET NULL,
  "category" varchar(60) NOT NULL,
  "severity" varchar(20) NOT NULL,
  "title" varchar(255) NOT NULL,
  "summary" text NOT NULL,
  "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "proposed_repair" jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "detected_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "dismissed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "failure_findings_status_check" CHECK ("status" IN ('open', 'resolved', 'dismissed')),
  CONSTRAINT "failure_findings_severity_check" CHECK ("severity" IN ('high', 'medium'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "failure_findings_execution_unique" ON "failure_findings" USING btree ("execution_id");
CREATE INDEX IF NOT EXISTS "failure_findings_user_status_idx" ON "failure_findings" USING btree ("user_id", "status");
CREATE INDEX IF NOT EXISTS "failure_findings_user_detected_idx" ON "failure_findings" USING btree ("user_id", "detected_at");
