import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '103.197.189.185',
  port: 3306,
  user: 'waschen',
  password: 'WaschenDE2025!',
  database: 'my_waschen'
});

console.log('Connected to remote DB\n');

// Seed fragrances
const fragrances = [
  ['FRG-001', 'Lavender', 'Wangi lavender yang menenangkan', 1],
  ['FRG-002', 'Rose', 'Wangi mawar klasik yang lembut', 2],
  ['FRG-003', 'Ocean Breeze', 'Wangi segar seperti angin laut', 3],
  ['FRG-004', 'Sakura', 'Wangi bunga sakura yang manis', 4],
  ['FRG-005', 'Cotton Fresh', 'Wangi bersih seperti kapas segar', 5],
  ['FRG-006', 'Vanilla', 'Wangi vanilla hangat yang lembut', 6],
  ['FRG-007', 'Lemon Zest', 'Wangi jeruk lemon yang menyegarkan', 7],
  ['FRG-008', 'Jasmine', 'Wangi melati yang elegan', 8],
  ['FRG-009', 'Baby Powder', 'Wangi bedak bayi yang lembut', 9],
  ['FRG-010', 'Tanpa Parfum', 'Tanpa tambahan pewangi', 10],
];

console.log('=== Seeding Fragrances ===');
for (const [code, name, desc, order] of fragrances) {
  const [existing] = await conn.query('SELECT id FROM mst_service_fragrance WHERE code = ?', [code]);
  if (existing.length === 0) {
    await conn.query(
      'INSERT INTO mst_service_fragrance (code, name, description, sort_order) VALUES (?, ?, ?, ?)',
      [code, name, desc, order]
    );
    console.log(`  ✅ ${code}: ${name}`);
  } else {
    console.log(`  ⏭️  ${code}: ${name} (exists)`);
  }
}

// Seed deposit packages
const packages = [
  ['DEP-50K', 'Deposit 50K', 50000, 50000, 0],
  ['DEP-100K', 'Deposit 100K', 100000, 95000, 5],
  ['DEP-200K', 'Deposit 200K', 200000, 180000, 10],
  ['DEP-500K', 'Deposit 500K', 500000, 425000, 15],
  ['DEP-1JT', 'Deposit 1 Juta', 1000000, 800000, 20],
];

console.log('\n=== Seeding Deposit Packages ===');
for (const [code, name, face, sell, bonus] of packages) {
  const [existing] = await conn.query('SELECT id FROM mst_deposit_package WHERE code = ?', [code]);
  if (existing.length === 0) {
    await conn.query(
      'INSERT INTO mst_deposit_package (code, name, face_value, sell_price, bonus_pct) VALUES (?, ?, ?, ?, ?)',
      [code, name, face, sell, bonus]
    );
    console.log(`  ✅ ${code}: ${name} (Rp ${face.toLocaleString()} → Rp ${sell.toLocaleString()}, bonus ${bonus}%)`);
  } else {
    console.log(`  ⏭️  ${code}: ${name} (exists)`);
  }
}

await conn.end();
console.log('\n✅ Seed completed.');
