import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { TopBar, SkeletonList, useAppRefresh, Chip, FilterModal, FilterSection, FilterChipGroup } from '../../components/ui';
import { C } from '../../utils/theme';
import { useRealtimeMulti } from '../../utils/realtime';
import { useResponsive } from '../../utils/hooks';
import {
  ProductionSearchBar,
  SectionLabel,
  ProductionEmptyState,
  PAGE_BG,
  STAGE_TAGS,
  CARD_BG,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  getAvatarColor,
  getInitials,
} from '../../components/ProductionShared';
import { STAGE_ICONS } from '../../utils/productionDesign';

const STAGE_DOTS = {
  Diterima: '#a78bfa',
  Packing:  '#4ade80',
};

// ─── Enhanced per-item card with avatar and full info ─────────────────────────────────────────
function AntrianItemCard({ item, nota, onPress }) {
  const { isMobile } = useResponsive();
  const custName  = nota?.customerName || 'Customer';
  const custPhone = nota?.customerPhone;
  const notaNo    = nota?.id || '-';
  const isExpress = item.isExpress || nota?.isExpress;
  const sla       = formatSLA(nota?.estimatedDoneAt);
  const isOverdue = sla?.color === C.danger;
  const stage     = item.currentStage || 'Diterima';
  const tag       = STAGE_TAGS[stage] || STAGE_TAGS['Diterima'];
  
  // Progress: calculate filled based on stage index
  const stageOrder = ['Diterima', 'Packing'];
  const stageIdx = stageOrder.indexOf(stage);
  const filled = stageIdx >= 0 ? stageIdx + 1 : 0;

  // Avatar
  const initials = getInitials(custName);
  const avColor  = getAvatarColor(custName);

  const badges = [];
  if (isExpress) badges.push({ label: '⚡ Express', bg: C.validationWarningBg, color: C.validationWarningText });
  if (nota?.pickupType === 'pickup')   badges.push({ label: '🚗 Jemput', bg: C.validationInfoBg, color: C.validationInfoText });
  if (nota?.pickupType === 'delivery') badges.push({ label: '🛵 Antar',  bg: C.successBg, color: C.successDark });

  return (
    <div
      onClick={onPress}
      style={{
        background: CARD_BG,
        borderRadius: 14,
        border: `1px solid ${isOverdue ? C.danger : 'rgba(0,0,0,0.07)'}`,
        boxShadow: isOverdue
          ? '0 2px 12px rgba(239,68,68,0.18)'
          : '0 1px 4px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
        marginBottom: 10,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.1s',
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.99)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: tag.accent }} />

      <div style={{ padding: isMobile ? '10px 10px 8px 14px' : '12px 12px 10px 16px' }}>

        {/* Header: Avatar + Customer + Phone */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, marginBottom: isMobile ? 8 : 10 }}>
          {/* Avatar */}
          <div style={{
            width: isMobile ? 38 : 42, height: isMobile ? 38 : 42, borderRadius: isMobile ? 19 : 21,
            background: avColor.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Poppins', fontSize: isMobile ? 12 : 14, fontWeight: 600,
            color: avColor.text, flexShrink: 0,
            boxShadow: `0 2px 6px ${avColor.bg}60`,
          }}>
            {initials}
          </div>

          {/* Customer info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Poppins', fontSize: isMobile ? 13 : 14, fontWeight: 600,
              color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {custName}
            </div>
            <div style={{
              fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11, fontWeight: 400,
              color: TEXT_SECONDARY, marginTop: 1,
            }}>
              {custPhone ? `📞 ${custPhone}` : `📋 ${notaNo}`}
            </div>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
            {badges.map((b) => (
              <div key={b.label} style={{
                background: b.bg, color: b.color,
                fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                padding: '2px 7px', borderRadius: 999,
              }}>
                {b.label}
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 10 }} />

        {/* Service + Stage Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, marginBottom: 8 }}>
          {/* Service icon */}
          <div style={{
            width: isMobile ? 30 : 34, height: isMobile ? 30 : 34, borderRadius: isMobile ? 8 : 10,
            background: `${tag.accent}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isMobile ? 13 : 15, flexShrink: 0,
          }}>
            {STAGE_ICONS[stage] || '🧺'}
          </div>

          {/* Service name + qty */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Poppins', fontSize: isMobile ? 13 : 14, fontWeight: 600,
              color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {item.name || 'Layanan'}
            </div>
            <div style={{
              fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11, fontWeight: 500,
              color: TEXT_SECONDARY, marginTop: 1,
            }}>
              {item.qty} {item.unit || 'pcs'}
            </div>
          </div>

          {/* Stage tag */}
          <div style={{
            background: tag.bg, color: tag.text,
            padding: '4px 10px', borderRadius: 999,
            fontFamily: 'Poppins', fontSize: isMobile ? 9 : 10, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            boxShadow: tag.dotGlow ? `0 0 6px ${tag.dotGlow}` : 'none',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: tag.accent, boxShadow: tag.dotGlow || 'none', flexShrink: 0,
            }} />
            {isMobile ? STAGE_ICONS[stage] || stage : stage}
          </div>
        </div>

        {/* Item details (material/brand/special care) */}
        {(item.material || item.brand || item.specialCareAlert) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {item.material && (
              <span style={{ background: C.infoBg, color: C.infoDark, fontSize: '10px', fontFamily: 'Poppins', fontWeight: 500, padding: '3px 7px', borderRadius: '6px' }}>
                🧵 {item.material}
              </span>
            )}
            {item.brand && (
              <span style={{ background: C.infoBg, color: C.primary, fontSize: '10px', fontFamily: 'Poppins', fontWeight: 500, padding: '3px 7px', borderRadius: '6px' }}>
                🏷️ {item.brand}
              </span>
            )}
            {item.specialCareAlert && (
              <span style={{ background: C.validationWarningBg, color: C.validationWarningText, fontSize: '10px', fontFamily: 'Poppins', fontWeight: 600, padding: '3px 7px', borderRadius: '6px' }}>
                ⚠️ {item.specialCareAlert}
              </span>
            )}
          </div>
        )}

        {/* Visual Progress Bar with Icons */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
            {['Diterima', 'Packing'].map((s, i) => {
              const done = i < filled;
              const current = i === filled;
              const dotAccent = STAGE_TAGS[s]?.accent || '#a78bfa';
              
              return (
                <div key={`${s}-${i}`} style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
                  {/* Connector line */}
                  {i > 0 && (
                    <div style={{
                      position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                      width: '100%', height: 2, background: done ? dotAccent : 'rgba(0,0,0,0.1)',
                      zIndex: 0, marginLeft: '-50%',
                    }} />
                  )}
                  
                  {/* Stage Icon */}
                  <div style={{
                    width: 22, height: 22, borderRadius: 11,
                    background: done ? dotAccent : current ? `${dotAccent}30` : '#f3f4f6',
                    border: current ? `2px solid ${dotAccent}` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, flexShrink: 0, position: 'relative', zIndex: 1,
                    boxShadow: current ? `0 0 0 3px ${dotAccent}20` : 'none',
                    margin: '0 auto',
                  }}>
                    {done ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <span>{STAGE_ICONS[s]}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stage Labels */}
          <div style={{ display: 'flex', gap: 0, marginTop: 3 }}>
            {['Diterima', 'Packing'].map((s, i) => {
              const done = i < filled;
              const current = i === filled;
              const dotAccent = STAGE_TAGS[s]?.accent || '#a78bfa';
              
              return (
                <div key={s} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 7, fontWeight: current || done ? 600 : 400,
                    color: done ? dotAccent : current ? dotAccent : '#9ca3af',
                    lineHeight: 1.1,
                  }}>
                    {s}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SLA / Deadline */}
        {sla && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
            color: sla.color,
          }}>
            <span>{sla.icon}</span>
            <span>{sla.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SLA helper ─────────────────────────────────────────────────
function formatSLA(estimatedDoneAt) {
  if (!estimatedDoneAt) return null;
  const diffMin = Math.round((new Date(estimatedDoneAt) - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  if (diffMin < 0) {
    if (abs < 60) return { text: `Telat ${abs}m`, color: C.danger, icon: '🕐' };
    return { text: `Telat ${Math.floor(abs / 60)}j ${abs % 60}m`, color: C.danger, icon: '🕐' };
  }
  if (diffMin < 60)  return { text: `${diffMin}m lagi`, color: C.warning, icon: '⏰' };
  if (diffMin < 360) return { text: `${Math.floor(diffMin / 60)}j ${diffMin % 60}m lagi`, color: C.warning, icon: '⏰' };
  return { text: `${Math.floor(diffMin / 60)}j lagi`, color: C.n400, icon: '🕐' };
}

// ─── Main ─────────────────────────────────────────────────────
export default function AntrianPage({ navigate, goBack }) {
  const { isMobile } = useResponsive();
  const [queue, setQueue]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState('');
  const [stageFilter, setStageFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing]     = useState(false);
  const [pendingHandover, setPendingHandover] = useState(null);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Check for pending handover
  useEffect(() => {
    axios.get('/api/shifts/pending-handover')
      .then(r => setPendingHandover(r?.data?.data || null))
      .catch(() => {});
  }, []);

  const handleAcceptHandover = async () => {
    if (!pendingHandover) return;
    setAcceptLoading(true);
    try {
      await axios.post('/api/shifts/accept-handover', {
        sessionId: pendingHandover.sessionId,
      });
      setPendingHandover(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal terima operan.');
    } finally {
      setAcceptLoading(false);
    }
  };

  // ── fetch ───────────────────────────────────────────────────
  const fetchQueue = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/transactions/production/queue', { params: { limit: 200 } });
      setQueue(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e) {
      if (!e?.response) setError('Tidak dapat terhubung ke server.');
      else setError(e.response?.data?.message || 'Gagal memuat antrian.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Pull-to-refresh
  useAppRefresh(() => fetchQueue(true));

  // Realtime: refresh on any production event
  useRealtimeMulti(
    ['transaction:checkout', 'production:new-item', 'production:update'],
    () => fetchQueue(true)
  );

  // ── Flatten to per-item list ────────────────────────────────
  // Each card = one item, not one nota
  const flatItems = useMemo(() => {
    const result = [];
    for (const nota of queue) {
      for (const item of nota.items || []) {
        // Skip items already at Selesai (they belong in Riwayat)
        if (item.currentStage === 'Selesai') continue;
        result.push({ item, nota });
      }
    }
    return result;
  }, [queue]);

  // ── stats ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const s = { total: 0, Diterima: 0, Packing: 0 };
    flatItems.forEach(({ item }) => {
      const stage = item.currentStage || 'Diterima';
      if (s[stage] !== undefined) s[stage] += 1;
      s.total += 1;
    });
    return s;
  }, [flatItems]);

  const activeFilterCount = [
    stageFilter !== 'all',
    statusFilter !== 'all',
  ].filter(Boolean).length;

  // ── filtering + sorting ────────────────────────────────────
  const filtered = useMemo(() => {
    let items = flatItems;

    // Stage filter
    if (stageFilter !== 'all') {
      items = items.filter(({ item }) => (item.currentStage || 'Diterima') === stageFilter);
    }

    // Status filter - FIXED: "Hari Ini" now includes overdue + today deadline items
    if (statusFilter !== 'all') {
      const now = Date.now();
      items = items.filter(({ nota }) => {
        const eta = nota.estimatedDoneAt
          ? new Date(nota.estimatedDoneAt).getTime()
          : null;
        if (statusFilter === 'urgent') {
          // Mendesak: overdue OR < 60 minutes
          const diffMin = eta ? Math.round((eta - now) / 60000) : Infinity;
          return diffMin < 0 || (diffMin > 0 && diffMin <= 60);
        }
        if (statusFilter === 'today') {
          // Hari Ini: overdue OR due today OR < 3 hours
          if (!eta) return false;
          const diffMin = Math.round((eta - now) / 60000);
          
          // Include overdue items (prioritas hari ini!)
          if (diffMin < 0) return true;
          
          // Include items < 3 hours
          if (diffMin <= 180) return true;
          
          // Include items due today
          const d = new Date(eta);
          const today = new Date();
          return (
            d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate()
          );
        }
        return true;
      });
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(({ item, nota }) => {
        const notaId = (nota.id || '').toLowerCase();
        const custName = (nota.customerName || '').toLowerCase();
        const svcName  = (item.name || '').toLowerCase();
        return notaId.includes(q) || custName.includes(q) || svcName.includes(q);
      });
    }

    // Sort: express first, then by estimatedDoneAt asc
    items = [...items].sort((a, b) => {
      const aExpr = a.item.isExpress || a.nota.isExpress ? 0 : 1;
      const bExpr = b.item.isExpress || b.nota.isExpress ? 0 : 1;
      if (aExpr !== bExpr) return aExpr - bExpr;
      const aTs = a.nota.estimatedDoneAt ? new Date(a.nota.estimatedDoneAt).getTime() : Infinity;
      const bTs = b.nota.estimatedDoneAt ? new Date(b.nota.estimatedDoneAt).getTime() : Infinity;
      return aTs - bTs;
    });

    return items;
  }, [flatItems, stageFilter, statusFilter, search]);

  const handleItemPress = ({ item, nota }) => {
    navigate('detail_item_produksi', {
      id: nota.id,
      transactionUuid: nota.transactionUuid,
      item: {
        itemId: item.itemId,
        name: item.name,
        qty: item.qty,
        unit: item.unit,
        isExpress: item.isExpress,
        progress: item.progress,
        currentStage: item.currentStage,
        packingNeeded: item.packingNeeded,
        packingDone: item.packingDone,
        packingNotes: item.packingNotes,
      },
    });
  };

  // ── render ──────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: PAGE_BG,
      fontFamily: 'Inter, system-ui',
    }}>

      {/* Topbar */}
      <TopBar
        title="Antrian Produksi"
        subtitle={`${stats.total} item dalam antrian`}
        onBack={goBack}
      />

      {/* Handover Banner */}
      {pendingHandover && (
        <div style={{
          background: C.validationInfoBg, padding: '12px 14px', margin: '8px 14px 0',
          borderRadius: 12, border: `1.5px solid ${C.info}40`, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 24 }}>🔀</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.infoDark }}>
              Operan dari {pendingHandover.kasirName}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.infoDark, marginTop: 2 }}>
              Kas diserahkan: <strong>Rp {Number(pendingHandover.handoverCash).toLocaleString('id-ID')}</strong>
              {pendingHandover.handoverNotes ? ` — ${pendingHandover.handoverNotes}` : ''}
            </div>
          </div>
          <button
            onClick={handleAcceptHandover}
            disabled={acceptLoading}
            style={{
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: C.info, color: 'white',
              fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
              cursor: acceptLoading ? 'default' : 'pointer',
              opacity: acceptLoading ? 0.6 : 1,
            }}
          >
            {acceptLoading ? '...' : '✅ Terima'}
          </button>
        </div>
      )}

      {/* Search & Filter Header */}
      <div style={{ background: 'white', padding: isMobile ? '6px 12px 8px' : '8px 14px 10px', borderBottom: `1px solid ${C.n100}` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            flex: 1,
            background: C.n50,
            borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: isMobile ? '6px 10px' : '8px 12px',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={C.n400} strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari customer, no nota, atau layanan…"
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontFamily: 'Poppins', fontSize: 13,
                color: C.n900, outline: 'none',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  padding: 0, display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={C.n400} strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterOpen(true)}
            aria-label="Filter"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: `1.5px solid ${activeFilterCount > 0 ? C.primary : C.n200}`,
              background: activeFilterCount > 0 ? `${C.primary}10` : 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: activeFilterCount > 0 ? C.primary : C.n600,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="14" y2="6" />
              <line x1="20" y1="6" x2="18" y2="6" />
              <circle cx="16" cy="6" r="2" />
              <line x1="4" y1="12" x2="6" y2="12" />
              <line x1="20" y1="12" x2="10" y2="12" />
              <circle cx="8" cy="12" r="2" />
              <line x1="4" y1="18" x2="12" y2="18" />
              <line x1="20" y1="18" x2="16" y2="18" />
              <circle cx="14" cy="18" r="2" />
            </svg>
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                background: C.primary,
                color: 'white',
                fontFamily: 'Poppins',
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
              }}>{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Quick stage tabs */}
        <div style={{
          display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto',
          scrollbarWidth: 'none', paddingBottom: 2,
        }}>
          {[
            { key: 'all', label: 'Semua', count: stats.total },
            { key: 'Diterima', label: 'Diterima', count: stats.Diterima },
            { key: 'Packing', label: 'Packing', count: stats.Packing },
          ].map(p => {
            const active = stageFilter === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setStageFilter(p.key)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  background: active ? C.primary : C.n50,
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  color: active ? 'white' : C.n600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {p.label}
                {p.count > 0 && (
                  <span style={{
                    background: active ? 'rgba(255,255,255,0.25)' : C.n200,
                    padding: '1px 5px',
                    borderRadius: 999,
                    fontSize: 10,
                  }}>
                    {p.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${isMobile ? 12 : 14}px ${isMobile ? 90 : 80}px` }}>
        <SectionLabel label="Antrian Aktif" count={filtered.length} />

        {loading ? (
          <SkeletonList count={5} />
        ) : error ? (
          <ProductionEmptyState title="Gagal memuat" sub={error} />
        ) : filtered.length === 0 ? (
          <ProductionEmptyState
            title="Tidak ada antrian"
            sub={
              search || stageFilter !== 'all' || statusFilter !== 'all'
                ? 'Coba ubah filter atau kata kunci pencarian.'
                : 'Belum ada item di antrian produksi.'
            }
          />
        ) : (
          filtered.map(({ item, nota }, idx) => (
            <AntrianItemCard
              key={`${nota.id}-${item.itemId}`}
              item={item}
              nota={nota}
              onPress={() => handleItemPress({ item, nota })}
            />
          ))
        )}
      </div>

      {/* Auto-refresh indicator */}
      {refreshing && (
        <div style={{
          position: 'fixed', bottom: 82, left: '50%', transform: 'translateX(-50%)',
                            background: C.n800, color: '#ffffff',
          padding: '6px 14px', borderRadius: 999,
          fontFamily: 'Inter, system-ui', fontSize: 11, fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 6, zIndex: 50,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
                        background: C.primary, animation: 'refPulse 1s infinite',
          }} />
          Memperbarui…
        </div>
      )}

      <style>{`
        @keyframes refPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>

      <FilterModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter Antrian"
        onApply={() => setFilterOpen(false)}
        onReset={() => {
          setStageFilter('all');
          setStatusFilter('all');
        }}
      >
        <FilterSection title="Tahap Produksi">
          <FilterChipGroup
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'Diterima', label: 'Diterima' },
              { value: 'Packing', label: 'Packing' },
            ]}
            selected={stageFilter}
            onChange={(val) => setStageFilter(val)}
            multiple={false}
          />
        </FilterSection>

        <FilterSection title="Status Waktu">
          <FilterChipGroup
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'urgent', label: 'Mendesak' },
              { value: 'today', label: 'Hari Ini' },
            ]}
            selected={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            multiple={false}
          />
        </FilterSection>
      </FilterModal>
    </div>
  );
}
