/**
 * Migration Runner - My Waschen POS v4.1.0
 *
 * Run: node api/scripts/runNewMigrations.js
 *
 * This script runs all new migrations:
 * - 009_create_adjustments_table.sql
 * - 010_create_outstandings_table.sql
 * - 011_create_petty_cash_table.sql (DEPRECATED - use tr_pengajuan_belanja)
 * - 012_create_merge_table.sql
 * - 013_create_daily_report_table.sql
 * - 014_create_ap_request_table.sql
 * - 028_deprecate_petty_cash_tables.sql
 */

import 'dotenv/config';
import { poolWaschenPos } from '../db/connection.js';

const LOG_PREFIX = '📦 Migration';

async function log(message, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  console.log(`${icons[type] || '•'} ${LOG_PREFIX}: ${message}`);
}

async function tableExists(tableName) {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
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

async function runMigration(name, sql) {
  log(`Running: ${name}`);

  try {
    // Split into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 0) {
        await poolWaschenPos.execute(statement);
      }
    }

    log(`✓ ${name} completed`, 'success');
    return true;
  } catch (error) {
    // Check if it's just "table already exists" error
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      log(`⚠️ ${name} - Table already exists, skipping`, 'warning');
      return true;
    }

    // Check for duplicate key on ALTER
    if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_ENTRY') {
      log(`⚠️ ${name} - Column/index already exists, skipping`, 'warning');
      return true;
    }

    log(`✗ ${name} failed: ${error.message}`, 'error');
    return false;
  }
}

async function run() {
  console.log('\n' + '='.repeat(50));
  console.log('📦 My Waschen POS - Migration Runner v4.1.0');
  console.log('='.repeat(50) + '\n');

  const conn = await poolWaschenPos.getConnection();

  try {
    // Test connection
    await conn.ping();
    log('Database connection: OK', 'success');

    console.log('\n' + '-'.repeat(50));
    console.log('🚀 Starting migrations...');
    console.log('-'.repeat(50) + '\n');

    // =====================================================
    // 009 - Transaction Adjustments
    // =====================================================
    const m009_exists = await tableExists('tr_transaction_adjustments');

    if (!m009_exists) {
      await runMigration('009 - Transaction Adjustments Table', `
        CREATE TABLE IF NOT EXISTS \`tr_transaction_adjustments\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`transaction_id\` BIGINT UNSIGNED NOT NULL,
          \`adjustment_no\` VARCHAR(50) NOT NULL,
          \`type\` ENUM('price', 'quantity', 'discount', 'cancel', 'payment') NOT NULL,
          \`old_value\` DECIMAL(15,2) NOT NULL DEFAULT 0,
          \`new_value\` DECIMAL(15,2) NOT NULL DEFAULT 0,
          \`difference\` DECIMAL(15,2) NOT NULL DEFAULT 0,
          \`action\` ENUM('charge', 'refund', 'none') DEFAULT 'none',
          \`reason\` VARCHAR(255) NOT NULL,
          \`notes\` TEXT,
          \`item_id\` BIGINT UNSIGNED DEFAULT NULL,
          \`created_by\` BIGINT UNSIGNED NOT NULL,
          \`pic_name\` VARCHAR(100) DEFAULT NULL,
          \`outlet_id\` BIGINT UNSIGNED DEFAULT NULL,
          \`status\` ENUM('pending', 'approved', 'rejected', 'rolled_back') DEFAULT 'pending',
          \`approved_by\` BIGINT UNSIGNED DEFAULT NULL,
          \`approved_at\` DATETIME DEFAULT NULL,
          \`can_rollback\` TINYINT(1) DEFAULT 1,
          \`rolled_back_at\` DATETIME DEFAULT NULL,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_adjustment_no\` (\`adjustment_no\`),
          KEY \`idx_transaction_id\` (\`transaction_id\`),
          KEY \`idx_status\` (\`status\`),
          KEY \`idx_created_by\` (\`created_by\`),
          KEY \`idx_outlet_id\` (\`outlet_id\`),
          KEY \`idx_created_at\` (\`created_at\`),
          KEY \`idx_type\` (\`type\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } else {
      log('009 - Transaction Adjustments: Already exists', 'warning');
    }

    // Add columns to tr_transaction
    const hasRefundAmount = await columnExists('tr_transaction', 'refund_amount');
    if (!hasRefundAmount) {
      await runMigration('009b - Add refund columns to tr_transaction', `
        ALTER TABLE \`tr_transaction\`
        ADD COLUMN IF NOT EXISTS \`refund_amount\` DECIMAL(15,2) DEFAULT 0 AFTER \`change_amount\`,
        ADD COLUMN IF NOT EXISTS \`total_adjustments\` DECIMAL(15,2) DEFAULT 0 AFTER \`refund_amount\`,
        ADD COLUMN IF NOT EXISTS \`adjustment_count\` INT UNSIGNED DEFAULT 0 AFTER \`total_adjustments\`;
      `);
    }

    // =====================================================
    // 010 - Outstandings
    // =====================================================
    const m010_exists = await tableExists('tr_outstanding');

    if (!m010_exists) {
      await runMigration('010 - Outstanding/Receivables Table', `
        CREATE TABLE IF NOT EXISTS \`tr_outstanding\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`outlet_id\` BIGINT UNSIGNED NOT NULL,
          \`transaction_id\` BIGINT UNSIGNED DEFAULT NULL,
          \`customer_id\` BIGINT UNSIGNED NOT NULL,
          \`invoice_no\` VARCHAR(50) DEFAULT NULL,
          \`principal_name\` VARCHAR(100) NOT NULL,
          \`phone\` VARCHAR(20) DEFAULT NULL,
          \`amount\` DECIMAL(15,2) NOT NULL,
          \`paid_amount\` DECIMAL(15,2) DEFAULT 0,
          \`remaining_amount\` DECIMAL(15,2) GENERATED ALWAYS AS (amount - paid_amount) STORED,
          \`due_date\` DATE DEFAULT NULL,
          \`status\` ENUM('unpaid', 'partial', 'paid', 'overdue', 'written_off') DEFAULT 'unpaid',
          \`reminder_count\` INT UNSIGNED DEFAULT 0,
          \`last_reminder_at\` DATETIME DEFAULT NULL,
          \`notes\` TEXT,
          \`created_by\` BIGINT UNSIGNED NOT NULL,
          \`pic_name\` VARCHAR(100) DEFAULT NULL,
          \`paid_at\` DATETIME DEFAULT NULL,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_customer_id\` (\`customer_id\`),
          KEY \`idx_outlet_id\` (\`outlet_id\`),
          KEY \`idx_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS \`tr_outstanding_payment\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`outstanding_id\` BIGINT UNSIGNED NOT NULL,
          \`amount\` DECIMAL(15,2) NOT NULL,
          \`payment_method\` ENUM('cash', 'transfer', 'deposit', 'other') DEFAULT 'cash',
          \`reference_no\` VARCHAR(100) DEFAULT NULL,
          \`paid_by\` BIGINT UNSIGNED DEFAULT NULL,
          \`pic_name\` VARCHAR(100) DEFAULT NULL,
          \`notes\` VARCHAR(255) DEFAULT NULL,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_outstanding_id\` (\`outstanding_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS \`tr_outstanding_reminder\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`outstanding_id\` BIGINT UNSIGNED NOT NULL,
          \`reminder_type\` ENUM('wa', 'call', 'visit', 'other') DEFAULT 'wa',
          \`sent_to\` VARCHAR(50) DEFAULT NULL,
          \`message_preview\` VARCHAR(255) DEFAULT NULL,
          \`sent_by\` BIGINT UNSIGNED DEFAULT NULL,
          \`pic_name\` VARCHAR(100) DEFAULT NULL,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_outstanding_id\` (\`outstanding_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } else {
      log('010 - Outstandings: Already exists', 'warning');
    }

    // =====================================================
    // 011 - Petty Cash (DEPRECATED - migrated to 028)
    // =====================================================
    // This migration is now deprecated. Tables have been renamed to:
    // _deprecated_mst_petty_cash_category
    // _deprecated_tr_petty_cash
    // _deprecated_tr_petty_cash_summary
    // _deprecated_tr_petty_cash_reimbursement
    // Use tr_pengajuan_belanja with group_type='operasional' instead.
    const m011_exists = await tableExists('_deprecated_tr_petty_cash') || await tableExists('tr_petty_cash');

    if (!m011_exists) {
      log('011 - Petty Cash: Tables not found (may have been deprecated already)', 'warning');
    } else {
      log('011 - Petty Cash: Tables found (deprecated in migration 028)', 'warning');
    }

    // =====================================================
    // 012 - Transaction Merge
    // =====================================================
    const m012_exists = await tableExists('tr_transaction_merge');

    if (!m012_exists) {
      await runMigration('012 - Transaction Merge Tables', `
        CREATE TABLE IF NOT EXISTS \`tr_transaction_merge\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`outlet_id\` BIGINT UNSIGNED NOT NULL,
          \`merge_no\` VARCHAR(50) NOT NULL,
          \`primary_transaction_id\` BIGINT UNSIGNED NOT NULL,
          \`status\` ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
          \`reason\` VARCHAR(255) DEFAULT NULL,
          \`created_by\` BIGINT UNSIGNED NOT NULL,
          \`pic_name\` VARCHAR(100) DEFAULT NULL,
          \`approved_by\` BIGINT UNSIGNED DEFAULT NULL,
          \`approved_at\` DATETIME DEFAULT NULL,
          \`notes\` TEXT,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_merge_no\` (\`merge_no\`),
          KEY \`idx_primary_transaction\` (\`primary_transaction_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS \`tr_transaction_merge_item\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`merge_id\` BIGINT UNSIGNED NOT NULL,
          \`transaction_id\` BIGINT UNSIGNED NOT NULL,
          \`original_no\` VARCHAR(50) DEFAULT NULL,
          \`items_count\` INT UNSIGNED DEFAULT 0,
          \`total_amount\` DECIMAL(15,2) DEFAULT 0,
          \`status\` ENUM('pending', 'merged', 'rolled_back') DEFAULT 'pending',
          \`merged_at\` DATETIME DEFAULT NULL,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_merge_id\` (\`merge_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } else {
      log('012 - Transaction Merge: Already exists', 'warning');
    }

    // Add merged_from column to transaction items
    const hasMergedFrom = await columnExists('tr_transaction_item', 'merged_from_transaction_id');
    if (!hasMergedFrom) {
      await runMigration('012b - Add merged_from to tr_transaction_item', `
        ALTER TABLE \`tr_transaction_item\`
        ADD COLUMN IF NOT EXISTS \`merged_from_transaction_id\` BIGINT UNSIGNED DEFAULT NULL
        AFTER \`transaction_id\`;
      `);
    }

    // =====================================================
    // 013 - Daily Report
    // =====================================================
    const m013_exists = await tableExists('tr_daily_report_log');

    if (!m013_exists) {
      await runMigration('013 - Daily Report Tables', `
        CREATE TABLE IF NOT EXISTS \`mst_daily_report_template\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`code\` VARCHAR(50) NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`content\` TEXT NOT NULL,
          \`variables\` JSON DEFAULT NULL,
          \`is_active\` TINYINT(1) DEFAULT 1,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_template_code\` (\`code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        INSERT IGNORE INTO \`mst_daily_report_template\` (\`code\`, \`name\`, \`content\`, \`variables\`) VALUES
        ('daily_sales', 'Laporan Penjualan Harian', '📊 *LAPORAN PENJUALAN HARIAN*\\n\\n🏪 Outlet: *{outlet_name}*\\n📅 Tanggal: *{date}*\\n\\n💰 Total Penjualan: Rp {total_sales}\\n📤 Pengeluaran: Rp {total_expense}\\n\\n_Report: {generated_at}_', '["outlet_name","date","total_sales","total_expense","generated_at"]');

        CREATE TABLE IF NOT EXISTS \`tr_daily_report_log\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`outlet_id\` BIGINT UNSIGNED NOT NULL,
          \`report_date\` DATE NOT NULL,
          \`report_content\` TEXT NOT NULL,
          \`recipient_phone\` VARCHAR(20) DEFAULT NULL,
          \`recipient_name\` VARCHAR(100) DEFAULT NULL,
          \`sent_via\` ENUM('whatsapp', 'email', 'print', 'manual') DEFAULT 'manual',
          \`sent_by\` BIGINT UNSIGNED DEFAULT NULL,
          \`pic_name\` VARCHAR(100) DEFAULT NULL,
          \`sent_at\` DATETIME DEFAULT NULL,
          \`status\` ENUM('draft', 'sent', 'failed') DEFAULT 'draft',
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_outlet_date\` (\`outlet_id\`, \`report_date\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } else {
      log('013 - Daily Report: Already exists', 'warning');
    }

    // =====================================================
    // 014 - AP Request
    // =====================================================
    const m014_exists = await tableExists('tr_ap_request');

    if (!m014_exists) {
      await runMigration('014 - AP Request Tables', `
        CREATE TABLE IF NOT EXISTS \`mst_ap_category\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`name\` VARCHAR(50) NOT NULL,
          \`code\` VARCHAR(20) NOT NULL,
          \`icon\` VARCHAR(50) DEFAULT NULL,
          \`color\` VARCHAR(7) DEFAULT '#6B7280',
          \`is_active\` TINYINT(1) DEFAULT 1,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_ap_category_code\` (\`code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        INSERT IGNORE INTO \`mst_ap_category\` (\`name\`, \`code\`, \`icon\`, \`color\`) VALUES
          ('LPG / Gas Alam', 'lpg', '🔥', '#F59E0B'),
          ('Galon Air', 'galon', '💧', '#3B82F6'),
          ('Listrik', 'listrik', '⚡', '#FACC15'),
          ('Internet', 'internet', '📶', '#8B5CF6');

        CREATE TABLE IF NOT EXISTS \`tr_ap_request\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`outlet_id\` BIGINT UNSIGNED NOT NULL,
          \`request_no\` VARCHAR(50) NOT NULL,
          \`category_id\` BIGINT UNSIGNED NOT NULL,
          \`description\` VARCHAR(255) NOT NULL,
          \`amount\` DECIMAL(15,2) NOT NULL,
          \`period_month\` INT NOT NULL,
          \`period_year\` INT NOT NULL,
          \`due_date\` DATE DEFAULT NULL,
          \`status\` ENUM('pending', 'approved', 'rejected', 'paid', 'cancelled') DEFAULT 'pending',
          \`created_by\` BIGINT UNSIGNED NOT NULL,
          \`pic_name\` VARCHAR(100) DEFAULT NULL,
          \`approved_by\` BIGINT UNSIGNED DEFAULT NULL,
          \`approved_at\` DATETIME DEFAULT NULL,
          \`paid_by\` BIGINT UNSIGNED DEFAULT NULL,
          \`paid_at\` DATETIME DEFAULT NULL,
          \`notes\` TEXT,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_request_no\` (\`request_no\`),
          KEY \`idx_outlet_id\` (\`outlet_id\`),
          KEY \`idx_category_id\` (\`category_id\`),
          KEY \`idx_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS \`tr_ap_payment\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`ap_request_id\` BIGINT UNSIGNED NOT NULL,
          \`amount\` DECIMAL(15,2) NOT NULL,
          \`payment_method\` ENUM('cash', 'transfer', 'other') NOT NULL,
          \`reference_no\` VARCHAR(100) DEFAULT NULL,
          \`paid_by\` BIGINT UNSIGNED DEFAULT NULL,
          \`pic_name\` VARCHAR(100) DEFAULT NULL,
          \`notes\` TEXT DEFAULT NULL,
          \`paid_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_ap_request_id\` (\`ap_request_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } else {
      log('014 - AP Request: Already exists', 'warning');
    }

    // =====================================================
    // 028 - Deprecate Old Petty Cash Tables
    // =====================================================
    const m028_exists = await tableExists('_deprecated_tr_petty_cash');

    if (!m028_exists) {
      // Check if old tables still exist and rename them
      const old_tr_petty_exists = await tableExists('tr_petty_cash');
      const old_mst_petty_exists = await tableExists('mst_petty_cash_category');

      if (old_tr_petty_exists || old_mst_petty_exists) {
        await runMigration('028 - Deprecate Petty Cash Tables', `
          RENAME TABLE
            \`mst_petty_cash_category\` TO \`_deprecated_mst_petty_cash_category\`,
            \`tr_petty_cash\` TO \`_deprecated_tr_petty_cash\`,
            \`tr_petty_cash_summary\` TO \`_deprecated_tr_petty_cash_summary\`,
            \`tr_petty_cash_reimbursement\` TO \`_deprecated_tr_petty_cash_reimbursement\`;
        `);
        log('028 - Old petty cash tables renamed to deprecated prefix', 'success');
      } else {
        log('028 - Petty cash tables already deprecated or do not exist', 'warning');
      }
    } else {
      log('028 - Petty cash deprecation: Already done', 'warning');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ All migrations completed!');
    console.log('='.repeat(50) + '\n');

    console.log('📋 Next steps:');
    console.log('1. Restart your server');
    console.log('2. Test the new endpoints');
    console.log('3. Access new features in the dashboard\n');

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
