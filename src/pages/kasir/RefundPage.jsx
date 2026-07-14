// ─────────────────────────────────────────────────────────────────────────────
// RefundPage.jsx — Refund Request Form with Suggested Reasons
// Phase 1.2: Refund System
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp, formatDate } from '../../utils/helpers';
import { TopBar, Btn, Input, Select, MoneyInput, Modal } from '../../components/ui';
import { alertError, alertSuccess, alertWarning, alertConfirm } from '../../utils/alert';
import { useApp } from '../../context/AppContext';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import {
  ArrowLeft, AlertTriangle, Check, ChevronRight, Loader2,
  CreditCard, Wallet, Banknote, Clock, CheckCircle2, XCircle
} from 'lucide-react';

// ─── Suggested Refund Reasons (from SPEC.md) ────────────────────────────────
const SUGGESTED_REASONS = [
  {
    id: 'customer_request',
    label: 'Permintaan Customer',
    icon: '🙋',
    description: 'Customer meminta refund',
    recommended: false,
  },
  {
    id: 'produk_rusak',
    label: 'Produk Rusak / Cacat',
    icon: '💔',
    description: 'Item laundry rusak atau cacat',
    recommended: true, // (Recommended)
  },
  {
    id: 'salah_layanan',
    label: 'Salah Input Layanan',
    icon: '✏️',
    description: 'Kesalahan dalam input layanan',
    recommended: false,
  },
  {
    id: 'tidak_sesuai',
    label: 'Tidak Sesuai Pesanan',
    icon: '📋',
    description: 'Hasil laundry tidak sesuai ekspektasi',
    recommended: false,
  },
  {
    id: 'batal_order',
    label: 'Pelanggan Tidak Jadi',
    icon: '⏰',
    description: 'Customer batal sebelum laundry diproses',
    recommended: false,
  },
  {
    id: 'item_tidak_ada',
    label: 'Item Tidak Ditemukan',
    icon: '📦',
    description: 'Item laundry tidak ditemukan di outlet',
    recommended: false,
  },
  {
    id: 'kompensasi',
    label: 'Kompensasi / Diskon',
    icon: '🎁',
    description: 'Kompensasi karena kesalahan layanan',
    recommended: false,
  },
  {
    id: 'double_charge',
    label: 'Double Charge',
    icon: '💳',
    description: 'Customer dikenakan biaya dua kali',
    recommended: false,
  },
  {
    id: 'lainnya',
    label: 'Lainnya',
    icon: '📝',
    description: 'Alasan lain yang tidak tercantum',
    recommended: false,
  },
];

// ─── Refund Methods ──────────────────────────────────────────────────────────
const REFUND_METHODS = [
  {
    value: 'deposit',
    label: 'Deposit / Saldo',
    icon: Wallet,
    color: '#6e2e78',
    description: 'Langsung masuk ke saldo member',
    available: true,
  },
  {
    value: 'cash',
    label: 'Tunai',
    icon: Banknote,
    color: '#059669',
    description: 'Cash refund di outlet',
    available: false, // Memerlukan approval
  },
  {
    value: 'transfer',
    label: 'Transfer Bank',
    icon: CreditCard,
    color: '#0284c7',
    description: 'Transfer ke rekening customer',
    available: false, // Memerlukan approval
  },
];

// ─── Loading State ───────────────────────────────────────────────────────────
function LoadingState({ message = 'Memuat...' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 20px',
      gap: 12,
    }}>
      <Loader2 size={36} color={C.primary} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>
        {message}
      </span>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Reason Card Component ───────────────────────────────────────────────────
function ReasonCard({ reason, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(reason.id)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: selected ? `${C.primary}12` : C.white,
        border: `2px solid ${selected ? C.primary : C.n200}`,
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
    >
      {/* Recommended Badge */}
      {reason.recommended && (
        <div style={{
          position: 'absolute',
          top: -8,
          right: 12,
          background: C.success,
          color: 'white',
          fontSize: 9,
          fontFamily: 'Poppins',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 10,
        }}>
          Recommended
        </div>
      )}

      {/* Icon */}
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: selected ? `${C.primary}20` : C.n100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
      }}>
        {reason.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 14,
          fontWeight: 600,
          color: selected ? C.primary : C.n900,
          marginBottom: 2,
        }}>
          {reason.label}
        </div>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 11,
          color: C.n500,
        }}>
          {reason.description}
        </div>
      </div>

      {/* Checkmark */}
      {selected && (
        <div style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          background: C.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Check size={14} color="white" />
        </div>
      )}
    </button>
  );
}

// ─── Refund Method Card ──────────────────────────────────────────────────────
function MethodCard({ method, selected, onClick, disabled }) {
  const Icon = method.icon;
  return (
    <button
      onClick={() => !disabled && onClick(method.value)}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px',
        background: disabled ? C.n50 : (selected ? `${method.color}12` : C.white),
        border: `2px solid ${selected ? method.color : 'transparent'}`,
        borderRadius: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      {/* Icon */}
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: disabled ? C.n200 : `${method.color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={24} color={disabled ? C.n400 : method.color} />
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 14,
          fontWeight: 600,
          color: disabled ? C.n400 : C.n900,
          marginBottom: 2,
        }}>
          {method.label}
        </div>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 11,
          color: disabled ? C.n400 : C.n500,
        }}>
          {disabled ? 'Memerlukan approval admin' : method.description}
        </div>
      </div>

      {/* Arrow */}
      {!disabled && (
        <ChevronRight size={20} color={method.color} />
      )}
    </button>
  );
}

// ─── Main RefundPage Component ───────────────────────────────────────────────
export default function RefundPage({ navigate, goBack, screenParams }) {
  const { isMobile, isTablet } = useResponsive();
  // Transaction data from navigation params
  const transaction = screenParams?.transaction || screenParams || {};
  const { user } = useApp();

  // Step state: 1=reason, 2=method, 3=confirm
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('deposit');
  const [notes, setNotes] = useState('');

  // Transaction detail
  const [txDetail, setTxDetail] = useState(null);

  // Calculated refund values
  const txTotal = Number(transaction.total || txDetail?.total || 0);
  const paidAmount = Number(transaction.paidAmount || transaction.paid_amount || txDetail?.paidAmount || 0);
  const balanceDue = txTotal - paidAmount;
  const maxRefund = paidAmount; // Max refund = what was paid
  const [refundAmount, setRefundAmount] = useState(paidAmount);

  // Fetch transaction detail
  useEffect(() => {
    if (!transaction?.id && !transaction?.transactionNo) return;

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const rawId = transaction.id || transaction.transactionNo;
        const res = await axios.get(`/api/transactions/${rawId}`);
        if (res?.data?.data) {
          const data = res.data.data;
          setTxDetail(data);
          setRefundAmount(Number(data.paidAmount || 0));
        }
      } catch (err) {
        setError('Gagal memuat detail transaksi.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [transaction?.id, transaction?.transactionNo]);

  // Handle reason selection
  const handleReasonSelect = (reasonId) => {
    setSelectedReason(reasonId);
    if (reasonId !== 'lainnya') {
      setReasonDetail('');
    }
    setError('');
  };

  // Navigation
  const canProceedStep1 = selectedReason && (selectedReason !== 'lainnya' || reasonDetail.trim().length >= 10);
  const canProceedStep2 = selectedMethod && refundAmount > 0 && refundAmount <= maxRefund;

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
    } else {
      goBack?.();
    }
  };

  // Submit refund request
  const handleSubmit = async () => {
    const reason = SUGGESTED_REASONS.find(r => r.id === selectedReason);
    const confirmed = await alertConfirm(
      `Konfirmasi Pengajuan Refund`,
      `Apakah Anda yakin ingin mengajukan refund ${rp(refundAmount)} untuk transaksi ${transaction.transactionNo || transaction.id}?`
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        transactionId: transaction.id || txDetail?.id,
        refundAmount,
        reason: selectedReason,
        reasonDetail: selectedReason === 'lainnya' ? reasonDetail : null,
        notes: notes.trim() || null,
      };

      const res = await axios.post('/api/refunds', payload);

      if (res?.data?.success) {
        alertSuccess(res.data.message || 'Refund berhasil diajukan.');
        // Navigate back or to refund list
        goBack?.();
      } else {
        setError(res?.data?.message || 'Gagal memproses refund.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Terjadi kesalahan saat memproses refund.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 1: Select Reason ──────────────────────────────────────────────────
  const renderStep1 = () => (
    <div>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primary}CC 100%)`,
        borderRadius: 16,
        padding: '20px',
        marginBottom: 20,
        color: 'white',
      }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          fontWeight: 500,
          opacity: 0.9,
          marginBottom: 4,
        }}>
          Ajukan Refund
        </div>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 22,
          fontWeight: 700,
        }}>
          {transaction.transactionNo || transaction.id || '-'}
        </div>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 13,
          opacity: 0.85,
          marginTop: 8,
        }}>
          {transaction.customerName || txDetail?.customerName || 'Customer'} · {rp(txTotal)}
        </div>
      </div>

      {/* Section Title */}
      <div style={{
        fontFamily: 'Poppins',
        fontSize: 14,
        fontWeight: 600,
        color: C.n800,
        marginBottom: 12,
      }}>
        Pilih Alasan Refund
      </div>

      {/* Reason List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {SUGGESTED_REASONS.map(reason => (
          <ReasonCard
            key={reason.id}
            reason={reason}
            selected={selectedReason === reason.id}
            onClick={handleReasonSelect}
          />
        ))}
      </div>

      {/* Detail for "Lainnya" */}
      {selectedReason === 'lainnya' && (
        <div style={{
          background: C.n50,
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight: 600,
            color: C.n700,
            marginBottom: 8,
          }}>
            Jelaskan Alasan *
          </div>
          <textarea
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            placeholder="Jelaskan secara detail alasan refund..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px',
              fontFamily: 'Poppins',
              fontSize: 13,
              border: `2px solid ${reasonDetail.length >= 10 ? C.success : C.n200}`,
              borderRadius: 10,
              resize: 'none',
              outline: 'none',
            }}
          />
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 10,
            color: reasonDetail.length >= 10 ? C.success : C.n400,
            marginTop: 6,
            textAlign: 'right',
          }}>
            {reasonDetail.length}/10 karakter minimum
          </div>
        </div>
      )}

      {/* Notes (Optional) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          fontWeight: 600,
          color: C.n700,
          marginBottom: 8,
        }}>
          Catatan Tambahan (Opsional)
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tambahkan catatan jika diperlukan..."
          rows={2}
          style={{
            width: '100%',
            padding: '12px',
            fontFamily: 'Poppins',
            fontSize: 13,
            border: `2px solid ${C.n200}`,
            borderRadius: 10,
            resize: 'none',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );

  // ─── Step 2: Amount & Method ───────────────────────────────────────────────
  const renderStep2 = () => {
    const selectedReasonObj = SUGGESTED_REASONS.find(r => r.id === selectedReason);

    return (
      <div>
        {/* Reason Summary */}
        <div style={{
          background: `${C.primary}10`,
          borderRadius: 12,
          padding: 14,
          marginBottom: 20,
          border: `1px solid ${C.primary}30`,
        }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 11,
            color: C.n600,
            marginBottom: 4,
          }}>
            Alasan yang Dipilih
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 14,
            fontWeight: 600,
            color: C.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>{selectedReasonObj?.icon}</span>
            <span>{selectedReasonObj?.label}</span>
          </div>
        </div>

        {/* Refund Amount */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight: 600,
            color: C.n700,
            marginBottom: 8,
          }}>
            Nominal Refund *
          </div>

          {/* Amount Display */}
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderRadius: 12,
            padding: '20px',
            textAlign: 'center',
            marginBottom: 12,
          }}>
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 12,
              color: '#92400e',
              marginBottom: 4,
            }}>
              Nominal Refund
            </div>
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 32,
              fontWeight: 800,
              color: '#b45309',
            }}>
              {rp(refundAmount)}
            </div>
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 11,
              color: '#d97706',
              marginTop: 6,
            }}>
              Maksimal: {rp(maxRefund)} (dari yang sudah dibayar)
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: 8,
            marginBottom: 12,
          }}>
            {[maxRefund, Math.round(maxRefund * 0.5), Math.round(maxRefund * 0.25)].map((amount, idx) => (
              <button
                key={idx}
                onClick={() => setRefundAmount(amount)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  border: `2px solid ${refundAmount === amount ? C.primary : C.n200}`,
                  background: refundAmount === amount ? `${C.primary}15` : C.white,
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  fontWeight: 600,
                  color: refundAmount === amount ? C.primary : C.n700,
                  cursor: 'pointer',
                }}
              >
                {idx === 0 ? 'Full' : idx === 1 ? '50%' : '25%'}
                <br />
                <span style={{ fontSize: 10, fontWeight: 400 }}>{rp(amount)}</span>
              </button>
            ))}
          </div>

          {/* Manual Input */}
          <MoneyInput
            value={String(refundAmount)}
            onChange={(v) => {
              const num = parseInt(v.replace(/\D/g, '') || 0);
              setRefundAmount(Math.min(num, maxRefund));
            }}
            placeholder="Atau masukkan nominal..."
          />
        </div>

        {/* Refund Method */}
        <div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight: 600,
            color: C.n700,
            marginBottom: 12,
          }}>
            Metode Pengembalian
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {REFUND_METHODS.map(method => (
              <MethodCard
                key={method.value}
                method={method}
                selected={selectedMethod === method.value}
                onClick={setSelectedMethod}
                disabled={!method.available}
              />
            ))}
          </div>

          {/* Info Box */}
          <div style={{
            marginTop: 12,
            padding: '12px 14px',
            background: '#fff7ed',
            borderRadius: 10,
            border: '1px solid #fed7aa',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <AlertTriangle size={18} color="#c2410c" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 11,
              color: '#9a3412',
              lineHeight: 1.5,
            }}>
              Metode <strong>Tunai</strong> dan <strong>Transfer</strong> memerlukan persetujuan Admin.
              Refund akan diproses setelah disetujui.
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Step 3: Confirmation ──────────────────────────────────────────────────
  const renderStep3 = () => {
    const selectedReasonObj = SUGGESTED_REASONS.find(r => r.id === selectedReason);
    const selectedMethodObj = REFUND_METHODS.find(m => m.value === selectedMethod);
    const Icon = selectedMethodObj?.icon;

    return (
      <div>
        {/* Summary Card */}
        <div style={{
          background: C.white,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          border: `1px solid ${C.n200}`,
        }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight: 600,
            color: C.n600,
            marginBottom: 16,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Ringkasan Refund
          </div>

          {/* Transaction Info */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>No. Transaksi</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                {transaction.transactionNo || transaction.id}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Customer</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                {transaction.customerName || txDetail?.customerName || '-'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Total Tagihan</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                {rp(txTotal)}
              </span>
            </div>
          </div>

          <div style={{ height: 1, background: C.n200, margin: '12px 0' }} />

          {/* Refund Details */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Alasan</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n900 }}>
                {selectedReasonObj?.icon} {selectedReasonObj?.label}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Metode</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n900, display: 'flex', alignItems: 'center', gap: 4 }}>
                {Icon && <Icon size={14} color={selectedMethodObj?.color} />}
                {selectedMethodObj?.label}
              </span>
            </div>
          </div>

          <div style={{ height: 1, background: C.n200, margin: '12px 0' }} />

          {/* Total Refund */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
          }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>
              Total Refund
            </span>
            <span style={{
              fontFamily: 'Poppins',
              fontSize: 24,
              fontWeight: 800,
              color: C.primary,
            }}>
              {rp(refundAmount)}
            </span>
          </div>
        </div>

        {/* Detail Reason */}
        {(selectedReason === 'lainnya' && reasonDetail) && (
          <div style={{
            background: C.n50,
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginBottom: 4 }}>
              Detail Alasan:
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800 }}>
              {reasonDetail}
            </div>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div style={{
            background: '#f0f9ff',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#0369a1', marginBottom: 4 }}>
              Catatan:
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#0c4a6e' }}>
              {notes}
            </div>
          </div>
        )}

        {/* Warning Box */}
        <div style={{
          background: '#fef2f2',
          borderRadius: 12,
          padding: '14px 16px',
          border: '1px solid #fecaca',
        }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 13,
            fontWeight: 600,
            color: '#dc2626',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <AlertTriangle size={18} />
            Perhatian
          </div>
          <ul style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            color: '#991b1b',
            margin: 0,
            paddingLeft: 20,
            lineHeight: 1.7,
          }}>
            <li>Pengajuan refund akan dikirim untuk persetujuan</li>
            <li>Refund akan diproses setelah disetujui oleh Admin</li>
            <li>Dana akan dikembalikan sesuai metode yang dipilih</li>
          </ul>
        </div>
      </div>
    );
  };

  // ─── Main Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.n50 }}>
      {/* Top Bar */}
      <TopBar
        title="Ajukan Refund"
        left={step > 1 ? (
          <button
            onClick={handleBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={20} color={C.n700} />
          </button>
        ) : undefined}
      />

      {/* Content */}
      <div style={{ padding: isMobile ? 10 : 12, paddingBottom: isMobile ? 140 : 100 }}>
        {/* Progress Steps */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 4 : 8,
          marginBottom: isMobile ? 16 : 24,
          overflowX: 'auto',
        }}>
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div style={{
                flex: s < 3 ? 1 : 'none',
                height: 4,
                borderRadius: 2,
                background: s <= step ? C.primary : C.n200,
                transition: 'background 0.2s',
              }} />
            </React.Fragment>
          ))}
        </div>

        {/* Step Labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          {[
            { num: 1, label: 'Alasan' },
            { num: 2, label: 'Nominal' },
            { num: 3, label: 'Konfirmasi' },
          ].map((item) => (
            <div
              key={item.num}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                background: step >= item.num ? C.primary : C.n200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: step >= item.num ? 'white' : C.n500,
              }}>
                {step > item.num ? <Check size={12} /> : item.num}
              </div>
              <span style={{
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: step === item.num ? 600 : 400,
                color: step >= item.num ? C.primary : C.n400,
              }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '12px 14px',
            background: '#fef2f2',
            borderRadius: 10,
            border: '1px solid #fecaca',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <AlertTriangle size={18} color="#dc2626" />
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: '#dc2626' }}>
              {error}
            </span>
          </div>
        )}

        {/* Loading or Content */}
        {loading ? (
          <LoadingState message="Memuat detail transaksi..." />
        ) : (
          <>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </>
        )}
      </div>

      {/* Bottom Action */}
      {!loading && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: C.white,
          padding: '12px 16px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          borderTop: `1px solid ${C.n100}`,
          display: 'flex',
          gap: 10,
          zIndex: 100,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
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
              style={{ flex: step > 1 ? 2 : 1 }}
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
              Ajukan Refund
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}
