// ─────────────────────────────────────────────────────────────────────────────
// Soft Delete Helper
// Konvensi: kombinasi `is_active` (aktif/nonaktif yang reversible)
//           dan `deleted_at` (permanent soft-delete untuk audit)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build WHERE clause untuk filter soft-deleted rows.
 * Otomatis cek tabel pakai is_active, deleted_at, atau keduanya.
 *
 * @param {string} alias  Table alias (e.g., 't', 'u', 'c')
 * @param {object} options { activeOnly: boolean, includeDeleted: boolean }
 * @returns {string} SQL fragment
 */
export function softDeleteWhere(alias, { activeOnly = true, includeDeleted = false } = {}) {
  const a = alias ? `${alias}.` : '';
  const conditions = [];
  if (!includeDeleted) {
    conditions.push(`${a}deleted_at IS NULL`);
  }
  if (activeOnly) {
    conditions.push(`${a}is_active = 1`);
  }
  return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
}

/**
 * Soft delete a record — set deleted_at + deleted_by + is_active=0.
 * Returns affected rows.
 */
export async function softDeleteRecord(conn, table, id, deletedBy) {
  const [result] = await conn.execute(
    `UPDATE ${table}
     SET deleted_at = NOW(),
         deleted_by = ?,
         is_active = 0,
         updated_at = NOW()
     WHERE id = ? AND deleted_at IS NULL`,
    [deletedBy, id]
  );
  return result.affectedRows;
}

/**
 * Restore soft-deleted record.
 */
export async function restoreRecord(conn, table, id) {
  const [result] = await conn.execute(
    `UPDATE ${table}
     SET deleted_at = NULL,
         deleted_by = NULL,
         is_active = 1,
         updated_at = NOW()
     WHERE id = ? AND deleted_at IS NOT NULL`,
    [id]
  );
  return result.affectedRows;
}
