import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load .env.local from web app
config({ path: join(__dirname, '../../apps/web/.env.local') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = postgres(connectionString);

async function runMigrations() {
  try {
    console.log('Running migrations...');

    // Read and run migrations in order
    const migrations = [
      '0003_create_executions.sql',
      '0004_create_steps.sql',
      '0005_create_execution_logs.sql',
      '0006_create_templates.sql',
    ];

    for (const migration of migrations) {
      console.log(`Running ${migration}...`);
      const content = readFileSync(join(__dirname, 'migrations', migration), 'utf-8');
      await sql.unsafe(content);
      console.log(`✓ ${migration} completed`);
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();
