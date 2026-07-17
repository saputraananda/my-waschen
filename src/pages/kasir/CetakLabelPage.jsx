/**
 * CetakLabelPage.jsx
 * Dedicated page for printing laundry production labels.
 * Fetches label data from /api/transactions/:id/labels and renders each label.
 * Uses QR bitmap printing for better compatibility across thermal printer models.
 */
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { TopBar, Btn, QRCodeView } from '../../components/ui';
import { useResponsive } from '../../utils/hooks';
import {
  printLabel,
  connectPrinter,
  getPrinterStatus,
  getSavedPrinter,
  getPairedDevices,
  isBluetoothAvailable,
} from '../../utils/printService';

const STORAGE_KEY = 'waschen_printer_config';
const DEFAULT_CFG = {
  printerType: 'thermal_58',
  customWidthMm: 72,
  charPerLine: 32,
  outletName: 'MY WASCHEN',
  footerText: 'Terima kasih!',
};

function loadPrinterCfg() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_CFG, ...JSON.parse(saved) } : DEFAULT_CFG;
  } catch {
    return DEFAULT_CFG;
  }
}

function getPageSize(cfg) {
  if (cfg.printerType === 'thermal_58') return '58mm auto';
  if (cfg.printerType === 'thermal_80') return '80mm auto';
  return cfg.customWidthMm + 'mm auto';
}

export default function CetakLabelPage({ navigate, goBack, screenParams }) {
  const { isMobile } = useResponsive();
  const [data, setData] = useState(null);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [btAvailable, setBtAvailable] = useState(false);
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
      console.warn('[CetakLabel] getPairedDevices failed:', e);
    }
  };

  // Fetch transaction + labels
  const fetchTrxAndLabels = useCallback(async () => {
    if (!screenParams?.id) return;
    setError(null);
    setLoading(true);
    try {
      const txId = screenParams.id;
      const [trxRes, labelRes] = await Promise.all([
        axios.get('/api/transactions/' + txId),
        axios.get('/api/transactions/' + txId + '/labels'),
      ]);
      setData(trxRes.data?.data || trxRes.data);
      setLabels(labelRes.data?.data || []);
    } catch (err) {
      setError('Gagal memuat data. Tap untuk coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [screenParams?.id]);

  useEffect(() => {
    fetchTrxAndLabels();
  }, [fetchTrxAndLabels]);

  // Connect printer
  const handleConnectPrinter = async () => {
    try {
      setConnecting(true);
      const result = await connectPrinter(selectedDeviceId);
      if (result?.success) setPrinterConnected(true);
    } catch (err) {
      console.warn('[CetakLabel] connectPrinter failed:', err);
    } finally {
      setConnecting(false);
    }
  };

  // Print all labels
  const handlePrintLabels = async () => {
    if (!labels.length) { alert('Tidak ada label untuk dicetak.'); return; }
    try {
      setPrinting(true);
      if (!printerConnected) {
        const result = await connectPrinter(selectedDeviceId);
        if (result?.success) {
          setPrinterConnected(true);
        } else {
          alert('Gagal terhubung ke printer'); return;
        }
      }
      const { count } = await printLabel(data.id);
      alert(count + ' label berhasil dicetak!');
    } catch (err) {
      console.error('Print label error:', err);
      alert('Gagal cetak label: ' + (err.message || 'Unknown error'));
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
        <TopBar title="Cetak Label" onBack={goBack} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'Poppins', color: C.n600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
        <TopBar title="Cetak Label" onBack={goBack} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, color: C.n900 }}>{error}</div>
          <Btn variant="primary" onClick={fetchTrxAndLabels}>Coba Lagi</Btn>
        </div>
      </div>
    );
  }

  if (!data || labels.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
        <TopBar title="Cetak Label" onBack={goBack} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, color: C.n900 }}>Tidak ada label untuk transaksi ini.</div>
          <Btn variant="primary" onClick={goBack}>Kembali</Btn>
        </div>
      </div>
    );
  }

  const qrValue = (idx) => {
    const no = labels[idx]?.transaction_no || data?.transactionNo || '';
    return no + '#' + String(idx + 1);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, height: '100vh', overflow: 'hidden' }}>
      <style>{`
        @media print {
          @page { size: ${pageSize}; margin: 2mm; }
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .print-container { padding: 0 !important; background: white !important; box-shadow: none !important; border-radius: 0 !important; width: 100% !important; max-width: 100% !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print">
        <TopBar title="Cetak Label" onBack={goBack} />
        <div style={{
          padding: isMobile ? '8px 12px' : 12,
          background: C.white,
          borderBottom: '1px solid ' + C.n200,
          display: 'flex', gap: isMobile ? 6 : 8, alignItems: 'center',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}>
          <Btn
            variant="primary"
            onClick={handlePrintLabels}
            style={{ flex: isMobile ? 1 : 'initial', minWidth: isMobile ? '100%' : 'auto' }}
            disabled={printing || labels.length === 0}
          >
            {printing ? 'Mencetak...' : printerConnected ? 'Cetak ' + labels.length + ' Label' : 'Hubungkan Printer Dulu'}
          </Btn>

          {/* Printer selector */}
          {btAvailable && pairedDevices.length > 0 && (
            <div style={{ position: 'relative' }} data-printer-dropdown>
              <button
                onClick={() => setShowPrinterDropdown(d => !d)}
                style={{
                  padding: isMobile ? '8px 12px' : '10px 14px',
                  borderRadius: 10,
                  border: '1.5px solid ' + C.n200,
                  background: selectedDeviceId ? C.primaryTint : C.n50,
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 12, fontWeight: 600,
                  color: selectedDeviceId ? C.primary : C.n600,
                  display: 'flex', alignItems: 'center', gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                Printer: {(pairedDevices.find(d => d.deviceId === selectedDeviceId)?.name || 'Pilih').split(' ')[0]}
                {showPrinterDropdown ? ' ▲' : ' ▼'}
              </button>

              {showPrinterDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: C.white, border: '1.5px solid ' + C.n200,
                  borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  minWidth: 220, zIndex: 999, overflow: 'hidden',
                }}>
                  <div style={{ padding: '8px 14px', borderBottom: '1px solid ' + C.n100, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.n500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Printer Tersimpan
                  </div>
                  {pairedDevices.map(device => (
                    <div
                      key={device.deviceId}
                      onClick={() => { setSelectedDeviceId(device.deviceId); setShowPrinterDropdown(false); }}
                      style={{
                        padding: '10px 14px', cursor: 'pointer',
                        background: selectedDeviceId === device.deviceId ? C.primaryTint : 'transparent',
                        borderLeft: selectedDeviceId === device.deviceId ? '3px solid ' + C.primary : '3px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: device.connected ? '#22C55E' : C.n300 }} />
                        <div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: selectedDeviceId === device.deviceId ? C.primary : C.n900 }}>
                            {device.name}
                          </div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: device.connected ? '#22C55E' : C.n400 }}>
                            {device.connected ? 'Terhubung' : 'Tersimpan'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '8px 14px', borderTop: '1px solid ' + C.n100 }}>
                    <button
                      onClick={() => { setShowPrinterDropdown(false); navigate('printer_settings'); }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid ' + C.n200, background: C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600 }}
                    >
                      Pengaturan Printer
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
              style={{ padding: isMobile ? '8px 12px' : '10px 14px', borderRadius: 10, border: '1.5px solid ' + C.primary, background: C.primaryTint, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary, whiteSpace: 'nowrap', opacity: connecting ? 0.6 : 1 }}
            >
              {connecting ? 'Connect...' : 'Connect'}
            </button>
          )}

          {printerConnected && (
            <div style={{ padding: isMobile ? '8px 12px' : '10px 14px', borderRadius: 10, background: '#F0FDF4', fontFamily: 'Poppins', fontSize: 11, color: '#22C55E', fontWeight: 600 }}>
              Printer ON
            </div>
          )}

          <button
            onClick={() => navigate('printer_settings')}
            style={{ padding: isMobile ? '8px 12px' : '10px 14px', borderRadius: 10, border: '1.5px solid ' + C.n200, background: C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, whiteSpace: 'nowrap' }}
          >
            Settings
          </button>
        </div>

        {/* Info badges */}
        <div style={{ padding: isMobile ? '4px 12px' : '6px 16px', background: C.infoBg, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.infoDark, background: C.white, padding: '2px 8px', borderRadius: 999 }}>
            {labels.length} Label{labels.length !== 1 ? 's' : ''}
          </span>
          {data?.customerName && (
            <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.infoDark, background: C.white, padding: '2px 8px', borderRadius: 999 }}>
              {data.customerName}
            </span>
          )}
          {data?.transactionNo && (
            <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.infoDark, background: C.white, padding: '2px 8px', borderRadius: 999 }}>
              {data.transactionNo}
            </span>
          )}
        </div>
      </div>

      {/* Label preview */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 12 : 16 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginBottom: 4 }}>
          Tap "Cetak Label" untuk mencetak semua label via Bluetooth
        </div>

        {labels.map((label, idx) => (
          <div
            key={idx}
            className="print-container"
            style={{
              width: '100%',
              maxWidth: isMobile ? 280 : 300,
              background: C.white,
              padding: isMobile ? 12 : 16,
              borderRadius: isMobile ? 6 : 8,
              border: '2px solid #000',
              fontFamily: 'monospace',
              color: '#000',
              textAlign: 'center',
            }}
          >
            {/* Outlet name */}
            <div style={{ fontWeight: 'bold', fontSize: isMobile ? 13 : 15, marginBottom: 6 }}>
              {cfg.outletName || 'MY WASCHEN'}
            </div>

            {/* Customer info */}
            <div style={{ fontSize: isMobile ? 11 : 13, marginBottom: 2 }}>{label.customer_name}</div>
            <div style={{ fontSize: isMobile ? 9 : 10, marginBottom: 6, opacity: 0.7 }}>{label.customer_phone}</div>

            {/* Divider + service */}
            <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '4px 0', padding: '4px 0' }}>
              <div style={{ fontWeight: 'bold', fontSize: isMobile ? 11 : 12, letterSpacing: 1 }}>
                {label.service_name}{label.is_express ? ' [EXPRESS]' : ''}
              </div>
              {label.qty_display && (
                <div style={{ fontSize: isMobile ? 9 : 10 }}>{label.qty_display}</div>
              )}
            </div>

            {/* QR Code */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <QRCodeView
                value={qrValue(idx)}
                size={isMobile ? 80 : 96}
                level="L"
              />
            </div>

            {/* Footer */}
            <div style={{ fontSize: isMobile ? 8 : 9, marginTop: 6, opacity: 0.7 }}>
              {label.created_date || '-'} | Item {idx + 1} dari {labels.length}
            </div>
            {label.estimated_completion && (
              <div style={{ fontSize: isMobile ? 8 : 9, opacity: 0.7 }}>
                Est: {label.estimated_completion}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
