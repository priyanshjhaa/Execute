import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = postgres(connectionString);

async function runMigrations() {
  try {
    console.log('Running quick command migrations...');

    const migrations = [
      '0011_quick_commands.sql',
      '0012_logged_events.sql',
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
