import React, { useState } from 'react';
import api from '../../utils/api';
import { formatRupiah, parseRupiah } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';

function TutupShiftPage() {
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [recap, setRecap] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { navigate, handleLogout } = useApp();

  const handleCashChange = (e) => {
    const rawValue = parseRupiah(e.target.value);
    setClosingCash(formatRupiah(rawValue, ''));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cashValue = parseRupiah(closingCash);
    if (cashValue === 0) { // Bisa jadi 0 jika memang tidak ada uang
      setError('Jumlah uang fisik wajib diisi.');
      // return; // Komentari agar bisa tutup shift dengan 0
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/shifts/close', {
        closingCash: cashValue,
        notes,
      });
      setRecap(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menutup sesi. Coba lagi.');
      setLoading(false);
    }
  };

  if (recap) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-full max-w-md p-8 space-y-4 bg-white rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-gray-800">Sesi Berhasil Ditutup</h2>
          <div className="text-left border-t pt-4">
            <p><strong>Saldo Awal:</strong> Rp {recap.openingCash.toLocaleString()}</p>
            <p><strong>Penjualan Tunai:</strong> Rp {recap.cashSales.toLocaleString()}</p>
            <p><strong>Total Uang di Sistem:</strong> Rp {recap.systemCash.toLocaleString()}</p>
            <hr className="my-2"/>
            <p><strong>Uang Fisik Dihitung:</strong> Rp {recap.closingCash.toLocaleString()}</p>
            <p className={`font-bold ${recap.difference < 0 ? 'text-red-500' : 'text-green-500'}`}>
              <strong>Selisih:</strong> Rp {recap.difference.toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => handleLogout()}
            className="w-full px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Selesai & Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-800">Tutup Sesi Kasir</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="closingCash" className="block text-sm font-medium text-gray-700">
              Total Uang Fisik di Laci
            </label>
            <div className="relative mt-1">
               <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-gray-500 sm:text-sm">Rp</span>
              </div>
              <input
                id="closingCash"
                name="closingCash"
                type="text"
                inputMode="numeric"
                required
                value={closingCash}
                onChange={handleCashChange}
                className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Hitung semua uang tunai"
              />
            </div>
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Catatan (Opsional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Contoh: Ada selisih karena salah kembalian"
            ></textarea>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400"
            >
              {loading ? 'Menutup...' : 'Tutup Sesi & Rekapitulasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TutupShiftPage;
