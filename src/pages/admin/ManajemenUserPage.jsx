import { useState } from 'react';
import { C } from '../../utils/theme';
import { MOCK_DATA } from '../../utils/mockData';
import { TopBar, Avatar, Btn, Chip, Modal, Input, Select } from '../../components/ui';

export default function ManajemenUserPage({ navigate }) {
  const [users, setUsers] = useState(MOCK_DATA.users);
  const [filter, setFilter] = useState('semua');
  const [modalAdd, setModalAdd] = useState(false);
  const [form, setForm] = useState({ name: '', role: 'kasir', outlet: '', username: '', password: '' });

  const filtered = filter === 'semua' ? users : users.filter((u) => u.role === filter);

  const ROLE_COLORS = { kasir: C.primary, produksi: '#0EA5E9', admin: '#8B5CF6', finance: C.success };

  const handleAdd = () => {
    if (!form.name.trim() || !form.username.trim()) return;
    setUsers((prev) => [...prev, { ...form, id: 'U' + Date.now(), avatar: form.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(), active: true }]);
    setModalAdd(false);
    setForm({ name: '', role: 'kasir', outlet: '', username: '', password: '' });
  };

  const toggleActive = (id) => setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden', position: 'relative' }}>
      <TopBar title="Manajemen User" onBack={() => navigate('dashboard')} rightAction={() => setModalAdd(true)} rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>} />

      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
          {['semua', 'kasir', 'produksi', 'admin', 'finance'].map((f) => (
            <Chip key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} active={filter === f} onClick={() => setFilter(f)} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((u) => (
            <div key={u.id} style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', display: 'flex', alignItems: 'center', gap: 12, opacity: u.active === false ? 0.5 : 1 }}>
              <Avatar initials={u.avatar} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{u.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ background: `${ROLE_COLORS[u.role] || C.n600}18`, color: ROLE_COLORS[u.role] || C.n600, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{u.role.toUpperCase()}</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{u.outlet || u.username}</span>
                </div>
              </div>
              <button
                onClick={() => toggleActive(u.id)}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${u.active !== false ? C.success : C.n300}`, background: u.active !== false ? '#DCFCE7' : C.n50, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: u.active !== false ? C.success : C.n600 }}
              >
                {u.active !== false ? 'Aktif' : 'Nonaktif'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <Modal visible={modalAdd} onClose={() => setModalAdd(false)} title="Tambah User">
        <Input label="Nama Lengkap" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Nama user" />
        <Input label="Username" value={form.username} onChange={(v) => setForm((f) => ({ ...f, username: v }))} placeholder="username" />
        <Input label="Password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} type="password" placeholder="Password" />
        <Select label="Role" value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={[{ value: 'kasir', label: 'Kasir' }, { value: 'produksi', label: 'Produksi' }, { value: 'admin', label: 'Admin' }, { value: 'finance', label: 'Finance' }]} />
        <Input label="Outlet" value={form.outlet} onChange={(v) => setForm((f) => ({ ...f, outlet: v }))} placeholder="Nama outlet" />
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={() => setModalAdd(false)} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={handleAdd} style={{ flex: 1 }}>Simpan</Btn>
        </div>
      </Modal>
    </div>
  );
}
