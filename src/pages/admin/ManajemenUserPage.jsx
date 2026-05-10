import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, Avatar, Btn, Chip, Modal, Input, Select, Toast, SearchBar } from '../../components/ui';

export default function ManajemenUserPage({ navigate }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('semua');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [query, setQuery] = useState('');
  const [modalAdd, setModalAdd] = useState(false);
  const [modalEdit, setModalEdit] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState({ name: '', role: 'kasir', outletId: '', username: '', email: '', password: '' });
  const [editForm, setEditForm] = useState({ name: '', role: 'kasir', outletId: '', username: '', email: '', active: true });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  // Fetch users from API on mount
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/users');
        const data = res?.data?.data || [];
        setUsers(data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        showToast('Gagal memuat data user', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchOutlets = async () => {
      try {
        const res = await axios.get('/api/master/outlets');
        setOutlets(res?.data?.data || []);
      } catch (error) {
        console.error('Failed to fetch outlets:', error);
      }
    };
    fetchOutlets();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  const filtered = users.filter((u) => {
    const matchRole = filter === 'semua' ? true : u.role === filter;
    const matchStatus = statusFilter === 'semua'
      ? true
      : statusFilter === 'aktif'
        ? u.active !== false
        : u.active === false;
    const q = query.trim().toLowerCase();
    const matchQuery = !q
      ? true
      : (u.name || '').toLowerCase().includes(q)
        || (u.username || '').toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
        || (u.outlet || '').toLowerCase().includes(q);
    return matchRole && matchStatus && matchQuery;
  });

  const ROLE_COLORS = { kasir: C.primary, produksi: '#0EA5E9', admin: '#8B5CF6', finance: C.success };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.email.trim() || !form.password) {
      showToast('Nama, username, email, dan password wajib diisi', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        outletId: form.outletId || null,
      };
      const res = await axios.post('/api/users/register', payload);
      const newUser = res?.data?.data;
      if (newUser) {
        // Generate avatar untuk user baru
        const userWithAvatar = {
          ...newUser,
          avatar: newUser.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase(),
        };
        setUsers((prev) => [...prev, userWithAvatar]);
        showToast('User berhasil ditambahkan', 'success');
      }
      setModalAdd(false);
      setForm({ name: '', role: 'kasir', outletId: '', username: '', email: '', password: '' });
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal menambahkan user. Silakan coba lagi.';
      console.error('Failed to add user:', error);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (id) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    try {
      await axios.patch(`/api/users/${id}/toggle`, { active: !user.active });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));
      showToast(`User ${user.active ? 'dinonaktifkan' : 'diaktifkan'}`, 'success');
    } catch (error) {
      console.error('Failed to toggle user:', error);
      showToast('Gagal mengubah status user', 'error');
    }
  };

  const openEdit = (user) => {
    const outlet = outlets.find((o) => o.name === user.outlet);
    setEditingUserId(user.id);
    setEditForm({
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      role: user.role || 'kasir',
      outletId: outlet?.id || '',
      active: user.active !== false,
    });
    setModalEdit(true);
  };

  const handleEdit = async () => {
    if (!editForm.name.trim() || !editForm.username.trim() || !editForm.email.trim()) {
      showToast('Nama, username, dan email wajib diisi', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        username: editForm.username.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        outletId: editForm.outletId || null,
        active: !!editForm.active,
      };
      const res = await axios.put(`/api/users/${editingUserId}`, payload);
      const updated = res?.data?.data;
      if (updated) {
        setUsers((prev) => prev.map((u) => (u.id === editingUserId ? { ...u, ...updated } : u)));
      }
      setModalEdit(false);
      setEditingUserId(null);
      showToast('User berhasil diupdate', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal mengupdate user.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus akun ini? Akun resign akan diarsipkan dan tidak muncul di daftar.')) return;
    setSubmitting(true);
    try {
      await axios.delete(`/api/users/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast('User berhasil dihapus', 'success');
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal menghapus user.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden', position: 'relative' }}>
      <TopBar title="Manajemen User" onBack={() => navigate('dashboard')} rightAction={() => setModalAdd(true)} rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>} />

      <div style={{ padding: '12px 16px 0' }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama, username, email, atau outlet..." />
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 10, paddingBottom: 10, scrollbarWidth: 'none' }}>
          {['semua', 'aktif', 'nonaktif'].map((s) => (
            <Chip key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
          {['semua', 'kasir', 'produksi', 'admin', 'finance'].map((f) => (
            <Chip key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} active={filter === f} onClick={() => setFilter(f)} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.n200}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat data...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 12 }}>
            <span style={{ fontSize: 40 }}>👤</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 14, color: C.n500 }}>Belum ada user</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n400 }}>Tap + untuk menambahkan user</span>
          </div>
        ) : (
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={() => toggleActive(u.id)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${u.active !== false ? C.success : C.n300}`, background: u.active !== false ? '#DCFCE7' : C.n50, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: u.active !== false ? C.success : C.n600 }}
                >
                  {u.active !== false ? 'Aktif' : 'Nonaktif'}
                </button>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => openEdit(u)}
                    style={{ padding: '4px 8px', borderRadius: 7, border: `1px solid ${C.n300}`, background: C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, color: C.primary }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    style={{ padding: '4px 8px', borderRadius: 7, border: `1px solid ${C.n300}`, background: C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, color: C.error }}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      <Modal visible={modalAdd} onClose={() => setModalAdd(false)} title="Tambah User">
        <Input label="Nama Lengkap" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Nama user" />
        <Input label="Username" value={form.username} onChange={(v) => setForm((f) => ({ ...f, username: v }))} placeholder="username" />
        <Input label="Email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="email@domain.com" />
        <Input label="Password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} type="password" placeholder="Password" />
        <Select label="Role" value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={[{ value: 'kasir', label: 'Kasir' }, { value: 'produksi', label: 'Produksi' }, { value: 'admin', label: 'Admin' }, { value: 'finance', label: 'Finance' }]} />
        <Select
          label="Outlet"
          value={form.outletId}
          onChange={(v) => setForm((f) => ({ ...f, outletId: v }))}
          options={outlets.map((o) => ({ value: o.id, label: o.name }))}
          placeholder="Pilih outlet"
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={() => setModalAdd(false)} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={handleAdd} loading={submitting} style={{ flex: 1 }}>Simpan</Btn>
        </div>
      </Modal>

      <Modal visible={modalEdit} onClose={() => { setModalEdit(false); setEditingUserId(null); }} title="Edit User">
        <Input label="Nama Lengkap" value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} placeholder="Nama user" />
        <Input label="Username" value={editForm.username} onChange={(v) => setEditForm((f) => ({ ...f, username: v }))} placeholder="username" />
        <Input label="Email" value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))} placeholder="email@domain.com" />
        <Select label="Role" value={editForm.role} onChange={(v) => setEditForm((f) => ({ ...f, role: v }))} options={[{ value: 'kasir', label: 'Kasir' }, { value: 'produksi', label: 'Produksi' }, { value: 'admin', label: 'Admin' }, { value: 'finance', label: 'Finance' }]} />
        <Select
          label="Outlet"
          value={editForm.outletId}
          onChange={(v) => setEditForm((f) => ({ ...f, outletId: v }))}
          options={outlets.map((o) => ({ value: o.id, label: o.name }))}
          placeholder="Pilih outlet"
        />
        <Select
          label="Status Akun"
          value={editForm.active ? 'active' : 'inactive'}
          onChange={(v) => setEditForm((f) => ({ ...f, active: v === 'active' }))}
          options={[
            { value: 'active', label: 'Aktif' },
            { value: 'inactive', label: 'Nonaktif' },
          ]}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={() => { setModalEdit(false); setEditingUserId(null); }} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={handleEdit} loading={submitting} style={{ flex: 1 }}>Update</Btn>
        </div>
      </Modal>
    </div>
  );
}
