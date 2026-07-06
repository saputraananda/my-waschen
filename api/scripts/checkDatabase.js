import mysql from 'mysql2/promise';

const config = {
  host: '103.197.189.185',
  port: 3306,
  user: 'waschen',
  password: 'WaschenDE2025!',
  database: 'my_waschen',
};

async function checkDatabase() {
  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    
    // Check audit table name
    console.log('📊 Checking audit trail table...');
    const [auditTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME LIKE '%audit%'
    `);
    console.log('Audit-related tables:', auditTables.map(r => r.TABLE_NAME));
    
    // Check mst_service columns
    console.log('\n📊 Checking mst_service columns...');
    const [serviceCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME = 'mst_service'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('mst_service columns:', serviceCols.map(r => r.COLUMN_NAME).join(', '));
    
    // Check mst_material columns
    console.log('\n📊 Checking mst_material columns...');
    const [materialCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'my_waschen' 
        AND TABLE_NAME = 'mst_material'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('mst_material columns:', materialCols.map(r => r.COLUMN_NAME).join(', '));
    
    // Check if mst_material has data
    const [[count]] = await connection.query(`SELECT COUNT(*) as count FROM mst_material`);
    console.log(`mst_material row count: ${count.count}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkDatabase();
