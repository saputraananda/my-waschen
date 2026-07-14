/**
 * Migration Runner — runs pending DB migrations against my_waschen
 * Uses query() instead of execute() to support multi-statement SQL
 */
import mysql from 'mysql2/promise'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const MIGRATIONS_DIR = join(PROJECT_ROOT, 'api/db/migrations')

const pool = mysql.createPool({
  host: process.env.HOST_WASCHEN_POS || '103.197.189.185',
  port: Number(process.env.PORT_WASCHEN_POS || 3306),
  user: process.env.USER_WASCHEN_POS || 'waschen',
  password: process.env.PASS_WASCHEN_POS || 'WaschenDE2025!',
  database: process.env.DB_WASCHEN_POS || 'my_waschen',
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 5,
})

async function getAppliedMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  const [rows] = await pool.execute('SELECT name FROM _migrations ORDER BY id')
  return new Set(rows.map(r => r.name))
}

async function checkColumn(table, column) {
  try {
    const [rows] = await pool.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [table, column]
    )
    return rows.length > 0
  } catch { return false }
}

async function runMigration(sql, name) {
  const conn = await pool.getConnection()
  try {
    await conn.query(sql)
    await conn.execute(
      'INSERT INTO _migrations (name) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = NOW()',
      [name]
    )
    console.log(`  ✓ ${name}`)
  } catch (err) {
    const ignored = [
      'ER_DUP_ENTRY', 'ER_TABLE_EXISTS_ERROR', 'ER_DUP_FIELDNAME',
      'ER_COLUMN_EXISTS', 'ER_TABLE_EXISTS', 'ER_DUP_KEYNAME',
      'ER_FK_CANNOT_OPEN_PARENT', 'ER_FK_INCOMPATIBLE_COLUMNS',
    ]
    if (ignored.includes(err.code)) {
      console.log(`  ✓ ${name} (skipped: ${err.code})`)
    } else {
      console.error(`  ✗ ${name}: [${err.code}] ${err.message}`)
    }
  } finally {
    conn.release()
  }
}

async function main() {
  console.log('=== Waschen POS — Migration Runner ===\n')
  console.log(`Database: my_waschen\n`)

  const applied = await getAppliedMigrations()
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  console.log(`Found ${files.length} migration files\n`)

  let ran = 0
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  — ${file} (already applied)`)
      continue
    }
    console.log(`Running: ${file}`)
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    try {
      await runMigration(sql, file)
      ran++
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`)
    }
  }

  if (ran === 0) {
    console.log('\nNo new migrations to apply.')
  } else {
    console.log(`\nDone. Applied ${ran} migration(s).`)
  }

  // ── Schema health check ──────────────────────────────────────────────────
  console.log('\n=== Schema Health Check ===')
  const checks = [
    ['tr_audit_log', 'pic_id'],
    ['tr_transaction', 'pic_id'],
    ['tr_purchase_request', 'pic_id'],
    ['mst_promo', 'applicable_services'],
    ['mst_promo', 'applicable_categories'],
    ['mst_promo', 'applicable_type'],
    ['mst_promo', 'promo_type'],
    ['mst_customer', 'birth_day'],
    ['mst_customer', 'birth_month'],
    ['tr_production', 'photo_url'],
    ['mst_membership', 'bonus_enabled'],
  ]
  for (const [table, col] of checks) {
    const ok = await checkColumn(table, col)
    console.log(`  ${ok ? '✓' : '✗'} ${table}.${col}`)
  }

  await pool.end()
}

main().catch(console.error)
