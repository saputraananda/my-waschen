import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const config = {
  host: '103.197.189.185',
  port: 3306,
  user: 'waschen',
  password: 'WaschenDE2025!',
  database: 'my_waschen',
  multipleStatements: true,
};

// Migration files in order
const migrationFiles = [
  'migrate_add_cascading_address.sql',
  'migrate_add_material_tracking.sql',
  'migrate_enhance_audit_trail.sql',
  'migrate_add_label_print_log.sql',
];

async function runMigrations() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database: my_waschen\n');
    
    for (const filename of migrationFiles) {
      const filePath = path.join(__dirname, '..', 'db', filename);
      
      console.log(`📄 Running migration: ${filename}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`   ⚠️  File not found: ${filePath}`);
        continue;
      }
      
      // Read SQL file
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        // Execute SQL
        await connection.query(sql);
        console.log(`   ✅ Migration completed: ${filename}\n`);
      } catch (err) {
        // Check if error is because table already exists
        if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.message.includes('already exists')) {
          console.log(`   ⏭️  Migration skipped (already applied): ${filename}\n`);
        } else {
          console.error(`   ❌ Migration failed: ${filename}`);
          console.error(`   Error: ${err.message}\n`);
          // Continue with next migration instead of stopping
        }
      }
    }
    
    // Verify tables created
    console.log('🔍 Verifying tables...');
    const [tables] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'my_waschen' 
        AND table_name IN (
          'mst_province', 'mst_city', 'mst_district', 'mst_sub_district',
          'mst_material', 'tr_transaction_label_print_log'
        )
      ORDER BY table_name
    `);
    
    console.log('\n✅ Migration tables found:');
    tables.forEach(row => {
      console.log(`   - ${row.table_name || row.TABLE_NAME}`);
    });
    
    // Check if mst_customer has new columns
    const [customerCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME = 'mst_customer' 
        AND COLUMN_NAME IN ('province_id', 'city_id', 'district_id', 'sub_district_id', 'address_other')
      ORDER BY COLUMN_NAME
    `);
    
    console.log('\n✅ New columns in mst_customer:');
    customerCols.forEach(row => {
      console.log(`   - ${row.COLUMN_NAME || row.column_name}`);
    });
    
    // Check if tr_transaction_item has new columns
    const [itemCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME = 'tr_transaction_item' 
        AND COLUMN_NAME IN ('material_id', 'length', 'width')
      ORDER BY COLUMN_NAME
    `);
    
    console.log('\n✅ New columns in tr_transaction_item:');
    itemCols.forEach(row => {
      console.log(`   - ${row.COLUMN_NAME || row.column_name}`);
    });
    
    console.log('\n🎉 All migrations completed successfully!');
    
  } catch (err) {
    console.error('❌ Migration failed:');
    console.error(err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

runMigrations();
