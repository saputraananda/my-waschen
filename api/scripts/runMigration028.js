// Run migration 028 - Rename kasir to frontline
// Usage: node runMigration028.js
import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';

async function run() {
  console.log('🚀 Running migration 028 - Rename kasir to frontline...\n');

  const pool = mysql.createPool({
    host: process.env.HOST_WASCHEN_POS,
    port: Number(process.env.PORT_WASCHEN_POS) || 3306,
    user: process.env.USER_WASCHEN_POS,
    password: process.env.PASS_WASCHEN_POS,
    database: process.env.DB_WASCHEN_POS,
    waitForConnections: true,
    connectionLimit: 3,
  });

  const conn = await pool.getConnection();

  try {
    // Update users
    const [userResult] = await conn.query(
      "UPDATE mst_user SET role_code = 'frontline', updated_at = NOW() WHERE role_code = 'kasir'"
    );
    console.log(`✅ Updated ${userResult.affectedRows} users from 'kasir' to 'frontline'`);

    // Update sessions
    const [sessionResult] = await conn.query(
      "UPDATE mst_user_session SET role_code = 'frontline' WHERE role_code = 'kasir'"
    );
    console.log(`✅ Updated ${sessionResult.affectedRows} sessions from 'kasir' to 'frontline'`);

    // Log migration
    try {
      await conn.query(
        "INSERT INTO migrations (name, applied_at) VALUES ('028_rename_kasir_to_frontline.sql', NOW())"
      );
      console.log('✅ Migration logged');
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        console.log('⚠️  Migration already logged, skipping');
      } else {
        throw e;
      }
    }

    console.log('\n✅ Migration 028 completed successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
