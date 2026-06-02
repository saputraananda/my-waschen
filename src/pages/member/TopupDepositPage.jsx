import { useState } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn } from '../../components/ui';
import { alertError, alertSuccess, alertWarning, alertInfo } from '../../utils/alert';
import { createTopupSnap, openSnapPopup, getPaymentStatus } from '../../utils/paymentApi';

const PRESETS = [50000, 100000, 200000, 500000];

const PAY_METHODS = [
  { key: 'cash',     label: '💵 Tunai',          desc: 'Customer bayar di kasir' },
  { key: 'transfer', label: '🏦 Transfer Manual', desc: 'Verifikasi manual oleh finance' },
  { key: 'qris',     label: '📱 QRIS Statis',     desc: 'QR cetak / EDC manual' },
  { key: 'midtrans', label: '⚡ Online (Midtrans)', desc: 'Snap link untuk QRIS, e-wallet, VA — share via WA' },
];

export default function TopupDepositPage({ navigate, goBack, screenParams }) {
  const customer = screenParams;
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [snapResult, setSnapResult] = useState(null); // { snapUrl, orderId }

  if (!customer) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Btn onClick={() => navigate('customer')}>Kembali</Btn></div>;

  const handleTopUp = async () => {
    if (!amount || Number(amount) < 1000) {
      alertWarning('Nominal top up minimal Rp 1.000.');
      return;
    }

    // ── Branch: Midtrans Snap
    if (payMethod === 'midtrans') {
      setLoading(true);
      try {
        const result = await createTopupSnap({
          customerId: customer.id,
          faceValue: Number(amount),
          sellPrice: Number(amount),
        });

        // Simpan snap URL untuk share alternative
        setSnapResult({
          snapUrl: result.snapUrl,
          orderId: result.orderId,
          topupNo: result.topupNo,
        });

        // Buka Snap popup
        const popupResult = await openSnapPopup(result.snapToken);

        // Force sync dari Midtrans (bypass webhook kalau dev tanpa ngrok)
        // Kasih delay 1 detik dulu biar Midtrans selesai update internal
        await new Promise((r) => setTimeout(r, 1000));
        const status = await getPaymentStatus(result.orderId, true).catch(() => null);

        if (status?.status === 'settlement') {
          await alertSuccess(`Top up ${rp(Number(amount))} berhasil! Saldo customer telah diperbarui.`);
          navigate('detail_customer', { ...customer, deposit: (customer.deposit || 0) + Number(amount) });
        } else if (status?.status === 'pending' || popupResult.status === 'pending') {
          alertInfo(
            `Pembayaran sedang diproses. Saldo akan otomatis bertambah saat pembayaran tervalidasi. Order ID: ${result.orderId}`,
            { title: 'Pembayaran Pending' }
          );
        } else if (popupResult.status === 'close') {
          alertInfo(
            `Popup ditutup. Link pembayaran tetap aktif. Order ID: ${result.orderId}`,
            { title: 'Pembayaran Belum Selesai' }
          );
        } else if (popupResult.status === 'error') {
          alertError('Pembayaran gagal. Silakan coba lagi.');
        } else if (status?.status === 'failed') {
          alertError('Pembayaran ditolak/expired. Silakan coba lagi.');
        }
      } catch (err) {
        console.error('[topup snap] error:', err);
        alertError(err?.response?.data?.message || 'Gagal membuat link topup.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Branch: Manual (cash / transfer / qris EDC)
    setLoading(true);
    try {
      const res = await axios.post(`/api/customers/${customer.id}/topup`, {
        amount: Number(amount),
        payMethod,
      });
      const newBalance = res?.data?.data?.newBalance ?? (customer.deposit || 0) + Number(amount);
      await alertSuccess(`Top up ${rp(Number(amount))} berhasil!`);
      navigate('detail_customer', { ...customer, deposit: newBalance });
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal melakukan top up.';
      alertError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Share link via WhatsApp ke customer
  const shareViaWA = () => {
    if (!snapResult?.snapUrl) return;
    const phone = (customer.phone || '').replace(/\D/g, '').replace(/^0/, '62');
    const text = encodeURIComponent(`Halo ${customer.name}, silakan lakukan pembayaran top up deposit Rp ${Number(amount).toLocaleString('id-ID')} via link berikut:\n\n${snapResult.snapUrl}\n\n— Wäschen Laundry`);
    const waUrl = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Top Up Deposit" subtitle={customer.name} onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ background: C.white, borderRadius: 16, padding: '16px 20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 4 }}>Saldo Deposit Saat Ini</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 24, fontWeight: 700, color: C.success }}>{rp(customer.deposit || 0)}</div>
        </div>

        <div style={{ background: C.white, borderRadius: 16, padding: '16px 20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 12 }}>Nominal Top Up</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setAmount(String(p))} style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${amount === String(p) ? C.primary : C.n300}`, background: amount === String(p) ? C.primaryLight : C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: amount === String(p) ? C.primary : C.n600 }}>
                {rp(p)}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n600 }}>Rp</span>
            <input
              type="text"
              value={amount ? Number(amount).toLocaleString('id-ID') : ''}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              inputMode="numeric"
              style={{ width: '100%', height: 52, borderRadius: 12, padding: '0 14px 0 42px', border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: C.n900, background: C.white, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ background: C.white, borderRadius: 16, padding: '16px 20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 12 }}>Metode Pembayaran</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PAY_METHODS.map((m) => {
              const active = payMethod === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setPayMethod(m.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    border: `1.5px solid ${active ? C.primary : C.n200}`,
                    background: active ? `${C.primary}08` : C.white,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: active ? C.primary : C.n900 }}>
                      {m.label}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 1 }}>
                      {m.desc}
                    </div>
                  </div>
                  {active && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Snap result panel — kalau popup ditutup, kasir bisa share link */}
        {snapResult && (
          <div style={{ background: '#F0FDF4', borderRadius: 16, padding: '16px 20px', marginBottom: 16, border: '1.5px solid #86EFAC' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#15803D', marginBottom: 8 }}>
              ⚡ Link Pembayaran Aktif
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#166534', marginBottom: 10 }}>
              Order ID: <strong>{snapResult.orderId}</strong><br />
              Topup No: <strong>{snapResult.topupNo}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { navigator.clipboard?.writeText(snapResult.snapUrl); alertSuccess('Link disalin'); }}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 8,
                  border: `1.5px solid #86EFAC`, background: 'white',
                  fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: '#15803D',
                  cursor: 'pointer',
                }}
              >📋 Salin Link</button>
              <button
                onClick={shareViaWA}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 8,
                  border: 'none', background: '#25D366',
                  fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: 'white',
                  cursor: 'pointer',
                }}
              >📱 Share WA</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 20px', background: C.white, borderTop: `1px solid ${C.n100}` }}>
        <Btn variant="primary" fullWidth size="lg" loading={loading} onClick={handleTopUp} disabled={!amount || Number(amount) < 1000}>
          {payMethod === 'midtrans' ? 'Buat Link Bayar' : 'Top Up'} {amount ? rp(Number(amount)) : ''}
        </Btn>
      </div>
    </div>
  );
}
