// ─────────────────────────────────────────────────────────────────────────────
// RequestBarangPage — kasir input pengadaan barang (styling revamp)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import api, { withFresh } from '../../utils/api';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, Input, Select, Textarea, useAppRefresh, SearchFilterRow, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import PICSelector from '../../components/PICSelector';
import { usePICSelector } from '../../hooks/usePIC';
import { useResponsive } from '../../utils/hooks';

// ─── Clay Card ────────────────────────────────────────────────────────────────
const ClayCard = ({ children, style, padding = 16 }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
      borderRadius: 20,
      padding: padding,
      boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.08)',
      ...style,
    }}
  >
    {children}
  </motion.div>
);

// ─── Glass Styles ─────────────────────────────────────────────────────────────
const useGlassStyles = () => {
  useEffect(() => {
    const styleId = 'request-barang-glass';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        :root { --glass-bg: #F3EEF7; }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
};

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
  normal:   { label: 'Normal',   bg: C.primary + '10', fg: C.primary, color: C.primary, icon: '📋' },
  urgent:   { label: 'Urgent',   bg: C.warning + '15', fg: C.warning, color: C.warning, icon: '⚠️' },
  critical: { label: 'Kritis',   bg: C.danger + '10', fg: C.danger, color: C.danger, icon: '🚨' },
};

const STATUS_META = {
  pending:   { label: 'Menunggu', bg: C.warning + '15', fg: C.warning, icon: '⏳' },
  revised:   { label: 'Revisi', bg: C.warning + '15', fg: C.warning, icon: '↩️' },
  approved:  { label: 'Disetujui', bg: C.primary + '10', fg: C.primary, icon: '✅' },
  fulfilled: { label: 'Selesai', bg: C.success + '15', fg: C.success, icon: '🎉' },
  rejected:  { label: 'Ditolak', bg: C.danger + '10', fg: C.danger, icon: '❌' },
  cancelled: { label: 'Batal', bg: C.n100, fg: C.n600, icon: '⊘' },
};

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
};

export default function RequestBarangPage({ goBack, navigate, preselectedItem }) {
  useGlassStyles();
  const { isMobile } = useResponsive();
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

  useEffect(() => {
    if (preselectedItem) setShowForm(true);
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
    } finally {
      setLoading(false);
    }
  }, [statusFilter, urgencyFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAppRefresh(() => fetchData(true), [fetchData]);

  useEffect(() => {
    api.get('/api/inventory/items').then(r => {
      setInventoryItems(r?.data?.data || []);
    }).catch(() => {});
  }, []);

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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg, #F3EEF7)', overflow: 'hidden' }}>
      <TopBar
        title="Pengadaan Barang"
        subtitle={`${total ?? items.length} pengajuan`}
        onBack={goBack}
        rightAction={navigate ? () => navigate('kasir_stok_bahan', { tab: 'stok' }) : undefined}
        rightIcon={<span style={{ fontSize: 18 }} title="Lihat Stok">📦</span>}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 16, paddingBottom: isMobile ? 100 : 16 }}>

        {/* Hero info banner */}
        <div style={{
          background: stats.critical > 0
            ? `linear-gradient(145deg, ${C.danger}, ${C.dangerDark})`
            : `linear-gradient(145deg, ${C.primary}, ${C.primaryDark})`,
          borderRadius: 20,
          padding: '16px 20px',
          marginBottom: 12,
          color: 'white',
          boxShadow: `0 4px 12px ${C.primary}30`,
        }}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 11, fontWeight: 600, opacity: 0.9 }}>
            PENGADAAN BARANG
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <Stat icon="⏳" value={stats.pending} label="Pending" />
            <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
            <Stat icon="↩️" value={stats.revised} label="Revisi" />
            <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
            <Stat icon="🚨" value={stats.critical} label="Kritis" />
          </div>
        </div>

        {/* CTA */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(true)}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            border: 'none',
            background: `linear-gradient(145deg, ${C.primary}, ${C.primaryDark})`,
            color: 'white',
            fontFamily: "'Poppins'",
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 12,
            boxShadow: '-4px -4px 10px rgba(255, 255, 255, 0.3), 5px 6px 14px rgba(59, 11, 71, 0.3)',
          }}
        >
          + Buat Pengajuan Baru
        </motion.button>

        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, padding: '8px 10px', borderRadius: 12, background: `${C.primary}08`, border: `1px solid ${C.primary}22` }}>
            {statusFilter !== 'all' && (
              <span style={{ fontFamily: "'Poppins'", fontSize: 10, fontWeight: 600, color: C.n700, background: C.white, padding: '3px 8px', borderRadius: 999 }}>
                📌 {STATUS_META[statusFilter]?.label || statusFilter}
              </span>
            )}
            {urgencyFilter !== 'all' && (
              <span style={{ fontFamily: "'Poppins'", fontSize: 10, fontWeight: 600, color: C.n700, background: C.white, padding: '3px 8px', borderRadius: 999 }}>
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
          <div style={{ textAlign: 'center', padding: 30, fontFamily: "'Poppins'", fontSize: 12, color: C.n600 }}>Memuat…</div>
        )}

        {!loading && fetchError && (
          <ClayCard padding={20} style={{ marginBottom: 12, background: `${C.danger}08`, border: `1px solid ${C.danger}20` }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.danger, marginBottom: 12 }}>{fetchError}</div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => fetchData(true)}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.primary, color: 'white', fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Coba Lagi
              </motion.button>
            </div>
          </ClayCard>
        )}

        {!loading && !fetchError && filtered.length === 0 && (
          <div style={{ padding: '20px 0' }}>
            <EmptyState
              type="orders"
              title={search || activeFilterCount > 0 ? 'Tidak Ada Hasil' : 'Belum Ada Pengajuan'}
              message={search || activeFilterCount > 0 ? 'Tidak ada pengajuan sesuai filter' : 'Pengajuan barang akan muncul di sini'}
              suggestion="Ajukan barang baru jika stok menipis"
              illustrationSize={100}
            />
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
        <span style={{ fontFamily: "'Poppins'", fontSize: 20, fontWeight: 800, color: 'white' }}>{value}</span>
      </div>
      <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function RequestCard({ item: it, onEdit }) {
  const { isMobile } = useResponsive();
  const urg = URGENCY_META[it.urgency] || URGENCY_META.normal;
  const st = STATUS_META[it.status] || STATUS_META.pending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
        borderRadius: 16,
        padding: isMobile ? 12 : 14,
        marginBottom: 10,
        boxShadow: '6px 6px 16px rgba(110, 46, 120, 0.08), -3px -3px 8px rgba(255, 255, 255, 0.95)',
        border: `1px solid rgba(139, 92, 246, 0.06)`,
        borderLeft: `4px solid ${it.status === 'revised' ? C.warning : urg.color}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Poppins'", fontSize: isMobile ? 12 : 13, fontWeight: 600, color: C.n900 }}>
            {it.itemName} {it.brand ? <span style={{ color: C.n700, fontWeight: 500 }}>· {it.brand}</span> : null}
          </div>
          <div style={{ fontFamily: "'Poppins'", fontSize: isMobile ? 10 : 11, color: C.n700, marginTop: 2 }}>
            {it.qty} {it.unit}
            {it.approvedQty != null && it.approvedQty !== it.qty && (
              <span style={{ color: C.primary, fontWeight: 600 }}> · disetujui {it.approvedQty} {it.unit}</span>
            )}
            {it.estimatedPrice && ` · Estimasi: ${rp(it.estimatedPrice)}`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <span style={{ fontFamily: "'Poppins'", fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: urg.bg, color: urg.fg }}>
            {urg.icon} {urg.label}
          </span>
          <span style={{ fontFamily: "'Poppins'", fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: st.bg, color: st.fg }}>
            {st.icon} {st.label}
          </span>
        </div>
      </div>

      <div style={{ background: C.n50, borderRadius: 10, padding: '8px 12px', marginTop: 10, fontFamily: "'Poppins'", fontSize: 11, color: C.n700 }}>
        💬 {it.reason}
      </div>

      {it.picName && (
        <div style={{ background: `${C.primary}08`, borderRadius: 8, padding: '4px 10px', marginTop: 8, fontFamily: "'Poppins'", fontSize: 10, color: C.primary, display: 'flex', alignItems: 'center', gap: 4 }}>
          👤 PIC: <strong>{it.picName}</strong>
        </div>
      )}

      <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n500, marginTop: 8 }}>
        {fmtDate(it.createdAt)} · {it.requesterName}
        {it.approverName && ` · Diproses oleh ${it.approverName}`}
        {it.fulfillerName && ` · Dibeli oleh ${it.fulfillerName}`}
      </div>

      {it.adminNote && (
        <div style={{
          background: it.status === 'revised' ? `${C.warning}10` : it.status === 'rejected' ? `${C.danger}08` : `${C.primary}08`,
          borderLeft: `3px solid ${it.status === 'revised' ? C.warning : it.status === 'rejected' ? C.danger : C.primary}`,
          borderRadius: 8, padding: '8px 10px', marginTop: 10,
          fontFamily: "'Poppins'", fontSize: 11, color: C.n800, lineHeight: 1.5,
        }}>
          📝 <strong>Catatan admin:</strong> {it.adminNote}
        </div>
      )}

      {it.status === 'fulfilled' && it.fulfilledAmount && (
        <div style={{ background: `${C.success}10`, borderRadius: 8, padding: '4px 10px', marginTop: 8, fontFamily: "'Poppins'", fontSize: 10, color: C.success }}>
          💸 Dibeli {rp(it.fulfilledAmount)}
        </div>
      )}

      {it.status === 'revised' && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onEdit}
          style={{
            width: '100%', marginTop: 12, padding: '10px',
            background: `linear-gradient(145deg, ${C.warning}, ${C.warningDark})`,
            color: 'white', border: 'none', borderRadius: 12,
            fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ✏️ Edit & Kirim Ulang
        </motion.button>
      )}
    </motion.div>
  );
}

function FilterModal({ statusFilter, setStatusFilter, urgencyFilter, setUrgencyFilter, onClose, onReset }) {
  const { isMobile } = useResponsive();

  return (
    <Modal visible onClose={onClose} title="Filter Pengajuan">
      <div style={{ padding: '8px 18px 18px' }}>
        <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 10 }}>
          Tingkat Urgensi
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[{ k: 'all', label: 'Semua', color: C.primary }, ...Object.entries(URGENCY_META)].map(([k, m]) => {
            const meta = typeof m === 'object' ? m : URGENCY_META.normal;
            const key = k === 'all' ? 'all' : k;
            const isActive = key === (urgencyFilter === 'all' ? 'all' : urgencyFilter);
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setUrgencyFilter(key)}
                style={{
                  padding: '8px 6px',
                  borderRadius: 10,
                  border: `1.5px solid ${isActive ? meta.color : C.n200}`,
                  background: isActive ? `${meta.color}15` : C.white,
                  fontFamily: "'Poppins'", fontSize: 11, fontWeight: isActive ? 700 : 500,
                  color: isActive ? meta.color : C.n700,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {key === 'all' ? meta.label : (meta.icon + ' ' + meta.label)}
              </motion.button>
            );
          })}
        </div>

        <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 10 }}>
          Status
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[{ k: 'all', label: 'Semua' }, ...Object.entries(STATUS_META)].map(([k, m]) => {
            const meta = typeof m === 'object' ? m : STATUS_META.pending;
            const key = k === 'all' ? 'all' : k;
            const isActive = key === (statusFilter === 'all' ? 'all' : statusFilter);
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setStatusFilter(key)}
                style={{
                  padding: '8px 6px',
                  borderRadius: 10,
                  border: `1.5px solid ${isActive ? C.primary : C.n200}`,
                  background: isActive ? `${C.primary}15` : C.white,
                  fontFamily: "'Poppins'", fontSize: 10, fontWeight: isActive ? 700 : 500,
                  color: isActive ? C.primary : C.n700,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {key === 'all' ? meta.label : (meta.icon + ' ' + meta.label)}
              </motion.button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Btn variant="secondary" onClick={() => { onReset(); onClose(); }} style={{ flex: 1 }}>Reset</Btn>
          <Btn variant="primary" onClick={onClose} style={{ flex: 1 }}>Terapkan</Btn>
        </div>
      </div>
    </Modal>
  );
}

function RequestForm({ inventoryItems, onClose, onSuccess, editing = null, preselectedItem = null }) {
  const { isMobile } = useResponsive();
  const isEditing = !!editing;

  const {
    currentPIC,
    setCurrentPIC,
    availableUsers,
    refreshUsers,
    isLoading: picLoading,
  } = usePICSelector();

  useEffect(() => { refreshUsers(); }, [refreshUsers]);

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
      const picId = currentPIC?.id || editing?.picId || null;
      const picName = currentPIC?.name || editing?.picName || null;

      if (isEditing) {
        await api.patch(`/api/purchase-requests/${editing.id}/resubmit`, {
          itemName: itemName.trim(),
          brand: brand.trim() || null,
          qty: Number(qty),
          unit,
          estimatedPrice: estimatedPrice ? Number(estimatedPrice) : null,
          urgency,
          reason: reason.trim(),
          picId,
          picName,
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
          picId,
          picName,
        });
        await alertSuccess(urgency === 'critical' ? 'Pengajuan kritis dikirim! Admin akan diberi tahu.' : 'Pengajuan barang berhasil dikirim ke admin.');
      }
      onSuccess();
    } catch (err) {
      const msg = err?.response?.data?.message;
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
            background: `${C.warning}10`, border: `1px solid ${C.warning}30`,
            borderRadius: 12, padding: '10px 12px', marginBottom: 14,
            fontFamily: "'Poppins'", fontSize: 11, color: C.n700, lineHeight: 1.5,
          }}>
            📝 <strong>Catatan admin:</strong><br />{editing.adminNote}
          </div>
        )}

        {!isEditing && (
          <>
            <PICSelector currentPIC={currentPIC} onChange={setCurrentPIC} users={availableUsers} loading={picLoading} />
            <div style={{ height: 12 }} />
          </>
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

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 8 }}>
          <Input label="Qty *" value={qty} onChange={(v) => setQty(v.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="1" style={{ width: '100%' }} />
          <Select
            label="Satuan"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'pcs', label: 'pcs' }, { value: 'kg', label: 'kg' },
              { value: 'liter', label: 'liter' }, { value: 'tabung', label: 'tabung' },
              { value: 'box', label: 'box' }, { value: 'set', label: 'set' },
            ]}
            style={{ width: '100%' }}
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
          <div style={{ fontFamily: "'Poppins'", fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>
            Tingkat Urgensi *
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {Object.entries(URGENCY_META).map(([k, m]) => {
              const active = urgency === k;
              return (
                <motion.button
                  key={k}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setUrgency(k)}
                  style={{
                    padding: '10px 6px',
                    borderRadius: 12,
                    border: `1.5px solid ${active ? m.color : C.n200}`,
                    background: active ? `${m.color}15` : C.white,
                    color: active ? m.color : C.n700,
                    fontFamily: "'Poppins'", fontSize: 11, fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{m.icon}</span>
                  {m.label}
                </motion.button>
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

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={submit} loading={loading} style={{ flex: 1 }}>
            {isEditing ? 'Kirim Ulang' : 'Kirim Pengajuan'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
