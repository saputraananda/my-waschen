import mysql from 'mysql2/promise'

const poolWaschenPos = mysql.createPool({
  host: process.env.HOST_WASCHEN_POS,
  port: Number(process.env.PORT_WASCHEN_POS),
  user: process.env.USER_WASCHEN_POS,
  password: process.env.PASS_WASCHEN_POS,
  database: process.env.DB_WASCHEN_POS,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 5,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 20000,
})

// ─── Connection Health Check ────────────────────────────────────────────────────
poolWaschenPos.on('connection', (conn) => {
  conn.on('error', (err) => {
    if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.warn('[DB] Connection lost, pool will reconnect automatically.');
    } else {
      console.error('[DB] Connection error:', err.code);
    }
  });
});

// Health check helper — call periodically or on /health endpoint
poolWaschenPos.healthCheck = async () => {
  try {
    const [rows] = await poolWaschenPos.execute('SELECT 1 AS ok');
    return { ok: true, poolSize: poolWaschenPos.pool?._allConnections?.length || 0 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

// poolWaschenAlora — reserved for future Alora integration
// Not used in current codebase, kept for forward compatibility

export { poolWaschenPos }

