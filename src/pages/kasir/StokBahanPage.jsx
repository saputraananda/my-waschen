import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, Btn, Modal, Input } from '../../components/ui';
import { useApp } from '../../context/AppContext';

export default function StokBahanPage({ goBack }) {
  const { navigate, user } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [qtyStr, setQtyStr] = useState('');
  const [noteStr, setNoteStr] = useState('');
  const [saving, setSaving] = useState(false);

  const outletId = user?.outletId;

  const load = useCallback(async () => {
    if (!outletId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`/api/inventory/stock?outletId=${outletId}`);
      setRows(res?.data?.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitAdjust = async () => {
    if (!modal || !outletId) return;
    const q = Number(qtyStr);
    if (!Number.isFinite(q) || q === 0) return;
    setSaving(true);
    try {
      await axios.post('/api/inventory/adjust', {
        inventoryId: modal.id,
        outletId,
        qtyDelta: q,
        notes: noteStr || null,
      });
      setModal(null);
      setQtyStr('');
      setNoteStr('');
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Stok bahan" subtitle="Bahan kimia, plastik, pewangi — per outlet" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {!outletId && (
          <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Akun ini tidak terikat outlet — stok outlet tidak dapat ditampilkan.</div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: C.n500, fontFamily: 'Poppins' }}>Memuat...</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              style={{
                background: C.white,
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 10,
                boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
                borderLeft: r.lowStock ? `4px solid ${C.warning}` : `4px solid ${C.n200}`,
              }}
            >
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>{r.categoryName}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>{r.name}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 4 }}>
                Kode: {r.itemCode} · {r.trackingType}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div>
                  <span style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: r.lowStock ? C.warning : C.primary }}>
                    {Number(r.stockQty).toLocaleString('id-ID')}
                  </span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}> {r.unit}</span>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Min. {Number(r.minStock).toLocaleString('id-ID')} {r.unit}</div>
                </div>
                <Btn size="sm" variant="secondary" onClick={() => { setModal(r); setQtyStr(''); setNoteStr(''); }}>Sesuaikan</Btn>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal visible={!!modal} onClose={() => setModal(null)} title={modal ? `Stok: ${modal.name}` : ''}>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 12 }}>
          Stok sekarang: <strong>{modal ? Number(modal.stockQty).toLocaleString('id-ID') : ''}</strong> {modal?.unit}. Masukkan perubahan (positif = tambah, negatif = kurang).
        </div>
        <Input label="Perubahan qty" value={qtyStr} onChange={setQtyStr} type="number" placeholder="Contoh: 5 atau -2" />
        <Input label="Catatan" value={noteStr} onChange={setNoteStr} placeholder="Opsional" />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Btn variant="secondary" style={{ flex: 1 }} onClick={() => setModal(null)}>Batal</Btn>
          <Btn variant="primary" style={{ flex: 1 }} loading={saving} onClick={submitAdjust}>Simpan</Btn>
        </div>
      </Modal>
    </div>
  );
}
