import { useState } from 'react';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { MOCK_DATA } from '../../utils/mockData';
import { TopBar, Btn, Chip, Modal, Input, Select } from '../../components/ui';

export default function ManajemenLayananPage({ navigate }) {
  const [services, setServices] = useState(MOCK_DATA.services);
  const [filter, setFilter] = useState('all');
  const [modalAdd, setModalAdd] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Cuci', price: '', unit: 'kg', expressExtra: '' });

  const categories = ['all', ...new Set(services.map((s) => s.category))];
  const filtered = filter === 'all' ? services : services.filter((s) => s.category === filter);

  const handleAdd = () => {
    if (!form.name.trim() || !form.price) return;
    setServices((prev) => [...prev, { ...form, id: 'SVC' + Date.now(), price: Number(form.price), expressExtra: form.expressExtra ? Number(form.expressExtra) : null, active: true }]);
    setModalAdd(false);
    setForm({ name: '', category: 'Cuci', price: '', unit: 'kg', expressExtra: '' });
  };

  const toggleActive = (id) => setServices((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden', position: 'relative' }}>
      <TopBar title="Manajemen Layanan" onBack={() => navigate('dashboard')} rightAction={() => setModalAdd(true)} rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>} />

      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
          {categories.map((cat) => (
            <Chip key={cat} label={cat === 'all' ? 'Semua' : cat} active={filter === cat} onClick={() => setFilter(cat)} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((s) => (
            <div key={s.id} style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', opacity: s.active === false ? 0.5 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{s.name}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>{s.category} · per {s.unit}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.primary }}>{rp(s.price)}</span>
                    {s.expressExtra && <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.warning, fontWeight: 600 }}>⚡ +{rp(s.expressExtra)}</span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(s.id)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${s.active !== false ? C.success : C.n300}`, background: s.active !== false ? '#DCFCE7' : C.n50, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: s.active !== false ? C.success : C.n600, flexShrink: 0 }}
                >
                  {s.active !== false ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal visible={modalAdd} onClose={() => setModalAdd(false)} title="Tambah Layanan">
        <Input label="Nama Layanan" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Contoh: Cuci Kiloan" />
        <Select label="Kategori" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={['Cuci', 'Setrika', 'Dry Clean', 'Sepatu'].map((c) => ({ value: c, label: c }))} />
        <Input label="Harga (Rp)" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} inputMode="numeric" placeholder="0" />
        <Input label="Satuan" value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} placeholder="kg / pcs / pasang" />
        <Input label="Harga Express (opsional)" value={form.expressExtra} onChange={(v) => setForm((f) => ({ ...f, expressExtra: v }))} inputMode="numeric" placeholder="Tambahan harga express" />
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={() => setModalAdd(false)} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={handleAdd} style={{ flex: 1 }}>Simpan</Btn>
        </div>
      </Modal>
    </div>
  );
}
