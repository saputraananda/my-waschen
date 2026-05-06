-- ============================================================
--  DDL Patch: User Profile Fields
--  Tanggal : 2026-05-06
--  Deskripsi:
--    Menambahkan kolom phone, email, dan photo ke tabel mst_user
--    untuk mendukung fitur manajemen profil per user.
-- ============================================================

-- Catatan: kolom phone (varchar(30)) dan email (varchar(120)) sudah ada di mst_user.
-- Hanya perlu menambahkan kolom photo.

ALTER TABLE mst_user
  ADD COLUMN photo LONGTEXT NULL COMMENT 'Foto profil (base64 data-uri)' AFTER phone;

-- Tambahkan index unik pada email (opsional, jika email wajib unik)
-- ALTER TABLE mst_user ADD UNIQUE INDEX ux_user_email (email);

-- ============================================================
--  Verifikasi kolom yang sudah ada (jalankan untuk cek)
-- ============================================================
-- DESCRIBE mst_user;
