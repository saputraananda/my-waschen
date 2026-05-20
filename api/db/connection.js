import mysql from 'mysql2/promise'

const poolWaschenPos = mysql.createPool({
  host: process.env.HOST_WASCHEN_POS,
  port: Number(process.env.PORT_WASCHEN_POS),
  user: process.env.USER_WASCHEN_POS,
  password: process.env.PASS_WASCHEN_POS,
  database: process.env.DB_WASCHEN_POS,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 20000,
})

// poolWaschenAlora — reserved for future Alora integration
// Not used in current codebase, kept for forward compatibility

export { poolWaschenPos }
