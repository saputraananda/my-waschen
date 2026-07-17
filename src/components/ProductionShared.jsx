import { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { TopBar, ErrorBoundary, SkeletonList, useAppRefresh, ProfileAvatar } from '../components/ui';
import { STAGES } from '../utils/helpers';
import { STAGE_ICONS } from '../utils/productionDesign';

// ─── Shared color tokens ───────────────────────────────────────
const PAGE_BG     = '#f4f3f8';
const CARD_BG     = '#ffffff';
const CARD_BORDER = 'rgba(0,0,0,0.07)';
const TEXT_PRIMARY   = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_MUTED     = '#9ca3af';
const PRIMARY        = '#7c3aed';
const PRIMARY_SOFT   = '#c4b5fd';

const STAGE_TAGS = {
  'Diterima': { bg: '#f3effe', text: '#5b21b6', accent: '#7c3aed', dotGlow: 'rgba(124,58,237,0.5)' },
  'Packing':  { bg: '#dcfce7', text: '#15803d', accent: '#4ade80', dotGlow: 'rgba(74,222,128,0.55)' },
  'Selesai':  { bg: '#f0fdf4', text: '#166534', accent: '#86efac', dotGlow: 'rgba(134,239,172,0.55)' },
};

const AV_COLORS = [
  { bg: '#ede9fe', text: '#6d28d9' },
  { bg: '#dbeafe', text: '#1d4ed8' },
  { bg: '#fef3c7', text: '#b45309' },
  { bg: '#dcfce7', text: '#15803d' },
  { bg: '#fce7f3', text: '#be185d' },
  { bg: '#ccfbf1', text: '#0f766e' },
  { bg: '#fee2e2', text: '#b91c1c' },
];

// ─── SLA ──────────────────────────────────────────────────────
function formatSLA(estimatedDoneAt) {
  if (!estimatedDoneAt) return null;
  const diffMin = Math.round((new Date(estimatedDoneAt) - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  if (diffMin < 0) {
    if (abs < 60) return { text: `Telat ${abs}m`, color: '#ef4444', icon: '🕐' };
    return { text: `Telat ${Math.floor(abs / 60)}j ${abs % 60}m`, color: '#ef4444', icon: '🕐' };
  }
  if (diffMin < 60)  return { text: `${diffMin}m lagi`, color: '#f97316', icon: '⏰' };
  if (diffMin < 360) return { text: `${Math.floor(diffMin / 60)}j ${diffMin % 60}m lagi`, color: '#f97316', icon: '⏰' };
  return { text: `${Math.floor(diffMin / 60)}j lagi`, color: '#9ca3af', icon: '🕐' };
}

// ─── Filter Pill (shared) ─────────────────────────────────────
export function FilterPill({ active, label, count, onClick, dotColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, padding: '5px 11px', borderRadius: 20,
        border: `0.5px solid ${active ? '#16092e' : 'rgba(0,0,0,0.1)'}`,
        background: active ? '#16092e' : CARD_BG,
        fontFamily: 'Inter, system-ui', fontSize: 12, fontWeight: 500,
        color: active ? '#ffffff' : TEXT_SECONDARY,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        transition: 'all 0.15s',
      }}
    >
      {dotColor && !active && (
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      )}
      {dotColor && active && (
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
      )}
      {label}
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.25)' : '#f3f4f6',
          color: active ? '#ffffff' : TEXT_MUTED,
          fontFamily: 'Inter, system-ui', fontSize: 10, fontWeight: 600,
          padding: '0 5px', borderRadius: 999, minWidth: 18,
          textAlign: 'center', lineHeight: '16px',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Production Filter Bar (shared) ───────────────────────────
export function ProductionFilterBar({ stageFilter, setStageFilter, statusFilter, setStatusFilter, period, setPeriod, stats }) {
  return (
    <div style={{
      padding: '10px 14px 4px', flexShrink: 0,
      background: CARD_BG,
      borderBottom: `0.5px solid ${CARD_BORDER}`,
    }}>
      {/* Stage row */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
        <FilterPill
          active={stageFilter === 'all'}
          label="Semua"
          count={stats.total}
          onClick={() => setStageFilter('all')}
        />
        {STAGES.map(stage => {
          const tag = STAGE_TAGS[stage] || STAGE_TAGS['Diterima'];
          return (
            <FilterPill
              key={stage}
              active={stageFilter === stage}
              label={stage}
              count={stats[stage] || 0}
              dotColor={tag.accent}
              onClick={() => setStageFilter(stage)}
            />
          );
        })}
      </div>
      {/* Status row */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
        <FilterPill
          active={statusFilter === 'all'}
          label="Semua"
          count={stats.total}
          onClick={() => setStatusFilter('all')}
        />
        <FilterPill
          active={statusFilter === 'urgent'}
          label="🔥 Mendesak"
          onClick={() => setStatusFilter('urgent')}
        />
        <FilterPill
          active={statusFilter === 'today'}
          label="⏰ Hari Ini"
          onClick={() => setStatusFilter('today')}
        />
      </div>
      {/* Period row */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          { value: '7',   label: '7 Hari' },
          { value: '30',  label: '30 Hari' },
          { value: '90',  label: '90 Hari' },
          { value: 'all', label: 'Semua' },
        ].map(p => {
          const active = period === p.value;
          return (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                flexShrink: 0, padding: '4px 10px', borderRadius: 20,
                border: `0.5px solid ${active ? '#16092e' : 'rgba(0,0,0,0.08)'}`,
                background: active ? '#16092e' : 'transparent',
                fontFamily: 'Inter, system-ui', fontSize: 11, fontWeight: 500,
                color: active ? '#ffffff' : TEXT_MUTED,
                cursor: 'pointer',
              }}
            >{p.label}</button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stages Strip ─────────────────────────────────────────────
export function StagesStrip({ stats }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 14px', background: CARD_BG,
      borderBottom: `0.5px solid ${CARD_BORDER}`,
    }}>
      {STAGES.map((stage, idx) => {
        const count = stats[stage] || 0;
        const tag    = STAGE_TAGS[stage] || STAGE_TAGS['Diterima'];
        const isLast = idx === STAGES.length - 1;
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 15,
                background: count > 0 ? tag.accent : 'rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Inter, system-ui', fontSize: 12, fontWeight: 500,
                color: count > 0 ? '#ffffff' : TEXT_MUTED,
              }}>{count}</div>
              <span style={{ fontFamily: 'Inter, system-ui', fontSize: 10, color: TEXT_MUTED }}>{stage}</span>
            </div>
            {!isLast && (
              <div style={{ flex: 1, height: 1.5, background: 'rgba(0,0,0,0.08)', marginBottom: 14 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Urgent Banner ─────────────────────────────────────────────
export function UrgentBanner({ count }) {
  if (count === 0) return null;
  return (
    <div style={{
      margin: '10px 14px 0',
      padding: '9px 12px',
      background: '#fff8f5',
      border: '0.5px solid #fed7aa',
      borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 18, color: '#f97316' }}>🔥</span>
        <span style={{ fontFamily: 'Inter, system-ui', fontSize: 12, fontWeight: 500, color: '#c2410c' }}>
          {count} item melewati estimasi selesai
        </span>
      </div>
      <div style={{
        background: '#f97316', color: '#ffffff',
        fontFamily: 'Inter, system-ui', fontSize: 11, fontWeight: 500,
        padding: '3px 9px', borderRadius: 8,
      }}>Segera</div>
    </div>
  );
}

// ─── Search Bar ───────────────────────────────────────────────
export function ProductionSearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ padding: '0 14px', background: CARD_BG }}>
      <div style={{
        background: '#f3f4f6',
        border: `0.5px solid rgba(0,0,0,0.07)`,
        borderRadius: 10,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', margin: '8px 0 10px',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || 'Cari customer, no nota, atau layanan…'}
          style={{
            flex: 1, border: 'none', background: 'transparent',
            fontFamily: 'Inter, system-ui', fontSize: 13, color: TEXT_PRIMARY, outline: 'none',
          }}
        />
        {value && (
          <button onClick={() => onChange('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Section Label ─────────────────────────────────────────────
export function SectionLabel({ label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 6px' }}>
      <span style={{
        fontFamily: 'Inter, system-ui', fontSize: 11, fontWeight: 500,
        color: TEXT_MUTED, letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{ fontFamily: 'Inter, system-ui', fontSize: 11, color: TEXT_MUTED }}>{count} item</span>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────
export function ProductionEmptyState({ title, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 14, filter: 'grayscale(1)', opacity: 0.4 }}>✓</div>
      <div style={{ fontFamily: 'Inter, system-ui', fontSize: 15, fontWeight: 500, color: TEXT_PRIMARY, marginBottom: 4 }}>{title}</div>
      <div style={{ fontFamily: 'Inter, system-ui', fontSize: 13, color: TEXT_MUTED }}>{sub}</div>
    </div>
  );
}

// ─── Item Card (Antrian) ───────────────────────────────────────
export function AntrianItemCard({ item, onPress }) {
  // API returns flat structure: { id, transactionUuid, items, customerName, isExpress, ... }
  // We show the card at the NOTA level (one card per transaction), displaying the
  // "slowest" item's info (overallCurrentStage) as the primary stage.
  const notaNo    = item.id || '-';
  const custName  = item.customerName || 'Tanpa nama';
  const isExpress = item.isExpress || item.items?.some(i => i.isExpress);
  const sla       = formatSLA(item.estimatedDoneAt);
  const isOverdue = sla?.color === '#ef4444';

  // Show first item as primary display (could be enhanced to show multiple)
  const primaryItem = item.items?.[0];
  const stage       = item.overallCurrentStage || primaryItem?.currentStage || 'Diterima';
  const tag         = STAGE_TAGS[stage] || STAGE_TAGS['Diterima'];
  const progress    = primaryItem?.progress || item.progress || [];
  const filled      = Math.min(4, Math.max(1, progress.length));

  const badges = [];
  if (isExpress)                            badges.push({ label: '⚡ Express', bg: '#fef3c7', color: '#b45309' });
  if (item.pickupType === 'pickup')         badges.push({ label: '🚗 Jemput',  bg: '#dbeafe', color: '#1d4ed8' });
  if (item.pickupType === 'delivery')       badges.push({ label: '🛵 Antar',   bg: '#dcfce7', color: '#15803d' });

  return (
    <div
      onClick={onPress}
      style={{
        background: CARD_BG,
        borderRadius: 14,
        border: `0.5px solid ${isOverdue ? '#fca5a5' : CARD_BORDER}`,
        boxShadow: isOverdue
          ? '0 2px 12px rgba(239,68,68,0.18)'
          : '0 1px 4px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
        marginBottom: 8,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.1s',
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.99)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: tag.accent }} />
      <div style={{ padding: '12px 12px 10px 16px' }}>

        {/* Row 1: Avatar + Customer + badges + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
          <ProfileAvatar
            user={{ name: custName, photo: item.customerPhoto }}
            size={38}
            style={{ borderRadius: 20, flexShrink: 0 }}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Inter, system-ui', fontSize: 13, fontWeight: 500,
              color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{custName}</div>
            <div style={{
              fontFamily: 'Inter, system-ui', fontSize: 11, fontWeight: 400,
              color: TEXT_MUTED, marginTop: 1,
            }}>Nota {notaNo}</div>
          </div>

          {badges.map((b) => (
            <div key={b.label} style={{
              background: b.bg, color: b.color,
              fontFamily: 'Inter, system-ui', fontSize: 9, fontWeight: 500,
              padding: '2px 7px', borderRadius: 999, flexShrink: 0,
            }}>{b.label}</div>
          ))}

          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={TEXT_MUTED} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        {/* Divider */}
        <div style={{ height: 0.5, background: 'rgba(0,0,0,0.06)', margin: '0 0 8px' }} />

        {/* Row 2: Service icon + service name + stage tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `${tag.accent}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, flexShrink: 0,
          }}>
            {STAGE_ICONS[stage] || '🧺'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Inter, system-ui', fontSize: 13, fontWeight: 500,
              color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{primaryItem?.name || 'Layanan'}</div>
            <div style={{
              fontFamily: 'Inter, system-ui', fontSize: 11, fontWeight: 400,
              color: TEXT_SECONDARY, marginTop: 1,
            }}>{primaryItem?.qty || 1} {primaryItem?.unit || 'pcs'}</div>
          </div>
          <div style={{
            background: tag.bg, color: tag.text,
            padding: '3px 9px', borderRadius: 999,
            fontFamily: 'Inter, system-ui', fontSize: 10, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            boxShadow: tag.dotGlow ? `0 0 4px ${tag.dotGlow}` : 'none',
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: tag.accent, boxShadow: tag.dotGlow || 'none', flexShrink: 0,
            }} />
            {stage}
          </div>
        </div>

        {/* Meta row */}
        <div style={{
          fontFamily: 'Inter, system-ui', fontSize: 11, color: TEXT_SECONDARY,
          marginBottom: 9, marginLeft: 38,
        }}>
          {item.items?.length > 1 ? `${item.items.length} layanan` : `${primaryItem?.qty || 1} ${primaryItem?.unit || 'pcs'}`}
          {' · '}Tahap: <span style={{ color: tag.text, fontWeight: 500 }}>{stage}</span>
        </div>

        {/* Row 3: Progress bar + deadline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, display: 'flex', gap: 3 }}>
            {Array.from({ length: 4 }).map((_, i) => {
              const done    = i < filled;
              const current = i === filled;
              return (
                <div key={i} style={{
                  flex: 1, height: 2.5, borderRadius: 1.25,
                  background: done ? PRIMARY : current ? PRIMARY_SOFT : 'rgba(0,0,0,0.08)',
                }} />
              );
            })}
          </div>
          <span style={{ fontFamily: 'Inter, system-ui', fontSize: 10, color: TEXT_MUTED, flexShrink: 0 }}>{filled}/4</span>
          {sla && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontFamily: 'Inter, system-ui', fontSize: 10, fontWeight: 500,
              color: sla.color, flexShrink: 0,
            }}>
              {sla.icon} {sla.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Riwayat Item Card ─────────────────────────────────────────
export function RiwayatItemCard({ it, onPress }) {
  const status = it.productionStatus === 'done'
    ? { label: 'Sudah diambil', emoji: '🎉', bg: '#DBEAFE', fg: '#1E40AF', soft: '#EFF6FF' }
    : { label: 'Siap diambil',  emoji: '✅', bg: '#D1FAE5', fg: '#065F46', soft: '#ECFDF5' };
  const stageTag = STAGE_TAGS[it.currentStage] || STAGE_TAGS['Selesai'];

  const timeAgo = (v) => {
    if (!v) return '';
    const ms = Date.now() - new Date(v).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'baru saja';
    if (min < 60) return `${min}m lalu`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}j lalu`;
    return `${Math.floor(h / 24)}d lalu`;
  };

  return (
    <button
      onClick={onPress}
      style={{
        width: '100%', textAlign: 'left',
        background: CARD_BG, borderRadius: 14,
        padding: '12px 14px', marginBottom: 8,
        border: `0.5px solid ${CARD_BORDER}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
        cursor: 'pointer', transition: 'transform 0.1s',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.99)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: stageTag.accent }} />
      <div style={{ paddingLeft: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontFamily: 'Inter, system-ui', fontSize: 11, fontWeight: 500, color: '#7c3aed' }}>📋 {it.id}</span>
            {it.isExpress && (
              <span style={{ background: '#fef3c7', color: '#b45309', fontFamily: 'Inter, system-ui', fontSize: 9, fontWeight: 500, padding: '1px 6px', borderRadius: 999 }}>⚡ Express</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <div style={{ background: stageTag.bg, color: stageTag.text, padding: '2px 7px', borderRadius: 999, fontFamily: 'Inter, system-ui', fontSize: 9, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: stageTag.accent }} />
              {it.currentStage}
            </div>
            <span style={{ fontFamily: 'Inter, system-ui', fontSize: 9, color: TEXT_MUTED }}>{timeAgo(it.updatedAt)}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: status.soft, border: `1.5px solid ${status.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧺</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Inter, system-ui', fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.itemName}</div>
            <div style={{ fontFamily: 'Inter, system-ui', fontSize: 11, color: TEXT_SECONDARY, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 500 }}>{it.qty} {it.itemUnit || 'pcs'}</span>
              <span style={{ color: TEXT_MUTED }}>·</span>
              <span>👤 {it.customerName}</span>
            </div>
            {it.outletName && (
              <div style={{ fontFamily: 'Inter, system-ui', fontSize: 9, color: TEXT_MUTED, marginTop: 1 }}>🏪 {it.outletName}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px dashed rgba(0,0,0,0.06)` }}>
          <span style={{ fontFamily: 'Inter, system-ui', fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: status.bg, color: status.fg, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {status.emoji} {status.label}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {it.production?.hasReceivePhoto && (
              <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 999, background: '#EFF6FF', color: '#1E40AF', fontFamily: 'Inter, system-ui', fontWeight: 500 }}>📥</span>
            )}
            {it.production?.hasPackingPhoto && (
              <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 999, background: '#F0FDF4', color: '#166534', fontFamily: 'Inter, system-ui', fontWeight: 500 }}>📦</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Page Background ─────────────────────────────────────────────
export { PAGE_BG, CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, STAGE_TAGS, PRIMARY, PRIMARY_SOFT };
