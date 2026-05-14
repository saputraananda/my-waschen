import { randomUUID } from 'crypto';

/**
 * Best-effort audit row (fails silently if tabel tidak ada / error DB).
 */
export async function writeAudit(poolOrConn, {
  userId,
  outletId = null,
  transactionId = null,
  entityType,
  entityId = null,
  action,
  oldData = null,
  newData = null,
  req = null,
}) {
  if (!userId || !action) return;
  try {
    await poolOrConn.execute(
      `INSERT INTO tr_audit_log (
        id, user_id, outlet_id, transaction_id, entity_type, entity_id, action,
        old_data, new_data, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        randomUUID(),
        userId,
        outletId,
        transactionId,
        entityType,
        entityId,
        action,
        oldData != null ? JSON.stringify(oldData) : null,
        newData != null ? JSON.stringify(newData) : null,
        req?.ip || null,
        (req?.get?.('user-agent') || '').slice(0, 255) || null,
      ]
    );
  } catch (e) {
    console.warn('[writeAudit]', e?.message || e);
  }
}
