/**
 * Migration Runner: Service Variants System
 * Runs migrations 024 and 025 to add variant support
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { poolWaschenPos } from '../db/connection.js';
import mysql from 'mysql2/promise';

async function runMigration(filePath, name) {
  console.log(`\n🚀 Running ${name}...`);
  
  try {
    const sql = readFileSync(filePath, 'utf8');
    
    // Get connection with multipleStatements enabled
    const connection = await mysql.createConnection({
      host: process.env.HOST_WASCHEN_POS,
      port: Number(process.env.PORT_WASCHEN_POS),
      user: process.env.USER_WASCHEN_POS,
      password: process.env.PASS_WASCHEN_POS,
      database: process.env.DB_WASCHEN_POS,
      multipleStatements: true
    });
    
    try {
      await connection.query(sql);
      console.log(`✅ ${name} completed successfully!`);
      return true;
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(`❌ ${name} failed:`, error);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Service Variant System Migration Runner');
  console.log('═══════════════════════════════════════════════════════');
  
  // Run Migration 024: Create service_variant table
  const migration024 = await runMigration(
    'api/db/migrations/024_create_service_variants.sql',
    'Migration 024: Create Service Variants'
  );
  
  if (!migration024) {
    console.log('\n⚠️  Migration 024 failed. Stopping here.');
    process.exit(1);
  }
  
  // Run Migration 025: Add variant_id to transaction_item
  const migration025 = await runMigration(
    'api/db/migrations/025_add_variant_to_transaction_item.sql',
    'Migration 025: Add Variant to Transaction Items'
  );
  
  if (!migration025) {
    console.log('\n⚠️  Migration 025 failed.');
    process.exit(1);
  }
  
  // Show summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✅ All Migrations Completed Successfully!');
  console.log('═══════════════════════════════════════════════════════');
  
  console.log('\n📊 Variant System Summary:');
  
  const [variants] = await poolWaschenPos.execute(
    'SELECT code, name, price_multiplier, is_active FROM mst_service_variant ORDER BY sort_order'
  );
  
  console.table(variants);
  
  const [itemCount] = await poolWaschenPos.execute(
    'SELECT COUNT(*) as count FROM tr_transaction_item WHERE variant_id IS NOT NULL'
  );
  
  console.log(`\n📦 Transaction items with variants: ${itemCount[0].count}`);
  
  await poolWaschenPos.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
