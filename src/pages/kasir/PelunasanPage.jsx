// ─────────────────────────────────────────────────────────────────────────────
// PelunasanPage — flow lunas saat customer ambil cucian
// ─────────────────────────────────────────────────────────────────────────────
// Konsep:
//   - Hanya 1 mode: LUNAS FULL (DP & split mixed dihapus)
//   - Pilih metode dari grouped picker (Tunai / QRIS / E-Wallet / VA)
//   - Cash: input nominal received → auto kembalian
//   - Transfer: input ref untuk verifikasi finance
//   - Deposit: cek saldo, auto-debit kalau cukup
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { TopBar, Btn, Input, MoneyInput } from '../../components/ui';
import { IconCheck, IconWarning, IconClock, IconPerson, IconClose } from '../../components/ui/StatusIcons';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { alertSuccess, alertError } from '../../utils/alert';
import PaymentMethodGrouped from '../../components/PaymentMethodGrouped';
import { useResponsive, useWindowSize } from '../../utils/hooks';

export default function PelunasanPage({ navigate, goBack, screenParams }) {
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

  // Pre-fill cash received dengan exact balanceDue
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
      // Record payment ke backend
      await axios.post(`/api/transactions/${tx.id}/payments`, {
        method: selectedMethod,
        payAmount: balanceDue,
        cashReceived: selectedMethod === 'cash' ? Number(cashReceived) : null,
        paymentRef: selectedMethod === 'transfer' ? transferRef.trim() : null,
      });

      await alertSuccess('Pembayaran lunas! 🎉 Customer bisa ambil cucian.');
      // Replace: jangan biarkan user back ke halaman pelunasan yang sudah selesai
      navigate('detail_transaksi', { id: tx.id }, { replace: true });
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal proses pembayaran.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
        <TopBar title="Pelunasan" onBack={goBack} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Poppins', color: C.n700 }}>
          Memuat data transaksi…
        </div>
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
        <TopBar title="Pelunasan" onBack={goBack} />
        <div style={{ padding: 30, fontFamily: 'Poppins', color: C.danger || '#DC2626', textAlign: 'center' }}>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
        <TopBar title="Sudah Lunas" onBack={goBack} />
        <div style={{ padding: 30, textAlign: 'center', fontFamily: 'Poppins' }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}><IconCheck size={60} color="#059669" /></div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.n900, marginBottom: 6 }}>Tagihan sudah lunas</div>
          <div style={{ fontSize: 13, color: C.n700, marginBottom: 20 }}>
            {tx.transactionNo} · {rp(total)}
          </div>
          <Btn variant="primary" onClick={() => navigate('detail_transaksi', { id: tx.id })} fullWidth>
            Lihat Detail
          </Btn>
        </div>
      </div>
    );
  }

  const depositBalance = Number(tx?.customerDeposit ?? tx?.depositBalance ?? 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Pelunasan" subtitle={tx.transactionNo} onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 10 : 12, paddingBottom: isMobile ? 'calc(12px + env(safe-area-inset-bottom) + 80px)' : 12 }}>
        {/* Hero summary */}
        <div style={{
          background: 'linear-gradient(135deg, #4F46E5, #6e2e78)',
          borderRadius: 16, padding: '18px 20px', marginBottom: 14,
          color: 'white',
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, opacity: 0.85, fontWeight: 600, letterSpacing: 0.4 }}>
            HARUS DIBAYAR
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 32, fontWeight: 800, marginTop: 4 }}>
            {rp(balanceDue)}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.8 }}>Total tagihan</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600 }}>{rp(total)}</div>
            </div>
            {paid > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.8 }}>Sudah dibayar</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600 }}>{rp(paid)}</div>
              </div>
            )}
          </div>
          {tx.customerName && (
            <div style={{ fontFamily: 'Poppins', fontSize: 11, marginTop: 12, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconPerson size={14} color="white" /> {tx.customerName}{tx.customerPhone && ` · ${tx.customerPhone}`}
            </div>
          )}
        </div>

        {/* Method picker — grouped */}
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Pilih Metode Pembayaran
          </div>
          <PaymentMethodGrouped
            value={selectedMethod}
            onChange={setSelectedMethod}
            showDeposit={depositBalance > 0}
            depositBalance={depositBalance}
            amount={balanceDue}
          />
        </div>

        {/* Channel-specific input */}
        {selectedMethod === 'cash' && (
          <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: SHADOW.sm }}>
            <MoneyInput
              label="Uang diterima dari customer"
              value={cashReceived}
              onChange={setCashReceived}
              placeholder={Number(balanceDue).toLocaleString('id-ID')}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: -8, marginBottom: 12, flexWrap: 'wrap' }}>
              {[balanceDue, balanceDue + 5_000, balanceDue + 10_000, 50_000, 100_000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((amt) => (
                <button
                  key={amt}
                  onClick={() => setCashReceived(String(amt))}
                  style={{
                    padding: '5px 10px', borderRadius: 999,
                    border: `1px solid ${C.n200}`, background: 'white',
                    fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700,
                    cursor: 'pointer',
                  }}
                >
                  {rp(amt)}
                </button>
              ))}
            </div>
            {Number(cashReceived) >= balanceDue && (
              <div style={{
                background: C.successBg, borderRadius: 8, padding: '10px 12px',
                fontFamily: 'Poppins', fontSize: 13, color: C.successDark, fontWeight: 600,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>Kembalian:</span>
                <span style={{ fontSize: 18 }}>{rp(change)}</span>
              </div>
            )}
            {Number(cashReceived) > 0 && Number(cashReceived) < balanceDue && (
              <div style={{
                background: C.validationErrorBg, borderRadius: 8, padding: '8px 12px',
                fontFamily: 'Poppins', fontSize: 11, color: C.validationErrorText,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <IconWarning size={14} color={C.validationErrorText} /> Kurang {rp(balanceDue - Number(cashReceived))}. Tagihan harus dibayar lunas.
              </div>
            )}
          </div>
        )}

        {selectedMethod === 'transfer' && (
          <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: SHADOW.sm }}>
            <Input
              label="Bukti / Referensi Transfer"
              value={transferRef}
              onChange={setTransferRef}
              placeholder="Mis. BCA 22/11 14:30 — Andi"
            />
            <div style={{
              fontFamily: 'Poppins', fontSize: 10, color: C.n700,
              background: C.validationWarningBg, padding: '8px 10px', borderRadius: 6,
              border: `1px solid ${C.warningBg}`,
            }}>
              💡 Pembayaran transfer akan diverifikasi finance sebelum customer bisa ambil cucian.
            </div>
          </div>
        )}

        {selectedMethod === 'deposit' && depositBalance < balanceDue && (
          <div style={{ background: C.validationErrorBg, borderRadius: 12, padding: 14, marginBottom: 14, fontFamily: 'Poppins', fontSize: 11, color: C.validationErrorText, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconClose size={14} color={C.validationErrorText} /> Saldo deposit tidak cukup. Saldo: {rp(depositBalance)}, butuh: {rp(balanceDue)}.
          </div>
        )}

        {/* Action button */}
        <div style={{ position: isMobile ? 'fixed' : 'static', bottom: isMobile ? 0 : 'auto', left: isMobile ? 0 : 'auto', right: isMobile ? 0 : 'auto', width: isMobile ? '100%' : 'auto', padding: isMobile ? '12px 16px' : 0, paddingBottom: isMobile ? 'calc(12px + env(safe-area-inset-bottom))' : 0, background: isMobile ? C.white : 'transparent', borderTop: isMobile ? `1px solid ${C.n100}` : 'none', zIndex: isMobile ? 100 : 'auto' }}>
          <Btn
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
            fullWidth
            style={{ height: isMobile ? 48 : 56, fontSize: isMobile ? 13 : 15, fontWeight: 800 }}
          >
            {selectedMethod ? `Lunasi ${rp(balanceDue)}` : 'Pilih metode pembayaran dulu'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
