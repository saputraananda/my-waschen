import React, { useState } from 'react';
import api from '../../utils/api';
import { formatRupiah, parseRupiah } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { C } from '../../utils/theme';
import { TopBar, Input, Select, Btn } from '../../components/ui';

const SHIFT_OPTIONS = [
  { value: 'pagi', label: 'Pagi' },
  { value: 'siang', label: 'Siang' },
  { value: 'malam', label: 'Malam' },
  { value: 'full', label: 'Full Day' },
];

function BukaShiftPage({ goBack }) {
  const [openingCash, setOpeningCash] = useState('');
  const [shift, setShift] = useState('pagi');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { navigate } = useApp();

  const handleCashChange = (val) => {
    const rawValue = parseRupiah(val);
    setOpeningCash(formatRupiah(rawValue, ''));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cashValue = parseRupiah(openingCash);
    if (!Number.isFinite(cashValue) || cashValue < 0) {
      setError('Saldo awal tidak valid (boleh 0).');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/shifts/open', {
        openingCash: cashValue,
        shift,
      });
      navigate('dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuka sesi. Coba lagi.');
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
            Buka shift kasir
          </div>
          <form onSubmit={handleSubmit}>
            <Input
              label="Saldo Awal (Rp)"
              value={openingCash}
              onChange={handleCashChange}
              placeholder="100.000"
              inputMode="numeric"
            />
            <Select
              label="Shift"
              value={shift}
              onChange={setShift}
              options={SHIFT_OPTIONS}
            />
            {error && (
              <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.danger, marginBottom: 16 }}>
                {error}
              </div>
            )}
            <Btn fullWidth disabled={loading}>
              {loading ? 'Membuka...' : 'Buka Sesi'}
            </Btn>
          </form>
        </div>
      </div>
    </div>
  );
}

export default BukaShiftPage;
