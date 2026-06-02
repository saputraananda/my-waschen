import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, Avatar, Btn, Chip, Modal, Input, Select, SearchBar } from '../../components/ui';
import { alertError, alertSuccess, alertWarning, confirmAction } from '../../utils/alert';

export default function ManajemenUserPage({ navigate, goBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('semua');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [outletFilter, setOutletFilter] = useState('semua');
  const [query, setQuery] = useState('');
  const [modalAdd, setModalAdd] = useState(false);
  const [modalEdit, setModalEdit] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState({ name: '', role: 'frontline', outletId: '', username: '', email: '', password: '' });
  const [editForm, setEditForm] = useState({ name: '', role: 'frontline', outletId: '', username: '', email: '', active: true });

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
        alertError(error?.response?.data?.message || 'Gagal memuat data user');
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

  const filtered = users.filter((u) => {
    const matchRole = filter === 'semua' ? true : u.role === filter;
    const matchStatus = statusFilter === 'semua'
      ? true
      : statusFilter === 'aktif'
        ? u.active !== false
        : u.active === false;
    const matchOutlet = outletFilter === 'semua'
      ? true
      : outletFilter === 'global'
        ? !u.outletId && !u.outlet
        : String(u.outletId || '') === String(outletFilter);
    const q = query.trim().toLowerCase();
    const matchQuery = !q
      ? true
      : (u.name || '').toLowerCase().includes(q)
        || (u.username || '').toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
        || (u.outlet || '').toLowerCase().includes(q);
    return matchRole && matchStatus && matchOutlet && matchQuery;
  });

  const ROLE_COLORS = { kasir: C.primary, produksi: '#0EA5E9', admin: '#8B5CF6', finance: C.success };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.email.trim() || !form.password) {
      alertWarning('Nama, username, email, dan password wajib diisi');
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
        alertSuccess('User berhasil ditambahkan');
      }
      setModalAdd(false);
      setForm({ name: '', role: 'frontline', outletId: '', username: '', email: '', password: '' });
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal menambahkan user. Silakan coba lagi.';
      console.error('Failed to add user:', error);
      alertError(msg);
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
      alertSuccess(`User ${user.active ? 'dinonaktifkan' : 'diaktifkan'}`);
    } catch (error) {
      console.error('Failed to toggle user:', error);
      alertError(error?.response?.data?.message || 'Gagal mengubah status user');
    }
  };

  const openEdit = (user) => {
    const outlet = outlets.find((o) => o.name === user.outlet);
    setEditingUserId(user.id);
    setEditForm({
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      role: user.role || 'frontline',
      outletId: outlet?.id || '',
      active: user.active !== false,
    });
    setModalEdit(true);
  };

  const handleEdit = async () => {
    if (!editForm.name.trim() || !editForm.username.trim() || !editForm.email.trim()) {
      alertWarning('Nama, username, dan email wajib diisi');
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
      alertSuccess('User berhasil diupdate');
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal mengupdate user.';
      alertError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirmAction({ text: 'Hapus akun ini? Akun resign akan diarsipkan dan tidak muncul di daftar.' });
    if (!ok) return;
    setSubmitting(true);
    try {
      await axios.delete(`/api/users/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      alertSuccess('User berhasil dihapus');
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal menghapus user.';
      alertError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden', position: 'relative' }}>
      <TopBar title="Manajemen User" onBack={goBack} />

      <div style={{ padding: '12px 16px 0' }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama, username, email, atau outlet..." />

        {/* Filter compact: 3 dropdown side-by-side biar gak numpuk */}
        <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 8 }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10,
              border: `1.5px solid ${statusFilter === 'semua' ? C.n200 : C.primary}`,
              background: statusFilter === 'semua' ? '#FFFFFF' : `${C.primary}10`,
              color: statusFilter === 'semua' ? C.n700 : C.primary,
              fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="semua">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10,
              border: `1.5px solid ${filter === 'semua' ? C.n200 : C.primary}`,
              background: filter === 'semua' ? '#FFFFFF' : `${C.primary}10`,
              color: filter === 'semua' ? C.n700 : C.primary,
              fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="semua">Semua Role</option>
            <option value="frontline">Frontline</option>
            <option value="produksi">Produksi</option>
            <option value="admin">Admin</option>
            <option value="finance">Finance</option>
          </select>
          <select
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            style={{
              flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10,
              border: `1.5px solid ${outletFilter === 'semua' ? C.n200 : C.primary}`,
              background: outletFilter === 'semua' ? '#FFFFFF' : `${C.primary}10`,
              color: outletFilter === 'semua' ? C.n700 : C.primary,
              fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="semua">Semua Outlet</option>
            <option value="global">🌐 Global (Tanpa Outlet)</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginBottom: 8 }}>
          Menampilkan <strong style={{ color: C.n700 }}>{filtered.length}</strong> dari {users.length} user
          {(statusFilter !== 'semua' || filter !== 'semua' || outletFilter !== 'semua' || query.trim()) && (
            <button
              onClick={() => { setStatusFilter('semua'); setFilter('semua'); setOutletFilter('semua'); setQuery(''); }}
              style={{ marginLeft: 8, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
            >Reset</button>
          )}
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

      {/* Floating Action Button — Tambah User */}
      <button
        onClick={() => setModalAdd(true)}
        aria-label="Tambah User"
        style={{
          position: 'absolute', bottom: 24, right: 20,
          width: 56, height: 56, borderRadius: 28,
          background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(91,33,182,0.45)',
          zIndex: 50,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(91,33,182,0.55)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(91,33,182,0.45)'; }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <Modal visible={modalAdd} onClose={() => setModalAdd(false)} title="Tambah User">
        <Input label="Nama Lengkap" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Nama user" />
        <Input label="Username" value={form.username} onChange={(v) => setForm((f) => ({ ...f, username: v }))} placeholder="username" />
        <Input label="Email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="email@domain.com" />
        <Input label="Password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} type="password" placeholder="Password" />
        <Select label="Role" value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={[{ value: 'frontline', label: 'Frontline' }, { value: 'produksi', label: 'Produksi' }, { value: 'admin', label: 'Admin' }, { value: 'finance', label: 'Finance' }]} />
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
        <Select label="Role" value={editForm.role} onChange={(v) => setEditForm((f) => ({ ...f, role: v }))} options={[{ value: 'frontline', label: 'Frontline' }, { value: 'produksi', label: 'Produksi' }, { value: 'admin', label: 'Admin' }, { value: 'finance', label: 'Finance' }]} />
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
