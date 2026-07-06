// ================================================================
// WASCHEN BRAND COLORS — Design System v3.0 (July 2026)
// Updated: Colors aligned with official logo color sampling
// Ref: My_Waschen_Redesign_Spec_dan_Prompt.md Section 2
// ================================================================

// ─── 2.1 Brand Palette (from logo sampling) ──────────────────────
// Purple Core (brand)    : #5B005F — Dominan di logo
// Orange Core (brand)     : #F93E11 — Dominan di logo

export const brand = {
  // Purple family (from logo sampling)
  primary:     '#5B005F',   // Purple 700 — logo, teks/icon penting, CTA sekunder
  primaryDark: '#4D0051',   // Purple 900 — dasar gradient gelap, header
  primaryLight: '#8C4C8F',  // Purple 500 — hover state, titik tengah gradient
  primarySoft: '#AD80AF',   // Purple 300 — ilustrasi pendukung, divider halus
  primaryTint: '#E6D9E7',   // Purple 100 — background section terang, chip inactive
  primaryWash: '#F4EDF4',   // Purple 50  — background halaman/app-shell

  // Aliases for backward compatibility
  primaryTint2: '#E6D9E7',

  // Orange family (from logo sampling)
  orange:      '#F93E11',   // Orange 700 — CTA utama, badge urgent
  orangeLight: '#FA6541',   // Orange 400 — hover tombol, aksen ikon
  orangeTint:  '#FDB2A0',   // Orange 100 — badge/chip ringan (mis. "DP")
  orangeWash:  '#FED8CF',   // Orange 50  — background alert ringan

  // Aliases for backward compatibility
  orangeSoft:  '#FDB2A0',

  yellow:      '#FBBF24',   // Yellow accent
  yellowLight: '#FCD34D',   // Yellow hover
  yellowTint:  '#FEF9E7',   // Yellow background
};

// ─── 2.2 Semantic Colors (Status & Kondisi) ─────────────────────
// Dipakai hanya untuk makna — bukan dekorasi
export const semantic = {
  success: '#059669',   // Selesai, lunas, paid
  successBg: '#e1f5ee',
  successDark: '#0f6e56',

  warning: '#D97706',   // Pending, sebagian bayar, express
  warningBg: '#fef3e2',
  warningDark: '#ba7517',

  danger: '#E11D48',    // Batal, gagal, churn
  dangerBg: '#fce8eb',
  dangerDark: '#a32d2d',

  info: '#0891B2',      // Informasi netral, scan QR
  infoBg: '#e6f1fb',
  infoDark: '#185fa5',
};

// ─── 2.3 Neutral Palette ─────────────────────────────────────────
export const neutral = {
  50:  '#f7f5f8',   // page background
  100: '#f0ecf2',   // surface3 / active item bg
  200: '#e8e2ea',   // border
  300: '#d4cad8',   // border-strong
  400: '#c4c4c4',   // text-disabled
  500: '#9a9a9a',   // text-muted
  600: '#5a5a5a',   // text-secondary
  700: '#3a3a3a',   // (unused, kept for compat)
  800: '#1a1a1a',   // text-primary
  900: '#111111',   // (unused)
  white: '#ffffff', // surface / card bg
};

// ─── Backward compat neutral keys ────────────────────────────────
export const neutralCompat = {
  n50: neutral[50],
  n100: neutral[100],
  n200: neutral[200],
  n300: neutral[300],
  n400: neutral[400],
  n500: neutral[500],
  n600: neutral[600],
  n700: neutral[700],
  n800: neutral[800],
  n900: neutral[900] || '#111111',
  white: neutral.white,
};

// ─── 2.4 Status Colors (Proses & Produksi) ───────────────────────
// HANYA 5 warna status — tidak lebih
export const status = {
  // Diterima — netral, baru masuk
  diterima: {
    bg:    neutral[100],
    text:  neutral[600],
    border: neutral[200],
  },
  // Cuci / Setrika / Proses — warna brand, sedang dikerjakan
  proses: {
    bg:    brand.primaryTint,
    text:  brand.primary,
    border: '#d9b8e0',
  },
  // Packing — amber, hampir selesai
  packing: {
    bg:    semantic.warningBg,
    text:  semantic.warningDark,
    border: '#f5c27a',
  },
  // Selesai / Ready — hijau, sudah siap
  selesai: {
    bg:    semantic.successBg,
    text:  semantic.successDark,
    border: '#86efac',
  },
  // Batal — merah, perlu perhatian
  batal: {
    bg:    semantic.dangerBg,
    text:  semantic.dangerDark,
    border: '#fca5a5',
  },
};

// ─── Payment Status ──────────────────────────────────────────────
export const paymentStatus = {
  paid: {
    bg:    semantic.successBg,
    text:  semantic.successDark,
    border: '#86efac',
    label: 'Lunas',
  },
  partial: {
    bg:    semantic.warningBg,
    text:  semantic.warningDark,
    border: '#f5c27a',
    label: 'DP/Sebagian',
  },
  unpaid: {
    bg:    semantic.dangerBg,
    text:  semantic.dangerDark,
    border: '#fca5a5',
    label: 'Belum Bayar',
  },
};

// ─── Payment Methods ─────────────────────────────────────────────
export const paymentMethod = {
  cash: {
    bg:    semantic.successBg,
    text:  semantic.successDark,
    border: '#86efac',
    label: 'Tunai',
    icon: '💵',
  },
  transfer: {
    bg:    '#e6f1fb',
    text:  '#185fa5',
    border: '#93c5fd',
    label: 'Transfer',
    icon: '🏦',
  },
  qris: {
    bg:    semantic.infoBg,
    text:  semantic.infoDark,
    border: '#7dd3fc',
    label: 'QRIS',
    icon: '📱',
  },
  deposit: {
    bg:    brand.primaryTint,
    text:  brand.primary,
    border: '#d9b8e0',
    label: 'Deposit',
    icon: '💳',
  },
  midtrans: {
    bg:    brand.primaryTint,
    text:  brand.primary,
    border: '#d9b8e0',
    label: 'Midtrans',
    icon: '🌐',
  },
  ovo: {
    bg:    '#fff7ed',
    text:  '#ea580c',
    border: '#fb923c',
    label: 'OVO',
    icon: '📱',
  },
  gopay: {
    bg:    '#fce8eb',
    text:  '#a32d2d',
    border: '#fca5a5',
    label: 'GoPay',
    icon: '📱',
  },
  dana: {
    bg:    '#e6f1fb',
    text:  '#185fa5',
    border: '#93c5fd',
    label: 'DANA',
    icon: '📱',
  },
  shopeepay: {
    bg:    '#fff7ed',
    text:  '#ea580c',
    border: '#fb923c',
    label: 'ShopeePay',
    icon: '🛒',
  },
};

// ─── Express & Special Flags ─────────────────────────────────────
export const flag = {
  express: {
    bg:    semantic.warningBg,
    text:  semantic.warningDark,
    border: '#f5c27a',
  },
  urgent: {
    bg:    semantic.dangerBg,
    text:  semantic.dangerDark,
    border: '#fca5a5',
  },
};

// ─── Icon Box Colors ─────────────────────────────────────────────
export const iconBox = {
  brand:   { bg: brand.primaryTint },
  success: { bg: semantic.successBg },
  warning: { bg: semantic.warningBg },
  info:    { bg: semantic.infoBg },
  neutral: { bg: neutral[100] },
};

// ─── Section Colors ───────────────────────────────────────────────
export const sectionColors = {
  pinned: '#5B005F',  // Purple 700
  popular: '#0891B2', // Teal
  other: '#5a5a5a',   // Neutral
};

// ─── Carpet/M2 Colors ─────────────────────────────────────────────
export const carpetColors = {
  bg: '#EFF6FF',
  bgEnd: '#DBEAFE',
  border: '#BFDBFE',
  text: '#1E40AF',
  focusBorder: '#5B005F',
};

// ─── Legacy Export (for backward compat) ─────────────────────────
export const legacy = {
  primary:    '#5B005F',  // Updated from #3C0A63
  primaryDark: '#4D0051',
  primaryLight: '#8C4C8F',
  primarySoft: '#AD80AF',
  primaryHover: '#8C4C8F',

  n50:  '#f7f5f8',
  n100: '#f0ecf2',
  n200: '#e8e2ea',
  n300: '#d4cad8',
  n400: '#c4c4c4',
  n500: '#9a9a9a',
  n600: '#5a5a5a',
  n700: '#3a3a3a',
  n800: '#1a1a1a',
  n900: '#111111',
  white: '#ffffff',

  teal:       '#0891B2',
  tealHover:  '#06B6D4',
  tealDark:   '#0E7490',
  tealTint:   '#ECFEFF',

  gold:       '#D97706',
  goldHover:  '#F59E0B',
  goldDark:   '#B45309',
  goldTint:   '#FEF3C7',

  emerald:    '#059669',
  emeraldHover:'#10B981',
  emeraldTint:'#D1FAE5',

  rose:       '#E11D48',
  roseTint:   '#FFE4E6',

  success: '#059669',
  warning: '#D97706',
  danger:  '#E11D48',
  info:    '#0891B2',

  bgPage:    '#f7f5f8',
  bgCard:    '#ffffff',
  border:    '#e8e2ea',
  textPrimary:   '#1a1a1a',
  textSecondary: '#5a5a5a',
  textMuted:     '#9a9a9a',
  textDisabled:  '#c4c4c4',
};

// ─── Combined C object for easy import ────────────────────────────
export const C = {
  // Brand
  ...brand,
  // Semantic
  ...semantic,
  // Neutral
  ...neutral,
  ...neutralCompat,
  // Legacy
  ...legacy,
};
