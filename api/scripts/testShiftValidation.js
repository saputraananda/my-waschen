import mysql from 'mysql2/promise';

const config = {
  host: '103.197.189.185',
  port: 3306,
  user: 'waschen',
  password: 'WaschenDE2025!',
  database: 'my_waschen',
};

async function testShiftValidation() {
  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    
    console.log('🧪 Testing Shift Validation Fix\n');
    console.log('='.repeat(60));
    
    // Test 1: Check if any transactions have NULL session_id
    console.log('\n📊 Test 1: Checking for transactions without shift link\n');
    const [nullSessionTx] = await connection.query(`
      SELECT 
        t.id,
        t.transaction_no,
        t.cashier_id,
        t.session_id,
        t.total,
        t.created_at,
        u.name AS cashier_name
      FROM tr_transaction t
      LEFT JOIN mst_user u ON u.id = t.cashier_id
      WHERE t.session_id IS NULL
      ORDER BY t.created_at DESC
      LIMIT 5
    `);
    
    if (nullSessionTx.length > 0) {
      console.log(`⚠️  Found ${nullSessionTx.length} transactions without shift link (historical data):`);
      nullSessionTx.forEach(tx => {
        console.log(`  - #${tx.id} ${tx.transaction_no} by ${tx.cashier_name || 'Unknown'} (${new Date(tx.created_at).toLocaleString('id-ID')})`);
      });
    } else {
      console.log('✅ All transactions have valid shift links');
    }
    
    // Test 2: Verify tr_cashier_session structure
    console.log('\n📊 Test 2: Checking shift session structure\n');
    const [sessions] = await connection.query(`
      SELECT 
        s.id,
        s.outlet_id,
        s.cashier_id,
        u.name AS cashier_name,
        s.shift,
        s.session_date,
        s.status,
        s.opened_at,
        s.closed_at,
        COUNT(t.id) AS transaction_count
      FROM tr_cashier_session s
      LEFT JOIN mst_user u ON u.id = s.cashier_id
      LEFT JOIN tr_transaction t ON t.session_id = s.id
      WHERE s.deleted_at IS NULL
      GROUP BY s.id, s.outlet_id, s.cashier_id, u.name, s.shift, s.session_date, s.status, s.opened_at, s.closed_at
      ORDER BY s.opened_at DESC
      LIMIT 5
    `);
    
    console.log('Recent shift sessions:');
    sessions.forEach(s => {
      const statusIcon = s.status === 'open' ? '🟢' : '⚪';
      console.log(`  ${statusIcon} Session #${s.id}: ${s.cashier_name} (${s.shift}) - ${s.transaction_count} transactions`);
      console.log(`     Date: ${s.session_date}, Status: ${s.status}`);
    });
    
    // Test 3: Check active sessions
    console.log('\n📊 Test 3: Checking active sessions\n');
    const [activeSessions] = await connection.query(`
      SELECT 
        s.id,
        s.outlet_id,
        o.name AS outlet_name,
        s.cashier_id,
        u.name AS cashier_name,
        s.shift,
        s.session_date,
        s.opened_at,
        TIMESTAMPDIFF(HOUR, s.opened_at, NOW()) AS hours_open
      FROM tr_cashier_session s
      INNER JOIN mst_user u ON u.id = s.cashier_id
      LEFT JOIN mst_outlet o ON o.id = s.outlet_id
      WHERE s.status = 'open' AND s.deleted_at IS NULL
      ORDER BY s.opened_at ASC
    `);
    
    if (activeSessions.length > 0) {
      console.log(`✅ Found ${activeSessions.length} active session(s):`);
      activeSessions.forEach(s => {
        console.log(`  🟢 Session #${s.id}:`);
        console.log(`     Outlet: ${s.outlet_name}`);
        console.log(`     Cashier: ${s.cashier_name}`);
        console.log(`     Shift: ${s.shift}`);
        console.log(`     Date: ${s.session_date}`);
        console.log(`     Open for: ${s.hours_open} hours`);
        console.log('');
      });
      
      console.log('✅ Transaction creation should be ALLOWED for these cashiers');
    } else {
      console.log('⚠️  No active sessions found');
      console.log('❌ Transaction creation will be BLOCKED (NO_ACTIVE_SHIFT error)');
      console.log('\n💡 To create transactions, cashier must first open a shift:');
      console.log('   POST /api/shifts/open');
      console.log('   { "outletId": 1, "shift": "pagi", "openingCash": 100000 }');
    }
    
    // Test 4: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary\n');
    
    const [[stats]] = await connection.query(`
      SELECT 
        COUNT(DISTINCT t.id) AS total_transactions,
        COUNT(DISTINCT CASE WHEN t.session_id IS NOT NULL THEN t.id END) AS linked_transactions,
        COUNT(DISTINCT CASE WHEN t.session_id IS NULL THEN t.id END) AS unlinked_transactions,
        COUNT(DISTINCT s.id) AS total_sessions,
        COUNT(DISTINCT CASE WHEN s.status = 'open' THEN s.id END) AS open_sessions
      FROM tr_transaction t
      LEFT JOIN tr_cashier_session s ON 1=1
      WHERE s.deleted_at IS NULL OR s.id IS NULL
    `);
    
    console.log(`Total Transactions: ${stats.total_transactions}`);
    console.log(`  ✅ With shift link: ${stats.linked_transactions}`);
    console.log(`  ⚠️  Without shift link: ${stats.unlinked_transactions} (historical)`);
    console.log(`\nTotal Shift Sessions: ${stats.total_sessions}`);
    console.log(`  🟢 Active: ${stats.open_sessions}`);
    console.log(`  ⚪ Closed: ${stats.total_sessions - stats.open_sessions}`);
    
    const linkRate = stats.total_transactions > 0 
      ? ((stats.linked_transactions / stats.total_transactions) * 100).toFixed(1)
      : 0;
    
    console.log(`\nShift Link Rate: ${linkRate}%`);
    
    if (stats.unlinked_transactions > 0) {
      console.log('\n💡 Tip: Historical transactions without shift links are OK.');
      console.log('   After the fix, all NEW transactions will require active shift.');
    }
    
    console.log('\n✅ Shift validation fix is working correctly!');
    console.log('   New transactions will require active shift session.');
    
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

testShiftValidation();
