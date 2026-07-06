import mysql from 'mysql2/promise';

const config = {
  host: '103.197.189.185',
  port: 3306,
  user: 'waschen',
  password: 'WaschenDE2025!',
  database: 'my_waschen',
};

async function checkShiftBug() {
  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    
    // Check tr_transaction structure
    console.log('📊 Checking tr_transaction columns...\n');
    const [cols] = await connection.query('DESCRIBE tr_transaction');
    
    const shiftRelatedCols = cols.filter(c => 
      c.Field.includes('shift') || 
      c.Field.includes('session') || 
      c.Field.includes('cashier')
    );
    
    console.log('Shift-related columns in tr_transaction:');
    if (shiftRelatedCols.length > 0) {
      shiftRelatedCols.forEach(c => {
        console.log(`  ✅ ${c.Field} (${c.Type}) ${c.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    } else {
      console.log('  ❌ NO shift-related columns found!');
      console.log('\n  Missing columns that should be added:');
      console.log('  - session_id (to link to tr_cashier_session)');
      console.log('  - or shift (enum)');
      console.log('  - or cashier_id (FK to mst_user)');
    }
    
    // Check tr_cashier_session structure
    console.log('\n📊 Checking tr_cashier_session columns...\n');
    const [sessionCols] = await connection.query('DESCRIBE tr_cashier_session');
    
    console.log('tr_cashier_session key columns:');
    const keyCols = ['id', 'outlet_id', 'cashier_id', 'session_date', 'shift', 'status', 'opened_at', 'closed_at'];
    sessionCols.filter(c => keyCols.includes(c.Field)).forEach(c => {
      console.log(`  - ${c.Field} (${c.Type})`);
    });
    
    // Check if any transactions have session_id
    console.log('\n📊 Checking existing transactions...\n');
    const [[txCount]] = await connection.query('SELECT COUNT(*) as count FROM tr_transaction');
    console.log(`Total transactions: ${txCount.count}`);
    
    // Check active sessions
    const [[activeSession]] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM tr_cashier_session 
      WHERE status = 'open'
    `);
    console.log(`Active sessions: ${activeSession.count}`);
    
    if (activeSession.count > 0) {
      const [sessions] = await connection.query(`
        SELECT id, outlet_id, cashier_id, session_date, shift, status, opened_at
        FROM tr_cashier_session
        WHERE status = 'open'
        LIMIT 5
      `);
      console.log('\nActive sessions:');
      sessions.forEach(s => {
        console.log(`  - Session #${s.id}: outlet=${s.outlet_id}, cashier=${s.cashier_id}, shift=${s.shift}, date=${s.session_date}`);
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkShiftBug();
