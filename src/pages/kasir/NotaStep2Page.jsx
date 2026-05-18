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

export default function NotaStep2Page({ goBack }) {
  const { navigate, notaCustomer, notaCart, setNotaCart } = useApp();
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  // ── Carpet (m2) measurement ───────────────────────────────────────────────
  const [measuringId, setMeasuringId] = useState(null);
  const [carpetInputs, setCarpetInputs] = useState({}); // { [serviceId]: { panjang: '', lebar: '' } }

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

  const addCarpetItem = (service, panjangCm, lebarCm) => {
    const p = Number(panjangCm);
    const l = Number(lebarCm);
    if (!p || !l || p <= 0 || l <= 0) return;
    const luas = Math.round((p * l / 10000) * 100) / 100; // m², 2 desimal
    setNotaCart((prev) => {
      const existing = prev.find((c) => c.id === service.id);
      const carpetData = { carpetPanjangCm: p, carpetLebarCm: l };
      if (existing) {
        return prev.map((c) => c.id === service.id ? { ...c, qty: luas, ...carpetData } : c);
      }
      return [...prev, { ...service, qty: luas, ...carpetData, express: false }];
    });
    setMeasuringId(null);
    setCarpetInputs((prev) => ({ ...prev, [service.id]: { panjang: '', lebar: '' } }));
  };

  const removeItem = (id) => {
    setNotaCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing && existing.unit !== 'm2' && existing.qty > 1)
        return prev.map((c) => (c.id === id ? { ...c, qty: c.qty - 1 } : c));
      return prev.filter((c) => c.id !== id);
    });
    if (measuringId === id) setMeasuringId(null);
  };

  const toggleExpress = (id) => {
    setNotaCart((prev) => prev.map((c) => (c.id === id ? { ...c, express: !c.express } : c)));
  };

  const updateMaterial = (id, materialId) => {
    setNotaCart((prev) => prev.map((c) => (c.id === id ? { ...c, materialId } : c)));
  };

  const total = notaCart.reduce((sum, c) => sum + (c.price + (c.express ? (c.expressExtra || 0) : 0)) * c.qty, 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Buat Nota" subtitle="Langkah 2 dari 3 — Pilih Layanan" onBack={goBack} />

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
          const isM2     = s.unit === 'm2';
          const qty      = getQty(s.id);
          const inCart   = notaCart.find((c) => c.id === s.id);
          const isMeasuring = measuringId === s.id;
          const inp      = carpetInputs[s.id] || { panjang: '', lebar: '' };
          const luas     = (inp.panjang && inp.lebar)
            ? Math.round((Number(inp.panjang) * Number(inp.lebar) / 10000) * 100) / 100
            : 0;

          return (
            <div key={s.id} style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', border: inCart ? `1.5px solid ${C.primary}30` : '1.5px solid transparent' }}>
              {/* ── Header row ── */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{s.name}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
                    {isM2 ? 'per m²' : s.unit}
                    {s.category ? <span> · {s.category}</span> : null}
                    {isM2 && <span style={{ marginLeft: 6, background: '#E0F2FE', color: '#0369A1', borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>📐 Karpet</span>}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.primary, marginTop: 4 }}>
                    {rp(s.price)}{isM2 ? <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 500, color: C.n500 }}> / m²</span> : null}
                  </div>
                </div>

                {/* ── RIGHT SIDE ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isM2 ? (
                    inCart ? (
                      // In cart: show remove button
                      <button
                        onClick={() => removeItem(s.id)}
                        style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C.danger}40`, background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.danger, fontSize: 16 }}
                      >×</button>
                    ) : isMeasuring ? null : (
                      // Not in cart, not measuring: show Ukur button
                      <button
                        onClick={() => {
                          setMeasuringId(s.id);
                          setCarpetInputs((prev) => ({ ...prev, [s.id]: { panjang: '', lebar: '' } }));
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.primary, border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', color: 'white' }}
                      >
                        <span style={{ fontSize: 14 }}>📐</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700 }}>Ukur</span>
                      </button>
                    )
                  ) : (
                    // Normal +/- counter
                    <>
                      {qty > 0 && (
                        <button onClick={() => removeItem(s.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C.n300}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n600, fontSize: 18 }}>−</button>
                      )}
                      {qty > 0 && <span style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: 15, minWidth: 20, textAlign: 'center', color: C.n900 }}>{qty}</span>}
                      <button onClick={() => addItem(s)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18 }}>+</button>
                    </>
                  )}
                </div>
              </div>

              {/* ── Carpet: in-cart summary ── */}
              {isM2 && inCart && (
                <div style={{ marginTop: 8, background: '#EFF6FF', borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#1E40AF' }}>
                      📏 <strong>{inCart.carpetPanjangCm} cm × {inCart.carpetLebarCm} cm</strong>
                      {' = '}<strong>{Number(inCart.qty).toFixed(2)} m²</strong>
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary }}>
                      {rp(s.price * Number(inCart.qty))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMeasuringId(s.id);
                      setCarpetInputs((prev) => ({
                        ...prev,
                        [s.id]: { panjang: String(inCart.carpetPanjangCm || ''), lebar: String(inCart.carpetLebarCm || '') },
                      }));
                    }}
                    style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, color: '#1E40AF', padding: 0, textDecoration: 'underline' }}
                  >✏️ Ubah ukuran</button>
                </div>
              )}

              {/* ── Carpet: measurement input ── */}
              {isM2 && isMeasuring && (
                <div style={{ marginTop: 10, background: C.n50, borderRadius: 12, padding: '12px 14px', border: `1.5px solid ${C.primary}30` }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n700, marginBottom: 10 }}>📐 Ukur Karpet</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Panjang (cm)</div>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={inp.panjang}
                        onChange={(e) => setCarpetInputs((prev) => ({ ...prev, [s.id]: { ...prev[s.id], panjang: e.target.value } }))}
                        placeholder="mis. 250"
                        style={{ width: '100%', height: 40, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 10px', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Lebar (cm)</div>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={inp.lebar}
                        onChange={(e) => setCarpetInputs((prev) => ({ ...prev, [s.id]: { ...prev[s.id], lebar: e.target.value } }))}
                        placeholder="mis. 150"
                        style={{ width: '100%', height: 40, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 10px', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                  </div>
                  {luas > 0 && (
                    <div style={{ background: '#DBEAFE', borderRadius: 8, padding: '7px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 12, color: '#1E40AF' }}>
                        Luas: <strong>{luas.toFixed(2)} m²</strong>
                      </span>
                      <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>
                        {rp(s.price * luas)}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setMeasuringId(null); setCarpetInputs((prev) => ({ ...prev, [s.id]: { panjang: '', lebar: '' } })); }}
                      style={{ flex: 1, height: 36, borderRadius: 8, border: `1.5px solid ${C.n300}`, background: C.white, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: C.n600 }}
                    >Batal</button>
                    <button
                      onClick={() => addCarpetItem(s, inp.panjang, inp.lebar)}
                      disabled={!luas}
                      style={{ flex: 2, height: 36, borderRadius: 8, border: 'none', background: luas ? C.primary : C.n300, fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, cursor: luas ? 'pointer' : 'not-allowed', color: 'white' }}
                    >
                      {inCart ? '✓ Perbarui' : '+ Tambah'} {luas ? `${luas.toFixed(2)} m²` : ''}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Normal expanded: express + material (non-m2 only) ── */}
              {!isM2 && qty > 0 && (
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

              {/* ── Express toggle for m2 (when in cart) ── */}
              {isM2 && inCart && Number(s.expressExtra) > 0 && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => toggleExpress(s.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: inCart?.express ? '#FEF3C7' : C.n50, border: `1.5px solid ${inCart?.express ? C.warning : C.n300}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: inCart?.express ? C.warning : C.n600 }}
                  >
                    <span style={{ fontSize: 14 }}>⚡</span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600 }}>Express (+{rp(s.expressExtra)} / m²)</span>
                  </button>
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
