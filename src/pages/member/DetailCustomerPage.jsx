import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Avatar, Divider } from '../../components/ui';

export default function DetailCustomerPage({ navigate, screenParams, transactions }) {
  const customer = screenParams;
  if (!customer) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Btn onClick={() => navigate('customer')}>Kembali</Btn></div>;

  const customerTx = transactions.filter((t) => t.customerId === customer.id);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Detail Customer" onBack={() => navigate('customer')} rightAction={() => navigate('topup_deposit', customer)} rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Profile card */}
        <div style={{ background: C.white, borderRadius: 16, padding: '20px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Avatar initials={customer.avatar || customer.name.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={60} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.n900 }}>{customer.name}</div>
              {customer.isPremium && <span style={{ background: '#FEF3C7', color: '#B45309', fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>PREMIUM</span>}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, marginTop: 2 }}>{customer.phone}</div>
            {customer.address && <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2 }}>{customer.address}</div>}
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.primary }}>{customer.totalTx}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Transaksi</div>
            </div>
            <div style={{ width: 1, background: C.n100 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.success }}>{rp(customer.deposit || 0)}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Deposit</div>
            </div>
            <div style={{ width: 1, background: C.n100 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.warning }}>{customer.poin || 0}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Poin</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Btn variant="primary" onClick={() => navigate('nota_step1', { preCustomer: customer })} style={{ flex: 1 }}>Buat Nota</Btn>
          <Btn variant="secondary" onClick={() => navigate('topup_deposit', customer)} style={{ flex: 1 }}>Top Up Deposit</Btn>
        </div>

        {/* Transaction history */}
        <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 12 }}>Riwayat Transaksi</div>
        {customerTx.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', background: C.white, borderRadius: 14, color: C.n600, fontFamily: 'Poppins', fontSize: 13 }}>Belum ada transaksi</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customerTx.map((tx) => (
              <div key={tx.id} onClick={() => navigate('detail_transaksi', tx)} style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{tx.id}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>{tx.date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>{rp(tx.total)}</div>
                  <div style={{ marginTop: 2 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: tx.status === 'selesai' ? '#DCFCE7' : tx.status === 'dibatalkan' ? '#FEE2E2' : '#FEF3C7', color: tx.status === 'selesai' ? C.success : tx.status === 'dibatalkan' ? C.danger : C.warning }}>{tx.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
