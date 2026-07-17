// ─────────────────────────────────────────────────────────────────────────────
// Quick Usage Examples - ServiceIcon
// Copy snippet di bawah ini untuk implement di page kamu
// ─────────────────────────────────────────────────────────────────────────────

import { ServiceIcon, ServiceIconBadge, ServiceIconGroup, ServiceIconList } from '../components/ui';

// ═══════════════════════════════════════════════════════════════════════════════
// CONTOH 1: Stat Card dengan Icon
// ═══════════════════════════════════════════════════════════════════════════════
function StatCardWithIcon() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      background: 'white',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}>
      <ServiceIcon name="order" size={40} variant="filled" color="#7C3AED" />
      <div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>1,234</div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>Transaksi Hari Ini</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTOH 2: Dashboard Stats Grid
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardStats() {
  const stats = [
    { icon: 'order', value: '156', label: 'Transaksi', color: '#7C3AED' },
    { icon: 'delivery', value: '23', label: 'Delivery', color: '#10B981' },
    { icon: 'pickup', value: '45', label: 'Siap Ambil', color: '#3B82F6' },
    { icon: 'wallet', value: 'Rp 2.5jt', label: 'Pendapatan', color: '#F59E0B' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 12,
    }}>
      {stats.map((stat, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          borderRadius: 12,
          background: `${stat.color}10`,
          border: `1px solid ${stat.color}30`,
        }}>
          <ServiceIcon name={stat.icon} size={36} variant="filled" color={stat.color} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1F2937' }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTOH 3: Service/Feature List
// ═══════════════════════════════════════════════════════════════════════════════
function ServiceFeatureList() {
  const features = [
    { icon: 'express-clock', label: 'Express Service', desc: 'Selesai dalam 3 jam', badge: 'Cepat' },
    { icon: 'hygienic', label: 'Higienis', desc: 'Standar kebersihan tinggi' },
    { icon: 'garansi', label: 'Garansi 7 Hari', desc: 'Qualitas terjamin' },
    { icon: 'eco-friendly', label: 'Eco Friendly', desc: 'Ramah lingkungan' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {features.map((f, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          borderRadius: 10,
          background: 'white',
          border: '1px solid #E5E7EB',
        }}>
          <ServiceIcon name={f.icon} size={24} variant="filled" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{f.desc}</div>
          </div>
          {f.badge && (
            <span style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: '#10B981',
              color: 'white',
              fontSize: 10,
              fontWeight: 600,
            }}>
              {f.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTOH 4: Filter Chips dengan Icon
// ═══════════════════════════════════════════════════════════════════════════════
function FilterChipsWithIcons() {
  const filters = [
    { icon: 'order', label: 'Semua' },
    { icon: 'delivery', label: 'Delivery' },
    { icon: 'pickup', label: 'Ambil Sendiri' },
    { icon: 'express-clock', label: 'Express' },
  ];
  const [active, setActive] = React.useState('order');

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {filters.map((f) => (
        <button
          key={f.icon}
          onClick={() => setActive(f.icon)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 999,
            border: active === f.icon ? '1.5px solid #7C3AED' : '1.5px solid #E5E7EB',
            background: active === f.icon ? 'rgba(124, 58, 237, 0.08)' : 'white',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: active === f.icon ? 600 : 400,
            color: active === f.icon ? '#7C3AED' : '#6B7280',
          }}
        >
          <ServiceIcon
            name={f.icon}
            size={16}
            variant={active === f.icon ? 'filled' : 'transparent'}
          />
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTOH 5: Empty State dengan Icon
// ═══════════════════════════════════════════════════════════════════════════════
function EmptyStateWithIcon() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      textAlign: 'center',
    }}>
      <ServiceIcon name="order" size={64} variant="filled" />
      <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>
        Belum Ada Transaksi
      </h3>
      <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
        Transaksi pertama kamu akan muncul di sini
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTOH 6: Quick Action Buttons
// ═══════════════════════════════════════════════════════════════════════════════
function QuickActionButtons() {
  const actions = [
    { icon: 'pickup', label: 'Ambil', color: '#3B82F6' },
    { icon: 'delivery', label: 'Kirim', color: '#10B981' },
    { icon: 'promo', label: 'Promo', color: '#F59E0B' },
    { icon: 'schedule', label: 'Jadwal', color: '#8B5CF6' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12,
    }}>
      {actions.map((a, i) => (
        <button
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: 16,
            borderRadius: 12,
            background: `${a.color}10`,
            border: `1px solid ${a.color}30`,
            cursor: 'pointer',
          }}
        >
          <ServiceIcon name={a.icon} size={28} variant="filled" color={a.color} />
          <span style={{ fontSize: 11, fontWeight: 600, color: a.color }}>
            {a.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// Export examples for reference
export {
  StatCardWithIcon,
  DashboardStats,
  ServiceFeatureList,
  FilterChipsWithIcons,
  EmptyStateWithIcon,
  QuickActionButtons,
};
