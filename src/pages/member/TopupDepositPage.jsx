import { useState } from 'react';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn } from '../../components/ui';

const PRESETS = [50000, 100000, 200000, 500000];

export default function TopupDepositPage({ navigate, screenParams, showToast }) {
  const customer = screenParams;
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  if (!customer) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Btn onClick={() => navigate('customer')}>Kembali</Btn></div>;

  const handleTopUp = () => {
    if (!amount || Number(amount) < 1000) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      showToast(`Top up ${rp(Number(amount))} berhasil!`, 'success');
      navigate('detail_customer', { ...customer, deposit: (customer.deposit || 0) + Number(amount) });
    }, 1200);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Top Up Deposit" subtitle={customer.name} onBack={() => navigate('detail_customer', customer)} />

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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[{ key: 'cash', label: '💵 Tunai' }, { key: 'transfer', label: '🏦 Transfer' }, { key: 'qris', label: '📱 QRIS' }].map((m) => (
              <button key={m.key} onClick={() => setPayMethod(m.key)} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `1.5px solid ${payMethod === m.key ? C.primary : C.n300}`, background: payMethod === m.key ? C.primaryLight : C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: payMethod === m.key ? 700 : 400, color: payMethod === m.key ? C.primary : C.n600 }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 20px', background: C.white, borderTop: `1px solid ${C.n100}` }}>
        <Btn variant="primary" fullWidth size="lg" loading={loading} onClick={handleTopUp} disabled={!amount || Number(amount) < 1000}>
          Top Up {amount ? rp(Number(amount)) : ''}
        </Btn>
      </div>
    </div>
  );
}
