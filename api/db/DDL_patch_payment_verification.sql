-- ============================================================
--  DDL Patch: Payment Verification Fields
--  Tanggal : 2026-05-06
--  Deskripsi:
--    Menambahkan kolom payment_verified, payment_verified_by,
--    payment_verified_at ke tr_transaction untuk fitur
--    verifikasi pembayaran oleh Finance.
-- ============================================================

ALTER TABLE tr_transaction
  ADD COLUMN payment_verified    TINYINT(1) NULL DEFAULT 0 COMMENT 'Status verifikasi: 0=belum, 1=sudah' AFTER payment_status,
  ADD COLUMN payment_verified_by CHAR(36)   NULL COMMENT 'User ID yang memverifikasi'                  AFTER payment_verified,
  ADD COLUMN payment_verified_at DATETIME   NULL COMMENT 'Waktu verifikasi'                            AFTER payment_verified_by;

-- ============================================================
--  Verifikasi
-- ============================================================
-- DESCRIBE tr_transaction;
