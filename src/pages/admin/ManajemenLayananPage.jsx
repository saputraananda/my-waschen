import { useState, useEffect } from 'react';

import axios from 'axios';

import { C } from '../../utils/theme';

import { rp } from '../../utils/helpers';

import { TopBar, Btn, Chip, Modal, Input, Select, SearchBar, MoneyInput } from '../../components/ui';

import { alertError, alertSuccess, alertWarning, confirmAction } from '../../utils/alert';

// Helper: format angka ke ribuan (1000 -> "1.000")
const formatRibuan = (val) => {
  if (!val && val !== 0) return '';
  const num = String(val).replace(/[^0-9]/g, '');
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
// Helper: parse ribuan ke number ("1.000" -> 1000)
const parseRibuan = (val) => {
  if (!val) return '';
  return String(val).replace(/\./g, '');
};


export default function ManajemenLayananPage({ navigate, goBack }) {

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



  // Fetch services from API on mount

  useEffect(() => {

    const fetchServices = async () => {

      setLoading(true);

      try {

        const res = await axios.get('/api/services');

        const data = res?.data?.data || [];

        setServices(data);

      } catch (error) {

        console.error('Failed to fetch services:', error);

      } finally {

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



  const FilterIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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



  const openAdd = () => {

    setEditingId(null);

    setForm({

      name: '', category: 'Cuci', price: '', unit: 'kg', expressExtra: '',

      expressEligible: true, minQty: '1', slaRegular: '', slaExpress: '',

    });

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
        expressExtra: form.expressEligible 
          ? (form.expressExtra ? Number(form.expressExtra) : basePrice) 
          : 0,
        expressEligible: form.expressEligible,
        minQty: form.minQty ? Number(form.minQty) : 1,
        slaRegular: slaReg,
        slaExpress: form.expressEligible 
          ? (form.slaExpress ? Number(form.slaExpress) : (slaReg ? Math.max(1, Math.floor(slaReg / 2)) : null)) 
          : null,
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

    } catch (error) {

      console.error('Failed to save service:', error);

      const msg = error?.response?.data?.message || 'Gagal menyimpan layanan. Silakan coba lagi.';

      alertError(msg);

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

    } catch (error) {

      console.error('Failed to delete service:', error);

      const msg = error?.response?.data?.message || 'Gagal menghapus layanan.';

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

    } catch (error) {

      console.error('Failed to toggle service:', error);

      alertError(error?.response?.data?.message || 'Gagal mengubah status layanan.');

    }

  };



  return (

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden', position: 'relative' }}>

      <TopBar title="Manajemen Layanan" onBack={goBack} rightAction={openAdd} rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>} />



      {/* Per Outlet Banner Link */}

      <div style={{ padding: '12px 16px 0' }}>

        <button

          onClick={() => navigate('kelola_layanan_outlet')}

          style={{

            width: '100%', padding: '12px 14px', borderRadius: 14,

            background: `linear-gradient(135deg, ${C.primary} 0%, #7C3AED 100%)`,

            color: 'white', border: 'none', cursor: 'pointer',

            fontFamily: 'Poppins', fontSize: 13, fontWeight: 700,

            display: 'flex', alignItems: 'center', justifyContent: 'space-between',

            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.15)',

          }}

        >

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

            <span style={{ fontSize: 18 }}>🏪</span>

            <div style={{ textAlign: 'left' }}>

              <div style={{ fontSize: 13, fontWeight: 700 }}>Kelola Layanan Per Outlet</div>

              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 500, marginTop: 1 }}>Sesuaikan harga & aktifkan layanan tiap cabang</div>

            </div>

          </div>

          <span style={{ fontSize: 16 }}>➔</span>

        </button>

      </div>



      <div style={{ padding: '12px 16px 0' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          <div style={{ flex: 1 }}>

            <SearchBar value={query} onChange={setQuery} placeholder="Cari nama layanan, kategori, atau satuan..." />

          </div>

          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            title="Filter layanan"
            aria-label="Filter layanan"
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              border: 'none',
              background: 'transparent',
              color: '#7C3AED',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}
          >

            <FilterIcon />

            {activeFilterCount > 0 && (

              <span style={{

                position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8,

                background: C.primary, color: 'white', fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,

                display: 'flex', alignItems: 'center', justifyContent: 'center',

              }}>

                {activeFilterCount}

              </span>

            )}

          </button>

        </div>

      </div>



      <Modal visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter Layanan">

        <div style={{ padding: '16px 18px' }}>

          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, marginBottom: 8 }}>Status</div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>

            {[

              { value: 'all', label: 'Semua' },

              { value: 'active', label: 'Aktif' },

              { value: 'inactive', label: 'Nonaktif' },

            ].map((s) => (

              <Chip key={s.value} label={s.label} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)} />

            ))}

          </div>



          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, marginBottom: 8 }}>Kategori</div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>

            {categories.map((cat) => (

              <Chip key={cat} label={cat === 'all' ? 'Semua' : cat} active={filter === cat} onClick={() => setFilter(cat)} />

            ))}

          </div>



          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, marginBottom: 8 }}>Urutkan</div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

            {[

              { value: 'name_asc', label: 'Nama A-Z' },

              { value: 'category', label: 'Kategori' },

              { value: 'price_asc', label: 'Harga terendah' },

            ].map((s) => (

              <Chip key={s.value} label={s.label} active={sortBy === s.value} onClick={() => setSortBy(s.value)} />

            ))}

          </div>



          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>

            <button

              type="button"

              onClick={() => { setFilter('all'); setStatusFilter('all'); setSortBy('name_asc'); }}

              style={{

                flex: 1, height: 38, borderRadius: 10, border: `1.5px solid ${C.n200}`,

                background: C.n50, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, cursor: 'pointer',

              }}

            >

              Reset

            </button>

            <button

              type="button"

              onClick={() => setFilterOpen(false)}

              style={{

                flex: 1, height: 38, borderRadius: 10, border: 'none',

                background: C.primary, fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer',

              }}

            >

              Terapkan

            </button>

          </div>

        </div>

      </Modal>



      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>

        {loading ? (

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 12 }}>

            <div style={{ width: 40, height: 40, border: `3px solid ${C.n200}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />

            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat data...</span>

          </div>

        ) : filtered.length === 0 ? (

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 12 }}>

            <span style={{ fontSize: 40 }}>📋</span>

            <span style={{ fontFamily: 'Poppins', fontSize: 14, color: C.n500 }}>Belum ada layanan</span>

            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n400 }}>Tap + untuk menambahkan layanan</span>

          </div>

        ) : (

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {filtered.map((s) => {

              const hasExpress = s.expressEligible !== false && s.expressEligible !== 0;

              return (

                <div key={s.id} style={{ background: C.white, borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', opacity: s.active === false ? 0.5 : 1 }}>

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>

                    <div style={{ flex: 1, minWidth: 0 }}>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

                        <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{s.name}</span>

                        {hasExpress && <span style={{ background: '#FEF3C7', color: '#92400E', fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>⚡ EXPRESS</span>}

                      </div>

                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 3 }}>

                        {s.category} · per {s.unit}{s.minQty > 1 ? ` (min ${s.minQty})` : ''}

                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>

                        <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.primary }}>{rp(s.price)}</span>

                        {hasExpress && <span style={{ fontFamily: 'Poppins', fontSize: 11, color: '#B45309', fontWeight: 600 }}>⚡ Express: {rp(s.price * 2)}</span>}

                      </div>

                      {(s.slaRegular || s.slaExpress) && (

                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>

                          {s.slaRegular && (

                            <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, background: C.n50, padding: '2px 8px', borderRadius: 999 }}>

                              🕐 Reguler: {s.slaRegular}jam

                            </span>

                          )}

                          {s.slaExpress && hasExpress && (

                            <span style={{ fontFamily: 'Poppins', fontSize: 10, color: '#B45309', background: '#FEF3C7', padding: '2px 8px', borderRadius: 999 }}>

                              ⚡ Express: {s.slaExpress}jam

                            </span>

                          )}

                        </div>

                      )}

                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, marginLeft: 10 }}>

                      <button

                        onClick={() => toggleActive(s.id)}

                        style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid ${s.active !== false ? C.success : C.n300}`, background: s.active !== false ? '#DCFCE7' : C.n50, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: s.active !== false ? C.success : C.n600, width: 64 }}

                      >

                        {s.active !== false ? 'Aktif' : 'Nonaktif'}

                      </button>

                      <div style={{ display: 'flex', gap: 4 }}>

                        <button onClick={() => openEdit(s)} style={{ flex: 1, padding: '5px', borderRadius: 8, border: `1px solid ${C.n200}`, background: C.white, cursor: 'pointer', color: C.primary, fontSize: 12 }}>✏️</button>

                        <button onClick={() => handleDelete(s.id)} style={{ flex: 1, padding: '5px', borderRadius: 8, border: `1px solid ${C.n200}`, background: C.white, cursor: 'pointer', color: C.error, fontSize: 12 }}>🗑️</button>

                      </div>

                    </div>

                  </div>

                </div>

              );

            })}

          </div>

        )}

      </div>



      <Modal visible={modalAdd} onClose={() => setModalAdd(false)} title={editingId ? "Edit Layanan" : "Tambah Layanan"}>

        <Input label="Nama Layanan" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Contoh: Cuci Kiloan" />

        <Select label="Kategori" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={['Cuci', 'Setrika', 'Dry Clean', 'Sepatu', 'Karpet', 'Boneka', 'Helm', 'Lainnya'].map((c) => ({ value: c, label: c }))} />

        {/* Harga dengan MoneyInput */}
        <MoneyInput
          label="Harga (Rp)"
          value={form.price}
          onChange={(v) => setForm((f) => ({ ...f, price: v }))}
          placeholder="0"
        />

        <Select label="Satuan" value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} options={[

          { value: 'kg', label: 'Kilogram (kg)' },

          { value: 'pcs', label: 'Pcs (Satuan)' },

          { value: 'pair', label: 'Pasang' },

          { value: 'm2', label: 'Meter Persegi (m²)' },

          { value: 'meter', label: 'Meter' },

          { value: 'stel', label: 'Stel' },

          { value: 'package', label: 'Paket' },

          { value: 'other', label: 'Lainnya' }

        ]} />

        <Input label="Min. Order" value={form.minQty} onChange={(v) => setForm((f) => ({ ...f, minQty: v }))} type="number" placeholder="1" />



        {/* Express toggle */}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '10px 14px', background: C.n50, borderRadius: 10 }}>

          <div>

            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>⚡ Layanan Express</div>

            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Express = 2× harga normal, ½ waktu pengerjaan</div>

          </div>

          <button

            type="button"

            onClick={() => setForm((f) => ({ ...f, expressEligible: !f.expressEligible }))}

            style={{

              width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',

              background: form.expressEligible ? C.primary : C.n300,

              position: 'relative', transition: 'background 0.2s',

            }}

          >

            <div style={{

              width: 22, height: 22, borderRadius: 11, background: 'white',

              position: 'absolute', top: 3,

              left: form.expressEligible ? 23 : 3,

              transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',

            }} />

          </button>

        </div>



        {form.expressEligible && (
          <div style={{ marginBottom: 16 }}>
            <MoneyInput
              label="Biaya Express Tambahan (Rp)"
              value={form.expressExtra}
              onChange={(v) => setForm((f) => ({ ...f, expressExtra: v }))}
              placeholder={form.price ? `${form.price} (2× normal)` : '0'}
            />
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: -8 }}>
              *Kosongkan untuk otomatis biaya tambahan sama dengan harga normal
            </div>
          </div>
        )}

        {/* SLA / Estimasi waktu */}
        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Estimasi Waktu Pengerjaan (Jam)</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <Input label="Reguler" value={form.slaRegular} onChange={(v) => setForm((f) => ({ ...f, slaRegular: v }))} type="number" placeholder="cth: 48" />
          </div>
          {form.expressEligible && (
            <div style={{ flex: 1 }}>
              <Input 
                label="Express" 
                value={form.slaExpress} 
                onChange={(v) => setForm((f) => ({ ...f, slaExpress: v }))} 
                type="number" 
                placeholder={`Otomatis: ${form.slaRegular ? Math.max(1, Math.floor(Number(form.slaRegular) / 2)) : '12'}`} 
              />
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 4 }}>
                *Kosongkan untuk otomatis ½ reguler
              </div>
            </div>
          )}
        </div>



        <div style={{ display: 'flex', gap: 10 }}>

          <Btn variant="secondary" onClick={() => setModalAdd(false)} style={{ flex: 1 }}>Batal</Btn>

          <Btn variant="primary" onClick={handleSave} loading={submitting} style={{ flex: 1 }}>Simpan</Btn>

        </div>

      </Modal>

    </div>

  );

}

