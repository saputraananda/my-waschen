// ─────────────────────────────────────────────────────────────────────────────
// RefundPage.jsx — Refund Request Form with Suggested Reasons
// Phase 1.2: Refund System
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, Fragment } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Input, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertConfirm } from '../../utils/alert';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../utils/hooks';
import { Check, AlertTriangle, ChevronRight, Loader2, CreditCard, Wallet, Banknote } from 'lucide-react';

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
    const styleId = 'refund-glass';
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

// ─── Suggested Refund Reasons ────────────────────────────────────────────────
const SUGGESTED_REASONS = [
  { id: 'customer_request', label: 'Permintaan Customer', icon: '🙋', description: 'Customer meminta refund', recommended: false },
  { id: 'produk_rusak', label: 'Produk Rusak / Cacat', icon: '💔', description: 'Item laundry rusak atau cacat', recommended: true },
  { id: 'salah_layanan', label: 'Salah Input Layanan', icon: '✏️', description: 'Kesalahan dalam input layanan', recommended: false },
  { id: 'tidak_sesuai', label: 'Tidak Sesuai Pesanan', icon: '📋', description: 'Hasil laundry tidak sesuai ekspektasi', recommended: false },
  { id: 'batal_order', label: 'Pelanggan Tidak Jadi', icon: '⏰', description: 'Customer batal sebelum laundry diproses', recommended: false },
  { id: 'item_tidak_ada', label: 'Item Tidak Ditemukan', icon: '📦', description: 'Item laundry tidak ditemukan di outlet', recommended: false },
  { id: 'kompensasi', label: 'Kompensasi / Diskon', icon: '🎁', description: 'Kompensasi karena kesalahan layanan', recommended: false },
  { id: 'double_charge', label: 'Double Charge', icon: '💳', description: 'Customer dikenakan biaya dua kali', recommended: false },
  { id: 'lainnya', label: 'Lainnya', icon: '📝', description: 'Alasan lain yang tidak tercantum', recommended: false },
];

// ─── Refund Methods ──────────────────────────────────────────────────────────
const REFUND_METHODS = [
  { value: 'deposit', label: 'Deposit / Saldo', icon: Wallet, color: C.primary, description: 'Langsung masuk ke saldo member', available: true },
  { value: 'cash', label: 'Tunai', icon: Banknote, color: C.success, description: 'Cash refund di outlet', available: false },
  { value: 'transfer', label: 'Transfer Bank', icon: CreditCard, color: '#0284c7', description: 'Transfer ke rekening customer', available: false },
];

// ─── Loading State ────────────────────────────────────────────────────────────
function LoadingState({ message = 'Memuat...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', gap: 12 }}>
      <Loader2 size={36} color={C.primary} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontFamily: "'Poppins'", fontSize: 13, color: C.n600 }}>{message}</span>
    </div>
  );
}

// ─── Reason Card ─────────────────────────────────────────────────────────────
function ReasonCard({ reason, selected, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(reason.id)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: selected ? `${C.primary}10` : C.white,
        border: `2px solid ${selected ? C.primary : C.n200}`,
        borderRadius: 14,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
    >
      {reason.recommended && (
        <div style={{
          position: 'absolute',
          top: -8,
          right: 12,
          background: C.success,
          color: 'white',
          fontSize: 9,
          fontFamily: "'Poppins'",
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 10,
        }}>
          Recommended
        </div>
      )}

      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: selected ? `${C.primary}15` : C.n100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
      }}>
        {reason.icon}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: selected ? C.primary : C.n900, marginBottom: 2 }}>
          {reason.label}
        </div>
        <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n500 }}>
          {reason.description}
        </div>
      </div>

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
    </motion.button>
  );
}

// ─── Method Card ─────────────────────────────────────────────────────────────
function MethodCard({ method, selected, onClick, disabled }) {
  const Icon = method.icon;
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={() => !disabled && onClick(method.value)}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px',
        background: disabled ? C.n50 : (selected ? `${method.color}10` : C.white),
        border: `2px solid ${selected ? method.color : 'transparent'}`,
        borderRadius: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: disabled ? C.n200 : `${method.color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={24} color={disabled ? C.n400 : method.color} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: disabled ? C.n400 : C.n900, marginBottom: 2 }}>
          {method.label}
        </div>
        <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: disabled ? C.n400 : C.n500 }}>
          {disabled ? 'Memerlukan approval admin' : method.description}
        </div>
      </div>

      {!disabled && <ChevronRight size={20} color={method.color} />}
    </motion.button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RefundPage({ navigate, goBack, screenParams }) {
  useGlassStyles();
  const { isMobile } = useResponsive();
  const transaction = screenParams?.transaction || screenParams || {};
  const { user } = useApp();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [selectedReason, setSelectedReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('deposit');
  const [notes, setNotes] = useState('');
  const [txDetail, setTxDetail] = useState(null);

  const txTotal = Number(transaction.total || txDetail?.total || 0);
  const paidAmount = Number(transaction.paidAmount || transaction.paid_amount || txDetail?.paidAmount || 0);
  const maxRefund = paidAmount;
  const [refundAmount, setRefundAmount] = useState(paidAmount);

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
      } catch {
        setError('Gagal memuat detail transaksi.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [transaction?.id, transaction?.transactionNo]);

  const handleReasonSelect = (reasonId) => {
    setSelectedReason(reasonId);
    if (reasonId !== 'lainnya') setReasonDetail('');
    setError('');
  };

  const canProceedStep1 = selectedReason && (selectedReason !== 'lainnya' || reasonDetail.trim().length >= 10);
  const canProceedStep2 = selectedMethod && refundAmount > 0 && refundAmount <= maxRefund;

  const handleNext = () => {
    if (step === 1 && canProceedStep1) setStep(2);
    else if (step === 2 && canProceedStep2) setStep(3);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
    } else {
      goBack?.();
    }
  };

  const handleSubmit = async () => {
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
      <ClayCard padding={20} style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 4 }}>
          Ajukan Refund
        </div>
        <div style={{ fontFamily: "'Poppins'", fontSize: 20, fontWeight: 700, color: C.n900 }}>
          {transaction.transactionNo || transaction.id || '-'}
        </div>
        <div style={{ fontFamily: "'Poppins'", fontSize: 13, color: C.n600, marginTop: 8 }}>
          {transaction.customerName || txDetail?.customerName || 'Customer'} · {rp(txTotal)}
        </div>
      </ClayCard>

      {/* Reason List */}
      <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: C.n800, marginBottom: 12 }}>
        Pilih Alasan Refund
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
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
      <AnimatePresence>
        {selectedReason === 'lainnya' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ClayCard padding={16} style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>
                Jelaskan Alasan *
              </div>
              <textarea
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                placeholder="Jelaskan secara detail alasan refund..."
                rows={3}
                style={{
                  width: '100%',
                  padding: 12,
                  fontFamily: "'Poppins'",
                  fontSize: 13,
                  border: `2px solid ${reasonDetail.length >= 10 ? C.success : C.n200}`,
                  borderRadius: 10,
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: C.n900,
                  background: C.white,
                }}
              />
              <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: reasonDetail.length >= 10 ? C.success : C.n400, marginTop: 6, textAlign: 'right' }}>
                {reasonDetail.length}/10 karakter minimum
              </div>
            </ClayCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>
          Catatan Tambahan (Opsional)
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tambahkan catatan jika diperlukan..."
          rows={2}
          style={{
            width: '100%',
            padding: 12,
            fontFamily: "'Poppins'",
            fontSize: 13,
            border: `2px solid ${C.n200}`,
            borderRadius: 10,
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            color: C.n900,
            background: C.white,
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
        <ClayCard padding={14} style={{ marginBottom: 16, background: `${C.primary}08`, border: `1px solid ${C.primary}20` }}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n600, marginBottom: 4 }}>
            Alasan yang Dipilih
          </div>
          <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: C.primary, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{selectedReasonObj?.icon}</span>
            <span>{selectedReasonObj?.label}</span>
          </div>
        </ClayCard>

        {/* Refund Amount */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 12 }}>
            Nominal Refund *
          </div>

          <ClayCard padding={20} style={{ marginBottom: 12, background: `${C.warning}08`, border: `1px solid ${C.warning}30` }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.warning, marginBottom: 4 }}>
              Nominal Refund
            </div>
            <div style={{ fontFamily: "'Poppins'", fontSize: 32, fontWeight: 800, color: C.warning }}>
              {rp(refundAmount)}
            </div>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.warning, marginTop: 6 }}>
              Maksimal: {rp(maxRefund)} (dari yang sudah dibayar)
            </div>
          </ClayCard>

          {/* Quick Amount Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[maxRefund, Math.round(maxRefund * 0.5), Math.round(maxRefund * 0.25)].map((amount, idx) => (
              <motion.button
                key={idx}
                whileTap={{ scale: 0.95 }}
                onClick={() => setRefundAmount(amount)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  border: `2px solid ${refundAmount === amount ? C.primary : C.n200}`,
                  background: refundAmount === amount ? `${C.primary}10` : C.white,
                  fontFamily: "'Poppins'",
                  fontSize: 12,
                  fontWeight: 600,
                  color: refundAmount === amount ? C.primary : C.n700,
                  cursor: 'pointer',
                }}
              >
                {idx === 0 ? 'Full' : idx === 1 ? '50%' : '25%'}
                <br />
                <span style={{ fontSize: 10, fontWeight: 400 }}>{rp(amount)}</span>
              </motion.button>
            ))}
          </div>

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
          <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 12 }}>
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

          <div style={{
            marginTop: 12,
            padding: '12px 14px',
            background: `${C.warning}08`,
            borderRadius: 10,
            border: `1px solid ${C.warning}30`,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <AlertTriangle size={18} color={C.warning} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n700, lineHeight: 1.5 }}>
              Metode <strong>Tunai</strong> dan <strong>Transfer</strong> memerlukan persetujuan Admin. Refund akan diproses setelah disetujui.
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
        <ClayCard padding={20} style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 16 }}>
            Ringkasan Refund
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.n600 }}>No. Transaksi</span>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n900 }}>
                {transaction.transactionNo || transaction.id}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.n600 }}>Customer</span>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n900 }}>
                {transaction.customerName || txDetail?.customerName || '-'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.n600 }}>Total Tagihan</span>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(txTotal)}</span>
            </div>
          </div>

          <div style={{ height: 1, background: C.n100, margin: '12px 0' }} />

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.n600 }}>Alasan</span>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 500, color: C.n900 }}>
                {selectedReasonObj?.icon} {selectedReasonObj?.label}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.n600 }}>Metode</span>
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 500, color: C.n900, display: 'flex', alignItems: 'center', gap: 4 }}>
                {Icon && <Icon size={14} color={selectedMethodObj?.color} />}
                {selectedMethodObj?.label}
              </span>
            </div>
          </div>

          <div style={{ height: 1, background: C.n100, margin: '12px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <span style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: C.n900 }}>Total Refund</span>
            <span style={{ fontFamily: "'Poppins'", fontSize: 24, fontWeight: 800, color: C.primary }}>
              {rp(refundAmount)}
            </span>
          </div>
        </ClayCard>

        {(selectedReason === 'lainnya' && reasonDetail) && (
          <ClayCard padding={14} style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n600, marginBottom: 4 }}>Detail Alasan:</div>
            <div style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.n800 }}>{reasonDetail}</div>
          </ClayCard>
        )}

        {notes && (
          <ClayCard padding={14} style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n600, marginBottom: 4 }}>Catatan:</div>
            <div style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.n800 }}>{notes}</div>
          </ClayCard>
        )}

        <ClayCard padding={16} style={{ background: `${C.danger}08`, border: `1px solid ${C.danger}20` }}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 600, color: C.danger, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} />
            Perhatian
          </div>
          <ul style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.n700, margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Pengajuan refund akan dikirim untuk persetujuan</li>
            <li>Refund akan diproses setelah disetujui oleh Admin</li>
            <li>Dana akan dikembalikan sesuai metode yang dipilih</li>
          </ul>
        </ClayCard>
      </div>
    );
  };

  // ─── Main Render ────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--glass-bg, #F3EEF7)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <TopBar
        title="Ajukan Refund"
        onBack={handleBack}
      />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? 12 : 16,
        paddingBottom: isMobile ? 140 : 100,
      }}>
        {/* Progress Steps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8, marginBottom: isMobile ? 16 : 24 }}>
          {[1, 2, 3].map((s) => (
            <Fragment key={s}>
              <div style={{
                flex: s < 3 ? 1 : 'none',
                height: 4,
                borderRadius: 2,
                background: s <= step ? C.primary : C.n200,
                transition: 'background 0.2s',
              }} />
            </Fragment>
          ))}
        </div>

        {/* Step Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          {[{ num: 1, label: 'Alasan' }, { num: 2, label: 'Nominal' }, { num: 3, label: 'Konfirmasi' }].map((item) => (
            <div key={item.num} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                fontFamily: "'Poppins'",
              }}>
                {step > item.num ? <Check size={12} /> : item.num}
              </div>
              <span style={{
                fontFamily: "'Poppins'",
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
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                padding: '12px 14px',
                background: `${C.danger}10`,
                borderRadius: 10,
                border: `1px solid ${C.danger}30`,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <AlertTriangle size={18} color={C.danger} />
              <span style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.danger }}>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
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
          borderTop: `1px solid ${C.n200}`,
          display: 'flex',
          gap: 10,
          zIndex: 100,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
        }}>
          {step > 1 && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleBack}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                border: `1.5px solid ${C.n200}`,
                background: C.white,
                fontFamily: "'Poppins'",
                fontSize: 14,
                fontWeight: 600,
                color: C.n700,
                cursor: 'pointer',
              }}
            >
              Kembali
            </motion.button>
          )}
          {step < 3 ? (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleNext}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              style={{
                flex: step > 1 ? 2 : 1,
                height: 48,
                borderRadius: 14,
                border: 'none',
                background: (step === 1 ? canProceedStep1 : canProceedStep2)
                  ? `linear-gradient(145deg, ${C.primary}, ${C.primaryDark})`
                  : C.n300,
                fontFamily: "'Poppins'",
                fontSize: 14,
                fontWeight: 600,
                color: C.white,
                cursor: (step === 1 ? canProceedStep1 : canProceedStep2) ? 'pointer' : 'not-allowed',
              }}
            >
              Lanjut
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                border: 'none',
                background: submitting ? C.n300 : `linear-gradient(145deg, ${C.danger}, ${C.dangerDark})`,
                fontFamily: "'Poppins'",
                fontSize: 14,
                fontWeight: 600,
                color: C.white,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Memproses...' : 'Ajukan Refund'}
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}
