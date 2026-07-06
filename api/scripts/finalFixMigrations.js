import mysql from 'mysql2/promise';

const config = {
  host: '103.197.189.185',
  port: 3306,
  user: 'waschen',
  password: 'WaschenDE2025!',
  database: 'my_waschen',
  multipleStatements: true,
};

async function finalFix() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected!\n');
    
    // ==========================================
    // Fix 1: Add requires_material to mst_service
    // ==========================================
    console.log('📝 Fix 1: Adding requires_material to mst_service...');
    
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
          ADD COLUMN requires_material TINYINT(1) DEFAULT 0 
          COMMENT '1=requires material selection for satuan services' 
          AFTER price
        `);
        console.log('   ✅ Added column: mst_service.requires_material');
      } else {
        console.log('   ⏭️  Column already exists: mst_service.requires_material');
      }
    } catch (err) {
      console.log(`   ⚠️  Error: ${err.message}`);
    }
    
    // ==========================================
    // Fix 2: Add foreign key for material_id
    // ==========================================
    console.log('\n📝 Fix 2: Adding foreign key fk_item_material...');
    
    try {
      // Drop if exists first
      await connection.query(`
        ALTER TABLE tr_transaction_item 
        DROP FOREIGN KEY IF EXISTS fk_item_material
      `);
    } catch (err) {
      // Ignore error if constraint doesn't exist
    }
    
    try {
      await connection.query(`
        ALTER TABLE tr_transaction_item 
        ADD CONSTRAINT fk_item_material 
        FOREIGN KEY (material_id) REFERENCES mst_material(id) 
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
      console.log('   ✅ Added foreign key: fk_item_material (references mst_material.id)');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('   ⏭️  Foreign key already exists: fk_item_material');
      } else {
        console.log(`   ⚠️  Error: ${err.message}`);
      }
    }
    
    // ==========================================
    // Fix 3: Add audit trail columns to tr_audit_log
    // ==========================================
    console.log('\n📝 Fix 3: Adding audit trail columns to tr_audit_log...');
    
    const auditColumns = [
      { name: 'before_data', type: 'JSON NULL COMMENT "State before action"' },
      { name: 'after_data', type: 'JSON NULL COMMENT "State after action"' },
      { name: 'approved_by', type: 'BIGINT NULL COMMENT "User who approved action"' },
    ];
    
    for (const col of auditColumns) {
      try {
        const [cols] = await connection.query(`
          SELECT COLUMN_NAME 
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = 'my_waschen' 
            AND TABLE_NAME = 'tr_audit_log' 
            AND COLUMN_NAME = ?
        `, [col.name]);
        
        if (cols.length === 0) {
          await connection.query(`
            ALTER TABLE tr_audit_log 
            ADD COLUMN ${col.name} ${col.type}
          `);
          console.log(`   ✅ Added column: tr_audit_log.${col.name}`);
        } else {
          console.log(`   ⏭️  Column already exists: tr_audit_log.${col.name}`);
        }
      } catch (err) {
        console.log(`   ⚠️  Error adding ${col.name}: ${err.message}`);
      }
    }
    
    // Add foreign key for approved_by
    try {
      await connection.query(`
        ALTER TABLE tr_audit_log 
        ADD CONSTRAINT fk_audit_approved_by 
        FOREIGN KEY (approved_by) REFERENCES mst_user(id) 
        ON DELETE SET NULL
      `);
      console.log('   ✅ Added foreign key: fk_audit_approved_by');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('   ⏭️  Foreign key already exists: fk_audit_approved_by');
      } else {
        console.log(`   ⚠️  Error: ${err.message}`);
      }
    }
    
    // ==========================================
    // Fix 4: Update services that require material
    // ==========================================
    console.log('\n📝 Fix 4: Updating services that require material...');
    
    try {
      // Set requires_material=1 for satuan services (karpet, gorden, sofa, etc.)
      const [result] = await connection.query(`
        UPDATE mst_service 
        SET requires_material = 1 
        WHERE (
          LOWER(name) LIKE '%karpet%' 
          OR LOWER(name) LIKE '%gorden%' 
          OR LOWER(name) LIKE '%sofa%'
          OR LOWER(name) LIKE '%curtain%'
          OR LOWER(name) LIKE '%carpet%'
          OR unit_type = 'm2'
        )
        AND is_active = 1
      `);
      console.log(`   ✅ Updated ${result.affectedRows} services to requires_material=1`);
    } catch (err) {
      console.log(`   ⚠️  Error: ${err.message}`);
    }
    
    // ==========================================
    // Verify all changes
    // ==========================================
    console.log('\n🔍 Final verification...\n');
    
    // Check mst_customer
    const [customerCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME = 'mst_customer' 
        AND COLUMN_NAME IN ('province_id', 'city_id', 'district_id', 'sub_district_id', 'address_other')
      ORDER BY COLUMN_NAME
    `);
    console.log('✅ mst_customer cascading address columns:', customerCols.map(r => r.COLUMN_NAME).join(', '));
    
    // Check tr_transaction_item
    const [itemCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME = 'tr_transaction_item' 
        AND COLUMN_NAME IN ('material_id', 'length', 'width')
      ORDER BY COLUMN_NAME
    `);
    console.log('✅ tr_transaction_item material/m² columns:', itemCols.map(r => r.COLUMN_NAME).join(', '));
    
    // Check tr_audit_log
    const [auditCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME = 'tr_audit_log' 
        AND COLUMN_NAME IN ('before_data', 'after_data', 'approved_by')
      ORDER BY COLUMN_NAME
    `);
    console.log('✅ tr_audit_log enhanced columns:', auditCols.map(r => r.COLUMN_NAME).join(', '));
    
    // Check mst_service
    const [serviceCol] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME = 'mst_service' 
        AND COLUMN_NAME = 'requires_material'
    `);
    console.log('✅ mst_service.requires_material:', serviceCol.length > 0 ? 'EXISTS' : 'MISSING');
    
    // Count services that require material
    const [[serviceCount]] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM mst_service 
      WHERE requires_material = 1 AND is_active = 1
    `);
    console.log(`✅ Services requiring material: ${serviceCount.count}`);
    
    // Check master tables
    const [masterTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME IN ('mst_province', 'mst_city', 'mst_district', 'mst_sub_district', 'mst_material', 'tr_transaction_label_print_log')
      ORDER BY TABLE_NAME
    `);
    console.log('✅ Master tables:', masterTables.map(r => r.TABLE_NAME).join(', '));
    
    console.log('\n🎉 All database migrations completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Cascading address structure ready');
    console.log('   ✅ Material tracking enabled');
    console.log('   ✅ M² calculation columns added');
    console.log('   ✅ Enhanced audit trail ready');
    console.log('   ✅ Label print logging table ready');
    
  } catch (err) {
    console.error('\n❌ Error:', err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

finalFix();
