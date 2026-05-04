import mysql from 'mysql2/promise'

const poolWaschenPos = mysql.createPool({
  host: process.env.HOST_WASCHEN_POS,
  port: Number(process.env.PORT_WASCHEN_POS),
  user: process.env.USER_WASCHEN_POS,
  password: process.env.PASS_WASCHEN_POS,
  database: process.env.DB_WASCHEN_POS,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

const poolWaschenAlora = mysql.createPool({
  host: process.env.HOST_WASCHEN_ALORA,
  port: Number(process.env.PORT_WASCHEN_ALORA),
  user: process.env.USER_WASCHEN_ALORA,
  password: process.env.PASS_WASCHEN_ALORA,
  database: process.env.DB_WASCHEN_ALORA,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export { poolWaschenPos, poolWaschenAlora }
