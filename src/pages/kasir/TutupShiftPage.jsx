import React, { useState } from 'react';
import api from '../../utils/api';
import { formatRupiah, parseRupiah, rp } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { C } from '../../utils/theme';
import { TopBar, Btn, Input } from '../../components/ui';

function TutupShiftPage({ goBack }) {
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [recap, setRecap] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { navigate } = useApp();

  const handleCashChange = (e) => {
    const rawValue = parseRupiah(e.target.value);
    setClosingCash(formatRupiah(rawValue, ''));
  };

  const handleSubmit = async () => {
    const cashValue = parseRupiah(closingCash);
    if (!Number.isFinite(cashValue) || cashValue < 0) {
      setError('Jumlah uang fisik tidak valid.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/shifts/close', {
        closingCash: cashValue,
        notes,
      });
      const d = response?.data?.data;
      if (d) {
        setRecap({
          openingCash: d.openingCash,
          cashSales: d.cashSales,
          systemCash: d.systemCash,
          closingCash: d.closingCash,
          difference: d.difference,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menutup sesi. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (recap) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
        <TopBar title="Shift ditutup" subtitle="Rekonsiliasi kas tersimpan" onBack={goBack} />
        <div style={{ flex: 1, padding: 20, maxWidth: 440, margin: '0 auto', width: '100%' }}>
          <div style={{ background: C.white, borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 14 }}>Ringkasan</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n700, lineHeight: 1.7 }}>
              <div>Saldo awal: <strong>{rp(recap.openingCash)}</strong></div>
              <div>Penjualan tunai (sesi): <strong>{rp(recap.cashSales)}</strong></div>
              <div>Total menurut sistem: <strong>{rp(recap.systemCash)}</strong></div>
              <hr style={{ border: 'none', borderTop: `1px solid ${C.n200}`, margin: '12px 0' }} />
              <div>Uang fisik dihitung: <strong>{rp(recap.closingCash)}</strong></div>
              <div style={{ fontWeight: 700, color: recap.difference < 0 ? C.danger : recap.difference > 0 ? C.success : C.n800, marginTop: 6 }}>
                Selisih: {rp(recap.difference)}
              </div>
            </div>
            <Btn variant="primary" fullWidth style={{ marginTop: 20 }} onClick={() => navigate('dashboard')}>
              Kembali ke beranda
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Tutup shift" subtitle="Hitung uang tunai di laci lalu rekonsiliasi" onBack={goBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ background: C.white, borderRadius: 16, padding: 16, maxWidth: 440, margin: '0 auto', boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 16, lineHeight: 1.5 }}>
            Data tutup shift dan timestamp dikirim ke pusat agar admin dapat memantau disiplin kas per outlet.
          </div>
          <Input
            label="Total uang tunai di laci (Rp)"
            value={closingCash}
            onChange={(v) => setClosingCash(formatRupiah(parseRupiah(v), ''))}
            placeholder="0"
          />
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n700, marginBottom: 6 }}>Catatan (opsional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Contoh: selisih karena kembalian"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 10,
                border: `1.5px solid ${C.n300}`,
                padding: 10,
                fontFamily: 'Poppins',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </div>
          {error && <div style={{ marginTop: 10, fontFamily: 'Poppins', fontSize: 12, color: C.danger }}>{error}</div>}
          <Btn variant="primary" fullWidth loading={loading} style={{ marginTop: 20 }} onClick={() => handleSubmit()}>
            Tutup shift &amp; simpan
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default TutupShiftPage;
