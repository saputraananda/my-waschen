import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { STAGES } from '../../utils/helpers';
import { Avatar, Badge } from '../../components/ui';

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
  overdue: { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
  urgent:  { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  warning: { bg: '#EFF6FF', text: '#1E40AF', dot: '#3B82F6' },
  ok:      { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
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
function OrderCard({ tx, onPress }) {
  const sla = getSLAInfo(tx.estimatedDoneAt, tx.isExpress);
  const slaC = sla ? SLA_COLORS[sla.level] : null;
  const currentStage = getCurrentStageLabel(tx.progress);
  const pct = getProgressPercent(tx.progress);
  const done = pct === 100;

  const borderColor = done ? '#10B981'
    : sla?.level === 'overdue' ? '#EF4444'
    : sla?.level === 'urgent'  ? '#F59E0B'
    : C.n200;

  return (
    <div
      onClick={() => onPress(tx)}
      style={{
        background: 'white', borderRadius: 16, padding: '14px 14px 12px',
        boxShadow: '0 2px 10px rgba(15,23,42,0.07)',
        border: `2px solid ${borderColor}`,
        cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s',
        position: 'relative', overflow: 'hidden',
      }}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.98)'}
      onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {/* Express badge */}
      {tx.isExpress && (
        <div style={{ position: 'absolute', top: 10, right: 10, background: '#FEF3C7', color: '#92400E', fontFamily: 'Poppins', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
          ⚡ EXPRESS
        </div>
      )}

      {/* Customer info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, marginRight: tx.isExpress ? 80 : 0 }}>
        <Avatar initials={tx.customerName?.split(' ').map(w => w[0]).join('').slice(0, 2)} size={38} />
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>{tx.customerName}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>{tx.id} · {tx.date}</div>
        </div>
      </div>

      {/* Current stage prominent */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: done ? '#ECFDF5' : '#EFF6FF', borderRadius: 10 }}>
        <span style={{ fontSize: 20 }}>{STAGE_ICONS[currentStage] || '⬜'}</span>
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, fontWeight: 500 }}>TAHAP SEKARANG</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: done ? '#065F46' : C.primary }}>{currentStage}</div>
        </div>
        {sla && (
          <div style={{ marginLeft: 'auto', background: slaC.bg, padding: '3px 10px', borderRadius: 999 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: slaC.text }}>{sla.label}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: C.n100, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: done ? '#10B981' : `linear-gradient(90deg, ${C.primaryLight}, ${C.primary})`,
          borderRadius: 3, transition: 'width 0.6s ease',
        }} />
      </div>

      {/* Stage dots */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
        {STAGES.map(s => {
          const isDone = (tx.progress || []).some(p => p.stage === s);
          const isCurrent = s === currentStage;
          return (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 4, borderRadius: 2,
                background: isDone ? C.primary : isCurrent ? C.primaryLight : C.n100,
                marginBottom: 2,
              }} />
              <div style={{ fontFamily: 'Poppins', fontSize: 8, color: isDone ? C.primary : C.n400, fontWeight: isDone ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</div>
            </div>
          );
        })}
      </div>

      {/* Notes */}
      {tx.notes && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: '#FEF3C7', borderRadius: 8 }}>
          <span style={{ fontFamily: 'Poppins', fontSize: 10, color: '#92400E' }}>📝 {tx.notes}</span>
        </div>
      )}

      {/* Pickup type */}
      {tx.pickupType === 'delivery' && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: 'Poppins', fontSize: 10, color: '#7C3AED', fontWeight: 600 }}>🚗 Dikirim ke customer</span>
        </div>
      )}
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ transactions }) {
  const byStage = {};
  STAGES.forEach(s => byStage[s] = 0);

  transactions.forEach(tx => {
    const stage = getCurrentStageLabel(tx.progress);
    if (byStage[stage] !== undefined) byStage[stage]++;
    else byStage['Selesai'] = (byStage['Selesai'] || 0) + 1;
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
  const [lastRefresh, setLastRefresh] = useState(null);
  
  const [workstation, setWorkstation] = useState(() => localStorage.getItem('produksi_workstation') || 'Semua');
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const prevTxIds = useRef(new Set());

  const handleWorkstationChange = (ws) => {
    setWorkstation(ws);
    localStorage.setItem('produksi_workstation', ws);
  };

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get('/api/transactions/production/queue');
      const data = res?.data?.data || [];
      
      if (silent && data.length > 0) {
        const currentIds = new Set(data.map(t => t.id));
        const hasNew = data.some(t => !prevTxIds.current.has(t.id) && t.status === 'baru');
        if (hasNew && prevTxIds.current.size > 0) {
          setNewOrderAlert(true);
          try {
            // Coba play notifikasi suara jika browser mengizinkan
            const audio = new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
            audio.play().catch(() => {});
          } catch(e) {}
          setTimeout(() => setNewOrderAlert(false), 5000);
        }
        prevTxIds.current = currentIds;
      } else if (!silent) {
        prevTxIds.current = new Set(data.map(t => t.id));
      }

      setTransactions(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch production queue:', error);
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

  const allActive = transactions.filter(t => t.status === 'baru' || t.status === 'proses');
  const allDone   = transactions.filter(t => t.status === 'selesai');

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
                  {allActive.length} aktif
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

      {/* New Order Notification */}
      {newOrderAlert && (
        <div style={{ background: '#10B981', color: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'absolute', top: 16, left: 16, right: 16, borderRadius: 12, zIndex: 100, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)', animation: 'slideDown 0.3s ease-out' }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700 }}>Order Baru Masuk!</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, opacity: 0.9 }}>Cucian baru saja ditambahkan oleh kasir.</div>
          </div>
          <button onClick={() => setNewOrderAlert(false)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>
      )}

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
        {!loading && displayList.length === 0 && (
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
        {!loading && displayList.map(tx => (
          <OrderCard
            key={tx.id}
            tx={tx}
            onPress={t => navigate('detail_item_produksi', t)}
          />
        ))}
        {lastRefresh && displayList.length > 0 && (
          <div style={{ textAlign: 'center', fontFamily: 'Poppins', fontSize: 10, color: C.n400, padding: '4px 0 32px' }}>
            Diperbarui otomatis · {lastRefresh.toLocaleTimeString('id-ID')} · refresh tiap 30 detik
          </div>
        )}
      </div>

      {/* Floating QR Scanner Button */}
      <button
        onClick={() => navigate('produksi_qr_scan')}
        style={{
          position: 'absolute', bottom: 24, right: 24, width: 64, height: 64, borderRadius: 32,
          background: `linear-gradient(135deg, ${C.primaryLight}, ${C.primary})`,
          boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, transition: 'transform 0.2s'
        }}
        onTouchStart={e => e.currentTarget.style.transform = 'scale(0.9)'}
        onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <span style={{ fontSize: 28 }}>📷</span>
      </button>

      <style>{`
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

