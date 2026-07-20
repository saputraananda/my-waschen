import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C } from '../../utils/theme';
import { useIsMobile, useResponsive } from '../../utils/hooks';
import { TopBar, ProfileAvatar, Btn, Chip, Modal, Input, Select, SearchBar } from '../../components/ui';
import OutletDropdown from '../../components/ui/OutletDropdown';
import { alertError, alertSuccess, alertWarning, confirmAction } from '../../utils/alert';
import { FloatingBubble, Sparkle, GlowOrb } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

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

const ClayCard = ({ children, style, onClick, padding = 16 }) => (
  <motion.div
    whileHover={onClick ? { y: -3, scale: 1.01 } : {}}
    whileTap={onClick ? { scale: 0.98 } : {}}
    onClick={onClick}
    style={{
      background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
      borderRadius: 18,
      padding: padding,
      boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
      border: `1px solid rgba(139, 92, 246, 0.08)`,
      ...style,
    }}
  >
    {children}
  </motion.div>
);

const SkeletonBlock = ({ height = 40, style }) => (
  <div style={{
    height, borderRadius: 14,
    background: `linear-gradient(90deg, ${C.n100} 0%, ${C.n200} 50%, ${C.n100} 100%)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    ...style,
  }}>
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);

export default function ManajemenUserPage({ navigate, goBack }) {
  const { isMobile } = useResponsive();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
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
        // silent
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

  const activeCount = users.filter(u => u.active !== false).length;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--glass-bg)', overflow: 'hidden'
    }}>
      {/* ── Premium Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: '14px 16px 32px',
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        <GlowOrb color="rgba(140, 76, 143, 0.4)" size={200} top="-60px" left="-30px" blur={50} />
        <GlowOrb color="rgba(249, 62, 17, 0.25)" size={150} top="30px" right="-40px" blur={40} />
        <Sparkle top="10%" left="15%" size={7} delay={0} />
        <Sparkle top="25%" left="80%" size={5} delay={0.5} />
        <Sparkle top="60%" left="30%" size={6} delay={1} />
        <FloatingBubble src={bubbleIcon} size={16} top="20%" left="5%" delay={0} opacity={0.4} />
        <FloatingBubble src={bubble2Icon} size={12} top="40%" right="8%" delay={0.5} opacity={0.3} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}
            >
              Manajemen User
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}
            >
              {users.length} user · {activeCount} aktif
            </motion.div>
          </div>
          {goBack && (
            <button
              onClick={goBack}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'white',
              }}
            >
              ← Kembali
            </button>
          )}
        </div>
      </div>

      {/* ── SEARCH + FILTER ── */}
      <div style={{
        padding: '12px 16px 0',
        background: 'var(--glass-bg)',
        position: 'relative', zIndex: 2,
      }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama, username, email, atau outlet..." />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1, fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>
            Menampilkan <strong style={{ color: C.n700 }}>{filtered.length}</strong> dari {users.length} user
          </div>
          <motion.button
            onClick={() => setFilterOpen(true)}
            whileTap={{ scale: 0.95 }}
            style={{
              width: 40, height: 40, borderRadius: 12,
              border: 'none',
              background: activeFilterCount > 0
                ? 'linear-gradient(145deg, #5B005F, #8C4C8F)'
                : `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
              color: activeFilterCount > 0 ? 'white' : C.primary,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: activeFilterCount > 0
                ? '0 4px 12px rgba(91,0,95,0.25)'
                : '3px 3px 8px rgba(110,46,120,0.1)',
              position: 'relative', flexShrink: 0,
            }}
          >
            <FilterIcon />
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                width: 16, height: 16, borderRadius: 8,
                background: C.danger, color: 'white',
                fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {activeFilterCount}
              </span>
            )}
          </motion.button>
        </div>
      </div>

      {/* ── USER LIST ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} height={90} />)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <ClayCard padding={40}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n600 }}>Belum ada user</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, marginTop: 4 }}>Tap + untuk menambahkan user</div>
            </div>
          </ClayCard>
        )}

        {!loading && filtered.map((u, idx) => {
          const roleColor = ROLE_COLORS[u.role] || C.n500;
          const roleLabel = ROLE_LABELS[u.role] || u.role;
          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              whileHover={{ y: -2 }}
              style={{
                background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
                borderRadius: 18,
                padding: '14px 16px',
                marginBottom: 10,
                boxShadow: '8px 8px 20px rgba(110, 46, 120, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.95)',
                border: `1px solid rgba(139, 92, 246, 0.08)`,
                borderLeft: `4px solid ${roleColor}`,
                opacity: u.active === false ? 0.55 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <ProfileAvatar user={u} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{u.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <motion.button
                    onClick={() => toggleActive(u.id)}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      padding: '5px 12px', borderRadius: 10, minWidth: 70,
                      border: 'none',
                      background: u.active !== false ? C.successBg : C.n100,
                      cursor: 'pointer', fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                      color: u.active !== false ? C.success : C.n500,
                      boxShadow: '2px 2px 6px rgba(0,0,0,0.06)',
                    }}
                  >
                    {u.active !== false ? '● Aktif' : '○ Nonaktif'}
                  </motion.button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <motion.button
                      onClick={() => openEdit(u)}
                      whileTap={{ scale: 0.9 }}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: 'none',
                        background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
                        cursor: 'pointer', fontSize: 14,
                        boxShadow: '2px 2px 6px rgba(110,46,120,0.1)',
                      }}
                    >✏️</motion.button>
                    <motion.button
                      onClick={() => handleDelete(u.id)}
                      whileTap={{ scale: 0.9 }}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: 'none',
                        background: C.dangerBg,
                        cursor: 'pointer', fontSize: 14,
                      }}
                    >🗑️</motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── FAB ── */}
      <motion.button
        onClick={() => setModalAdd(true)}
        aria-label="Tambah User"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'absolute', bottom: 24, right: 20,
          width: 56, height: 56, borderRadius: 28,
          background: 'linear-gradient(145deg, #5B005F, #8C4C8F)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 24px rgba(91,0,95,0.4)',
          zIndex: 50,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </motion.button>

      {/* ── FILTER MODAL ── */}
      <Modal visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter">
        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['semua', 'aktif', 'nonaktif'].map(f => (
              <motion.button
                key={f}
                onClick={() => setStatusFilter(f)}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '6px 12px', borderRadius: 999,
                  border: 'none',
                  background: statusFilter === f ? C.primary : C.white,
                  color: statusFilter === f ? 'white' : C.n600,
                  fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: statusFilter === f ? '0 4px 12px rgba(91,0,95,0.25)' : '2px 2px 6px rgba(0,0,0,0.06)',
                }}
              >
                {f === 'semua' ? 'Semua' : f === 'aktif' ? 'Aktif' : 'Nonaktif'}
              </motion.button>
            ))}
          </div>

          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Role</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['semua', 'frontline', 'produksi', 'admin'].map(f => (
              <motion.button
                key={f}
                onClick={() => setRoleFilter(f)}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '6px 12px', borderRadius: 999,
                  border: 'none',
                  background: roleFilter === f ? C.primary : C.white,
                  color: roleFilter === f ? 'white' : C.n600,
                  fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: roleFilter === f ? '0 4px 12px rgba(91,0,95,0.25)' : '2px 2px 6px rgba(0,0,0,0.06)',
                }}
              >
                {f === 'semua' ? 'Semua' : ROLE_LABELS[f] || f}
              </motion.button>
            ))}
          </div>

          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Outlet</div>
          <OutletDropdown
            value={outletFilter === 'semua' ? '' : outletFilter}
            onChange={(val) => setOutletFilter(val || 'semua')}
            outlets={outlets}
            showGlobal
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <motion.button
              onClick={resetFilters}
              whileTap={{ scale: 0.97 }}
              style={{
                flex: 1, height: 42, borderRadius: 12,
                border: `1.5px solid ${C.n200}`,
                background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
                fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                color: C.n600, cursor: 'pointer',
                boxShadow: '3px 3px 8px rgba(110,46,120,0.08)',
              }}
            >Reset</motion.button>
            <motion.button
              onClick={() => setFilterOpen(false)}
              whileTap={{ scale: 0.97 }}
              style={{
                flex: 1, height: 42, borderRadius: 12, border: 'none',
                background: 'linear-gradient(145deg, #5B005F, #8C4C8F)',
                fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                color: 'white', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(91,0,95,0.25)',
              }}
            >Terapkan</motion.button>
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
            ]} />
            <Select label="Outlet" value={form.outletId} onChange={(v) => setForm((f) => ({ ...f, outletId: v }))} options={outlets.map((o) => ({ value: o.id, label: o.name }))} placeholder="Pilih outlet" />

            {/* Gender Selection */}
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Jenis Kelamin</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[['male', '👨', 'Laki-laki'], ['female', '👩', 'Perempuan']].map(([val, emoji, label]) => (
                  <motion.button
                    key={val}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, gender: val }))}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 12,
                      border: `2px solid ${form.gender === val ? C.primary : C.n200}`,
                      background: form.gender === val ? `${C.primary}15` : C.white,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: form.gender === val ? `0 4px 12px ${C.primary}25` : 'none',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{emoji}</span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: form.gender === val ? C.primary : C.n600 }}>{label}</span>
                  </motion.button>
                ))}
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
            ]} />
            <Select label="Outlet" value={editForm.outletId} onChange={(v) => setEditForm((f) => ({ ...f, outletId: v }))} options={outlets.map((o) => ({ value: o.id, label: o.name }))} placeholder="Pilih outlet" />
            <Select label="Status Akun" value={editForm.active ? 'active' : 'inactive'} onChange={(v) => setEditForm((f) => ({ ...f, active: v === 'active' }))} options={[{ value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }]} />

            {/* Gender Selection */}
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Jenis Kelamin</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[['male', '👨', 'Laki-laki'], ['female', '👩', 'Perempuan']].map(([val, emoji, label]) => (
                  <motion.button
                    key={val}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, gender: val }))}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 12,
                      border: `2px solid ${editForm.gender === val ? C.primary : C.n200}`,
                      background: editForm.gender === val ? `${C.primary}15` : C.white,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: editForm.gender === val ? `0 4px 12px ${C.primary}25` : 'none',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{emoji}</span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: editForm.gender === val ? C.primary : C.n600 }}>{label}</span>
                  </motion.button>
                ))}
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
