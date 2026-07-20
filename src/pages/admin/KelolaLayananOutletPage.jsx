import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { useApp } from '../../context/AppContext';
import { TopBar, Chip, Modal, Input, SearchBar, MoneyInput } from '../../components/ui';
import OutletDropdown from '../../components/ui/OutletDropdown';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
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
function SkeletonBlock({ height = 90, style = {} }) {
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

export default function KelolaLayananOutletPage({ navigate, goBack, screenParams }) {
  const isMobile = useIsMobile();
  const { user } = useApp();

  const globalRoles = ['admin'];
  const isAdmin = globalRoles.includes(user?.roleCode || user?.role);

  const [outlets, setOutlets] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const [modalPrice, setModalPrice] = useState(false);
  const [targetService, setTargetService] = useState(null);
  const [customPrice, setCustomPrice] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      setSelectedOutletId(user?.outletId || user?.outlet?.id || '');
      return;
    }
    const fetchOutlets = async () => {
      try {
        const res = await axios.get('/api/outlets');
        const data = res?.data?.data || [];
        setOutlets(data);
        const initialOutletId = screenParams?.outletId || data[0]?.id || '';
        setSelectedOutletId(initialOutletId);
      } catch (err) {
        console.error('Failed to fetch outlets:', err);
      }
    };
    fetchOutlets();
  }, [isAdmin, user, screenParams]);

  const fetchServices = async () => {
    if (!selectedOutletId) return;
    setLoading(true);
    try {
      const url = isAdmin ? `/api/services?outletId=${selectedOutletId}` : '/api/services';
      const res = await axios.get(url);
      setServices(res?.data?.data || []);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal memuat layanan outlet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [selectedOutletId]);

  const handleToggleActive = async (service) => {
    try {
      const nextState = !service.active;
      await axios.patch(`/api/services/${service.id}/toggle`, { active: nextState });
      setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, active: nextState } : s)));
      alertSuccess(`Layanan "${service.name}" berhasil ${nextState ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengubah status layanan.');
    }
  };

  const handleTogglePin = async (service) => {
    try {
      const res = await axios.post(`/api/services/${service.id}/pin`, {
        outletId: selectedOutletId,
        pinContext: 'priority',
        notes: 'Di pin oleh user'
      });
      const isPinned = res?.data?.pinned;
      setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, pin_context: isPinned ? 'priority' : null } : s)));
      alertSuccess(isPinned ? `Layanan "${service.name}" berhasil di pin di atas.` : `Pin layanan "${service.name}" dilepas.`);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyematkan layanan.');
    }
  };

  const openEditPrice = (service) => {
    setTargetService(service);
    setCustomPrice(Math.round(service.price).toString());
    setModalPrice(true);
  };

  const handleSavePrice = async () => {
    if (!customPrice || isNaN(customPrice) || Number(customPrice) < 0) {
      alertWarning('Harga harus berupa angka valid >= 0.');
      return;
    }
    setSubmitting(true);
    try {
      const updatedPrice = Number(customPrice);
      const payload = {
        name: targetService.name,
        category: targetService.category,
        price: updatedPrice,
        unit: targetService.unit,
        expressExtra: targetService.expressExtra || 0,
        active: targetService.active,
        expressEligible: targetService.expressEligible,
        minQty: targetService.minQty || 1,
        slaRegular: targetService.slaRegular || null,
        slaExpress: targetService.slaExpress || null,
      };
      await axios.put(`/api/services/${targetService.id}`, payload);
      setServices((prev) => prev.map((s) => (s.id === targetService.id ? { ...s, price: updatedPrice } : s)));
      setModalPrice(false);
      alertSuccess(`Harga layanan "${targetService.name}" berhasil diperbarui.`);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal memperbarui harga.');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ['all', ...new Set(services.map((s) => s.category))];

  const filtered = services.filter((s) => {
    const q = query.trim().toLowerCase();
    const matchQuery = !q
      ? true
      : (s.name || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        (s.unit || '').toLowerCase().includes(q);
    let matchStatus = true;
    if (statusFilter === 'active') matchStatus = s.active !== false;
    else if (statusFilter === 'inactive') matchStatus = s.active === false;
    else if (statusFilter === 'pinned') matchStatus = !!s.pin_context;
    const matchCategory = categoryFilter === 'all' ? true : s.category === categoryFilter;
    return matchQuery && matchStatus && matchCategory;
  });

  const statsTotal = services.length;
  const statsActive = services.filter((s) => s.active !== false).length;
  const statsPinned = services.filter((s) => s.pin_context).length;

  const activeFilterCount = [
    statusFilter !== 'all',
    categoryFilter !== 'all',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setQuery('');
  };

  const FilterIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="14" y2="6" /><line x1="20" y1="6" x2="18" y2="6" /><circle cx="16" cy="6" r="2" />
      <line x1="4" y1="12" x2="6" y2="12" /><line x1="20" y1="12" x2="10" y2="12" /><circle cx="8" cy="12" r="2" />
      <line x1="4" y1="18" x2="12" y2="18" /><line x1="20" y1="18" x2="16" y2="18" /><circle cx="14" cy="18" r="2" />
    </svg>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-14px,16px) scale(1.08)} }
        @keyframes twinkle { 0%,100%{opacity:0;transform:scale(0.4) rotate(0deg)} 50%{opacity:1;transform:scale(1) rotate(20deg)} }
        @media (max-width: 480px) {
          .service-item-row {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .service-item-actions {
            width: 100% !important;
            justify-content: flex-start !important;
          }
          .outlet-stats-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .outlet-stats-grid-responsive { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 360px) {
          .outlet-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
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
              Kelola Layanan Outlet
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              Atur harga & status layanan per cabang
            </div>
          </div>
          {goBack && (
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
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
        {/* ── Outlet Selector ── */}
        <div style={{ marginTop: -40, marginBottom: 16 }}>
          {isAdmin ? (
            <div style={{ ...PREMIUM_CARD, padding: '14px 16px' }}>
              <OutletDropdown
                value={selectedOutletId}
                onChange={(val) => setSelectedOutletId(val)}
                outlets={outlets}
              />
            </div>
          ) : (
            <div style={{
              ...PREMIUM_CARD,
              padding: '14px 16px',
              background: `linear-gradient(135deg, ${C.primary}08, ${C.info}08)`,
              border: `1.5px solid ${C.info}20`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🏪</span>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.info, letterSpacing: 0.5 }}>OUTLET ANDA</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n800 }}>{user?.outletName || 'Waschen Laundry'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Stats Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }} className="outlet-stats-grid outlet-stats-grid-responsive">
          {[
            { label: 'Total', val: statsTotal, color: C.primary, bg: `${C.primary}10` },
            { label: 'Aktif', val: statsActive, color: C.success, bg: `${C.success}10` },
            { label: 'Pinned', val: statsPinned, color: C.danger, bg: C.dangerBg },
          ].map((st, idx) => (
            <motion.div
              key={st.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -2 }}
              style={{
                ...PREMIUM_CARD,
                padding: '10px 12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n600 }}>{st.label}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 600, color: st.color, marginTop: 4 }}>{st.val}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Search & Filter Row ── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <SearchBar value={query} onChange={setQuery} placeholder="Cari nama layanan atau kategori..." />
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setFilterOpen(true)}
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
                  position: 'absolute', top: -4, right: -4,
                  width: 16, height: 16, borderRadius: 8,
                  background: C.warning, color: 'white',
                  fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {activeFilterCount}
                </span>
              )}
            </motion.button>
          </div>

          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 8, marginBottom: 8 }}>
            Menampilkan <strong style={{ color: C.n700 }}>{filtered.length}</strong> dari {services.length} layanan
            {(statusFilter !== 'all' || categoryFilter !== 'all' || query.trim()) && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={resetFilters}
                style={{ marginLeft: 8, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              >Reset</motion.button>
            )}
          </div>
        </div>

        {/* ── Filter Modal ── */}
        <Modal visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter">
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>📋 Status</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { value: 'all', label: 'Semua' },
                { value: 'active', label: 'Aktif' },
                { value: 'inactive', label: 'Nonaktif' },
                { value: 'pinned', label: '📌 Di Pin' },
              ].map((s) => (
                <Chip key={s.value} label={s.label} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)} />
              ))}
            </div>

            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>🏷️ Kategori</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {categories.map((cat) => (
                <Chip key={cat} label={cat === 'all' ? 'Semua' : cat} active={categoryFilter === cat} onClick={() => setCategoryFilter(cat)} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={resetFilters}
                style={{
                  flex: 1, height: 38, borderRadius: 10,
                  border: '1.5px solid rgba(91, 0, 95, 0.15)', background: 'white',
                  fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, cursor: 'pointer',
                }}
              >
                Reset
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setFilterOpen(false)}
                style={{
                  flex: 1, height: 38, borderRadius: 10,
                  border: 'none', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                  fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(91, 0, 95, 0.25)',
                }}
              >
                Terapkan
              </motion.button>
            </div>
          </div>
        </Modal>

        {/* ── Services List ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SkeletonBlock height={90} />
              <SkeletonBlock height={90} />
              <SkeletonBlock height={90} />
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
              <span style={{ fontSize: 40 }}>🧺</span>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n700, marginTop: 10 }}>Tidak ada layanan</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 4 }}>Ubah pencarian atau pilih filter status lain.</div>
            </motion.div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((s, idx) => {
                const isPinned = !!s.pin_context;
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
                      border: isPinned ? `1.5px solid ${C.danger}30` : `1.5px solid rgba(91, 0, 95, 0.04)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      position: 'relative', overflow: 'hidden',
                      opacity: s.active === false ? 0.6 : 1,
                      className: 'service-item-row',
                    }}
                  >
                    {isPinned && (
                      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: C.danger }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: s.active ? C.n800 : C.n600, textDecoration: s.active ? 'none' : 'line-through' }}>
                          {s.name}
                        </span>
                        {isPinned && (
                          <span style={{ background: C.dangerBg, color: C.danger, fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999 }}>
                            📌 Pinned
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
                        {s.category} · {s.unit}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: s.active ? C.primary : C.n600 }}>
                          {rp(s.price)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="service-item-actions">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleTogglePin(s)}
                        disabled={!s.active}
                        style={{
                          width: 34, height: 34, borderRadius: 10,
                          background: isPinned ? C.dangerBg : 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                          border: isPinned ? `1.5px solid ${C.danger}30` : `1.5px solid rgba(91, 0, 95, 0.1)`,
                          cursor: s.active ? 'pointer' : 'not-allowed', opacity: s.active ? 1 : 0.4,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                          boxShadow: '2px 2px 6px rgba(110, 46, 120, 0.08), -1px -1px 4px rgba(255, 255, 255, 0.95)',
                        }}
                      >
                        📌
                      </motion.button>
                      {isAdmin && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => openEditPrice(s)}
                          disabled={!s.active}
                          style={{
                            padding: '6px 12px', borderRadius: 10,
                            background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                            border: `1.5px solid rgba(91, 0, 95, 0.1)`,
                            cursor: s.active ? 'pointer' : 'not-allowed', opacity: s.active ? 1 : 0.4,
                            fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.primary,
                            boxShadow: '2px 2px 6px rgba(110, 46, 120, 0.08), -1px -1px 4px rgba(255, 255, 255, 0.95)',
                          }}
                        >
                          Atur Harga
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleToggleActive(s)}
                        style={{
                          width: 44, height: 24, borderRadius: 12,
                          background: s.active ? C.success : C.n300,
                          border: 'none', cursor: 'pointer', position: 'relative', padding: 0,
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: 9, background: 'white',
                          position: 'absolute', top: 3,
                          left: s.active ? 23 : 3,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                        }} />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Atur Harga ── */}
      <Modal visible={modalPrice} onClose={() => setModalPrice(false)} title="Atur Harga Outlet">
        <div style={{ padding: '16px 20px' }}>
          {targetService && (
            <>
              <div style={{
                background: 'linear-gradient(145deg, #F8F4FF, #FFFFFF)',
                borderRadius: 14, padding: '12px 14px', marginBottom: 16,
                boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)',
              }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n800 }}>
                  {targetService.name}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
                  Kategori: {targetService.category} · Satuan: {targetService.unit}
                </div>
              </div>
              <MoneyInput
                label="HARGA OUTLET"
                value={customPrice}
                onChange={setCustomPrice}
                placeholder="0"
                autoFocus
                hint={customPrice ? (
                  Number(customPrice) > 0
                    ? `Harga normal: ${rp(Number(customPrice))}` +
                      (targetService.expressEligible !== false ? ` · Express ×2: ${rp(Number(customPrice) * 2)}` : '')
                    : 'Masukkan harga lebih besar dari 0'
                ) : undefined}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setModalPrice(false)}
                  style={{
                    flex: 1, height: 42, borderRadius: 12,
                    border: '1.5px solid rgba(91, 0, 95, 0.15)', background: 'white',
                    fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600, cursor: 'pointer',
                  }}
                >
                  Batal
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSavePrice}
                  disabled={submitting}
                  style={{
                    flex: 1, height: 42, borderRadius: 12,
                    border: 'none',
                    background: submitting ? C.n400 : `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                    fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: 'white',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(91, 0, 95, 0.25)',
                  }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </motion.button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
