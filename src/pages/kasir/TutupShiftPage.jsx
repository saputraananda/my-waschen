import React, { useState } from 'react';

import api from '../../utils/api';

import { formatRupiah, parseRupiah, rp } from '../../utils/helpers';

import { useApp } from '../../context/AppContext';

import { C } from '../../utils/theme';

import { TopBar, Btn, Input, Modal } from '../../components/ui';



function TutupShiftPage({ goBack }) {

  const [closingCash, setClosingCash] = useState('');

  const [notes, setNotes] = useState('');

  const [recap, setRecap] = useState(null);

  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);

  const { navigate } = useApp();

  // Photo evidence state
  const [photos, setPhotos] = useState([]); // Array of { file, preview, label }
  const [photoLabel, setPhotoLabel] = useState('');

  // Confirmation alert state
  const [showConfirm, setShowConfirm] = useState(false);



  const handleCashChange = (e) => {

    const rawValue = parseRupiah(e.target.value);

    setClosingCash(formatRupiah(rawValue, ''));

  };

  // Photo upload handler
  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      label: photoLabel || 'Bukti Transaksi',
    }));

    setPhotos((prev) => [...prev, ...newPhotos]);
    setPhotoLabel('');
    // Reset file input
    e.target.value = '';
  };

  const handlePhotoRemove = (idx) => {
    setPhotos((prev) => {
      const removed = prev[idx];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Show confirmation alert before closing shift
  const handlePreSubmit = () => {
    const cashValue = parseRupiah(closingCash);
    if (!Number.isFinite(cashValue) || cashValue < 0) {
      setError('Jumlah uang fisik tidak valid.');
      return;
    }
    setError('');
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setShowConfirm(false);

    const cashValue = parseRupiah(closingCash);

    if (!Number.isFinite(cashValue) || cashValue < 0) {

      setError('Jumlah uang fisik tidak valid.');

      return;

    }

    setLoading(true);

    setError('');

    try {

      // Build form data with photos
      const formData = new FormData();
      formData.append('closingCash', cashValue);
      if (notes) formData.append('notes', notes);

      photos.forEach((p, i) => {
        formData.append(`photos`, p.file);
        formData.append(`photoLabels`, p.label || 'Bukti Transaksi');
      });

      const response = await api.post('/api/shifts/close', {
        closingCash: cashValue,
        notes,
        // Photos will be sent as base64 if API doesn't support multipart
        photos: await Promise.all(photos.map(async (p) => {
          const reader = new FileReader();
          return new Promise((resolve) => {
            reader.onload = () => resolve({
              data: reader.result,
              label: p.label || 'Bukti Transaksi',
            });
            reader.readAsDataURL(p.file);
          });
        })),
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

            {photos.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>📸 Bukti yang diunggah ({photos.length})</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {photos.map((p, i) => (
                    <div key={i} style={{ position: 'relative', width: 60, height: 60, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.n200}` }}>
                      <img src={p.preview} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

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

          {/* ── Photo Evidence Upload Section ── */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📸</div>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n800 }}>Bukti Transaksi</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>Foto pengeluaran, transfer, atau bukti lainnya (opsional)</div>
              </div>
            </div>

            {/* Photo label input */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={photoLabel}
                onChange={(e) => setPhotoLabel(e.target.value)}
                placeholder="Label: Pengeluaran, Transfer, dll"
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  border: `1.5px solid ${C.n300}`,
                  padding: '0 10px',
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  color: C.n900,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <label
                style={{
                  height: 38,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${C.primary}`,
                  background: `${C.primary}10`,
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.primary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                📷 Upload
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handlePhotoAdd}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Photo preview grid */}
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${C.n200}`, background: C.n50 }}>
                    <img src={p.preview} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {/* Label overlay */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'rgba(0,0,0,0.6)', padding: '2px 4px',
                      fontFamily: 'Poppins', fontSize: 8, color: 'white',
                      textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.label}
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => handlePhotoRemove(i)}
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 20, height: 20, borderRadius: 10,
                        background: 'rgba(0,0,0,0.5)', border: 'none',
                        color: 'white', fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div style={{ marginTop: 10, fontFamily: 'Poppins', fontSize: 12, color: C.danger }}>{error}</div>}

          <Btn variant="primary" fullWidth loading={loading} style={{ marginTop: 20 }} onClick={handlePreSubmit}>

            Tutup shift &amp; simpan

          </Btn>

        </div>

      </div>

      {/* ── Confirmation Alert Modal ── */}
      {showConfirm && (
        <>
          <div onClick={() => setShowConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: C.white, borderRadius: 20, padding: '28px 24px', maxWidth: 360, width: '90%',
            boxShadow: '0 8px 32px rgba(15,23,42,0.15)', zIndex: 9001, textAlign: 'center',
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span style={{ fontSize: 28 }}>⚠️</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900, marginBottom: 8 }}>
              Konfirmasi Tutup Shift
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, lineHeight: 1.6, marginBottom: 8 }}>
              Pastikan semua data sudah benar sebelum menutup shift:
            </div>
            <div style={{
              background: C.n50, borderRadius: 12, padding: '12px 14px', textAlign: 'left',
              fontFamily: 'Poppins', fontSize: 13, color: C.n700, lineHeight: 1.7, marginBottom: 16,
            }}>
              <div>💰 Uang fisik: <strong>{rp(parseRupiah(closingCash) || 0)}</strong></div>
              {notes && <div>📝 Catatan: {notes}</div>}
              <div>📸 Foto bukti: <strong>{photos.length} file</strong></div>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#B45309', background: '#FEF3C7', borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
              ⚠️ Setelah ditutup, shift tidak bisa dibuka kembali. Data akan dikirim ke admin pusat.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  border: `1.5px solid ${C.n200}`, background: C.white,
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700,
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  border: 'none', background: `linear-gradient(135deg, ${C.primary}, #7C3AED)`,
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: 'white',
                  cursor: 'pointer', boxShadow: `0 4px 12px ${C.primary}40`,
                }}
              >
                Ya, Tutup Shift
              </button>
            </div>
          </div>
        </>
      )}

    </div>

  );

}



export default TutupShiftPage;

