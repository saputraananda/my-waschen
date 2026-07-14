/**
 * Migration: 026 - Add customer photo column & sync gender from greeting
 * Run: node api/scripts/run_migration_026.js
 */

import 'dotenv/config';
import { poolWaschenPos } from '../db/connection.js';

const LOG_PREFIX = '📦 Migration 026';

async function log(message, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  console.log(`${icons[type] || '•'} ${LOG_PREFIX}: ${message}`);
}

async function columnExists(tableName, columnName) {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function run() {
  console.log('\n' + '='.repeat(50));
  console.log('📦 My Waschen POS - Migration 026');
  console.log('   Add customer photo + gender sync');
  console.log('='.repeat(50) + '\n');

  const conn = await poolWaschenPos.getConnection();

  try {
    await conn.ping();
    log('Database connection: OK', 'success');

    // =====================================================
    // STEP 1: Add photo column to mst_customer
    // =====================================================
    const photoExists = await columnExists('mst_customer', 'photo');

    if (!photoExists) {
      log('Adding photo column to mst_customer...');
      await conn.execute(
        'ALTER TABLE `mst_customer` ADD COLUMN `photo` VARCHAR(500) DEFAULT NULL COMMENT \'URL foto profil customer\' AFTER `birth_day`'
      );
      log('✅ photo column added', 'success');
    } else {
      log('⚠️ photo column already exists, skipping', 'warning');
    }

    // =====================================================
    // STEP 2: Backfill gender from greeting
    // =====================================================
    log('Backfilling gender from greeting...');

    const [result] = await conn.execute(`
      UPDATE \`mst_customer\`
      SET \`gender\` = 'male'
      WHERE \`greeting\` IN ('Bapak', 'Mas')
        AND (\`gender\` NOT IN ('male', 'female', 'other') OR \`gender\` IS NULL)
    `);
    log(`   male: ${result.affectedRows} updated`);

    const [result2] = await conn.execute(`
      UPDATE \`mst_customer\`
      SET \`gender\` = 'female'
      WHERE \`greeting\` IN ('Ibu', 'Mbak')
        AND (\`gender\` NOT IN ('male', 'female', 'other') OR \`gender\` IS NULL)
    `);
    log(`   female: ${result2.affectedRows} updated`);

    const [result3] = await conn.execute(`
      UPDATE \`mst_customer\`
      SET \`gender\` = 'other'
      WHERE \`greeting\` IN ('Kak', 'Other')
        AND (\`gender\` NOT IN ('male', 'female', 'other') OR \`gender\` IS NULL)
    `);
    log(`   other: ${result3.affectedRows} updated`);

    // =====================================================
    // STEP 3: Backfill birth_month / birth_day
    // =====================================================
    log('Backfilling birth_month/birth_day from birth_date...');

    const [result4] = await conn.execute(`
      UPDATE \`mst_customer\`
      SET
        \`birth_month\` = MONTH(\`birth_date\`),
        \`birth_day\`   = DAY(\`birth_date\`)
      WHERE \`birth_date\` IS NOT NULL
        AND (\`birth_month\` IS NULL OR \`birth_day\` IS NULL)
    `);
    log(`   birth data: ${result4.affectedRows} updated`, 'success');

    // =====================================================
    // Verify
    // =====================================================
    const [verify] = await conn.execute(`
      SELECT gender, greeting, COUNT(*) as count
      FROM mst_customer
      WHERE is_active = 1
      GROUP BY gender, greeting
    `);
    log('\nVerification (gender distribution):');
    verify.forEach(row => {
      log(`   ${row.greeting} → ${row.gender}: ${row.count} customer`, 'info');
    });

    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration 026 completed!');
    console.log('='.repeat(50) + '\n');
    console.log('📋 Next steps:');
    console.log('1. Restart your server');
    console.log('2. Test avatar display on TransaksiListPage\n');

  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    conn.release();
    await poolWaschenPos.end();
  }
}

run();
