import { useState, useEffect } from 'react';
import axios from 'axios';
import { C, T, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, MoneyInput, EmptyState } from '../../components/ui';
import { alertError, alertSuccess, confirmAction } from '../../utils/alert';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import PICSelector from '../../components/PICSelector';
import { usePICSelector } from '../../hooks/usePIC';

export default function CashDepositPage({ navigate, goBack }) {
  const { isMobile, isTablet } = useResponsive();
  const { width } = useWindowSize();
  // PIC Selection - track who is responsible for this deposit
  const {
    currentPIC,
    setCurrentPIC,
    availableUsers,
    refreshUsers,
    isLoading: picLoading,
  } = usePICSelector();

  // Fetch available users for PIC on mount
  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

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
    } catch (e) {
      // Silent fail - cash sales total is optional
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
    } catch (e) {
      // Silent fail - deposits list is optional
      setDeposits([]);
    } finally {
      setLoadingDeposits(false);
    }
  };

  useEffect(() => {
    if (depositDate) {
      loadCashSalesTotal(depositDate);
    }
  }, [depositDate]);

  useEffect(() => {
    loadDeposits();
  }, []);

  const handleDocumentAdd = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocuments((prev) => [
          ...prev,
          {
            file,
            preview: event.target.result,
            label: file.name,
          },
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
      const proofDocs = documents.map((doc) => ({
        label: doc.label,
        url: doc.preview,
      }));

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
      pending: { bg: C.validationWarningBg, color: C.validationWarningText, label: 'Menunggu' },
      approved: { bg: C.successBg, color: C.successDark, label: 'Disetujui' },
      rejected: { bg: C.validationErrorBg, color: C.validationErrorText, label: 'Ditolak' },
    };
    const cfg = config[status] || config.pending;
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '4px 10px', background: cfg.bg }}>
        <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Setoran Kas" subtitle="Catat setoran tunai ke bank" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 10 : 16, paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom) + 80px)' : 16 }}>
        {/* Form Setoran dengan animasi fade in */}
        <div
          style={{
            ...T.card,
            marginBottom: 16,
            animation: 'fadeInUp 0.5s ease-out forwards',
            opacity: 0,
            animationDelay: '0.1s',
            padding: isMobile ? 12 : undefined,
          }}
        >
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 13 : 14, fontWeight: 600, color: C.n900, marginBottom: isMobile ? 10 : 14 }}>Buat Setoran Kas</div>

          {/* Tanggal */}
          <div style={{ marginBottom: isMobile ? 10 : 12 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Tanggal <span style={{ color: '#DC2626' }}>*</span></div>
            <input
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              style={{ ...T.input, width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* Total Penjualan Tunai */}
          <div style={{ background: C.infoBg, borderRadius: 12, padding: '12px 14px', marginBottom: 14, border: `1px solid ${C.info}` }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.infoDark, marginBottom: 2 }}>Total Penjualan Tunai</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color: C.infoDark }}>
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
          <div style={{ marginTop: 12, marginBottom: isMobile ? 10 : 12 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Catatan (opsional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={isMobile ? 2 : 3}
              placeholder="Contoh: Setoran ke BCA a.n. Waschen Laundry"
              style={{ ...T.input, height: 'auto', minHeight: 80, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* PIC Selector */}
          <div style={{ marginBottom: 14 }}>
            <PICSelector
              currentPIC={currentPIC}
              onChange={setCurrentPIC}
              users={availableUsers}
              loading={picLoading}
            />
          </div>

          {/* Bukti Dokumen */}
          <div style={{ marginBottom: isMobile ? 10 : 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: C.infoBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📄</div>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 600, color: C.n800 }}>Bukti Dokumen</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n700 }}>Upload bukti setoran (opsional)</div>
              </div>
            </div>

            <label style={{ display: 'flex', height: 40, padding: '0 14px', borderRadius: 10, border: `1.5px solid ${C.primary}`, background: `${C.primary}10`, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary, cursor: 'pointer', alignItems: 'center', gap: 4 }}>
              📷 Upload
              <input type="file" accept="image/*" multiple onChange={handleDocumentAdd} style={{ display: 'none' }} />
            </label>

            {documents.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {documents.map((doc, i) => (
                  <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${C.n200}` }}>
                    <img src={doc.preview} alt={doc.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => handleDocumentRemove(i)}
                      style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Btn variant="success" fullWidth loading={loading} onClick={handleSubmit}>
            Simpan Setoran Kas
          </Btn>
        </div>

        {/* Riwayat Setoran dengan animasi fade in */}
        <div 
          style={{ 
            ...T.card,
            animation: 'fadeInUp 0.5s ease-out forwards',
            opacity: 0,
            animationDelay: '0.3s'
          }}
        >
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 12 }}>Riwayat Setoran</div>
          {loadingDeposits ? (
            <div style={{ textAlign: 'center', padding: 16, color: C.n700, fontFamily: 'Poppins', fontSize: 12 }}>Memuat...</div>
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
                <div 
                  key={dep.id} 
                  className="deposit-item"
                  style={{ 
                    background: C.n50, 
                    borderRadius: 12, 
                    padding: 12, 
                    border: `1px solid ${C.n200}`,
                    animationDelay: `${0.4 + index * 0.1}s`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700 }}>{dep.deposit_date}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: C.n900 }}>{rp(dep.deposit_amount)}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      {getStatusBadge(dep.status)}
                      {dep.status === 'pending' && (
                        <button
                          onClick={() => handleDelete(dep.id)}
                          style={{ fontFamily: 'Poppins', fontSize: 10, color: C.danger, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          hapus
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#3a3a3a', marginBottom: 4 }}>
                    Penjualan tunai: <strong>{rp(dep.cash_sales_total)}</strong>
                  </div>
                  {/* PIC Info */}
                  {dep.picName && (
                    <div style={{
                      background: `${C.primary}08`,
                      borderRadius: 6,
                      padding: '4px 10px',
                      marginTop: 6,
                      fontFamily: 'Poppins',
                      fontSize: 10,
                      color: C.primary,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      👤 PIC: <strong>{dep.picName}</strong>
                    </div>
                  )}
                  {dep.notes && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#3a3a3a', marginBottom: 4 }}>{dep.notes}</div>}
                  {dep.reject_reason && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.danger, marginTop: 4, padding: 8, background: C.validationErrorBg, borderRadius: 8 }}>
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
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 6 }}>
                    Dibuat: {new Date(dep.created_at).toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Definisi animasi CSS */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Animate each deposit item with staggered delay */
        .deposit-item {
          animation: fadeInUp 0.4s ease-out forwards;
          opacity: 0;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .deposit-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        /* Smooth hover for buttons and inputs */
        input, textarea, button {
          transition: all 0.2s ease;
        }
      `}</style>
    </div>
  );
}
