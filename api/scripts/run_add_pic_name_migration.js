import { poolWaschenPos } from '../db/connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '../db/migration_add_pic_name_to_expense.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing migration...');
    await poolWaschenPos.execute(migrationSql);
    console.log('✅ Migration executed successfully! Added pic_name column to tr_outlet_cash_expense');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
