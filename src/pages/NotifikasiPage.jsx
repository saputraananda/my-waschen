import { C } from '../utils/theme';
import { MOCK_DATA } from '../utils/mockData';
import { TopBar } from '../components/ui';

const TYPE_ICONS = {
  selesai: { icon: '✅', bg: '#DCFCE7', color: C.success },
  promo: { icon: '🎉', bg: '#FEF3C7', color: '#B45309' },
  info: { icon: 'ℹ️', bg: C.primaryLight, color: C.primary },
  pickup: { icon: '🚗', bg: '#E0F2FE', color: '#0369A1' },
};

export default function NotifikasiPage({ navigate }) {
  const notifications = MOCK_DATA.notifications || [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Notifikasi" onBack={() => navigate('dashboard')} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {notifications.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 48 }}>🔔</span>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900 }}>Belum ada notifikasi</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifications.map((n) => {
              const t = TYPE_ICONS[n.type] || TYPE_ICONS.info;
              return (
                <div key={n.id} style={{ background: n.read ? C.white : `${C.primaryLight}80`, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{t.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{n.title}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2, lineHeight: 1.5 }}>{n.message}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 4 }}>{n.time}</div>
                  </div>
                  {!n.read && <div style={{ width: 8, height: 8, borderRadius: 4, background: C.primary, flexShrink: 0, marginTop: 4 }} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
