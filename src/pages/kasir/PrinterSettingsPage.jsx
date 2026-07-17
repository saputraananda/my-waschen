import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../../utils/theme';
import { TopBar, Btn } from '../../components/ui';
import { useResponsive } from '../../utils/hooks';
import { alertSuccess, alertError, confirmAction } from '../../utils/alert';
import {
  isBluetoothAvailable,
  getPrinterStatus,
  connectPrinter,
  getSavedPrinter,
  clearSavedPrinter,
  savePrinterConfig,
  getPairedDevices,
} from '../../utils/printService';

const STORAGE_KEY = 'waschen_printer_config';

// ── Glass Styles ─────────────────────────────────────────────────────────────
const GLASS_STYLES = `
  :root {
    --glass-bg: #F3EEF7;
    --glass: rgba(255, 255, 255, 0.7);
    --glass-strong: rgba(255, 255, 255, 0.85);
  }
`;

function useGlassStyles() {
  useEffect(() => {
    const styleId = 'printer-settings-glass';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = GLASS_STYLES;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
}

// ── Default Config ────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  printerType: 'thermal_58',
  customWidthMm: 72,
  connectionType: 'usb',
  charPerLine: 32,
  showCustomerName: true,
  showCustomerPhone: true,
  showCustomerAddress: false,
  showCashierName: true,
  showTransactionNo: true,
  showTransactionDate: true,
  showEstimatedDone: true,
  showFragrance: true,
  showNotes: true,
  showPaymentMethod: true,
  showChange: true,
  showDeliveryFee: true,
  showMemberDiscount: true,
  showTopupInfo: false,
  barcodeEnabled: false,
  barcodeType: 'qr',
  outletName: 'MY WASCHEN',
  outletTagline: 'Clean, Fast, Reliable',
  outletAddress: '',
  outletPhone: '',
  footerText: 'Terima kasih! Cucian >30 hari bukan tanggung jawab kami.',
  copies: 1,
  printLabel: true,
};

const PRINTER_TYPES = [
  { value: 'thermal_58', label: '58 mm', sub: '~32 karakter/baris', icon: null },
  { value: 'thermal_80', label: '80 mm', sub: '~48 karakter/baris', icon: null },
  { value: 'a4', label: 'A4', sub: 'Printer biasa', icon: null },
  { value: 'custom', label: 'Custom', sub: 'Lebar manual', icon: null },
];

const CONTENT_FIELDS = [
  { key: 'showCustomerName', label: 'Nama Customer', group: 'customer' },
  { key: 'showCustomerPhone', label: 'No. HP Customer', group: 'customer' },
  { key: 'showCustomerAddress', label: 'Alamat Customer', group: 'customer' },
  { key: 'showCashierName', label: 'Nama Kasir', group: 'transaksi' },
  { key: 'showTransactionNo', label: 'No. Nota', group: 'transaksi' },
  { key: 'showTransactionDate', label: 'Tanggal Transaksi', group: 'transaksi' },
  { key: 'showEstimatedDone', label: 'Tanggal Estimasi Selesai', group: 'transaksi' },
  { key: 'showFragrance', label: 'Parfum / Wewangian', group: 'layanan' },
  { key: 'showNotes', label: 'Catatan Transaksi', group: 'layanan' },
  { key: 'showPaymentMethod', label: 'Metode Pembayaran', group: 'pembayaran' },
  { key: 'showChange', label: 'Kembalian', group: 'pembayaran' },
  { key: 'showDeliveryFee', label: 'Biaya Pengiriman', group: 'pembayaran' },
  { key: 'showMemberDiscount', label: 'Diskon Member', group: 'pembayaran' },
  { key: 'showTopupInfo', label: 'Info Top-Up Deposit', group: 'member' },
];

const GROUP_LABELS = {
  customer: 'Data Customer',
  transaksi: 'Info Transaksi',
  layanan: 'Detail Layanan',
  pembayaran: 'Pembayaran',
  member: 'Member / Deposit',
};

const TABS = ['Printer', 'Konten Nota', 'Header & Footer', 'Preview'];

// ── Clay Card ─────────────────────────────────────────────────────────────────
const ClayCard = ({ children, style, onClick, padding = 16 }) => (
  <motion.div
    whileHover={onClick ? { y: -2 } : {}}
    whileTap={onClick ? { scale: 0.99 } : {}}
    onClick={onClick}
    style={{
      background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
      borderRadius: 18,
      padding: padding,
      boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.08)',
      ...style,
    }}
  >
    {children}
  </motion.div>
);

// ── Clay Icon Box ──────────────────────────────────────────────────────────────
const ClayIcon = ({ icon, color = C.primary, size = 40 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.28,
      background: `linear-gradient(145deg, ${color}20, ${color}08)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: color,
      fontSize: size * 0.45,
      boxShadow: `3px 3px 8px ${color}15, -1px -1px 4px rgba(255, 255, 255, 0.9)`,
    }}
  >
    {icon}
  </div>
);

// ── Toggle Switch ─────────────────────────────────────────────────────────────
const Toggle = ({ value, onChange }) => (
  <motion.div
    onClick={() => onChange(!value)}
    whileTap={{ scale: 0.95 }}
    style={{
      width: 48, height: 26, borderRadius: 13,
      background: value ? C.primary : C.n300,
      position: 'relative', cursor: 'pointer', flexShrink: 0,
      transition: 'background 0.2s',
    }}
  >
    <motion.div
      animate={{ x: value ? 24 : 2 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      style={{
        position: 'absolute', top: 3, left: 0,
        width: 20, height: 20, borderRadius: 10, background: C.white,
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }}
    />
  </motion.div>
);

// ── Section Title ─────────────────────────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <div style={{
    fontFamily: "'Poppins'",
    fontSize: 11,
    fontWeight: 700,
    color: C.n600,
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  }}>
    {children}
  </div>
);

// ── Input Field ───────────────────────────────────────────────────────────────
const Input = ({ label, value, onChange, placeholder, type = 'text', rows, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {label && (
      <div style={{
        fontFamily: "'Poppins'",
        fontSize: 11,
        fontWeight: 600,
        color: C.n600,
      }}>
        {label}
      </div>
    )}
    {rows ? (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 12,
          border: `1.5px solid ${C.n200}`,
          background: C.white,
          fontFamily: "'Poppins'",
          fontSize: 13,
          color: C.n900,
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
          ...style,
        }}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 44,
          padding: '0 14px',
          borderRadius: 12,
          border: `1.5px solid ${C.n200}`,
          background: C.white,
          fontFamily: "'Poppins'",
          fontSize: 13,
          color: C.n900,
          outline: 'none',
          boxSizing: 'border-box',
          ...style,
        }}
      />
    )}
  </div>
);

// ── Primary Button ────────────────────────────────────────────────────────────
const PrimaryBtn = ({ children, onClick, loading, disabled, style, fullWidth }) => (
  <motion.button
    onClick={onClick}
    disabled={disabled || loading}
    whileHover={disabled ? {} : { scale: 1.02, y: -1 }}
    whileTap={disabled ? {} : { scale: 0.97 }}
    style={{
      width: fullWidth ? '100%' : 'auto',
      height: 48,
      padding: '0 24px',
      borderRadius: 14,
      border: 'none',
      background: disabled
        ? C.n300
        : 'linear-gradient(145deg, #6B2D7E, #4A1A59)',
      color: 'white',
      fontFamily: "'Poppins'",
      fontSize: 14,
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled
        ? 'none'
        : '-4px -4px 10px rgba(255, 255, 255, 0.4), 5px 6px 14px rgba(59, 11, 71, 0.35)',
      ...style,
    }}
  >
    {loading ? 'Memuat...' : children}
  </motion.button>
);

// ── Secondary Button ───────────────────────────────────────────────────────────
const SecondaryBtn = ({ children, onClick, style, fullWidth }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.97 }}
    style={{
      width: fullWidth ? '100%' : 'auto',
      height: 44,
      padding: '0 20px',
      borderRadius: 12,
      border: `1.5px solid ${C.n200}`,
      background: 'linear-gradient(145deg, #F5E9FB, #E9D3F2)',
      color: C.primary,
      fontFamily: "'Poppins'",
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      boxShadow: '-4px -4px 10px rgba(255, 255, 255, 0.6), 5px 6px 14px rgba(59, 11, 71, 0.2)',
      ...style,
    }}
  >
    {children}
  </motion.button>
);

// ── Success Button ─────────────────────────────────────────────────────────────
const SuccessBtn = ({ children, onClick, style, fullWidth }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.02, y: -1 }}
    whileTap={{ scale: 0.97 }}
    style={{
      width: fullWidth ? '100%' : 'auto',
      height: 48,
      padding: '0 24px',
      borderRadius: 14,
      border: 'none',
      background: 'linear-gradient(145deg, #5FD9AE 0%, #1F9E75 100%)',
      color: 'white',
      fontFamily: "'Poppins'",
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      boxShadow: '-4px -4px 10px rgba(255, 255, 255, 0.6), 5px 6px 14px rgba(31, 158, 117, 0.4)',
      ...style,
    }}
  >
    {children}
  </motion.button>
);

// ── Tab Button ────────────────────────────────────────────────────────────────
const TabButton = ({ label, active, onClick }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.97 }}
    style={{
      flex: 1,
      minWidth: 80,
      padding: '12px 8px',
      fontFamily: "'Poppins'",
      fontSize: 12,
      fontWeight: active ? 700 : 500,
      color: active ? C.primary : C.n600,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      borderBottom: `2.5px solid ${active ? C.primary : 'transparent'}`,
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </motion.button>
);

// ── Live Receipt Preview ──────────────────────────────────────────────────────
function ReceiptPreview({ cfg }) {
  const w = cfg.printerType === 'thermal_58' ? 220
    : cfg.printerType === 'thermal_80' ? 300
    : cfg.printerType === 'a4' ? 400
    : cfg.customWidthMm * 2.5;

  const row = (l, r, bold = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <span style={{ opacity: 0.75 }}>{l}</span>
      <span style={{ fontWeight: bold ? 'bold' : 'normal' }}>{r}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 24px' }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          width: w,
          background: 'white',
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#111',
          padding: '16px 14px',
          borderRadius: 4,
          boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          lineHeight: 1.6,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 'bold', fontSize: 15 }}>{cfg.outletName || 'MY WASCHEN'}</div>
          {cfg.outletTagline && <div style={{ fontSize: 10 }}>{cfg.outletTagline}</div>}
          {cfg.outletAddress && <div style={{ fontSize: 9, opacity: 0.7 }}>{cfg.outletAddress}</div>}
          {cfg.outletPhone && <div style={{ fontSize: 9, opacity: 0.7 }}>Telp: {cfg.outletPhone}</div>}
        </div>
        <div style={{ borderTop: '1px dashed #555', margin: '6px 0' }} />

        {/* Customer */}
        {cfg.showCustomerName && row('Pelanggan:', 'Budi Santoso', true)}
        {cfg.showCustomerPhone && row('HP:', '0812-3456-7890')}
        {cfg.showCustomerAddress && row('Alamat:', 'Jl. Mawar No.5')}
        {cfg.showTransactionNo && row('No. Nota:', 'WSN-20260514-001', true)}
        {cfg.showCashierName && row('Kasir:', 'Dewi')}
        {cfg.showTransactionDate && row('Tgl Masuk:', '14 Mei 2026 10:00')}
        {cfg.showEstimatedDone && row('Est. Selesai:', '16 Mei 2026 12:00')}
        <div style={{ borderTop: '1px dashed #555', margin: '6px 0' }} />

        {/* Items */}
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>LAYANAN:</div>
        <div style={{ marginBottom: 2 }}>Cuci Setrika (Express)</div>
        {cfg.showFragrance && <div style={{ fontSize: 10, opacity: 0.7, marginLeft: 8 }}>Parfum: Lavender</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>  2 kg × Rp 7.000</span><span>Rp 14.000</span>
        </div>
        <div style={{ marginBottom: 2, marginTop: 4 }}>Dry Cleaning Jas</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>  1 pcs × Rp 45.000</span><span>Rp 45.000</span>
        </div>
        <div style={{ borderTop: '1px dashed #555', margin: '6px 0' }} />

        {/* Totals */}
        {row('Subtotal:', 'Rp 59.000')}
        {cfg.showMemberDiscount && row('Diskon Member 20%:', '-Rp 11.800')}
        {cfg.showDeliveryFee && row('Ongkir:', 'Rp 10.000')}
        {row('TOTAL:', 'Rp 57.200', true)}
        {cfg.showPaymentMethod && row('Bayar (Tunai):', 'Rp 60.000')}
        {cfg.showChange && row('Kembalian:', 'Rp 2.800')}
        {cfg.showTopupInfo && (
          <div style={{ fontSize: 10, marginTop: 4, padding: '4px 6px', border: '1px dashed #999', textAlign: 'center' }}>
            Top-Up Deposit: Rp 200.000 → Saldo: Rp 450.000
          </div>
        )}
        {cfg.showNotes && <div style={{ marginTop: 6, fontSize: 10, opacity: 0.8 }}>Catatan: Lipat rapi, pisah putih</div>}

        {/* Barcode placeholder */}
        {cfg.barcodeEnabled && (
          <div style={{ textAlign: 'center', margin: '10px 0', padding: '8px', border: '1px dashed #999' }}>
            <div style={{ fontSize: 9, opacity: 0.6 }}>[{cfg.barcodeType.toUpperCase()} — WSN-20260514-001]</div>
            <div style={{ fontWeight: 'bold', letterSpacing: 4, fontSize: 14, marginTop: 4 }}>▮▯▮▯▮▮▯▯▮▯▮</div>
          </div>
        )}

        <div style={{ borderTop: '1px dashed #555', margin: '6px 0' }} />
        <div style={{ textAlign: 'center', fontSize: 10, opacity: 0.75 }}>
          {cfg.footerText || 'Terima kasih!'}
        </div>
      </motion.div>
    </div>
  );
}

// ── Auto Connect Card ────────────────────────────────────────────────────────────
function AutoConnectCard({
  onAutoConnect,
  onConnectSelected,
  onForgetPrinter,
  connecting,
  btAvailable,
  savedPrinter,
  printerConnected,
  pairedDevices,
  selectedDeviceId,
  onSelectDevice,
  loadingPaired,
}) {
  const selectedDevice = pairedDevices.find(d => d.deviceId === selectedDeviceId);
  const hasDevices = pairedDevices.length > 0;

  return (
    <ClayCard padding={16}>
      <SectionTitle>📡 Koneksi Printer</SectionTitle>

      {/* Status */}
      <div style={{
        padding: 16,
        background: printerConnected ? '#F0FDF4' : C.n50,
        borderRadius: 12,
        marginBottom: 12,
      }}>
        {printerConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: '#22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}>
              ✅
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 600, color: C.n900 }}>
                {savedPrinter?.name || 'Printer'}
              </div>
              <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: '#22C55E' }}>
                Terhubung • Siap cetak
              </div>
            </div>
          </div>
        ) : savedPrinter ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}>
              ⚡
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 600, color: C.n900 }}>
                {savedPrinter.name}
              </div>
              <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n500 }}>
                Tersimpan • Tap Connect untuk hubungkan
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: C.n200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}>
              📡
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 600, color: C.n900 }}>
                Belum ada printer
              </div>
              <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n500 }}>
                Pilih atau hubungkan printer baru
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Dropdown: Daftar Printer Tersimpan ── */}
      {btAvailable && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: "'Poppins'",
            fontSize: 10,
            fontWeight: 600,
            color: C.n500,
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            📋 Printer Tersimpan
          </div>

          {loadingPaired ? (
            <div style={{
              padding: '12px 14px',
              background: C.n50,
              borderRadius: 10,
              fontFamily: "'Poppins'",
              fontSize: 12,
              color: C.n500,
              textAlign: 'center',
            }}>
              ⏳ Memuat daftar printer...
            </div>
          ) : !hasDevices ? (
            <div style={{
              padding: '12px 14px',
              background: C.n50,
              borderRadius: 10,
              fontFamily: "'Poppins'",
              fontSize: 12,
              color: C.n500,
              textAlign: 'center',
            }}>
              Tidak ada printer tersimpan.<br />Hubungkan printer baru di bawah.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pairedDevices.map(device => (
                <div
                  key={device.deviceId}
                  onClick={() => onSelectDevice(device.deviceId)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `2px solid ${selectedDeviceId === device.deviceId ? '#7C3AED' : C.n200}`,
                    background: selectedDeviceId === device.deviceId ? '#F5F3FF' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Radio indicator */}
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      border: `2px solid ${selectedDeviceId === device.deviceId ? '#7C3AED' : C.n300}`,
                      background: selectedDeviceId === device.deviceId ? '#7C3AED' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {selectedDeviceId === device.deviceId && (
                        <div style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Poppins'",
                        fontSize: 12,
                        fontWeight: 600,
                        color: selectedDeviceId === device.deviceId ? '#7C3AED' : C.n900,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {device.name}
                      </div>
                      <div style={{
                        fontFamily: "'Poppins'",
                        fontSize: 10,
                        color: device.connected ? '#22C55E' : C.n400,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        {device.connected ? '🟢 Terhubung' : '⚪ Tersimpan'}
                        {device.macAddress && (
                          <span style={{ color: C.n300 }}>• {device.macAddress}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Connect Button */}
      <PrimaryBtn
        onClick={onAutoConnect}
        disabled={connecting || !btAvailable}
        fullWidth
        style={{ marginBottom: 8 }}
      >
        {connecting ? '⏳ Menghubungkan...' : printerConnected ? '🔄 Reconnect' : '🔗 Hubungkan Printer'}
      </PrimaryBtn>

      {/* Action row: Connect selected + Forget */}
      {hasDevices && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onConnectSelected}
            disabled={connecting || !selectedDeviceId}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              border: 'none',
              background: selectedDevice?.connected ? C.n50 : '#7C3AED',
              color: selectedDevice?.connected ? C.n600 : '#fff',
              fontFamily: "'Poppins'",
              fontSize: 12,
              fontWeight: 600,
              cursor: selectedDevice?.connected || connecting ? 'default' : 'pointer',
              opacity: !selectedDeviceId || connecting ? 0.5 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {selectedDevice?.connected ? '✓ Sudah Terhubung' : '▶ Connect'}
          </button>
          <button
            onClick={onForgetPrinter}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: `1.5px solid ${C.n200}`,
              background: '#fff',
              color: C.n500,
              fontFamily: "'Poppins'",
              fontSize: 12,
              cursor: 'pointer',
            }}
            title="Hapus printer dari daftar"
          >
            🗑️
          </button>
        </div>
      )}

      {!btAvailable && (
        <div style={{
          padding: 8,
          background: '#FEF3C7',
          borderRadius: 8,
          fontFamily: "'Poppins'",
          fontSize: 10,
          color: '#92400E',
          textAlign: 'center',
        }}>
          ⚠️ Gunakan Chrome untuk mendukung Bluetooth
        </div>
      )}
    </ClayCard>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PrinterSettingsPage({ navigate, goBack }) {
  useGlassStyles();
  const { isMobile } = useResponsive();

  const [cfg, setCfg] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  });

  const [activeTab, setActiveTab] = useState(0);
  const [saved, setSaved] = useState(false);

  // Printer connection state
  const [printerConnected, setPrinterConnected] = useState(false);
  const [savedBluetoothPrinter, setSavedBluetoothPrinter] = useState(null);
  const [btAvailable, setBtAvailable] = useState(false);
  const [autoConnecting, setAutoConnecting] = useState(false);
  // Paired devices dropdown
  const [pairedDevices, setPairedDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [loadingPaired, setLoadingPaired] = useState(false);

  // Check printer status & load paired devices on mount
  useEffect(() => {
    checkPrinterStatus();
    checkBluetooth();
    loadPairedDevices();
  }, []);

  // Refresh paired devices list
  const loadPairedDevices = async () => {
    setLoadingPaired(true);
    try {
      const devices = await getPairedDevices();
      setPairedDevices(devices);

      // Auto-select current saved printer
      const saved = getSavedPrinter();
      if (saved?.deviceId) {
        setSelectedDeviceId(saved.deviceId);
      } else if (devices.length > 0) {
        setSelectedDeviceId(devices[0].deviceId);
      }
    } catch (e) {
      console.warn('[Printer] getPairedDevices failed:', e);
    }
    setLoadingPaired(false);
  };

  const checkBluetooth = () => {
    const available = isBluetoothAvailable();
    setBtAvailable(available);
    if (available) {
      const saved = getSavedPrinter();
      setSavedBluetoothPrinter(saved);
    }
  };

  const handleAutoConnect = async () => {
    setAutoConnecting(true);
    try {
      const result = await connectPrinter();
      if (result.success) {
        setPrinterConnected(true);
        alertSuccess(`Printer ${result.name || 'Bluetooth'} terhubung!`);
        const saved = getSavedPrinter();
        setSavedBluetoothPrinter(saved);
        // Refresh paired devices list (might now show as connected)
        await loadPairedDevices();
      } else {
        alertError(result.error || 'Tidak ada printer ditemukan');
      }
    } catch (err) {
      alertError(err.message);
    } finally {
      setAutoConnecting(false);
    }
  };

  // Connect to a specific selected device from dropdown
  const handleConnectSelected = async () => {
    if (!selectedDeviceId) {
      alertError('Pilih printer dulu dari daftar');
      return;
    }
    setAutoConnecting(true);
    try {
      const result = await connectPrinter(selectedDeviceId);
      if (result.success) {
        setPrinterConnected(true);
        alertSuccess(`Printer ${result.name} terhubung!`);
        const saved = getSavedPrinter();
        setSavedBluetoothPrinter(saved);
        await loadPairedDevices();
      } else {
        alertError(result.error || 'Gagal menghubungkan');
      }
    } catch (err) {
      alertError(err.message);
    } finally {
      setAutoConnecting(false);
    }
  };

  // Forgot saved printer
  const handleForgetPrinter = async () => {
    const ok = await confirmAction({ text: 'Hapus printer tersimpan? Kamu perlu pairing ulang.' });
    if (!ok) return;
    clearSavedPrinter();
    setSavedBluetoothPrinter(null);
    setSelectedDeviceId(null);
    setPrinterConnected(false);
    await loadPairedDevices();
    alertSuccess('Printer berhasil dihapus dari daftar');
  };

  const checkPrinterStatus = () => {
    const status = getPrinterStatus();
    setPrinterConnected(status.connected);
    const saved = status.savedDevice || getSavedPrinter();
    setSavedBluetoothPrinter(saved);
  };

  const set = (key, val) => setCfg(prev => ({ ...prev, [key]: val }));

  // Save settings to localStorage AND update printService immediately
  const handleSave = async () => {
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    // Also update printService immediately for instant effect
    try {
      const { savePrinterConfig } = await import('../../utils/printService');
      savePrinterConfig(cfg);
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    alertSuccess('Pengaturan berhasil disimpan!');
  };

  const handleReset = async () => {
    const ok = await confirmAction({ text: 'Reset ke pengaturan default?' });
    if (!ok) return;
    setCfg({ ...DEFAULT_CONFIG });
    localStorage.removeItem(STORAGE_KEY);
    alertSuccess('Pengaturan berhasil direset.');
  };

  // Update charPerLine otomatis saat ganti printer type
  useEffect(() => {
    const defaults = { thermal_58: 32, thermal_80: 48, a4: 80 };
    const defaultVal = defaults[cfg.printerType];
    if (defaultVal !== undefined) {
      setCfg(prev => prev.charPerLine !== defaultVal ? { ...prev, charPerLine: defaultVal } : prev);
    }
  }, [cfg.printerType]);

  const groupedFields = CONTENT_FIELDS.reduce((acc, f) => {
    if (!acc[f.group]) acc[f.group] = [];
    acc[f.group].push(f);
    return acc;
  }, {});

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--glass-bg)',
      overflow: 'hidden',
    }}>
      <TopBar
        title="Pengaturan Printer"
        subtitle="Sesuaikan printer thermal & konten nota"
        onBack={goBack}
      />

      {/* Tab bar */}
      <div style={{
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(18px)',
        borderBottom: `1px solid ${C.n200}`,
        display: 'flex',
        overflowX: 'auto',
      }}>
        {TABS.map((t, i) => (
          <TabButton
            key={t}
            label={t}
            active={activeTab === i}
            onClick={() => setActiveTab(i)}
          />
        ))}
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? 12 : 16,
        paddingBottom: isMobile ? 100 : 16,
      }}>

        {/* ── TAB 0: PRINTER ── */}
        <AnimatePresence mode="wait">
          {activeTab === 0 && (
            <motion.div
              key="tab-printer"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {/* Ukuran Kertas */}
              <ClayCard padding={16}>
                <SectionTitle>Ukuran Kertas</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: 8 }}>
                  {PRINTER_TYPES.map((p, idx) => (
                    <motion.div
                      key={p.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => set('printerType', p.value)}
                      style={{
                        padding: '12px 10px',
                        borderRadius: 14,
                        cursor: 'pointer',
                        textAlign: 'center',
                        border: `2px solid ${cfg.printerType === p.value ? C.primary : C.n200}`,
                        background: cfg.printerType === p.value
                          ? `linear-gradient(145deg, ${C.primaryTint}, ${C.primaryTint}80)`
                          : `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
                        boxShadow: cfg.printerType === p.value
                          ? '0 4px 12px rgba(91, 0, 95, 0.15)'
                          : '4px 4px 10px rgba(110, 46, 120, 0.06), -2px -2px 8px rgba(255, 255, 255, 0.95)',
                      }}
                    >
                      <div style={{
                        width: 40,
                        height: 40,
                        margin: '0 auto 8px',
                        borderRadius: 10,
                        background: `linear-gradient(145deg, ${C.primary}20, ${C.primary}08)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: C.primary,
                        fontSize: 18,
                      }}>
                        🖨️
                      </div>
                      <div style={{
                        fontFamily: "'Poppins'",
                        fontSize: 13,
                        fontWeight: 600,
                        color: cfg.printerType === p.value ? C.primary : C.n900,
                      }}>
                        {p.label}
                      </div>
                      <div style={{
                        fontFamily: "'Poppins'",
                        fontSize: 10,
                        color: C.n500,
                        marginTop: 2,
                      }}>
                        {p.sub}
                      </div>
                    </motion.div>
                  ))}
                </div>
                {cfg.printerType === 'custom' && (
                  <div style={{ marginTop: 12 }}>
                    <Input
                      label="Lebar Kertas (mm)"
                      type="number"
                      value={cfg.customWidthMm}
                      onChange={e => set('customWidthMm', Number(e.target.value))}
                      min={40}
                      max={200}
                    />
                  </div>
                )}
              </ClayCard>

              {/* Karakter per Baris */}
              <ClayCard padding={16}>
                <SectionTitle>Karakter per Baris</SectionTitle>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600, color: C.n900 }}>
                    {cfg.charPerLine} karakter/baris
                  </span>
                </div>
                <input
                  type="range"
                  min={24}
                  max={80}
                  value={cfg.charPerLine}
                  onChange={e => set('charPerLine', Number(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: C.primary,
                    height: 6,
                  }}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: "'Poppins'",
                  fontSize: 10,
                  color: C.n500,
                  marginTop: 4,
                }}>
                  <span>24 (sempit)</span>
                  <span>80 (lebar)</span>
                </div>
              </ClayCard>

              {/* Koneksi Printer Bluetooth */}
              <AutoConnectCard
                onAutoConnect={handleAutoConnect}
                onConnectSelected={handleConnectSelected}
                onForgetPrinter={handleForgetPrinter}
                connecting={autoConnecting}
                btAvailable={btAvailable}
                savedPrinter={savedBluetoothPrinter}
                printerConnected={printerConnected}
                pairedDevices={pairedDevices}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                loadingPaired={loadingPaired}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TAB 1: KONTEN NOTA ── */}
        <AnimatePresence mode="wait">
          {activeTab === 1 && (
            <motion.div
              key="tab-konten"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {Object.entries(groupedFields).map(([group, fields]) => (
                <ClayCard key={group} padding={16}>
                  <SectionTitle>{GROUP_LABELS[group] || group}</SectionTitle>
                  {fields.map((f, i) => (
                    <div
                      key={f.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: i < fields.length - 1 ? `1px solid ${C.n100}` : 'none',
                      }}
                    >
                      <span style={{ fontFamily: "'Poppins'", fontSize: 13, color: C.n800 }}>
                        {f.label}
                      </span>
                      <Toggle value={!!cfg[f.key]} onChange={v => set(f.key, v)} />
                    </div>
                  ))}
                </ClayCard>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TAB 2: HEADER & FOOTER ── */}
        <AnimatePresence mode="wait">
          {activeTab === 2 && (
            <motion.div
              key="tab-header"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <ClayCard padding={16}>
                <SectionTitle>Header & Footer Nota</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Input
                    label="Nama Outlet / Toko"
                    value={cfg.outletName}
                    onChange={e => set('outletName', e.target.value)}
                    placeholder="MY WASCHEN"
                  />
                  <Input
                    label="Tagline"
                    value={cfg.outletTagline}
                    onChange={e => set('outletTagline', e.target.value)}
                    placeholder="Clean, Fast, Reliable"
                  />
                  <Input
                    label="Alamat Outlet"
                    value={cfg.outletAddress}
                    onChange={e => set('outletAddress', e.target.value)}
                    placeholder="Jl. Kemang Raya No. 45, Jakarta"
                    rows={2}
                  />
                  <Input
                    label="No. Telepon Outlet"
                    value={cfg.outletPhone}
                    onChange={e => set('outletPhone', e.target.value)}
                    placeholder="021-xxxx-xxxx"
                  />
                  <Input
                    label="Teks Footer Nota"
                    value={cfg.footerText}
                    onChange={e => set('footerText', e.target.value)}
                    placeholder="Terima kasih telah mencuci di My Waschen..."
                    rows={3}
                  />
                </div>
              </ClayCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TAB 3: PREVIEW ── */}
        <AnimatePresence mode="wait">
          {activeTab === 3 && (
            <motion.div
              key="tab-preview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <ClayCard padding={16}>
                <div style={{
                  textAlign: 'center',
                  fontFamily: "'Poppins'",
                  fontSize: 11,
                  color: C.n600,
                  marginBottom: 8,
                }}>
                  Preview dengan data contoh · Lebar: {
                    cfg.printerType === 'thermal_58' ? '58mm'
                    : cfg.printerType === 'thermal_80' ? '80mm'
                    : cfg.printerType === 'a4' ? 'A4'
                    : `${cfg.customWidthMm}mm`
                  }
                </div>
              </ClayCard>

              <ReceiptPreview cfg={cfg} />

              <div style={{ marginTop: 8 }}>
                <SuccessBtn
                  onClick={async () => {
                    try {
                      const { printTestPage } = await import('../../utils/printService');
                      if (!printerConnected) {
                        await connectPrinter();
                      }
                      await printTestPage();
                      alertSuccess('Test print berhasil!');
                    } catch (err) {
                      alertError('Gagal: ' + err.message);
                    }
                  }}
                  disabled={!btAvailable}
                  fullWidth
                >
                  {!btAvailable ? '⚠️ Bluetooth Tidak Tersedia' : printerConnected ? '🖨️ Test Print' : '🔗 Hubungkan Printer Dulu'}
                </SuccessBtn>
                <div style={{ textAlign: 'center', marginTop: 8, fontFamily: "'Poppins'", fontSize: 10, color: C.n500 }}>
                  {printerConnected ? 'Printer terhubung • Siap cetak nota' : 'Hubungkan printer untuk test print'}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save / Reset buttons */}
        {activeTab < 3 && (
          <div style={{
            display: 'flex',
            gap: 10,
            marginTop: 16,
            paddingBottom: isMobile ? 0 : 16,
          }}>
            <SecondaryBtn onClick={handleReset}>
              Reset
            </SecondaryBtn>
            <PrimaryBtn onClick={handleSave} fullWidth>
              {saved ? '✓ Tersimpan!' : 'Simpan Pengaturan'}
            </PrimaryBtn>
          </div>
        )}
      </div>
    </div>
  );
}
