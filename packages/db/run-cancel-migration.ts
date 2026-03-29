import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = postgres(connectionString);

async function runMigration() {
  try {
    console.log('Running migration: add cancel_requested column...');

    const migration = readFileSync(join(__dirname, 'migrations/0010_add_execution_cancellation.sql'), 'utf-8');
    await sql.unsafe(migration);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
