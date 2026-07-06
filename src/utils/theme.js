// ================================================================
// WASCHEN THEME — Design System v3.0 (July 2026)
// Updated: Colors aligned with official logo color sampling
// Ref: My_Waschen_Redesign_Spec_dan_Prompt.md Section 2
// ================================================================
import { brand, neutral, neutralCompat, semantic, status, paymentStatus, paymentMethod, flag, iconBox } from './colors.js';

export const C = {
  // ─── Primary Brand ──────────────────────────────────────────────
  primary:      brand.primary,
  primaryDark:  brand.primaryDark,
  primaryLight: brand.primaryLight,
  primarySoft:  brand.primaryTint,
  primaryHover: brand.primaryLight,
  primaryTint:  brand.primaryTint,
  primaryTint2: brand.primaryTint2,

  // ─── Accent Colors (from mockup) ────────────────────────────────
  orange:       brand.orange,
  orangeLight:  brand.orangeLight,
  orangeTint:   brand.orangeTint,
  yellow:       brand.yellow,
  yellowLight:  brand.yellowLight,
  yellowTint:   brand.yellowTint,

  // ─── Secondary ─────────────────────────────────────────────────
  secondary: brand.primary,

  // ─── Semantic Colors ───────────────────────────────────────────
  success:     semantic.success,
  successBg:   semantic.successBg,
  successDark: semantic.successDark,
  warning:     semantic.warning,
  warningBg:   semantic.warningBg,
  warningDark: semantic.warningDark,
  danger:      semantic.danger,
  dangerBg:    semantic.dangerBg,
  dangerDark:  semantic.dangerDark,
  info:        semantic.info,
  infoBg:      semantic.infoBg,
  infoDark:    semantic.infoDark,
  error:       semantic.danger,

  // ─── Neutral (new compat keys) ──────────────────────────────────
  textPrimary:   neutral[800],
  textSecondary: neutral[600],
  textMuted:     neutral[500],
  textDisabled:  neutral[400],
  surface:       neutral.white,
  surface2:      neutral[50],
  surface3:      neutral[100],
  border:        neutral[200],
  borderStrong:  neutral[300],

  // ─── Neutral (legacy keys) ──────────────────────────────────────
  n900: neutralCompat.n900,
  n800: neutralCompat.n800,
  n700: neutralCompat.n700,
  n600: neutralCompat.n600,
  n500: neutralCompat.n500,
  n400: neutralCompat.n400,
  n300: neutralCompat.n300,
  n200: neutralCompat.n200,
  n100: neutralCompat.n100,
  n50:  neutralCompat.n50,
  white: neutralCompat.white,

  // ─── Status Colors ──────────────────────────────────────────────
  prosesBg:     status.proses.bg,
  prosesText:   status.proses.text,
  prosesBorder: status.proses.border,
  selesaiBg:    status.selesai.bg,
  selesaiText:  status.selesai.text,
  selesaiBorder: status.selesai.border,
  packingBg:    status.packing.bg,
  packingText:  status.packing.text,
  packingBorder: status.packing.border,
  diterimaBg:   status.diterima.bg,
  diterimaText:  status.diterima.text,
  batalBg:      status.batal.bg,
  batalText:    status.batal.text,
  batalBorder:  status.batal.border,

  // ─── Payment Status ─────────────────────────────────────────────
  paidBg:       paymentStatus.paid.bg,
  paidText:     paymentStatus.paid.text,
  partialBg:    paymentStatus.partial.bg,
  partialText:  paymentStatus.partial.text,
  unpaidBg:     paymentStatus.unpaid.bg,
  unpaidText:   paymentStatus.unpaid.text,

  // ─── Express Flag ───────────────────────────────────────────────
  expressBg:    flag.express.bg,
  expressText:  flag.express.text,
  expressBorder: flag.express.border,

  // ─── Icon Box ───────────────────────────────────────────────────
  ibBrand:    iconBox.brand.bg,
  ibSuccess:  iconBox.success.bg,
  ibWarning:  iconBox.warning.bg,
  ibInfo:     iconBox.info.bg,
  ibNeutral:  iconBox.neutral.bg,

  // ─── Extended Semantic Colors (Material Alerts) ─────────────────
  materialSutra:    '#EC4899',
  materialWol:       '#92400E',
  materialKulit:    '#7F1D1D',
  materialBeludru:  '#581C87',
  materialJeans:   '#1E40AF',
  materialPremium:  '#B45309',

  // ─── Section Headers ────────────────────────────────────────────
  sectionPinned:   brand.primary,
  sectionPopular:  '#0891B2',
  sectionOther:    neutral[600],

  // ─── Carpet/M2 Colors ──────────────────────────────────────────
  carpetBg:      '#EFF6FF',
  carpetBgEnd:   '#DBEAFE',
  carpetBorder:  '#BFDBFE',
  carpetText:    '#1E40AF',

  // ─── Validation Colors ──────────────────────────────────────────
  validationErrorBg:     '#FEE2E2',
  validationErrorBorder: '#FCA5A5',
  validationErrorText:   '#991B1B',
  validationWarningBg:   '#FEF3C7',
  validationWarningBorder:'#FCD34D',
  validationWarningText: '#B45309',
  validationInfoBg:      '#FEF9C3',
  validationInfoBorder:  '#FDE68A',
  validationInfoText:    '#854D0E',

  // ─── Badge Extended ────────────────────────────────────────────
  badgeDiamondBg:   '#dcfce7',
  badgeDiamondText: '#16a34a',
  badgeGoldBg:      '#FEF3C7',
  badgeGoldText:    '#B45309',
  badgeExpiredBg:   '#fee2e2',
  badgeExpiredText: '#dc2626',

  // ─── Schedule ──────────────────────────────────────────────────
  scheduleErrorBg:     '#FEE2E2',
  scheduleErrorBorder: '#FCA5A5',
  scheduleErrorText:   '#991B1B',
};

// ─── Shadow System (brand-colored) ────────────────────────────────
// Shadow menciptakan "timbul" — bukan warna.
// Using updated brand color: #5B005F (from logo sampling)
export const SHADOW = {
  // sm: Card resting state — subtle lift, grounded
  sm: [
    '0 1px 3px rgba(91, 0, 95, 0.07)',
    '0 6px 20px rgba(91, 0, 95, 0.09)',
  ].join(', '),

  // md: Card hover state — card rises, shadow deepens
  md: [
    '0 2px 8px rgba(91, 0, 95, 0.10)',
    '0 12px 32px rgba(91, 0, 95, 0.14)',
  ].join(', '),

  // lg: Elevated state — modals, sheets, floating elements
  lg: [
    '0 8px 40px rgba(0, 0, 0, 0.16)',
    '0 2px 8px rgba(0, 0, 0, 0.08)',
  ].join(', '),

  // xl: Top-level modals — maximum depth
  xl: [
    '0 24px 60px rgba(0, 0, 0, 0.18)',
    '0 6px 16px rgba(0, 0, 0, 0.10)',
  ].join(', '),

  // btn-brand: CTA utama (brand bg)
  btnBrand: [
    '0 4px 14px rgba(91, 0, 95, 0.40)',
  ].join(', '),

  // nav: Bottom nav / sticky bar
  nav: [
    '0 -2px 12px rgba(0, 0, 0, 0.06)',
  ].join(', '),

  // sm-soft: Chip / badge kecil
  smSoft: [
    '0 1px 4px rgba(91, 0, 95, 0.08)',
  ].join(', '),

  // glow: Focus ring
  glow: [
    '0 0 0 3px rgba(91, 0, 95, 0.12)',
  ].join(', '),

  // pinned: Shadow for pinned service items
  pinned: [
    '0 2px 10px rgba(91, 0, 95, 0.18)',
  ].join(', '),

  // popular: Shadow for popular service items
  popular: [
    '0 2px 10px rgba(8, 145, 178, 0.15)',
  ].join(', '),

  // carpet: Shadow for carpet measurement card
  carpet: [
    '0 2px 8px rgba(30, 64, 175, 0.1)',
  ].join(', '),

  // carpetFocus: Shadow for focused carpet input
  carpetFocus: [
    '0 4px 12px rgba(91, 0, 95, 0.1)',
  ].join(', '),

  // carpetButton: Shadow for carpet add button
  carpetButton: [
    '0 4px 12px rgba(91, 0, 95, 0.3)',
  ].join(', '),
};

// ─── T: Component Token Templates ────────────────────────────────
export const T = {
  card: {
    background: C.white,
    borderRadius: 14,
    boxShadow: SHADOW.sm,
    padding: '16px 18px',
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardSm: {
    background: C.white,
    borderRadius: 10,
    boxShadow: SHADOW.sm,
    padding: 12,
  },
  cardFocal: {
    background: C.primary,
    borderRadius: 14,
    boxShadow: SHADOW.md,
    padding: 18,
    color: '#fff',
  },
  input: {
    width: '100%',
    height: 46,
    padding: '0 14px',
    fontFamily: "-apple-system, 'Inter', 'Segoe UI', sans-serif",
    fontSize: 14,
    fontWeight: 400,
    color: C.textPrimary,
    background: C.white,
    border: `1.5px solid ${C.border}`,
    borderRadius: 8,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: 9999,
    whiteSpace: 'nowrap',
  },
  pageBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px 24px',
  },
};

// ─── Design System CSS Variables (inject ke :root) ───────────────
export const CSS_VARS = {
  '--brand':         brand.primary,
  '--brand-dark':    brand.primaryDark,
  '--brand-light':   brand.primaryLight,
  '--brand-tint':    brand.primaryTint,
  '--brand-tint2':   brand.primaryTint2,

  '--accent-orange':      brand.orange,
  '--accent-orange-light': brand.orangeLight,
  '--accent-orange-tint': brand.orangeTint,
  '--accent-yellow':      brand.yellow,
  '--accent-yellow-light': brand.yellowLight,
  '--accent-yellow-tint': brand.yellowTint,

  '--color-success':      semantic.success,
  '--color-success-bg':    semantic.successBg,
  '--color-success-dark':  semantic.successDark,
  '--color-warning':      semantic.warning,
  '--color-warning-bg':   semantic.warningBg,
  '--color-warning-dark': semantic.warningDark,
  '--color-danger':      semantic.danger,
  '--color-danger-bg':    semantic.dangerBg,
  '--color-danger-dark':  semantic.dangerDark,
  '--color-info':        semantic.info,
  '--color-info-bg':      semantic.infoBg,
  '--color-info-dark':    semantic.infoDark,

  '--text-primary':   neutral[800],
  '--text-secondary': neutral[600],
  '--text-muted':     neutral[500],
  '--text-disabled':  neutral[400],

  '--surface':        neutral.white,
  '--surface2':       neutral[50],
  '--surface3':       neutral[100],

  '--border':         neutral[200],
  '--border-strong':  neutral[300],

  '--radius-sm':   8,
  '--radius-md':   10,
  '--radius-lg':   14,
  '--radius-xl':   20,
  '--radius-full': 9999,

  // ─── Extended Semantic Variables ────────────────────────────────────
  '--material-sutra':    '#EC4899',
  '--material-wol':      '#92400E',
  '--material-kulit':   '#7F1D1D',
  '--material-beludru':  '#581C87',
  '--material-jeans':   '#1E40AF',
  '--material-premium':  '#B45309',

  '--section-pinned':   brand.primary,
  '--section-popular':  '#0891B2',
  '--section-other':    neutral[600],

  '--carpet-bg':        '#EFF6FF',
  '--carpet-bg-end':    '#DBEAFE',
  '--carpet-border':    '#BFDBFE',
  '--carpet-text':      '#1E40AF',

  '--validation-error-bg':     '#FEE2E2',
  '--validation-error-border': '#FCA5A5',
  '--validation-error-text':   '#991B1B',
  '--validation-warning-bg':    '#FEF3C7',
  '--validation-warning-border':'#FCD34D',
  '--validation-warning-text':  '#B45309',
  '--validation-info-bg':      '#FEF9C3',
  '--validation-info-border':   '#FDE68A',
  '--validation-info-text':     '#854D0E',

  '--badge-diamond-bg':   '#dcfce7',
  '--badge-diamond-text': '#16a34a',
  '--badge-gold-bg':      '#FEF3C7',
  '--badge-gold-text':    '#B45309',
  '--badge-expired-bg':   '#fee2e2',
  '--badge-expired-text': '#dc2626',

  // ─── Shadow Variables ──────────────────────────────────────────────
  '--shadow-pinned':   '0 2px 10px rgba(60, 10, 99, 0.18)',
  '--shadow-popular':  '0 2px 10px rgba(8, 145, 178, 0.15)',
  '--shadow-carpet':   '0 2px 8px rgba(30, 64, 175, 0.1)',
  '--shadow-carpet-focus': '0 4px 12px rgba(60, 10, 99, 0.1)',
  '--shadow-carpet-btn':   '0 4px 12px rgba(60, 10, 99, 0.3)',
};

// ─── Material Alert Colors (for NotaStep2 special care alerts) ──────
export const MATERIAL_COLORS = {
  sutra:    '#EC4899',  // Pink — delicate fabric
  silk:     '#EC4899',
  wol:      '#92400E',  // Brown — wool warning
  wool:     '#92400E',
  kulit:    '#7F1D1D',  // Dark red — leather/danger
  leather:  '#7F1D1D',
  beludru:  '#581C87',  // Purple — velvet
  velvet:   '#581C87',
  kaosPolos:'#0EA5E9', // Blue — color check
  jeans:    '#1E40AF', // Blue — denim warning
  denim:    '#1E40AF',
  premium:  '#B45309',  // Amber — premium brand
};

// ─── Section Colors (for service list sections) ─────────────────────
export const SECTION_COLORS = {
  pinned:   '#5B005F',      // Purple 700 — pinned items
  popular:  '#0891B2',      // Teal — popular items
  other:    '#5a5a5a',     // Neutral — other items
};

// ─── Express & Delivery Colors ──────────────────────────────────────
export const DELIVERY_COLORS = {
  expressBg:     semantic.warningBg,
  expressText:   semantic.warningDark,
  pickupBadge:   '#0EA5E9',
  deliveryBadge: '#059669',
};

// ─── Carpet/M2 Colors ───────────────────────────────────────────────
export const CARPET_COLORS = {
  bg:        '#EFF6FF',
  bgEnd:     '#DBEAFE',
  border:    '#BFDBFE',
  text:      '#1E40AF',
  shadow:    'rgba(30, 64, 175, 0.1)',
  focusBorder: '#5B005F',  // Updated to new brand color
};

// ─── Payment Section Colors ────────────────────────────────────────
export const PAYMENT_COLORS = {
  cashBg:       '#F9FAFB',
  changeBg:     'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
  changeBorder: '#6EE7B7',
  changeText:   '#065F46',
  successText:  '#059669',
  dangerText:   '#DC2626',
  depositBg:    '#F9FAFB',
  infoBg:       '#F0F9FF',
  infoBorder:   '#BAE6FD',
  infoText:     '#0369A1',
};

// ─── Validation & Warning Colors ────────────────────────────────────
export const VALIDATION_COLORS = {
  errorBg:     '#FEE2E2',
  errorBorder:  '#FCA5A5',
  errorText:    '#991B1B',
  warningBg:   '#FEF3C7',
  warningBorder:'#FCD34D',
  warningText:  '#B45309',
  infoBg:      '#FEF9C3',
  infoBorder:   '#FDE68A',
  infoText:    '#854D0E',
};

// ─── Schedule Validation Colors ──────────────────────────────────────
export const SCHEDULE_COLORS = {
  errorBg:     '#FEE2E2',
  errorBorder:  '#FCA5A5',
  errorText:    '#991B1B',
};

// ─── Extended Badge Colors ──────────────────────────────────────────
export const BADGE_COLORS = {
  diamond:  { bg: '#dcfce7', text: '#16a34a' }, // Diamond tier
  gold:     { bg: '#FEF3C7', text: '#B45309' }, // Gold tier
  expired:  { bg: '#fee2e2', text: '#dc2626' },  // Member expired
  expiring: { bg: '#FEF3C7', text: '#B45309' },  // Expiring soon
};
