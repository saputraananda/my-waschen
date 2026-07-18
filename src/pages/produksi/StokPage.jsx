// ─────────────────────────────────────────────────────────────────────────────
// ProduksiStokPage — Inventory Stock for Production Role
// Design: Production style (dark header, glassmorphism, purple theme)
// Features: View stock, adjust stock, send alerts, view history
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
import {
  Search, RefreshCw, Package, AlertTriangle, CheckCircle, XCircle,
  Plus, Minus, History
} from 'lucide-react';
import { alertSuccess, alertError } from '../../utils/alert';
import { Modal, Btn } from '../../components/ui';

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
  { value: 'medium', label: 'Sedang' },
];

// ─── Stock Card Component ─────────────────────────────────────────────────────
function StockCard({ item, onSendAlert, onAdjust, onHistory, sendingId, adjustingId }) {
  const status = getStockStatus(item);
  const StatusIcon = status.icon;
  const stockPct = item.minStock > 0 ? Math.min(100, (item.stockQty / item.minStock) * 100) : 100;
  const showAlertButton = status.label === 'Habis' || status.label === 'Kritis';

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

        {/* Footer: price + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {item.lastCost && (
              <div style={{
                fontFamily: 'Inter, system-ui',
                fontSize: 11,
                color: C.n500,
              }}>
                {rp(item.lastCost)} / {item.unit || 'unit'}
              </div>
            )}
            {item.lastUpdated && (
              <div style={{
                fontFamily: 'Inter, system-ui',
                fontSize: 10,
                color: C.n400,
              }}>
                Update: {new Date(item.lastUpdated).toLocaleDateString('id-ID')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Quick adjust buttons */}
            <div style={{ display: 'flex', gap: 4 }}>
              {/* History button */}
              {onHistory && (
                <motion.button
                  onClick={() => onHistory(item)}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    background: C.n100,
                    color: C.n600,
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 10,
                    fontFamily: 'Poppins',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <History size={10} />
                </motion.button>
              )}
              {onAdjust && (
                <>
                  <motion.button
                    onClick={() => onAdjust(item, 'out')}
                    disabled={adjustingId === item.id || item.stockQty <= 0}
                    whileTap={{ scale: 0.9 }}
                    style={{
                      background: adjustingId === item.id ? C.n400 : '#3B82F6',
                      color: C.white,
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 10,
                      fontFamily: 'Poppins',
                      fontWeight: 600,
                      cursor: adjustingId === item.id ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      opacity: adjustingId === item.id ? 0.7 : 1,
                    }}
                  >
                    <Minus size={10} />
                  </motion.button>
                  <motion.button
                    onClick={() => onAdjust(item, 'in')}
                    disabled={adjustingId === item.id}
                    whileTap={{ scale: 0.9 }}
                    style={{
                      background: adjustingId === item.id ? C.n400 : '#10B981',
                      color: C.white,
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 10,
                      fontFamily: 'Poppins',
                      fontWeight: 600,
                      cursor: adjustingId === item.id ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      opacity: adjustingId === item.id ? 0.7 : 1,
                    }}
                  >
                    <Plus size={10} />
                  </motion.button>
                </>
              )}
              {onSendAlert && showAlertButton && (
                <motion.button
                  onClick={() => onSendAlert(item)}
                  disabled={sendingId === item.id}
                  whileTap={{ scale: 0.9 }}
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
                  {sendingId === item.id ? '...' : 'Alert'}
                </motion.button>
              )}
            </div>
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

// ─── Stock Adjustment Modal ─────────────────────────────────────────────────────
function StockAdjustmentModal({ visible, onClose, item, onSuccess }) {
  const [type, setType] = useState('in'); // 'in' or 'out'
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setType('in');
      setQty('');
      setNotes('');
    }
  }, [visible, item]);

  const handleSubmit = async () => {
    const qtyNum = Number(qty);
    if (!qtyNum || qtyNum <= 0) {
      alertError('Jumlah harus lebih dari 0');
      return;
    }

    setLoading(true);
    try {
      const qtyDelta = type === 'in' ? qtyNum : -qtyNum;
      await axios.post('/api/inventory/adjust', {
        inventoryId: item.id || item.itemId,
        qtyDelta,
        notes: notes || `Penyesuaian stok ${type === 'in' ? 'masuk' : 'keluar'} oleh produksi`,
      });
      alertSuccess(`Stok ${item.itemName} berhasil ${type === 'in' ? 'ditambah' : 'dikurangi'} ${qtyNum} ${item.unit}`);
      onSuccess?.();
      onClose();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyesuaikan stok');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Penyesuaian Stok">
      <div style={{ marginBottom: 16 }}>
        {/* Item Info */}
        <div style={{
          background: C.n50,
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n800 }}>
            {item?.itemName || item?.name}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, marginTop: 2 }}>
            {item?.categoryName || item?.category} · Stok saat ini: {Number(item?.stockQty || item?.currentStock || 0).toLocaleString('id-ID')} {item?.unit}
          </div>
        </div>

        {/* Type Toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <motion.button
            type="button"
            onClick={() => setType('in')}
            whileTap={{ scale: 0.97 }}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 10,
              border: `2px solid ${type === 'in' ? '#10B981' : C.n200}`,
              background: type === 'in' ? '#10B981' : C.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Plus size={18} color={type === 'in' ? C.white : '#10B981'} />
            <span style={{
              fontFamily: 'Poppins',
              fontSize: 14,
              fontWeight: 600,
              color: type === 'in' ? C.white : '#10B981',
            }}>
              Stok Masuk
            </span>
          </motion.button>
          <motion.button
            type="button"
            onClick={() => setType('out')}
            whileTap={{ scale: 0.97 }}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 10,
              border: `2px solid ${type === 'out' ? '#EF4444' : C.n200}`,
              background: type === 'out' ? '#EF4444' : C.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Minus size={18} color={type === 'out' ? C.white : '#EF4444'} />
            <span style={{
              fontFamily: 'Poppins',
              fontSize: 14,
              fontWeight: 600,
              color: type === 'out' ? C.white : '#EF4444',
            }}>
              Stok Keluar
            </span>
          </motion.button>
        </div>

        {/* Quantity Input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight: 500,
            color: C.n700,
            marginBottom: 6,
          }}>
            Jumlah ({item?.unit || 'unit'})
          </label>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={`Masukkan jumlah ${item?.unit || ''}`}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 10,
              border: `1.5px solid ${C.n300}`,
              padding: '0 14px',
              fontFamily: 'Poppins',
              fontSize: 16,
              fontWeight: 600,
              color: C.n900,
              background: C.white,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {/* Quick buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[1, 5, 10, 20].map(v => (
              <motion.button
                key={v}
                type="button"
                onClick={() => setQty(String(v))}
                whileTap={{ scale: 0.95 }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 8,
                  border: `1.5px solid ${qty === String(v) ? C.primary : C.n200}`,
                  background: qty === String(v) ? `${C.primary}15` : C.white,
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 13,
                  fontWeight: 600,
                  color: qty === String(v) ? C.primary : C.n700,
                }}
              >
                {v}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight: 500,
            color: C.n700,
            marginBottom: 6,
          }}>
            Catatan (opsional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tambahkan catatan jika diperlukan..."
            rows={2}
            style={{
              width: '100%',
              borderRadius: 10,
              border: `1.5px solid ${C.n300}`,
              padding: '12px 14px',
              fontFamily: 'Poppins',
              fontSize: 14,
              color: C.n900,
              background: C.white,
              outline: 'none',
              resize: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Submit Button */}
        <Btn
          variant={type === 'in' ? 'success' : 'danger'}
          fullWidth
          onClick={handleSubmit}
          loading={loading}
          disabled={!qty || Number(qty) <= 0}
        >
          {type === 'in' ? '+ Tambah Stok' : '- Kurangi Stok'}
        </Btn>
      </div>
    </Modal>
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

// ─── Stock History Modal ──────────────────────────────────────────────────────
function StockHistoryModal({ visible, onClose, item }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchHistory = useCallback(async (pageNum = 1) => {
    if (!item?.id && !item?.itemId) return;
    setLoading(true);
    try {
      const res = await axios.get('/api/inventory/stock-history', {
        params: {
          inventoryId: item.id || item.itemId,
          page: pageNum,
          limit: 20,
        },
      });
      if (res?.data?.success) {
        const newData = res.data.data || [];
        if (pageNum === 1) {
          setHistory(newData);
        } else {
          setHistory(prev => [...prev, ...newData]);
        }
        setHasMore(newData.length >= 20);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    if (visible && item) {
      setPage(1);
      setHistory([]);
      fetchHistory(1);
    }
  }, [visible, item, fetchHistory]);

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchHistory(page + 1);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMovementIcon = (type) => {
    if (type === 'in' || type === 'adjustment' || type === 'restock') return <Plus size={14} />;
    if (type === 'out' || type === 'manual_usage') return <Minus size={14} />;
    return <History size={14} />;
  };

  const getMovementColor = (type) => {
    if (type === 'in' || type === 'adjustment' || type === 'restock') return '#10B981';
    if (type === 'out' || type === 'manual_usage') return '#EF4444';
    return C.n600;
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Riwayat Stok">
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Item Header */}
        <div style={{
          background: C.n50,
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n800 }}>
            {item?.itemName || item?.name}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, marginTop: 2 }}>
            Stok saat ini: {Number(item?.stockQty || item?.currentStock || 0).toLocaleString('id-ID')} {item?.unit}
          </div>
        </div>

        {/* Loading State */}
        {loading && history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{
              width: 32,
              height: 32,
              border: '3px solid ' + C.n200,
              borderTopColor: C.primary,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat riwayat...</span>
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <History size={32} color={C.n300} style={{ marginBottom: 8 }} />
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>
              Belum ada riwayat penyesuaian
            </div>
          </div>
        ) : (
          <>
            {/* History List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((h, idx) => (
                <div
                  key={h.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    background: C.white,
                    borderRadius: 10,
                    border: `1px solid ${C.n100}`,
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    background: `${getMovementColor(h.movement_type)}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: getMovementColor(h.movement_type),
                    flexShrink: 0,
                  }}>
                    {getMovementIcon(h.movement_type)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.n800,
                    }}>
                      {h.movement_type === 'in' || h.movement_type === 'adjustment' || h.movement_type === 'restock'
                        ? `+${Number(h.qty).toLocaleString('id-ID')}`
                        : h.movement_type === 'out' || h.movement_type === 'manual_usage'
                        ? `${Number(h.qty).toLocaleString('id-ID')}`
                        : Number(h.qty).toLocaleString('id-ID')} {item?.unit || ''}
                    </div>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 11,
                      color: C.n500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {h.notes || h.movement_type}
                    </div>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 10,
                      color: C.n400,
                      marginTop: 2,
                    }}>
                      {h.createdByName || 'System'} · {formatTime(h.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <motion.button
                type="button"
                onClick={loadMore}
                whileTap={{ scale: 0.97 }}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginTop: 12,
                  borderRadius: 10,
                  border: `1.5px solid ${C.n200}`,
                  background: C.white,
                  cursor: loading ? 'default' : 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.primary,
                }}
              >
                {loading ? 'Memuat...' : 'Lihat Lebih Banyak'}
              </motion.button>
            )}
          </>
        )}
      </div>
    </Modal>
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
  const [adjustingId, setAdjustingId] = useState(null);

  // Modal states
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Category filter
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Get outlet ID from user
  const outletId = user?.outletId || authUser?.outletId;

  // Fetch stock data
  const fetchStock = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = { outletId };
      if (filter !== 'all') params.filter = filter;
      if (selectedCategory !== 'all') params.category = selectedCategory;

      const res = await axios.get('/api/inventory/check', { params });
      if (res?.data?.success) {
        const data = res.data.data;
        setItems(data.items || []);
        setSummary(data.summary || { total: 0, out: 0, critical: 0, ok: 0 });

        // Set categories from API
        if (data.filters?.categories) {
          setCategories(data.filters.categories);
        }

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
  }, [outletId, filter, selectedCategory]);

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
        inventoryId: item.id || item.itemId,
        outletId,
        currentStock: item.stockQty || item.currentStock,
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

  // Quick adjust handler
  const handleQuickAdjust = useCallback(async (item, type) => {
    setAdjustingId(item.id || item.itemId);
    setSelectedItem(item);
    setAdjustModalVisible(true);
  }, []);

  // Open history
  const handleViewHistory = useCallback((item) => {
    setSelectedItem(item);
    setHistoryModalVisible(true);
  }, []);

  // Adjustment success callback
  const handleAdjustmentSuccess = useCallback(() => {
    fetchStock(true);
  }, [fetchStock]);

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
            {/* Navigation back button - only show if no BottomNav context */}
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
                {user?.outlet?.name || user?.outletName || authUser?.outletName || 'Produksi'}
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

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        {/* Search and Category Filter Row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {/* Search bar */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: C.white,
            border: `1px solid ${C.n200}`,
            borderRadius: 12,
            padding: '10px 14px',
          }}>
            <Search size={18} color={C.n400} />
            <input
              type="text"
              placeholder="Cari nama item..."
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
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
            <motion.button
              key="cat-all"
              onClick={() => setSelectedCategory('all')}
              whileTap={{ scale: 0.95 }}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 16,
                border: `1.5px solid ${selectedCategory === 'all' ? C.primary : C.n200}`,
                background: selectedCategory === 'all' ? `${C.primary}15` : C.white,
                color: selectedCategory === 'all' ? C.primary : C.n700,
                fontFamily: 'Poppins',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Semua Kategori
            </motion.button>
            {categories.map((cat) => (
              <motion.button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                whileTap={{ scale: 0.95 }}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 16,
                  border: `1.5px solid ${selectedCategory === cat.id ? C.primary : C.n200}`,
                  background: selectedCategory === cat.id ? `${C.primary}15` : C.white,
                  color: selectedCategory === cat.id ? C.primary : C.n700,
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {cat.name}
              </motion.button>
            ))}
          </div>
        )}

        {/* Info bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          padding: '8px 12px',
          background: `${C.primary}08`,
          borderRadius: 10,
          border: `1px solid ${C.primary}20`,
        }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            color: C.primary,
            fontWeight: 500,
          }}>
            {filteredItems.length} item ditemukan
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 10,
            color: C.n500,
          }}>
            Ketuk +/- untuk adjust stok
          </div>
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
                <StockCard
                  item={item}
                  onSendAlert={handleSendAlert}
                  onAdjust={handleQuickAdjust}
                  onHistory={handleViewHistory}
                  sendingId={sendingId}
                  adjustingId={adjustingId}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <StockAdjustmentModal
        visible={adjustModalVisible}
        onClose={() => {
          setAdjustModalVisible(false);
          setAdjustingId(null);
        }}
        item={selectedItem}
        onSuccess={handleAdjustmentSuccess}
      />

      <StockHistoryModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        item={selectedItem}
      />
    </div>
  );
}
