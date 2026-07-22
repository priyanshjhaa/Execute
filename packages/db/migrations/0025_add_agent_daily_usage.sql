CREATE TABLE IF NOT EXISTS "agent_daily_usage" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "usage_date" date NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "model_call_count" integer DEFAULT 0 NOT NULL,
  "reasoning_call_count" integer DEFAULT 0 NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "agent_daily_usage_pkey" PRIMARY KEY ("user_id", "usage_date"),
  CONSTRAINT "agent_daily_usage_non_negative_check" CHECK (
    "request_count" >= 0 AND "model_call_count" >= 0 AND "reasoning_call_count" >= 0
    AND "input_tokens" >= 0 AND "output_tokens" >= 0 AND "total_tokens" >= 0
  )
);

CREATE INDEX IF NOT EXISTS "agent_daily_usage_date_idx" ON "agent_daily_usage" USING btree ("usage_date");
