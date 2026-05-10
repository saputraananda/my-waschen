import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Chip, Avatar, SearchBar, EmptyState, Select } from '../../components/ui';
import { useApp } from '../../context/AppContext';

/** Filter genre — pakai `categoryCode` (API) + fallback nama kategori & nama layanan. */
const genreMatcher = {
  Cuci: (s) => {
    const c = (s.categoryCode || '').toLowerCase();
    const n = (s.category || '').toLowerCase();
    const t = (s.name || '').toLowerCase();
    return c === 'laundry' || /laundry|cuci|kilo|wash/.test(n) || /cuci|kiloan|laundry|wash/.test(t);
  },
  Sepatu: (s) => {
    const c = (s.categoryCode || '').toLowerCase();
    const n = (s.category || '').toLowerCase();
    const t = (s.name || '').toLowerCase();
    return ['shoes', 'sepatu', 'footwear'].includes(c) || /sepatu|shoe|sneaker|footwear/.test(n) || /sepatu|shoe|sneaker|boots/.test(t);
  },
  'Dry Clean': (s) => {
    const c = (s.categoryCode || '').toLowerCase();
    const n = (s.category || '').toLowerCase();
    const t = (s.name || '').toLowerCase();
    return c === 'dry_clean' || /dry\s*clean|dryclean|suit|jas/.test(n) || /dry\s*clean|jas|gown/.test(t);
  },
  Setrika: (s) => {
    const c = (s.categoryCode || '').toLowerCase();
    const n = (s.category || '').toLowerCase();
    return c === 'ironing' || /setrika|iron|pressing|lips|lipat/.test(n);
  },
  Premium: (s) => {
    const c = (s.categoryCode || '').toLowerCase();
    const n = (s.category || '').toLowerCase();
    return c === 'premium' || /premium|silk|wool\s*care/.test(n);
  },
};

const GENRE_ORDER = ['Cuci', 'Sepatu', 'Dry Clean', 'Setrika', 'Premium'];

export default function NotaStep2Page() {
  const { navigate, notaCustomer, notaCart, setNotaCart } = useApp();
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        const [svcRes, matRes] = await Promise.all([
          axios.get(`/api/services${notaCustomer?.id ? `?customerId=${notaCustomer.id}` : ''}`),
          axios.get('/api/master/materials')
        ]);
        setServices(svcRes?.data?.data || []);
        if (matRes?.data?.data) setMaterials(matRes.data.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [notaCustomer?.id]);

  const categoryChips = useMemo(() => {
    const uniqNames = [...new Set(services.map((s) => s.category).filter(Boolean))];
    const extra = uniqNames.filter((cName) => {
      const probe = { category: cName, categoryCode: '', name: '' };
      return !GENRE_ORDER.some((label) => {
        const fn = genreMatcher[label];
        return fn ? fn(probe) : false;
      });
    });
    return ['Semua', 'Sering Dipakai', 'Pinned / Event', ...GENRE_ORDER, ...extra.sort((a, b) => a.localeCompare(b, 'id'))];
  }, [services]);

  const categoryFiltered = useMemo(() => {
    if (activeCategory === 'Semua') return services;
    if (activeCategory === 'Sering Dipakai') {
      return services.filter((s) => s.usage_count > 0).sort((a, b) => b.usage_count - a.usage_count);
    }
    if (activeCategory === 'Pinned / Event') return services.filter((s) => s.pin_context);
    const genreFn = genreMatcher[activeCategory];
    if (genreFn) return services.filter((s) => genreFn(s));
    return services.filter((s) => s.category === activeCategory);
  }, [services, activeCategory]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categoryFiltered;
    return categoryFiltered.filter((s) => {
      const blob = `${s.name || ''} ${s.unit || ''} ${s.category || ''} ${s.categoryCode || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [categoryFiltered, searchQuery]);

  const getQty = (id) => notaCart.find((c) => c.id === id)?.qty || 0;

  const addItem = (service) => {
    setNotaCart((prev) => {
      const existing = prev.find((c) => c.id === service.id);
      if (existing) return prev.map((c) => (c.id === service.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { ...service, qty: 1, express: false }];
    });
  };

  const removeItem = (id) => {
    setNotaCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing && existing.qty > 1) return prev.map((c) => (c.id === id ? { ...c, qty: c.qty - 1 } : c));
      return prev.filter((c) => c.id !== id);
    });
  };

  const toggleExpress = (id) => {
    setNotaCart((prev) => prev.map((c) => (c.id === id ? { ...c, express: !c.express } : c)));
  };

  const updateMaterial = (id, materialId) => {
    setNotaCart((prev) => prev.map((c) => (c.id === id ? { ...c, materialId } : c)));
  };

  const total = notaCart.reduce((sum, c) => sum + (c.price + (c.express ? c.expressExtra || 5000 : 0)) * c.qty, 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Buat Nota" subtitle="Langkah 2 dari 3 — Pilih Layanan" onBack={() => navigate('nota_step1')} />

      <div style={{ padding: '8px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= 2 ? C.primary : C.n200 }} />
          ))}
        </div>
      </div>

      {notaCustomer && (
        <div style={{ margin: '4px 16px 0', background: C.primaryLight, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={notaCustomer.avatar} size={32} />
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.primary }}>{notaCustomer.name}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.primarySoft }}>Deposit: {rp(notaCustomer.deposit || 0)}</div>
          </div>
        </div>
      )}

      <div style={{ padding: '8px 16px 0' }}>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cari nama layanan, satuan, atau kategori..."
        />
      </div>

      <div style={{ padding: '8px 16px 0' }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, marginBottom: 6 }}>Genre / kategori</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {categoryChips.map((cat) => (
            <Chip key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.n200}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat layanan...</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Tidak ada layanan"
            subtitle="Ubah pencarian atau pilih genre lain. Jika kategori masih kosong, tambah master layanan & kategori di admin."
          />
        ) : filtered.map((s) => {
          const qty = getQty(s.id);
          const inCart = notaCart.find((c) => c.id === s.id);
          return (
            <div key={s.id} style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{s.name}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
                    {s.unit}
                    {s.category ? <span> · {s.category}</span> : null}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.primary, marginTop: 4 }}>{rp(s.price)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {qty > 0 && (
                    <button onClick={() => removeItem(s.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C.n300}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n600, fontSize: 18 }}>−</button>
                  )}
                  {qty > 0 && <span style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: 15, minWidth: 20, textAlign: 'center', color: C.n900 }}>{qty}</span>}
                  <button onClick={() => addItem(s)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18 }}>+</button>
                </div>
              </div>
              {qty > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Number(s.expressExtra) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        onClick={() => toggleExpress(s.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: inCart?.express ? '#FEF3C7' : C.n50, border: `1.5px solid ${inCart?.express ? C.warning : C.n300}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: inCart?.express ? C.warning : C.n600 }}
                      >
                        <span style={{ fontSize: 14 }}>⚡</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600 }}>Express (+{rp(s.expressExtra)})</span>
                      </button>
                    </div>
                  )}

                  {((s.category || '').toLowerCase().includes('satuan')) && (
                    <div>
                      <Select 
                        value={inCart?.materialId || ''} 
                        onChange={(val) => updateMaterial(s.id, val)} 
                        options={[{ value: '', label: 'Pilih Jenis Bahan...' }, ...materials.map(m => ({ value: m.id, label: m.name }))]}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {notaCart.length > 0 && (
        <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{notaCart.reduce((s, c) => s + c.qty, 0)} item dipilih</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.primary }}>{rp(total)}</div>
            </div>
            <Btn variant="primary" onClick={() => navigate('nota_step3')} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>} style={{ flexDirection: 'row-reverse' }}>
              Lanjut
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
