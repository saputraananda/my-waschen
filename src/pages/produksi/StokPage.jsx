// ─────────────────────────────────────────────────────────────────────────────
// ProduksiStokPage — Inventory Stock for Production Role
// Design: Production style (dark header, glassmorphism, purple theme)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { C } from '../../utils/theme';
import { useAuth } from '../../context/AuthContext';
import { useResponsive } from '../../utils/hooks';
import {
  STAGE_STYLE, SLA_STYLES, LAYOUT, PROD_SHADOW, HEADER, CARD,
  getSLALevel, formatSLA,
} from '../../utils/productionDesign';
import { Search, RefreshCw, Package, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { alertSuccess, alertError } from '../../utils/alert';

// ─── Helper Functions ─────────────────────────────────────────────────────────
const rp = (n) => {
  if (n == null) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(n);
};

// ─── Stock Status Styles ──────────────────────────────────────────────────────
const STOCK_STATUS = {
  out: {
    label: 'Habis',
    accent: '#DC2626',
    bg: '#FEE2E2',
    text: '#DC2626',
    icon: XCircle,
  },
  critical: {
    label: 'Kritis',
    accent: '#DC2626',
    bg: '#FEE2E2',
    text: '#DC2626',
    icon: AlertTriangle,
  },
  high: {
    label: 'Tinggi',
    accent: '#F59E0B',
    bg: '#FEF3C7',
    text: '#92400E',
    icon: AlertTriangle,
  },
  medium: {
    label: 'Sedang',
    accent: '#FBBF24',
    bg: '#FEF9C3',
    text: '#854D0E',
    icon: Package,
  },
  ok: {
    label: 'OK',
    accent: '#22C55E',
    bg: '#DCFCE7',
    text: '#166534',
    icon: CheckCircle,
  },
};

const getStockStatus = (item) => {
  if (item.stockQty <= 0) return STOCK_STATUS.out;
  const ratio = item.minStock > 0 ? item.stockQty / item.minStock : 1;
  if (ratio < 0.25) return STOCK_STATUS.critical;
  if (ratio < 0.5) return STOCK_STATUS.high;
  if (ratio < 1) return STOCK_STATUS.medium;
  return STOCK_STATUS.ok;
};

// ─── Filter Pills ─────────────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'out', label: 'Habis' },
  { value: 'critical', label: 'Kritis' },
  { value: 'low', label: 'Rendah' },
];

// ─── Stock Card Component ─────────────────────────────────────────────────────
function StockCard({ item, onSendAlert, sendingId }) {
  const status = getStockStatus(item);
  const StatusIcon = status.icon;
  const stockPct = item.minStock > 0 ? Math.min(100, (item.stockQty / item.minStock) * 100) : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: C.white,
        borderRadius: CARD.borderRadius,
        border: `1px solid ${C.n200}`,
        boxShadow: PROD_SHADOW.card,
        position: 'relative',
        overflow: 'hidden',
        marginBottom: LAYOUT.cardGap,
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: CARD.accentBarWidth,
        background: status.accent,
      }} />

      <div style={{ padding: `14px 14px 12px ${CARD.accentBarWidth + 14}px` }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Item name */}
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 14,
              fontWeight: 600,
              color: C.n800,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.itemName || item.name}
            </div>
            {/* Category */}
            <div style={{
              fontFamily: 'Inter, system-ui',
              fontSize: 11,
              color: C.n500,
              marginTop: 2,
            }}>
              {item.categoryName || item.category}
            </div>
          </div>

          {/* Status badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            background: status.bg,
            borderRadius: 999,
            flexShrink: 0,
          }}>
            <StatusIcon size={10} color={status.text} />
            <span style={{
              fontFamily: 'Poppins',
              fontSize: 10,
              fontWeight: 600,
              color: status.text,
            }}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Stock info */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
          <span style={{
            fontFamily: 'Poppins',
            fontSize: 22,
            fontWeight: 700,
            color: status.accent,
            lineHeight: 1,
          }}>
            {Number(item.stockQty || item.currentStock || 0).toLocaleString('id-ID')}
          </span>
          <span style={{
            fontFamily: 'Inter, system-ui',
            fontSize: 12,
            color: C.n500,
          }}>
            / {Number(item.minStock || 0).toLocaleString('id-ID')} {item.unit || 'unit'}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4,
          background: C.n100,
          borderRadius: 2,
          overflow: 'hidden',
          marginBottom: 8,
        }}>
          <div style={{
            height: '100%',
            width: `${stockPct}%`,
            background: status.accent,
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Footer: price + action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {item.lastCost && (
            <div style={{
              fontFamily: 'Inter, system-ui',
              fontSize: 11,
              color: C.n500,
            }}>
              {rp(item.lastCost)} / {item.unit || 'unit'}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.lastUpdated && (
              <div style={{
                fontFamily: 'Inter, system-ui',
                fontSize: 10,
                color: C.n400,
              }}>
                Update: {new Date(item.lastUpdated).toLocaleDateString('id-ID')}
              </div>
            )}
            {onSendAlert && (status.level === 'critical' || status.level === 'low') && (
              <button
                onClick={() => onSendAlert(item)}
                disabled={sendingId === item.id}
                style={{
                  background: sendingId === item.id ? C.n400 : status.accent,
                  color: C.white,
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 10,
                  fontFamily: 'Poppins',
                  fontWeight: 600,
                  cursor: sendingId === item.id ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  opacity: sendingId === item.id ? 0.7 : 1,
                }}
              >
                <AlertTriangle size={10} />
                {sendingId === item.id ? 'Mengirim...' : 'Kirim Alert'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stats Card Component ──────────────────────────────────────────────────────
function StatsCard({ label, value, icon, color, bgColor }) {
  const { isMobile } = useResponsive();
  return (
    <div style={{
      flex: 1,
      background: bgColor || 'rgba(255, 255, 255, 0.72)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.4)',
      borderRadius: 14,
      padding: '10px 8px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
      textAlign: 'center',
      minWidth: 0,
    }}>
      <div style={{ fontSize: isMobile ? 14 : 16, marginBottom: 4 }}>{icon}</div>
      <div style={{
        fontFamily: 'Poppins',
        fontSize: isMobile ? 16 : 18,
        fontWeight: 700,
        color: color || C.primary,
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'Poppins',
        fontSize: isMobile ? 8 : 9,
        fontWeight: 500,
        color: C.n500,
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ filter }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        background: 'rgba(110, 46, 120, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
      }}>
        <Package size={28} color={C.primary} />
      </div>
      <div style={{
        fontFamily: 'Poppins',
        fontSize: 16,
        fontWeight: 600,
        color: C.n700,
        marginBottom: 4,
      }}>
        {filter === 'all' ? 'Belum Ada Data Stok' : 'Tidak Ada Item'}
      </div>
      <div style={{
        fontFamily: 'Inter, system-ui',
        fontSize: 13,
        color: C.n500,
      }}>
        {filter === 'all'
          ? 'Stok inventory akan muncul di sini'
          : `Tidak ada item dengan filter "${filter}"`}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProduksiStokPage({ navigate, goBack, user }) {
  const { user: authUser } = useAuth();
  const { isMobile } = useResponsive();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState({ total: 0, out: 0, critical: 0, ok: 0 });
  const [sendingId, setSendingId] = useState(null);

  // Get outlet ID from user
  const outletId = user?.outletId || authUser?.outletId;

  // Fetch stock data
  const fetchStock = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = { outletId };
      if (filter !== 'all') params.filter = filter;

      const res = await axios.get('/api/inventory/check', { params });
      if (res?.data?.success) {
        const data = res.data.data;
        setItems(data.items || []);
        setSummary(data.summary || { total: 0, out: 0, critical: 0, ok: 0 });

        // Dispatch alert count to BottomNav
        const alertCount = (data.summary?.out || 0) + (data.summary?.critical || 0);
        window.dispatchEvent(new CustomEvent('stok:alert-count', {
          detail: { count: alertCount }
        }));
      }
    } catch (err) {
      console.error('Failed to fetch stock:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId, filter]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    fetchStock(true);
  }, [fetchStock]);

  // Send low-stock alert to kasir
  const handleSendAlert = useCallback(async (item) => {
    setSendingId(item.id);
    try {
      await axios.post('/api/inventory/low-stock-alert', {
        inventoryId: item.id,
        outletId,
        stockQty: item.stockQty,
        minStock: item.minStock,
        itemName: item.itemName || item.name,
        unit: item.unit,
      });
      alertSuccess(`Alert stok ${item.itemName || item.name} sudah dikirim ke kasir!`);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal kirim alert');
    } finally {
      setSendingId(null);
    }
  }, [outletId]);

  // Filter items by search
  const filteredItems = items.filter(item => {
    const searchLower = search.toLowerCase();
    return (
      (item.itemName || item.name || '').toLowerCase().includes(searchLower) ||
      (item.categoryName || item.category || '').toLowerCase().includes(searchLower) ||
      (item.itemCode || item.code || '').toLowerCase().includes(searchLower)
    );
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f3f8',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: HEADER.bg,
        padding: `${isMobile ? 12 : 16}px ${LAYOUT.pagePaddingX}px 20px`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {/* Header top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {goBack && (
              <motion.button
                onClick={goBack}
                whileTap={{ scale: 0.9 }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  border: 'none',
                  background: HEADER.accent,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </motion.button>
            )}
            <div>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 13,
                color: HEADER.textMuted,
              }}>
                {user?.outletName || authUser?.outletName || 'Produksi'}
              </div>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 18,
                fontWeight: 700,
                color: HEADER.textWhite,
              }}>
                Stok Inventory
              </div>
            </div>
          </div>

          {/* Refresh button */}
          <motion.button
            onClick={handleRefresh}
            whileTap={{ scale: 0.9 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: 'none',
              background: HEADER.accent,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={18} color="#fff" style={{ opacity: refreshing ? 0.5 : 1 }} />
          </motion.button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <StatsCard
            label="Total"
            value={summary.total || items.length}
            icon={<Package size={16} />}
            color={HEADER.textWhite}
            bgColor={HEADER.accent}
          />
          <StatsCard
            label="OK"
            value={summary.ok || 0}
            icon={<CheckCircle size={16} />}
            color="#22C55E"
          />
          <StatsCard
            label="Rendah"
            value={(summary.critical || 0) + (summary.high || 0) + (summary.medium || 0)}
            icon={<AlertTriangle size={16} />}
            color="#F59E0B"
          />
          <StatsCard
            label="Habis"
            value={summary.out || 0}
            icon={<XCircle size={16} />}
            color="#DC2626"
          />
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {FILTER_OPTIONS.map((opt) => (
            <motion.button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              whileTap={{ scale: 0.95 }}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${filter === opt.value ? HEADER.primary : 'rgba(255,255,255,0.2)'}`,
                background: filter === opt.value ? HEADER.primary : 'transparent',
                color: filter === opt.value ? '#fff' : 'rgba(255,255,255,0.7)',
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        padding: LAYOUT.pagePaddingX,
        paddingTop: 16,
      }}>
        {/* Search bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: C.white,
          border: `1px solid ${C.n200}`,
          borderRadius: 12,
          padding: '10px 14px',
          marginBottom: 16,
        }}>
          <Search size={18} color={C.n400} />
          <input
            type="text"
            placeholder="Cari nama item atau kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontFamily: 'Inter, system-ui',
              fontSize: 14,
              color: C.n800,
              background: 'transparent',
            }}
          />
          {search && (
            <motion.button
              onClick={() => setSearch('')}
              whileTap={{ scale: 0.9 }}
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                border: 'none',
                background: C.n100,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.n500} strokeWidth="3" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </motion.button>
          )}
        </div>

        {/* Loading state */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{
                height: 100,
                background: C.white,
                borderRadius: 14,
                border: `1px solid ${C.n200}`,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.stockId || item.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <StockCard item={item} onSendAlert={handleSendAlert} sendingId={sendingId} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
