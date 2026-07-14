/**
 * MergeTransactionPage.jsx
 * Halaman untuk menggabungkan transaksi terpisah
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { rp } from '../../utils/helpers';
import { C, SHADOW } from '../../utils/theme';
import { EmptyState } from '../../components/ui';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import {
  ChevronRight,
  RefreshCw,
  Search,
  Plus,
  X,
  Check,
  Link2,
  Unlink,
  ArrowRight,
  Calendar,
} from 'lucide-react';

export default function MergeTransactionPage() {
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
    } catch (error) {
      // Error handled silently
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
    } catch (error) {
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
    } catch (error) {
      alert('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF', overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)', padding: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.7)' }}>Transaksi</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: 'white' }}>Gabungkan Nota</div>
          </div>
          <button onClick={() => navigate(-1)} style={{ width: isMobile ? 36 : 40, height: isMobile ? 36 : 40, borderRadius: isMobile ? 10 : 12, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={isMobile ? 18 : 20} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, paddingBottom: 24 }}>
        {step === 1 && (
          <div style={{ padding: '0 12px' }}>
            <div style={{ background: C.white, borderRadius: 12, padding: 16, boxShadow: SHADOW.sm }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1F2937', marginBottom: 12 }}>Cari Nota Utama</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input type="text" value={primarySearch} onChange={(e) => setPrimarySearch(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && searchPrimaryTransaction()} placeholder="No. Nota atau Nama Customer" style={{ flex: 1, minWidth: 0, width: '100%', height: isMobile ? 40 : 48, borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '0 12px', fontSize: isMobile ? 12 : 14, outline: 'none', boxSizing: 'border-box' }} />
                <button onClick={searchPrimaryTransaction} disabled={loading} style={{ height: isMobile ? 40 : 48, padding: '0 16px', borderRadius: 10, background: '#0EA5E9', border: 'none', color: 'white', fontSize: isMobile ? 12 : 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                  <span style={{ display: isMobile ? 'none' : 'inline' }}>Cari</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {step >= 2 && primaryTx && (
          <div style={{ padding: '0 12px' }}>
            <div style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>NOTA UTAMA</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{primaryTx.transaction_no}</div>
                </div>
                <button onClick={() => { setPrimaryTx(null); setSecondaryTxs([]); setAvailableTxs([]); setStep(1); }} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', fontSize: 11, cursor: 'pointer' }}>Ubah</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>
                <span>{primaryTx.customer_name || 'Customer'}</span>
                <span style={{ fontWeight: 700 }}>{rp(parseFloat(primaryTx.total || 0))}</span>
              </div>
            </div>

            <div style={{ background: C.white, borderRadius: 12, padding: 16, boxShadow: SHADOW.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>Pilih Nota Tambahan ({secondaryTxs.length} dipilih)</h3>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{availableTxs.length} tersedia</span>
              </div>
              {loadingAvailable ? (
                <div style={{ textAlign: 'center', padding: 20 }}><RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: '#9CA3AF' }} /></div>
              ) : availableTxs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#9CA3AF', fontSize: 12 }}>Tidak ada nota yang bisa digabungkan</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {availableTxs.map((tx) => {
                    const isSelected = secondaryTxs.find(t => t.id === tx.id);
                    return (
                      <div key={tx.id} onClick={() => toggleSecondaryTx(tx)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, border: `2px solid ${isSelected ? '#0EA5E9' : '#E5E7EB'}`, background: isSelected ? '#F0F9FF' : 'white', cursor: 'pointer' }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: isSelected ? '#0EA5E9' : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isSelected && <Check size={14} color="white" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>{tx.transaction_no}</div>
                          <div style={{ fontSize: 11, color: '#6B7280' }}>{tx.customer_name || 'Customer'} - {new Date(tx.created_at).toLocaleDateString('id-ID')}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2937' }}>{rp(parseFloat(tx.total || 0))}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {secondaryTxs.length > 0 && (
              <div style={{ background: C.white, borderRadius: 12, padding: 16, marginTop: 12, boxShadow: SHADOW.sm }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1F2937', marginBottom: 12 }}>Ringkasan</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#6B7280' }}>Nota Utama</span><span style={{ fontWeight: 600 }}>{rp(primaryTotal)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#6B7280' }}>+ {secondaryTxs.length} Nota Tambahan</span><span style={{ fontWeight: 600 }}>{rp(secondaryTotal)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #E5E7EB' }}><span style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>TOTAL BARU</span><span style={{ fontSize: 18, fontWeight: 700, color: '#0EA5E9' }}>{rp(newTotal)}</span></div>
                </div>
              </div>
            )}

            <div style={{ background: C.white, borderRadius: 12, padding: isMobile ? 12 : 16, marginTop: 12, boxShadow: SHADOW.sm }}>
              <label style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#6B7280', marginBottom: 8, display: 'block' }}>Alasan *</label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: Pelanggan sama, gabungkan untuk kemudahan" style={{ width: '100%', minWidth: 0, height: isMobile ? 40 : 48, borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '0 12px', fontSize: isMobile ? 12 : 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <button onClick={handleMerge} disabled={submitting || secondaryTxs.length === 0} style={{ width: '100%', height: 52, borderRadius: 12, background: submitting || secondaryTxs.length === 0 ? '#D1D5DB' : 'linear-gradient(135deg, #0EA5E9, #0284C7)', border: 'none', color: 'white', fontSize: 15, fontWeight: 600, cursor: submitting || secondaryTxs.length === 0 ? 'not-allowed' : 'pointer', marginTop: 16, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {submitting ? <><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />Menggabungkan...</> : <><Link2 size={18} />Gabungkan {secondaryTxs.length} Nota</>}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
