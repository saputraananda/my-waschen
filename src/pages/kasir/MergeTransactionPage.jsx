/**
 * MergeTransactionPage.jsx — Gabungkan transaksi terpisah
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { rp } from '../../utils/helpers';
import { C } from '../../utils/theme';
import { EmptyState } from '../../components/ui';
import { useResponsive } from '../../utils/hooks';
import { ChevronRight, RefreshCw, Search, Check, Link2 } from 'lucide-react';
import { TopBar } from '../../components/ui';

// ─── Clay Card ────────────────────────────────────────────────────────────────
const ClayCard = ({ children, style, padding = 16 }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
      borderRadius: 20,
      padding: padding,
      boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.08)',
      ...style,
    }}
  >
    {children}
  </motion.div>
);

// ─── Glass Styles ─────────────────────────────────────────────────────────────
const useGlassStyles = () => {
  useEffect(() => {
    const styleId = 'merge-transaction-glass';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        :root { --glass-bg: #F3EEF7; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
};

export default function MergeTransactionPage() {
  useGlassStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const initialTransaction = location.state?.transaction;
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(initialTransaction ? 2 : 1);

  const [primaryTx, setPrimaryTx] = useState(initialTransaction || null);
  const [primarySearch, setPrimarySearch] = useState('');

  const [secondaryTxs, setSecondaryTxs] = useState([]);
  const [availableTxs, setAvailableTxs] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  const [reason, setReason] = useState('');

  const loadAvailableTxs = async (txId) => {
    if (!txId) return;
    setLoadingAvailable(true);
    try {
      const res = await axios.get(`/api/merges/transactions/${txId}`);
      if (res.data.success) {
        setAvailableTxs(res.data.data || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingAvailable(false);
    }
  };

  const searchPrimaryTransaction = async () => {
    if (!primarySearch.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/transactions?transactionNo=${primarySearch}&limit=10`);
      if (res.data.data && res.data.data.length > 0) {
        const tx = res.data.data[0];
        if (tx.status !== 'cancelled' && !tx.is_merged) {
          setPrimaryTx(tx);
          loadAvailableTxs(tx.id);
          setStep(2);
        } else {
          alert('Transaksi tidak valid untuk digabungkan');
        }
      } else {
        alert('Transaksi tidak ditemukan');
      }
    } catch {
      alert('Gagal mencari transaksi');
    } finally {
      setLoading(false);
    }
  };

  const toggleSecondaryTx = (tx) => {
    const exists = secondaryTxs.find(t => t.id === tx.id);
    if (exists) {
      setSecondaryTxs(prev => prev.filter(t => t.id !== tx.id));
    } else {
      setSecondaryTxs(prev => [...prev, tx]);
    }
  };

  const primaryTotal = parseFloat(primaryTx?.total || 0);
  const secondaryTotal = secondaryTxs.reduce((sum, tx) => sum + parseFloat(tx.total || 0), 0);
  const newTotal = primaryTotal + secondaryTotal;

  const handleMerge = async () => {
    if (secondaryTxs.length === 0) {
      alert('Pilih minimal 1 transaksi untuk digabungkan');
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      alert('Alasan wajib diisi (minimal 3 karakter)');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post('/api/merges', {
        primaryTransactionId: primaryTx.id,
        secondaryTransactionIds: secondaryTxs.map(tx => tx.id),
        reason: reason.trim(),
      });
      if (res.data.success) {
        alert(`Berhasil menggabungkan ${secondaryTxs.length} transaksi!\nTotal baru: ${rp(newTotal)}`);
        navigate(-1);
      } else {
        alert(res.data.message || 'Gagal menggabungkan');
      }
    } catch {
      alert('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg, #F3EEF7)', overflow: 'hidden' }}>
      <TopBar
        title="Gabungkan Nota"
        subtitle="Gabungkan transaksi terpisah"
        onBack={() => navigate(-1)}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 16, paddingBottom: isMobile ? 100 : 16 }}>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ClayCard padding={20} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 14 }}>
                  Cari Nota Utama
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={primarySearch}
                    onChange={(e) => setPrimarySearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchPrimaryTransaction()}
                    placeholder="No. Nota atau Nama Customer"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      width: '100%',
                      height: 48,
                      borderRadius: 12,
                      border: `1.5px solid ${C.n200}`,
                      padding: '0 14px',
                      fontFamily: "'Poppins'",
                      fontSize: 13,
                      color: C.n900,
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: C.white,
                    }}
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={searchPrimaryTransaction}
                    disabled={loading}
                    style={{
                      height: 48,
                      padding: '0 20px',
                      borderRadius: 12,
                      background: `linear-gradient(145deg, ${C.primary}, ${C.primaryDark})`,
                      border: 'none',
                      color: 'white',
                      fontFamily: "'Poppins'",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '-3px -3px 8px rgba(255, 255, 255, 0.3), 4px 5px 12px rgba(59, 11, 71, 0.3)',
                    }}
                  >
                    {loading ? (
                      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Search size={16} />
                    )}
                    {!isMobile && 'Cari'}
                  </motion.button>
                </div>
              </ClayCard>
            </motion.div>
          )}

          {step >= 2 && primaryTx && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Nota Utama */}
              <div style={{
                background: `linear-gradient(145deg, ${C.primary}, ${C.primaryDark})`,
                borderRadius: 20,
                padding: '16px 20px',
                marginBottom: 12,
                color: 'white',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: "'Poppins'", fontSize: 10, opacity: 0.8 }}>NOTA UTAMA</div>
                    <div style={{ fontFamily: "'Poppins'", fontSize: 18, fontWeight: 700 }}>{primaryTx.transaction_no}</div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setPrimaryTx(null); setSecondaryTxs([]); setAvailableTxs([]); setStep(1); }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: 'white',
                      fontFamily: "'Poppins'",
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Ubah
                  </motion.button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Poppins'", fontSize: 12, opacity: 0.9 }}>
                  <span>{primaryTx.customer_name || 'Customer'}</span>
                  <span style={{ fontWeight: 700 }}>{rp(parseFloat(primaryTx.total || 0))}</span>
                </div>
              </div>

              {/* Pilih Nota Tambahan */}
              <ClayCard padding={16} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 600, color: C.n900 }}>
                    Pilih Nota Tambahan ({secondaryTxs.length} dipilih)
                  </div>
                  <span style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n500 }}>
                    {availableTxs.length} tersedia
                  </span>
                </div>

                {loadingAvailable ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: C.n400 }} />
                  </div>
                ) : availableTxs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, fontFamily: "'Poppins'", fontSize: 12, color: C.n500 }}>
                    Tidak ada nota yang bisa digabungkan
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {availableTxs.map((tx) => {
                      const isSelected = secondaryTxs.find(t => t.id === tx.id);
                      return (
                        <motion.button
                          key={tx.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleSecondaryTx(tx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: 12,
                            borderRadius: 14,
                            border: `2px solid ${isSelected ? C.primary : C.n200}`,
                            background: isSelected ? `${C.primary}08` : C.white,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                          }}
                        >
                          <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: 8,
                            background: isSelected ? C.primary : C.n100,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {isSelected && <Check size={14} color="white" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 600, color: C.n900 }}>
                              {tx.transaction_no}
                            </div>
                            <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n500 }}>
                              {tx.customer_name || 'Customer'} - {new Date(tx.created_at).toLocaleDateString('id-ID')}
                            </div>
                          </div>
                          <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 700, color: C.n900 }}>
                            {rp(parseFloat(tx.total || 0))}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </ClayCard>

              {/* Ringkasan */}
              {secondaryTxs.length > 0 && (
                <ClayCard padding={16} style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
                    Ringkasan
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Poppins'", fontSize: 12, color: C.n600 }}>
                      <span>Nota Utama</span>
                      <span style={{ fontWeight: 600 }}>{rp(primaryTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Poppins'", fontSize: 12, color: C.n600 }}>
                      <span>+ {secondaryTxs.length} Nota Tambahan</span>
                      <span style={{ fontWeight: 600 }}>{rp(secondaryTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${C.n100}` }}>
                      <span style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: C.n900 }}>TOTAL BARU</span>
                      <span style={{ fontFamily: "'Poppins'", fontSize: 18, fontWeight: 800, color: C.primary }}>{rp(newTotal)}</span>
                    </div>
                  </div>
                </ClayCard>
              )}

              {/* Alasan */}
              <ClayCard padding={16} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>
                  Alasan *
                </div>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Pelanggan sama, gabungkan untuk kemudahan"
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 12,
                    border: `1.5px solid ${C.n200}`,
                    padding: '0 14px',
                    fontFamily: "'Poppins'",
                    fontSize: 13,
                    color: C.n900,
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: C.white,
                  }}
                />
              </ClayCard>

              {/* Tombol Gabung */}
              <motion.button
                whileTap={{ scale: submitting || secondaryTxs.length === 0 ? 1 : 0.98 }}
                onClick={handleMerge}
                disabled={submitting || secondaryTxs.length === 0}
                style={{
                  width: '100%',
                  height: 52,
                  borderRadius: 16,
                  background: submitting || secondaryTxs.length === 0
                    ? C.n300
                    : `linear-gradient(145deg, ${C.primary}, ${C.primaryDark})`,
                  border: 'none',
                  color: 'white',
                  fontFamily: "'Poppins'",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: submitting || secondaryTxs.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: submitting || secondaryTxs.length === 0 ? 'none' : '-4px -4px 10px rgba(255, 255, 255, 0.3), 5px 6px 14px rgba(59, 11, 71, 0.3)',
                }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Menggabungkan...
                  </>
                ) : (
                  <>
                    <Link2 size={18} />
                    Gabungkan {secondaryTxs.length} Nota
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
