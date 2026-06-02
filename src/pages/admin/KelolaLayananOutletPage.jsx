import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { TopBar, Chip, Modal, Input, SearchBar, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

export default function KelolaLayananOutletPage({ navigate, goBack, screenParams }) {
  const { user } = useApp();
  
  // Roles check
  const globalRoles = ['admin', 'superadmin', 'finance', 'owner'];
  const isAdmin = globalRoles.includes(user?.roleCode || user?.role);

  // States
  const [outlets, setOutlets] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter & Search states
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive, pinned
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal Price State
  const [modalPrice, setModalPrice] = useState(false);
  const [targetService, setTargetService] = useState(null);
  const [customPrice, setCustomPrice] = useState('');

  // 1. Fetch Outlets (for Admin role)
  useEffect(() => {
    if (!isAdmin) {
      // Kasir only manages their own outlet
      setSelectedOutletId(user?.outletId || user?.outlet?.id || '');
      return;
    }

    const fetchOutlets = async () => {
      try {
        const res = await axios.get('/api/outlets');
        const data = res?.data?.data || [];
        setOutlets(data);
        
        // Default select
        const initialOutletId = screenParams?.outletId || data[0]?.id || '';
        setSelectedOutletId(initialOutletId);
      } catch (err) {
        console.error('Failed to fetch outlets:', err);
      }
    };
    fetchOutlets();
  }, [isAdmin, user, screenParams]);

  // 2. Fetch Services when selectedOutletId changes
  const fetchServices = async () => {
    if (!selectedOutletId) return;
    setLoading(true);
    try {
      // Kasir: tidak perlu pass outletId (backend auto-filter by token)
      // Admin: pass outletId untuk pilih outlet mana
      const url = isAdmin
        ? `/api/services?outletId=${selectedOutletId}`
        : '/api/services';
      const res = await axios.get(url);
      setServices(res?.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      alertError(err?.response?.data?.message || 'Gagal memuat layanan outlet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [selectedOutletId]);

  // Handle Toggle Active/Inactive
  const handleToggleActive = async (service) => {
    try {
      const nextState = !service.active;
      await axios.patch(`/api/services/${service.id}/toggle`, { active: nextState });
      
      // Update local state
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, active: nextState } : s))
      );
      alertSuccess(`Layanan "${service.name}" berhasil ${nextState ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err) {
      console.error('Failed to toggle status:', err);
      alertError(err?.response?.data?.message || 'Gagal mengubah status layanan.');
    }
  };

  // Handle Pin / Unpin
  const handleTogglePin = async (service) => {
    try {
      const res = await axios.post(`/api/services/${service.id}/pin`, {
        outletId: selectedOutletId,
        pinContext: 'priority',
        notes: 'Di pin oleh user'
      });
      
      const isPinned = res?.data?.pinned;
      // Update local state
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, pin_context: isPinned ? 'priority' : null } : s))
      );
      alertSuccess(isPinned ? `Layanan "${service.name}" berhasil di pin di atas.` : `Pin layanan "${service.name}" dilepas.`);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      alertError(err?.response?.data?.message || 'Gagal menyematkan layanan.');
    }
  };

  // Open Edit Price Modal
  const openEditPrice = (service) => {
    setTargetService(service);
    setCustomPrice(Math.round(service.price).toString());
    setModalPrice(true);
  };

  // Save Custom Price
  const handleSavePrice = async () => {
    if (!customPrice || isNaN(customPrice) || Number(customPrice) < 0) {
      alertWarning('Harga harus berupa angka valid >= 0.');
      return;
    }
    
    setSubmitting(true);
    try {
      const updatedPrice = Number(customPrice);
      
      // Payload matches the updateService requirement
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
      
      // Update local state
      setServices((prev) =>
        prev.map((s) => (s.id === targetService.id ? { ...s, price: updatedPrice } : s))
      );
      
      setModalPrice(false);
      alertSuccess(`Harga layanan "${targetService.name}" berhasil diperbarui.`);
    } catch (err) {
      console.error('Failed to save price:', err);
      alertError(err?.response?.data?.message || 'Gagal memperbarui harga.');
    } finally {
      setSubmitting(false);
    }
  };


  // Categories list
  const categories = ['all', ...new Set(services.map((s) => s.category))];

  // Filtering services
  const filtered = services.filter((s) => {
    // 1. Text Search
    const q = query.trim().toLowerCase();
    const matchQuery = !q
      ? true
      : (s.name || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        (s.unit || '').toLowerCase().includes(q);

    // 2. Status filter
    let matchStatus = true;
    if (statusFilter === 'active') matchStatus = s.active !== false;
    else if (statusFilter === 'inactive') matchStatus = s.active === false;
    else if (statusFilter === 'pinned') matchStatus = !!s.pin_context;

    // 3. Category filter
    const matchCategory = categoryFilter === 'all' ? true : s.category === categoryFilter;

    return matchQuery && matchStatus && matchCategory;
  });

  // Calculate statistics
  const statsTotal = services.length;
  const statsActive = services.filter((s) => s.active !== false).length;
  const statsPinned = services.filter((s) => s.pin_context).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Kelola Layanan Outlet" onBack={goBack} />

      {/* ── 1. OUTLET SELECTOR (ADMIN ONLY) / OUTLET LABEL ── */}
      <div style={{ padding: '12px 16px 0' }}>
        {isAdmin ? (
          <div style={{ background: 'white', borderRadius: 16, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', border: `1px solid ${C.n100}` }}>
            <label style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.n500, display: 'block', marginBottom: 4, letterSpacing: 0.5 }}>
              PILIH OUTLET
            </label>
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              style={{
                width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n200}`,
                background: C.n50, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n800,
                outline: 'none', paddingLeft: 8, cursor: 'pointer'
              }}
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div style={{ background: `linear-gradient(135deg, ${C.primary}10, #14B8A610)`, border: `1.5px solid #14B8A620`, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🏪</span>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: '#0D9488', letterSpacing: 0.5 }}>OUTLET ANDA</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n800 }}>{user?.outletName || 'Waschen Laundry'}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. STATS GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '12px 16px 0' }}>
        {[
          { label: 'Total Layanan', val: statsTotal, color: C.primary, bg: `${C.primary}10` },
          { label: 'Aktif', val: statsActive, color: C.success, bg: `${C.success}10` },
          { label: 'Pinned (Semat)', val: statsPinned, color: '#E11D48', bg: '#FFE4E6' },
        ].map((st) => (
          <div key={st.label} style={{ background: 'white', borderRadius: 14, padding: '10px 12px', border: `1px solid ${C.n100}`, textAlign: 'center', boxShadow: '0 1px 4px rgba(15,23,42,0.02)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n500 }}>{st.label}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color: st.color, marginTop: 4 }}>{st.val}</div>
          </div>
        ))}
      </div>

      {/* ── 3. SEARCH & FILTERS ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama layanan atau kategori..." />

        {/* Filter compact: status + category jadi 2 select side-by-side, ga numpuk */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 6 }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              flex: 1, minWidth: 0,
              padding: '8px 12px', borderRadius: 10,
              border: `1.5px solid ${statusFilter === 'all' ? C.n200 : C.primary}`,
              background: statusFilter === 'all' ? '#FFFFFF' : `${C.primary}10`,
              color: statusFilter === 'all' ? C.n700 : C.primary,
              fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
            <option value="pinned">📌 Di Pin</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              flex: 1, minWidth: 0,
              padding: '8px 12px', borderRadius: 10,
              border: `1.5px solid ${categoryFilter === 'all' ? C.n200 : C.primary}`,
              background: categoryFilter === 'all' ? '#FFFFFF' : `${C.primary}10`,
              color: categoryFilter === 'all' ? C.n700 : C.primary,
              fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">Semua Kategori</option>
            {categories.filter((c) => c !== 'all').map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Hasil count */}
        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginBottom: 8 }}>
          Menampilkan <strong style={{ color: C.n700 }}>{filtered.length}</strong> dari {services.length} layanan
          {(statusFilter !== 'all' || categoryFilter !== 'all' || query.trim()) && (
            <button
              onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setQuery(''); }}
              style={{ marginLeft: 8, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
            >Reset</button>
          )}
        </div>
      </div>

      {/* ── 4. SERVICES LIST ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 36, height: 36, border: `3.5px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat layanan...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 16, padding: '40px 20px', textAlign: 'center', border: `1.5px solid ${C.n100}` }}>
            <span style={{ fontSize: 32 }}>🧺</span>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n700, marginTop: 10 }}>Tidak ada layanan</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n400, marginTop: 4 }}>Ubah pencarian atau pilih filter status lain.</div>
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
                    boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
                    border: isPinned ? '1.5px solid #FDA4AF' : `1.5px solid ${C.n100}`,
                    display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: 12,
                    position: 'relative', overflow: 'hidden'
                  }}
                >
                  {/* Pinned background glow */}
                  {isPinned && (
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: '#E11D48' }} />
                  )}

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: s.active ? C.n800 : C.n400, textDecoration: s.active ? 'none' : 'line-through' }}>
                        {s.name}
                      </span>
                      {isPinned && (
                        <span style={{ background: '#FFE4E6', color: '#E11D48', fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>
                          📌 Pinned
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n400, marginTop: 2 }}>
                      {s.category} · {s.unit}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: s.active ? C.primary : C.n400 }}>
                        {rp(s.price)}
                      </span>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Pin button */}
                    <button
                      onClick={() => handleTogglePin(s)}
                      disabled={!s.active}
                      style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: isPinned ? '#FFE4E6' : C.n50,
                        border: isPinned ? '1.5px solid #FECDD3' : `1.5px solid ${C.n200}`,
                        cursor: s.active ? 'pointer' : 'not-allowed',
                        opacity: s.active ? 1 : 0.4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, transition: 'all 0.2s ease'
                      }}
                      title="Pin di nota"
                    >
                      📌
                    </button>

                    {/* Set Price button — Admin Only */}
                    {isAdmin && (
                      <button
                        onClick={() => openEditPrice(s)}
                        disabled={!s.active}
                        style={{
                          padding: '6px 12px', borderRadius: 10,
                          background: C.n50,
                          border: `1.5px solid ${C.n200}`,
                          cursor: s.active ? 'pointer' : 'not-allowed',
                          opacity: s.active ? 1 : 0.4,
                          fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n700
                        }}
                      >
                        Atur Harga
                      </button>
                    )}

                    {/* Toggle Active Switch */}
                    <button
                      onClick={() => handleToggleActive(s)}
                      style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: s.active ? C.success : C.n300,
                        border: 'none', cursor: 'pointer', position: 'relative',
                        padding: 0, transition: 'background-color 0.2s ease'
                      }}
                    >
                      <div
                        style={{
                          width: 18, height: 18, borderRadius: 9, background: 'white',
                          position: 'absolute', top: 3,
                          left: s.active ? 23 : 3,
                          transition: 'left 0.2s ease'
                        }}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL ATUR HARGA ── */}
      {modalPrice && targetService && (
        <Modal title="Atur Harga Outlet" onClose={() => setModalPrice(false)}>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ background: C.n50, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n800 }}>
                {targetService.name}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>
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
                    (targetService.expressEligible !== false
                      ? ` · Express ×2: ${rp(Number(customPrice) * 2)}`
                      : '')
                  : 'Masukkan harga lebih besar dari 0'
              ) : undefined}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setModalPrice(false)}
                style={{
                  flex: 1, height: 42, borderRadius: 10,
                  border: `1.5px solid ${C.n200}`, background: C.n50,
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600,
                  cursor: 'pointer'
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
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: 'white',
                  cursor: 'pointer', opacity: submitting ? 0.6 : 1
                }}
              >
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
