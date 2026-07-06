// ─────────────────────────────────────────────────────────────────────────────
// runAllMigrations.js — Run all Phase 7-8 Migrations
// Phase 7: Birthday Program + Phase 8: Error Tracking
// ─────────────────────────────────────────────────────────────────────────────
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration from environment (same as server.js)
const config = {
  host: process.env.HOST_WASCHEN_POS || '103.197.189.185',
  port: parseInt(process.env.PORT_WASCHEN_POS || '3306'),
  user: process.env.USER_WASCHEN_POS || 'waschen',
  password: process.env.PASS_WASCHEN_POS || 'WaschenDE2025!',
  database: process.env.DB_WASCHEN_POS || 'my_waschen',
  multipleStatements: true,
};

// Migration files in execution order (use fixed versions)
const migrationFiles = [
  // Phase 2: Membership Enhancement
  { file: '001_membership_enhancement.sql', name: 'Membership Enhancement' },
  // Phase 3: Sub-Session System
  { file: '002_sub_session_system.sql', name: 'Sub-Session System' },
  // Phase 7-8: Combined fixed migrations (Birthday + Error Tracking)
  { file: '006_combined_migrations_fixed.sql', name: 'Combined (Birthday + Error Tracking)' },
  // Performance indexes
  { file: '007_performance_indexes_fixed.sql', name: 'Performance Indexes' },
];

// Also run the legacy migrations from api/db/
const legacyMigrations = [
  { file: 'migration_missing_tables.sql', name: 'Missing Tables', folder: 'db' },
  { file: 'migration_setor.sql', name: 'Setor Tunai System', folder: 'db' },
  { file: 'migration_handover.sql', name: 'Shift Handover', folder: 'db' },
  { file: 'migration_add_cash_deposit.sql', name: 'Cash Deposit', folder: 'db' },
  { file: 'migration_add_pic_name_to_expense.sql', name: 'Add PIC Name to Expense', folder: 'db' },
];

async function checkTableExists(connection, tableName) {
  try {
    const [rows] = await connection.query(`
      SELECT COUNT(*) as cnt FROM information_schema.tables
      WHERE table_schema = ? AND table_name = ?
    `, [config.database, tableName]);
    return rows[0].cnt > 0;
  } catch {
    return false;
  }
}

async function checkColumnExists(connection, tableName, columnName) {
  try {
    const [rows] = await connection.query(`
      SELECT COUNT(*) as cnt FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ? AND column_name = ?
    `, [config.database, tableName, columnName]);
    return rows[0].cnt > 0;
  } catch {
    return false;
  }
}

async function runMigration(connection, migration) {
  const { file, name, folder = 'migrations' } = migration;
  const filePath = path.join(__dirname, '..', folder, file);

  console.log(`\n📄 ${name} (${file})`);
  console.log('─'.repeat(50));

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  File not found: ${filePath}`);
    return { success: true, skipped: true, reason: 'File not found' };
  }

  // Read SQL file
  const sql = fs.readFileSync(filePath, 'utf8');

  // Split into individual statements
  const statements = [];
  let currentStatement = '';
  let inDelimiter = false;
  let delimiter = '//';
  let parenDepth = 0;

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and full-line comments
    if (!trimmed || trimmed.startsWith('--')) continue;

    if (trimmed.toUpperCase().startsWith('DELIMITER')) {
      const parts = trimmed.split(/\s+/);
      delimiter = parts[1] || '//';
      inDelimiter = !inDelimiter;
      if (!inDelimiter && currentStatement.trim()) {
        statements.push(currentStatement.trim());
        currentStatement = '';
        parenDepth = 0;
      }
    } else if (inDelimiter) {
      // Inside DELIMITER block (trigger)
      currentStatement += '\n' + line;
      if (line.includes(delimiter)) {
        const stmt = currentStatement.replace(new RegExp(`${delimiter}$`), '').trim();
        if (stmt) statements.push(stmt);
        currentStatement = '';
      }
    } else {
      // Normal mode - split on semicolons, but track parens
      for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch === '(') parenDepth++;
        else if (ch === ')') parenDepth--;

        if (ch === ';' && parenDepth === 0) {
          // End of statement
          if (currentStatement.trim()) {
            statements.push(currentStatement.trim());
          }
          currentStatement = '';
        } else {
          currentStatement += ch;
        }
      }
      currentStatement += '\n';
    }
  }
  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const stmt of statements) {
    if (!stmt.trim()) continue;

    // Skip comment-only statements
    const cleanStmt = stmt.trim();
    if (cleanStmt.startsWith('--')) continue;

    try {
      await connection.query(stmt);
      successCount++;
    } catch (err) {
      // Common skip-worthy errors
      if (
        err.code === 'ER_TABLE_EXISTS_ERROR' ||
        err.code === 'ER_DUP_FIELDNAME' ||
        err.code === 'ER_DUP_KEYNAME' ||
        err.message.includes('already exists') ||
        err.message.includes('Duplicate key name') ||
        err.message.includes('already has a default value')
      ) {
        skipCount++;
      } else if (err.message.includes('CHECK constraint')) {
        // CHECK constraint already exists - skip
        skipCount++;
      } else {
        console.log(`   ❌ Error in statement: ${err.message.substring(0, 100)}...`);
        console.log(`   Statement: ${stmt.substring(0, 100)}...`);
        errorCount++;
      }
    }
  }

  console.log(`   ✅ ${successCount} statements executed`);
  if (skipCount > 0) console.log(`   ⏭️  ${skipCount} statements skipped (already exists)`);
  if (errorCount > 0) console.log(`   ❌ ${errorCount} statements failed`);

  return { success: errorCount === 0, successCount, skipCount, errorCount };
}

async function verifyMigrations(connection) {
  console.log('\n\n🔍 Verifying Migration Results');
  console.log('═'.repeat(50));

  // Check new tables
  const newTables = [
    'tr_birthday_notification',
    'tr_birthday_offer',
    'tr_birthday_promo_code',
    'tr_error_log',
    'tr_cashier_sub_session',
    'tr_shift_handover',
  ];

  console.log('\n📊 New Tables:');
  for (const table of newTables) {
    const exists = await checkTableExists(connection, table);
    console.log(`   ${exists ? '✅' : '❌'} ${table}`);
  }

  // Check new columns in mst_membership
  const membershipCols = ['tier', 'last_transaction_at', 'inactivity_months'];
  console.log('\n📊 Columns in mst_membership:');
  for (const col of membershipCols) {
    const exists = await checkColumnExists(connection, 'mst_membership', col);
    console.log(`   ${exists ? '✅' : '❌'} ${col}`);
  }

  // Check new columns in mst_customer
  const customerCols = ['birth_date', 'birth_month', 'birth_day'];
  console.log('\n📊 Columns in mst_customer:');
  for (const col of customerCols) {
    const exists = await checkColumnExists(connection, 'mst_customer', col);
    console.log(`   ${exists ? '✅' : '❌'} ${col}`);
  }

  // Check new columns in tr_transaction
  const trxCols = ['sub_session_id'];
  console.log('\n📊 Columns in tr_transaction:');
  for (const col of trxCols) {
    const exists = await checkColumnExists(connection, 'tr_transaction', col);
    console.log(`   ${exists ? '✅' : '❌'} ${col}`);
  }

  // Check tr_wallet_ledger
  console.log('\n📊 Columns in tr_wallet_ledger:');
  const walletColExists = await checkColumnExists(connection, 'tr_wallet_ledger', 'is_forfeiture');
  console.log(`   ${walletColExists ? '✅' : '❌'} is_forfeiture`);

  // Check mst_app_config for new entries
  console.log('\n📊 App Config Entries:');
  const newConfigs = [
    'birthday_greeting_enabled',
    'birthday_deposit_bonus_default',
    'birthday_discount_pct',
    'birthday_discount_valid_days',
    'gold_min_topup',
    'diamond_min_topup',
  ];
  for (const configKey of newConfigs) {
    try {
      const [rows] = await connection.query(
        `SELECT config_val FROM mst_app_config WHERE config_key = ? LIMIT 1`,
        [configKey]
      );
      const exists = rows.length > 0;
      console.log(`   ${exists ? '✅' : '⚠️'} ${configKey}: ${exists ? rows[0].config_val : '(not found)'}`);
    } catch {
      console.log(`   ❌ ${configKey}`);
    }
  }

  // Check views
  console.log('\n📊 Views:');
  try {
    const [views] = await connection.query(`
      SELECT table_name FROM information_schema.views
      WHERE table_schema = ? AND table_name = 'v_birthday_today'
    `, [config.database]);
    console.log(`   ${views.length > 0 ? '✅' : '❌'} v_birthday_today`);
  } catch {
    console.log('   ❌ v_birthday_today');
  }
}

async function main() {
  console.log('═'.repeat(50));
  console.log('🚀 My Waschen - All Phase 7-8 Migrations');
  console.log('═'.repeat(50));
  console.log(`\n📍 Database: ${config.database}@${config.host}:${config.port}`);

  let connection;

  try {
    console.log('\n🔌 Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected successfully!\n');

    // Run Phase 7-8 migrations
    console.log('\n📦 Phase 7-8 Migrations (api/migrations/)');
    console.log('─'.repeat(50));
    for (const migration of migrationFiles) {
      const result = await runMigration(connection, migration);
      if (!result.success && !result.skipped) {
        console.log(`   ⚠️  Some statements failed in ${migration.file}`);
      }
    }

    // Run legacy migrations
    console.log('\n📦 Legacy Migrations (api/db/)');
    console.log('─'.repeat(50));
    for (const migration of legacyMigrations) {
      const result = await runMigration(connection, migration);
      if (!result.success && !result.skipped) {
        console.log(`   ⚠️  Some statements failed in ${migration.file}`);
      }
    }

    // Verify results
    await verifyMigrations(connection);

    console.log('\n\n' + '═'.repeat(50));
    console.log('🎉 All migrations completed!');
    console.log('═'.repeat(50));

  } catch (err) {
    console.error('\n❌ Migration failed:');
    console.error(err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

main();
