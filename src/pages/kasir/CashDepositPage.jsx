import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, MoneyInput, EmptyState } from '../../components/ui';
import { alertError, alertSuccess, confirmAction } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';
import PICSelector from '../../components/PICSelector';
import { usePICSelector } from '../../hooks/usePIC';

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
    const styleId = 'cash-deposit-glass';
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

export default function CashDepositPage({ navigate, goBack }) {
  useGlassStyles();
  const { isMobile } = useResponsive();
  const {
    currentPIC,
    setCurrentPIC,
    availableUsers,
    refreshUsers,
    isLoading: picLoading,
  } = usePICSelector();

  useEffect(() => { refreshUsers(); }, [refreshUsers]);

  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashSalesTotal, setCashSalesTotal] = useState(0);
  const [depositAmount, setDepositAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTotal, setLoadingTotal] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);

  const loadCashSalesTotal = async (date) => {
    setLoadingTotal(true);
    try {
      const res = await axios.get(`/api/cash-deposits/cash-sales/${date}`);
      setCashSalesTotal(res?.data?.data?.total || 0);
    } catch {
      setCashSalesTotal(0);
    } finally {
      setLoadingTotal(false);
    }
  };

  const loadDeposits = async () => {
    setLoadingDeposits(true);
    try {
      const res = await axios.get('/api/cash-deposits');
      setDeposits(res?.data?.data || []);
    } catch {
      setDeposits([]);
    } finally {
      setLoadingDeposits(false);
    }
  };

  useEffect(() => {
    if (depositDate) loadCashSalesTotal(depositDate);
  }, [depositDate]);

  useEffect(() => { loadDeposits(); }, []);

  const handleDocumentAdd = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocuments((prev) => [
          ...prev,
          { file, preview: event.target.result, label: file.name },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDocumentRemove = (index) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const amt = Number(String(depositAmount).replace(/\D/g, ''));
    if (!amt || amt <= 0) {
      alertError('Jumlah setoran harus lebih dari 0.');
      return;
    }

    setLoading(true);
    try {
      const proofDocs = documents.map((doc) => ({ label: doc.label, url: doc.preview }));

      await axios.post('/api/cash-deposits', {
        deposit_date: depositDate,
        deposit_amount: amt,
        notes: notes || null,
        proof_documents: proofDocs.length > 0 ? proofDocs : null,
        pic_id: currentPIC?.id || null,
        pic_name: currentPIC?.name || null,
      });

      alertSuccess('Setoran kas berhasil dibuat. Menunggu approval admin.');
      setDepositAmount('');
      setNotes('');
      setDocuments([]);
      loadDeposits();
    } catch (e) {
      alertError(e?.response?.data?.message || 'Gagal membuat setoran kas.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirmAction({ text: 'Hapus setoran kas ini?' });
    if (!ok) return;
    try {
      await axios.delete(`/api/cash-deposits/${id}`);
      alertSuccess('Setoran kas berhasil dihapus.');
      loadDeposits();
    } catch (e) {
      alertError(e?.response?.data?.message || 'Gagal menghapus setoran kas.');
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: C.warning + '15', color: C.warning, label: 'Menunggu' },
      approved: { bg: C.success + '15', color: C.success, label: 'Disetujui' },
      rejected: { bg: C.danger + '10', color: C.danger, label: 'Ditolak' },
    };
    const cfg = config[status] || config.pending;
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        padding: '4px 10px',
        background: cfg.bg,
        fontFamily: "'Poppins'",
        fontSize: 11,
        fontWeight: 600,
        color: cfg.color,
      }}>
        {cfg.label}
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
      <TopBar title="Setoran Kas" subtitle="Catat setoran tunai ke bank" onBack={goBack} />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? 12 : 16,
        paddingBottom: isMobile ? 100 : 16,
      }}>
        {/* Form Setoran */}
        <ClayCard padding={isMobile ? 16 : 20} style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 14 }}>
            Buat Setoran Kas
          </div>

          {/* Tanggal */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 6 }}>
              Tanggal <span style={{ color: C.danger }}>*</span>
            </div>
            <input
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
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

          {/* Total Penjualan Tunai */}
          <div style={{
            background: C.primary + '08',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 14,
            border: `1px solid ${C.primary}20`,
          }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, fontWeight: 600, color: C.primary, marginBottom: 2 }}>
              Total Penjualan Tunai
            </div>
            <div style={{ fontFamily: "'Poppins'", fontSize: 20, fontWeight: 800, color: C.primary }}>
              {loadingTotal ? 'Memuat...' : rp(cashSalesTotal)}
            </div>
          </div>

          {/* Jumlah Setoran */}
          <MoneyInput
            label="Jumlah Setoran (Rp)"
            value={depositAmount}
            onChange={(v) => setDepositAmount(v)}
            placeholder="0"
          />

          {/* Catatan */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 6 }}>
              Catatan (opsional)
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Contoh: Setoran ke BCA a.n. Waschen Laundry"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 10,
                border: `1.5px solid ${C.n200}`,
                padding: 12,
                fontFamily: "'Poppins'",
                fontSize: 13,
                color: C.n900,
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>

          {/* PIC Selector */}
          <div style={{ marginTop: 14 }}>
            <PICSelector
              currentPIC={currentPIC}
              onChange={setCurrentPIC}
              users={availableUsers}
              loading={picLoading}
            />
          </div>

          {/* Bukti Dokumen */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: C.primary + '10',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
              }}>
                📄
              </div>
              <div>
                <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n800 }}>
                  Bukti Dokumen
                </div>
                <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n600 }}>
                  Upload bukti setoran (opsional)
                </div>
              </div>
            </div>

            <label style={{
              display: 'inline-flex',
              height: 40,
              padding: '0 14px',
              borderRadius: 10,
              border: `1.5px solid ${C.primary}`,
              background: `${C.primary}10`,
              fontFamily: "'Poppins'",
              fontSize: 12,
              fontWeight: 600,
              color: C.primary,
              cursor: 'pointer',
              alignItems: 'center',
              gap: 4,
            }}>
              Upload
              <input type="file" accept="image/*" multiple onChange={handleDocumentAdd} style={{ display: 'none' }} />
            </label>

            {documents.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {documents.map((doc, i) => (
                  <div key={i} style={{
                    position: 'relative',
                    width: 80,
                    height: 80,
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: `1.5px solid ${C.n200}`,
                  }}>
                    <img src={doc.preview} alt={doc.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => handleDocumentRemove(i)}
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
            {loading ? 'Memproses...' : 'Simpan Setoran Kas'}
          </motion.button>
        </ClayCard>

        {/* Riwayat Setoran */}
        <ClayCard padding={16}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
            Riwayat Setoran
          </div>
          {loadingDeposits ? (
            <div style={{ textAlign: 'center', padding: 16, fontFamily: "'Poppins'", fontSize: 12, color: C.n600 }}>
              Memuat...
            </div>
          ) : deposits.length === 0 ? (
            <EmptyState
              type="reports"
              title="Belum Ada Setoran Kas"
              message="Riwayat setoran kas akan muncul di sini"
              suggestion="Lakukan setoran kas untuk melihat riwayat"
              illustrationSize={80}
              compact
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deposits.map((dep, index) => (
                <motion.div
                  key={dep.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  style={{
                    background: C.n50,
                    borderRadius: 14,
                    padding: 14,
                    border: `1px solid ${C.n100}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: "'Poppins'", fontSize: 11, fontWeight: 600, color: C.n700 }}>
                        {dep.deposit_date}
                      </div>
                      <div style={{ fontFamily: "'Poppins'", fontSize: 16, fontWeight: 800, color: C.n900 }}>
                        {rp(dep.deposit_amount)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      {getStatusBadge(dep.status)}
                      {dep.status === 'pending' && (
                        <button
                          onClick={() => handleDelete(dep.id)}
                          style={{
                            fontFamily: "'Poppins'",
                            fontSize: 10,
                            color: C.danger,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          hapus
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n700 }}>
                    Penjualan tunai: <strong>{rp(dep.cash_sales_total)}</strong>
                  </div>
                  {dep.picName && (
                    <div style={{
                      background: `${C.primary}08`,
                      borderRadius: 6,
                      padding: '4px 10px',
                      marginTop: 6,
                      fontFamily: "'Poppins'",
                      fontSize: 10,
                      color: C.primary,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      PIC: <strong>{dep.picName}</strong>
                    </div>
                  )}
                  {dep.notes && (
                    <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n700, marginTop: 4 }}>
                      {dep.notes}
                    </div>
                  )}
                  {dep.reject_reason && (
                    <div style={{
                      fontFamily: "'Poppins'",
                      fontSize: 11,
                      color: C.danger,
                      marginTop: 4,
                      padding: 8,
                      background: C.danger + '10',
                      borderRadius: 8,
                    }}>
                      Alasan ditolak: {dep.reject_reason}
                    </div>
                  )}
                  {dep.proof_documents && dep.proof_documents.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {dep.proof_documents.map((doc, i) => (
                        <img
                          key={i}
                          src={doc.url}
                          alt={doc.label}
                          style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }}
                        />
                      ))}
                    </div>
                  )}
                  <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n500, marginTop: 6 }}>
                    Dibuat: {new Date(dep.created_at).toLocaleString('id-ID')}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ClayCard>
      </div>
    </div>
  );
}
