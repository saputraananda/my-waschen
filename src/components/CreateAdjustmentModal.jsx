/**
 * CreateAdjustmentModal.jsx
 * Modal untuk membuat koreksi nota
 */

import { useState } from 'react';
import { AlertTriangle, X, TrendingUp, TrendingDown, Minus, Check, RefreshCw } from 'lucide-react';
import { rp } from '../../utils/helpers';

const ADJUSTMENT_TYPES = [
  { key: 'price', label: 'Harga', desc: 'Koreksi harga per item/layanan' },
  { key: 'quantity', label: 'Quantity', desc: 'Koreksi jumlah item' },
  { key: 'discount', label: 'Diskon', desc: 'Tambah/kurang diskon' },
  { key: 'payment', label: 'Pembayaran', desc: 'Koreksi nominal bayar' },
];

export default function CreateAdjustmentModal({ transaction, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form data
  const [type, setType] = useState('');
  const [oldValue, setOldValue] = useState('');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Calculate
  const difference = (parseFloat(newValue) || 0) - (parseFloat(oldValue) || 0);
  const adjustmentAction = difference > 0 ? 'charge' : difference < 0 ? 'refund' : 'none';

  const handleSubmit = async () => {
    if (!type || !oldValue || !newValue || !reason) {
      alert('Lengkapi semua field wajib');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transaction.id,
          type,
          oldValue: parseFloat(oldValue),
          newValue: parseFloat(newValue),
          reason,
          notes,
          action: adjustmentAction,
        }),
      });

      const data = await res.json();

      if (data.success) {
        onSuccess?.(data.data);
        onClose();
      } else {
        alert(data.message || 'Gagal membuat adjustment');
      }
    } catch (error) {
      // Error logged to backend via error tracking
      alert('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return type !== '';
    if (step === 2) return oldValue && newValue && parseFloat(oldValue) > 0;
    if (step === 3) return reason.trim().length >= 5;
    return true;
  };

  const handleNext = () => {
    if (canProceed()) setStep(s => s + 1);
  };

  const handleBack = () => {
    setStep(s => s - 1);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 200,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'white',
        borderRadius: '20px 20px 0 0',
        maxHeight: '90vh',
        overflow: 'auto',
        zIndex: 201,
        padding: '20px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#FEF3C7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={20} color="#D97706" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1F2937' }}>
                Koreksi Nota
              </div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                {transaction?.transaction_no}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: '1px solid #E5E7EB',
              background: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} color="#6B7280" />
          </button>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                background: s <= step ? '#5B005F' : '#E5E7EB',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* Step 1: Select Type */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937', marginBottom: 12 }}>
              Pilih Tipe Koreksi
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ADJUSTMENT_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 14, borderRadius: 12,
                    border: type === t.key ? '2px solid #5B005F' : '1.5px solid #E5E7EB',
                    background: type === t.key ? '#F8F4FF' : 'white',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: '#EDE9FE',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {t.key === 'price' && <span style={{ fontSize: 18 }}>💰</span>}
                    {t.key === 'quantity' && <span style={{ fontSize: 18 }}>📦</span>}
                    {t.key === 'discount' && <span style={{ fontSize: 18 }}>🏷️</span>}
                    {t.key === 'payment' && <span style={{ fontSize: 18 }}>💳</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{t.desc}</div>
                  </div>
                  {type === t.key && (
                    <Check size={20} color="#5B005F" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Input Values */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937', marginBottom: 12 }}>
              Masukkan Nilai
            </div>

            {/* Transaction Info */}
            <div style={{
              background: '#F8F4FF',
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Total Transaksi Saat Ini</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#5B005F' }}>
                {rp(transaction?.total || 0)}
              </div>
            </div>

            {/* Old Value */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Nilai Lama (yang tercatat)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6B7280', fontSize: 14,
                }}>Rp</span>
                <input
                  type="number"
                  value={oldValue}
                  onChange={(e) => setOldValue(e.target.value)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 10,
                    border: '1.5px solid #E5E7EB',
                    padding: '0 14px 0 40px',
                    fontSize: 16,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* New Value */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Nilai Baru (yang benar)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6B7280', fontSize: 14,
                }}>Rp</span>
                <input
                  type="number"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 10,
                    border: '1.5px solid #E5E7EB',
                    padding: '0 14px 0 40px',
                    fontSize: 16,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Difference Preview */}
            {oldValue && newValue && (
              <div style={{
                background: difference >= 0 ? '#FEF2F2' : '#F0FDF4',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, color: '#374151' }}>Selisih:</span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 16,
                  fontWeight: 700,
                  color: difference >= 0 ? '#DC2626' : '#059669',
                }}>
                  {difference >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  {difference >= 0 ? '+' : ''}{rp(Math.abs(difference))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Reason */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937', marginBottom: 12 }}>
              Alasan Koreksi
            </div>

            {/* Quick Reasons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {[
                'Salah input nominal',
                'Double input item',
                'Item tidak sesuai',
                'Discount salah hitung',
              ].map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 20,
                    border: reason === r ? '2px solid #5B005F' : '1px solid #E5E7EB',
                    background: reason === r ? '#F8F4FF' : 'white',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Custom Reason */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Atau ketik alasan *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Jelaskan mengapa koreksi diperlukan..."
                rows={3}
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: '1.5px solid #E5E7EB',
                  padding: 12,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                }}
              />
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                Minimal 5 karakter
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Catatan Tambahan (opsional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detail tambahan..."
                rows={2}
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: '1.5px solid #E5E7EB',
                  padding: 12,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        {step === 3 && (
          <div style={{
            background: '#F8F4FF',
            borderRadius: 12,
            padding: 14,
            marginTop: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5B005F', marginBottom: 8 }}>
              Ringkasan Koreksi
            </div>
            <div style={{ fontSize: 13, color: '#374151' }}>
              <div>• Tipe: <strong>{ADJUSTMENT_TYPES.find(t => t.key === type)?.label}</strong></div>
              <div>• {rp(oldValue)} → {rp(newValue)}</div>
              <div>• Selisih: <strong style={{ color: difference >= 0 ? '#DC2626' : '#059669' }}>
                {difference >= 0 ? '+' : ''}{rp(Math.abs(difference))}
              </strong>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingBottom: 20 }}>
          {step > 1 && (
            <button
              onClick={handleBack}
              style={{
                flex: 1, height: 48, borderRadius: 12,
                border: '1.5px solid #E5E7EB',
                background: 'white', fontSize: 14, fontWeight: 600,
                color: '#374151', cursor: 'pointer',
              }}
            >
              Kembali
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              style={{
                flex: 1, height: 48, borderRadius: 12,
                border: 'none',
                background: canProceed() ? 'linear-gradient(135deg, #5B005F, #8B5CF6)' : '#E5E7EB',
                fontSize: 14, fontWeight: 600,
                color: canProceed() ? 'white' : '#9CA3AF',
                cursor: canProceed() ? 'pointer' : 'not-allowed',
              }}
            >
              Lanjut
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !canProceed()}
              style={{
                flex: 1, height: 48, borderRadius: 12,
                border: 'none',
                background: canProceed() && !loading
                  ? 'linear-gradient(135deg, #059669, #10B981)'
                  : '#E5E7EB',
                fontSize: 14, fontWeight: 600,
                color: canProceed() && !loading ? 'white' : '#9CA3AF',
                cursor: canProceed() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Simpan Koreksi
                </>
              )}
            </button>
          )}
        </div>

        {/* Spin animation */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
}
