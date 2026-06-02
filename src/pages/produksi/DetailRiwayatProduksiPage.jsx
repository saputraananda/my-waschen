import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { STAGES, photoTypeLabel } from '../../utils/helpers';
import { TopBar, Avatar, Btn, PhotoLightbox } from '../../components/ui';

// ════════════════════════════════════════════════════════════════════
// Design tokens
// ════════════════════════════════════════════════════════════════════
const STAGE_THEME = {
  Diterima: { icon: '📥', bg: '#EFF6FF', accent: '#3B82F6', soft: '#DBEAFE' },
  Cuci:     { icon: '🫧', bg: '#ECFEFF', accent: '#06B6D4', soft: '#CFFAFE' },
  Setrika:  { icon: '♨️', bg: '#FFFBEB', accent: '#F59E0B', soft: '#FEF3C7' },
  Packing:  { icon: '📦', bg: '#ECFDF5', accent: '#10B981', soft: '#D1FAE5' },
  Selesai:  { icon: '✅', bg: '#F0FDF4', accent: '#059669', soft: '#DCFCE7' },
  QC:       { icon: '🔍', bg: '#F5F3FF', accent: '#8B5CF6', soft: '#EDE9FE' },
};

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════
const fmtDateTime = (v) => {
  if (!v) return '-';
  try {
    return new Date(v).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return '-'; }
};

const fmtDuration = (start, end) => {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}j ${m}m` : `${h}j`;
  const d = Math.floor(h / 24);
  return `${d}h ${h % 24}j`;
};

// ════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════
function HeroCustomerCard({ data }) {
  const initials = (data.customerName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0C4A6E 100%)',
      padding: '14px 16px 16px',
      position: 'relative', overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.35), transparent 70%)',
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar initials={initials} size={50} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, fontWeight: 600 }}>
            📋 {data.id}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 17, fontWeight: 800, color: 'white', marginTop: 1, lineHeight: 1.2 }}>
            {data.customerName}
          </div>
          {data.customerPhone && (
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>
              📞 {data.customerPhone}
            </div>
          )}
          {data.outletName && (
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              🏪 {data.outletName}
            </div>
          )}
        </div>
        {data.isExpress && (
          <div style={{
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            color: 'white',
            fontFamily: 'Poppins', fontSize: 10, fontWeight: 800,
            padding: '5px 10px', borderRadius: 999,
            boxShadow: '0 2px 8px rgba(245,158,11,0.4)',
          }}>⚡ EXPRESS</div>
        )}
      </div>
    </div>
  );
}

function TimeStatGrid({ data }) {
  const tiles = [
    { icon: '📥', label: 'Diterima',  value: fmtDateTime(data.receivedAt),    bg: '#EFF6FF', fg: '#1E40AF' },
    { icon: '✅', label: 'Selesai',   value: fmtDateTime(data.finishedAt),    bg: '#ECFDF5', fg: '#065F46' },
  ];
  if (data.pickedUpAt) {
    tiles.push({ icon: '🛍️', label: 'Diambil', value: fmtDateTime(data.pickedUpAt), bg: '#F5F3FF', fg: '#5B21B6' });
  }
  if (data.estimatedDoneAt) {
    tiles.push({ icon: '🎯', label: 'Target', value: fmtDateTime(data.estimatedDoneAt), bg: '#FFFBEB', fg: '#92400E' });
  }

  const duration = fmtDuration(data.receivedAt, data.finishedAt);

  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '14px 14px',
      marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.5 }}>
          ⏱️ WAKTU PRODUKSI
        </div>
        {duration && (
          <span style={{
            fontFamily: 'Poppins', fontSize: 10, fontWeight: 800,
            background: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)',
            color: '#15803D', padding: '3px 10px', borderRadius: 999,
            border: '1px solid #86EFAC',
          }}>
            ⚡ {duration}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {tiles.map((t, i) => (
          <div key={i} style={{
            background: t.bg, borderRadius: 10, padding: '9px 11px',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: t.fg, fontWeight: 700, opacity: 0.8 }}>
              {t.icon} {t.label}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n900, marginTop: 4, lineHeight: 1.3 }}>
              {t.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageTimeline({ timeline = [] }) {
  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '14px 16px',
      marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.5, marginBottom: 12 }}>
        🚦 ALUR TAHAP
      </div>
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: 19, top: 18, bottom: 18, width: 2,
          background: `linear-gradient(180deg, ${C.success}, ${C.n200})`,
        }} />
        {STAGES.map((s, i) => {
          const log = timeline.find(p => p.stage === s);
          const isDone = !!log;
          const theme = STAGE_THEME[s] || STAGE_THEME.Diterima;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: i < STAGES.length - 1 ? 14 : 0, position: 'relative' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: isDone ? theme.bg : C.n50,
                border: `2px solid ${isDone ? theme.accent : C.n200}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, position: 'relative', zIndex: 1,
                boxShadow: isDone ? `0 4px 12px ${theme.accent}30` : 'none',
              }}>
                {theme.icon}
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 13,
                    fontWeight: isDone ? 700 : 500,
                    color: isDone ? C.n900 : C.n500,
                  }}>{s}</div>
                  {isDone && <span style={{ color: C.success, fontSize: 14 }}>✔</span>}
                </div>
                {isDone && log?.timestamp && (
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 2 }}>
                    {fmtDateTime(log.timestamp)}
                  </div>
                )}
                {log?.notes && (
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 10, color: C.n600,
                    marginTop: 4, padding: '4px 8px',
                    background: C.n50, borderRadius: 6,
                  }}>📝 {log.notes}</div>
                )}
              </div>
            </div>
          );
        })}
        {timeline.length === 0 && (
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, textAlign: 'center', padding: 8 }}>
            Belum ada log tahap tercatat
          </div>
        )}
      </div>
    </div>
  );
}

function ItemList({ items = [] }) {
  if (!items.length) return null;
  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '14px 16px',
      marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.5, marginBottom: 10 }}>
        🧺 LAYANAN / ITEM
      </div>
      {items.map((item, idx) => {
        const theme = STAGE_THEME[item.currentStage] || STAGE_THEME.Diterima;
        return (
          <div key={item.itemId || idx} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 0',
            borderBottom: idx < items.length - 1 ? `1px solid ${C.n100}` : 'none',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: theme.bg, border: `1.5px solid ${theme.soft}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>{theme.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>{item.name}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 2 }}>
                Tahap: <span style={{ color: theme.accent, fontWeight: 700 }}>{item.currentStage || '-'}</span>
              </div>
            </div>
            <span style={{
              fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700,
              background: C.n50, padding: '3px 10px', borderRadius: 999,
            }}>{item.qty} {item.unit}</span>
          </div>
        );
      })}
    </div>
  );
}

function PhotoSection({ title, icon, photos = [], emptyText, onPhotoClick }) {
  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '14px 16px',
      marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.5 }}>
          {icon} {title}
        </div>
        {photos.length > 0 && (
          <span style={{
            fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
            background: C.primaryLight, color: C.primary,
            padding: '2px 8px', borderRadius: 999,
          }}>{photos.length} foto</span>
        )}
      </div>
      {photos.length === 0 ? (
        <div style={{
          fontFamily: 'Poppins', fontSize: 11, color: C.n500, textAlign: 'center',
          padding: 16, background: C.n50, borderRadius: 10, border: `1px dashed ${C.n200}`,
        }}>
          📷 {emptyText}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {photos.map((p, idx) => (
            <button
              key={p.id || idx}
              onClick={() => onPhotoClick(p, idx)}
              style={{
                position: 'relative', aspectRatio: '1 / 1',
                borderRadius: 10, overflow: 'hidden',
                border: `1.5px solid ${C.n100}`, padding: 0,
                background: C.n50, cursor: 'pointer',
                transition: 'transform 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.primary; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.n100; }}
            >
              <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                flexDirection: 'column', justifyContent: 'flex-end',
                background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.65))',
                padding: 4, pointerEvents: 'none',
              }}>
                <div style={{
                  fontFamily: 'Poppins', fontSize: 8, fontWeight: 700, color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {photoTypeLabel(p.type)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════
export default function DetailRiwayatProduksiPage({ navigate, goBack, screenParams }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const rawId = screenParams?.transactionUuid || screenParams?.id;

  useEffect(() => {
    if (!rawId) {
      setError('Order tidak ditemukan.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/transactions/production/order/${encodeURIComponent(rawId)}`);
        if (!cancelled) setData(res?.data?.data || null);
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Gagal memuat detail produksi.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [rawId]);

  const allPhotos = useMemo(() => {
    if (!data) return [];
    return [...(data.receivePhotos || []), ...(data.packingPhotos || [])];
  }, [data]);

  const openLightbox = (photo, _idx, source = 'all') => {
    let list, startIndex;
    if (source === 'receive') {
      list = data.receivePhotos || [];
      startIndex = list.findIndex(p => p.id === photo.id || p.url === photo.url);
    } else if (source === 'packing') {
      list = data.packingPhotos || [];
      startIndex = list.findIndex(p => p.id === photo.id || p.url === photo.url);
    } else {
      list = allPhotos;
      startIndex = list.findIndex(p => p.id === photo.id || p.url === photo.url);
    }
    setLightboxPhotos(list);
    setLightboxIndex(Math.max(0, startIndex));
    setLightboxOpen(true);
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC' }}>
        <TopBar title="Detail Produksi" onBack={goBack} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <div style={{
            width: 36, height: 36, border: `3px solid ${C.n200}`, borderTopColor: C.primary,
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat detail…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC' }}>
        <TopBar title="Detail Produksi" onBack={goBack} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>⚠️</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>
            {error || 'Data tidak tersedia'}
          </div>
          <Btn variant="secondary" onClick={goBack}>← Kembali</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC', overflow: 'hidden' }}>
      <TopBar title="Detail Produksi" subtitle={data.id} onBack={goBack} />

      <HeroCustomerCard data={data} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        <TimeStatGrid data={data} />
        <StageTimeline timeline={data.timeline} />
        <ItemList items={data.items} />

        {data.notes && (
          <div style={{
            background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 12,
            fontFamily: 'Poppins', fontSize: 12, color: '#92400E',
            border: '1px solid #FBBF24',
          }}>
            📝 <strong>Catatan:</strong> {data.notes}
          </div>
        )}

        <PhotoSection
          title="FOTO KONDISI TERIMA"
          icon="📥"
          photos={data.receivePhotos || []}
          emptyText="Tidak ada foto saat diterima"
          onPhotoClick={(p, i) => openLightbox(p, i, 'receive')}
        />

        <PhotoSection
          title="FOTO PACKING / SERAH"
          icon="📦"
          photos={data.packingPhotos || []}
          emptyText="Tidak ada foto packing"
          onPhotoClick={(p, i) => openLightbox(p, i, 'packing')}
        />
      </div>

      <PhotoLightbox
        visible={lightboxOpen}
        photos={lightboxPhotos}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
        formatType={photoTypeLabel}
      />
    </div>
  );
}
