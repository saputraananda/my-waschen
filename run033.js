// Standalone migration runner — runs from project root
import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HOST = process.env.HOST_WASCHEN_POS;
const PORT = process.env.PORT_WASCHEN_POS || 3306;
const USER = process.env.USER_WASCHEN_POS;
const PASS = process.env.PASS_WASCHEN_POS;
const DB   = process.env.DB_WASCHEN_POS;

if (!HOST || !USER || !DB) {
  console.error('Missing DB config in .env');
  process.exit(1);
}

const migrationFile = path.join(__dirname, 'api', 'db', 'migrations', '033_add_gender_to_mst_user.sql');

if (!fs.existsSync(migrationFile)) {
  console.error('Migration file not found:', migrationFile);
  process.exit(1);
}

const sql = fs.readFileSync(migrationFile, 'utf8');

async function run() {
  console.log('Connecting to', HOST);
  const conn = await mysql.createConnection({ host: HOST, port: PORT, user: USER, password: PASS, database: DB, multipleStatements: true });
  console.log('Connected. Running migration...');

  try {
    await conn.query(sql);
    console.log('✅ Migration 033 completed successfully.');
    console.log('   Added: gender column to mst_user');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Column already exists — skipping.');
    } else {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    }
  } finally {
    await conn.end();
  }
}

run();
