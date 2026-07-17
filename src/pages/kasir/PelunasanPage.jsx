// ─────────────────────────────────────────────────────────────────────────────
// PelunasanPage — flow lunas saat customer ambil cucian
// Konsep: LUNAS FULL dengan grouped picker
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar, Btn, Input, MoneyInput } from '../../components/ui';
import { IconCheck, IconWarning, IconClock, IconPerson, IconClose } from '../../components/ui/StatusIcons';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { alertSuccess, alertError } from '../../utils/alert';
import PaymentMethodGrouped from '../../components/PaymentMethodGrouped';
import { useResponsive } from '../../utils/hooks';

// ─── Clay Card ────────────────────────────────────────────────────────────────
const ClayCard = ({ children, style, padding = 16 }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
      borderRadius: 16,
      padding: padding,
      boxShadow: '8px 8px 20px rgba(110, 46, 120, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.95)',
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
    const styleId = 'pelunasan-glass';
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

export default function PelunasanPage({ navigate, goBack, screenParams }) {
  useGlassStyles();
  const { isMobile } = useResponsive();
  const txId = screenParams?.id || screenParams?.transactionId;
  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedMethod, setSelectedMethod] = useState(null);
  const [cashReceived, setCashReceived] = useState('');
  const [transferRef, setTransferRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTx = useCallback(async () => {
    if (!txId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`/api/transactions/${encodeURIComponent(txId)}`);
      const data = res?.data?.data;
      if (!data) {
        setError('Transaksi tidak ditemukan.');
        return;
      }
      setTx(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat transaksi.');
    } finally {
      setLoading(false);
    }
  }, [txId]);

  useEffect(() => { fetchTx(); }, [fetchTx]);

  const total = Number(tx?.total || 0);
  const paid = Number(tx?.paidAmount || 0);
  const balanceDue = Math.max(0, total - paid);
  const isFullyPaid = paid >= total && total > 0;

  useEffect(() => {
    if (selectedMethod === 'cash' && balanceDue > 0 && !cashReceived) {
      setCashReceived(String(balanceDue));
    }
  }, [selectedMethod, balanceDue, cashReceived]);

  const change = useMemo(() => {
    if (selectedMethod !== 'cash') return 0;
    const tender = Number(cashReceived || 0);
    return Math.max(0, tender - balanceDue);
  }, [selectedMethod, cashReceived, balanceDue]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (balanceDue <= 0) return false;
    if (!selectedMethod) return false;
    if (selectedMethod === 'cash') {
      return Number(cashReceived || 0) >= balanceDue;
    }
    if (selectedMethod === 'transfer' && !transferRef.trim()) return false;
    return true;
  }, [submitting, balanceDue, selectedMethod, cashReceived, transferRef]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await axios.post(`/api/transactions/${tx.id}/payments`, {
        method: selectedMethod,
        payAmount: balanceDue,
        cashReceived: selectedMethod === 'cash' ? Number(cashReceived) : null,
        paymentRef: selectedMethod === 'transfer' ? transferRef.trim() : null,
      });

      await alertSuccess('Pembayaran lunas! Customer bisa ambil cucian.');
      navigate('detail_transaksi', { id: tx.id }, { replace: true });
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal proses pembayaran.');
    } finally {
      setSubmitting(false);
    }
  };

  const depositBalance = Number(tx?.customerDeposit ?? tx?.depositBalance ?? 0);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)' }}>
        <TopBar title="Pelunasan" onBack={goBack} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Poppins'", color: C.n700 }}>
          Memuat data transaksi…
        </div>
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)' }}>
        <TopBar title="Pelunasan" onBack={goBack} />
        <div style={{ padding: 30, fontFamily: "'Poppins'", color: C.danger, textAlign: 'center' }}>
          {error || 'Transaksi tidak ditemukan.'}
        </div>
        <div style={{ padding: 16 }}>
          <Btn variant="secondary" onClick={goBack} fullWidth>Kembali</Btn>
        </div>
      </div>
    );
  }

  if (isFullyPaid) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)' }}>
        <TopBar title="Sudah Lunas" onBack={goBack} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <ClayCard padding={32} style={{ textAlign: 'center', maxWidth: 320, width: '100%' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 36,
                background: C.success + '20',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconCheck size={40} color={C.success} />
              </div>
            </div>
            <div style={{ fontFamily: "'Poppins'", fontSize: 16, fontWeight: 700, color: C.n900, marginBottom: 8 }}>
              Tagihan sudah lunas
            </div>
            <div style={{ fontFamily: "'Poppins'", fontSize: 13, color: C.n600, marginBottom: 20 }}>
              {tx.transactionNo} · {rp(total)}
            </div>
            <Btn variant="primary" onClick={() => navigate('detail_transaksi', { id: tx.id })} fullWidth>
              Lihat Detail
            </Btn>
          </ClayCard>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--glass-bg)',
      overflow: 'hidden',
    }}>
      <TopBar title="Pelunasan" subtitle={tx.transactionNo} onBack={goBack} />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? 12 : 16,
        paddingBottom: isMobile ? 100 : 16,
      }}>
        {/* Hero summary */}
        <div style={{
          background: `linear-gradient(145deg, ${C.primary}, ${C.primaryDark})`,
          borderRadius: 20,
          padding: '18px 20px',
          marginBottom: 14,
          color: 'white',
        }}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 11, opacity: 0.85, fontWeight: 600 }}>
            HARUS DIBAYAR
          </div>
          <div style={{ fontFamily: "'Poppins'", fontSize: 32, fontWeight: 800, marginTop: 4 }}>
            {rp(balanceDue)}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Poppins'", fontSize: 10, opacity: 0.8 }}>Total tagihan</div>
              <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600 }}>{rp(total)}</div>
            </div>
            {paid > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Poppins'", fontSize: 10, opacity: 0.8 }}>Sudah dibayar</div>
                <div style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600 }}>{rp(paid)}</div>
              </div>
            )}
          </div>
          {tx.customerName && (
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, marginTop: 12, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconPerson size={14} color="white" />
              {tx.customerName}{tx.customerPhone && ` · ${tx.customerPhone}`}
            </div>
          )}
        </div>

        {/* Method picker */}
        <ClayCard padding={16} style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 12 }}>
            Pilih Metode Pembayaran
          </div>
          <PaymentMethodGrouped
            value={selectedMethod}
            onChange={setSelectedMethod}
            showDeposit={depositBalance > 0}
            depositBalance={depositBalance}
            amount={balanceDue}
          />
        </ClayCard>

        {/* Channel-specific input */}
        <AnimatePresence mode="wait">
          {selectedMethod === 'cash' && (
            <motion.div
              key="cash"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ClayCard padding={16} style={{ marginBottom: 12 }}>
                <MoneyInput
                  label="Uang diterima dari customer"
                  value={cashReceived}
                  onChange={setCashReceived}
                  placeholder={Number(balanceDue).toLocaleString('id-ID')}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: -8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[balanceDue, balanceDue + 5_000, balanceDue + 10_000, 50_000, 100_000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((amt) => (
                    <motion.button
                      key={amt}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCashReceived(String(amt))}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 999,
                        border: `1px solid ${C.n200}`,
                        background: C.white,
                        fontFamily: "'Poppins'",
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.n700,
                        cursor: 'pointer',
                      }}
                    >
                      {rp(amt)}
                    </motion.button>
                  ))}
                </div>
                {Number(cashReceived) >= balanceDue && (
                  <div style={{
                    background: C.success + '15',
                    borderRadius: 10,
                    padding: '12px 14px',
                    fontFamily: "'Poppins'",
                    fontSize: 13,
                    color: C.success,
                    fontWeight: 600,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: `1px solid ${C.success}30`,
                  }}>
                    <span>Kembalian:</span>
                    <span style={{ fontSize: 18 }}>{rp(change)}</span>
                  </div>
                )}
                {Number(cashReceived) > 0 && Number(cashReceived) < balanceDue && (
                  <div style={{
                    background: C.danger + '10',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontFamily: "'Poppins'",
                    fontSize: 11,
                    color: C.danger,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 8,
                    border: `1px solid ${C.danger}20`,
                  }}>
                    <IconWarning size={14} color={C.danger} />
                    Kurang {rp(balanceDue - Number(cashReceived))}. Tagihan harus dibayar lunas.
                  </div>
                )}
              </ClayCard>
            </motion.div>
          )}

          {selectedMethod === 'transfer' && (
            <motion.div
              key="transfer"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ClayCard padding={16} style={{ marginBottom: 12 }}>
                <Input
                  label="Bukti / Referensi Transfer"
                  value={transferRef}
                  onChange={setTransferRef}
                  placeholder="Mis. BCA 22/11 14:30 — Andi"
                />
                <div style={{
                  fontFamily: "'Poppins'",
                  fontSize: 10,
                  color: C.n600,
                  background: C.warning + '10',
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginTop: 8,
                  border: `1px solid ${C.warning}20`,
                }}>
                  Pembayaran transfer akan diverifikasi finance sebelum customer bisa ambil cucian.
                </div>
              </ClayCard>
            </motion.div>
          )}
        </AnimatePresence>

        {selectedMethod === 'deposit' && depositBalance < balanceDue && (
          <ClayCard padding={14} style={{ marginBottom: 12 }}>
            <div style={{
              fontFamily: "'Poppins'",
              fontSize: 11,
              color: C.danger,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <IconClose size={14} color={C.danger} />
              Saldo deposit tidak cukup. Saldo: {rp(depositBalance)}, butuh: {rp(balanceDue)}.
            </div>
          </ClayCard>
        )}
      </div>

      {/* Action button */}
      <div style={{
        position: isMobile ? 'fixed' : 'static',
        bottom: isMobile ? 0 : 'auto',
        left: isMobile ? 0 : 'auto',
        right: isMobile ? 0 : 'auto',
        width: isMobile ? '100%' : 'auto',
        padding: isMobile ? '12px 16px' : 0,
        background: isMobile ? C.white : 'transparent',
        borderTop: isMobile ? `1px solid ${C.n200}` : 'none',
        boxShadow: isMobile ? '0 -4px 12px rgba(0,0,0,0.08)' : 'none',
      }}>
        <motion.button
          whileTap={{ scale: canSubmit ? 0.98 : 1 }}
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 14,
            border: 'none',
            background: canSubmit
              ? `linear-gradient(145deg, ${C.primary}, ${C.primaryDark})`
              : C.n300,
            color: C.white,
            fontFamily: "'Poppins'",
            fontSize: 14,
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            boxShadow: canSubmit
              ? '-4px -4px 10px rgba(255, 255, 255, 0.4), 5px 6px 14px rgba(59, 11, 71, 0.35)'
              : 'none',
          }}
        >
          {selectedMethod ? `Lunasi ${rp(balanceDue)}` : 'Pilih metode pembayaran dulu'}
        </motion.button>
      </div>
    </div>
  );
}
