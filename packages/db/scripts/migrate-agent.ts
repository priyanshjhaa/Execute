import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  loadEnvFile(resolve(process.cwd(), '../../apps/web/.env.local'));
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const migrationNames = [
  '0017_create_agent_runs.sql',
  '0018_add_agent_summary_metadata.sql',
  '0019_create_agent_proposed_actions.sql',
  '0020_enforce_agent_action_expiry.sql',
  '0021_add_agent_action_results.sql',
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    await sql.begin(async (transaction) => {
      for (const migrationName of migrationNames) {
        const migrationPath = resolve(process.cwd(), 'migrations', migrationName);
        const migration = await readFile(migrationPath, 'utf8');
        await transaction.unsafe(migration);
        console.log(`Applied ${migrationName}`);
      }
    });
    console.log('Agent migrations completed successfully');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error('Agent migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
