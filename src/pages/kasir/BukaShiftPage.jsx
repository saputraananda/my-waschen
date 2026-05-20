import React, { useState } from 'react';
import api from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { C } from '../../utils/theme';
import { TopBar, Btn, Select } from '../../components/ui';

const SHIFT_OPTIONS = [
  { value: 'pagi', label: '🌅 Pagi' },
  { value: 'siang', label: '☀️ Siang' },
  { value: 'malam', label: '🌙 Malam' },
  { value: 'full', label: '🕐 Full Day' },
];

function BukaShiftPage({ goBack }) {
  const [openingCash, setOpeningCash] = useState('');
  const [shift, setShift] = useState('pagi');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { navigate } = useApp();

  const handleCashChange = (e) => {
    // Hanya angka
    const raw = e.target.value.replace(/\D/g, '');
    setOpeningCash(raw);
  };

  const displayCash = openingCash
    ? Number(openingCash).toLocaleString('id-ID')
    : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cashValue = Number(openingCash) || 0;
    if (cashValue < 0) {
      setError('Saldo awal tidak boleh negatif.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/api/shifts/open', {
        openingCash: cashValue,
        shift,
      });
      navigate('dashboard');
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;

      if (status === 409) {
        // Shift sudah pernah dibuka hari ini dengan jenis yang sama
        setError(`${msg || 'Shift ini sudah dibuka hari ini.'} Pilih jenis shift lain atau tutup sesi yang masih terbuka.`);
      } else if (status === 400) {
        setError(msg || 'Data tidak valid. Periksa kembali.');
      } else {
        setError(msg || 'Gagal membuka sesi. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Buka Shift" subtitle="Modal awal & jenis shift tercatat ke pusat" onBack={goBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 400, background: C.white, borderRadius: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)', padding: 24 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.n900, textAlign: 'center', marginBottom: 24 }}>
            Buka Shift Kasir
          </div>

          <form onSubmit={handleSubmit}>
            {/* Saldo Awal */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>
                Saldo Awal (Rp)
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  fontFamily: 'Poppins', fontSize: 14, color: C.n500, pointerEvents: 'none',
                }}>Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayCash}
                  onChange={handleCashChange}
                  placeholder="0"
                  style={{
                    width: '100%', height: 48, borderRadius: 10,
                    border: `1.5px solid ${C.n300}`,
                    fontFamily: 'Poppins', fontSize: 14, color: C.n900,
                    background: C.white, outline: 'none',
                    boxSizing: 'border-box', padding: '0 14px 0 36px',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = C.primary; e.target.style.borderWidth = '2px'; }}
                  onBlur={(e) => { e.target.style.borderColor = C.n300; e.target.style.borderWidth = '1.5px'; }}
                />
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 4 }}>
                Masukkan jumlah uang tunai di laci kasir saat ini (boleh 0)
              </div>
            </div>

            {/* Pilih Shift — custom Select */}
            <Select
              label="Jenis Shift"
              value={shift}
              onChange={(v) => setShift(v)}
              options={SHIFT_OPTIONS}
            />

            {/* Error message */}
            {error && (
              <div style={{
                fontFamily: 'Poppins', fontSize: 12, color: '#991B1B',
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 8, padding: '10px 12px', marginBottom: 16,
                lineHeight: 1.5,
              }}>
                ⚠️ {error}
              </div>
            )}

            <Btn variant="primary" fullWidth loading={loading}>
              {loading ? 'Membuka...' : '🔓 Buka Shift'}
            </Btn>
          </form>
        </div>
      </div>
    </div>
  );
}

export default BukaShiftPage;
