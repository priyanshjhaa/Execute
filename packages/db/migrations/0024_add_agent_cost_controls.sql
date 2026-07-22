CREATE TABLE IF NOT EXISTS "agent_model_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "run_id" uuid REFERENCES "agent_runs"("id") ON DELETE SET NULL,
  "thread_id" uuid REFERENCES "agent_threads"("id") ON DELETE SET NULL,
  "sequence" integer NOT NULL,
  "purpose" varchar(20) NOT NULL,
  "provider" varchar(50) NOT NULL,
  "model" varchar(255) NOT NULL,
  "tier" varchar(20) DEFAULT 'fast' NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "latency_ms" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "agent_model_calls_purpose_check" CHECK ("purpose" IN ('response', 'summary')),
  CONSTRAINT "agent_model_calls_tier_check" CHECK ("tier" IN ('fast', 'reasoning')),
  CONSTRAINT "agent_model_calls_token_check" CHECK ("input_tokens" >= 0 AND "output_tokens" >= 0 AND "total_tokens" >= 0),
  CONSTRAINT "agent_model_calls_latency_check" CHECK ("latency_ms" >= 0)
);

CREATE INDEX IF NOT EXISTS "agent_model_calls_user_created_idx" ON "agent_model_calls" USING btree ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_model_calls_run_idx" ON "agent_model_calls" USING btree ("run_id");
CREATE INDEX IF NOT EXISTS "agent_model_calls_thread_idx" ON "agent_model_calls" USING btree ("thread_id");

CREATE TABLE IF NOT EXISTS "agent_workspace_context_cache" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "source_version" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "agent_workspace_context_cache_expires_idx" ON "agent_workspace_context_cache" USING btree ("expires_at");
