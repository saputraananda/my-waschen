// ================================================================
// PRODUCTION DESIGN TOKENS — Waschen ERP
// Based on: MyWaschen_Produksi_DesignSpec.md
// Updated: June 2026 - Brand color #3C0A63
// ================================================================

import { C } from './theme';

// ─── 3.2 Stage Colors (Production Stages) ──────────────────────
// 3 Tahap: Diterima → Ready to Pickup → Selesai
export const STAGE_COLORS = {
  Diterima: '#5a5a5a',  // gray — received
  'Ready to Pickup': '#3C0A63',  // brand purple — ready
  Selesai: '#0f6e56',  // green — completed
};

// Accent bar + dot glow per stage
export const STAGE_STYLE = {
  Diterima: { accent: '#5a5a5a', bg: '#f0ecf2', text: '#5a5a5a', dotShadow: 'rgba(90,90,90,0.5)' },
  'Ready to Pickup': { accent: '#3C0A63', bg: '#F2E7FC', text: '#3C0A63', dotShadow: 'rgba(60,10,99,0.6)' },
  Selesai: { accent: '#0f6e56', bg: '#e1f5ee', text: '#0f6e56', dotShadow: 'rgba(15,110,86,0.6)' },
};

export const STAGE_ICONS = {
  Diterima: '📥',
  'Ready to Pickup': '📦',
  Selesai: '✅',
};

// ─── SLA / Deadline Colors ──────────────────────────────────────
export const SLA_STYLES = {
  overdue: {
    bg:      '#fff5f1',
    border:  '#fed7aa',
    text:    '#c2410c',
    badge:   '#f97316',
    dot:     '#ef4444',
  },
  urgent: {
    bg:      '#fff7ed',
    border:  '#fde68a',
    text:    '#92400e',
    badge:   '#f59e0b',
    dot:     '#f97316',
  },
  warning: {
    bg:      '#eff6ff',
    border:  '#bfdbfe',
    text:    '#1e40af',
    badge:   '#3b82f6',
    dot:     '#3b82f6',
  },
  normal: {
    bg:      '#f3f4f6',
    border:  '#e5e7eb',
    text:    '#6b7280',
    badge:   '#9ca3af',
    dot:     '#9ca3af',
  },
};

// ─── Layout & Spacing Tokens ───────────────────────────────────
export const LAYOUT = {
  pagePaddingX: 16,
  cardBorderRadius: 14,
  cardPadding: '14px 14px 12px',
  cardGap: 8,
  filterBarPadding: '10px 20px',
  sectionLabelPadding: '16px 16px 8px',
  touchTargetMin: 44,
};

// ─── Shadow System (Spec Section 1.3) ───────────────────────────
export const PROD_SHADOW = {
  // Default card — "mengambang" ringan
  card: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  // Urgent / telat card
  urgent: '0 2px 8px rgba(249,115,22,0.12)',
  // Active dot (stage glow)
  dotActive: (color) => `0 0 4px ${color}`,
  // Nav bar shadow
  nav: '0 -1px 8px rgba(0,0,0,0.06)',
  // Card tap active state
  cardTap: '0 1px 2px rgba(0,0,0,0.03)',
};

// ─── Header Design Tokens ───────────────────────────────────────
export const HEADER = {
  bg: '#16092e',
  accent: 'rgba(60,10,99,0.18)',
  primary: '#3C0A63',
  primaryLight: '#5a1a8a',
  textWhite: '#ffffff',
  textMuted: 'rgba(255,255,255,0.6)',
  textSub: 'rgba(255,255,255,0.65)',
  overdueText: '#E85D00',
  tabUnderline: '#5a1a8a',
};

// ─── Typography Rules (Spec 1.2) ───────────────────────────────
export const TYPO = {
  maxWeight: 600,
  bodyWeight: 400,
  labelWeight: 500,
  statWeight: 600,
  letterSpacing: '0.04em',
  letterSpacingUpper: '0.06em',
  textShadow: '0 2px 12px rgba(60,10,99,0.4)',
};

// ─── Bottom Navigation ──────────────────────────────────────────
export const BOTTOM_NAV = {
  bg: '#ffffff',
  borderTop: '0.5px solid rgba(0,0,0,0.07)',
  activeColor: '#3C0A63',
  inactiveColor: '#9ca3af',
  shadow: '0 -2px 12px rgba(0,0,0,0.06)',
  badgeBg: '#E11D48',
  badgeText: '#ffffff',
};

// ─── Urgent Bar ─────────────────────────────────────────────────
export const URGENT_BAR = {
  bg: '#fff5f1',
  border: '0.5px solid #fed7aa',
  borderRadius: 10,
  badgeBg: '#f97316',
  badgeText: '#ffffff',
};

// ─── Card Anatomy (Spec 3.4) ───────────────────────────────────
export const CARD = {
  accentBarWidth: 3,
  borderRadius: 14,
  padding: '14px 14px 12px',
  shadow: PROD_SHADOW.card,
  progressHeight: 2,
  progressDoneColor: '#3C0A63',
  progressActiveColor: 'rgba(90,26,138,0.5)',
};

// ─── Stage Tag (pill) ───────────────────────────────────────────
export const STAGE_TAG = {
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 10,
  fontWeight: 500,
  dotSize: 6,
  dotGlow: true,
};

// ─── Helpers ────────────────────────────────────────────────────
export const getSLALevel = (estimatedDoneAt) => {
  if (!estimatedDoneAt) return null;
  const diffMin = (new Date(estimatedDoneAt) - Date.now()) / 60000;
  if (diffMin < 0)   return 'overdue';
  if (diffMin < 120) return 'urgent';
  if (diffMin < 360) return 'warning';
  return 'normal';
};

export const formatSLA = (estimatedDoneAt) => {
  if (!estimatedDoneAt) return null;
  const diffMin = Math.round((new Date(estimatedDoneAt) - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  if (diffMin < 0) {
    if (abs < 60) return `Telat ${abs}m`;
    return `Telat ${Math.floor(abs / 60)}j ${abs % 60}m`;
  }
  if (diffMin < 60) return `${diffMin}m lagi`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}j lagi`;
  return `${Math.round(diffMin / 1440)}h lagi`;
};

export const getStageStyle = (stage) =>
  STAGE_STYLE[stage] || STAGE_STYLE['Diterima'];

export const getSlaStyle = (level) =>
  SLA_STYLES[level] || SLA_STYLES['normal'];