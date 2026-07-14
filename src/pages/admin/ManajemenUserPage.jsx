import { useState, useEffect } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Avatar, Btn, Chip, Modal, Input, Select, SearchBar } from '../../components/ui';
import OutletDropdown from '../../components/ui/OutletDropdown';
import { alertError, alertSuccess, alertWarning, confirmAction } from '../../utils/alert';
import { getAvatarSource } from '../../utils/avatar';

const ROLE_COLORS = { frontline: C.primary, produksi: C.info, admin: C.primary, finance: C.success };
const ROLE_LABELS = { frontline: 'Frontliner', produksi: 'Produksi', admin: 'Admin', finance: 'Finance' };

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const FilterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="14" y2="6" /><line x1="20" y1="6" x2="18" y2="6" /><circle cx="16" cy="6" r="2" />
    <line x1="4" y1="12" x2="6" y2="12" /><line x1="20" y1="12" x2="10" y2="12" /><circle cx="8" cy="12" r="2" />
    <line x1="4" y1="18" x2="12" y2="18" /><line x1="20" y1="18" x2="16" y2="18" /><circle cx="14" cy="18" r="2" />
  </svg>
);

export default function ManajemenUserPage({ navigate, goBack }) {
  const isMobile = useIsMobile();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roleFilter, setRoleFilter] = useState('semua');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [outletFilter, setOutletFilter] = useState('semua');
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [modalAdd, setModalAdd] = useState(false);
  const [modalEdit, setModalEdit] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState({ name: '', role: 'frontline', outletId: '', username: '', email: '', password: '', gender: 'female' });
  const [editForm, setEditForm] = useState({ name: '', role: 'frontline', outletId: '', username: '', email: '', active: true, gender: 'female' });

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/users');
        setUsers(res?.data?.data || []);
      } catch (error) {
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
      }
    };
    fetchOutlets();
  }, []);

  const filtered = users.filter((u) => {
    const matchRole = roleFilter === 'semua' ? true : u.role === roleFilter;
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

  const activeFilterCount = [statusFilter !== 'semua', roleFilter !== 'semua', outletFilter !== 'semua'].filter(Boolean).length;

  const resetFilters = () => {
    setStatusFilter('semua');
    setRoleFilter('semua');
    setOutletFilter('semua');
  };

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
        gender: form.gender,
      };
      const res = await axios.post('/api/users/register', payload);
      const newUser = res?.data?.data;
      if (newUser) {
        const userWithAvatar = {
          ...newUser,
          avatar: newUser.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
          gender: newUser.gender || form.gender,
        };
        setUsers((prev) => [...prev, userWithAvatar]);
        alertSuccess('User berhasil ditambahkan');
      }
      setModalAdd(false);
      setForm({ name: '', role: 'frontline', outletId: '', username: '', email: '', password: '' });
    } catch (error) {
      alertError(error?.response?.data?.message || 'Gagal menambahkan user. Silakan coba lagi.');
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
      gender: user.gender || 'female',
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
        gender: editForm.gender,
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
      alertError(error?.response?.data?.message || 'Gagal mengupdate user.');
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
      alertError(error?.response?.data?.message || 'Gagal menghapus user.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @media (max-width: 480px) {
          .user-list-item {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .user-list-actions {
            width: 100% !important;
            flex-direction: row !important;
          }
          .user-modal-inputs {
            gap: 8px !important;
          }
          .user-card-row {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .user-card-actions {
            flex-direction: row !important;
            width: 100% !important;
            margin-top: 8px !important;
          }
        }
      `}</style>

      {/* ── TOP BAR ── */}
      <TopBar title="Manajemen User" onBack={goBack} rightAction={() => setModalAdd(true)} rightIcon={<PlusIcon />} />

      {/* ── SEARCH + FILTER ── */}
      <div style={{ padding: '10px 16px 0', position: 'sticky', top: 0, zIndex: 2, background: C.n50 }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama, username, email, atau outlet..." />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1, fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>
            Menampilkan <strong style={{ color: C.n700 }}>{filtered.length}</strong> dari {users.length} user
          </div>
          <button onClick={() => setFilterOpen(true)} style={{
            width: 44, height: 44, borderRadius: 12,
            border: 'none', background: 'transparent',
            color: C.primary, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', flexShrink: 0,
          }}>
            <FilterIcon />
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                width: 16, height: 16, borderRadius: 8,
                background: C.primary, color: 'white',
                fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── USER LIST ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 80px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.n200}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n700 }}>Memuat data...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 10 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: `${C.primary}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${C.primary}18` }}>
              <span style={{ fontSize: 28 }}>👤</span>
            </div>
            <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n700 }}>Belum ada user</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Tap + untuk menambahkan user</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((u) => {
              const roleColor = ROLE_COLORS[u.role] || C.n500;
              const roleLabel = ROLE_LABELS[u.role] || u.role;
              const initials = u.avatar || u.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '??';
              return (
                <div key={u.id} style={{
                  background: C.white, borderRadius: 16, padding: '14px 16px',
                  boxShadow: SHADOW.md, display: 'flex', alignItems: 'center', gap: 14,
                  opacity: u.active === false ? 0.55 : 1,
                  borderLeft: `4px solid ${roleColor}`,
                  transition: 'all 0.2s ease',
                }} className="user-card-row">
                  {/* Avatar with staff character */}
                  <div style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    overflow: 'hidden',
                    border: '2px solid #E6D9E7',
                    flexShrink: 0,
                  }}>
                    <img
                      src={getAvatarSource(u)}
                      alt="avatar"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentNode.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:${C.primary}15;font-size:14px;font-weight:700;color:${C.primary};font-family:Poppins,sans-serif">${initials}</div>`;
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{u.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{
                        background: `${roleColor}18`, color: roleColor,
                        fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 999,
                      }}>
                        {roleLabel}
                      </span>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>{u.outlet || u.username}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }} className="user-card-actions">
                    <button
                      onClick={() => toggleActive(u.id)}
                      style={{
                        padding: '5px 10px', borderRadius: 8,
                        border: `1px solid ${u.active !== false ? C.success : C.n300}`,
                        background: u.active !== false ? C.successBg : C.n50,
                        cursor: 'pointer', fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                        color: u.active !== false ? C.success : C.n500, width: 66,
                        transition: 'all 0.15s',
                      }}
                    >
                      {u.active !== false ? 'Aktif' : 'Nonaktif'}
                    </button>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(u)} style={{
                        flex: 1, padding: '6px', borderRadius: 8,
                        border: `1px solid ${C.n200}`, background: C.white,
                        cursor: 'pointer', color: C.primary, fontSize: 12, transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = `${C.primary}14`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = C.white; }}
                      >✏️</button>
                      <button onClick={() => handleDelete(u.id)} style={{
                        flex: 1, padding: '6px', borderRadius: 8,
                        border: `1px solid ${C.n200}`, background: C.white,
                        cursor: 'pointer', color: C.error, fontSize: 12, transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = `${C.error}14`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = C.white; }}
                      >🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => setModalAdd(true)}
        aria-label="Tambah User"
        style={{
          position: 'absolute', bottom: 24, right: 20,
          width: 56, height: 56, borderRadius: 28,
          background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(110,46,120,0.45)',
          zIndex: 50, transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(110,46,120,0.55)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(110,46,120,0.45)'; }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* ── FILTER MODAL ── */}
      <Modal visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter">
        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Status</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <Chip label="Semua" active={statusFilter === 'semua'} onClick={() => setStatusFilter('semua')} />
            <Chip label="Aktif" active={statusFilter === 'aktif'} onClick={() => setStatusFilter('aktif')} />
            <Chip label="Nonaktif" active={statusFilter === 'nonaktif'} onClick={() => setStatusFilter('nonaktif')} />
          </div>

          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Role</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <Chip label="Semua" active={roleFilter === 'semua'} onClick={() => setRoleFilter('semua')} />
            <Chip label="Frontliner" active={roleFilter === 'frontline'} onClick={() => setRoleFilter('frontline')} />
            <Chip label="Produksi" active={roleFilter === 'produksi'} onClick={() => setRoleFilter('produksi')} />
            <Chip label="Admin" active={roleFilter === 'admin'} onClick={() => setRoleFilter('admin')} />
            <Chip label="Finance" active={roleFilter === 'finance'} onClick={() => setRoleFilter('finance')} />
          </div>

          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Outlet</div>
          <OutletDropdown
            value={outletFilter === 'semua' ? '' : outletFilter}
            onChange={(val) => setOutletFilter(val || 'semua')}
            outlets={outlets}
            showGlobal
            style={{ marginBottom: 14 }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button onClick={resetFilters} style={{
              flex: 1, height: 38, borderRadius: 10,
              border: `1.5px solid ${C.n200}`, background: C.n50,
              fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
              color: C.n700, cursor: 'pointer',
            }}>Reset</button>
            <button onClick={() => setFilterOpen(false)} style={{
              flex: 1, height: 38, borderRadius: 10, border: 'none',
              background: C.primary, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
              color: 'white', cursor: 'pointer',
            }}>Terapkan</button>
          </div>
        </div>
      </Modal>

      {/* ── ADD MODAL ── */}
      <Modal visible={modalAdd} onClose={() => setModalAdd(false)} title="Tambah User">
        <div style={{ padding: '4px 4px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="Nama Lengkap" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Nama user" />
          <Input label="Username" value={form.username} onChange={(v) => setForm((f) => ({ ...f, username: v }))} placeholder="username" />
          <Input label="Email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="email@domain.com" />
          <Input label="Password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} type="password" placeholder="Password" />
          <Select label="Role" value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={[
            { value: 'frontline', label: 'Frontliner' },
            { value: 'produksi', label: 'Produksi' },
            { value: 'admin', label: 'Admin' },
            { value: 'finance', label: 'Finance' },
          ]} />
          <Select label="Outlet" value={form.outletId} onChange={(v) => setForm((f) => ({ ...f, outletId: v }))} options={outlets.map((o) => ({ value: o.id, label: o.name }))} placeholder="Pilih outlet" />

          {/* Gender Selection */}
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Jenis Kelamin</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setForm((f) => ({ ...f, gender: 'male' }))} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `2px solid ${form.gender === 'male' ? C.primary : C.n200}`, background: form.gender === 'male' ? `${C.primary}15` : C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>👨</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: form.gender === 'male' ? C.primary : C.n600 }}>Laki-laki</span>
              </button>
              <button type="button" onClick={() => setForm((f) => ({ ...f, gender: 'female' }))} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `2px solid ${form.gender === 'female' ? C.primary : C.n200}`, background: form.gender === 'female' ? `${C.primary}15` : C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>👩</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: form.gender === 'female' ? C.primary : C.n600 }}>Perempuan</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setModalAdd(false)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="primary" onClick={handleAdd} loading={submitting} style={{ flex: 1 }}>Simpan</Btn>
          </div>
        </div>
        </div>
      </Modal>

      {/* ── EDIT MODAL ── */}
      <Modal visible={modalEdit} onClose={() => { setModalEdit(false); setEditingUserId(null); }} title="Edit User">
        <div style={{ padding: '4px 4px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="Nama Lengkap" value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} placeholder="Nama user" />
          <Input label="Username" value={editForm.username} onChange={(v) => setEditForm((f) => ({ ...f, username: v }))} placeholder="username" />
          <Input label="Email" value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))} placeholder="email@domain.com" />
          <Select label="Role" value={editForm.role} onChange={(v) => setEditForm((f) => ({ ...f, role: v }))} options={[
            { value: 'frontline', label: 'Frontliner' },
            { value: 'produksi', label: 'Produksi' },
            { value: 'admin', label: 'Admin' },
            { value: 'finance', label: 'Finance' },
          ]} />
          <Select label="Outlet" value={editForm.outletId} onChange={(v) => setEditForm((f) => ({ ...f, outletId: v }))} options={outlets.map((o) => ({ value: o.id, label: o.name }))} placeholder="Pilih outlet" />
          <Select label="Status Akun" value={editForm.active ? 'active' : 'inactive'} onChange={(v) => setEditForm((f) => ({ ...f, active: v === 'active' }))} options={[{ value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }]} />

          {/* Gender Selection */}
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Jenis Kelamin</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setEditForm((f) => ({ ...f, gender: 'male' }))} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `2px solid ${editForm.gender === 'male' ? C.primary : C.n200}`, background: editForm.gender === 'male' ? `${C.primary}15` : C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>👨</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: editForm.gender === 'male' ? C.primary : C.n600 }}>Laki-laki</span>
              </button>
              <button type="button" onClick={() => setEditForm((f) => ({ ...f, gender: 'female' }))} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `2px solid ${editForm.gender === 'female' ? C.primary : C.n200}`, background: editForm.gender === 'female' ? `${C.primary}15` : C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>👩</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: editForm.gender === 'female' ? C.primary : C.n600 }}>Perempuan</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="secondary" onClick={() => { setModalEdit(false); setEditingUserId(null); }} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="primary" onClick={handleEdit} loading={submitting} style={{ flex: 1 }}>Update</Btn>
          </div>
        </div>
        </div>
      </Modal>
    </div>
  );
}