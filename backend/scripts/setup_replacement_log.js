const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/jigfixtures?schema=public',
});

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL database');

  await client.query(`
    CREATE TABLE IF NOT EXISTS part_replacement_log (
      id TEXT PRIMARY KEY,
      design_id TEXT NOT NULL REFERENCES design(id) ON DELETE CASCADE,
      cell_part_id TEXT REFERENCES cell_part(id) ON DELETE SET NULL,
      part_number TEXT NOT NULL,
      part_name TEXT NOT NULL,
      replaced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      replaced_by TEXT NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      usage_at_replace INTEGER,
      days_used INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Table part_replacement_log created/verified successfully');

  await client.end();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
