import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '103.197.189.185',
  port: 3306,
  user: 'waschen',
  password: 'WaschenDE2025!',
  database: 'my_waschen'
});

console.log('Connected to remote DB\n');
console.log('=== Creating Performance Indexes ===\n');

const indexes = [
  // [table, index_name, columns]
  ['tr_transaction', 'idx_tx_outlet_status_created', '(outlet_id, status, created_at)'],
  ['tr_transaction', 'idx_tx_outlet_payment_created', '(outlet_id, payment_status, created_at)'],
  ['tr_transaction', 'idx_tx_customer_created', '(customer_id, created_at)'],
  ['tr_transaction', 'idx_tx_deleted_status', '(deleted_at, status)'],
  ['tr_transaction', 'idx_tx_express_deadline', '(is_express, estimated_done_at)'],
  ['tr_transaction_item', 'idx_txi_transaction_active', '(transaction_id, is_active)'],
  ['tr_transaction_item', 'idx_txi_service_transaction', '(service_id, transaction_id)'],
  ['tr_item_unit', 'idx_iu_item_production_status', '(transaction_item_id, production_status)'],
  ['tr_notification', 'idx_notif_user_read_created', '(user_id, is_read, created_at)'],
  ['tr_whatsapp_log', 'idx_walog_tx_status', '(transaction_id, status)'],
  ['mst_customer', 'idx_customer_phone', '(phone)'],
  ['mst_customer', 'idx_customer_name', '(name)'],
  ['tr_outlet_cash_ledger', 'idx_ledger_outlet_created', '(outlet_id, created_at)'],
  ['tr_purchase_request', 'idx_pr_outlet_status', '(outlet_id, status)'],
  ['tr_customer_review', 'idx_review_outlet_created', '(outlet_id, created_at)'],
  ['tr_production_assignment', 'idx_prodassign_stage_status', '(stage, status)'],
  ['tr_production_assignment', 'idx_prodassign_assigned_to', '(assigned_to, status)'],
  ['mst_service', 'idx_service_outlet_active', '(outlet_id, is_active)'],
  ['mst_customer_wallet', 'idx_wallet_customer', '(customer_id)'],
  ['mst_outlet_cash_balance', 'idx_cashbalance_outlet', '(outlet_id)'],
];

let created = 0;
let skipped = 0;

for (const [table, name, columns] of indexes) {
  try {
    await conn.query(`CREATE INDEX \`${name}\` ON \`${table}\` ${columns}`);
    console.log(`  ✅ ${table}.${name}`);
    created++;
  } catch (err) {
    if (err.code === 'ER_DUP_KEYNAME' || err.errno === 1061) {
      console.log(`  ⏭️  ${table}.${name} (exists)`);
      skipped++;
    } else {
      console.log(`  ❌ ${table}.${name}: ${err.message}`);
    }
  }
}

console.log(`\n📊 Results: ${created} created, ${skipped} skipped (already exist)`);

await conn.end();
console.log('✅ Done.');
