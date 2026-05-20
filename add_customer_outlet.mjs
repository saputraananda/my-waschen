import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.HOST_WASCHEN_POS,
  port: Number(process.env.PORT_WASCHEN_POS),
  user: process.env.USER_WASCHEN_POS,
  password: process.env.PASS_WASCHEN_POS,
  database: process.env.DB_WASCHEN_POS,
});

const hasCol = async (table, col) => {
  const [rows] = await conn.execute(
    'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1',
    [table, col]
  );
  return rows.length > 0;
};

console.log('Adding registered_outlet_id to mst_customer...');

if (!(await hasCol('mst_customer', 'registered_outlet_id'))) {
  await conn.execute('ALTER TABLE mst_customer ADD COLUMN registered_outlet_id CHAR(36) NULL AFTER area_zone_id');
  console.log('OK: added registered_outlet_id');

  // Backfill: set registered_outlet_id dari transaksi pertama customer
  await conn.execute(`
    UPDATE mst_customer c
    SET c.registered_outlet_id = (
      SELECT t.outlet_id
      FROM tr_transaction t
      WHERE t.customer_id = c.id
        AND t.deleted_at IS NULL
      ORDER BY t.created_at ASC
      LIMIT 1
    )
    WHERE c.registered_outlet_id IS NULL
  `);
  console.log('OK: backfilled registered_outlet_id from first transaction');

  // Add FK
  try {
    await conn.execute(
      'ALTER TABLE mst_customer ADD CONSTRAINT fk_customer_outlet FOREIGN KEY (registered_outlet_id) REFERENCES mst_outlet(id) ON DELETE SET NULL'
    );
    console.log('OK: added FK constraint');
  } catch (e) {
    console.log('SKIP FK:', e.message);
  }

  // Add index for performance
  await conn.execute('CREATE INDEX idx_customer_outlet ON mst_customer (registered_outlet_id)');
  console.log('OK: added index');
} else {
  console.log('SKIP: registered_outlet_id already exists');
}

await conn.end();
console.log('Done!');
