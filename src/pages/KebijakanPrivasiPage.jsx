import { useState, useEffect } from 'react';
import { C, SHADOW } from '../utils/theme';
import { TopBar } from '../components/ui';

const F = { fontFamily: 'Poppins' };

// ── Section component ────────────────────────────────────────────────────────
const Section = ({ icon, number, title, children, color = C.primary }) => (
  <div style={{
    background: 'white', borderRadius: 16, padding: '16px 18px', marginBottom: 12,
    boxShadow: SHADOW.sm, border: `1px solid ${C.n100}`,
    transition: 'transform 0.2s, box-shadow 0.2s',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 11,
        background: `linear-gradient(135deg, ${color}15, ${color}25)`,
        border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...F, fontSize: 9, fontWeight: 600, color, letterSpacing: 0.6 }}>
          BAGIAN {number}
        </div>
        <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900, marginTop: 1 }}>
          {title}
        </div>
      </div>
    </div>
    <div style={{ ...F, fontSize: 12, color: C.n700, lineHeight: 1.7 }}>
      {children}
    </div>
  </div>
);

// ── Bullet item ──────────────────────────────────────────────────────────────
const Bullet = ({ icon, label, children }) => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 8, paddingLeft: 2 }}>
    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
    <div style={{ flex: 1 }}>
      {label && <strong style={{ color: C.n900 }}>{label}: </strong>}
      <span>{children}</span>
    </div>
  </div>
);

export default function KebijakanPrivasiPage({ goBack }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = (e) => setScrolled(e.target.scrollTop > 80);
    const el = document.querySelector('[data-privacy-scroll]');
    if (el) el.addEventListener('scroll', handleScroll);
    return () => { if (el) el.removeEventListener('scroll', handleScroll); };
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Kebijakan Privasi" subtitle="Wäschen POS" onBack={goBack} />

      <div data-privacy-scroll style={{ flex: 1, overflowY: 'auto' }}>
        {/* Hero header dengan logo */}
        <div style={{
          background: `linear-gradient(135deg, ${C.primaryDark} 0%, ${C.primary} 50%, ${C.primary} 100%)`,
          padding: '24px 20px 48px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative bubbles */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -20, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', top: 40, left: 80, width: 60, height: 60, borderRadius: '50%', background: 'rgba(232,93,4,0.15)' }} />

          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <div style={{ width: 200, marginBottom: 14 }}>
              <svg viewBox="0 0 320 100" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
                {/* Bubbles */}
                <circle cx="22" cy="58" r="10" fill="#E85D04"/>
                <circle cx="38" cy="78" r="5" fill="#E85D04"/>
                <circle cx="48" cy="38" r="5" fill="#E85D04"/>
                {/* Text "Wäschen" */}
                <text x="52" y="68" fontFamily="'Poppins', Arial, sans-serif" fontSize="46" fontWeight="800" fill="white" letterSpacing="-1">
                  W<tspan fontSize="42">ä</tspan>schen
                  <tspan fontSize="14" baselineShift="super" fill="rgba(255,255,255,0.7)" dx="2">®</tspan>
                </text>
                {/* Tagline ribbon */}
                <rect x="60" y="78" width="190" height="16" fill="#E85D04" rx="2"/>
                <text x="155" y="90" fontFamily="'Poppins', Arial, sans-serif" fontSize="9" fontWeight="700" fill="white" textAnchor="middle" letterSpacing="1.5">
                  EXPERT LAUNDRY SOLUTIONS
                </text>
              </svg>
            </div>

            <div style={{
              ...F, fontSize: 11, color: 'rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.12)',
              padding: '4px 14px', borderRadius: 999,
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.2)',
              fontWeight: 600,
            }}>
              🔒 Kebijakan Privasi
            </div>

            <div style={{ ...F, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 8, textAlign: 'center' }}>
              Berlaku efektif: 22 Mei 2026 · Versi 1.0
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '0 16px', marginTop: -28, paddingBottom: 24, position: 'relative' }}>

          {/* Welcome card */}
          <div style={{
            background: 'white', borderRadius: 16, padding: '16px 18px', marginBottom: 14,
            boxShadow: SHADOW.md,
            border: `1.5px solid ${C.primary}20`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>🛡️</span>
              <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900 }}>
                Privasi Kamu, Prioritas Kami
              </div>
            </div>
            <p style={{ ...F, fontSize: 12, color: C.n700, lineHeight: 1.7, margin: 0 }}>
              Dokumen ini menjelaskan cara <strong>PT Waschen Alora Indonesia</strong> mengumpulkan, menggunakan, dan melindungi data pribadi pengguna aplikasi Wäschen POS. Baca dengan saksama.
            </p>
          </div>

          {/* 1. Pendahuluan */}
          <Section number={1} icon="📜" title="Pendahuluan" color={C.primary}>
            <p style={{ margin: 0 }}>
              <strong>PT Waschen Alora Indonesia</strong> berkomitmen penuh melindungi data pribadi pengguna aplikasi Wäschen POS. Kami menjunjung tinggi prinsip transparansi, keamanan, dan kepatuhan terhadap hukum perlindungan data pribadi yang berlaku di Indonesia.
            </p>
          </Section>

          {/* 2. Data yang Kami Kumpulkan */}
          <Section number={2} icon="📊" title="Data yang Kami Kumpulkan" color={C.info}>
            <Bullet icon="👤" label="Identitas Profil">
              Nama lengkap, alamat email, dan nomor telepon.
            </Bullet>
            <Bullet icon="🏪" label="Informasi Outlet">
              Data operasional outlet, riwayat transaksi, dan manajemen karyawan.
            </Bullet>
            <Bullet icon="📍" label="Data Lokasi">
              Koordinat GPS untuk verifikasi outlet dan layanan logistik (pickup/delivery).
            </Bullet>
            <Bullet icon="📝" label="Log Aktivitas">
              Rekam jejak interaksi pengguna di dalam aplikasi untuk audit dan perbaikan layanan.
            </Bullet>
          </Section>

          {/* 3. Akses Perangkat & Cookie */}
          <Section number={3} icon="📷" title="Akses Perangkat & Cookie" color={C.danger}>
            <Bullet icon="📸" label="Izin Kamera">
              Untuk memindai barcode/QR code nota dan dokumentasi foto cucian (saat diterima dan saat packing).
            </Bullet>
            <Bullet icon="🍪" label="Cookie & Local Storage">
              Untuk menyimpan sesi login agar kamu tidak perlu masuk berulang kali, dan menyimpan preferensi tampilan aplikasi.
            </Bullet>
          </Section>

          {/* 4. Tujuan Penggunaan Data */}
          <Section number={4} icon="🎯" title="Tujuan Penggunaan Data" color={C.warning}>
            <Bullet icon="⚙️">
              Memastikan operasional manajemen laundry berjalan lancar dan efisien.
            </Bullet>
            <Bullet icon="🔔">
              Komunikasi dengan pengguna untuk mengirim notifikasi pesanan dan pembaruan sistem.
            </Bullet>
            <Bullet icon="📈">
              Analisis performa untuk pengembangan fitur aplikasi ke depannya.
            </Bullet>
          </Section>

          {/* 5. Keamanan Data */}
          <Section number={5} icon="🔐" title="Keamanan Data" color={C.success}>
            <Bullet icon="🔒">
              Penerapan enkripsi data dan koneksi aman menggunakan protokol HTTPS.
            </Bullet>
            <Bullet icon="🛡️">
              Pembatasan hak akses data hanya untuk sistem dan pihak yang berwenang melalui mekanisme role-based access control (RBAC).
            </Bullet>
            <Bullet icon="📋">
              Audit trail aktif untuk semua perubahan data penting demi traceability.
            </Bullet>
          </Section>

          {/* 6. Hak-Hak Pengguna */}
          <Section number={6} icon="⚖️" title="Hak-Hak Pengguna" color={C.primary}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <div style={{ background: C.primaryTint, borderRadius: 10, padding: '10px 12px', border: `1px solid ${C.primaryTint}` }}>
                <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 2 }}>👁️ Hak Akses</div>
                <div style={{ ...F, fontSize: 11, color: C.n700 }}>Meminta salinan data pribadi yang kami simpan.</div>
              </div>
              <div style={{ background: C.validationWarningBg, borderRadius: 10, padding: '10px 12px', border: `1px solid ${C.validationWarningBg}` }}>
                <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.validationWarningText, marginBottom: 2 }}>✏️ Hak Koreksi</div>
                <div style={{ ...F, fontSize: 11, color: C.n700 }}>Memperbarui data yang salah atau usang.</div>
              </div>
              <div style={{ background: C.validationErrorBg, borderRadius: 10, padding: '10px 12px', border: `1px solid ${C.validationErrorBg}` }}>
                <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.validationErrorText, marginBottom: 2 }}>🗑️ Hak Penghapusan</div>
                <div style={{ ...F, fontSize: 11, color: C.n700 }}>Meminta penghapusan akun beserta data terkait.</div>
              </div>
            </div>
          </Section>

          {/* 7. Layanan Pihak Ketiga */}
          <Section number={7} icon="🤝" title="Layanan Pihak Ketiga" color={C.info}>
            <p style={{ margin: '0 0 10px' }}>
              Kami secara transparan menggunakan beberapa layanan luar yang terintegrasi dengan aplikasi:
            </p>
            <Bullet icon="🔥" label="Google Firebase">
              Untuk push notification dan analytics.
            </Bullet>
            <Bullet icon="☁️" label="Layanan Server / Cloud">
              Untuk hosting dan penyimpanan data.
            </Bullet>
            <Bullet icon="💳" label="Payment Gateway">
              Untuk pemrosesan pembayaran (jika digunakan di masa mendatang).
            </Bullet>
          </Section>

          {/* 8. Masa Penyimpanan Data */}
          <Section number={8} icon="⏳" title="Masa Penyimpanan Data (Retensi)" color={C.warning}>
            <Bullet icon="✅">
              Data akan disimpan selama akun kamu aktif dan sistem POS digunakan.
            </Bullet>
            <Bullet icon="🗓️">
              Setelah pengajuan penghapusan akun, seluruh data akan musnah secara permanen dalam waktu <strong>maksimal 30 hari kalender</strong>.
            </Bullet>
            <Bullet icon="📦">
              Khusus dokumentasi foto cucian: retensi otomatis 30 hari dari tanggal upload.
            </Bullet>
          </Section>

          {/* 9. Landasan Hukum */}
          <Section number={9} icon="⚖️" title="Landasan Hukum" color={C.info}>
            <p style={{ margin: 0 }}>
              Kebijakan ini tunduk pada:
            </p>
            <Bullet icon="📜">
              <strong>UU No. 27 Tahun 2022</strong> tentang Pelindungan Data Pribadi (UU PDP).
            </Bullet>
            <Bullet icon="📜">
              <strong>UU No. 11 Tahun 2008</strong> jo. UU No. 19 Tahun 2016 tentang Informasi dan Transaksi Elektronik (UU ITE).
            </Bullet>
          </Section>

          {/* 10. Informasi Kontak */}
          <Section number={10} icon="📞" title="Informasi Kontak" color={C.primary}>
            <div style={{
              background: `linear-gradient(135deg, ${C.primary}08, ${C.primary}08)`,
              borderRadius: 12, padding: '12px 14px',
              border: `1.5px solid ${C.primary}20`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>📧</span>
                <div>
                  <div style={{ ...F, fontSize: 9, fontWeight: 600, color: C.n600, letterSpacing: 0.4 }}>EMAIL PRIVASI</div>
                  <a href="mailto:privacy@waschen.id" style={{ ...F, fontSize: 13, fontWeight: 600, color: C.primary, textDecoration: 'none' }}>
                    privacy@waschen.id
                  </a>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🏢</span>
                <div>
                  <div style={{ ...F, fontSize: 9, fontWeight: 600, color: C.n600, letterSpacing: 0.4 }}>KANTOR PUSAT</div>
                  <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n800, marginTop: 1 }}>
                    PT Waschen Alora Indonesia
                  </div>
                  <div style={{ ...F, fontSize: 11, color: C.n600, marginTop: 1 }}>
                    Jakarta, Indonesia
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Footer */}
          <div style={{
            marginTop: 16, padding: '14px 16px',
            background: 'white', borderRadius: 14,
            border: `1px solid ${C.n100}`,
            textAlign: 'center',
          }}>
            <div style={{ ...F, fontSize: 11, color: C.n600, lineHeight: 1.7 }}>
              Dengan menggunakan aplikasi Wäschen POS, kamu dianggap memahami dan menyetujui Kebijakan Privasi ini.
            </div>
            <div style={{ ...F, fontSize: 10, color: C.n600, marginTop: 8 }}>
              © 2026 PT Waschen Alora Indonesia · All rights reserved
            </div>
          </div>

          {/* Back button */}
          <button
            onClick={goBack}
            style={{
              width: '100%', marginTop: 14,
              padding: '12px', borderRadius: 12, border: 'none',
              background: `linear-gradient(135deg, ${C.primary}, ${C.primary})`,
              ...F, fontSize: 13, fontWeight: 600, color: 'white',
              cursor: 'pointer',
              boxShadow: `0 4px 16px ${C.primary}40`,
            }}
          >
            ← Kembali
          </button>

        </div>
      </div>
    </div>
  );
}
