import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, EmptyState } from '../../components/ui';

export default function CetakNotaPage({ navigate, screenParams }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!screenParams?.id) return;
    const fetchTrx = async () => {
      try {
        const res = await axios.get(`/api/transactions/${screenParams.id}`);
        setData(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrx();
  }, [screenParams?.id]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Poppins' }}>Loading Nota...</div>;
  }

  if (!data) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
        <TopBar title="Cetak Nota" onBack={() => navigate('dashboard')} />
        <EmptyState title="Transaksi tidak ditemukan" />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, height: '100vh', overflow: 'hidden' }}>
      {/* Tombol Aksi - Disembunyikan saat di-print */}
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            body { background: white; margin: 0; padding: 0; }
            .print-container { padding: 0 !important; background: white !important; box-shadow: none !important; border-radius: 0 !important; width: 100% !important; max-width: 100% !important; }
            .page-break { page-break-before: always; }
          }
        `}
      </style>

      <div className="no-print">
        <TopBar title="Cetak Nota & Label" onBack={() => navigate('dashboard')} />
        {/* PERBAIKAN SYNTAX BACKTICK DI SINI 👇 */}
        <div style={{ padding: 16, background: C.white, borderBottom: `1px solid ${C.n200}`, display: 'flex', gap: 10 }}>
          <Btn variant="primary" onClick={() => window.print()} style={{ flex: 1 }}>Cetak Sekarang</Btn>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* === HALAMAN 1: STRUK NOTA CUSTOMER === */}
        <div className="print-container" style={{ width: '100%', maxWidth: 380, background: C.white, padding: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: 24, fontFamily: 'monospace', color: '#000' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: 20 }}>MY WASCHEN</h2>
            <div style={{ fontSize: 12 }}>Clean, Fast, Reliable</div>
            <div style={{ fontSize: 12 }}>Jl. Kemang Raya No. 45, Jakarta</div>
            <div style={{ borderBottom: '1px dashed #000', margin: '12px 0' }} />
          </div>

          <div style={{ fontSize: 12, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <div>No. Nota:</div><div style={{ textAlign: 'right', fontWeight: 'bold' }}>{data.transactionNo || data.id}</div>
            <div>Tanggal:</div><div style={{ textAlign: 'right' }}>{data.date || data.createdAt}</div>
            <div>Kasir:</div><div style={{ textAlign: 'right' }}>{data.createdBy || data.kasirName}</div>
            <div>Pelanggan:</div><div style={{ textAlign: 'right', fontWeight: 'bold' }}>{data.customerName}</div>
            <div>HP:</div><div style={{ textAlign: 'right' }}>{data.customerPhone || '-'}</div>
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '12px 0' }} />

          <div style={{ fontSize: 12, marginBottom: 16 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>LAYANAN:</div>
            {/* PERBAIKAN POTENSI CRASH DENGAN OPTIONAL CHAINING (?.) 👇 */}
            {data.items?.map((item, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.name || item.serviceName} {item.express ? '(Express)' : ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#444' }}>
                  <span>{item.qty} {item.unit} x {rp(item.price)}</span>
                  <span>{rp(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '12px 0' }} />

          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span><span>{rp(data.subtotal || data.total)}</span>
            </div>
            {data.deliveryFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Ongkir:</span><span>{rp(data.deliveryFee)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 14, marginTop: 4 }}>
              <span>TOTAL:</span><span>{rp(data.total)}</span>
            </div>

            {/* Hanya tampilkan kalau ada data pembayaran */}
            {data.payMethod && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span>Bayar ({data.payMethod}):</span><span>{rp(data.paidAmount)}</span>
              </div>
            )}
            {data.changeAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Kembali:</span><span>{rp(data.changeAmount)}</span>
              </div>
            )}
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '12px 0' }} />
          <div style={{ textAlign: 'center', fontSize: 11, fontStyle: 'italic' }}>
            Terima kasih telah mencuci di My Waschen.<br />
            Cucian yang tidak diambil lebih dari 30 hari di luar tanggung jawab kami.
          </div>
        </div>

        {/* === HALAMAN 2: LABEL BARCODE PRODUKSI === */}
        {data.units && data.units.length > 0 && (
          <div className="page-break" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {data.units.map((unit, idx) => (
              <div key={idx} className="print-container" style={{ width: '100%', maxWidth: 300, background: C.white, padding: 16, borderRadius: 8, border: '2px solid #000', fontFamily: 'monospace', color: '#000', textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>MY WASCHEN</div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>{data.customerName}</div>
                <div style={{ fontSize: 12, marginBottom: 12 }}>{data.customerPhone}</div>

                {/* Dummy Barcode Box */}
                <div style={{ padding: '8px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '8px 0', letterSpacing: 2, fontSize: 16, fontWeight: 'bold' }}>
                  {unit.unitNo}
                </div>

                <div style={{ fontSize: 10, marginTop: 8 }}>
                  Tgl Masuk: {data.date || data.createdAt}<br />
                  Item {idx + 1} dari {data.units.length}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}