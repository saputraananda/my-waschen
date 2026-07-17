import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, EmptyState, QRCodeView } from '../../components/ui';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import {
  printReceipt,
  printLabel,
  getPrinterStatus,
  connectPrinter,
  getSavedPrinter,
  getPairedDevices,
  isBluetoothAvailable,
} from '../../utils/printService';

// ─── Payment Status Helper ───────────────────────────────────────────────────────
function getPaymentStatus(paidAmount, total) {
  if (!paidAmount || paidAmount <= 0) return 'bayar_nanti';
  if (paidAmount >= total) return 'lunas';
  return 'dp';
}

const PAYMENT_STATUS_PRINT = {
  lunas: { label: 'LUNAS', color: '#059669' },
  dp: { label: 'DP', color: '#d97706' },
  bayar_nanti: { label: 'HUTANG', color: '#6b7280' },
};

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
  const [error, setError] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [printingLabel, setPrintingLabel] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [btAvailable, setBtAvailable] = useState(false);
  // Label data for preview
  const [labelData, setLabelData] = useState([]);
  // Printer selector state
  const [pairedDevices, setPairedDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [showPrinterDropdown, setShowPrinterDropdown] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const cfg = loadPrinterCfg();
  const pageSize = getPageSize(cfg);

  // Check printer status & load paired devices on mount
  useEffect(() => {
    const checkPrinter = () => {
      const btAvail = isBluetoothAvailable();
      setBtAvailable(btAvail);
      const status = getPrinterStatus();
      setPrinterConnected(status.connected);
    };
    checkPrinter();
    loadPairedDevices();
  }, []);

  const loadPairedDevices = async () => {
    try {
      const devices = await getPairedDevices();
      setPairedDevices(devices);
      const saved = getSavedPrinter();
      if (saved?.deviceId) {
        setSelectedDeviceId(saved.deviceId);
      } else if (devices.length > 0) {
        setSelectedDeviceId(devices[0].deviceId);
      }
    } catch (e) {
      console.warn('[CetakNota] getPairedDevices failed:', e);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showPrinterDropdown) return;
    const handleClick = (e) => {
      if (!e.target.closest('[data-printer-dropdown]')) {
        setShowPrinterDropdown(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showPrinterDropdown]);

  // Print handler - connect to selected printer then print
  const handlePrint = async () => {
    try {
      setPrinting(true);

      // Ensure printer is connected
      if (!printerConnected) {
        const result = await connectPrinter(selectedDeviceId);
        if (result.success) {
          setPrinterConnected(true);
        } else {
          alert('Gagal terhubung ke printer');
          return;
        }
      }

      // Print the receipt
      await printReceipt(data);

      // Show success
      alert('Nota berhasil dicetak!');

    } catch (err) {
      console.error('Print error:', err);
      alert('Gagal cetak: ' + err.message);
    } finally {
      setPrinting(false);
    }
  };

  // Print label handler
  const handlePrintLabel = async () => {
    try {
      setPrintingLabel(true);

      // Ensure printer is connected
      if (!printerConnected) {
        const result = await connectPrinter(selectedDeviceId);
        if (result.success) {
          setPrinterConnected(true);
        } else {
          alert('Gagal terhubung ke printer');
          return;
        }
      }

      // Print labels via printService
      await printLabel(data);

      alert(`Label berhasil dicetak! (${labelData.length} label)`);

    } catch (err) {
      console.error('Print label error:', err);
      alert('Gagal cetak label: ' + err.message);
    } finally {
      setPrintingLabel(false);
    }
  };

  // Connect to selected printer
  const handleConnectPrinter = async () => {
    try {
      setConnecting(true);
      const result = await connectPrinter(selectedDeviceId);
      if (result.success) {
        setPrinterConnected(true);
        await loadPairedDevices(); // refresh list (may now show as connected)
        alert('Printer terhubung: ' + result.name);
      }
    } catch (err) {
      alert('Gagal connect: ' + err.message);
    } finally {
      setConnecting(false);
    }
  };

  // Responsive hooks
  const { isMobile, isTablet } = useResponsive();
  const windowSize = useWindowSize();

  const fetchTrx = useCallback(async () => {
    if (!screenParams?.id) return;
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get(`/api/transactions/${screenParams.id}`);
      setData(res.data.data);

      // Also fetch label data for preview
      try {
        const labelRes = await axios.get(`/api/transactions/${screenParams.id}/labels`);
        setLabelData(labelRes.data?.data || []);
      } catch {
        setLabelData([]);
      }
    } catch (err) {
      setError('Gagal memuat data. Tap untuk coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [screenParams?.id]);

  useEffect(() => {
    fetchTrx();
  }, [fetchTrx]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Poppins' }}>Loading Nota...</div>;
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
        <TopBar title="Cetak Nota" onBack={goBack} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: C.validationErrorBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>Gagal Memuat Data</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n700 }}>{error}</div>
          <Btn variant="primary" onClick={fetchTrx} style={{ marginTop: 8 }}>Coba Lagi</Btn>
        </div>
      </div>
    );
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
        <TopBar title="Cetak Nota" onBack={goBack} />
        <div style={{ padding: isMobile ? '8px 12px' : 12, background: C.white, borderBottom: `1px solid ${C.n200}`, display: 'flex', gap: isMobile ? 6 : 8, alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <Btn
            variant="primary"
            onClick={handlePrint}
            style={{ flex: isMobile ? 1 : 'initial', minWidth: isMobile ? '100%' : 'auto' }}
            disabled={printing || !data}
          >
            {printing ? '⏳ Mencetak...' : printerConnected ? '🖨️ Cetak Nota' : '📡 Hubungkan Printer Dulu'}
          </Btn>

          {labelData.length > 0 && (
            <Btn
              variant="secondary"
              onClick={handlePrintLabel}
              disabled={printingLabel || !data}
              style={{ flex: isMobile ? 1 : 'initial', minWidth: isMobile ? '100%' : 'auto' }}
            >
              {printingLabel ? '⏳ Mencetak Label...' : '🏷️ Cetak Label'}
            </Btn>
          )}

          {/* ── Dropdown: Printer Selector ── */}
          {btAvailable && pairedDevices.length > 0 && (
            <div style={{ position: 'relative' }} data-printer-dropdown>
              <button
                onClick={() => setShowPrinterDropdown(d => !d)}
                style={{
                  padding: isMobile ? '8px 12px' : '10px 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${C.n200}`,
                  background: selectedDeviceId ? C.primaryTint : C.n50,
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  fontWeight: 600,
                  color: selectedDeviceId ? C.primary : C.n600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                🖨️ {pairedDevices.find(d => d.deviceId === selectedDeviceId)?.name?.split(' ')[0] || 'Pilih Printer'}
                {showPrinterDropdown ? ' ▲' : ' ▼'}
              </button>

              {/* Dropdown menu */}
              {showPrinterDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: C.white,
                  border: `1.5px solid ${C.n200}`,
                  borderRadius: 12,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  minWidth: 220,
                  zIndex: 999,
                  overflow: 'hidden',
                }}>
                  {/* Header */}
                  <div style={{
                    padding: '8px 14px',
                    borderBottom: `1px solid ${C.n100}`,
                    fontFamily: 'Poppins',
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.n500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    📋 Printer Tersimpan
                  </div>

                  {/* Device list */}
                  {pairedDevices.map(device => (
                    <div
                      key={device.deviceId}
                      onClick={() => {
                        setSelectedDeviceId(device.deviceId);
                        setShowPrinterDropdown(false);
                      }}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        background: selectedDeviceId === device.deviceId ? C.primaryTint : 'transparent',
                        borderLeft: selectedDeviceId === device.deviceId ? `3px solid ${C.primary}` : '3px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Status dot */}
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: device.connected ? '#22C55E' : C.n300,
                          flexShrink: 0,
                        }} />
                        <div>
                          <div style={{
                            fontFamily: 'Poppins',
                            fontSize: 12,
                            fontWeight: 600,
                            color: selectedDeviceId === device.deviceId ? C.primary : C.n900,
                          }}>
                            {device.name}
                          </div>
                          <div style={{
                            fontFamily: 'Poppins',
                            fontSize: 10,
                            color: device.connected ? '#22C55E' : C.n400,
                          }}>
                            {device.connected ? '🟢 Terhubung' : '⚪ Tersimpan'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Divider & settings link */}
                  <div style={{
                    padding: '8px 14px',
                    borderTop: `1px solid ${C.n100}`,
                  }}>
                    <button
                      onClick={() => { setShowPrinterDropdown(false); navigate('printer_settings'); }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: `1.5px solid ${C.n200}`,
                        background: C.white,
                        cursor: 'pointer',
                        fontFamily: 'Poppins',
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.n600,
                      }}
                    >
                      ⚙️ Pengaturan Printer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!printerConnected && btAvailable && (
            <button
              onClick={handleConnectPrinter}
              disabled={connecting}
              style={{ padding: isMobile ? '8px 12px' : '10px 14px', borderRadius: 10, border: `1.5px solid ${C.primary}`, background: C.primaryTint, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary, whiteSpace: 'nowrap', opacity: connecting ? 0.6 : 1 }}
            >
              {connecting ? '⏳ Connect...' : '🔗 Connect'}
            </button>
          )}

          {printerConnected && (
            <div style={{ padding: isMobile ? '8px 12px' : '10px 14px', borderRadius: 10, background: '#F0FDF4', fontFamily: 'Poppins', fontSize: 11, color: '#22C55E', fontWeight: 600 }}>
              ✅ Printer ON
            </div>
          )}

          <button
            onClick={() => navigate('printer_settings')}
            style={{ padding: isMobile ? '8px 12px' : '10px 14px', borderRadius: 10, border: `1.5px solid ${C.n200}`, background: C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, whiteSpace: 'nowrap' }}
          >
            ⚙️
          </button>
        </div>
        {/* Config badge */}
        <div style={{ padding: isMobile ? '4px 12px' : '6px 16px', background: C.infoBg, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            cfg.printerType === 'thermal_58' ? '📄 58mm' : cfg.printerType === 'thermal_80' ? '📄 80mm' : cfg.printerType === 'a4' ? '📄 A4' : `📄 ${cfg.customWidthMm}mm`,
            cfg.barcodeEnabled ? `🔲 ${cfg.barcodeType.toUpperCase()}` : null,
            cfg.printLabel ? '🏷️ Label ON' : null,
          ].filter(Boolean).map(b => (
            <span key={b} style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.infoDark, background: C.white, padding: '2px 8px', borderRadius: 999 }}>{b}</span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* === HALAMAN 1: STRUK NOTA CUSTOMER === */}
        <div className="print-container" style={{
          width: '100%',
          maxWidth: isMobile ? 340 : 380,
          background: C.white,
          padding: isMobile ? 16 : 24,
          borderRadius: isMobile ? 10 : 12,
          boxShadow: SHADOW.sm,
          marginBottom: 24,
          fontFamily: 'monospace',
          color: '#000',
          fontSize: isMobile ? 11 : 12
        }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>Status:</span><span style={{ color: data.paymentStatus === 'paid' ? '#059669' : '#dc2626' }}>{data.paymentStatus === 'paid' ? 'Lunas' : 'Belum Lunas'}</span></div>
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
            {/* Payment Status Badge */}
            {(() => {
              const status = getPaymentStatus(data.paidAmount, data.total);
              const cfg2 = PAYMENT_STATUS_PRINT[status] || PAYMENT_STATUS_PRINT.bayar_nanti;
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span>Status Bayar:</span>
                  <span style={{ fontWeight: 700, fontSize: 12, color: cfg2.color }}>[{cfg2.label}]</span>
                </div>
              );
            })()}
            {(() => {
              const balance = Math.max(0, (data.total || 0) - (data.paidAmount || 0));
              return balance > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sisa:</span>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>{rp(balance)}</span>
                </div>
              ) : null;
            })()}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 14, marginTop: 4 }}><span>TOTAL:</span><span>{rp(data.total)}</span></div>
            {cfg.showPaymentMethod && data.payMethod && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}><span>Bayar ({data.payMethod}):</span><span>{rp(data.paidAmount)}</span></div>}
            {cfg.showChange && data.changeAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kembali:</span><span>{rp(data.changeAmount)}</span></div>}
            {cfg.showNotes && data.notes && <div style={{ marginTop: 6, fontSize: 10, opacity: 0.8 }}>Catatan: {data.notes.replace(/^\[Bayar:[^\]]*\]\n?/, '')}</div>}
          </div>

          {/* Barcode / QR — real scannable */}
          {cfg.barcodeEnabled && (
            <div style={{ textAlign: 'center', margin: '10px 0', padding: '10px 0', borderTop: '1px dashed #999', borderBottom: '1px dashed #999', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <QRCodeView value={data.transactionNo || data.id} size={96} level="M" />
              <div style={{ fontSize: 9, marginTop: 2, opacity: 0.65, fontFamily: 'monospace' }}>{data.transactionNo || data.id}</div>
              <div style={{ fontSize: 8, opacity: 0.5 }}>Scan untuk cek status</div>
            </div>
          )}

          <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }} />
          <div style={{ textAlign: 'center', fontSize: 10, fontStyle: 'italic', lineHeight: 1.5 }}>
            {cfg.footerText || 'Terima kasih telah mencuci di My Waschen.'}
          </div>
        </div>

        {/* === HALAMAN 2: LABEL PRODUKSI === */}
        {labelData && labelData.length > 0 && (
          <div className="page-break" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 12 : 16 }}>
            {labelData.map((label, idx) => (
              <div key={idx} className="print-container" style={{
                width: '100%',
                maxWidth: isMobile ? 280 : 300,
                background: C.white,
                padding: isMobile ? 12 : 16,
                borderRadius: isMobile ? 6 : 8,
                border: '2px solid #000',
                fontFamily: 'monospace',
                color: '#000',
                textAlign: 'center'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: isMobile ? 13 : 15, marginBottom: 6 }}>{cfg.outletName || 'MY WASCHEN'}</div>
                <div style={{ fontSize: isMobile ? 11 : 13, marginBottom: 2 }}>{label.customer_name}</div>
                <div style={{ fontSize: isMobile ? 9 : 10, marginBottom: 6, opacity: 0.7 }}>{label.customer_phone}</div>
                <div style={{ padding: '4px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '4px 0' }}>
                  <div style={{ fontWeight: 'bold', fontSize: isMobile ? 11 : 12, letterSpacing: 1 }}>
                    {label.service_name}{label.is_express ? ' [EXPRESS]' : ''}
                  </div>
                  {label.qty_display && (
                    <div style={{ fontSize: isMobile ? 9 : 10 }}>{label.qty_display}</div>
                  )}
                </div>

                {/* QR Code — format: {transaction_no}#{sequence} */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
                  <QRCodeView value={String(label.transaction_no) + '#' + String(idx + 1)} size={isMobile ? 72 : 88} level="L" />
                </div>

                <div style={{ fontSize: isMobile ? 8 : 9, marginTop: 6, opacity: 0.7 }}>
                  {label.created_date || '-'} | Item {idx + 1} dari {labelData.length}
                </div>
                {label.estimated_completion && (
                  <div style={{ fontSize: isMobile ? 8 : 9, opacity: 0.7 }}>
                    Est: {label.estimated_completion}
                  </div>
                )}
              </div>
            ))}
         </div>
        )}

      </div>
    </div>
  );
}