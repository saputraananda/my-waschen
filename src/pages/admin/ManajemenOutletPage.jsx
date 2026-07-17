import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useResponsive } from '../../utils/hooks';
import { TopBar, Btn, Modal, Chip } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { FloatingBubble, Sparkle, GlowOrb } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

// ─── Premium Animation Helpers ─────────────────────────────────────────────────
const ClayIcon = ({ icon, color = C.primary, size = 40 }) => (
  <div style={{
    width: size, height: size,
    borderRadius: size * 0.28,
    background: `linear-gradient(145deg, ${color}20, ${color}08)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: color,
    boxShadow: `3px 3px 8px ${color}15, -1px -1px 4px rgba(255, 255, 255, 0.9)`,
    fontSize: size * 0.45,
  }}>
    {icon}
  </div>
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
    height,
    borderRadius: 12,
    background: `linear-gradient(90deg, ${C.n100} 0%, ${C.n200} 50%, ${C.n100} 100%)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    ...style,
  }}>
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);

const EMPTY_FORM = { name: '', outletCode: '', address: '', phone: '', email: '' };

export default function ManajemenOutletPage({ navigate, goBack }) {
  const { isMobile } = useResponsive();
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(null);

  const fetchOutlets = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/outlets/admin/all');
      setOutlets(res?.data?.data || []);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal memuat data outlet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOutlets(); }, []);

  const filtered = outlets.filter((o) => {
    if (filter === 'active') return o.isActive;
    if (filter === 'inactive') return !o.isActive;
    return true;
  });

  const openCreate = () => {
    setEditingOutlet(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (o) => {
    setEditingOutlet(o);
    setForm({
      name: o.name || '',
      outletCode: o.outletCode || '',
      address: o.address || '',
      phone: o.phone || '',
      email: o.email || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.outletCode.trim()) {
      alertWarning('Nama dan kode outlet wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingOutlet) {
        await axios.put(`/api/outlets/${editingOutlet.id}`, form);
        alertSuccess('Outlet berhasil diperbarui.');
      } else {
        await axios.post('/api/outlets', form);
        alertSuccess('Outlet baru berhasil dibuat.');
      }
      setShowForm(false);
      fetchOutlets();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan outlet.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (outlet) => {
    try {
      await axios.patch(`/api/outlets/${outlet.id}/toggle`, { isActive: !outlet.isActive });
      alertSuccess(`Outlet ${!outlet.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`);
      setConfirmToggle(null);
      fetchOutlets();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengubah status.');
    }
  };

  const handleDelete = async (outlet) => {
    const { confirmAction } = await import('../../utils/alert');
    const ok = await confirmAction({
      text: `Hapus outlet "${outlet.name}"? Outlet akan diarsipkan dan semua user terkait dinonaktifkan.`,
    });
    if (!ok) return;
    try {
      await axios.delete(`/api/outlets/${outlet.id}`);
      alertSuccess(`Outlet "${outlet.name}" berhasil dihapus.`);
      fetchOutlets();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menghapus outlet.');
    }
  };

  const totalRevenue = outlets.reduce((s, o) => s + o.monthlyRevenue, 0);
  const activeCount = outlets.filter(o => o.isActive).length;

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
              Manajemen Outlet
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}
            >
              {outlets.length} outlet terdaftar
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

      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '0 16px 24px',
        marginTop: -14,
        position: 'relative', zIndex: 1,
      }}>
        {/* Summary cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10, marginBottom: 14,
        }}>
          {[
            { label: 'Total', value: outlets.length, color: C.primary },
            { label: 'Aktif', value: activeCount, color: C.success },
            { label: 'Omset 30H', value: rp(totalRevenue), color: C.info, small: true },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              style={{
                background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
                borderRadius: 14,
                padding: '12px',
                textAlign: 'center',
                boxShadow: '8px 8px 20px rgba(110, 46, 120, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.95)',
                border: `1px solid rgba(139, 92, 246, 0.08)`,
              }}
            >
              <div style={{
                fontFamily: 'Poppins', fontSize: s.small ? 12 : 18,
                fontWeight: 700, color: s.color,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.value}
              </div>
              <div style={{
                fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                color: C.n500, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3,
              }}>
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filter + Add */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            {['all', 'active', 'inactive'].map(f => (
              <motion.button
                key={f}
                onClick={() => setFilter(f)}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  background: filter === f ? C.primary : C.white,
                  color: filter === f ? 'white' : C.n600,
                  fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: filter === f ? '0 4px 12px rgba(91,0,95,0.25)' : '2px 2px 6px rgba(110,46,120,0.08)',
                }}
              >
                {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : 'Nonaktif'}
              </motion.button>
            ))}
          </div>
          <motion.button
            onClick={openCreate}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '8px 14px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(145deg, #5B005F, #8C4C8F)',
              color: 'white',
              fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              boxShadow: '0 4px 14px rgba(91,0,95,0.3)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Outlet
          </motion.button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <SkeletonBlock key={i} height={140} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <ClayCard padding={40}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n600 }}>Tidak ada outlet</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, marginTop: 4 }}>Tambah outlet baru untuk memulai</div>
            </div>
          </ClayCard>
        )}

        {/* Outlet list */}
        {!loading && filtered.map((o, idx) => {
          const pctTarget = o.targetAmount ? Math.min(100, Math.round((o.monthlyRevenue / o.targetAmount) * 100)) : null;
          return (
            <motion.div
              key={o.id}
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
                border: `1px solid ${o.isActive ? 'rgba(139, 92, 246, 0.08)' : C.danger + '40'}`,
                opacity: o.isActive ? 1 : 0.75,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `linear-gradient(145deg, ${o.isActive ? C.primary + '18' : C.danger + '15'}, ${o.isActive ? C.primary + '08' : C.danger + '05'})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                  boxShadow: `3px 3px 8px ${o.isActive ? C.primary : C.danger}20, -2px -2px 6px rgba(255,255,255,0.9)`,
                }}>
                  🏪
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{o.name}</span>
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 999,
                      background: o.isActive ? C.successBg : C.dangerBg,
                      color: o.isActive ? C.successDark : C.danger,
                    }}>
                      {o.isActive ? '● Aktif' : '● Nonaktif'}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
                    {o.outletCode} {o.address ? `· ${o.address}` : ''}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div style={{
                display: 'flex', gap: 12, marginTop: 12, paddingTop: 10,
                borderTop: `1px solid ${C.n100}`, flexWrap: 'wrap',
              }}>
                {[
                  { label: 'TIM', value: o.teamCount },
                  { label: 'LAYANAN', value: o.serviceCount },
                  { label: 'TX/30H', value: o.monthlyTxCount },
                  { label: 'OMSET/30H', value: rp(o.monthlyRevenue), primary: true },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, minWidth: '40%' }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, fontWeight: 600 }}>{s.label}</div>
                    <div style={{
                      fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                      color: s.primary ? C.primary : C.n800, marginTop: 2,
                    }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Target progress */}
              {pctTarget !== null && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>Target bulan ini</span>
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                      color: pctTarget >= 100 ? C.success : pctTarget >= 70 ? C.warning : C.danger,
                    }}>
                      {pctTarget}%
                    </span>
                  </div>
                  <div style={{ height: 5, background: C.n100, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pctTarget}%`,
                      background: pctTarget >= 100 ? C.success : pctTarget >= 70 ? C.warning : C.danger,
                      borderRadius: 3,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <motion.button
                  onClick={() => openEdit(o)}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    flex: 1, height: 34, borderRadius: 10, minWidth: 70,
                    border: `1.5px solid ${C.n200}`,
                    background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
                    fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700,
                    cursor: 'pointer',
                    boxShadow: '3px 3px 8px rgba(110,46,120,0.08)',
                  }}
                >
                  ✏️ Edit
                </motion.button>
                <motion.button
                  onClick={() => navigate('kasir_laporan', { outletId: o.id })}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    flex: 1, height: 34, borderRadius: 10, minWidth: 70,
                    border: 'none',
                    background: 'linear-gradient(145deg, #5B005F, #8C4C8F)',
                    fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(91,0,95,0.2)',
                  }}
                >
                  📊 Laporan
                </motion.button>
                <motion.button
                  onClick={() => setConfirmToggle(o)}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    flex: 1, height: 34, borderRadius: 10, minWidth: 70,
                    border: 'none',
                    background: o.isActive ? C.dangerBg : C.successBg,
                    fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                    color: o.isActive ? C.danger : C.success, cursor: 'pointer',
                  }}
                >
                  {o.isActive ? '⏸ Nonaktif' : '▶ Aktifkan'}
                </motion.button>
                <motion.button
                  onClick={() => handleDelete(o)}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    flex: 1, height: 34, borderRadius: 10, minWidth: 70,
                    border: `1.5px solid ${C.danger}40`,
                    background: `${C.danger}08`,
                    fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                    color: C.danger, cursor: 'pointer',
                  }}
                >
                  🗑️ Hapus
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      <Modal visible={showForm} onClose={() => setShowForm(false)} title={editingOutlet ? 'Edit Outlet' : 'Outlet Baru'}>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4, display: 'block' }}>Kode Outlet *</label>
              <input
                value={form.outletCode}
                onChange={(e) => setForm({ ...form, outletCode: e.target.value })}
                placeholder="cth: RAFFLES"
                style={{
                  width: '100%', height: 44, borderRadius: 12,
                  border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins',
                  fontSize: 13, padding: '0 14px', boxSizing: 'border-box',
                  background: C.white, outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = C.primary}
                onBlur={e => e.target.style.borderColor = C.n200}
              />
            </div>
            <div>
              <label style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4, display: 'block' }}>Nama Outlet *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="cth: Waschen Laundry Raffles Hills"
                style={{
                  width: '100%', height: 44, borderRadius: 12,
                  border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins',
                  fontSize: 13, padding: '0 14px', boxSizing: 'border-box',
                  background: C.white, outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = C.primary}
                onBlur={e => e.target.style.borderColor = C.n200}
              />
            </div>
            <div>
              <label style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4, display: 'block' }}>Alamat</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Alamat lengkap outlet"
                style={{
                  width: '100%', height: 44, borderRadius: 12,
                  border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins',
                  fontSize: 13, padding: '0 14px', boxSizing: 'border-box',
                  background: C.white, outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = C.primary}
                onBlur={e => e.target.style.borderColor = C.n200}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4, display: 'block' }}>Telepon</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="08xx"
                  style={{
                    width: '100%', height: 44, borderRadius: 12,
                    border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins',
                    fontSize: 13, padding: '0 14px', boxSizing: 'border-box',
                    background: C.white, outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = C.primary}
                  onBlur={e => e.target.style.borderColor = C.n200}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4, display: 'block' }}>Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@outlet.com"
                  style={{
                    width: '100%', height: 44, borderRadius: 12,
                    border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins',
                    fontSize: 13, padding: '0 14px', boxSizing: 'border-box',
                    background: C.white, outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = C.primary}
                  onBlur={e => e.target.style.borderColor = C.n200}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <motion.button
              onClick={() => setShowForm(false)}
              whileTap={{ scale: 0.97 }}
              style={{
                flex: 1, height: 44, borderRadius: 12,
                border: `1.5px solid ${C.n200}`,
                background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
                fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                color: C.n600, cursor: 'pointer',
                boxShadow: '3px 3px 8px rgba(110,46,120,0.08)',
              }}
            >
              Batal
            </motion.button>
            <motion.button
              onClick={handleSubmit}
              disabled={submitting}
              whileTap={{ scale: submitting ? 1 : 0.97 }}
              style={{
                flex: 2, height: 44, borderRadius: 12, border: 'none',
                background: submitting
                  ? C.n300
                  : 'linear-gradient(145deg, #5B005F, #8C4C8F)',
                fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                color: 'white', cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: submitting ? 'none' : '0 4px 14px rgba(91,0,95,0.3)',
              }}
            >
              {submitting ? 'Menyimpan…' : editingOutlet ? 'Simpan Perubahan' : 'Buat Outlet'}
            </motion.button>
          </div>
        </div>
      </Modal>

      {/* Confirm toggle modal */}
      {confirmToggle && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
            zIndex: 200, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 20,
          }}
          onClick={() => setConfirmToggle(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 340,
              background: C.white, borderRadius: 20,
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: confirmToggle.isActive ? C.dangerBg : C.successBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px', fontSize: 28,
              }}>
                {confirmToggle.isActive ? '⏸' : '▶'}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900 }}>
                {confirmToggle.isActive ? 'Nonaktifkan' : 'Aktifkan'} Outlet?
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 6 }}>
                <strong>{confirmToggle.name}</strong>
                {confirmToggle.isActive
                  ? ' tidak akan menerima transaksi baru.'
                  : ' akan kembali aktif dan bisa menerima transaksi.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <motion.button
                onClick={() => setConfirmToggle(null)}
                whileTap={{ scale: 0.97 }}
                style={{
                  flex: 1, height: 42, borderRadius: 12,
                  border: `1.5px solid ${C.n200}`,
                  background: C.white,
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                  color: C.n600, cursor: 'pointer',
                }}
              >
                Batal
              </motion.button>
              <motion.button
                onClick={() => handleToggle(confirmToggle)}
                whileTap={{ scale: 0.97 }}
                style={{
                  flex: 1, height: 42, borderRadius: 12, border: 'none',
                  background: confirmToggle.isActive ? C.danger : C.success,
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                  color: 'white', cursor: 'pointer',
                  boxShadow: `0 4px 12px ${confirmToggle.isActive ? C.danger : C.success}40`,
                }}
              >
                {confirmToggle.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
