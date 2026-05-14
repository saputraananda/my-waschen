import { useState, useEffect } from 'react';
import { C } from '../../utils/theme';
import { TopBar, Btn } from '../../components/ui';

const STORAGE_KEY = 'waschen_printer_config';

const DEFAULT_CONFIG = {
  // Printer hardware
  printerType: 'thermal_58',   // thermal_58 | thermal_80 | a4 | custom
  customWidthMm: 72,
  connectionType: 'usb',       // usb | lan | bluetooth | browser_print
  charPerLine: 32,             // 58mm ≈ 32, 80mm ≈ 48

  // Content toggles
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
  showTopupInfo: false,        // khusus nota top-up deposit

  // Barcode / QR
  barcodeEnabled: false,
  barcodeType: 'qr',          // qr | code128 | code39

  // Header / footer text
  outletName: 'MY WASCHEN',
  outletTagline: 'Clean, Fast, Reliable',
  outletAddress: '',
  outletPhone: '',
  footerText: 'Terima kasih! Cucian >30 hari bukan tanggung jawab kami.',

  // Print copies
  copies: 1,
  printLabel: true,            // cetak label produksi (halaman 2)
};

const PRINTER_TYPES = [
  { value: 'thermal_58', label: '58 mm', sub: '~32 karakter/baris', icon: '🖨️' },
  { value: 'thermal_80', label: '80 mm', sub: '~48 karakter/baris', icon: '🖨️' },
  { value: 'a4',         label: 'A4',    sub: 'Printer biasa', icon: '📄' },
  { value: 'custom',     label: 'Custom', sub: 'Lebar manual', icon: '✏️' },
];

const CONNECTION_TYPES = [
  { value: 'browser_print', label: 'Browser Print', sub: 'window.print() — paling mudah' },
  { value: 'usb',           label: 'USB Direct',    sub: 'Perlu bridge/driver lokal' },
  { value: 'lan',           label: 'LAN / IP',      sub: 'Printer jaringan' },
  { value: 'bluetooth',     label: 'Bluetooth',     sub: 'Printer BT mobile' },
];

const CONTENT_FIELDS = [
  { key: 'showCustomerName',    label: 'Nama Customer',        group: 'customer' },
  { key: 'showCustomerPhone',   label: 'No. HP Customer',      group: 'customer' },
  { key: 'showCustomerAddress', label: 'Alamat Customer',      group: 'customer' },
  { key: 'showCashierName',     label: 'Nama Kasir',           group: 'transaksi' },
  { key: 'showTransactionNo',   label: 'No. Nota',             group: 'transaksi' },
  { key: 'showTransactionDate', label: 'Tanggal Transaksi',    group: 'transaksi' },
  { key: 'showEstimatedDone',   label: 'Tanggal Estimasi Selesai', group: 'transaksi' },
  { key: 'showFragrance',       label: 'Parfum / Wewangian',   group: 'layanan' },
  { key: 'showNotes',           label: 'Catatan Transaksi',    group: 'layanan' },
  { key: 'showPaymentMethod',   label: 'Metode Pembayaran',    group: 'pembayaran' },
  { key: 'showChange',          label: 'Kembalian',            group: 'pembayaran' },
  { key: 'showDeliveryFee',     label: 'Biaya Pengiriman',     group: 'pembayaran' },
  { key: 'showMemberDiscount',  label: 'Diskon Member',        group: 'pembayaran' },
  { key: 'showTopupInfo',       label: 'Info Top-Up Deposit',  group: 'member' },
];

const GROUP_LABELS = {
  customer:    '👤 Data Customer',
  transaksi:   '🧾 Info Transaksi',
  layanan:     '🧺 Detail Layanan',
  pembayaran:  '💵 Pembayaran',
  member:      '💳 Member / Deposit',
};

const TABS = ['Printer', 'Konten Nota', 'Header & Footer', 'Preview'];

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? C.primary : C.n300,
        position: 'relative', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: 9, background: 'white',
        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }} />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
      {title && <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' }}>{title}</div>}
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', height: 40, borderRadius: 10,
  border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins',
  fontSize: 13, padding: '0 12px', boxSizing: 'border-box',
};

// ── Live Receipt Preview ────────────────────────────────────────────────────
function ReceiptPreview({ cfg }) {
  const w = cfg.printerType === 'thermal_58' ? 220
           : cfg.printerType === 'thermal_80' ? 300
           : cfg.printerType === 'a4'         ? 400
           : cfg.customWidthMm * 2.5;

  const dash = '─'.repeat(Math.min(cfg.charPerLine || 32, 48));

  const row = (l, r, bold = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <span style={{ opacity: 0.75 }}>{l}</span>
      <span style={{ fontWeight: bold ? 'bold' : 'normal' }}>{r}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 24px' }}>
      <div style={{
        width: w, background: 'white', fontFamily: 'monospace', fontSize: 11,
        color: '#111', padding: '16px 14px', borderRadius: 4,
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)', lineHeight: 1.6,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 'bold', fontSize: 15 }}>{cfg.outletName || 'MY WASCHEN'}</div>
          {cfg.outletTagline && <div style={{ fontSize: 10 }}>{cfg.outletTagline}</div>}
          {cfg.outletAddress && <div style={{ fontSize: 9, opacity: 0.7 }}>{cfg.outletAddress}</div>}
          {cfg.outletPhone && <div style={{ fontSize: 9, opacity: 0.7 }}>Telp: {cfg.outletPhone}</div>}
        </div>
        <div style={{ borderTop: '1px dashed #555', margin: '6px 0' }} />

        {/* Customer */}
        {cfg.showCustomerName    && row('Pelanggan:', 'Budi Santoso', true)}
        {cfg.showCustomerPhone   && row('HP:', '0812-3456-7890')}
        {cfg.showCustomerAddress && row('Alamat:', 'Jl. Mawar No.5')}
        {cfg.showTransactionNo   && row('No. Nota:', 'WSN-20260514-001', true)}
        {cfg.showCashierName     && row('Kasir:', 'Dewi')}
        {cfg.showTransactionDate && row('Tgl Masuk:', '14 Mei 2026 10:00')}
        {cfg.showEstimatedDone   && row('Est. Selesai:', '16 Mei 2026 12:00')}
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
        {cfg.showDeliveryFee    && row('Ongkir:', 'Rp 10.000')}
        {row('TOTAL:', 'Rp 57.200', true)}
        {cfg.showPaymentMethod  && row('Bayar (Tunai):', 'Rp 60.000')}
        {cfg.showChange         && row('Kembalian:', 'Rp 2.800')}
        {cfg.showTopupInfo      && <div style={{ fontSize: 10, marginTop: 4, padding: '4px 6px', border: '1px dashed #999', textAlign: 'center' }}>Top-Up Deposit: Rp 200.000 → Saldo: Rp 450.000</div>}
        {cfg.showNotes          && <div style={{ marginTop: 6, fontSize: 10, opacity: 0.8 }}>Catatan: Lipat rapi, pisah putih</div>}

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
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PrinterSettingsPage({ navigate, goBack }) {
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

  const set = (key, val) => setCfg(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (!window.confirm('Reset ke pengaturan default?')) return;
    setCfg({ ...DEFAULT_CONFIG });
    localStorage.removeItem(STORAGE_KEY);
  };

  // Update charPerLine otomatis saat ganti printer type
  useEffect(() => {
    if (cfg.printerType === 'thermal_58') set('charPerLine', 32);
    else if (cfg.printerType === 'thermal_80') set('charPerLine', 48);
    else if (cfg.printerType === 'a4') set('charPerLine', 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.printerType]);

  const groupedFields = CONTENT_FIELDS.reduce((acc, f) => {
    if (!acc[f.group]) acc[f.group] = [];
    acc[f.group].push(f);
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Pengaturan Printer"
        subtitle="Sesuaikan printer thermal & konten nota"
        onBack={goBack}
      />

      {/* Tab bar */}
      <div style={{ background: 'white', borderBottom: `1px solid ${C.n100}`, display: 'flex', overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTab(i)}
            style={{
              flex: 1, minWidth: 80, padding: '12px 8px', fontFamily: 'Poppins', fontSize: 12, fontWeight: activeTab === i ? 700 : 500,
              color: activeTab === i ? C.primary : C.n600,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2.5px solid ${activeTab === i ? C.primary : 'transparent'}`,
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── TAB 0: PRINTER ── */}
        {activeTab === 0 && (
          <>
            <Section title="Ukuran Kertas">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PRINTER_TYPES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => set('printerType', p.value)}
                    style={{
                      padding: '12px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      border: `2px solid ${cfg.printerType === p.value ? C.primary : C.n200}`,
                      background: cfg.printerType === p.value ? `${C.primary}10` : 'white',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: cfg.printerType === p.value ? C.primary : C.n900 }}>{p.label}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{p.sub}</div>
                  </button>
                ))}
              </div>
              {cfg.printerType === 'custom' && (
                <Field label="Lebar Kertas (mm)">
                  <input type="number" value={cfg.customWidthMm} onChange={e => set('customWidthMm', Number(e.target.value))} style={inputStyle} min={40} max={200} />
                </Field>
              )}
            </Section>

            <Section title="Karakter per Baris">
              <Field label={`Lebar cetak: ${cfg.charPerLine} karakter/baris`}>
                <input
                  type="range" min={24} max={80} value={cfg.charPerLine}
                  onChange={e => set('charPerLine', Number(e.target.value))}
                  style={{ width: '100%', accentColor: C.primary }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 2 }}>
                  <span>24 (sempit)</span><span>80 (lebar)</span>
                </div>
              </Field>
            </Section>

            <Section title="Koneksi Printer">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CONNECTION_TYPES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => set('connectionType', c.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      border: `2px solid ${cfg.connectionType === c.value ? C.primary : C.n200}`,
                      background: cfg.connectionType === c.value ? `${C.primary}10` : 'white',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 10,
                      border: `2px solid ${cfg.connectionType === c.value ? C.primary : C.n300}`,
                      background: cfg.connectionType === c.value ? C.primary : 'white', flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{c.label}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>{c.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
              {cfg.connectionType === 'browser_print' && (
                <div style={{ marginTop: 10, padding: 10, background: '#EFF6FF', borderRadius: 10, fontFamily: 'Poppins', fontSize: 11, color: '#1D4ED8', lineHeight: 1.6 }}>
                  💡 Mode Browser Print menggunakan <code>window.print()</code>. Atur ukuran kertas di dialog print browser sesuai printer fisik.
                </div>
              )}
            </Section>

            <Section title="Opsi Cetak">
              <Field label="Jumlah Salinan">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => set('copies', Math.max(1, cfg.copies - 1))} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${C.n200}`, background: 'white', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 18, fontWeight: 700 }}>−</button>
                  <span style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{cfg.copies}</span>
                  <button onClick={() => set('copies', Math.min(5, cfg.copies + 1))} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${C.n200}`, background: 'white', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 18, fontWeight: 700 }}>+</button>
                </div>
              </Field>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${C.n100}` }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>Cetak Label Produksi</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Halaman 2: label per unit cucian</div>
                </div>
                <Toggle value={cfg.printLabel} onChange={v => set('printLabel', v)} />
              </div>
            </Section>

            <Section title="Barcode / QR Code">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cfg.barcodeEnabled ? 12 : 0 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>Tampilkan Barcode / QR</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Dicetak di bawah nota untuk scan cepat</div>
                </div>
                <Toggle value={cfg.barcodeEnabled} onChange={v => set('barcodeEnabled', v)} />
              </div>
              {cfg.barcodeEnabled && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['qr', 'QR Code'], ['code128', 'Code 128'], ['code39', 'Code 39']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => set('barcodeType', val)}
                      style={{
                        flex: 1, padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                        border: `2px solid ${cfg.barcodeType === val ? C.primary : C.n200}`,
                        background: cfg.barcodeType === val ? `${C.primary}10` : 'white',
                        fontFamily: 'Poppins', fontSize: 11, fontWeight: cfg.barcodeType === val ? 700 : 500,
                        color: cfg.barcodeType === val ? C.primary : C.n700,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

        {/* ── TAB 1: KONTEN NOTA ── */}
        {activeTab === 1 && (
          <>
            {Object.entries(groupedFields).map(([group, fields]) => (
              <Section key={group} title={GROUP_LABELS[group] || group}>
                {fields.map((f, i) => (
                  <div
                    key={f.key}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '11px 0',
                      borderBottom: i < fields.length - 1 ? `1px solid ${C.n100}` : 'none',
                    }}
                  >
                    <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n800 }}>{f.label}</span>
                    <Toggle value={!!cfg[f.key]} onChange={v => set(f.key, v)} />
                  </div>
                ))}
              </Section>
            ))}
          </>
        )}

        {/* ── TAB 2: HEADER & FOOTER ── */}
        {activeTab === 2 && (
          <Section>
            <Field label="Nama Outlet / Toko">
              <input value={cfg.outletName} onChange={e => set('outletName', e.target.value)} style={inputStyle} placeholder="MY WASCHEN" />
            </Field>
            <Field label="Tagline">
              <input value={cfg.outletTagline} onChange={e => set('outletTagline', e.target.value)} style={inputStyle} placeholder="Clean, Fast, Reliable" />
            </Field>
            <Field label="Alamat Outlet">
              <textarea
                value={cfg.outletAddress}
                onChange={e => set('outletAddress', e.target.value)}
                rows={2}
                placeholder="Jl. Kemang Raya No. 45, Jakarta"
                style={{ ...inputStyle, height: 'auto', padding: 10, resize: 'vertical' }}
              />
            </Field>
            <Field label="No. Telepon Outlet">
              <input value={cfg.outletPhone} onChange={e => set('outletPhone', e.target.value)} style={inputStyle} placeholder="021-xxxx-xxxx" />
            </Field>
            <Field label="Teks Footer Nota">
              <textarea
                value={cfg.footerText}
                onChange={e => set('footerText', e.target.value)}
                rows={3}
                placeholder="Terima kasih telah mencuci di My Waschen..."
                style={{ ...inputStyle, height: 'auto', padding: 10, resize: 'vertical' }}
              />
            </Field>
          </Section>
        )}

        {/* ── TAB 3: PREVIEW ── */}
        {activeTab === 3 && (
          <>
            <div style={{ textAlign: 'center', fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginBottom: 8 }}>
              Preview dengan data contoh · Lebar: {
                cfg.printerType === 'thermal_58' ? '58mm'
                : cfg.printerType === 'thermal_80' ? '80mm'
                : cfg.printerType === 'a4' ? 'A4'
                : `${cfg.customWidthMm}mm`
              }
            </div>
            <ReceiptPreview cfg={cfg} />
            <Btn variant="primary" fullWidth onClick={() => { window.print(); }}>
              🖨️ Test Cetak Sekarang
            </Btn>
          </>
        )}

        {/* Save / Reset buttons */}
        {activeTab < 3 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              onClick={handleReset}
              style={{ flex: 0, padding: '10px 16px', borderRadius: 12, border: `1.5px solid ${C.n200}`, background: 'white', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600 }}
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: saved ? '#16A34A' : C.primary, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: 'white', transition: 'background 0.2s' }}
            >
              {saved ? '✓ Tersimpan!' : 'Simpan Pengaturan'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
