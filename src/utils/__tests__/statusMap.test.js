/**
 * Session 1 — Test: statusMap.js
 * Status mapping, production stages, approval status, percentage colors.
 */
import { describe, it, expect } from 'vitest';
import {
  TX_STATUS, PAYMENT_STATUS, PRODUCTION_STAGES, APPROVAL_STATUS,
  URGENCY, PAYMENT_METHODS, GATEWAY_STATUS, EXPENSE_STATUS,
  dbToUiTxStatus, uiToDbTxStatus, dbToUiStage, getStageMeta,
  getStatusMeta, pctColor, pctBg,
} from '../statusMap';

// ── TX_STATUS mapping ───────────────────────────────────────────────────────
describe('dbToUiTxStatus()', () => {
  it('maps cancelled to dibatalkan', () => {
    expect(dbToUiTxStatus('cancelled')).toBe('dibatalkan');
  });

  it('maps to diambil when pickedUpAt is truthy', () => {
    expect(dbToUiTxStatus('completed', '2024-01-01')).toBe('diambil');
  });

  it('maps completed to selesai', () => {
    expect(dbToUiTxStatus('completed')).toBe('selesai');
  });

  it('maps ready_for_pickup to selesai', () => {
    expect(dbToUiTxStatus('ready_for_pickup')).toBe('selesai');
  });

  it('maps ready_for_delivery to selesai', () => {
    expect(dbToUiTxStatus('ready_for_delivery')).toBe('selesai');
  });

  it('maps process to proses', () => {
    expect(dbToUiTxStatus('process')).toBe('proses');
  });

  it('maps draft to baru', () => {
    expect(dbToUiTxStatus('draft')).toBe('baru');
  });

  it('maps pending to baru', () => {
    expect(dbToUiTxStatus('pending')).toBe('baru');
  });

  it('maps unknown status to baru (default)', () => {
    expect(dbToUiTxStatus('something_else')).toBe('baru');
  });

  it('maps null to baru', () => {
    expect(dbToUiTxStatus(null)).toBe('baru');
  });
});

describe('uiToDbTxStatus()', () => {
  it('maps baru to pending', () => expect(uiToDbTxStatus('baru')).toBe('pending'));
  it('maps proses to process', () => expect(uiToDbTxStatus('proses')).toBe('process'));
  it('maps selesai to completed', () => expect(uiToDbTxStatus('selesai')).toBe('completed'));
  it('maps diambil to completed', () => expect(uiToDbTxStatus('diambil')).toBe('completed'));
  it('maps dibatalkan to cancelled', () => expect(uiToDbTxStatus('dibatalkan')).toBe('cancelled'));
  it('passes through unknown status', () => expect(uiToDbTxStatus('custom')).toBe('custom'));
});

// ── Roundtrip ───────────────────────────────────────────────────────────────
describe('TX status roundtrip', () => {
  it('baru → pending → baru', () => {
    const db = uiToDbTxStatus('baru');
    expect(dbToUiTxStatus(db)).toBe('baru');
  });

  it('proses → process → proses', () => {
    const db = uiToDbTxStatus('proses');
    expect(dbToUiTxStatus(db)).toBe('proses');
  });

  it('dibatalkan → cancelled → dibatalkan', () => {
    const db = uiToDbTxStatus('dibatalkan');
    expect(dbToUiTxStatus(db)).toBe('dibatalkan');
  });
});

// ── TX_STATUS constants ─────────────────────────────────────────────────────
describe('TX_STATUS', () => {
  it('has all 5 UI status keys', () => {
    expect(Object.keys(TX_STATUS)).toEqual(['baru', 'proses', 'selesai', 'diambil', 'dibatalkan']);
  });

  it('each status has label, icon, color, bg, desc', () => {
    Object.values(TX_STATUS).forEach((s) => {
      expect(s.label).toBeTruthy();
      expect(s.icon).toBeTruthy();
      expect(s.color).toBeTruthy();
      expect(s.bg).toBeTruthy();
      expect(s.desc).toBeTruthy();
    });
  });
});

// ── PAYMENT_STATUS ──────────────────────────────────────────────────────────
describe('PAYMENT_STATUS', () => {
  it('has paid, partial, unpaid', () => {
    expect(PAYMENT_STATUS.paid).toBeDefined();
    expect(PAYMENT_STATUS.partial).toBeDefined();
    expect(PAYMENT_STATUS.unpaid).toBeDefined();
  });

  it('each has label and icon', () => {
    Object.values(PAYMENT_STATUS).forEach((s) => {
      expect(s.label).toBeTruthy();
      expect(s.icon).toBeTruthy();
    });
  });
});

// ── PRODUCTION_STAGES ───────────────────────────────────────────────────────
describe('PRODUCTION_STAGES', () => {
  it('has 5 stages', () => {
    expect(PRODUCTION_STAGES).toHaveLength(5);
  });

  it('first is Diterima, last is Selesai', () => {
    expect(PRODUCTION_STAGES[0].key).toBe('Diterima');
    expect(PRODUCTION_STAGES[4].key).toBe('Selesai');
  });
});

describe('dbToUiStage()', () => {
  it('maps received to Diterima', () => expect(dbToUiStage('received')).toBe('Diterima'));
  it('maps pending to Diterima', () => expect(dbToUiStage('pending')).toBe('Diterima'));
  it('maps washing to Cuci', () => expect(dbToUiStage('washing')).toBe('Cuci'));
  it('maps drying to Cuci', () => expect(dbToUiStage('drying')).toBe('Cuci'));
  it('maps ironing to Setrika', () => expect(dbToUiStage('ironing')).toBe('Setrika'));
  it('maps qc to Setrika', () => expect(dbToUiStage('qc')).toBe('Setrika'));
  it('maps packing to Packing', () => expect(dbToUiStage('packing')).toBe('Packing'));
  it('maps ready to Selesai', () => expect(dbToUiStage('ready')).toBe('Selesai'));
  it('maps done to Selesai', () => expect(dbToUiStage('done')).toBe('Selesai'));
  it('maps completed to Selesai', () => expect(dbToUiStage('completed')).toBe('Selesai'));
  it('maps null to Diterima', () => expect(dbToUiStage(null)).toBe('Diterima'));
  it('maps unknown to Diterima', () => expect(dbToUiStage('unknown_stage')).toBe('Diterima'));
  it('is case-insensitive', () => expect(dbToUiStage('WASHING')).toBe('Cuci'));
});

describe('getStageMeta()', () => {
  it('returns correct meta for Diterima', () => {
    const meta = getStageMeta('Diterima');
    expect(meta.key).toBe('Diterima');
    expect(meta.icon).toBe('📥');
  });

  it('returns Diterima meta for unknown', () => {
    const meta = getStageMeta('Unknown');
    expect(meta.key).toBe('Diterima');
  });
});

// ── APPROVAL_STATUS ─────────────────────────────────────────────────────────
describe('APPROVAL_STATUS', () => {
  it('has all approval states', () => {
    expect(APPROVAL_STATUS.pending).toBeDefined();
    expect(APPROVAL_STATUS.approved).toBeDefined();
    expect(APPROVAL_STATUS.rejected).toBeDefined();
    expect(APPROVAL_STATUS.revised).toBeDefined();
    expect(APPROVAL_STATUS.fulfilled).toBeDefined();
    expect(APPROVAL_STATUS.cancelled).toBeDefined();
  });
});

// ── URGENCY ─────────────────────────────────────────────────────────────────
describe('URGENCY', () => {
  it('has normal, urgent, critical', () => {
    expect(URGENCY.normal).toBeDefined();
    expect(URGENCY.urgent).toBeDefined();
    expect(URGENCY.critical).toBeDefined();
  });
});

// ── PAYMENT_METHODS ─────────────────────────────────────────────────────────
describe('PAYMENT_METHODS', () => {
  it('has all common methods', () => {
    ['cash', 'transfer', 'qris', 'gopay', 'shopeepay', 'ovo', 'dana', 'deposit', 'edc', 'mixed'].forEach((m) => {
      expect(PAYMENT_METHODS[m]).toBeDefined();
      expect(PAYMENT_METHODS[m].label).toBeTruthy();
    });
  });
});

// ── GATEWAY_STATUS ──────────────────────────────────────────────────────────
describe('GATEWAY_STATUS', () => {
  it('has Midtrans status mappings', () => {
    ['pending', 'capture', 'settlement', 'deny', 'cancel', 'expire', 'failure', 'refund'].forEach((s) => {
      expect(GATEWAY_STATUS[s]).toBeDefined();
    });
  });
});

// ── EXPENSE_STATUS ──────────────────────────────────────────────────────────
describe('EXPENSE_STATUS', () => {
  it('has expense approval states', () => {
    ['auto_approved', 'approved', 'pending_approval', 'rejected'].forEach((s) => {
      expect(EXPENSE_STATUS[s]).toBeDefined();
    });
  });
});

// ── pctColor ────────────────────────────────────────────────────────────────
describe('pctColor()', () => {
  it('returns green for >= 100', () => expect(pctColor(100)).toBe('#059669'));
  it('returns green for >= 80', () => expect(pctColor(80)).toBe('#10B981'));
  it('returns amber for >= 50', () => expect(pctColor(50)).toBe('#F59E0B'));
  it('returns red for < 50', () => expect(pctColor(30)).toBe('#EF4444'));
  it('returns red for 0', () => expect(pctColor(0)).toBe('#EF4444'));
  it('handles > 100', () => expect(pctColor(150)).toBe('#059669'));
});

describe('pctBg()', () => {
  it('returns light green for >= 100', () => expect(pctBg(100)).toBe('#DCFCE7'));
  it('returns light green for >= 80', () => expect(pctBg(80)).toBe('#D1FAE5'));
  it('returns light amber for >= 50', () => expect(pctBg(50)).toBe('#FEF3C7'));
  it('returns light red for < 50', () => expect(pctBg(30)).toBe('#FEE2E2'));
});

// ── getStatusMeta ───────────────────────────────────────────────────────────
describe('getStatusMeta()', () => {
  it('returns correct meta for known key', () => {
    const meta = getStatusMeta(TX_STATUS, 'baru');
    expect(meta.label).toBe('Baru');
  });

  it('returns fallback for null key', () => {
    const meta = getStatusMeta(TX_STATUS, null);
    expect(meta.label).toBe('-');
  });

  it('returns fallback for unknown key', () => {
    const meta = getStatusMeta(TX_STATUS, 'nonexistent');
    expect(meta.label).toBe('nonexistent');
  });

  it('uses custom fallback when provided', () => {
    const custom = { label: 'Custom', icon: '🔵', color: '#000', bg: '#fff' };
    const meta = getStatusMeta(TX_STATUS, null, custom);
    expect(meta.label).toBe('Custom');
  });
});
