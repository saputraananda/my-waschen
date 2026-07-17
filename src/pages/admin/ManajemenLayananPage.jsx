import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Btn, Chip, Modal, Input, Select, SearchBar, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning, confirmAction } from '../../utils/alert';
import { GlowOrb, Sparkle, FloatingBubble } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

// ─── Premium Card Style ──────────────────────────────────────────────────────
const PREMIUM_CARD = {
  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
};

// ─── Skeleton Block ───────────────────────────────────────────────────────────
function SkeletonBlock({ height = 100, style = {} }) {
  return (
    <div style={{
      height,
      borderRadius: 18,
      background: 'linear-gradient(90deg, rgba(91,0,95,0.05) 25%, rgba(91,0,95,0.1) 50%, rgba(91,0,95,0.05) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      marginBottom: 10,
      ...style,
    }} />
  );
}

const formatRibuan = (val) => {
  if (!val && val !== 0) return '';
  const num = String(val).replace(/[^0-9]/g, '');
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const FilterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="14" y2="6" />
    <line x1="20" y1="6" x2="18" y2="6" />
    <circle cx="16" cy="6" r="2" />
    <line x1="4" y1="12" x2="6" y2="12" />
    <line x1="20" y1="12" x2="10" y2="12" />
    <circle cx="8" cy="12" r="2" />
    <line x1="4" y1="18" x2="12" y2="18" />
    <line x1="20" y1="18" x2="16" y2="18" />
    <circle cx="14" cy="18" r="2" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default function ManajemenLayananPage({ navigate, goBack }) {
  const isMobile = useIsMobile();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [modalAdd, setModalAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', category: 'Cuci', price: '', unit: 'kg', expressExtra: '',
    expressEligible: true, minQty: '1', slaRegular: '', slaExpress: '',
  });

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/services');
        setServices(res?.data?.data || []);
      } catch {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const categories = ['all', ...new Set(services.map((s) => s.category).filter(Boolean))];
  const filtered = services
    .filter((s) => {
      const matchCategory = filter === 'all' ? true : s.category === filter;
      const matchStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'active'
          ? s.active !== false
          : s.active === false;
      const q = query.trim().toLowerCase();
      const matchQuery = !q
        ? true
        : (s.name || '').toLowerCase().includes(q)
          || (s.category || '').toLowerCase().includes(q)
          || (s.unit || '').toLowerCase().includes(q);
      return matchCategory && matchStatus && matchQuery;
    })
    .sort((a, b) => {
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'price_asc') return Number(a.price || 0) - Number(b.price || 0);
      return (a.name || '').localeCompare(b.name || '', 'id');
    });

  const activeFilterCount = [
    filter !== 'all',
    statusFilter !== 'all',
    sortBy !== 'name_asc',
  ].filter(Boolean).length;

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', category: 'Cuci', price: '', unit: 'kg', expressExtra: '', expressEligible: true, minQty: '1', slaRegular: '', slaExpress: '' });
    setModalAdd(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      category: s.category,
      price: String(s.price),
      unit: s.unit,
      expressExtra: s.expressExtra != null ? String(s.expressExtra) : '',
      expressEligible: s.expressEligible !== false && s.expressEligible !== 0,
      minQty: s.minQty != null ? String(s.minQty) : '1',
      slaRegular: s.slaRegular != null ? String(s.slaRegular) : '',
      slaExpress: s.slaExpress != null ? String(s.slaExpress) : '',
    });
    setModalAdd(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      alertWarning('Nama dan harga wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      const basePrice = Number(form.price) || 0;
      const slaReg = form.slaRegular ? Number(form.slaRegular) : null;
      const payload = {
        name: form.name.trim(),
        category: form.category,
        price: basePrice,
        unit: form.unit,
        expressExtra: form.expressEligible ? (form.expressExtra ? Number(form.expressExtra) : basePrice) : 0,
        expressEligible: form.expressEligible,
        minQty: form.minQty ? Number(form.minQty) : 1,
        slaRegular: slaReg,
        slaExpress: form.expressEligible ? (form.slaExpress ? Number(form.slaExpress) : (slaReg ? Math.max(1, Math.floor(slaReg / 2)) : null)) : null,
      };
      if (editingId) {
        await axios.put(`/api/services/${editingId}`, payload);
      } else {
        await axios.post('/api/services', payload);
      }
      const resList = await axios.get('/api/services');
      setServices(resList?.data?.data || []);
      setModalAdd(false);
      alertSuccess(editingId ? 'Layanan berhasil diupdate.' : 'Layanan berhasil ditambahkan.');
    } catch {
      alertError('Gagal menyimpan layanan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirmAction({ text: 'Yakin ingin menghapus layanan ini?' });
    if (!ok) return;
    try {
      await axios.delete(`/api/services/${id}`);
      setServices((prev) => prev.filter((s) => s.id !== id));
      alertSuccess('Layanan berhasil dihapus.');
    } catch {
      const msg = 'Gagal menghapus layanan.';
      alertError(msg);
    }
  };

  const toggleActive = async (id) => {
    const service = services.find((s) => s.id === id);
    if (!service) return;
    try {
      const res = await axios.patch(`/api/services/${id}/toggle`, { active: !service.active });
      const updatedService = res?.data?.data;
      if (updatedService) {
        setServices((prev) => prev.map((s) => (s.id === id ? updatedService : s)));
      } else {
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
      }
    } catch {
      alertError('Gagal mengubah status layanan.');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-14px,16px) scale(1.08)} }
        @keyframes twinkle { 0%,100%{opacity:0;transform:scale(0.4) rotate(0deg)} 50%{opacity:1;transform:scale(1) rotate(20deg)} }
        @media (max-width: 480px) {
          .service-card-content {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .service-card-actions {
            width: 100% !important;
            flex-direction: row !important;
          }
          .service-modal-row {
            flex-direction: column !important;
          }
          .service-modal-row > div {
            width: 100% !important;
          }
          .service-card-body {
            flex-direction: column !important;
          }
        }
        @media (max-width: 360px) {
          .service-card-actions > button {
            flex: 1 !important;
          }
        }
      `}</style>

      {/* ── Premium Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: '16px 20px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <GlowOrb color="rgba(140, 76, 143, 0.4)" size={200} top="-60px" left="-30px" blur={50} />
        <GlowOrb color="rgba(249, 62, 17, 0.25)" size={150} top="40px" right="-40px" blur={40} />
        <Sparkle top="10%" left="15%" size={8} delay={0} color="#FFD700" />
        <Sparkle top="20%" left="80%" size={6} delay={0.5} color="#FF6B6B" />
        <Sparkle top="60%" left="25%" size={7} delay={1} color="#4ECDC4" />
        <FloatingBubble src={bubbleIcon} size={18} top="15%" left="5%" delay={0} opacity={0.4} />
        <FloatingBubble src={bubble2Icon} size={14} top="35%" right="8%" delay={0.5} opacity={0.35} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>
              Manajemen Layanan
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              Kelola layanan laundry & dry
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={goBack}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'white',
              }}
            >
              ← Kembali
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={openAdd}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'white',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <PlusIcon />
            </motion.button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* ── OUTLET BANNER ── */}
        <div style={{ marginTop: -40, marginBottom: 16 }}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('kelola_layanan_outlet')}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 16,
              background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
              color: 'white', border: 'none', cursor: 'pointer',
              fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(110,46,120,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🏪</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Kelola Layanan Per Outlet</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 500, marginTop: 1 }}>Sesuaikan harga & aktifkan layanan tiap cabang</div>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </motion.button>
        </div>

        {/* ── SEARCH + FILTER ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <SearchBar value={query} onChange={setQuery} placeholder="Cari nama layanan, kategori, atau satuan..." />
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilterOpen(true)}
            title="Filter layanan"
            aria-label="Filter layanan"
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              border: 'none',
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(91, 0, 95, 0.25)',
              position: 'relative',
            }}
          >
            <FilterIcon />
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8,
                background: C.warning, color: 'white', fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {activeFilterCount}
              </span>
            )}
          </motion.button>
        </div>

        {/* ── FILTER MODAL ── */}
        <Modal visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter Layanan">
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Status</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {[{ value: 'all', label: 'Semua' }, { value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }].map((s) => (
                <Chip key={s.value} label={s.label} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)} />
              ))}
            </div>

            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Kategori</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {categories.map((cat) => (
                <Chip key={cat} label={cat === 'all' ? 'Semua' : cat} active={filter === cat} onClick={() => setFilter(cat)} />
              ))}
            </div>

            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Urutkan</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ value: 'name_asc', label: 'Nama A-Z' }, { value: 'category', label: 'Kategori' }, { value: 'price_asc', label: 'Harga terendah' }].map((s) => (
                <Chip key={s.value} label={s.label} active={sortBy === s.value} onClick={() => setSortBy(s.value)} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => { setFilter('all'); setStatusFilter('all'); setSortBy('name_asc'); }}
                style={{
                  flex: 1, height: 38, borderRadius: 12, border: '1.5px solid rgba(91, 0, 95, 0.15)',
                  background: 'white', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, cursor: 'pointer',
                }}>
                Reset
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => setFilterOpen(false)}
                style={{
                  flex: 1, height: 38, borderRadius: 12, border: 'none',
                  background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                  fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(91, 0, 95, 0.25)',
                }}>
                Terapkan
              </motion.button>
            </div>
          </div>
        </Modal>

        {/* ── SERVICE LIST ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SkeletonBlock height={100} />
              <SkeletonBlock height={100} />
              <SkeletonBlock height={100} />
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                ...PREMIUM_CARD,
                padding: '40px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: 20,
                background: 'linear-gradient(145deg, #F8F4FF, #FFFFFF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '8px 8px 20px rgba(110, 46, 120, 0.12), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                margin: '0 auto 16px'
              }}>
                <span style={{ fontSize: 28 }}>🧺</span>
              </div>
              <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n700 }}>Belum ada layanan</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, display: 'block', marginTop: 4 }}>Tap + untuk menambahkan layanan</span>
            </motion.div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((s, idx) => {
                const hasExpress = s.expressEligible !== false && s.expressEligible !== 0;
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    whileHover={{ y: -2 }}
                    style={{
                      ...PREMIUM_CARD,
                      padding: '14px 16px',
                      opacity: s.active === false ? 0.55 : 1,
                      borderLeft: `4px solid ${hasExpress ? C.warning : C.primary}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }} className="service-card-body">
                      <div style={{ flex: 1, minWidth: 0 }} className="service-card-content">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{s.name}</span>
                          {hasExpress && (
                            <span style={{ background: C.warningBg, color: C.warningDark, fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 999 }}>
                              ⚡ EXPRESS
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>
                          {s.category} · per {s.unit}{s.minQty > 1 ? ` (min ${s.minQty})` : ''}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                          <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.primary }}>{rp(s.price)}</span>
                          {hasExpress && (
                            <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.warningDark, fontWeight: 600 }}>⚡ Express: {rp(s.price * 2)}</span>
                          )}
                        </div>
                        {(s.slaRegular || s.slaExpress) && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            {s.slaRegular && (
                              <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, background: C.n50, padding: '2px 8px', borderRadius: 999, fontWeight: 500 }}>
                                🕐 Reguler: {s.slaRegular}jam
                              </span>
                            )}
                            {s.slaExpress && hasExpress && (
                              <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.warningDark, background: C.warningBg, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                                ⚡ Express: {s.slaExpress}jam
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, marginLeft: 10 }} className="service-card-actions">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleActive(s.id)}
                          style={{
                            padding: '5px 10px', borderRadius: 10,
                            border: `1px solid ${s.active !== false ? C.success : C.n300}`,
                            background: s.active !== false ? C.successBg : C.n50,
                            cursor: 'pointer', fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                            color: s.active !== false ? C.success : C.n500, width: 66,
                          }}
                        >
                          {s.active !== false ? 'Aktif' : 'Nonaktif'}
                        </motion.button>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => openEdit(s)}
                            style={{
                              flex: 1, padding: '6px', borderRadius: 10,
                              border: `1px solid ${C.n200}`, background: 'white',
                              cursor: 'pointer', color: C.primary, fontSize: 12,
                            }}
                          >✏️</motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDelete(s.id)}
                            style={{
                              flex: 1, padding: '6px', borderRadius: 10,
                              border: `1px solid ${C.n200}`, background: 'white',
                              cursor: 'pointer', color: C.error, fontSize: 12,
                            }}
                          >🗑️</motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── ADD/EDIT MODAL ── */}
      <Modal visible={modalAdd} onClose={() => setModalAdd(false)} title={editingId ? "Edit Layanan" : "Tambah Layanan"}>
        <div style={{ padding: '4px 4px 0' }}>
          <Input label="Nama Layanan" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Contoh: Cuci Kiloan" />
          <Select label="Kategori" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={['Cuci', 'Setrika', 'Dry Clean', 'Sepatu', 'Karpet', 'Boneka', 'Helm', 'Lainnya'].map((c) => ({ value: c, label: c }))} />
          <MoneyInput label="Harga (Rp)" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} placeholder="0" />
          <Select label="Satuan" value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} options={[
            { value: 'kg', label: 'Kilogram (kg)' }, { value: 'pcs', label: 'Pcs (Satuan)' },
            { value: 'pair', label: 'Pasang' }, { value: 'm2', label: 'Meter Persegi (m²)' },
            { value: 'meter', label: 'Meter' }, { value: 'stel', label: 'Stel' },
            { value: 'package', label: 'Paket' }, { value: 'other', label: 'Lainnya' },
          ]} />
          <Input label="Min. Order" value={form.minQty} onChange={(v) => setForm((f) => ({ ...f, minQty: v }))} type="number" placeholder="1" />

          {/* Express toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '10px 14px', background: 'linear-gradient(145deg, #F8F4FF, #FFFFFF)', borderRadius: 14, boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)' }}>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>⚡ Layanan Express</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 1 }}>Express = 2× harga normal, ½ waktu</div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setForm((f) => ({ ...f, expressEligible: !f.expressEligible }))}
              style={{
                width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: form.expressEligible ? C.primary : C.n300,
                position: 'relative',
              }}>
              <div style={{
                width: 22, height: 22, borderRadius: 11, background: 'white',
                position: 'absolute', top: 3,
                left: form.expressEligible ? 23 : 3,
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              }} />
            </motion.button>
          </div>

          {form.expressEligible && (
            <div style={{ marginBottom: 14 }}>
              <MoneyInput label="Biaya Express Tambahan (Rp)" value={form.expressExtra} onChange={(v) => setForm((f) => ({ ...f, expressExtra: v }))} placeholder={form.price ? `${form.price} (2× normal)` : '0'} />
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>*Kosongkan = otomatis sama dengan harga normal</div>
            </div>
          )}

          {/* SLA */}
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Estimasi Waktu Pengerjaan (Jam)</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }} className="service-modal-row">
            <div style={{ flex: 1 }}>
              <Input label="Reguler" value={form.slaRegular} onChange={(v) => setForm((f) => ({ ...f, slaRegular: v }))} type="number" placeholder="cth: 48" />
            </div>
            {form.expressEligible && (
              <div style={{ flex: 1 }}>
                <Input label="Express" value={form.slaExpress} onChange={(v) => setForm((f) => ({ ...f, slaExpress: v }))} type="number" placeholder={`Otomatis: ${form.slaRegular ? Math.max(1, Math.floor(Number(form.slaRegular) / 2)) : '12'}`} />
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 2 }}>*Kosongkan = ½ reguler</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setModalAdd(false)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="primary" onClick={handleSave} loading={submitting} style={{ flex: 1 }}>Simpan</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
