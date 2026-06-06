// ─────────────────────────────────────────────────────────────────────────────
// RequestBarangPage — kasir input pengadaan barang (optimized)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo } from 'react';
import api, { withFresh } from '../../utils/api';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, Input, Select, Textarea, useAppRefresh, SearchFilterRow, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

async function fetchWithRetry(requestFn, maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await requestFn();
    } catch (err) {
      lastErr = err;
      if (err?.response?.status !== 429 || attempt >= maxRetries) throw err;
      const retryAfterSec = Number(err?.response?.headers?.['retry-after'] || 1);
      await new Promise((r) => setTimeout(r, Math.max(retryAfterSec * 1000, 800)));
    }
  }
  throw lastErr;
}

const URGENCY_META = {
  normal:   { label: 'Normal',   bg: '#DBEAFE', fg: '#1E40AF', color: '#3B82F6', icon: '📋' },
  urgent:   { label: 'Urgent',   bg: '#FEF3C7', fg: '#92400E', color: '#F59E0B', icon: '⚠️' },
  critical: { label: 'Kritis',   bg: '#FEE2E2', fg: '#991B1B', color: '#DC2626', icon: '🚨' },
};

const STATUS_META = {
  pending:   { label: 'Menunggu', bg: '#FEF3C7', fg: '#92400E', icon: '⏳' },
  revised:   { label: 'Perlu Revisi', bg: '#FED7AA', fg: '#9A3412', icon: '↩️' },
  approved:  { label: 'Disetujui', bg: '#DBEAFE', fg: '#1E40AF', icon: '✅' },
  fulfilled: { label: 'Sudah Dibeli', bg: '#DCFCE7', fg: '#15803D', icon: '🎉' },
  rejected:  { label: 'Ditolak', bg: '#FEE2E2', fg: '#991B1B', icon: '❌' },
  cancelled: { label: 'Dibatalkan', bg: '#F3F4F6', fg: '#6B7280', icon: '⊘' },
};

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
};

export default function RequestBarangPage({ goBack, navigate, preselectedItem }) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Auto-open form if navigated with preselectedItem
  useEffect(() => {
    if (preselectedItem) {
      setShowForm(true);
    }
  }, [preselectedItem]);

  const fetchData = useCallback(async (fresh = false) => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = { page: 1, limit: 100 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (urgencyFilter !== 'all') params.urgency = urgencyFilter;
      const config = fresh ? withFresh({ params }) : { params };
      const res = await fetchWithRetry(() => api.get('/api/purchase-requests', config));
      setItems(res?.data?.data || []);
      setTotal(res?.data?.pagination?.total ?? null);
    } catch (err) {
      const msg = err?.response?.status === 429
        ? 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.'
        : (err?.response?.data?.message || 'Gagal memuat request.');
      setFetchError(msg);
      console.error('[RequestBarang fetch]', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, urgencyFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAppRefresh(() => fetchData(true), [fetchData]);

  // Load inventory items (cached + dedup — tidak perlu withFresh)
  useEffect(() => {
    api.get('/api/inventory/items').then(r => {
      setInventoryItems(r?.data?.data || []);
    }).catch(() => {});
  }, []);

  // Client-side search filter (di atas server filter)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => {
      return (
        (it.itemName || '').toLowerCase().includes(q) ||
        (it.brand || '').toLowerCase().includes(q) ||
        (it.reason || '').toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const stats = useMemo(() => {
    const pending = items.filter(i => i.status === 'pending').length;
    const revised = items.filter(i => i.status === 'revised').length;
    const critical = items.filter(i => i.urgency === 'critical' && i.status === 'pending').length;
    return { pending, revised, critical };
  }, [items]);

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (urgencyFilter !== 'all' ? 1 : 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Pengadaan Barang"
        subtitle={`${total ?? items.length} pengajuan`}
        onBack={goBack}
        rightAction={navigate ? () => navigate('kasir_stok_bahan', { tab: 'stok' }) : undefined}
        rightIcon={<span style={{ fontSize: 18 }} title="Lihat Stok">📦</span>}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Hero info banner */}
        <div style={{
          background: stats.critical > 0
            ? 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)'
            : 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
          borderRadius: 16, padding: '14px 16px', marginBottom: 12,
          color: 'white', boxShadow: '0 4px 12px rgba(249,115,22,0.18)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, letterSpacing: 0.4, opacity: 0.9 }}>
              📦 PENGADAAN BARANG
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <Stat icon="⏳" value={stats.pending} label="Pending" />
              <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
              <Stat icon="↩️" value={stats.revised} label="Revisi" />
              <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
              <Stat icon="🚨" value={stats.critical} label="Kritis" />
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => setShowForm(true)}
          style={{
            width: '100%', padding: '14px', borderRadius: 14,
            border: 'none', background: C.primary, color: 'white',
            fontFamily: 'Poppins', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', marginBottom: 14,
            boxShadow: '0 4px 12px rgba(91,0,95,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>+</span> Buat Pengajuan Baru
        </button>

        {activeFilterCount > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10,
            padding: '8px 10px', borderRadius: 10,
            background: `${C.primary}08`, border: `1px solid ${C.primary}22`,
          }}>
            {statusFilter !== 'all' && (
              <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, background: 'white', padding: '3px 8px', borderRadius: 999 }}>
                📌 {STATUS_META[statusFilter]?.label || statusFilter}
              </span>
            )}
            {urgencyFilter !== 'all' && (
              <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, background: 'white', padding: '3px 8px', borderRadius: 999 }}>
                {URGENCY_META[urgencyFilter]?.icon} {URGENCY_META[urgencyFilter]?.label}
              </span>
            )}
          </div>
        )}

        <SearchFilterRow
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari barang, merek, alasan..."
          onFilterClick={() => setShowFilter(true)}
          activeFilterCount={activeFilterCount}
        />

        {/* List */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Memuat…</div>
        )}

        {!loading && fetchError && (
          <div style={{
            textAlign: 'center', padding: '24px 16px', marginBottom: 12,
            background: '#FEF2F2', borderRadius: 12, border: '1px solid #FECACA',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#991B1B', marginBottom: 12 }}>
              {fetchError}
            </div>
            <button
              onClick={() => fetchData(true)}
              style={{
                padding: '8px 16px', borderRadius: 10,
                border: 'none', background: C.primary, color: 'white',
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Coba Lagi
            </button>
          </div>
        )}

        {!loading && !fetchError && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 50 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>
              {search || activeFilterCount > 0 ? 'Tidak ada hasil sesuai filter.' : 'Belum ada pengajuan barang.'}
            </div>
          </div>
        )}

        {!loading && !fetchError && filtered.map(it => (
          <RequestCard key={it.id} item={it} onEdit={() => setEditTarget(it)} />
        ))}
      </div>

      {showForm && (
        <RequestForm
          inventoryItems={inventoryItems}
          preselectedItem={preselectedItem}
          onClose={() => { setShowForm(false); if (navigate) navigate('dashboard'); }}
          onSuccess={() => { setShowForm(false); fetchData(true); }}
        />
      )}

      {editTarget && (
        <RequestForm
          inventoryItems={inventoryItems}
          editing={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); fetchData(true); }}
        />
      )}

      {showFilter && (
        <FilterModal
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          urgencyFilter={urgencyFilter}
          setUrgencyFilter={setUrgencyFilter}
          onClose={() => setShowFilter(false)}
          onReset={() => { setStatusFilter('all'); setUrgencyFilter('all'); setSearch(''); }}
        />
      )}
    </div>
  );
}

function Stat({ icon, value, label }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: 'white' }}>{value}</span>
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 1 }}>{label}</div>
    </div>
  );
}

function RequestCard({ item: it, onEdit }) {
  const urg = URGENCY_META[it.urgency] || URGENCY_META.normal;
  const st = STATUS_META[it.status] || STATUS_META.pending;
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '12px 14px', marginBottom: 10,
      boxShadow: it.status === 'revised'
        ? '0 2px 8px rgba(245,158,11,0.18)'
        : '0 1px 4px rgba(15,23,42,0.05)',
      borderLeft: `4px solid ${it.status === 'revised' ? '#F59E0B' : urg.color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>
            {it.itemName} {it.brand ? <span style={{ color: C.n600, fontWeight: 500 }}>· {it.brand}</span> : null}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
            {it.qty} {it.unit}
            {it.approvedQty != null && it.approvedQty !== it.qty && (
              <span style={{ color: C.primary, fontWeight: 600 }}> · disetujui {it.approvedQty} {it.unit}</span>
            )}
            {it.estimatedPrice && ` · Estimasi: ${rp(it.estimatedPrice)}`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <span style={{
            fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
            padding: '2px 7px', borderRadius: 999,
            background: urg.bg, color: urg.fg,
          }}>{urg.icon} {urg.label}</span>
          <span style={{
            fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
            padding: '2px 7px', borderRadius: 999,
            background: st.bg, color: st.fg,
          }}>{st.icon} {st.label}</span>
        </div>
      </div>

      <div style={{ background: C.n50, borderRadius: 8, padding: '6px 10px', marginTop: 8, fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>
        💬 {it.reason}
      </div>

      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 6 }}>
        {fmtDate(it.createdAt)} · {it.requesterName}
        {it.approverName && ` · Diproses oleh ${it.approverName}`}
        {it.fulfillerName && ` · Dibeli oleh ${it.fulfillerName}`}
      </div>

      {/* Banner catatan admin (revisi/tolak/approve) */}
      {it.adminNote && (
        <div style={{
          background: it.status === 'revised' ? '#FEF3C7' : it.status === 'rejected' ? '#FEE2E2' : '#EFF6FF',
          borderLeft: `3px solid ${it.status === 'revised' ? '#F59E0B' : it.status === 'rejected' ? '#DC2626' : '#3B82F6'}`,
          borderRadius: 6, padding: '8px 10px', marginTop: 8,
          fontFamily: 'Poppins', fontSize: 11, color: '#1E293B', lineHeight: 1.5,
        }}>
          📝 <strong>Catatan admin:</strong> {it.adminNote}
        </div>
      )}

      {it.status === 'fulfilled' && it.fulfilledAmount && (
        <div style={{ background: '#DCFCE7', borderRadius: 6, padding: '4px 8px', marginTop: 6, fontFamily: 'Poppins', fontSize: 10, color: '#15803D' }}>
          💸 Dibeli {rp(it.fulfilledAmount)}
        </div>
      )}

      {/* Tombol edit & resubmit untuk yang status revised */}
      {it.status === 'revised' && (
        <button
          onClick={onEdit}
          style={{
            width: '100%', marginTop: 10, padding: '10px',
            background: '#F59E0B', color: 'white',
            border: 'none', borderRadius: 10,
            fontFamily: 'Poppins', fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          ✏️ Edit & Kirim Ulang
        </button>
      )}
    </div>
  );
}

function FilterModal({ statusFilter, setStatusFilter, urgencyFilter, setUrgencyFilter, onClose, onReset }) {
  const chip = (active, color) => ({
    padding: '8px 10px', borderRadius: 10,
    border: `1.5px solid ${active ? color : C.n200}`,
    background: active ? `${color}10` : 'white',
    fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500,
    color: active ? color : C.n700,
    cursor: 'pointer', textAlign: 'center',
  });
  return (
    <Modal visible onClose={onClose} title="Filter Pengajuan">
      <div style={{ padding: '8px 18px 18px' }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>
          🚨 Tingkat Urgensi
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
          <button onClick={() => setUrgencyFilter('all')} style={chip(urgencyFilter === 'all', C.primary)}>Semua</button>
          {Object.entries(URGENCY_META).map(([k, m]) => (
            <button key={k} onClick={() => setUrgencyFilter(k)} style={chip(urgencyFilter === k, m.color)}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>
          🏷️ Status
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button onClick={() => setStatusFilter('all')} style={chip(statusFilter === 'all', C.primary)}>Semua</button>
          {Object.entries(STATUS_META).slice(0, 4).map(([k, m]) => (
            <button key={k} onClick={() => setStatusFilter(k)} style={chip(statusFilter === k, C.primary)}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Btn variant="secondary" onClick={() => { onReset(); onClose(); }} style={{ flex: 1 }}>Reset</Btn>
          <Btn variant="primary" onClick={onClose} style={{ flex: 1 }}>Terapkan</Btn>
        </div>
      </div>
    </Modal>
  );
}

function RequestForm({ inventoryItems, onClose, onSuccess, editing = null, preselectedItem = null }) {
  const isEditing = !!editing;
  const [inventoryId, setInventoryId] = useState(editing?.inventoryId ? String(editing.inventoryId) : preselectedItem ? String(preselectedItem.id) : '');
  const [itemName, setItemName] = useState(editing?.itemName || preselectedItem?.name || '');
  const [brand, setBrand] = useState(editing?.brand || '');
  const [qty, setQty] = useState(editing?.qty != null ? String(editing.qty) : preselectedItem ? String(Math.max(1, Math.ceil(2 * Number(preselectedItem.minStock || 0) - Number(preselectedItem.stockQty || 0)))) : '');
  const [unit, setUnit] = useState(editing?.unit || preselectedItem?.unit || 'pcs');
  const [estimatedPrice, setEstimatedPrice] = useState(editing?.estimatedPrice != null ? String(editing.estimatedPrice) : '');
  const [urgency, setUrgency] = useState(editing?.urgency || preselectedItem?.lowStock ? 'urgent' : 'normal');
  const [reason, setReason] = useState(editing?.reason || preselectedItem ? `Stok ${preselectedItem.name} tinggal ${preselectedItem.stockQty} ${preselectedItem.unit || 'pcs'} — minimum ${preselectedItem.minStock || 0}. Butuh tambahan segera.` : '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inventoryId) return;
    const sel = inventoryItems.find(i => String(i.id) === String(inventoryId));
    if (sel) {
      setItemName(sel.name || '');
      setUnit(sel.unit || 'pcs');
    }
  }, [inventoryId, inventoryItems]);

  const submit = async () => {
    if (!itemName.trim()) { alertWarning('Nama barang wajib.'); return; }
    if (!Number(qty) || Number(qty) <= 0) { alertWarning('Jumlah harus lebih dari 0.'); return; }
    if (!reason.trim()) { alertWarning('Alasan kenapa butuh wajib.'); return; }

    setLoading(true);
    try {
      if (isEditing) {
        await api.patch(`/api/purchase-requests/${editing.id}/resubmit`, {
          itemName: itemName.trim(),
          brand: brand.trim() || null,
          qty: Number(qty),
          unit,
          estimatedPrice: estimatedPrice ? Number(estimatedPrice) : null,
          urgency,
          reason: reason.trim(),
        });
        await alertSuccess('Pengajuan dikirim ulang ke admin.');
      } else {
        await api.post('/api/purchase-requests', {
          inventoryId: inventoryId || null,
          itemName: itemName.trim(),
          brand: brand.trim() || null,
          qty: Number(qty),
          unit,
          estimatedPrice: estimatedPrice ? Number(estimatedPrice) : null,
          urgency,
          reason: reason.trim(),
        });
        await alertSuccess(urgency === 'critical' ? 'Pengajuan kritis dikirim! Admin akan diberi tahu.' : 'Pengajuan barang berhasil dikirim ke admin.');
      }
      onSuccess();
    } catch (err) {
      const msg = err?.response?.data?.message;
      // Tampilkan pesan duplicate dengan link ke pengajuan existing
      if (err?.response?.status === 409) {
        alertError(msg || 'Sudah ada pengajuan untuk item ini.');
      } else {
        alertError(msg || 'Gagal kirim pengajuan barang.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible onClose={onClose} title={isEditing ? 'Edit & Kirim Ulang' : 'Pengajuan Barang Baru'}>
      <div style={{ padding: '8px 18px 18px' }}>
        {isEditing && editing.adminNote && (
          <div style={{
            background: '#FEF3C7', border: '1px solid #FCD34D',
            borderRadius: 10, padding: '10px 12px', marginBottom: 14,
            fontFamily: 'Poppins', fontSize: 11, color: '#92400E', lineHeight: 1.5,
          }}>
            📝 <strong>Catatan admin:</strong><br/>
            {editing.adminNote}
          </div>
        )}

        {!isEditing && (
          <Select
            label="Pilih dari Katalog (opsional)"
            value={inventoryId}
            onChange={setInventoryId}
            options={[
              { value: '', label: '— Tidak dari katalog (free text) —' },
              ...inventoryItems.map(i => ({ value: i.id, label: `${i.name} (${i.unit})` })),
            ]}
          />
        )}

        <Input
          label="Nama Barang *"
          value={itemName}
          onChange={(v) => setItemName(v.replace(/(^|\s)\S/g, c => c.toUpperCase()))}
          placeholder="Mis. Gas LPG 12kg"
        />
        <Input label="Merek / Spec (opsional)" value={brand} onChange={setBrand} placeholder="Mis. Pertamina, Bright" />

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
          <Input label="Qty *" value={qty} onChange={(v) => setQty(v.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="1" />
          <Select
            label="Satuan"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'pcs', label: 'pcs' },
              { value: 'kg', label: 'kg' },
              { value: 'liter', label: 'liter' },
              { value: 'tabung', label: 'tabung' },
              { value: 'box', label: 'box' },
              { value: 'set', label: 'set' },
            ]}
          />
        </div>

        <MoneyInput
          label="Estimasi Harga Total (opsional)"
          value={estimatedPrice}
          onChange={setEstimatedPrice}
          placeholder="250.000"
          hint={estimatedPrice ? `Estimasi total: ${rp(Number(estimatedPrice))}` : 'Boleh dikosongkan kalau belum tau harga'}
        />

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>
            Tingkat Urgensi *
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {Object.entries(URGENCY_META).map(([k, m]) => {
              const active = urgency === k;
              return (
                <button
                  key={k}
                  onClick={() => setUrgency(k)}
                  style={{
                    padding: '8px 6px', borderRadius: 10,
                    border: `1.5px solid ${active ? m.fg : C.n200}`,
                    background: active ? m.bg : 'white',
                    color: active ? m.fg : C.n600,
                    fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{m.icon}</span>
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <Textarea
          label="Alasan / Kebutuhan *"
          value={reason}
          onChange={setReason}
          rows={3}
          placeholder="Mis. Gas habis, butuh untuk setrika uap. Stok terakhir habis kemarin."
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={submit} loading={loading} style={{ flex: 1 }}>
            {isEditing ? 'Kirim Ulang' : 'Kirim Pengajuan'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
