import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/schema';
import { readFileSync } from 'fs';
import { join } from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Pankupriyansh@db.pxkpgxemevefwscraico.supabase.co:5432/postgres';

async function runMigrations() {
  console.log('Connecting to database...');

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  try {
    console.log('Running migration 0001: Create users table...');
    const migration1 = readFileSync(join(__dirname, 'migrations/0001_create_users.sql'), 'utf-8');
    await client.unsafe(migration1);
    console.log('✓ Migration 0001 completed');

    console.log('Running migration 0002: Create workflows table...');
    const migration2 = readFileSync(join(__dirname, 'migrations/0002_create_workflows.sql'), 'utf-8');

    // Split migration 2 into parts - execute only the workflows creation first
    const lines = migration2.split('\n');
    const workflowsCreation = lines.slice(0, 26).join('\n'); // Lines 1-26 create workflows table
    try {
      await client.unsafe(workflowsCreation);
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        throw e;
      }
    }
    console.log('✓ Workflows table created');

    console.log('Creating executions table...');
    const createExecutions = `
      CREATE TABLE IF NOT EXISTS executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        instruction TEXT,
        trigger_data JSONB,
        status VARCHAR(50) NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        total_steps INTEGER,
        completed_steps INTEGER DEFAULT 0,
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS executions_workflow_id_idx ON executions(workflow_id);
      CREATE INDEX IF NOT EXISTS executions_user_id_idx ON executions(user_id);
      CREATE INDEX IF NOT EXISTS executions_status_idx ON executions(status);
      CREATE INDEX IF NOT EXISTS executions_created_at_idx ON executions(created_at);
    `;
    await client.unsafe(createExecutions);
    console.log('✓ Executions table created');

    // Now run the rest of migration 2 (triggers and remaining parts)
    const remainingMigration = lines.slice(26).join('\n');
    try {
      await client.unsafe(remainingMigration);
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        throw e;
      }
    }
    console.log('✓ Triggers and remaining migrations completed');

    // Create steps table
    console.log('Creating steps table...');
    const createSteps = `
      CREATE TABLE IF NOT EXISTS steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL,
        step_type VARCHAR(100) NOT NULL,
        description TEXT,
        input_params JSONB NOT NULL,
        output_result JSONB,
        status VARCHAR(50) NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        depends_on JSONB,
        rollback_step JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS steps_execution_id_idx ON steps(execution_id);
      CREATE INDEX IF NOT EXISTS steps_status_idx ON steps(status);
    `;
    await client.unsafe(createSteps);
    console.log('✓ Steps table created');

    // Create execution_logs table
    console.log('Creating execution_logs table...');
    const createExecutionLogs = `
      CREATE TABLE IF NOT EXISTS execution_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
        step_id UUID REFERENCES steps(id) ON DELETE CASCADE,
        level VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS execution_logs_execution_id_idx ON execution_logs(execution_id);
      CREATE INDEX IF NOT EXISTS execution_logs_created_at_idx ON execution_logs(created_at);
    `;
    await client.unsafe(createExecutionLogs);
    console.log('✓ Execution logs table created');

    console.log('\n✓ All migrations completed successfully!');
  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
