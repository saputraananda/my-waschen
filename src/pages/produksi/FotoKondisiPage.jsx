import { useState, useRef } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { uploadImage } from '../../utils/imageUpload';
import { TopBar, Btn } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { txApiId } from '../../utils/helpers';

const PHASE_CONFIG = {
  receive: {
    title: 'Foto Kondisi Diterima',
    subtitle: 'Dokumentasi sebelum cuci (opsional)',
    beforeLabel: 'Foto kondisi awal',
    afterLabel: 'Foto detail tambahan',
    requirePhoto: false,
  },
  packing: {
    title: 'Foto Packing / Serah',
    subtitle: 'Dokumentasi sebelum diserahkan ke customer',
    beforeLabel: 'Foto isi packing',
    afterLabel: 'Foto tambahan / label',
    requirePhoto: true,
  },
};

export default function FotoKondisiPage({ navigate, goBack, screenParams }) {
  const tx = screenParams;
  const phase = screenParams?.photoPhase || 'receive';
  const cfg = PHASE_CONFIG[phase] || PHASE_CONFIG.receive;

  const [photos, setPhotos] = useState([]);
  const [note, setNote] = useState('');
  const [isDamage, setIsDamage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [saved, setSaved] = useState(false);

  const beforeFileRef = useRef(null);
  const afterFileRef = useRef(null);

  const handlePhotoUpload = async (e, type) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = ''; // reset input supaya bisa pilih file yang sama lagi

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    try {
      const preset = phase === 'receive' ? 'damage' : 'documentation';
      const compressed = [];
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ current: i + 1, total: files.length });
        const result = await uploadImage(files[i], preset);
        compressed.push({
          url: result.dataUrl,
          type,
          label: type === 'before' ? cfg.beforeLabel : cfg.afterLabel,
          sizeKb: result.sizeKb,
        });
      }
      setPhotos((prev) => [...prev, ...compressed]);
    } catch (err) {
      alertError(err.message || 'Gagal memproses foto.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const removePhoto = (idx) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  };

  const handleAddMore = () => {
    setPhotos([]);
    setNote('');
    setSaved(false);
  };

  const handleSave = async () => {
    if (cfg.requirePhoto && photos.length === 0) {
      alertWarning('Wajib minimal satu foto sebagai bukti.');
      return;
    }
    if (photos.length === 0 && !note.trim()) {
      alertWarning('Tambahkan foto atau catatan terlebih dahulu.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`/api/transactions/${txApiId(tx)}/condition`, {
        photos: photos.map((p) => ({ url: p.url, type: p.type })),
        notes: note,
        isDamage: phase === 'receive' ? isDamage : false,
        phase,
        itemId: tx.item?.itemId,
      });
      try { window.dispatchEvent(new CustomEvent('produksi:photo-saved', { detail: { phase } })); } catch {}
      await alertSuccess('Dokumentasi foto berhasil disimpan.');
      setSaved(true);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan dokumentasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title={cfg.title} subtitle={tx?.id || cfg.subtitle} onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ background: phase === 'receive' ? C.validationInfoBg : C.successBg, borderRadius: 12, padding: '10px 12px', marginBottom: 14, fontFamily: 'Poppins', fontSize: 11, color: phase === 'receive' ? C.validationInfoText : C.successDark }}>
          {phase === 'receive'
            ? '📥 Opsional. Boleh dilewati. Foto ini berguna jika ada catatan kerusakan / noda awal.'
            : '📦 Wajib diisi saat packing / sebelum customer mengambil. Mencegah salah serah barang.'}
        </div>

        <input type="file" accept="image/*" capture="environment" multiple ref={beforeFileRef} style={{ display: 'none' }} onChange={(e) => handlePhotoUpload(e, 'before')} />
        <input type="file" accept="image/*" capture="environment" multiple ref={afterFileRef} style={{ display: 'none' }} onChange={(e) => handlePhotoUpload(e, 'after')} />

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => beforeFileRef.current?.click()}
            disabled={uploading}
            style={{ flex: 1, height: 140, borderRadius: 14, border: `2px dashed ${C.primary}`, background: C.white, cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.n600, opacity: uploading ? 0.5 : 1 }}
          >
            <span style={{ fontSize: 28 }}>📷</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600 }}>{cfg.beforeLabel}</span>
          </button>
          <button
            onClick={() => afterFileRef.current?.click()}
            disabled={uploading}
            style={{ flex: 1, height: 140, borderRadius: 14, border: `2px dashed ${C.n300}`, background: C.white, cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.n600, opacity: uploading ? 0.5 : 1 }}
          >
            <span style={{ fontSize: 28 }}>📷</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600 }}>{cfg.afterLabel}</span>
          </button>
        </div>

        {uploading && uploadProgress && (
          <div style={{ background: C.validationInfoBg, borderRadius: 12, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 18, height: 18, border: `2.5px solid ${C.info}40`, borderTopColor: C.info, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.validationInfoText }}>
              Mengompres foto {uploadProgress.current}/{uploadProgress.total}…
            </span>
          </div>
        )}

        {/* Saved confirmation */}
        {saved && (
          <div style={{ background: C.successBg, borderRadius: 12, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.successDark }}>Dokumentasi tersimpan</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginTop: 1 }}>{photos.length} foto sudah disimpan ke server</div>
            </div>
          </div>
        )}

        {photos.length > 0 && (
          <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>FOTO ({photos.length})</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.n200}` }}>
                  <img src={p.url} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => removePhoto(i)}
                    style={{
                      position: 'absolute', top: 2, right: 2, width: 22, height: 22,
                      borderRadius: '50%', border: 'none',
                      background: 'rgba(0,0,0,0.6)', color: 'white', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          {phase === 'receive' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 8 }}>
              <input type="checkbox" checked={isDamage} onChange={(e) => setIsDamage(e.target.checked)} />
              <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.danger, fontWeight: 600 }}>Ada kerusakan / noda awal</span>
            </label>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan kondisi barang…"
            rows={4}
            style={{ width: '100%', borderRadius: 10, padding: '10px 12px', border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, color: C.n900, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', gap: 10 }}>
        {saved ? (
          <>
            <Btn variant="secondary" onClick={handleAddMore} style={{ flex: 1 }}>+ Tambah Lagi</Btn>
            <Btn variant="primary" onClick={() => goBack?.()} style={{ flex: 2 }}>Selesai</Btn>
          </>
        ) : (
          <>
            <Btn variant="secondary" onClick={() => goBack?.()} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="primary" loading={loading} onClick={handleSave} style={{ flex: 2 }}>Simpan Dokumentasi</Btn>
          </>
        )}
      </div>
    </div>
  );
}
