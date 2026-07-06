import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '103.197.189.185', port: 3306, user: 'waschen',
  password: 'WaschenDE2025!', database: 'my_waschen'
});

console.log('Connected. Running handover migration...\n');

// 1. Add columns (check each)
const cols = [
  ['handover_cash', 'DECIMAL(15,2) DEFAULT NULL'],
  ['handover_at', 'DATETIME DEFAULT NULL'],
  ['handover_notes', 'TEXT'],
  ['accepted_cash', 'DECIMAL(15,2) DEFAULT NULL'],
  ['accepted_by', 'BIGINT DEFAULT NULL'],
  ['accepted_at', 'DATETIME DEFAULT NULL'],
  ['parent_session_id', 'BIGINT DEFAULT NULL'],
];

for (const [col, def] of cols) {
  try {
    const [check] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'tr_cashier_session' AND column_name = ?`, [col]
    );
    if (check[0].cnt === 0) {
      await conn.query(`ALTER TABLE tr_cashier_session ADD COLUMN \`${col}\` ${def}`);
      console.log(`✅ Added ${col}`);
    } else {
      console.log(`⏭️ ${col} exists`);
    }
  } catch (e) { console.log(`⚠️ ${col}: ${e.message}`); }
}

// 2. Update status enum
try {
  await conn.query(`ALTER TABLE tr_cashier_session MODIFY COLUMN status ENUM('open','closed','handover') NOT NULL DEFAULT 'open'`);
  console.log('✅ status enum updated');
} catch (e) { console.log('⚠️ status enum:', e.message); }

// 3. Update shift enum
try {
  await conn.query(`ALTER TABLE tr_cashier_session MODIFY COLUMN shift ENUM('pagi','siang','malam','full','produksi') NOT NULL DEFAULT 'full'`);
  console.log('✅ shift enum updated');
} catch (e) { console.log('⚠️ shift enum:', e.message); }

// 4. Indexes
const indexes = [
  ['idx_session_handover', '(outlet_id, session_date, status)'],
  ['idx_session_parent', '(parent_session_id)'],
];
for (const [name, cols] of indexes) {
  try {
    await conn.query(`CREATE INDEX \`${name}\` ON tr_cashier_session ${cols}`);
    console.log(`✅ Index ${name}`);
  } catch (e) {
    if (e.errno === 1061) console.log(`⏭️ Index ${name} exists`);
    else console.log(`⚠️ ${name}: ${e.message}`);
  }
}

await conn.end();
console.log('\n✅ Handover migration complete.');
