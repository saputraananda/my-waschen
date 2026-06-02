/**
 * Best-effort audit row (fails silently if tabel tidak ada / error DB).
 * id kolom sekarang BIGINT AUTO_INCREMENT — tidak perlu generate UUID.
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

  // Sanitize entityId & transactionId — kolom DB BIGINT, tolak string non-numeric
  const numericOrNull = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    if (s === '' || !/^\d+$/.test(s)) return null;
    return s;
  };
  const safeEntityId = numericOrNull(entityId);
  const safeTransactionId = numericOrNull(transactionId);

  try {
    await poolOrConn.execute(
      `INSERT INTO tr_audit_log (
        user_id, outlet_id, transaction_id, entity_type, entity_id, action,
        old_data, new_data, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        outletId,
        safeTransactionId,
        entityType,
        safeEntityId,
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
