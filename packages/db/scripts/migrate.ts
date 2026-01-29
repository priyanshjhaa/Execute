import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/schema';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

async function runMigrations() {
  console.log('Running migrations...');

  // Read and execute the workflows migration
  const migrationSQL = readFileSync(join(__dirname, '../migrations/0002_create_workflows.sql'), 'utf-8');

  try {
    await client.unsafe(migrationSQL);
    console.log('✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

runMigrations();
