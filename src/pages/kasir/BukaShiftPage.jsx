import React, { useState } from 'react';
import api from '../../utils/api';
import { formatRupiah, parseRupiah } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { TopBar } from '../../components/ui';

function BukaShiftPage({ goBack }) {
  const [openingCash, setOpeningCash] = useState('');
  const [shift, setShift] = useState('pagi');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { navigate } = useApp();

  const handleCashChange = (e) => {
    const rawValue = parseRupiah(e.target.value);
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
      // Redirect ke dashboard kasir setelah berhasil
      navigate('dashboard'); 
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuka sesi. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3F4F6', minHeight: '100%' }}>
      <TopBar title="Buka shift" subtitle="Modal awal & jenis shift tercatat ke pusat" onBack={goBack} />
      <div className="flex items-center justify-center flex-1 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-800">Buka shift kasir</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="openingCash" className="block text-sm font-medium text-gray-700">
              Saldo Awal
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-gray-500 sm:text-sm">Rp</span>
              </div>
              <input
                id="openingCash"
                name="openingCash"
                type="text"
                inputMode="numeric"
                required
                value={openingCash}
                onChange={handleCashChange}
                className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="100.000"
              />
            </div>
          </div>
          <div>
            <label htmlFor="shift" className="block text-sm font-medium text-gray-700">
              Shift
            </label>
            <select
              id="shift"
              name="shift"
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="pagi">Pagi</option>
              <option value="siang">Siang</option>
              <option value="malam">Malam</option>
              <option value="full">Full Day</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
            >
              {loading ? 'Membuka...' : 'Buka Sesi'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

export default BukaShiftPage;
