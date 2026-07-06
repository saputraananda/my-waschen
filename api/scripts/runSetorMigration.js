import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '103.197.189.185', port: 3306, user: 'waschen',
  password: 'WaschenDE2025!', database: 'my_waschen'
});

console.log('Connected. Running setor migration...\n');

// 1. Create tr_cash_deposit table
try {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS tr_cash_deposit (
      id BIGINT NOT NULL AUTO_INCREMENT,
      outlet_id BIGINT NOT NULL,
      cashier_id BIGINT NOT NULL,
      session_id BIGINT DEFAULT NULL,
      deposit_date DATE NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      proof_photo_url TEXT,
      notes TEXT,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      approved_by BIGINT DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      rejection_reason TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_cd_outlet (outlet_id),
      KEY idx_cd_cashier (cashier_id),
      KEY idx_cd_session (session_id),
      KEY idx_cd_status (status),
      KEY idx_cd_date (deposit_date),
      CONSTRAINT fk_cd_outlet FOREIGN KEY (outlet_id) REFERENCES mst_outlet (id),
      CONSTRAINT fk_cd_cashier FOREIGN KEY (cashier_id) REFERENCES mst_user (id),
      CONSTRAINT fk_cd_approver FOREIGN KEY (approved_by) REFERENCES mst_user (id),
      CONSTRAINT fk_cd_session FOREIGN KEY (session_id) REFERENCES tr_cashier_session (id),
      CONSTRAINT chk_cd_amount CHECK (amount > 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ tr_cash_deposit created');
} catch (e) { console.log('⚠️ tr_cash_deposit:', e.message); }

// 2. Add columns to tr_cashier_session
const cols = [
  ['total_setor', "DECIMAL(15,2) DEFAULT '0.00'"],
  ['deposit_notes', 'TEXT'],
];
for (const [col, def] of cols) {
  try {
    const [check] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'tr_cashier_session' AND column_name = ?`, [col]
    );
    if (check[0].cnt === 0) {
      await conn.query(`ALTER TABLE tr_cashier_session ADD COLUMN \`${col}\` ${def}`);
      console.log(`✅ tr_cashier_session.${col} added`);
    } else {
      console.log(`⏭️ tr_cashier_session.${col} exists`);
    }
  } catch (e) { console.log(`⚠️ ${col}:`, e.message); }
}

// 3. Indexes
const indexes = [
  ['tr_cash_deposit', 'idx_cd_outlet_date', '(outlet_id, deposit_date)'],
  ['tr_cash_deposit', 'idx_cd_cashier_status', '(cashier_id, status)'],
];
for (const [table, name, cols] of indexes) {
  try {
    await conn.query(`CREATE INDEX \`${name}\` ON \`${table}\` ${cols}`);
    console.log(`✅ Index ${name} created`);
  } catch (e) {
    if (e.errno === 1061) console.log(`⏭️ Index ${name} exists`);
    else console.log(`⚠️ Index ${name}:`, e.message);
  }
}

await conn.end();
console.log('\n✅ Setor migration complete.');
