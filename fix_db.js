import { poolWaschenPos } from './api/db/connection.js';

async function fix() {
  await poolWaschenPos.query(`UPDATE mst_service SET name = CONCAT(name, '_del_', id) WHERE is_active=0`);
  console.log('Fixed soft-deleted service names');
  process.exit(0);
}
fix();