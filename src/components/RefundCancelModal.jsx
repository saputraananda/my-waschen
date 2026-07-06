// ─────────────────────────────────────────────────────────────────────────────
// RefundCancelModal.jsx — Cancellation Modal with Method Selection
// Phase 7: Refund & Cancellation System
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Modal, Btn } from './ui';
import { rp } from '../utils/helpers';
import { AlertTriangle, CreditCard, Wallet, Banknote, ChevronRight, Loader2, Check } from 'lucide-react';

const REFUND_REASONS = [
  { value: 'customer_request', label: 'Permintaan Customer', icon: '🙋' },
  { value: 'produk_rusak', label: 'Produk Rusak/Cacat', icon: '💔' },
  { value: 'salah_layanan', label: 'Salah Layanan', icon: '❌' },
  { value: 'tidak_sesuai', label: 'Tidak Sesuai Pesanan', icon: '📋' },
  { value: 'batal_order', label: 'Batal Order', icon: '🚫' },
  { value: 'kompensasi', label: 'Kompensasi', icon: '🎁' },
  { value: 'lainnya', label: 'Lainnya', icon: '📝' },
];

const REFUND_METHODS = [
  {
    value: 'deposit',
    label: 'Deposit/Saldo',
    icon: Wallet,
    color: '#6e2e78',
    description: 'Langsung masuk ke saldo member'
  },
  {
    value: 'cash',
    label: 'Tunai',
    icon: Banknote,
    color: '#059669',
    description: 'Cash refund di outlet'
  },
  {
    value: 'transfer',
    label: 'Transfer Bank',
    icon: CreditCard,
    color: '#0284c7',
    description: 'Transfer ke rekening customer'
  },
];

function LoadingState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      gap: 12
    }}>
      <Loader2 size={32} color="#6e2e78" style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontFamily: 'Poppins', fontSize: 13, color: '#64748B' }}>
        Memuat detail transaksi...
      </span>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function ReasonOption({ reason, selected, onClick }) {
  const Icon = reason.icon;
  return (
    <button
      onClick={() => onClick(reason.value)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: selected ? '#f3e8ff' : '#f8fafc',
        border: `2px solid ${selected ? '#6e2e78' : 'transparent'}`,
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{ fontSize: 20 }}>{Icon}</span>
      <span style={{
        flex: 1,
        fontFamily: 'Poppins',
        fontSize: 13,
        fontWeight: selected ? 600 : 500,
        color: selected ? '#6e2e78' : '#334155'
      }}>
        {reason.label}
      </span>
      {selected && (
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: '#6e2e78',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Check size={12} color="white" />
        </div>
      )}
    </button>
  );
}

function MethodOption({ method, selected, onClick, disabled }) {
  const Icon = method.icon;
  return (
    <button
      onClick={() => !disabled && onClick(method.value)}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: disabled ? '#f1f5f9' : (selected ? `${method.color}15` : '#f8fafc'),
        border: `2px solid ${selected ? method.color : 'transparent'}`,
        borderRadius: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: disabled ? '#cbd5e1' : `${method.color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={20} color={disabled ? '#94a3b8' : method.color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 13,
          fontWeight: 600,
          color: disabled ? '#94a3b8' : '#1e293b',
          marginBottom: 2
        }}>
          {method.label}
        </div>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 11,
          color: '#64748b'
        }}>
          {disabled ? 'Tidak tersedia' : method.description}
        </div>
      </div>
      {selected && !disabled && (
        <ChevronRight size={18} color={method.color} />
      )}
    </button>
  );
}

export default function RefundCancelModal({
  isOpen,
  onClose,
  transaction, // { id, transactionNo, customerName, total, paidAmount, paymentMethod, items }
  onSuccess
}) {
  const [step, setStep] = useState(1); // 1: reason, 2: method, 3: confirm
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('deposit');
  const [notes, setNotes] = useState('');

  // Calculated values
  const [refundAmount, setRefundAmount] = useState(0);
  const [maxRefund, setMaxRefund] = useState(0);

  // Fetch transaction details on mount
  useEffect(() => {
    if (!isOpen || !transaction?.id) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError('');
      try {
        // If transaction has full data, use it
        if (transaction.total) {
          const total = Number(transaction.total);
          const paid = Number(transaction.paidAmount || transaction.paid_amount || 0);
          setMaxRefund(paid);
          setRefundAmount(paid);
          return;
        }

        // Otherwise fetch from API
        const res = await axios.get(`/api/refunds/${transaction.id}`);
        if (res?.data?.data) {
          const data = res.data.data;
          setMaxRefund(Number(data.paidAmount || 0));
          setRefundAmount(Number(data.paidAmount || 0));
        }
      } catch (err) {
        console.error('Failed to fetch transaction:', err);
        setError('Gagal memuat detail transaksi.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, transaction]);

  const handleReasonSelect = (reason) => {
    setSelectedReason(reason);
    if (reason !== 'lainnya') {
      setReasonDetail('');
    }
    setError('');
  };

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setError('');
  };

  const canProceedStep1 = selectedReason && (selectedReason !== 'lainnya' || reasonDetail.trim());
  const canProceedStep2 = selectedMethod;

  const handleNext = () => {
    if (step === 1 && canProceedStep1) {
      setStep(2);
    } else if (step === 2 && canProceedStep2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        transactionId: transaction.id,
        refundAmount,
        reason: selectedReason,
        reasonDetail: selectedReason === 'lainnya' ? reasonDetail : null,
        refundMethod: selectedMethod,
        notes: notes.trim() || null,
      };

      const res = await axios.post('/api/refunds', payload);

      if (res?.data?.success) {
        onSuccess?.(res.data.data);
        handleClose();
      } else {
        setError(res?.data?.message || 'Gagal memproses refund.');
      }
    } catch (err) {
      console.error('Refund failed:', err);
      setError(err?.response?.data?.message || 'Terjadi kesalahan saat memproses refund.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setStep(1);
    setSelectedReason('');
    setReasonDetail('');
    setSelectedMethod('deposit');
    setNotes('');
    setError('');
    setRefundAmount(0);
    setMaxRefund(0);
    onClose();
  };

  const renderStep1 = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{
          fontFamily: 'Poppins',
          fontSize: 16,
          fontWeight: 700,
          color: '#1e293b',
          marginBottom: 4
        }}>
          Pilih Alasan Pembatalan
        </h3>
        <p style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          color: '#64748b',
          margin: 0
        }}>
          Pilih alasan yang sesuai untuk pembatalan transaksi
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {REFUND_REASONS.map(reason => (
          <ReasonOption
            key={reason.value}
            reason={reason}
            selected={selectedReason === reason.value}
            onClick={handleReasonSelect}
          />
        ))}
      </div>

      {selectedReason === 'lainnya' && (
        <div style={{ marginBottom: 16 }}>
          <textarea
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            placeholder="Jelaskan alasan lainnya..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px 14px',
              fontFamily: 'Poppins',
              fontSize: 13,
              border: '2px solid #e2e8f0',
              borderRadius: 10,
              resize: 'none',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#6e2e78'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
        </div>
      )}

      {/* Notes */}
      <div style={{ marginBottom: 16 }}>
        <label style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          fontWeight: 600,
          color: '#475569',
          marginBottom: 6,
          display: 'block'
        }}>
          Catatan Tambahan (Opsional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tambahkan catatan jika diperlukan..."
          rows={2}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontFamily: 'Poppins',
            fontSize: 12,
            border: '2px solid #e2e8f0',
            borderRadius: 10,
            resize: 'none',
            outline: 'none',
          }}
          onFocus={(e) => e.target.style.borderColor = '#6e2e78'}
          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{
          fontFamily: 'Poppins',
          fontSize: 16,
          fontWeight: 700,
          color: '#1e293b',
          marginBottom: 4
        }}>
          Pilih Metode Refund
        </h3>
        <p style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          color: '#64748b',
          margin: 0
        }}>
          Pilih cara mengembalikan dana ke customer
        </p>
      </div>

      {/* Refund amount display */}
      <div style={{
        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
        borderRadius: 12,
        padding: '16px',
        marginBottom: 16,
        textAlign: 'center'
      }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          color: '#92400e',
          marginBottom: 4
        }}>
          Nominal Refund
        </div>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 28,
          fontWeight: 800,
          color: '#b45309'
        }}>
          {rp(refundAmount)}
        </div>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 11,
          color: '#d97706',
          marginTop: 4
        }}>
          Dari: {transaction?.transactionNo || '-'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {REFUND_METHODS.map(method => (
          <MethodOption
            key={method.value}
            method={method}
            selected={selectedMethod === method.value}
            onClick={handleMethodSelect}
            disabled={method.value !== 'deposit'} // Only deposit is ready for now
          />
        ))}
      </div>

      <div style={{
        marginTop: 12,
        padding: '10px 12px',
        background: '#fff7ed',
        borderRadius: 8,
        border: '1px solid #fed7aa'
      }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 11,
          color: '#c2410c',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <AlertTriangle size={14} />
          <span>Metode lain (Tunai, Transfer) memerlukan persetujuan admin</span>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{
          fontFamily: 'Poppins',
          fontSize: 16,
          fontWeight: 700,
          color: '#1e293b',
          marginBottom: 4
        }}>
          Konfirmasi Pembatalan
        </h3>
        <p style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          color: '#64748b',
          margin: 0
        }}>
          Periksa detail sebelum memproses pembatalan
        </p>
      </div>

      {/* Summary */}
      <div style={{
        background: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16
      }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 11,
            color: '#64748b',
            marginBottom: 2
          }}>
            No. Transaksi
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 14,
            fontWeight: 600,
            color: '#1e293b'
          }}>
            {transaction?.transactionNo || '-'}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 11,
            color: '#64748b',
            marginBottom: 2
          }}>
            Customer
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 14,
            fontWeight: 600,
            color: '#1e293b'
          }}>
            {transaction?.customerName || '-'}
          </div>
        </div>

        <div style={{
          height: 1,
          background: '#e2e8f0',
          margin: '12px 0'
        }} />

        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 11,
            color: '#64748b',
            marginBottom: 2
          }}>
            Alasan
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 13,
            fontWeight: 500,
            color: '#334155'
          }}>
            {REFUND_REASONS.find(r => r.value === selectedReason)?.label || selectedReason}
            {selectedReason === 'lainnya' && reasonDetail && `: ${reasonDetail}`}
          </div>
        </div>

        <div style={{
          height: 1,
          background: '#e2e8f0',
          margin: '12px 0'
        }} />

        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 11,
            color: '#64748b',
            marginBottom: 2
          }}>
            Metode Refund
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 13,
            fontWeight: 500,
            color: '#334155',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            {REFUND_METHODS.find(m => m.value === selectedMethod)?.icon &&
              (() => {
                const Icon = REFUND_METHODS.find(m => m.value === selectedMethod).icon;
                const color = REFUND_METHODS.find(m => m.value === selectedMethod).color;
                return <Icon size={16} color={color} />;
              })()
            }
            {REFUND_METHODS.find(m => m.value === selectedMethod)?.label || selectedMethod}
          </div>
        </div>

        <div style={{
          height: 1,
          background: '#e2e8f0',
          margin: '12px 0'
        }} />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 13,
            fontWeight: 600,
            color: '#334155'
          }}>
            Total Refund
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 20,
            fontWeight: 800,
            color: '#6e2e78'
          }}>
            {rp(refundAmount)}
          </div>
        </div>
      </div>

      {notes && (
        <div style={{
          padding: '10px 12px',
          background: '#f0f9ff',
          borderRadius: 8,
          marginBottom: 16
        }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 11,
            color: '#0369a1',
            marginBottom: 2
          }}>
            Catatan
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            color: '#0c4a6e'
          }}>
            {notes}
          </div>
        </div>
      )}

      <div style={{
        padding: '12px',
        background: '#fef2f2',
        borderRadius: 10,
        border: '1px solid #fecaca'
      }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          fontWeight: 600,
          color: '#dc2626',
          marginBottom: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <AlertTriangle size={16} />
          Perhatian
        </div>
        <ul style={{
          fontFamily: 'Poppins',
          fontSize: 11,
          color: '#991b1b',
          margin: 0,
          paddingLeft: 20,
          lineHeight: 1.5
        }}>
          <li>Transaksi akan dibatalkan dan tidak dapat dikembalikan</li>
          <li>Dana akan dikembalikan sesuai metode yang dipilih</li>
          <li>Stok bahan akan dikembalikan jika applicable</li>
        </ul>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title=""
      size="md"
      showHeader={false}
    >
      {/* Custom Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
      }}>
        <div>
          <h2 style={{
            fontFamily: 'Poppins',
            fontSize: 18,
            fontWeight: 700,
            color: '#1e293b',
            margin: 0
          }}>
            Ajukan Pembatalan
          </h2>
          <p style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            color: '#64748b',
            margin: '4px 0 0'
          }}>
            Step {step} dari 3
          </p>
        </div>
        <button
          onClick={handleClose}
          style={{
            width: 32, height: 32,
            borderRadius: 8,
            background: '#f1f5f9',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ✕
        </button>
      </div>

      {/* Progress Bar */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 20
      }}>
        {[1, 2, 3].map(s => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: s <= step ? '#6e2e78' : '#e2e8f0',
              transition: 'background 0.2s'
            }}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 12px',
          background: '#fef2f2',
          borderRadius: 8,
          border: '1px solid #fecaca',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <AlertTriangle size={16} color="#dc2626" />
          <span style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            color: '#dc2626'
          }}>
            {error}
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? <LoadingState /> : (
        <>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </>
      )}

      {/* Actions */}
      {!loading && (
        <div style={{
          display: 'flex',
          gap: 10,
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid #e2e8f0'
        }}>
          {step > 1 && (
            <Btn
              variant="outline"
              onClick={handleBack}
              style={{ flex: 1 }}
            >
              Kembali
            </Btn>
          )}
          {step < 3 ? (
            <Btn
              variant="primary"
              onClick={handleNext}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              style={{ flex: 1 }}
            >
              Lanjut
            </Btn>
          ) : (
            <Btn
              variant="danger"
              onClick={handleSubmit}
              loading={submitting}
              style={{ flex: 1 }}
            >
              Konfirmasi Pembatalan
            </Btn>
          )}
        </div>
      )}
    </Modal>
  );
}
