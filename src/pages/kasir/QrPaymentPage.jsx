// ─────────────────────────────────────────────────────────────────────────────
// QrPaymentPage — tampilkan QR / VA / deeplink dari Midtrans
// ─────────────────────────────────────────────────────────────────────────────
// Prinsip:
//   - Notifikasi INSTANT via SSE (payment:settled) saat webhook Midtrans masuk
//   - Polling tiap 2 detik sebagai fallback kalau SSE/webhook delay
//   - Tombol "Cek Status" hanya fallback darurat setelah > 45 detik
//   - UI hanya ditampilkan "LUNAS" kalau payment_status === 'paid' atau settlement
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useRef, useCallback } from 'react';
import { TopBar, Btn } from '../../components/ui';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import {
  getPaymentStatus, syncPaymentStatus, cancelPayment, chargePayment,
} from '../../utils/paymentApi';
import { useRealtime } from '../../utils/realtime';
import { hapticSuccess } from '../../utils/haptic';
import { alertSuccess, alertWarning, alertError } from '../../utils/alert';

const POLL_INTERVAL_MS = 2_000;
const MANUAL_SYNC_VISIBLE_AFTER_MS = 45_000;
const MANUAL_SYNC_COOLDOWN_MS = 10_000;

const CHANNEL_LABELS = {
  qris: 'QRIS',
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  bca_va: 'Virtual Account BCA',
  bni_va: 'Virtual Account BNI',
  bri_va: 'Virtual Account BRI',
  permata_va: 'Virtual Account Permata',
  mandiri_va: 'Mandiri Bill Payment',
};

const fmtRemaining = (sec) => {
  if (sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Status final yang dianggap "LUNAS" — sesuai aturan compare prompt
function isPaidStatus({ payment_status, gateway_status }) {
  if (payment_status === 'paid') return true;
  const gs = String(gateway_status || '').toLowerCase();
  if (gs === 'settlement' || gs === 'capture') return true;
  return false;
}

// Status final non-paid (jangan polling lagi)
function isTerminalNonPaid(gateway_status) {
  const gs = String(gateway_status || '').toLowerCase();
  return ['expire', 'cancel', 'deny', 'failure'].includes(gs);
}

export default function QrPaymentPage({ navigate, goBack, screenParams }) {
  const initialParams = screenParams || {};
  // State channel-specific outputs (bisa di-update saat regenerate QR)
  const [channelData, setChannelData] = useState({
    paymentItemId: initialParams.paymentItemId,
    orderId: initialParams.orderId,
    channel: initialParams.channel || 'qris',
    qrImageUrl: initialParams.qrImageUrl,
    qrString: initialParams.qrString,
    vaNumber: initialParams.vaNumber,
    billerCode: initialParams.billerCode,
    deeplinkUrl: initialParams.deeplinkUrl,
    expiresAt: initialParams.expiresAt,
  });

  const { transactionId, customerName } = initialParams;
  const amount = Number(initialParams.amount || 0);

  // Status state
  const [payment_status, setPaymentStatus] = useState('unpaid');
  const [gateway_status, setGatewayStatus] = useState('pending');
  const [paid_amount, setPaidAmount] = useState(0);
  const [total, setTotal] = useState(amount);

  // UI state
  const [polling, setPolling] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!channelData.expiresAt) return 15 * 60;
    return Math.max(0, Math.floor((new Date(channelData.expiresAt).getTime() - Date.now()) / 1000));
  });
  const [pollingStartedAt] = useState(() => Date.now());
  const [manualSyncCooldownUntil, setManualSyncCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [regenerating, setRegenerating] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);

  const pollRef = useRef(null);
  const tickRef = useRef(null);
  const paidHandledRef = useRef(false);
  const orderIdRef = useRef(channelData.orderId);
  const transactionIdRef = useRef(transactionId);

  orderIdRef.current = channelData.orderId;
  transactionIdRef.current = transactionId;

  const isExpired = secondsLeft <= 0 || gateway_status === 'expire';
  const isPaid = isPaidStatus({ payment_status, gateway_status });
  const isTerminal = isExpired || isPaid || isTerminalNonPaid(gateway_status);

  const markAsPaid = useCallback((source = 'poll') => {
    if (paidHandledRef.current) return;
    paidHandledRef.current = true;
    setPolling(false);
    setPaymentStatus('paid');
    setGatewayStatus('settlement');
    hapticSuccess();
    alertSuccess(
      source === 'realtime'
        ? 'Pembayaran Midtrans diterima otomatis!'
        : 'Pembayaran diterima!',
      { title: 'Lunas ✅' }
    );
    setTimeout(() => {
      if (transactionIdRef.current) {
        navigate('detail_transaksi', { id: transactionIdRef.current }, { replace: true });
      } else {
        goBack?.();
      }
    }, 1200);
  }, [navigate, goBack]);

  const matchesPaymentEvent = useCallback((payload) => {
    if (!payload) return false;
    const p = payload.data || payload;
    if (p.orderId && p.orderId === orderIdRef.current) return true;
    const txId = transactionIdRef.current;
    if (!txId) return false;
    if (p.transactionId != null && String(p.transactionId) === String(txId)) return true;
    if (p.transactionNo && String(p.transactionNo) === String(txId)) return true;
    return false;
  }, []);

  // ── Realtime SSE — notifikasi instant saat webhook Midtrans masuk ─────────
  useRealtime('payment:settled', useCallback((evt) => {
    if (paidHandledRef.current) return;
    if (!matchesPaymentEvent(evt)) return;
    markAsPaid('realtime');
  }, [matchesPaymentEvent, markAsPaid]));

  // ── Polling fallback (2 detik) ───────────────────────────────────────────
  const pollOnce = useCallback(async () => {
    if (!channelData.orderId || paidHandledRef.current) return;
    try {
      const data = await getPaymentStatus(channelData.orderId);
      if (!data) return;
      setPaymentStatus(data.payment_status || 'unpaid');
      setGatewayStatus(data.gateway_status || 'pending');
      setPaidAmount(Number(data.paid_amount || 0));
      setTotal(Number(data.total || amount));

      if (isPaidStatus({ payment_status: data.payment_status, gateway_status: data.gateway_status })) {
        markAsPaid('poll');
      } else if (isTerminalNonPaid(data.gateway_status)) {
        setPolling(false);
      }
    } catch (err) {
      console.error('[QrPayment] poll error:', err?.message);
    }
  }, [channelData.orderId, amount, markAsPaid]);

  useEffect(() => {
    if (!polling || isTerminal) return;
    pollOnce(); // immediate first poll
    pollRef.current = setInterval(pollOnce, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [polling, isTerminal, pollOnce]);

  // ── Countdown & "now" ticker (1 detik) ──────────────────────────────────
  useEffect(() => {
    if (isTerminal) return;
    tickRef.current = setInterval(() => {
      setNow(Date.now());
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [isTerminal]);

  // Stop polling kalau expired
  useEffect(() => {
    if (isExpired && polling) {
      setPolling(false);
    }
  }, [isExpired, polling]);

  // ── Tombol "Cek Status" — visible setelah 30 detik, cooldown 10 detik ─
  const elapsedMs = now - pollingStartedAt;
  const showManualSync = !isTerminal && elapsedMs > MANUAL_SYNC_VISIBLE_AFTER_MS;
  const cooldownLeft = Math.max(0, manualSyncCooldownUntil - now);
  const canClickSync = showManualSync && cooldownLeft === 0 && !manualSyncing;

  const handleManualSync = async () => {
    if (!canClickSync) return;
    setManualSyncing(true);
    setManualSyncCooldownUntil(Date.now() + MANUAL_SYNC_COOLDOWN_MS);
    try {
      const data = await syncPaymentStatus(channelData.orderId);
      await pollOnce();
      if (data?.internal_status === 'settlement' || paidHandledRef.current) {
        if (!paidHandledRef.current) markAsPaid('sync');
      } else {
        alertWarning(`Status: ${data?.gateway_status || 'pending'} — pembayaran belum diterima.`);
      }
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal cek status.');
    } finally {
      setManualSyncing(false);
    }
  };

  // ── Tombol "Buat Ulang QR" — saat expired ───────────────────────────────
  const handleRegenerate = async () => {
    if (!transactionId || !channelData.channel) {
      alertError('Data transaksi tidak lengkap untuk regenerate.');
      return;
    }
    setRegenerating(true);
    try {
      const data = await chargePayment({
        transactionId,
        channel: channelData.channel,
        amount,
      });
      if (!data) throw new Error('Tidak ada data dari server.');

      // Update state dengan QR baru
      setChannelData({
        paymentItemId: data.paymentItemId,
        orderId: data.orderId,
        channel: data.channel,
        qrImageUrl: data.qrImageUrl,
        qrString: data.qrString,
        vaNumber: data.vaNumber,
        billerCode: data.billerCode,
        deeplinkUrl: data.deeplinkUrl,
        expiresAt: data.expiresAt,
      });

      // Reset countdown & status
      const newSec = data.expiresAt
        ? Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000))
        : 15 * 60;
      setSecondsLeft(newSec);
      setPaymentStatus('unpaid');
      setGatewayStatus('pending');
      setPolling(true);
      alertSuccess('QR baru berhasil dibuat. Silakan scan ulang.');
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal buat ulang QR.');
    } finally {
      setRegenerating(false);
    }
  };

  // Saat user click "Tutup", coba sync sekali — kalau ternyata sudah lunas
  // tapi webhook belum nyampe, langsung reflect di transaksi.
  const handleClose = async () => {
    if (isPaid || isExpired || isTerminalNonPaid(gateway_status)) {
      goBack?.();
      return;
    }
    try {
      const data = await syncPaymentStatus(channelData.orderId);
      if (data?.internal_status === 'settlement') {
        await alertSuccess('Pembayaran ternyata sudah masuk ✅');
        if (transactionId) navigate('detail_transaksi', { id: transactionId }, { replace: true });
        else goBack?.();
        return;
      }
    } catch { /* silent — tetap tutup */ }
    goBack?.();
  };

  const handleCancel = async () => {
    const { alertConfirm } = await import('../../utils/alert');
    const ok = await alertConfirm(
      'Pembayaran yang sudah masuk tidak akan terhapus dari sistem. Customer perlu refund manual kalau sudah bayar.',
      {
        title: 'Batalkan Pembayaran?',
        confirmText: 'Ya, Batalkan',
        cancelText: 'Tidak',
        icon: 'warning',
      }
    );
    if (!ok) return;
    try {
      await cancelPayment(channelData.orderId);
      await alertWarning('Pembayaran berhasil dibatalkan.');
      goBack?.();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal membatalkan pembayaran.');
    }
  };

  const isVA = channelData.channel?.endsWith('_va');
  const isQRIS = channelData.channel === 'qris';
  const isEwallet = channelData.channel === 'gopay' || channelData.channel === 'shopeepay';

  // Status banner config
  const banner = isPaid
    ? { icon: '✅', label: 'Pembayaran Lunas', bg: '#DCFCE7' }
    : isExpired
    ? { icon: '⏰', label: 'QR Kedaluwarsa', bg: '#FEE2E2' }
    : isTerminalNonPaid(gateway_status)
    ? { icon: '❌', label: gateway_status === 'cancel' ? 'Pembayaran Dibatalkan' : 'Pembayaran Gagal', bg: '#FEE2E2' }
    : { icon: '⏳', label: 'Menunggu Pembayaran', bg: 'linear-gradient(135deg, #FEF3C7, #FDE68A)' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Menunggu Pembayaran" subtitle={CHANNEL_LABELS[channelData.channel] || channelData.channel} onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {/* Status banner */}
        <div style={{
          background: banner.bg,
          borderRadius: 14, padding: '12px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 22,
            background: 'rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>{banner.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>
              {banner.label}
            </div>
            {!isTerminal && (
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginTop: 2 }}>
                Sisa waktu: <strong>{fmtRemaining(secondsLeft)}</strong>
                {polling && (
                  <span style={{ color: '#15803D', marginLeft: 8 }}>● Menunggu otomatis</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Amount */}
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, fontWeight: 600 }}>TOTAL TAGIHAN</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 26, fontWeight: 800, color: C.primary, marginTop: 2 }}>{rp(amount)}</div>
          {paid_amount > 0 && paid_amount < total && (
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#15803D', marginTop: 4 }}>
              Sudah dibayar: {rp(paid_amount)} / {rp(total)}
            </div>
          )}
          {customerName && (
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 4 }}>
              👤 {customerName}
            </div>
          )}
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n400, marginTop: 4 }}>
            Order ID: {channelData.orderId}
          </div>
        </div>

        {/* QR / E-wallet — selalu tampilkan QR kalau ada */}
        {(isQRIS || isEwallet) && channelData.qrImageUrl && !isExpired && (
          <div style={{ background: 'white', borderRadius: 14, padding: 18, marginBottom: 14, textAlign: 'center', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, marginBottom: 4 }}>
              {isQRIS ? 'SCAN QR DENGAN APLIKASI E-WALLET / MOBILE BANKING' : `MINTA CUSTOMER SCAN QR INI DENGAN APLIKASI ${CHANNEL_LABELS[channelData.channel]?.toUpperCase()}`}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginBottom: 12 }}>
              📱 Tunjukkan layar ini ke customer — bukan kasir yang scan
            </div>
            <img src={channelData.qrImageUrl} alt="QR Code" style={{ width: 240, height: 240, objectFit: 'contain', margin: '0 auto', display: 'block', border: `1px solid ${C.n100}`, borderRadius: 8 }} />
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 12 }}>
              Notifikasi lunas otomatis — tidak perlu cek manual
            </div>
          </div>
        )}

        {/* E-wallet tanpa QR (rare case) — tampilkan info instruksi */}
        {isEwallet && !channelData.qrImageUrl && !isExpired && (
          <div style={{
            background: '#FEF3C7', borderRadius: 12, padding: '14px 16px', marginBottom: 14,
            border: '1px solid #FCD34D',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
              ⚠️ QR {CHANNEL_LABELS[channelData.channel]} tidak tersedia
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#78350F', lineHeight: 1.5 }}>
              Gateway tidak return QR untuk channel ini. Sarankan customer pakai <strong>QRIS</strong> agar bisa scan langsung.
              Klik "Batalkan" lalu pilih ulang dengan QRIS.
            </div>
          </div>
        )}

        {isVA && channelData.vaNumber && !isExpired && (
          <div style={{ background: 'white', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, marginBottom: 8 }}>
              NOMOR VIRTUAL ACCOUNT
            </div>
            <div style={{
              background: C.n50, borderRadius: 10, padding: '12px 14px',
              fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: C.n900,
              letterSpacing: 1, textAlign: 'center',
            }}>{channelData.vaNumber}</div>
            {channelData.billerCode && (
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 8 }}>
                Biller Code: <strong>{channelData.billerCode}</strong>
              </div>
            )}
            <button
              onClick={() => { navigator.clipboard?.writeText(channelData.vaNumber); alertSuccess('Nomor VA disalin'); }}
              style={{
                marginTop: 10, width: '100%', padding: 10, borderRadius: 10,
                border: `1.5px solid ${C.primary}`, background: 'white',
                color: C.primary, fontFamily: 'Poppins', fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
              }}
            >📋 Salin Nomor VA</button>
          </div>
        )}

        {/* Fallback manual sync — hanya muncul kalau otomatis belum konfirmasi */}
        {showManualSync && !isPaid && (
          <button
            onClick={handleManualSync}
            disabled={!canClickSync}
            style={{
              width: '100%', padding: '12px',
              border: `1.5px solid ${canClickSync ? C.n300 : C.n200}`,
              background: C.n50,
              color: C.n600,
              borderRadius: 12,
              fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
              cursor: canClickSync ? 'pointer' : 'not-allowed',
              marginBottom: 10,
            }}
          >
            {manualSyncing
              ? '⏳ Mengecek ke Midtrans...'
              : cooldownLeft > 0
              ? `Tunggu ${Math.ceil(cooldownLeft / 1000)}s`
              : '🔄 Pembayaran belum masuk? Cek manual ke Midtrans'}
          </button>
        )}

        {/* QR Expired — tombol regenerate */}
        {isExpired && !isPaid && (
          <div style={{
            background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 14,
            boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
            border: '1px solid #FECACA',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 6 }}>
              ⏰ QR sudah kedaluwarsa
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginBottom: 12, lineHeight: 1.5 }}>
              QR Midtrans hanya berlaku 15 menit. Klik tombol di bawah untuk buat QR baru dengan order ID berbeda.
            </div>
            <Btn
              variant="primary"
              onClick={handleRegenerate}
              loading={regenerating}
              fullWidth
            >
              🔄 Buat Ulang QR
            </Btn>
          </div>
        )}

        {/* Action buttons */}
        {!isTerminal && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Btn variant="secondary" onClick={handleCancel} style={{ flex: 1 }}>Batalkan</Btn>
            <Btn variant="primary" onClick={handleClose} style={{ flex: 1 }}>Tutup</Btn>
          </div>
        )}

        {!isExpired && !isPaid && isTerminalNonPaid(gateway_status) && (
          <Btn variant="primary" onClick={() => goBack?.()} fullWidth>Kembali</Btn>
        )}

        {isPaid && (
          <Btn variant="success" onClick={() => transactionId ? navigate('detail_transaksi', { id: transactionId }, { replace: true }) : goBack?.()} fullWidth>
            Lihat Detail Transaksi
          </Btn>
        )}
      </div>
    </div>
  );
}
