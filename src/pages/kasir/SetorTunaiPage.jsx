import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { C } from '../../utils/theme';
import { rp, formatRupiah, parseRupiah } from '../../utils/helpers';
import { TopBar, Btn, Input, EmptyState } from '../../components/ui';
import { useResponsive } from '../../utils/hooks';

// ─── Clay Card ────────────────────────────────────────────────────────────────
const ClayCard = ({ children, style, padding = 16 }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
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
    const styleId = 'setor-tunai-glass';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        :root { --glass-bg: #F3EEF7; }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
};

function SetorTunaiPage({ goBack }) {
  useGlassStyles();
  const { user } = useApp();
  const { isMobile } = useResponsive();
  const today = new Date().toISOString().slice(0, 10);

  const [depositDate, setDepositDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photoLabel, setPhotoLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);

  const loadData = async () => {
    try {
      const [histRes, sumRes] = await Promise.all([
        api.get('/api/cash-deposits', { params: { limit: 20 } }),
        api.get('/api/cash-deposits/summary', { params: { date: depositDate } }),
      ]);
      setHistory(histRes?.data?.data || []);
      setSummary(sumRes?.data?.data || null);
    } catch {}
  };

  useEffect(() => { loadData(); }, [depositDate]);

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotos(prev => [...prev, ...files.map(f => ({
      file: f, preview: URL.createObjectURL(f), label: photoLabel || 'Bukti Setor',
    }))]);
    setPhotoLabel('');
    e.target.value = '';
  };

  const handlePhotoRemove = (idx) => {
    setPhotos(prev => {
      if (prev[idx]?.preview) URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    const cashValue = parseRupiah(amount);
    if (!Number.isFinite(cashValue) || cashValue <= 0) {
      setError('Jumlah setor harus lebih dari 0.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const photoData = await Promise.all(photos.map(p => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(p.file);
      })));

      await api.post('/api/cash-deposits', {
        amount: cashValue,
        deposit_date: depositDate,
        notes,
        proof_photo: photoData[0] || null,
      });

      setSuccess(`Setor tunai ${rp(cashValue)} berhasil diajukan! Menunggu approval admin.`);
      setAmount('');
      setNotes('');
      setPhotos([]);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal submit setor.');
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status) => {
    const map = {
      pending: { bg: C.warning + '15', color: C.warning, label: 'Pending' },
      approved: { bg: C.success + '15', color: C.success, label: 'Approved' },
      rejected: { bg: C.danger + '10', color: C.danger, label: 'Ditolak' },
    };
    const s = map[status] || map.pending;
    return (
      <span style={{
        background: s.bg,
        color: s.color,
        fontFamily: "'Poppins'",
        fontSize: 10,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 6,
      }}>
        {s.label}
      </span>
    );
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--glass-bg, #F3EEF7)',
      overflow: 'hidden',
    }}>
      <TopBar title="Setor Tunai" subtitle="Setorkan uang tunai ke admin/bank" onBack={goBack} />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? 12 : 16,
        paddingBottom: isMobile ? 100 : 16,
      }}>
        {/* Pending Alert */}
        {summary?.hasPending && (
          <ClayCard padding={14} style={{ marginBottom: 12, background: C.warning + '08', border: '1px solid ' + C.warning + '30' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 20 }}>⚠️</div>
              <div>
                <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.warning }}>
                  {summary.pendingCount} setor masih pending
                </div>
                <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n600 }}>
                  Minta admin approve sebelum tutup shift
                </div>
              </div>
            </div>
          </ClayCard>
        )}

        {/* Summary Card */}
        {summary && (
          <ClayCard padding={16} style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 10 }}>
              Ringkasan Hari Ini
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.n700 }}>Total Disetujui</span>
              <span style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 700, color: C.success }}>{rp(summary.totalApproved)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.n700 }}>Total Pending</span>
              <span style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 700, color: C.warning }}>{rp(summary.totalPending)}</span>
            </div>
          </ClayCard>
        )}

        {/* Input Form */}
        <ClayCard padding={16} style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 14 }}>
            Ajukan Setor Tunai
          </div>

          {/* Date picker */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 6 }}>
              Tanggal Setor
            </div>
            <input
              type="date"
              value={depositDate}
              onChange={e => setDepositDate(e.target.value)}
              style={{
                width: '100%',
                height: 46,
                borderRadius: 10,
                border: `1.5px solid ${C.n200}`,
                padding: '0 14px',
                fontFamily: "'Poppins'",
                fontSize: 14,
                color: C.n900,
                boxSizing: 'border-box',
                outline: 'none',
                background: C.white,
              }}
            />
          </div>

          {/* Amount */}
          <Input
            label="Jumlah Setor (Rp)"
            value={amount}
            onChange={v => setAmount(formatRupiah(parseRupiah(v), ''))}
            placeholder="0"
          />

          {/* Notes */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 6 }}>
              Catatan (opsional)
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Contoh: setor ke bank BCA"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 10,
                border: `1.5px solid ${C.n200}`,
                padding: 10,
                fontFamily: "'Poppins'",
                fontSize: 13,
                color: C.n900,
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>

          {/* Photo upload */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>
              Bukti Setor
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={photoLabel}
                onChange={e => setPhotoLabel(e.target.value)}
                placeholder="Label: Slip bank, Transfer, dll"
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  border: `1.5px solid ${C.n200}`,
                  padding: '0 10px',
                  fontFamily: "'Poppins'",
                  fontSize: 12,
                  color: C.n900,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <label style={{
                height: 38,
                padding: '0 14px',
                borderRadius: 10,
                border: `1.5px solid ${C.primary}`,
                background: `${C.primary}10`,
                fontFamily: "'Poppins'",
                fontSize: 12,
                fontWeight: 600,
                color: C.primary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}>
                Upload
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoAdd} style={{ display: 'none' }} />
              </label>
            </div>

            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {photos.map((p, i) => (
                  <div key={i} style={{
                    position: 'relative',
                    width: 80,
                    height: 80,
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: `1.5px solid ${C.n200}`,
                    background: C.n50,
                  }}>
                    <img src={p.preview} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => handlePhotoRemove(i)}
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        background: 'rgba(0,0,0,0.5)',
                        border: 'none',
                        color: 'white',
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              marginTop: 10,
              fontFamily: "'Poppins'",
              fontSize: 12,
              color: C.danger,
              background: C.danger + '10',
              borderRadius: 8,
              padding: '8px 12px',
              border: `1px solid ${C.danger}20`,
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{
              marginTop: 10,
              fontFamily: "'Poppins'",
              fontSize: 12,
              color: C.success,
              background: C.success + '10',
              borderRadius: 8,
              padding: '8px 12px',
              border: `1px solid ${C.success}20`,
            }}>
              {success}
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 14,
              border: 'none',
              background: loading
                ? C.n300
                : `linear-gradient(145deg, ${C.success}, ${C.successDark})`,
              color: C.white,
              fontFamily: "'Poppins'",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 16,
              boxShadow: loading ? 'none' : '-4px -4px 10px rgba(255, 255, 255, 0.4), 5px 6px 14px rgba(5, 150, 105, 0.3)',
            }}
          >
            {loading ? 'Memproses...' : 'Ajukan Setor Tunai'}
          </motion.button>
        </ClayCard>

        {/* History */}
        <ClayCard padding={16}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
            Riwayat Setor
          </div>
          {history.length === 0 ? (
            <EmptyState
              type="reports"
              title="Belum Ada Riwayat Setor"
              message="Riwayat setoran kas akan muncul di sini"
              suggestion="Lakukan setoran kas untuk melihat riwayat"
              illustrationSize={80}
              compact
            />
          ) : (
            history.map((h, idx) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{
                  padding: '12px 0',
                  borderBottom: idx < history.length - 1 ? `1px solid ${C.n100}` : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: C.n800 }}>
                    {rp(h.amount)}
                  </span>
                  {statusBadge(h.status)}
                </div>
                <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n500 }}>
                  {h.depositDate} {h.notes ? `— ${h.notes}` : ''}
                </div>
                {h.status === 'rejected' && h.rejectionReason && (
                  <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.danger, marginTop: 4 }}>
                    Alasan: {h.rejectionReason}
                  </div>
                )}
                {h.proofPhotoUrl && (
                  <div style={{ marginTop: 6, width: 50, height: 50, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.n200}` }}>
                    <img src={h.proofPhotoUrl} alt="proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </motion.div>
            ))
          )}
        </ClayCard>
      </div>
    </div>
  );
}

export default SetorTunaiPage;
