import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../utils/theme';
import { TopBar } from '../components/ui';

const TYPE_ICONS = {
  selesai:  { icon: '✅', bg: '#DCFCE7', color: '#10B981' },
  info:     { icon: 'ℹ️', bg: '#F3E6F5', color: '#5B005F' },
  payment:  { icon: '💳', bg: '#FEF3C7', color: '#B45309' },
  warning:  { icon: '⚠️', bg: '#FEE2E2', color: '#EF4444' },
  pickup:   { icon: '🚗', bg: '#E0F2FE', color: '#0369A1' },
  promo:    { icon: '🎉', bg: '#FEF3C7', color: '#B45309' },
};

export default function NotifikasiPage({ navigate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/notifications');
        setNotifications(res?.data?.data || []);
      } catch (err) {
        console.error('[NotifikasiPage] Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Notifikasi"
        subtitle={unreadCount > 0 ? `${unreadCount} belum dibaca` : `${notifications.length} notifikasi`}
        onBack={() => navigate('dashboard')}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ background: C.white, borderRadius: 14, padding: '14px 14px', height: 72, animation: 'pulse 1.5s infinite', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }} />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: 40, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 36 }}>🔔</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900 }}>Belum ada notifikasi</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Notifikasi akan muncul saat ada aktivitas baru</div>
          </div>
        ) : (
          <>
            {/* Unread section */}
            {unreadCount > 0 && (
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
                Belum Dibaca ({unreadCount})
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifications.filter((n) => !n.read).map((n) => {
                const t = TYPE_ICONS[n.type] || TYPE_ICONS.info;
                return (
                  <div key={n.id} style={{
                    background: `linear-gradient(135deg, ${t.bg}80, ${C.white})`,
                    borderRadius: 14, padding: '12px 14px',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    borderLeft: `3px solid ${t.color}`,
                    transition: 'transform 0.2s',
                  }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{t.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{n.title}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.message}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 4 }}>{n.time}</div>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: t.color, flexShrink: 0, marginTop: 6 }} />
                  </div>
                );
              })}
            </div>

            {/* Read section */}
            {notifications.filter((n) => n.read).length > 0 && (
              <>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: 0.5, marginTop: 20, marginBottom: 8, textTransform: 'uppercase' }}>
                  Sebelumnya
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
                  {notifications.filter((n) => n.read).map((n) => {
                    const t = TYPE_ICONS[n.type] || TYPE_ICONS.info;
                    return (
                      <div key={n.id} style={{
                        background: C.white, borderRadius: 14, padding: '12px 14px',
                        boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
                        display: 'flex', gap: 12, alignItems: 'flex-start', opacity: 0.85,
                      }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{t.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 500, color: C.n900 }}>{n.title}</div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.message}</div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 4 }}>{n.time}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
