import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { C } from '../../utils/theme';
import { STAGES } from '../../utils/helpers';
import { Avatar, Btn, ErrorBoundary, SkeletonList, useAppRefresh } from '../../components/ui';
import { alertInfo, alertSuccess, alertWarning, alertError } from '../../utils/alert';
import { useRealtimeMulti } from '../../utils/realtime';
import { useResponsive } from '../../utils/hooks';
import {
  STAGE_STYLE, STAGE_ICONS, STAGE_TAG, SLA_STYLES,
  LAYOUT, PROD_SHADOW, HEADER, BOTTOM_NAV, URGENT_BAR, CARD,
  getSLALevel, formatSLA, getStageStyle, getSlaStyle,
} from '../../utils/productionDesign';

// ─── Premium Animation Assets ───────────────────────────────────────────────
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp'
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp'
import soapBubble from '../../assets/Decorative icon/soap-bubble.webp'

// ─── Production Stats Cards ───────────────────────────────────────────────
function ProductionStatsCard({ label, value, icon, color, onClick }) {
  const { isMobile } = useResponsive();
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      style={{
        flex: 1,
        background: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        borderRadius: 14,
        padding: isMobile ? '10px 8px' : '12px 10px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: isMobile ? 16 : 18 }}>{icon}</span>
      <span style={{
        fontFamily: 'Poppins',
        fontSize: isMobile ? 18 : 22,
        fontWeight: 700,
        color: color || C.primary,
        lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{
        fontFamily: 'Poppins',
        fontSize: isMobile ? 9 : 10,
        fontWeight: 500,
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </span>
    </motion.button>
  );
}

// ─── Inventory Alert Card ───────────────────────────────────────────────
function InventoryAlertCard({ item, onSendAlert }) {
  const stockPct = item.minStock > 0 ? Math.min(100, (item.stockQty / item.minStock) * 100) : 0;
  const isCritical = item.stockQty === 0 || stockPct < 25;
  const isWarning = !isCritical && stockPct < 50;
  const barColor = isCritical ? C.danger : isWarning ? C.warning : C.success;

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.72)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid rgba(255, 255, 255, 0.4)`,
      borderLeft: `4px solid ${barColor}`,
      borderRadius: 12,
      padding: '10px 12px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 13,
            fontWeight: 600,
            color: '#111827',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {item.name}
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 11,
            color: '#6B7280',
            marginTop: 2,
          }}>
            Sisa: <strong style={{ color: barColor }}>{Number(item.stockQty).toLocaleString('id-ID')} {item.unit}</strong>
            {' '} / Min: {Number(item.minStock).toLocaleString('id-ID')} {item.unit}
          </div>
        </div>
        <motion.button
          onClick={() => onSendAlert(item)}
          whileTap={{ scale: 0.95 }}
          style={{
            padding: '6px 12px',
            background: 'rgba(110, 46, 120, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 8,
            color: 'white',
            fontFamily: 'Poppins',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(110, 46, 120, 0.25)',
          }}
        >
          <span>📤</span>
          <span>Alert</span>
        </motion.button>
      </div>
      <div style={{
        marginTop: 8,
        height: 4,
        background: '#E5E7EB',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${stockPct}%`,
          height: '100%',
          background: barColor,
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Inventory Check Section ───────────────────────────────────────────────
function InventoryCheckSection({ outletId, onSendAlert, onViewAll }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const fetchLowStock = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`/api/inventory/stock?outletId=${outletId}`);
      const allItems = res?.data?.data || [];
      // Filter: hanya yang di bawah minimum
      const lowItems = allItems.filter(item =>
        item.stockQty <= item.minStock
      ).slice(0, 5); // Max 5 items
      setItems(lowItems);
    } catch (err) {
      setError('Gagal memuat stok');
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    fetchLowStock();
  }, [fetchLowStock]);

  const handleSendAlert = async (item) => {
    setSendingId(item.id);
    try {
      await axios.post('/api/inventory/low-stock-alert', {
        inventoryId: item.id,
        outletId,
        stockQty: item.stockQty,
        minStock: item.minStock,
        itemName: item.name,
        unit: item.unit,
      });
      alertSuccess(`Alert stok ${item.name} sudah dikirim ke kasir!`);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal kirim alert');
    } finally {
      setSendingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '0 16px' }}>
        <div className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 8 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '12px 16px',
        background: C.validationErrorBg,
        borderRadius: 12,
        margin: '0 16px',
        textAlign: 'center',
      }}>
        <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.danger }}>
          ⚠️ {error}
        </span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{
        padding: '12px 16px',
        background: C.successBg,
        borderRadius: 12,
        margin: '0 16px',
        textAlign: 'center',
      }}>
        <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.success }}>
          ✅ Semua stok dalam kondisi aman
        </span>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        marginBottom: 8,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ fontSize: 14 }}>📦</span>
          <span style={{
            fontFamily: 'Poppins',
            fontSize: 11,
            fontWeight: 600,
            color: C.danger,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Stok Menipis ({items.length})
          </span>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: 'Poppins',
              fontSize: 11,
              fontWeight: 600,
              color: C.primary,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Lihat Semua →
          </button>
        )}
      </div>
      <div style={{ padding: '0 16px' }}>
        {items.map(item => (
          <InventoryAlertCard
            key={item.id}
            item={item}
            onSendAlert={handleSendAlert}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Premium Animation Components ──────────────────────────────────────────────
const FloatingBubble = ({ src, size, top, left, right, bottom, delay = 0, duration = 5, opacity = 0.4 }) => (
  <motion.div
    animate={{ y: [0, -15, 0], scale: [1, 1.08, 1], opacity: [opacity * 0.5, opacity, opacity * 0.5] }}
    transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    style={{ position: 'absolute', top, left, right, bottom, width: size, height: size, pointerEvents: 'none', zIndex: 0 }}
  >
    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.08))' }} loading="lazy" />
  </motion.div>
);

const Sparkle = ({ top, left, size = 5, delay = 0 }) => (
  <motion.div
    style={{ position: 'absolute', top, left, width: size, height: size, background: '#E85D04', borderRadius: '50%', boxShadow: `0 0 ${size}px #E85D04`, pointerEvents: 'none', zIndex: 1 }}
    animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 180, 360] }}
    transition={{ duration: 2, delay, repeat: Infinity, ease: 'easeOut' }}
  />
);

// ─── Hero Header — Header Gelap dengan Stats Filter Tabs ────────
function HeroHeader({ user, allActive, allDone, activeItemCount, overdueCount, onRefresh, onProfileClick, activeTab, onTabChange }) {
  const { isMobile } = useResponsive();
  const stats = useMemo(() => {
    let proses = 0, selesai = 0, packing = 0;
    allActive.forEach(tx => {
      (tx.items || []).forEach(item => {
        if (!item.isDone) {
          proses++;
          if (item.currentStage === 'Packing') packing++;
        }
      });
    });
    allDone.forEach(tx => {
      (tx.items || []).forEach(item => {
        if (item.isDone) selesai++;
      });
    });
    return {
      semua: activeItemCount,
      proses,
      packing,
      telat: overdueCount,
      selesai,
    };
  }, [allActive, allDone, activeItemCount, overdueCount]);

  const tabs = [
    { key: 'semua',   label: 'Semua',   count: stats.semua },
    { key: 'proses',  label: 'Proses',  count: stats.proses },
    { key: 'telat',   label: 'Telat',   count: stats.telat, urgent: stats.telat > 0 },
    { key: 'selesai', label: 'Selesai', count: stats.selesai },
  ];

  return (
    <div style={{
      background: HEADER.bg,
      padding: isMobile ? '8px 12px 10px' : '10px 16px 12px',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative accent circle */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 140, height: 140, borderRadius: '50%',
        background: HEADER.accent,
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />

      {/* Top row: greeting + avatar */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: isMobile ? 6 : 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Poppins', fontSize: isMobile ? 8 : 9, color: HEADER.textMuted,
            letterSpacing: HEADER.letterSpacingUpper, fontWeight: 600,
          }}>
            🏭 {user?.outlet?.name || user?.outletName || 'Outlet'}
          </div>
          <div style={{
            fontFamily: 'Poppins', fontSize: isMobile ? 13 : 15, fontWeight: 600, color: HEADER.textWhite,
            marginTop: 1, lineHeight: 1.15,
          }}>
            Hai, {user?.name?.split(' ')[0] || 'Tim'}
            <span style={{ fontSize: isMobile ? 11 : 13 }}> 👋</span>
            <span style={{
              fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11, fontWeight: 500,
              color: HEADER.textSub, marginLeft: 6,
            }}>
              · {activeItemCount} layanan
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={onRefresh}
            aria-label="Refresh"
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
              width: 32, height: 32, borderRadius: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
          <Avatar photo={user?.photo} initials={user?.avatar} size={32} onClick={onProfileClick} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: isMobile ? 6 : 8,
        marginBottom: isMobile ? 8 : 10,
      }}>
        <ProductionStatsCard label="Masuk" value={stats.semua} icon="📥" color={C.primary} />
        <ProductionStatsCard label="Diproses" value={stats.proses} icon="🧺" color="#38bdf8" />
        <ProductionStatsCard label="Selesai" value={stats.selesai} icon="✅" color={C.success} />
      </div>

      {/* Stats filter tabs */}
<div style={{ display: 'flex', gap: 0, position: 'relative' }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '7px 4px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                position: 'relative',
              }}
            >
              <span style={{
                fontFamily: 'Poppins', fontSize: 10,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? HEADER.textWhite : HEADER.textMuted,
                letterSpacing: HEADER.letterSpacing,
 }}>
                {tab.key === 'telat' && tab.urgent ? '🔥 ' : ''}{tab.label}
              </span>
              <span style={{
                fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                color: isActive ? HEADER.textWhite : tab.urgent ? HEADER.overdueText : HEADER.textMuted,
                textShadow: tab.urgent && !isActive ? '0 0 8px rgba(249,115,22,0.5)' : 'none',
              }}>
                {tab.count}
              </span>
              {/* Active underline */}
              {isActive && (
                <div style={{
                  position: 'absolute', bottom: 0, left: '15%', right: '15%',
                  height: 2, borderRadius: 1,
                  background: HEADER.tabUnderline,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Urgent Bar ─────────────────────────────────────────────────
function UrgentBar({ count }) {
  if (count === 0) return null;
  return (
    <div style={{
      margin: '8px 16px 0',
      padding: '8px 14px',
      background: URGENT_BAR.bg,
      border: URGENT_BAR.border,
      borderRadius: URGENT_BAR.borderRadius,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>🔥</span>
        <span style={{
          fontFamily: 'Poppins', fontSize: 11, fontWeight: 500,
          color: C.danger,
        }}>
          {count} item melewati estimasi selesai
        </span>
      </div>
      <div style={{
        background: URGENT_BAR.badgeBg, color: URGENT_BAR.badgeText,
        fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
        padding: '2px 8px', borderRadius: 999,
        boxShadow: '0 1px 4px rgba(249,115,22,0.2)',
      }}>
        Segera
      </div>
    </div>
  );
}

// ─── Stage Filter Bar (Pill Chips) ──────────────────────────────
function StageFilterBar({ workstation, workstationCounts, onChange }) {
  const options = ['Semua', 'Diterima', 'Packing'];
  return (
    <div style={{
      padding: '8px 16px 0',
      overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(ws => {
          const isActive = workstation === ws;
          const count = workstationCounts[ws] || 0;
          const stageStyle = getStageStyle(ws === 'Semua' ? 'Diterima' : ws);
          const color = ws === 'Semua' ? HEADER.primary : stageStyle.accent;

          return (
            <button
              key={ws}
              onClick={() => onChange(ws)}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                borderRadius: 999,
                border: `1.5px solid ${isActive ? color : C.n200}`,
                background: isActive ? HEADER.bg : stageStyle.bg,
                cursor: 'pointer',
                fontFamily: 'Poppins', fontSize: 11,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#ffffff' : stageStyle.text,
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.15s',
              }}
            >
              {ws !== 'Semua' && <span style={{ fontSize: 12 }}>{STAGE_ICONS[ws]}</span>}
              {ws}
              {count > 0 && (
                <span style={{
                  background: isActive ? 'rgba(255,255,255,0.2)' : C.n200,
                  color: isActive ? '#ffffff' : C.n600,
                  fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                  padding: '0 5px', borderRadius: 999, minWidth: 16,
                  textAlign: 'center', lineHeight: '14px',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Item Card — Enhanced with Avatar + Better Progress ───────────────────────────
function ItemCard({ tx, item, onPress }) {
  const { isMobile } = useResponsive();
  const isDone = item.isDone;
  const stage = item.currentStage || 'Diterima';
  const stageStyle = getStageStyle(stage);
  const sla = isDone ? null : getSLALevel(tx.estimatedDoneAt);
  const slaStyle = sla ? getSlaStyle(sla) : null;

  // Progress data
  const progress = item.progress || [];
  const ACTIVE_STAGES = ['Diterima', 'Packing'];
  
  // Avatar initials
  const customerName = tx.customerName || 'U';
  const initials = customerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
<button
      onClick={() => onPress(tx, item)}
      style={{
        width: '100%', textAlign: 'left',
        background: C.white,
        borderRadius: CARD.borderRadius,
        padding: isMobile ? '10px' : '12px',
        border: `1px solid ${sla === 'overdue' ? C.validationErrorBg : C.n200}`,
        boxShadow: sla === 'overdue' ? PROD_SHADOW.urgent : PROD_SHADOW.card,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 0.1s, transform 0.1s',
        marginBottom: CARD.cardGap,
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.99)'; e.currentTarget.style.boxShadow = PROD_SHADOW.cardTap; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = sla === 'overdue' ? PROD_SHADOW.urgent : PROD_SHADOW.card; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = sla === 'overdue' ? PROD_SHADOW.urgent : PROD_SHADOW.card; }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3,
        background: stageStyle.accent,
        borderRadius: `${CARD.borderRadius}px 0 0 ${CARD.borderRadius}px`,
      }} />

      {/* Header: Avatar + Customer Info + Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, marginBottom: 10, paddingLeft: 5 }}>
        {/* Avatar */}
        <div style={{
          width: isMobile ? 36 : 40, height: isMobile ? 36 : 40, borderRadius: isMobile ? 18 : 20,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Poppins', fontSize: isMobile ? 11 : 13, fontWeight: 600,
          color: '#ffffff', flexShrink: 0,
          boxShadow: '0 2px 8px rgba(102,126,234,0.25)',
        }}>
          {initials}
        </div>

        {/* Customer Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 600,
            color: C.n800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {tx.customerName || 'Customer'}
          </div>
          <div style={{
            fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11, fontWeight: 400,
            color: C.n500, marginTop: 1,
          }}>
            {tx.customerPhone ? `📞 ${tx.customerPhone}` : `📋 ${tx.id}`}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
          {item.isExpress && (
            <span style={{
              background: C.validationWarningBg, color: C.validationWarningText,
              fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
              padding: '2px 7px', borderRadius: 999,
              boxShadow: '0 1px 3px rgba(180,83,9,0.1)',
            }}>⚡ Express</span>
          )}
          {tx.pickupType === 'delivery' && (
            <span style={{
              background: C.successBg, color: C.successDark,
              fontFamily: 'Poppins', fontSize: 9, fontWeight: 500,
              padding: '2px 7px', borderRadius: 999,
            }}>🛵 Antar</span>
          )}
          {tx.pickupType === 'pickup' && (
            <span style={{
              background: C.infoBg, color: C.infoDark,
              fontFamily: 'Poppins', fontSize: 9, fontWeight: 500,
              padding: '2px 7px', borderRadius: 999,
            }}>🚗 Jemput</span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '0 0 10px 5px' }} />

      {/* Service Info */}
      <div style={{ paddingLeft: 5 }}>
        {/* Service name + stage tag */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Poppins', fontSize: isMobile ? 13 : 14, fontWeight: 600,
              color: C.n800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {item.name}
            </div>
            <div style={{
              fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11, fontWeight: 500,
              color: C.n500, marginTop: 1,
            }}>
              {item.qty} {item.unit}
            </div>
          </div>

          {/* Stage tag */}
          <div style={{
            background: stageStyle.bg, color: stageStyle.text,
            padding: isMobile ? '3px 8px' : '4px 10px', borderRadius: 999,
            fontFamily: 'Poppins', fontSize: isMobile ? 9 : 10, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: stageStyle.dotShadow ? `0 0 6px ${stageStyle.dotShadow}` : 'none',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: isMobile ? 10 : 12 }}>{STAGE_ICONS[stage]}</span>
            {isMobile ? '' : stage}
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

        {/* Visual Progress Tracker with Icons */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
            {ACTIVE_STAGES.map((s, idx) => {
              const stageDone = progress.some(p => p.stage === s);
              const isCurrent = s === stage;
              const stStyle = getStageStyle(s);

              return (
                <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
                  {/* Connector line */}
                  {idx > 0 && (
                    <div style={{
                      position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                      width: '100%', height: 2, background: stageDone ? stStyle.accent : 'rgba(0,0,0,0.1)',
                      zIndex: 0, marginLeft: '-50%',
                    }} />
                  )}
                  
                  {/* Stage Icon */}
                  <div style={{
                    width: 26, height: 26, borderRadius: 13,
                    background: stageDone ? stStyle.accent : isCurrent ? `${stStyle.accent}30` : C.n100,
                    border: isCurrent ? `2px solid ${stStyle.accent}` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, flexShrink: 0, position: 'relative', zIndex: 1,
                    boxShadow: isCurrent ? `0 0 0 3px ${stStyle.accent}20` : 'none',
                    margin: '0 auto',
                  }}>
                    {stageDone ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
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
          <div style={{ display: 'flex', gap: 0, marginTop: 4 }}>
            {ACTIVE_STAGES.map((s) => {
              const stageDone = progress.some(p => p.stage === s);
              const isCurrent = s === stage;
              const stStyle = getStageStyle(s);
              
              return (
                <div key={s} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 8, fontWeight: isCurrent || stageDone ? 600 : 400,
                    color: stageDone ? stStyle.text : isCurrent ? stStyle.text : C.n400,
                    lineHeight: 1.2,
                  }}>
                    {s}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SLA / Deadline */}
        {sla && slaStyle && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: slaStyle.bg, color: slaStyle.text,
            padding: '5px 10px', borderRadius: 8,
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
            marginTop: 6,
          }}>
            <span style={{ fontSize: 13 }}>{sla === 'overdue' ? '🔥' : '⏰'}</span>
            <span>{formatSLA(tx.estimatedDoneAt)}</span>
          </div>
        )}
        {isDone && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: C.successBg, color: C.successDark,
            padding: '5px 10px', borderRadius: 8,
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
            marginTop: 6,
          }}>
            <span>✓ Selesai Produksi</span>
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Section Header ─────────────────────────────────────────────
function SectionHeader({ icon, label, count, accentColor }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '16px 16px 8px',
    }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <div style={{
        fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
        color: accentColor, letterSpacing: HEADER.letterSpacingUpper,
      }}>
        {label.toUpperCase()}
      </div>
      <div style={{
        background: accentColor, color: '#ffffff',
        fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
        padding: '1px 6px', borderRadius: 999,
      }}>
        {count}
      </div>
      <div style={{ flex: 1, height: 1, background: `${accentColor}20`, marginLeft: 4 }} />
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────
function EmptyState({ lastRefresh, activeTab, workstation, overdueCount }) {
  let title = 'Antrian kosong';
  let subtitle = 'Semua item sudah selesai diproses';

  if (activeTab === 'telat' && overdueCount === 0) {
    title = 'Tidak ada item telat';
    subtitle = '🎉 Semua item masih dalam target waktu';
  } else if (activeTab === 'selesai') {
    title = 'Belum ada item selesai';
    subtitle = 'Item yang sudah selesai akan muncul di sini';
  } else if (workstation !== 'Semua') {
    title = `Tidak ada item di ${workstation}`;
    subtitle = `Belum ada item yang sedang diproses di stasiun ${workstation}`;
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '60px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24,
        background: C.n100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16, fontSize: 38,
      }}>
        {activeTab === 'telat' && overdueCount === 0 ? '🎉' : '✅'}
      </div>
      <div style={{
        fontFamily: 'Poppins', fontSize: 16, fontWeight: 500, color: C.n800, marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: 'Poppins', fontSize: 13, color: C.n400,
      }}>
        {subtitle}
      </div>
      {lastRefresh && (
        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n400, marginTop: 14 }}>
          Diperbarui {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────
export function ProduksiDashboardPage({ user, navigate }) {
  const { isMobile } = useResponsive();
  const [activeTab, setActiveTab] = useState('semua');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [workstation, setWorkstation] = useState(() => localStorage.getItem('produksi_workstation') || 'Semua');
  const prevTxIds = useRef(new Set());
  const fetchLockRef = useRef(false);
  const fetchTimerRef = useRef(null);

  const handleWorkstationChange = (ws) => {
    setWorkstation(ws);
    localStorage.setItem('produksi_workstation', ws);
  };

  const fetchQueue = useCallback(async (silent = false) => {
    if (fetchLockRef.current) return;
    fetchLockRef.current = true;
    if (fetchTimerRef.current) { clearTimeout(fetchTimerRef.current); fetchTimerRef.current = null; }

    if (!silent) { setError(null); setLoading(true); }
    try {
      const res = await axios.get('/api/transactions/production/queue');
      const data = res?.data?.data || [];

      if (silent && data.length > 0) {
        const currentIds = new Set(data.map(t => t.id));
        const hasNew = data.some(t => !prevTxIds.current.has(t.id) && t.status === 'baru');
        if (hasNew && prevTxIds.current.size > 0) {
          alertInfo('Cucian baru saja ditambahkan oleh kasir.', { title: 'Order Baru Masuk!' });
        }
        prevTxIds.current = currentIds;
      } else if (!silent) {
        prevTxIds.current = new Set(data.map(t => t.id));
      }

      setTransactions(data);
      setLastRefresh(new Date());
    } catch (err) {
      if (!silent) setError('Gagal memuat data. Tap untuk coba lagi.');
    } finally {
      setLoading(false);
      fetchTimerRef.current = setTimeout(() => { fetchLockRef.current = false; }, 2000);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(() => fetchQueue(true), 30000);
    return () => {
      clearInterval(interval);
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    };
  }, [fetchQueue]);

  useAppRefresh(() => { fetchLockRef.current = false; fetchQueue(); }, [fetchQueue]);

  const realtimeTimerRef = useRef(null);
  useRealtimeMulti(['transaction:checkout', 'production:photo', 'production:update'], () => {
    if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = setTimeout(() => fetchQueue(true), 3000);
  });

  // Derived state
  const allActive = useMemo(() =>
    transactions.filter(t => {
      const items = t.items || [];
      return items.length === 0 || !items.every(i => i.isDone);
    }),
    [transactions]
  );

  const allDone = useMemo(() =>
    transactions.filter(t => {
      const items = t.items || [];
      return items.length > 0 && items.every(i => i.isDone);
    }),
    [transactions]
  );

  const activeItemCount = useMemo(() =>
    allActive.reduce((s, t) => s + (t.items || []).filter(i => !i.isDone).length, 0),
    [allActive]
  );

  const overdueCount = useMemo(() => {
    let count = 0;
    allActive.forEach(tx => {
      const sla = getSLALevel(tx.estimatedDoneAt);
      if (sla === 'overdue') count += (tx.items || []).filter(i => !i.isDone).length;
    });
    return count;
  }, [allActive]);

  // Broadcast overdueCount to BottomNav via custom event
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('produksi:overdue-count', { detail: { count: overdueCount } }));
  }, [overdueCount]);

  // Workstation counts yang mempertimbangkan activeTab
  const workstationCounts = useMemo(() => {
    const counts = { Semua: 0, Diterima: 0, Packing: 0 };
    
    // Untuk tab "Selesai", tidak perlu hitung workstation (workstation filter di-disable)
    if (activeTab === 'selesai') {
      return counts;
    }

    allActive.forEach(tx => {
      (tx.items || []).forEach(item => {
        if (item.isDone) return; // Skip done items

        // Filter by activeTab first
        if (activeTab === 'telat') {
          const sla = getSLALevel(tx.estimatedDoneAt);
          if (sla !== 'overdue') return;
        }

        // Count per workstation
        counts.Semua += 1;
        if (counts[item.currentStage] !== undefined) counts[item.currentStage]++;
      });
    });
    return counts;
  }, [allActive, activeTab]);

  // Build flat item list dengan filter logic yang benar
  const flatItems = useMemo(() => {
    const sourceTx = activeTab === 'selesai' ? allDone : allActive;
    const items = [];
    sourceTx.forEach(tx => {
      (tx.items || []).forEach(item => {
        // Tab "Selesai" → show only done items, ignore workstation filter
        if (activeTab === 'selesai') {
          if (!item.isDone) return;
          items.push({ tx, item });
          return;
        }

        // Tab lain → exclude done items
        if (item.isDone) return;

        // Filter by workstation (only for non-done items)
        if (workstation !== 'Semua') {
          if (item.currentStage !== workstation) return;
        }

        // Filter by activeTab
        if (activeTab === 'telat') {
          const sla = getSLALevel(tx.estimatedDoneAt);
          if (sla !== 'overdue') return;
        }

        items.push({ tx, item });
      });
    });
    return items;
  }, [activeTab, allActive, allDone, workstation]);

  // Group for "semua" and "proses" tabs (with grouping bahkan ketika workstation filter aktif)
  const groupedItems = useMemo(() => {
    const groups = { overdue: [], urgent: [], warning: [], normal: [], done: [] };
    flatItems.forEach(({ tx, item }) => {
      if (item.isDone) { groups.done.push({ tx, item }); return; }
      const sla = getSLALevel(tx.estimatedDoneAt);
      if (sla === 'overdue') groups.overdue.push({ tx, item });
      else if (sla === 'urgent') groups.urgent.push({ tx, item });
      else if (sla === 'warning') groups.warning.push({ tx, item });
      else groups.normal.push({ tx, item });
    });
    // Sort: express first, then by deadline
    Object.keys(groups).forEach(k => {
      groups[k].sort((a, b) => {
        if (!!a.item.isExpress !== !!b.item.isExpress) return a.item.isExpress ? -1 : 1;
        const aTime = a.tx.estimatedDoneAt ? new Date(a.tx.estimatedDoneAt).getTime() : Infinity;
        const bTime = b.tx.estimatedDoneAt ? new Date(b.tx.estimatedDoneAt).getTime() : Infinity;
        return aTime - bTime;
      });
    });
    return groups;
  }, [flatItems]);

  const onItemPress = (tx, item) => navigate('detail_item_produksi', {
    ...tx,
    id: tx.id,
    transactionUuid: tx.transactionUuid || tx.id,
    items: tx.items,
    customerName: tx.customerName,
    item,
  });

  const renderList = () => {
    if (loading) return <SkeletonList count={4} lines={3} />;
    if (error) return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: C.validationErrorBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 500, color: C.n800 }}>Gagal Memuat Data</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>{error}</div>
        <Btn variant="primary" onClick={() => fetchQueue()} style={{ marginTop: 8 }}>Coba Lagi</Btn>
      </div>
    );
    if (flatItems.length === 0) return <EmptyState lastRefresh={lastRefresh} activeTab={activeTab} workstation={workstation} overdueCount={overdueCount} />;

    // Use grouping untuk tab "semua" dan "proses" (dengan atau tanpa workstation filter)
    if ((activeTab === 'semua' || activeTab === 'proses') && flatItems.length > 0) {
      return (
        <>
          {groupedItems.overdue.length > 0 && (
            <>
              <SectionHeader icon="🔥" label="TELAT" count={groupedItems.overdue.length} accentColor="#ef4444" />
              <div style={{ padding: '0 16px' }}>
                {groupedItems.overdue.map(({ tx, item }) => (
                  <ItemCard key={`${tx.id}-${item.itemId}`} tx={tx} item={item} onPress={onItemPress} />
                ))}
              </div>
            </>
          )}
          {groupedItems.urgent.length > 0 && (
            <>
              <SectionHeader icon="⚠️" label="MENDESAK" count={groupedItems.urgent.length} accentColor="#f97316" />
              <div style={{ padding: '0 16px' }}>
                {groupedItems.urgent.map(({ tx, item }) => (
                  <ItemCard key={`${tx.id}-${item.itemId}`} tx={tx} item={item} onPress={onItemPress} />
                ))}
              </div>
            </>
          )}
          {groupedItems.warning.length > 0 && (
            <>
              <SectionHeader icon="⏰" label="HARI INI" count={groupedItems.warning.length} accentColor="#3b82f6" />
              <div style={{ padding: '0 16px' }}>
                {groupedItems.warning.map(({ tx, item }) => (
                  <ItemCard key={`${tx.id}-${item.itemId}`} tx={tx} item={item} onPress={onItemPress} />
                ))}
              </div>
            </>
          )}
          {groupedItems.normal.length > 0 && (
            <>
              <SectionHeader icon="📋" label="ANTRIAN" count={groupedItems.normal.length} accentColor="#6b7280" />
              <div style={{ padding: '0 16px' }}>
                {groupedItems.normal.map(({ tx, item }) => (
                  <ItemCard key={`${tx.id}-${item.itemId}`} tx={tx} item={item} onPress={onItemPress} />
                ))}
              </div>
            </>
          )}
        </>
      );
    }

    // Flat list untuk tab "telat" dan "selesai"
    return (
      <div style={{ padding: '0 16px' }}>
        {flatItems
          .sort((a, b) => {
            if (!!a.item.isExpress !== !!b.item.isExpress) return a.item.isExpress ? -1 : 1;
            const aTime = a.tx.estimatedDoneAt ? new Date(a.tx.estimatedDoneAt).getTime() : Infinity;
            const bTime = b.tx.estimatedDoneAt ? new Date(b.tx.estimatedDoneAt).getTime() : Infinity;
            return aTime - bTime;
          })
          .map(({ tx, item }) => (
            <ItemCard key={`${tx.id}-${item.itemId}`} tx={tx} item={item} onPress={onItemPress} />
          ))}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <HeroHeader
        user={user}
        allActive={allActive}
        allDone={allDone}
        activeItemCount={activeItemCount}
        overdueCount={overdueCount}
        onRefresh={() => fetchQueue()}
        onProfileClick={() => navigate('profil')}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <UrgentBar count={overdueCount} />

      <StageFilterBar
        workstation={workstation}
        workstationCounts={workstationCounts}
        onChange={handleWorkstationChange}
      />

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isMobile ? 100 : 90 }}>
        {renderList()}

        {/* Inventory Check Section - Jobdesk 2 */}
        <div style={{ marginTop: 16 }}>
          <InventoryCheckSection
            outletId={user?.outletId}
            onSendAlert={() => {}}
            onViewAll={() => navigate('stok_bahan')}
          />
        </div>

        {lastRefresh && flatItems.length > 0 && (
          <div style={{
            textAlign: 'center', fontFamily: 'Poppins', fontSize: 10,
            color: C.n400, padding: '14px 0 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.success }} />
            Auto-refresh aktif · {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage(props) {
  return (
    <ErrorBoundary>
      <ProduksiDashboardPage {...props} />
    </ErrorBoundary>
  );
}
