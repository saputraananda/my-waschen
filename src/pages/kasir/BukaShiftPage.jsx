import React, { useState } from 'react';
import api from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { C } from '../../utils/theme';
import { TopBar, Btn, Select, MoneyInput } from '../../components/ui';

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
            <MoneyInput
              label="Saldo Awal (Rp)"
              value={openingCash}
              onChange={(v) => setOpeningCash(v)}
              placeholder="0"
            />
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: -8, marginBottom: 14 }}>
              Masukkan jumlah uang tunai di laci kasir saat ini (boleh 0)
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
