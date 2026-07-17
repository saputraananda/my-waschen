// ─────────────────────────────────────────────────────────────────────────────
// ServiceIcon Showcase — Contoh penggunaan komponen
// Copy file ini ke folder pages untuk testing, atau import component langsung
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ServiceIcon,
  ServiceIconBadge,
  ServiceIconGroup,
  ServiceIconList,
  SERVICE_ICON_PRESETS,
  SERVICE_ICON_NAMES,
} from '../components/ui/ServiceIcon';

export function ServiceIconShowcase() {
  // Available icon names
  console.log('Available icons:', SERVICE_ICON_NAMES);

  return (
    <div style={{ padding: 24, fontFamily: 'Poppins, sans-serif' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
        🎨 ServiceIcon Showcase
      </h2>

      {/* ── Section 1: Basic Sizes ───────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#6B7280' }}>
          Ukuran Standar (mengikuti lucide-react)
        </h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'center' }}>
            <ServiceIcon name="order" size={16} variant="filled" />
            <div style={{ fontSize: 10, marginTop: 4, color: '#9CA3AF' }}>16px</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <ServiceIcon name="order" size={18} variant="filled" />
            <div style={{ fontSize: 10, marginTop: 4, color: '#9CA3AF' }}>18px</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <ServiceIcon name="order" size={20} variant="filled" />
            <div style={{ fontSize: 10, marginTop: 4, color: '#9CA3AF' }}>20px</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <ServiceIcon name="order" size={22} variant="filled" />
            <div style={{ fontSize: 10, marginTop: 4, color: '#9CA3AF' }}>22px (default)</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <ServiceIcon name="order" size={24} variant="filled" />
            <div style={{ fontSize: 10, marginTop: 4, color: '#9CA3AF' }}>24px</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <ServiceIcon name="order" size={32} variant="filled" />
            <div style={{ fontSize: 10, marginTop: 4, color: '#9CA3AF' }}>32px</div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Variants ───────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#6B7280' }}>
          Variants
        </h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <ServiceIcon name="delivery" size={24} variant="filled" />
            <div style={{ fontSize: 10, marginTop: 4, color: '#9CA3AF' }}>filled</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <ServiceIcon name="delivery" size={24} variant="transparent" />
            <div style={{ fontSize: 10, marginTop: 4, color: '#9CA3AF' }}>transparent</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <ServiceIcon name="delivery" size={24} variant="outlined" color="#10B981" />
            <div style={{ fontSize: 10, marginTop: 4, color: '#9CA3AF' }}>outlined</div>
          </div>
        </div>
      </section>

      {/* ── Section 3: ServiceIconBadge ─────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#6B7280' }}>
          ServiceIconBadge (untuk dashboard/stats)
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <ServiceIconBadge name="order" label="Transaksi" color="#7C3AED" />
          <ServiceIconBadge name="delivery" label="Pengiriman" color="#10B981" />
          <ServiceIconBadge name="wallet" label="Pembayaran" color="#F59E0B" />
          <ServiceIconBadge name="pickup" label="Ambil" color="#3B82F6" />
          <ServiceIconBadge name="promo" label="Promo" color="#EC4899" />
        </div>
      </section>

      {/* ── Section 4: All Available Icons ─────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#6B7280' }}>
          Semua Icon yang Tersedia (Icon and Asset Laundry)
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: 12,
          padding: 16,
          background: '#F9FAFB',
          borderRadius: 12,
        }}>
          {SERVICE_ICON_NAMES.slice(0, 20).map((name) => (
            <div key={name} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: 8,
            }}>
              <ServiceIcon name={name} size={28} variant="filled" />
              <div style={{ fontSize: 9, color: '#6B7280', textAlign: 'center' }}>{name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 5: Presets ────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#6B7280' }}>
          Preset Combinations (SERVICE_ICON_PRESETS)
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {Object.entries(SERVICE_ICON_PRESETS).map(([key, preset]) => (
            <ServiceIconBadge
              key={key}
              name={preset.icon}
              label={preset.label}
              color={preset.color}
            />
          ))}
        </div>
      </section>

      {/* ── Section 6: ServiceIconList ─────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#6B7280' }}>
          ServiceIconList (untuk settings/list pages)
        </h3>
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <ServiceIconList
            items={[
              { name: 'schedule', label: 'Jadwal Operasional', description: 'Atur jam buka & tutup' },
              { name: 'location', label: 'Lokasi Outlet', description: 'Pengaturan alamat' },
              { name: 'notifikasi', label: 'Notifikasi', description: 'Pengaturan push notification', badge: '3' },
              { name: 'wallet', label: 'Metode Pembayaran', description: 'QRIS, cash, transfer' },
              { name: 'garansi', label: 'Garansi Layanan', description: 'Atur kebijakan garansi' },
            ]}
            onItemClick={(item) => console.log('Clicked:', item.label)}
          />
        </div>
      </section>
    </div>
  );
}

export default ServiceIconShowcase;
