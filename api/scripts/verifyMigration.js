import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '103.197.189.185',
  port: 3306,
  user: 'waschen',
  password: 'WaschenDE2025!',
  database: 'my_waschen'
});

const tables = [
  'mst_customer_address',
  'mst_deposit_package',
  'mst_payment_provider',
  'mst_payment_terminal',
  'mst_service_fragrance',
  'mst_whatsapp_template',
  'tr_whatsapp_log',
  'tr_inventory_receipt',
  'tr_inventory_receipt_item',
  'tr_inventory_request',
  'tr_production_assignment'
];

console.log('=== Verification: 11 New Tables ===\n');
for (const t of tables) {
  const [rows] = await conn.query('SHOW TABLES LIKE ?', [t]);
  console.log(`${rows.length ? '✅ OK' : '❌ MISSING'} - ${t}`);
}

console.log('\n=== WA Templates Seeded ===\n');
const [waRows] = await conn.query('SELECT code, name, type FROM mst_whatsapp_template');
console.log(`Total: ${waRows.length} templates`);
waRows.forEach(r => console.log(`  - [${r.type}] ${r.code}: ${r.name}`));

console.log('\n=== tr_notification FK Fix ===\n');
const [notifFk] = await conn.query(
  `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME 
   FROM information_schema.KEY_COLUMN_USAGE 
   WHERE TABLE_SCHEMA = 'my_waschen' 
     AND TABLE_NAME = 'tr_notification' 
     AND CONSTRAINT_NAME = 'fk_notification_template'`
);
console.log(`FK now references: ${notifFk[0]?.REFERENCED_TABLE_NAME || 'NOT FOUND'}`);

await conn.end();
console.log('\n✅ Verification complete.');
