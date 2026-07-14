import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { TopBar, SkeletonList } from '../../components/ui';
import { C } from '../../utils/theme';
import { useRealtime } from '../../utils/realtime';
import { useResponsive } from '../../utils/hooks';

const TYPE_STYLE = {
  selesai: { icon: '✅', bg: C.successBg, color: C.successDark },
  info:    { icon: 'ℹ️',  bg: C.infoBg, color: C.primary },
  warning: { icon: '🔥', bg: C.validationWarningBg, color: C.danger },
};

const CATEGORY_LABELS = {
  produksi: '🏭 Produksi',
  kasir:    '💰 Kasir',
  admin:    '⚙️ Admin',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Baru saja';
  if (min < 60) return `${min}m lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}d lalu`;
}

export default function ProduksiNotifikasiPage({ navigate }) {
  const { isMobile } = useResponsive();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  const fetchNotif = useCallback(async () => {
    setError(null);
    try {
      const res = await axios.get('/api/notifications');
      // Hanya tampilkan notifikasi bertipe produksi
      const all = res?.data?.data || [];
      const produksi = all.filter(n => n.category === 'produksi');
      setNotifications(produksi);
    } catch (err) {
      setError('Gagal memuat notifikasi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotif(); }, [fetchNotif]);

  // Refresh realtime saat ada item baru masuk, update produksi, atau notifikasi baru
  useRealtime('production:new-item', fetchNotif);
  useRealtime('production:update',   fetchNotif);
  useRealtime('notification:new',    fetchNotif);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: C.n50, fontFamily: 'Inter, system-ui',
    }}>
      <TopBar
        title="Notifikasi Produksi"
        subtitle={unreadCount > 0 ? `${unreadCount} belum dibaca` : `${notifications.length} notifikasi`}
        onBack={() => navigate('dashboard')}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: `${isMobile ? 10 : 12}px ${isMobile ? 12 : 14}px ${isMobile ? 90 : 80}px` }}>
        {loading ? (
          <SkeletonList count={4} />
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontFamily: 'Inter, system-ui', fontSize: 14, color: C.danger, marginBottom: 8 }}>{error}</div>
            <button
              onClick={fetchNotif}
              style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.primary, color: 'white', cursor: 'pointer', fontFamily: 'Inter, system-ui', fontSize: 13 }}
            >
              Coba Lagi
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🔔</div>
            <div style={{ fontFamily: 'Inter, system-ui', fontSize: 15, fontWeight: 500, color: C.n800, marginBottom: 4 }}>Belum ada notifikasi</div>
            <div style={{ fontFamily: 'Inter, system-ui', fontSize: 13, color: C.n400 }}>Notifikasi produksi akan muncul saat ada aktivitas</div>
          </div>
        ) : (
          notifications.map((notif, idx) => {
            const style = TYPE_STYLE[notif.type] || TYPE_STYLE.info;
            return (
              <div
                key={notif.id || idx}
                style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  padding: isMobile ? '10px 12px' : '12px 14px',
                  marginBottom: 8,
                  border: `0.5px solid ${notif.read ? 'rgba(0,0,0,0.07)' : style.color}30`,
                  boxShadow: notif.read
                    ? '0 1px 4px rgba(0,0,0,0.06)'
                    : `0 1px 6px ${style.color}15`,
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onClick={() => {
                  // Navigate ke detail item produksi jika ada info stage/itemId
                  if (notif.category === 'produksi') {
                    // bisa di-extend untuk deep link ke item tertentu
                  }
                }}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.99)'; }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {/* Header: icon + title + time */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 8 : 10 }}>
                  <div style={{
                    width: isMobile ? 34 : 38, height: isMobile ? 34 : 38, borderRadius: isMobile ? 8 : 10, flexShrink: 0,
                    background: style.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isMobile ? 16 : 18,
                  }}>
                    {style.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{
                        fontFamily: 'Inter, system-ui', fontSize: isMobile ? 11 : 12, fontWeight: 500,
                        color: C.n800, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {notif.title}
                      </span>
                      <span style={{
                        fontFamily: 'Inter, system-ui', fontSize: 10, color: C.n400, flexShrink: 0,
                      }}>
                        {timeAgo(notif.timestamp)}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: 'Inter, system-ui', fontSize: isMobile ? 10 : 11, color: C.n500,
                      marginTop: 3, lineHeight: 1.4,
                    }}>
                      {notif.message}
                    </div>
                    {/* Stage badge */}
                    {notif.stage && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        marginTop: 6,
                        background: style.bg, color: style.color,
                        padding: '2px 8px', borderRadius: 999,
                        fontFamily: 'Inter, system-ui', fontSize: 9, fontWeight: 500,
                      }}>
                        📍 {notif.stage}
                      </div>
                    )}
                    {/* Express badge */}
                    {notif.isExpress && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center',
                        marginTop: 6, marginLeft: 4,
                        background: C.validationWarningBg, color: C.validationWarningText,
                        padding: '2px 7px', borderRadius: 999,
                        fontFamily: 'Inter, system-ui', fontSize: 9, fontWeight: 500,
                      }}>
                        ⚡ Express
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}