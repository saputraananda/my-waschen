import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { poolWaschenPos } from '../db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('[Migration] Running cash deposit table migration...');
  
  try {
    const sqlPath = path.join(__dirname, '../db/migration_add_cash_deposit.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      try {
        await poolWaschenPos.execute(statement);
        console.log('[Migration] Executed statement successfully');
      } catch (err) {
        // Ignore errors if table already exists
        if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
          throw err;
        }
        console.log('[Migration] Table already exists, skipping');
      }
    }
    
    console.log('[Migration] Cash deposit table migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Error:', err);
    process.exit(1);
  }
}

runMigration();
