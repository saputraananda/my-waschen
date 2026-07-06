import mysql from 'mysql2/promise';

const config = {
  host: '103.197.189.185',
  port: 3306,
  user: 'waschen',
  password: 'WaschenDE2025!',
  database: 'my_waschen',
  multipleStatements: true,
};

async function fixMigrations() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected!\n');
    
    // ==========================================
    // Fix 1: Add cascading address columns to mst_customer
    // ==========================================
    console.log('📝 Fix 1: Adding cascading address columns to mst_customer...');
    
    const cascadingColumns = [
      { name: 'province_id', type: 'INT NULL', after: 'area_zone_id' },
      { name: 'city_id', type: 'INT NULL', after: 'province_id' },
      { name: 'district_id', type: 'INT NULL', after: 'city_id' },
      { name: 'sub_district_id', type: 'INT NULL', after: 'district_id' },
      { name: 'address_other', type: 'TEXT NULL', after: 'address_detail' },
    ];
    
    for (const col of cascadingColumns) {
      try {
        // Check if column exists
        const [cols] = await connection.query(`
          SELECT COLUMN_NAME 
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = 'my_waschen' 
            AND TABLE_NAME = 'mst_customer' 
            AND COLUMN_NAME = ?
        `, [col.name]);
        
        if (cols.length === 0) {
          await connection.query(`
            ALTER TABLE mst_customer 
            ADD COLUMN ${col.name} ${col.type} AFTER ${col.after}
          `);
          console.log(`   ✅ Added column: ${col.name}`);
        } else {
          console.log(`   ⏭️  Column already exists: ${col.name}`);
        }
      } catch (err) {
        console.log(`   ⚠️  Error adding ${col.name}: ${err.message}`);
      }
    }
    
    // Add indexes
    console.log('\n📝 Adding indexes to mst_customer...');
    const indexes = ['province_id', 'city_id', 'district_id', 'sub_district_id'];
    for (const idx of indexes) {
      try {
        await connection.query(`
          ALTER TABLE mst_customer 
          ADD INDEX idx_${idx} (${idx})
        `);
        console.log(`   ✅ Added index: idx_${idx}`);
      } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME') {
          console.log(`   ⏭️  Index already exists: idx_${idx}`);
        } else {
          console.log(`   ⚠️  Error adding index idx_${idx}: ${err.message}`);
        }
      }
    }
    
    // Add foreign keys
    console.log('\n📝 Adding foreign keys to mst_customer...');
    const foreignKeys = [
      { name: 'fk_customer_province', column: 'province_id', refTable: 'mst_province', refColumn: 'province_id' },
      { name: 'fk_customer_city', column: 'city_id', refTable: 'mst_city', refColumn: 'city_id' },
      { name: 'fk_customer_district', column: 'district_id', refTable: 'mst_district', refColumn: 'district_id' },
      { name: 'fk_customer_sub_district', column: 'sub_district_id', refTable: 'mst_sub_district', refColumn: 'sub_district_id' },
    ];
    
    for (const fk of foreignKeys) {
      try {
        await connection.query(`
          ALTER TABLE mst_customer 
          ADD CONSTRAINT ${fk.name} 
          FOREIGN KEY (${fk.column}) REFERENCES ${fk.refTable}(${fk.refColumn}) 
          ON DELETE SET NULL ON UPDATE CASCADE
        `);
        console.log(`   ✅ Added foreign key: ${fk.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME' || err.message.includes('already exists')) {
          console.log(`   ⏭️  Foreign key already exists: ${fk.name}`);
        } else {
          console.log(`   ⚠️  Error adding foreign key ${fk.name}: ${err.message}`);
        }
      }
    }
    
    // ==========================================
    // Fix 2: Add material columns to mst_service and tr_transaction_item
    // ==========================================
    console.log('\n📝 Fix 2: Adding material columns...');
    
    // Add requires_material to mst_service
    try {
      const [cols] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'my_waschen' 
          AND TABLE_NAME = 'mst_service' 
          AND COLUMN_NAME = 'requires_material'
      `);
      
      if (cols.length === 0) {
        await connection.query(`
          ALTER TABLE mst_service 
          ADD COLUMN requires_material TINYINT(1) DEFAULT 0 COMMENT '1=requires material selection for satuan services' 
          AFTER unit_price
        `);
        console.log('   ✅ Added column: mst_service.requires_material');
      } else {
        console.log('   ⏭️  Column already exists: mst_service.requires_material');
      }
    } catch (err) {
      console.log(`   ⚠️  Error: ${err.message}`);
    }
    
    // Add material_id, length, width to tr_transaction_item
    const itemColumns = [
      { name: 'material_id', type: 'INT NULL', after: 'service_id' },
      { name: 'length', type: 'DECIMAL(10,2) NULL COMMENT "Length in meters for m² services"', after: 'qty' },
      { name: 'width', type: 'DECIMAL(10,2) NULL COMMENT "Width in meters for m² services"', after: 'length' },
    ];
    
    for (const col of itemColumns) {
      try {
        const [cols] = await connection.query(`
          SELECT COLUMN_NAME 
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = 'my_waschen' 
            AND TABLE_NAME = 'tr_transaction_item' 
            AND COLUMN_NAME = ?
        `, [col.name]);
        
        if (cols.length === 0) {
          await connection.query(`
            ALTER TABLE tr_transaction_item 
            ADD COLUMN ${col.name} ${col.type} AFTER ${col.after}
          `);
          console.log(`   ✅ Added column: tr_transaction_item.${col.name}`);
        } else {
          console.log(`   ⏭️  Column already exists: tr_transaction_item.${col.name}`);
        }
      } catch (err) {
        console.log(`   ⚠️  Error adding ${col.name}: ${err.message}`);
      }
    }
    
    // Add foreign key for material_id
    try {
      await connection.query(`
        ALTER TABLE tr_transaction_item 
        ADD CONSTRAINT fk_item_material 
        FOREIGN KEY (material_id) REFERENCES mst_material(material_id) 
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
      console.log('   ✅ Added foreign key: fk_item_material');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('   ⏭️  Foreign key already exists: fk_item_material');
      } else {
        console.log(`   ⚠️  Error: ${err.message}`);
      }
    }
    
    // ==========================================
    // Fix 3: Add audit trail columns
    // ==========================================
    console.log('\n📝 Fix 3: Adding audit trail columns...');
    
    const auditColumns = [
      { name: 'before_data', type: 'JSON NULL COMMENT "State before action"', after: 'action' },
      { name: 'after_data', type: 'JSON NULL COMMENT "State after action"', after: 'before_data' },
      { name: 'approved_by', type: 'BIGINT NULL COMMENT "User who approved action"', after: 'performed_by' },
    ];
    
    for (const col of auditColumns) {
      try {
        const [cols] = await connection.query(`
          SELECT COLUMN_NAME 
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = 'my_waschen' 
            AND TABLE_NAME = 'audit_trails' 
            AND COLUMN_NAME = ?
        `, [col.name]);
        
        if (cols.length === 0) {
          await connection.query(`
            ALTER TABLE audit_trails 
            ADD COLUMN ${col.name} ${col.type} AFTER ${col.after}
          `);
          console.log(`   ✅ Added column: audit_trails.${col.name}`);
        } else {
          console.log(`   ⏭️  Column already exists: audit_trails.${col.name}`);
        }
      } catch (err) {
        console.log(`   ⚠️  Error adding ${col.name}: ${err.message}`);
      }
    }
    
    // ==========================================
    // Verify all changes
    // ==========================================
    console.log('\n🔍 Verifying all changes...');
    
    const [customerCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME = 'mst_customer' 
        AND COLUMN_NAME IN ('province_id', 'city_id', 'district_id', 'sub_district_id', 'address_other')
      ORDER BY COLUMN_NAME
    `);
    
    console.log('\n✅ mst_customer columns:');
    customerCols.forEach(row => {
      console.log(`   - ${row.COLUMN_NAME}`);
    });
    
    const [itemCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME = 'tr_transaction_item' 
        AND COLUMN_NAME IN ('material_id', 'length', 'width')
      ORDER BY COLUMN_NAME
    `);
    
    console.log('\n✅ tr_transaction_item columns:');
    itemCols.forEach(row => {
      console.log(`   - ${row.COLUMN_NAME}`);
    });
    
    const [auditCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME = 'audit_trails' 
        AND COLUMN_NAME IN ('before_data', 'after_data', 'approved_by')
      ORDER BY COLUMN_NAME
    `);
    
    console.log('\n✅ audit_trails columns:');
    auditCols.forEach(row => {
      console.log(`   - ${row.COLUMN_NAME}`);
    });
    
    console.log('\n🎉 Database fixes completed successfully!');
    
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

fixMigrations();
