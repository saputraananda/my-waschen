// ─────────────────────────────────────────────────────────────────────────────
// Input validation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validasi password complexity:
 * - Minimal 8 karakter
 * - Mengandung huruf dan angka
 * - Tidak boleh sama dengan username
 */
export function validatePassword(password, username = '') {
  if (!password || typeof password !== 'string') {
    return 'Password wajib diisi.';
  }
  if (password.length < 8) {
    return 'Password minimal 8 karakter.';
  }
  if (password.length > 72) {
    // bcrypt limit
    return 'Password maksimal 72 karakter.';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'Password harus mengandung huruf.';
  }
  if (!/\d/.test(password)) {
    return 'Password harus mengandung angka.';
  }
  if (username && password.toLowerCase() === String(username).toLowerCase()) {
    return 'Password tidak boleh sama dengan username.';
  }
  // Cek password yang terlalu umum
  const commonPasswords = ['password', '12345678', 'qwerty12', 'admin123', 'kasir123', 'welcome1'];
  if (commonPasswords.includes(password.toLowerCase())) {
    return 'Password terlalu umum. Pilih password yang lebih aman.';
  }
  return null; // valid
}

/**
 * Validasi email sederhana
 */
export function validateEmail(email) {
  if (!email) return null; // optional
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Format email tidak valid.';
  return null;
}

/**
 * Validasi username (alphanumeric, underscore, dash; min 3, max 30)
 */
export function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'Username wajib diisi.';
  if (username.length < 3) return 'Username minimal 3 karakter.';
  if (username.length > 30) return 'Username maksimal 30 karakter.';
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username hanya boleh mengandung huruf, angka, underscore, dan dash.';
  }
  return null;
}

/**
 * Validasi nomor telepon Indonesia (8-13 digit)
 */
export function validatePhone(phone) {
  if (!phone) return null; // optional
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length < 8 || cleaned.length > 15) {
    return 'Nomor telepon tidak valid (8-15 digit).';
  }
  return null;
}
