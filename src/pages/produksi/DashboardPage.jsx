import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { STAGES } from '../../utils/helpers';
import { Avatar, Badge, Btn } from '../../components/ui';
import { alertInfo } from '../../utils/alert';

// ── Helpers ────────────────────────────────────────────────────────────────────
const getSLAInfo = (estimatedDoneAt, isExpress) => {
  if (!estimatedDoneAt) return null;
  const now = Date.now();
  const due = new Date(estimatedDoneAt).getTime();
  const diffMin = Math.round((due - now) / 60000);
  if (diffMin < 0) return { label: `Telat ${Math.abs(diffMin)} mnt`, level: 'overdue' };
  if (diffMin < 120) return { label: `${diffMin} mnt lagi`, level: 'urgent' };
  if (diffMin < 360) return { label: `${Math.round(diffMin / 60)} jam lagi`, level: 'warning' };
  return { label: `${Math.round(diffMin / 60)} jam lagi`, level: 'ok' };
};

const SLA_COLORS = {
  overdue: { bg: '#FEE2E2', text: '#991B1B', dot: C.danger },
  urgent:  { bg: '#FEF3C7', text: '#92400E', dot: C.warning },
  warning: { bg: '#EFF6FF', text: '#1E40AF', dot: '#3B82F6' },
  ok:      { bg: '#ECFDF5', text: '#065F46', dot: C.success },
};

function getCurrentStageLabel(progress) {
  const doneStages = (progress || []).map(p => p.stage);
  const next = STAGES.find(s => !doneStages.includes(s));
  return next || 'Selesai';
}

function getProgressPercent(progress) {
  const done = (progress || []).length;
  return Math.round((done / STAGES.length) * 100);
}

// ── Item Sub-Row (satu layanan di dalam nota) ─────────────────────────────────
function ItemSubRow({ item, onPress }) {
  const isDone = item.isDone;
  const stage = item.currentStage;
  const pct = Math.round((item.progress.length / STAGES.length) * 100);
  return (
    <button
      onClick={e => { e.stopPropagation(); onPress(item); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 10px', borderRadius: 10, marginBottom: 5,
        border: `1.5px solid ${isDone ? '#10B981' : '#E2E8F0'}`,
        background: isDone ? '#F0FDF4' : '#F8FAFC',
        cursor: 'pointer', width: '100%', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{STAGE_ICONS[stage] || '⬜'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: isDone ? '#065F46' : '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.name}{item.isExpress ? ' ⚡' : ''}
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#64748B', marginTop: 1 }}>
          {item.qty} {item.unit} · {isDone ? '✅ Selesai' : stage}
        </div>
        <div style={{ height: 3, background: '#E2E8F0', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: isDone ? '#10B981' : '#5B005F', borderRadius: 2, transition: 'width 0.4s' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        {STAGES.map(s => {
          const done = item.progress.some(p => p.stage === s);
          const cur = s === stage;
          return <div key={s} style={{ width: 5, height: 5, borderRadius: '50%', background: done ? '#5B005F' : cur ? '#C084FC' : '#E2E8F0' }} />;
        })}
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  );
}

const STAGE_ICONS = {
  'Diterima': '📥',
  'Cuci': '🫧',
  'Pengeringan': '💨',
  'Setrika': '♨️',
  'Packing': '📦',
  'Selesai': '✅',
};

// ── SLA Alert Banner ──────────────────────────────────────────────────────────
function SLABanner({ transactions }) {
  const urgent = transactions.filter(tx => {
    if (!tx.estimatedDoneAt) return false;
    const diff = (new Date(tx.estimatedDoneAt) - Date.now()) / 60000;
    return diff < 120;
  });
  if (urgent.length === 0) return null;
  return (
    <div style={{ background: '#FEF3C7', borderBottom: '2px solid #F59E0B', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 20 }}>⚠️</span>
      <div>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#92400E' }}>
          {urgent.length} order hampir telat!
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#92400E', opacity: 0.8 }}>
          {urgent.map(t => t.customerName).join(', ')} · segera selesaikan
        </div>
      </div>
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({ tx, onItemPress }) {
  const items = tx.items || [];
  const allDone = items.length > 0 && items.every(i => i.isDone);
  const anyExpress = tx.isExpress || items.some(i => i.isExpress);
  const sla = getSLAInfo(tx.estimatedDoneAt, anyExpress);
  const slaC = sla ? SLA_COLORS[sla.level] : null;
  const doneCount = items.filter(i => i.isDone).length;

  const borderColor = allDone ? '#10B981'
    : sla?.level === 'overdue' ? '#EF4444'
    : sla?.level === 'urgent'  ? '#F59E0B'
    : C.n200;

  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '12px 12px 8px',
      boxShadow: '0 2px 10px rgba(15,23,42,0.07)',
      border: `2px solid ${borderColor}`,
      position: 'relative',
    }}>
      {/* Header nota */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Avatar initials={tx.customerName?.split(' ').map(w => w[0]).join('').slice(0, 2)} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900, display: 'flex', alignItems: 'center', gap: 6 }}>
            {tx.customerName}
            {anyExpress && <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999 }}>⚡ EXPRESS</span>}
            {tx.pickupType === 'delivery' && <span style={{ background: '#EDE9FE', color: '#5B21B6', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>🚗 Antar</span>}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{tx.id} · {tx.date}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {sla && (
            <div style={{ background: slaC.bg, padding: '2px 8px', borderRadius: 999, marginBottom: 2 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: slaC.text }}>{sla.label}</span>
            </div>
          )}
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: allDone ? '#10B981' : C.n500, fontWeight: 600 }}>
            {doneCount}/{items.length} selesai
          </div>
        </div>
      </div>

      {/* Per-item rows */}
      <div>
        {items.map(item => (
          <ItemSubRow key={item.itemId} item={item} onPress={item => onItemPress(tx, item)} />
        ))}
        {items.length === 0 && (
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n400, textAlign: 'center', padding: '8px 0' }}>Belum ada layanan</div>
        )}
      </div>

      {tx.notes && (
        <div style={{ marginTop: 6, padding: '5px 10px', background: '#FEF3C7', borderRadius: 8 }}>
          <span style={{ fontFamily: 'Poppins', fontSize: 10, color: '#92400E' }}>📝 {tx.notes}</span>
        </div>
      )}
    </div>
  );
}

// ── Stats bar ────────────────────────────────────────────────────────────────
function StatsBar({ transactions }) {
  const byStage = {};
  STAGES.forEach(s => byStage[s] = 0);

  // Hitung per-layanan (per item), bukan per nota
  transactions.forEach(tx => {
    (tx.items || []).forEach(item => {
      const stage = item.currentStage || 'Diterima';
      if (byStage[stage] !== undefined) byStage[stage]++;
      else byStage['Selesai'] = (byStage['Selesai'] || 0) + 1;
    });
  });

  const active = STAGES.slice(0, -1); // exclude 'Selesai'
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px 10px' }}>
      {active.map(s => (
        <div key={s} style={{ flexShrink: 0, background: 'white', borderRadius: 10, padding: '6px 10px', textAlign: 'center', minWidth: 54, boxShadow: '0 1px 6px rgba(15,23,42,0.07)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 8, marginBottom: 2 }}>{STAGE_ICONS[s]}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: byStage[s] > 0 ? C.primary : C.n400 }}>{byStage[s]}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 8, color: C.n500, fontWeight: 500 }}>{s}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function ProduksiDashboardPage({ user, navigate }) {
  const [filter, setFilter] = useState('aktif');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  
  const [workstation, setWorkstation] = useState(() => localStorage.getItem('produksi_workstation') || 'Semua');
  const prevTxIds = useRef(new Set());

  const handleWorkstationChange = (ws) => {
    setWorkstation(ws);
    localStorage.setItem('produksi_workstation', ws);
  };

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) { setError(null); setLoading(true); }
    try {
      const res = await axios.get('/api/transactions/production/queue');
      const data = res?.data?.data || [];
      
      if (silent && data.length > 0) {
        const currentIds = new Set(data.map(t => t.id));
        const hasNew = data.some(t => !prevTxIds.current.has(t.id) && t.status === 'baru');
        if (hasNew && prevTxIds.current.size > 0) {
          alertInfo('Cucian baru saja ditambahkan oleh kasir.', { title: 'Order Baru Masuk!' });
          try {
            // Coba play notifikasi suara jika browser mengizinkan
            const audio = new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
            audio.play().catch(() => {});
          } catch(e) {}
        }
        prevTxIds.current = currentIds;
      } else if (!silent) {
        prevTxIds.current = new Set(data.map(t => t.id));
      }

      setTransactions(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch production queue:', error);
      if (!silent) setError('Gagal memuat data. Tap untuk coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    // Auto-refresh tiap 30 detik (polling — ramah untuk SDM yang tidak tahu ada order baru)
    const interval = setInterval(() => fetchQueue(true), 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Nota aktif = masih ada item yang belum selesai
  const allActive = transactions.filter(t => {
    const items = t.items || [];
    return items.length === 0 || !items.every(i => i.isDone);
  });
  // Nota selesai = semua item selesai
  const allDone = transactions.filter(t => {
    const items = t.items || [];
    return items.length > 0 && items.every(i => i.isDone);
  });
  // Total layanan aktif (untuk stats badge di header)
  const activeItemCount = allActive.reduce((s, t) => s + (t.items || []).filter(i => !i.isDone).length, 0);

  const displayList = filter === 'aktif'  ? allActive
                    : filter === 'selesai' ? allDone
                    : transactions;

  const urgentCount = allActive.filter(tx => {
    if (!tx.estimatedDoneAt) return false;
    return (new Date(tx.estimatedDoneAt) - Date.now()) / 60000 < 120;
  }).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, #0C4A6E, #075985)`, padding: '16px 20px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
              🏭 Tim Produksi · {user?.outlet?.name || user?.outletName || 'Outlet'}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color: 'white', marginTop: 2 }}>
              Hai, {user?.name?.split(' ')[0]} 👋
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 999 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: 'white' }}>
                  {allActive.length} nota · {activeItemCount} layanan
                </span>
              </div>
              {urgentCount > 0 && (
                <div style={{ background: '#FEF3C7', padding: '3px 10px', borderRadius: 999 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: '#92400E' }}>
                    ⚠️ {urgentCount} hampir telat
                  </span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Avatar photo={user?.photo} initials={user?.avatar} size={42} onClick={() => navigate('profil')} />
            <button
              onClick={() => fetchQueue()}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 999, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 10, color: 'white', fontWeight: 600 }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
        
        {/* Workstation Selector */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>Stasiun Kerja Anda:</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {['Semua', 'Cuci', 'Pengeringan', 'Setrika', 'Packing'].map(ws => (
              <button
                key={ws}
                onClick={() => handleWorkstationChange(ws)}
                style={{
                  padding: '6px 12px', borderRadius: 999, border: 'none', flexShrink: 0,
                  background: workstation === ws ? 'white' : 'rgba(255,255,255,0.15)',
                  color: workstation === ws ? C.primary : 'white',
                  fontFamily: 'Poppins', fontSize: 12, fontWeight: workstation === ws ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {ws}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SLA Alert */}
      <SLABanner transactions={allActive} />

      {/* Stats bar */}
      <div style={{ paddingTop: 12, background: C.n50 }}>
        <StatsBar transactions={allActive} />
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 10px', flexShrink: 0 }}>
        {[
          { key: 'aktif',   label: `Aktif (${allActive.length})` },
          { key: 'selesai', label: `Selesai (${allDone.length})` },
          { key: 'semua',   label: 'Semua' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${filter === f.key ? C.primary : C.n300}`,
              background: filter === f.key ? C.primaryLight : 'white',
              color: filter === f.key ? C.primary : C.n600,
              fontFamily: 'Poppins', fontSize: 12, fontWeight: filter === f.key ? 700 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => navigate('kasir_stok_bahan')}
          style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 999, border: `1px solid ${C.n200}`, background: 'white', color: C.n700, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          📦 Stok
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>
            Memuat antrian... 🔄
          </div>
        )}
        {!loading && error && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>Gagal Memuat Data</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{error}</div>
            <Btn variant="primary" onClick={() => fetchQueue()} style={{ marginTop: 8 }}>Coba Lagi</Btn>
          </div>
        )}
        {!loading && !error && displayList.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900, marginBottom: 4 }}>
              {filter === 'aktif' ? 'Tidak ada antrian aktif!' : 'Belum ada data'}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>
              {filter === 'aktif' ? 'Semua cucian sudah selesai atau belum ada order masuk.' : ''}
            </div>
            {lastRefresh && (
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n400, marginTop: 12 }}>
                Diperbarui: {lastRefresh.toLocaleTimeString('id-ID')}
              </div>
            )}
          </div>
        )}
        {!loading && !error && displayList.map(tx => (
          <OrderCard
            key={tx.id}
            tx={tx}
            onItemPress={(t, item) => navigate('detail_item_produksi', { ...t, item })}
          />
        ))}
        {lastRefresh && displayList.length > 0 && (
          <div style={{ textAlign: 'center', fontFamily: 'Poppins', fontSize: 10, color: C.n400, padding: '4px 0 32px' }}>
            Diperbarui otomatis · {lastRefresh.toLocaleTimeString('id-ID')} · refresh tiap 30 detik
          </div>
        )}
      </div>


      <style>{`
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

