import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { Btn } from '../../components/ui';

export default function NotaBerhasilPage({ navigate, screenParams }) {
  const nota = screenParams;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.n50, padding: 24 }}>
      <div style={{ width: 88, height: 88, borderRadius: 44, background: `linear-gradient(135deg, ${C.success}, #0CA678)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: `0 8px 24px ${C.success}44` }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
      </div>

      <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 700, color: C.n900, marginBottom: 6 }}>Nota Berhasil Dibuat!</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 14, color: C.n600, marginBottom: 24, textAlign: 'center' }}>Nota laundry telah berhasil disimpan</div>

      {nota && (
        <div style={{ width: '100%', background: C.white, borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 12px rgba(15,23,42,0.08)', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>No. Nota</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.primary }}>{nota.id}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Customer</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{nota.customerName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Item</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{nota.items?.length} layanan</span>
          </div>
          <div style={{ height: 1, background: C.n100, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>Total</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.primary }}>{rp(nota.total)}</span>
          </div>
        </div>
      )}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {nota && (
          <Btn variant="primary" fullWidth size="lg" onClick={() => navigate('cetak_nota', { id: nota.id })}>
            🖨️ Cetak Nota & Label
          </Btn>
        )}
        <Btn variant="secondary" fullWidth onClick={() => navigate('nota_step1')}>
          Buat Nota Baru
        </Btn>
        <Btn variant="ghost" fullWidth onClick={() => navigate('transaksi')}>
          Lihat Transaksi
        </Btn>
      </div>
    </div>
  );
}
