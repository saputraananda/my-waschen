import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, EmptyState } from '../../components/ui';

const STORAGE_KEY = 'waschen_printer_config';
const DEFAULT_CFG = {
  printerType: 'thermal_58', customWidthMm: 72,
  charPerLine: 32, barcodeEnabled: false, barcodeType: 'qr',
  showCustomerName: true, showCustomerPhone: true, showCustomerAddress: false,
  showCashierName: true, showTransactionNo: true, showTransactionDate: true,
  showEstimatedDone: true, showFragrance: true, showNotes: true,
  showPaymentMethod: true, showChange: true, showDeliveryFee: true,
  showMemberDiscount: true, showTopupInfo: false,
  outletName: 'MY WASCHEN', outletTagline: 'Clean, Fast, Reliable',
  outletAddress: '', outletPhone: '',
  footerText: 'Terima kasih! Cucian >30 hari bukan tanggung jawab kami.',
  copies: 1, printLabel: true,
};

function loadPrinterCfg() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? { ...DEFAULT_CFG, ...JSON.parse(s) } : { ...DEFAULT_CFG };
  } catch { return { ...DEFAULT_CFG }; }
}

function getPageSize(cfg) {
  if (cfg.printerType === 'thermal_58') return '58mm auto';
  if (cfg.printerType === 'thermal_80') return '80mm auto';
  if (cfg.printerType === 'a4') return 'A4';
  return `${cfg.customWidthMm}mm auto`;
}

export default function CetakNotaPage({ navigate, goBack, screenParams }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const cfg = loadPrinterCfg();
  const pageSize = getPageSize(cfg);

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
        <TopBar title="Cetak Nota" onBack={goBack} />
        <EmptyState title="Transaksi tidak ditemukan" />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, height: '100vh', overflow: 'hidden' }}>
      <style>{`
        @media print {
          @page { size: ${pageSize}; margin: 2mm; }
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .print-container { padding: 0 !important; background: white !important; box-shadow: none !important; border-radius: 0 !important; width: 100% !important; max-width: 100% !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div className="no-print">
        <TopBar title="Cetak Nota & Label" onBack={goBack} />
        <div style={{ padding: 12, background: C.white, borderBottom: `1px solid ${C.n200}`, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn variant="primary" onClick={() => window.print()} style={{ flex: 1 }}>🖨️ Cetak Sekarang</Btn>
          <button
            onClick={() => navigate('printer_settings')}
            style={{ padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${C.n200}`, background: C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, whiteSpace: 'nowrap' }}
          >
            ⚙️ Printer
          </button>
        </div>
        {/* Config badge */}
        <div style={{ padding: '6px 16px', background: '#EFF6FF', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            cfg.printerType === 'thermal_58' ? '📄 58mm' : cfg.printerType === 'thermal_80' ? '📄 80mm' : cfg.printerType === 'a4' ? '📄 A4' : `📄 ${cfg.customWidthMm}mm`,
            cfg.barcodeEnabled ? `🔲 ${cfg.barcodeType.toUpperCase()}` : null,
            cfg.printLabel ? '🏷️ Label ON' : null,
          ].filter(Boolean).map(b => (
            <span key={b} style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: '#1D4ED8', background: '#DBEAFE', padding: '2px 8px', borderRadius: 999 }}>{b}</span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* === HALAMAN 1: STRUK NOTA CUSTOMER === */}
        <div className="print-container" style={{ width: '100%', maxWidth: 380, background: C.white, padding: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: 24, fontFamily: 'monospace', color: '#000', fontSize: 12 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: 18 }}>{cfg.outletName || 'MY WASCHEN'}</h2>
            {cfg.outletTagline && <div style={{ fontSize: 11 }}>{cfg.outletTagline}</div>}
            {cfg.outletAddress && <div style={{ fontSize: 10, opacity: 0.75 }}>{cfg.outletAddress}</div>}
            {cfg.outletPhone && <div style={{ fontSize: 10, opacity: 0.75 }}>Telp: {cfg.outletPhone}</div>}
            <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }} />
          </div>

          {/* Info transaksi & customer */}
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {cfg.showTransactionNo   && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>No. Nota:</span><span style={{ fontWeight: 'bold' }}>{data.transactionNo || data.id}</span></div>}
            {cfg.showTransactionDate && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tgl Masuk:</span><span>{data.createdAt ? new Date(data.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (data.date || '-')}</span></div>}
            {cfg.showEstimatedDone  && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Est. Selesai:</span><span>{data.estimatedDoneAt ? new Date(data.estimatedDoneAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span></div>}
            {cfg.showCashierName    && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kasir:</span><span>{data.createdBy || data.kasirName || '-'}</span></div>}
            <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
            {cfg.showCustomerName   && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pelanggan:</span><span style={{ fontWeight: 'bold' }}>{data.customerName}</span></div>}
            {cfg.showCustomerPhone  && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>HP:</span><span>{data.customerPhone || '-'}</span></div>}
            {cfg.showCustomerAddress && data.customerAddress && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Alamat:</span><span style={{ textAlign: 'right', maxWidth: '55%' }}>{data.customerAddress}</span></div>}
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

          {/* Layanan */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>LAYANAN:</div>
            {data.items?.map((item, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.name || item.serviceName}{item.express ? ' ⚡' : ''}</span>
                </div>
                {cfg.showFragrance && item.fragrance && (
                  <div style={{ fontSize: 10, opacity: 0.7, paddingLeft: 8 }}>Parfum: {item.fragrance}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#444' }}>
                  <span>{item.qty} {item.unit} × {rp(item.price)}</span>
                  <span>{rp(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

          {/* Totals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal:</span><span>{rp(data.subtotal || data.total)}</span></div>
            {cfg.showMemberDiscount && data.memberDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Diskon Member:</span><span>-{rp(data.memberDiscount)}</span></div>}
            {data.promoDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Diskon Promo:</span><span>-{rp(data.promoDiscount)}</span></div>}
            {cfg.showDeliveryFee && data.deliveryFee > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ongkir:</span><span>{rp(data.deliveryFee)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 14, marginTop: 4 }}><span>TOTAL:</span><span>{rp(data.total)}</span></div>
            {cfg.showPaymentMethod && data.payMethod && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}><span>Bayar ({data.payMethod}):</span><span>{rp(data.paidAmount)}</span></div>}
            {cfg.showChange && data.changeAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kembali:</span><span>{rp(data.changeAmount)}</span></div>}
            {cfg.showNotes && data.notes && <div style={{ marginTop: 6, fontSize: 10, opacity: 0.8 }}>Catatan: {data.notes}</div>}
          </div>

          {/* Barcode placeholder */}
          {cfg.barcodeEnabled && (
            <div style={{ textAlign: 'center', margin: '10px 0', padding: '8px 0', borderTop: '1px dashed #999', borderBottom: '1px dashed #999' }}>
              <div style={{ fontWeight: 'bold', letterSpacing: 4, fontSize: 14 }}>▮▯▮▯▮▮▯▯▮▯▮</div>
              <div style={{ fontSize: 9, marginTop: 2, opacity: 0.65 }}>{data.transactionNo || data.id} · {cfg.barcodeType.toUpperCase()}</div>
            </div>
          )}

          <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }} />
          <div style={{ textAlign: 'center', fontSize: 10, fontStyle: 'italic', lineHeight: 1.5 }}>
            {cfg.footerText || 'Terima kasih telah mencuci di My Waschen.'}
          </div>
        </div>

        {/* === HALAMAN 2: LABEL PRODUKSI === */}
        {cfg.printLabel && data.units && data.units.length > 0 && (
          <div className="page-break" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {data.units.map((unit, idx) => (
              <div key={idx} className="print-container" style={{ width: '100%', maxWidth: 300, background: C.white, padding: 16, borderRadius: 8, border: '2px solid #000', fontFamily: 'monospace', color: '#000', textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 6 }}>{cfg.outletName || 'MY WASCHEN'}</div>
                <div style={{ fontSize: 14, marginBottom: 2 }}>{data.customerName}</div>
                <div style={{ fontSize: 11, marginBottom: 10, opacity: 0.75 }}>{data.customerPhone}</div>
                <div style={{ padding: '6px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '6px 0', letterSpacing: 3, fontSize: 15, fontWeight: 'bold' }}>
                  {unit.unitNo}
                </div>
                <div style={{ fontSize: 9, marginTop: 6, opacity: 0.75 }}>
                  Masuk: {data.createdAt ? new Date(data.createdAt).toLocaleDateString('id-ID') : '-'}<br />
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