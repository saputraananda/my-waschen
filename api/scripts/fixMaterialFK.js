import mysql from 'mysql2/promise';

const config = {
  host: '103.197.189.185',
  port: 3306,
  user: 'waschen',
  password: 'WaschenDE2025!',
  database: 'my_waschen',
};

async function fixMaterialFK() {
  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    
    // Check column types
    const [r1] = await connection.query('SHOW COLUMNS FROM mst_material WHERE Field = "id"');
    const [r2] = await connection.query('SHOW COLUMNS FROM tr_transaction_item WHERE Field = "material_id"');
    
    console.log('mst_material.id type:', r1[0].Type);
    console.log('tr_transaction_item.material_id type:', r2[0].Type);
    
    // Fix: Change tr_transaction_item.material_id to match mst_material.id type
    if (r1[0].Type !== r2[0].Type) {
      console.log('\n📝 Converting material_id to match mst_material.id type...');
      await connection.query(`
        ALTER TABLE tr_transaction_item 
        MODIFY COLUMN material_id ${r1[0].Type} NULL
      `);
      console.log('   ✅ Column type updated');
      
      // Now add foreign key
      await connection.query(`
        ALTER TABLE tr_transaction_item 
        ADD CONSTRAINT fk_item_material 
        FOREIGN KEY (material_id) REFERENCES mst_material(id) 
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
      console.log('   ✅ Foreign key added successfully');
    } else {
      console.log('\n✅ Types already match, trying to add FK...');
      try {
        await connection.query(`
          ALTER TABLE tr_transaction_item 
          ADD CONSTRAINT fk_item_material 
          FOREIGN KEY (material_id) REFERENCES mst_material(id) 
          ON DELETE SET NULL ON UPDATE CASCADE
        `);
        console.log('   ✅ Foreign key added');
      } catch (err) {
        console.log('   ⚠️  FK error:', err.message);
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

fixMaterialFK();
