// ─────────────────────────────────────────────────────────────────────────────
// AdminInventoryPage — Professional Inventory Management for Admin
// Features: Stock Matrix | SKU & Stok | Pengajuan | Koreksi Stok
// Design: Premium Glassmorphism v2 — matches Kasir/StokBahan aesthetic
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import id from 'date-fns/locale/id';
import { C } from '../../utils/theme';
import { useIsMobile } from '../../utils/hooks';
import { Btn, SearchBar, Chip, EmptyState, Modal } from '../../components/ui';
import { alertError, alertSuccess, alertWarning, alertConfirm } from '../../utils/alert';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const TOKENS = {
  purpleDeep:   '#3B0B47',
  purpleMid:    '#5C1A6B',
  magenta:      '#C0247D',
  mintDeep:     '#1F9E75',
  coralDeep:    '#B82848',
  goldDeep:     '#B8811A',
  bg:           '#F3EEF7',
  glassStrong:  'rgba(255,255,255,0.78)',
  glassMid:     'rgba(255,255,255,0.65)',
  glassLight:   'rgba(255,255,255,0.55)',
  ink:          '#2B1130',
  inkSoft:      '#7A6584',
  inkFaint:     '#A898B0',
};

// ─── Status Meta ───────────────────────────────────────────────────────────────
const STOCK_STATUS = {
  safe:   { label: 'Aman',    valColor: '#1F9E75', barColor: '#5FD9AE', bg: 'rgba(31,158,117,0.12)'  },
  low:    { label: 'Menipis', valColor: '#B8811A', barColor: '#E0A93B', bg: 'rgba(184,129,26,0.12)'  },
  empty:  { label: 'Habis',   valColor: '#B82848', barColor: '#F0466B', bg: 'rgba(184,40,72,0.12)'   },
};

const PR_STATUS_META = {
  pending:   { label: 'Menunggu',   bg: 'rgba(184,129,26,0.12)',  fg: '#B8811A', border: '#B8811A', icon: '⏳' },
  approved:  { label: 'Disetujui',  bg: 'rgba(31,158,117,0.12)', fg: '#1F9E75', border: '#1F9E75', icon: '✅' },
  fulfilled: { label: 'Selesai',    bg: 'rgba(31,158,117,0.12)', fg: '#1F9E75', border: '#1F9E75', icon: '🎉' },
  rejected:  { label: 'Ditolak',    bg: 'rgba(184,40,72,0.12)',  fg: '#B82848', border: '#B82848', icon: '❌' },
  revised:   { label: 'Revisi',     bg: 'rgba(184,129,26,0.12)', fg: '#B8811A', border: '#B8811A', icon: '↩️' },
  cancelled: { label: 'Batal',      bg: 'rgba(122,101,132,0.12)', fg: '#7A6584', border: '#7A6584', icon: '⊘' },
};

const URGENCY_META = {
  normal:   { label: 'Normal',   bg: 'rgba(122,101,132,0.12)', fg: '#7A6584' },
  urgent:   { label: 'Urgent',   bg: 'rgba(184,129,26,0.12)',  fg: '#B8811A' },
  critical: { label: 'Kritis',   bg: 'rgba(184,40,72,0.12)',  fg: '#B82848' },
};

const TABS = [
  { key: 'matrix',   label: '📦 Matrix',    icon: '📦' },
  { key: 'sku',     label: '🏷️ SKU & Stok', icon: '🏷️' },
  { key: 'requests', label: '📋 Pengajuan',  icon: '📋' },
  { key: 'history', label: '📜 Riwayat',    icon: '📜' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch (err) { console.error('fmt date parse error:', err); return '-'; }
};

const fmtRel = (v) => {
  if (!v) return '-';
  try { return formatDistanceToNow(new Date(v), { addSuffix: true, locale: id }); }
  catch (err) { console.error('fmtRel error:', err); return fmt(v); }
};

const getStockMeta = (qty, min) => {
  const q = Number(qty) || 0;
  const m = Number(min) || 0;
  if (q === 0) return STOCK_STATUS.empty;
  if (m > 0 && q <= m) return STOCK_STATUS.low;
  return STOCK_STATUS.safe;
};

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard({ height = 90, style = {} }) {
  return (
    <div style={{
      borderRadius: 18,
      height,
      background: 'linear-gradient(90deg, rgba(59,11,71,0.05) 25%, rgba(59,11,71,0.09) 50%, rgba(59,11,71,0.05) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      marginBottom: 10,
      ...style,
    }} />
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 1: STOCK MATRIX
// ════════════════════════════════════════════════════════════════════════════════
function MatrixTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [outlets, setOutlets] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (onlyLow) params.onlyLowStock = '1';
      if (search.trim()) params.search = search.trim();
      const r = await axios.get('/api/inventory/all-outlet-stocks', { params });
      const data = r?.data?.data || [];
      setItems(data);
      if (data.length > 0 && data[0].outlets?.length > 0) {
        setOutlets(data[0].outlets.map(o => ({ id: o.outletId, name: o.outletName })));
      }
    } catch (err) { console.error('[MatrixTab] fetchData error:', err); } finally { setLoading(false); }
  }, [onlyLow, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalLow = items.filter(i => i.lowStockOutletCount > 0).length;
  const totalSafe = items.length - totalLow;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px' }}>
      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
        marginBottom: 14,
      }}>
        {[
          { label: 'Total SKU', value: items.length, color: TOKENS.purpleMid },
          { label: 'Butuh Aksi', value: totalLow, color: TOKENS.goldDeep },
          { label: 'Aman', value: totalSafe, color: TOKENS.mintDeep },
        ].map(s => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            style={{
              background: TOKENS.glassStrong, backdropFilter: 'blur(14px)',
              borderRadius: 16, padding: '12px 14px',
              boxShadow: `8px 8px 20px rgba(59,11,71,0.1), -4px -4px 12px rgba(255,255,255,0.8)`,
              border: '1px solid rgba(255,255,255,0.6)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: TOKENS.inkSoft, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cari item..." compact />
        </div>
        <Chip
          label={onlyLow ? '⚠️ Tipis/Habis' : 'Semua Item'}
          active={onlyLow}
          onClick={() => setOnlyLow(v => !v)}
        />
      </div>

      {/* Alert Banner */}
      {totalLow > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: 'rgba(184,129,26,0.1)',
            border: '1px solid rgba(184,129,26,0.3)',
            borderRadius: 14, padding: '12px 14px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 12, color: TOKENS.goldDeep }}>
              {totalLow} item stok rendah atau habis
            </div>
            <div style={{ fontSize: 11, color: TOKENS.inkSoft }}>
              {items.filter(i => i.lowStockOutletCount > 0).slice(0, 3).map(i => i.itemName).join(', ')}
              {totalLow > 3 ? ` +${totalLow - 3} lainnya` : ''}
            </div>
          </div>
        </motion.div>
      )}

      {/* Matrix Table */}
      {loading && [1, 2, 3].map(i => <SkeletonCard key={i} height={70} />)}

      {!loading && items.length === 0 && (
        <EmptyState title="Stok kosong" subtitle="Tidak ada item inventori ditemukan." icon="📦" />
      )}

      {!loading && items.length > 0 && (
        <div style={{
          background: TOKENS.glassStrong, backdropFilter: 'blur(14px)',
          borderRadius: 18, overflow: 'hidden',
          boxShadow: `8px 8px 24px rgba(59,11,71,0.1), -4px -4px 12px rgba(255,255,255,0.8)`,
          border: '1px solid rgba(255,255,255,0.6)',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
              <thead>
                <tr style={{ background: 'rgba(59,11,71,0.04)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: TOKENS.inkSoft }}>Item</th>
                  {outlets.map(o => (
                    <th key={o.id} style={{ padding: '10px 8px', textAlign: 'center', fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: TOKENS.inkSoft, whiteSpace: 'nowrap' }}>{o.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.inventoryId} style={{ borderTop: '1px solid rgba(59,11,71,0.07)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: TOKENS.inkFaint, fontWeight: 600 }}>{it.categoryName}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: TOKENS.ink }}>{it.itemName}</div>
                      <div style={{ fontSize: 10, color: TOKENS.inkFaint }}>{it.unit}</div>
                    </td>
                    {it.outlets.map(o => {
                      const status = o.stockQty <= 0 ? 'empty' : o.stockQty <= (o.minStock || 0) ? 'low' : 'safe';
                      const meta = STOCK_STATUS[status];
                      return (
                        <td key={o.outletId} style={{ padding: '8px', textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                            padding: '6px 10px', borderRadius: 12, background: meta.bg, minWidth: 60,
                          }}>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 800, color: meta.valColor }}>
                              {Number(o.stockQty).toLocaleString('id-ID')}
                            </span>
                            <span style={{ fontSize: 7, fontWeight: 700, color: meta.valColor }}>{meta.label}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', padding: '12px 0 4px' }}>
          {Object.entries(STOCK_STATUS).map(([k, m]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: m.valColor, display: 'inline-block' }} />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: TOKENS.inkSoft, fontWeight: 600 }}>{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 2: SKU & STOK — Master Data + Per-Outlet Stock Management
// ════════════════════════════════════════════════════════════════════════════════
function SkuStokTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: '', unit: '', minStockDefault: '', categoryId: '' });
  const [categories, setCategories] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState('all');
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/api/inventory/items');
      setItems(r?.data?.data || []);
    } catch (err) { console.error('[SkuStokTab] fetchItems error:', err); } finally { setLoading(false); }
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const [catRes, outletRes] = await Promise.all([
        axios.get('/api/inventory/categories'),
        axios.get('/api/outlets'),
      ]);
      setCategories(catRes?.data?.data || []);
      setOutlets(outletRes?.data?.data || []);
    } catch (err) { console.error('[SkuStokTab] fetchMeta error:', err); }
  }, []);

  useEffect(() => { fetchItems(); fetchMeta(); }, []);

  const openNew = () => {
    setForm({ name: '', unit: '', minStockDefault: '', categoryId: categories[0]?.id || '' });
    setEditingItem(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setForm({
      name: item.name,
      unit: item.unit || '',
      minStockDefault: String(item.minStockDefault || item.min_stock_default || ''),
      categoryId: item.categoryId || item.category_id || '',
    });
    setEditingItem(item);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alertError('Nama item wajib diisi.'); return; }
    setSaving(true);
    try {
      if (editingItem) {
        await axios.patch(`/api/inventory/items/${editingItem.id}`, {
          name: form.name,
          unit: form.unit,
          minStockDefault: Number(form.minStockDefault) || 0,
        });
        alertSuccess('Item diperbarui.');
      } else {
        await axios.post('/api/inventory/items', {
          name: form.name,
          unit: form.unit,
          minStockDefault: Number(form.minStockDefault) || 0,
          categoryId: form.categoryId || null,
        });
        alertSuccess('Item baru ditambahkan.');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    const ok = await alertConfirm(`Nonaktifkan "${item.name}"? Item akan dihapus dari katalog aktif.`);
    if (!ok) return;
    try {
      await axios.patch(`/api/inventory/items/${item.id}`, { isActive: false });
      alertSuccess('Item dinonaktifkan.');
      fetchItems();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menonaktifkan.');
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(i =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.itemCode || '').toLowerCase().includes(q) ||
      (i.categoryName || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(i => {
      const cat = i.categoryName || i.category || 'Lainnya';
      if (!map[cat]) map[cat] = [];
      map[cat].push(i);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cari SKU..." compact />
        </div>
        <Btn variant="primary" onClick={openNew} size="sm">+ Item</Btn>
      </div>

      {/* Category Chips */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
        <Chip label="Semua" active={selectedOutlet === 'all'} onClick={() => setSelectedOutlet('all')} />
        {categories.slice(0, 6).map(c => (
          <Chip key={c.id} label={c.name} active={selectedOutlet === c.id} onClick={() => setSelectedOutlet(c.id)} />
        ))}
      </div>

      {/* List */}
      {loading && [1, 2, 3, 4].map(i => <SkeletonCard key={i} height={88} />)}

      {!loading && items.length === 0 && (
        <EmptyState title="Belum ada item" subtitle="Tambah item pertama." icon="🏷️" action={openNew} actionLabel="+ Tambah" />
      )}

      {!loading && grouped.map(([category, rows]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 800,
            color: TOKENS.purpleMid, marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            {category} ({rows.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -1 }}
                style={{
                  background: TOKENS.glassStrong, backdropFilter: 'blur(14px)',
                  borderRadius: 18, padding: '14px',
                  boxShadow: `6px 6px 16px rgba(59,11,71,0.09), -3px -3px 10px rgba(255,255,255,0.8)`,
                  border: '1px solid rgba(255,255,255,0.6)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: TOKENS.ink }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginTop: 2 }}>
                      {item.itemCode || '—'} · {item.unit || '—'} · Min: {item.minStockDefault || item.min_stock_default || 0}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => openEdit(item)}
                      style={{
                        padding: '6px 12px', borderRadius: 10, border: 'none',
                        background: 'rgba(59,11,71,0.08)', color: TOKENS.purpleMid,
                        fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      style={{
                        padding: '6px 10px', borderRadius: 10, border: 'none',
                        background: 'rgba(184,40,72,0.08)', color: TOKENS.coralDeep,
                        fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}

      {/* Add/Edit Modal */}
      <Modal visible={showForm} onClose={() => setShowForm(false)} title={editingItem ? '✏️ Edit Item' : '➕ Item Baru'}>
        <div style={{ padding: '0 4px 4px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: TOKENS.ink, display: 'block', marginBottom: 5 }}>Nama Item *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="cth: Deterjen Cair 5L"
              style={{
                width: '100%', height: 46, borderRadius: 14, border: '1.5px solid rgba(59,11,71,0.15)',
                padding: '0 14px', fontFamily: "'Outfit', sans-serif", fontSize: 13, color: TOKENS.ink,
                background: 'white', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: TOKENS.ink, display: 'block', marginBottom: 5 }}>Satuan</label>
              <input
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                placeholder="liter, kg, pcs"
                style={{
                  width: '100%', height: 46, borderRadius: 14, border: '1.5px solid rgba(59,11,71,0.15)',
                  padding: '0 14px', fontFamily: "'Outfit', sans-serif", fontSize: 13, color: TOKENS.ink,
                  background: 'white', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: TOKENS.ink, display: 'block', marginBottom: 5 }}>Min Stok Default</label>
              <input
                type="number"
                value={form.minStockDefault}
                onChange={e => setForm(f => ({ ...f, minStockDefault: e.target.value }))}
                placeholder="0"
                style={{
                  width: '100%', height: 46, borderRadius: 14, border: '1.5px solid rgba(59,11,71,0.15)',
                  padding: '0 14px', fontFamily: "'Outfit', sans-serif", fontSize: 13, color: TOKENS.ink,
                  background: 'white', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: TOKENS.ink, display: 'block', marginBottom: 5 }}>Kategori</label>
            <select
              value={form.categoryId}
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
              style={{
                width: '100%', height: 46, borderRadius: 14, border: '1.5px solid rgba(59,11,71,0.15)',
                padding: '0 14px', fontFamily: "'Outfit', sans-serif", fontSize: 13, color: TOKENS.ink,
                background: 'white', outline: 'none',
              }}
            >
              <option value="">— Pilih Kategori —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button
              onClick={() => setShowForm(false)}
              style={{
                flex: 1, padding: '13px', borderRadius: 14, border: '1.5px solid rgba(59,11,71,0.15)',
                background: 'white', color: TOKENS.inkSoft, fontFamily: "'Outfit', sans-serif",
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, padding: '13px', borderRadius: 14, border: 'none',
                background: saving ? TOKENS.inkSoft : `linear-gradient(150deg, ${TOKENS.magenta}, ${TOKENS.purpleDeep})`,
                color: 'white', fontFamily: "'Outfit', sans-serif",
                fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: `0 4px 14px rgba(91,0,95,0.35)`,
              }}
            >
              {saving ? 'Menyimpan...' : (editingItem ? 'Simpan' : 'Tambah')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 3: PENGAJUAN — PR List + Approve/Revise/Reject Actions
// ════════════════════════════════════════════════════════════════════════════════
function RequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionModal, setActionModal] = useState(null); // { type, request }
  const [actionNote, setActionNote] = useState('');
  const [actionQty, setActionQty] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const r = await axios.get('/api/purchase-requests', { params });
      setRequests(r?.data?.data || []);
      try {
        const or = await axios.get('/api/outlets');
        setOutlets(or?.data?.data || []);
      } catch (err) { console.error('[RequestsTab] fetch outlets error:', err); }
    } catch (err) { console.error('[RequestsTab] fetchData error:', err); } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async () => {
    if (!actionModal) return;
    const { type, request } = actionModal;
    if ((type === 'revise' || type === 'reject') && !actionNote.trim()) {
      alertWarning('Catatan wajib diisi.'); return;
    }
    setActionLoading(true);
    try {
      const body = { action: type };
      if (actionNote.trim()) body.adminNote = actionNote.trim();
      if (type === 'approve' && actionQty) body.approvedQty = Number(actionQty);
      await axios.patch(`/api/purchase-requests/${request.id}`, body);
      alertSuccess(`Pengajuan berhasil di${type === 'approve' ? 'setujui' : type === 'revise' ? 'minta revisi' : 'tolak'}.`);
      setActionModal(null);
      setActionNote('');
      setActionQty('');
      fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal memproses.');
    } finally { setActionLoading(false); }
  };

  const openAction = (type, request) => {
    setActionModal({ type, request });
    setActionNote('');
    setActionQty(type === 'approve' ? String(request.qty) : '');
  };

  const filtered = useMemo(() => {
    let result = requests;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter(r => (r.itemName || '').toLowerCase().includes(q));
    if (selectedOutlet !== 'all') result = result.filter(r => String(r.outletId) === String(selectedOutlet));
    return result;
  }, [requests, search, selectedOutlet]);

  const stats = useMemo(() => ({
    pending:   filtered.filter(r => r.status === 'pending').length,
    approved:  filtered.filter(r => r.status === 'approved').length,
    fulfilled: filtered.filter(r => r.status === 'fulfilled').length,
    rejected:  filtered.filter(r => r.status === 'rejected' || r.status === 'cancelled').length,
  }), [filtered]);

  const isActionable = (r) => r.status === 'pending' || r.status === 'revised';

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { key: 'pending',   label: 'Menunggu',  color: TOKENS.goldDeep },
          { key: 'approved',  label: 'Disetujui', color: TOKENS.mintDeep },
          { key: 'fulfilled', label: 'Selesai',   color: TOKENS.purpleMid },
          { key: 'rejected',  label: 'Ditolak',   color: TOKENS.coralDeep },
        ].map(s => (
          <div key={s.key} style={{
            background: TOKENS.glassStrong, backdropFilter: 'blur(14px)',
            borderRadius: 14, padding: '10px 8px', textAlign: 'center',
            boxShadow: `5px 5px 14px rgba(59,11,71,0.08), -2px -2px 8px rgba(255,255,255,0.8)`,
            border: '1px solid rgba(255,255,255,0.6)',
          }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: s.color }}>{stats[s.key]}</div>
            <div style={{ fontSize: 9, color: TOKENS.inkSoft, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cari item..." compact />
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {['all', 'pending', 'approved', 'fulfilled', 'rejected'].map(s => (
            <Chip
              key={s}
              label={s === 'all' ? 'Semua' : PR_STATUS_META[s]?.label || s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            />
          ))}
        </div>
      </div>

      {/* Outlet Filter */}
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
        <Chip label="Semua Outlet" active={selectedOutlet === 'all'} onClick={() => setSelectedOutlet('all')} />
        {outlets.slice(0, 5).map(o => (
          <Chip key={o.id} label={o.name} active={selectedOutlet === String(o.id)} onClick={() => setSelectedOutlet(String(o.id))} />
        ))}
      </div>

      {/* List */}
      {loading && [1, 2, 3].map(i => <SkeletonCard key={i} height={100} />)}

      {!loading && filtered.length === 0 && (
        <EmptyState title="Tidak ada pengajuan" subtitle="Belum ada pengajuan yang sesuai filter." icon="📋" />
      )}

      {!loading && filtered.map(r => {
        const st = PR_STATUS_META[r.status] || PR_STATUS_META.pending;
        const urg = URGENCY_META[r.urgency];
        const actionable = isActionable(r);

        return (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: TOKENS.glassStrong, backdropFilter: 'blur(14px)',
              borderRadius: 18, padding: 14, marginBottom: 10,
              boxShadow: `6px 6px 18px rgba(59,11,71,0.1), -3px -3px 10px rgba(255,255,255,0.8)`,
              border: `1px solid rgba(255,255,255,0.6)`,
              borderLeft: `4px solid ${st.border}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: TOKENS.ink }}>{r.itemName}</div>
                <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginTop: 2 }}>
                  {r.qty} {r.unit}
                  {r.approvedQty != null && r.approvedQty !== r.qty && (
                    <span style={{ color: TOKENS.mintDeep, fontWeight: 600 }}> → Disetujui {r.approvedQty}</span>
                  )}
                  {r.estimatedPrice && ` · Est. ${rp(r.estimatedPrice)}`}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                  background: st.bg, color: st.fg,
                }}>
                  {st.icon} {st.label}
                </span>
                {urg && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: urg.bg, color: urg.fg }}>
                    {urg.label}
                  </span>
                )}
              </div>
            </div>

            {r.reason && (
              <div style={{
                fontSize: 11, color: TOKENS.inkSoft, lineHeight: 1.5,
                background: 'rgba(59,11,71,0.04)', borderRadius: 8, padding: '6px 10px', marginBottom: 8,
              }}>
                💬 {r.reason}
              </div>
            )}

            {r.adminNote && (
              <div style={{
                fontSize: 11, color: TOKENS.ink, lineHeight: 1.5,
                background: r.status === 'revised' ? 'rgba(184,129,26,0.1)' : 'rgba(31,158,117,0.1)',
                borderRadius: 8, padding: '6px 10px', marginBottom: 8,
                borderLeft: `3px solid ${r.status === 'revised' ? TOKENS.goldDeep : TOKENS.mintDeep}`,
              }}>
                📝 Admin: {r.adminNote}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 10, color: TOKENS.inkFaint }}>
                {r.outletName || `Outlet ${r.outletId}`} · {r.requesterName || '—'} · {fmtRel(r.createdAt)}
              </div>

              {/* Action Buttons */}
              {actionable && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => openAction('approve', r)}
                    style={{
                      padding: '7px 14px', borderRadius: 10, border: 'none',
                      background: `linear-gradient(150deg, ${TOKENS.mintDeep}, #166B54)`,
                      color: 'white', fontFamily: "'Outfit', sans-serif",
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      boxShadow: `0 3px 10px rgba(31,158,117,0.35)`,
                    }}
                  >
                    ✓ Setuju
                  </button>
                  <button
                    onClick={() => openAction('revise', r)}
                    style={{
                      padding: '7px 14px', borderRadius: 10, border: '1.5px solid rgba(184,129,26,0.4)',
                      background: 'rgba(184,129,26,0.08)', color: TOKENS.goldDeep,
                      fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    ↩ Revisi
                  </button>
                  <button
                    onClick={() => openAction('reject', r)}
                    style={{
                      padding: '7px 14px', borderRadius: 10, border: 'none',
                      background: 'rgba(184,40,72,0.1)', color: TOKENS.coralDeep,
                      fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    ✕ Tolak
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* Action Modal */}
      <AnimatePresence>
        {actionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(59,11,71,0.5)',
              zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setActionModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'white', borderRadius: 22, padding: '20px',
                width: '100%', maxWidth: 400,
                boxShadow: `0 24px 60px rgba(59,11,71,0.3)`,
              }}
            >
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 800, color: TOKENS.ink, marginBottom: 6 }}>
                {actionModal.type === 'approve' ? '✅ Setujui Pengajuan' : actionModal.type === 'revise' ? '↩️ Minta Revisi' : '❌ Tolak Pengajuan'}
              </div>
              <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginBottom: 16 }}>
                {actionModal.request.itemName} — {actionModal.request.qty} {actionModal.request.unit}
              </div>

              {actionModal.type === 'approve' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: TOKENS.ink, display: 'block', marginBottom: 5 }}>
                    Jumlah Disetujui
                  </label>
                  <input
                    type="number"
                    value={actionQty}
                    onChange={e => setActionQty(e.target.value)}
                    placeholder={String(actionModal.request.qty)}
                    style={{
                      width: '100%', height: 46, borderRadius: 14,
                      border: '1.5px solid rgba(59,11,71,0.15)',
                      padding: '0 14px', fontFamily: "'Outfit', sans-serif", fontSize: 13,
                      color: TOKENS.ink, background: 'white', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: TOKENS.ink, display: 'block', marginBottom: 5 }}>
                  {actionModal.type === 'approve' ? 'Catatan (opsional)' : 'Catatan *'}
                </label>
                <textarea
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  rows={3}
                  placeholder={
                    actionModal.type === 'approve'
                      ? 'Catatan persetujuan...'
                      : actionModal.type === 'revise'
                      ? 'Jelaskan yang perlu direvisi...'
                      : 'Alasan penolakan...'
                  }
                  style={{
                    width: '100%', borderRadius: 14, padding: '10px 14px',
                    border: '1.5px solid rgba(59,11,71,0.15)',
                    fontFamily: "'Outfit', sans-serif", fontSize: 13,
                    color: TOKENS.ink, background: 'white', outline: 'none', resize: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setActionModal(null)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 14,
                    border: '1.5px solid rgba(59,11,71,0.15)', background: 'white',
                    color: TOKENS.inkSoft, fontFamily: "'Outfit', sans-serif",
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 14, border: 'none',
                    background: actionLoading ? TOKENS.inkSoft
                      : actionModal.type === 'approve'
                      ? `linear-gradient(150deg, ${TOKENS.mintDeep}, #166B54)`
                      : actionModal.type === 'revise'
                      ? `linear-gradient(150deg, ${TOKENS.goldDeep}, #8A5E10)`
                      : `linear-gradient(150deg, ${TOKENS.coralDeep}, #8A1B2E)`,
                    color: 'white', fontFamily: "'Outfit', sans-serif",
                    fontSize: 13, fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer',
                    boxShadow: `0 4px 14px rgba(0,0,0,0.2)`,
                  }}
                >
                  {actionLoading ? 'Memproses...' : 'Konfirmasi'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 4: RIWAYAT — Stock Movement / Audit Log
// ════════════════════════════════════════════════════════════════════════════════
function HistoryTab() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/api/inventory/stock-history');
      setMovements(r?.data?.data || []);
    } catch (err) { console.error('[HistoryTab] fetchData error:', err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return movements;
    const q = search.trim().toLowerCase();
    return movements.filter(m =>
      (m.itemName || '').toLowerCase().includes(q) ||
      (m.outletName || '').toLowerCase().includes(q) ||
      (m.notes || '').toLowerCase().includes(q)
    );
  }, [movements, search]);

  const fmtDate = (v) => {
    if (!v) return '-';
    try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (err) { console.error('[HistoryTab] fmtDate error:', err); return '-'; }
  };

  const TYPE_META = {
    adjustment:     { label: 'Penyesuaian',  bg: 'rgba(59,11,71,0.08)',   fg: TOKENS.purpleMid },
    manual_usage:   { label: 'Penggunaan',   bg: 'rgba(184,40,72,0.1)',  fg: TOKENS.coralDeep },
    purchase_in:    { label: 'Pembelian',     bg: 'rgba(31,158,117,0.1)', fg: TOKENS.mintDeep },
    transfer_in:    { label: 'Transfer Masuk', bg: 'rgba(91,0,95,0.08)', fg: '#5B005F' },
    transfer_out:   { label: 'Transfer Keluar', bg: 'rgba(184,129,26,0.1)', fg: TOKENS.goldDeep },
    auto_reorder:   { label: 'Auto-Reorder', bg: 'rgba(184,129,26,0.1)', fg: TOKENS.goldDeep },
    pr_fulfill:     { label: 'PR Disetujui', bg: 'rgba(31,158,117,0.1)', fg: TOKENS.mintDeep },
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cari riwayat..." compact />
        </div>
      </div>

      {loading && [1, 2, 3, 4].map(i => <SkeletonCard key={i} height={76} />)}

      {!loading && filtered.length === 0 && (
        <EmptyState title="Belum ada riwayat" subtitle="Riwayat pergerakan stok akan muncul di sini." icon="📜" />
      )}

      {!loading && filtered.map(m => {
        const typeMeta = TYPE_META[m.movementType] || TYPE_META.adjustment;
        const delta = Number(m.qty) || 0;
        const isPositive = delta > 0;

        return (
          <div key={m.id} style={{
            background: TOKENS.glassStrong, backdropFilter: 'blur(14px)',
            borderRadius: 16, padding: '12px 14px', marginBottom: 8,
            boxShadow: `5px 5px 14px rgba(59,11,71,0.08), -2px -2px 8px rgba(255,255,255,0.8)`,
            border: '1px solid rgba(255,255,255,0.6)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            {/* Delta badge */}
            <div style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isPositive ? 'rgba(31,158,117,0.12)' : 'rgba(184,40,72,0.1)',
              fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 800,
              color: isPositive ? TOKENS.mintDeep : TOKENS.coralDeep,
            }}>
              {isPositive ? '+' : ''}{delta}
            </div>

            {/* Body */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: TOKENS.ink }}>
                {m.itemName || 'Item #' + m.inventoryId}
              </div>
              <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginTop: 2 }}>
                {m.outletName || `Outlet ${m.outletId}`} · {m.notes || typeMeta.label}
              </div>
              <div style={{ fontSize: 10, color: TOKENS.inkFaint, marginTop: 2 }}>
                {fmtDate(m.createdAt)} · {m.createdByName || '—'}
              </div>
            </div>

            {/* Type */}
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
              background: typeMeta.bg, color: typeMeta.fg, whiteSpace: 'nowrap',
            }}>
              {typeMeta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ════════════════════════════════════════════════════════════════════════════════
export default function AdminInventoryPage({ goBack }) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('matrix');
  useAppRefresh(() => {}, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: TOKENS.bg, overflow: 'hidden', minHeight: '100vh' }}>

      {/* GLOBAL STYLES */}
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-14px,16px) scale(1.08)} }
        @keyframes floatB { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(18px,-12px) scale(1.1)} }
        @keyframes floatC { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(16px,10px) scale(0.95)} }
        @keyframes twinkle { 0%,100%{opacity:0;transform:scale(0.4) rotate(0deg)} 50%{opacity:1;transform:scale(1) rotate(20deg)} }
      `}</style>

      {/* HEADER */}
      <div style={{
        position: 'relative',
        padding: '22px 16px 52px',
        background: `radial-gradient(circle at 85% -10%, rgba(232,90,168,0.5) 0%, transparent 55%), radial-gradient(circle at -10% 20%, rgba(95,217,174,0.2) 0%, transparent 45%), linear-gradient(155deg, ${TOKENS.purpleDeep} 0%, ${TOKENS.purpleMid} 55%, #4A1259 100%)`,
        overflow: 'hidden',
      }}>
        {/* Blob decorations */}
        <div style={{ position: 'absolute', width: 160, height: 160, background: 'radial-gradient(circle, rgba(232,90,168,0.5) 0%, transparent 70%)', top: -50, right: -30, borderRadius: '50%', animation: 'floatB 11s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 130, height: 130, background: 'radial-gradient(circle, rgba(95,217,174,0.3) 0%, transparent 70%)', bottom: -30, left: -40, borderRadius: '50%', animation: 'floatC 16s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 80, height: 80, background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)', top: 20, left: '55%', borderRadius: '50%', animation: 'floatA 9s ease-in-out infinite', pointerEvents: 'none' }} />

        {/* Sparkles */}
        {[{ top: 18, right: 65, size: 12 }, { top: 52, right: 22, size: 8 }, { top: 10, left: '28%', size: 9 }].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: s.size, top: s.top, [s.right ? 'right' : 'left']: s.right || s.left, animation: `twinkle 3.2s ease-in-out ${i * 0.8}s infinite`, pointerEvents: 'none', zIndex: 1 }}>
            <svg viewBox="0 0 24 24" width={s.size} height={s.size} fill="#fff" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9))' }}>
              <path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" />
            </svg>
          </div>
        ))}

        {/* Back + Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={goBack}
              style={{
                width: 36, height: 36, borderRadius: 12,
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', backdropFilter: 'blur(6px)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: isMobile ? 20 : 22, color: '#fff' }}>📦 Inventory</div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 500, marginTop: 2 }}>
                Kelola stok, SKU & pengajuan barang
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          position: 'absolute', bottom: -1, left: 0, right: 0,
          display: 'flex', gap: 0,
          background: 'rgba(255,255,255,0.12)',
          borderRadius: '16px 16px 0 0',
          padding: '4px 6px',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderBottom: 'none',
          margin: '0 12px',
          zIndex: 3,
        }}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: '8px 4px',
                  borderRadius: 12,
                  border: 'none',
                  background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 10, fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}
              >
                <span style={{ fontSize: 14 }}>{tab.icon}</span>
                <span>{tab.label.split(' ').slice(1).join(' ')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {activeTab === 'matrix'   && <MatrixTab />}
          {activeTab === 'sku'     && <SkuStokTab />}
          {activeTab === 'requests' && <RequestsTab />}
          {activeTab === 'history' && <HistoryTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
