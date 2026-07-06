import { useState, useEffect } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { TopBar, Chip, Modal, Input, SearchBar, MoneyInput } from '../../components/ui';
import OutletDropdown from '../../components/ui/OutletDropdown';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

export default function KelolaLayananOutletPage({ navigate, goBack, screenParams }) {
  const { user } = useApp();

  const globalRoles = ['admin', 'superadmin', 'finance', 'owner'];
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Kelola Layanan Outlet" onBack={goBack} />

      {/* ── Outlet Selector ── */}
      <div style={{ padding: '12px 16px 0' }}>
        {isAdmin ? (
          <OutletDropdown
            value={selectedOutletId}
            onChange={(val) => setSelectedOutletId(val)}
            outlets={outlets}
          />
        ) : (
          <div style={{ background: `linear-gradient(135deg, ${C.primaryTint}10, ${C.info}10)`, border: `1.5px solid ${C.info}20`, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🏪</span>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.info, letterSpacing: 0.5 }}>OUTLET ANDA</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n800 }}>{user?.outletName || 'Waschen Laundry'}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '12px 16px 0' }}>
        {[
          { label: 'Total', val: statsTotal, color: C.primary, bg: `${C.primary}10` },
          { label: 'Aktif', val: statsActive, color: C.success, bg: `${C.success}10` },
          { label: 'Pinned', val: statsPinned, color: C.danger, bg: C.dangerBg },
        ].map((st) => (
          <div key={st.label} style={{ background: 'white', borderRadius: 14, padding: '10px 12px', border: `1px solid ${C.n100}`, textAlign: 'center', boxShadow: SHADOW.sm }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n600 }}>{st.label}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 600, color: st.color, marginTop: 4 }}>{st.val}</div>
          </div>
        ))}
      </div>

      {/* ── Search & Filter Row ── */}
      <div style={{ padding: '12px 16px 0', position: 'sticky', top: 0, zIndex: 2, background: C.n50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SearchBar value={query} onChange={setQuery} placeholder="Cari nama layanan atau kategori..." />
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              border: 'none', background: 'transparent',
              color: C.primary, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}
          >
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

        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 8, marginBottom: 8 }}>
          Menampilkan <strong style={{ color: C.n700 }}>{filtered.length}</strong> dari {services.length} layanan
          {(statusFilter !== 'all' || categoryFilter !== 'all' || query.trim()) && (
            <button
              onClick={resetFilters}
              style={{ marginLeft: 8, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
            >Reset</button>
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
            <button
              onClick={resetFilters}
              style={{
                flex: 1, height: 38, borderRadius: 10,
                border: `1.5px solid ${C.n200}`, background: C.n50,
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, cursor: 'pointer',
              }}
            >
              Reset
            </button>
            <button
              onClick={() => setFilterOpen(false)}
              style={{
                flex: 1, height: 38, borderRadius: 10,
                border: 'none', background: C.primary,
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer',
              }}
            >
              Terapkan
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Services List ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 36, height: 36, border: `3.5px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Memuat layanan...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 16, padding: '40px 20px', textAlign: 'center', border: `1.5px solid ${C.n100}` }}>
            <span style={{ fontSize: 32 }}>🧺</span>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n700, marginTop: 10 }}>Tidak ada layanan</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 4 }}>Ubah pencarian atau pilih filter status lain.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((s) => {
              const isPinned = !!s.pin_context;
              return (
                <div
                  key={s.id}
                  style={{
                    background: 'white', borderRadius: 16, padding: '14px 16px',
                    boxShadow: SHADOW.sm,
                    border: isPinned ? `1.5px solid ${C.danger}30` : `1.5px solid ${C.n100}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    position: 'relative', overflow: 'hidden',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => handleTogglePin(s)}
                      disabled={!s.active}
                      style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: isPinned ? C.dangerBg : C.n50,
                        border: isPinned ? `1.5px solid ${C.danger}30` : `1.5px solid ${C.n200}`,
                        cursor: s.active ? 'pointer' : 'not-allowed', opacity: s.active ? 1 : 0.4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                      }}
                    >
                      📌
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => openEditPrice(s)}
                        disabled={!s.active}
                        style={{
                          padding: '6px 12px', borderRadius: 10,
                          background: C.n50, border: `1.5px solid ${C.n200}`,
                          cursor: s.active ? 'pointer' : 'not-allowed', opacity: s.active ? 1 : 0.4,
                          fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700,
                        }}
                      >
                        Atur Harga
                      </button>
                    )}
                    <button
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
                      }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Atur Harga ── */}
      <Modal visible={modalPrice} onClose={() => setModalPrice(false)} title="Atur Harga Outlet">
        <div style={{ padding: '16px 20px' }}>
          {targetService && (
            <>
              <div style={{ background: C.n50, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
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
                <button
                  onClick={() => setModalPrice(false)}
                  style={{
                    flex: 1, height: 42, borderRadius: 10,
                    border: `1.5px solid ${C.n200}`, background: C.n50,
                    fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600, cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  onClick={handleSavePrice}
                  disabled={submitting}
                  style={{
                    flex: 1, height: 42, borderRadius: 10,
                    border: 'none', background: C.primary,
                    fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: 'white',
                    cursor: 'pointer', opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}