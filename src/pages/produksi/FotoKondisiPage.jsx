import { useState } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, Btn } from '../../components/ui';

export default function FotoKondisiPage({ navigate, screenParams }) {
  const tx = screenParams;
  const [photos, setPhotos] = useState([]);
  const [note, setNote] = useState('');
  const [isDamage, setIsDamage] = useState(false);
  const [loading, setLoading] = useState(false);

  const addPhoto = (type) => {
    const fakeUrl = `photo_${type}_${Date.now()}.jpg`;
    setPhotos((prev) => [...prev, { url: fakeUrl, type, label: type === 'before' ? 'Sebelum Cuci' : 'Sesudah Cuci' }]);
  };

  const handleSave = async () => {
    if (photos.length === 0 && !note) {
      alert('Tambahkan foto atau catatan terlebih dahulu.');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`/api/transactions/${tx.id}/condition`, {
        photos: photos.map(p => p.url),
        notes: note,
        isDamage: isDamage
      });
      alert('Kondisi awal pakaian berhasil dicatat!');
      navigate('detail_item_produksi', tx);
    } catch (err) {
      alert('Gagal menyimpan kondisi pakaian.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Foto Kondisi" subtitle={tx?.id} onBack={() => navigate('detail_item_produksi', tx)} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => addPhoto('before')}
            style={{ flex: 1, height: 140, borderRadius: 14, border: `2px dashed ${C.n300}`, background: C.white, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.n600 }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600 }}>Foto Sebelum</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>Tap untuk ambil foto</span>
          </button>

          <button
            onClick={() => addPhoto('after')}
            style={{ flex: 1, height: 140, borderRadius: 14, border: `2px dashed ${C.n300}`, background: C.white, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.n600 }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600 }}>Foto Sesudah</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>Tap untuk ambil foto</span>
          </button>
        </div>

        {photos.length > 0 && (
          <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>FOTO DITAMBAHKAN ({photos.length})</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {photos.map((p, i) => (
                <div key={i} style={{ width: 70, height: 70, borderRadius: 10, background: C.primaryLight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <span style={{ fontSize: 20 }}>{p.type === 'before' ? '📷' : '✅'}</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 8, color: C.primary, fontWeight: 600 }}>{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600 }}>CATATAN KONDISI</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={isDamage} onChange={(e) => setIsDamage(e.target.checked)} />
              <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.danger, fontWeight: 600 }}>Tandai Ada Kerusakan (Sobek/Luntur)</span>
            </label>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: Ada noda tinta di lengan kanan baju putih, atau kancing kemeja hilang satu..."
            rows={4}
            style={{ width: '100%', borderRadius: 10, padding: '10px 12px', border: `1.5px solid ${isDamage ? C.danger : C.n300}`, fontFamily: 'Poppins', fontSize: 13, color: C.n900, background: isDamage ? '#FEF2F2' : C.white, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', gap: 10 }}>
        <Btn variant="secondary" onClick={() => navigate('detail_item_produksi', tx)} style={{ flex: 1 }}>Batal</Btn>
        <Btn variant="primary" loading={loading} onClick={handleSave} style={{ flex: 2 }}>Simpan Catatan</Btn>
      </div>
    </div>
  );
}
