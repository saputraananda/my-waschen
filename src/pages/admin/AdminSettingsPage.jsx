// Admin: Settings (key-value config)
import { useState, useEffect, useCallback } from 'react';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Btn, Modal, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { listSettings, updateSetting } from '../../utils/outletCashApi';

const CATEGORY_META = {
  kas: { label: '💰 Kas Operasional', color: C.warning, bg: C.validationWarningBg, border: C.validationWarningBorder },
  transaction: { label: '🧾 Transaksi', color: C.info, bg: C.validationInfoBg, border: C.validationInfoBorder },
  membership: { label: '🎁 Membership', color: C.primary, bg: C.primaryTint2, border: C.primaryLight },
  general: { label: '⚙️ Umum', color: C.n800, bg: C.n50, border: C.n200 },
};

const KEY_DISPLAY = {
  kas_minimum_balance: {
    label: 'Saldo Minimum Kas Outlet',
    helper: 'Kalau saldo kas outlet di bawah angka ini, kasir & admin akan dapat notifikasi.',
    formatPreview: (v) => rp(Number(v) || 0),
  },
  membership_bonus_enabled: {
    label: 'Bonus Top-Up Membership',
    helper: 'Aktifkan bonus top-up: Gold +25.000, Diamond +50.000',
    formatPreview: (v) => v === 'true' || v === '1' ? '✅ Aktif' : '❌ Nonaktif',
  },
};

export default function AdminSettingsPage({ goBack, navigate }) {
  const isMobile = useIsMobile();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSettings();
      setSettings(data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!editing) return;
    if (editing.dataType === 'number') {
      const n = Number(editValue);
      if (!Number.isFinite(n) || n < 0) {
        alertWarning('Nilai harus angka >= 0.');
        return;
      }
    }
    if (editing.dataType !== 'number' && !editValue.trim()) {
      alertWarning('Nilai wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await updateSetting(editing.settingKey, editValue);
      alertSuccess('Setting berhasil diubah.');
      setEditing(null);
      setEditValue('');
      fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal update setting.');
    } finally {
      setSaving(false);
    }
  };

  const grouped = settings.reduce((acc, s) => {
    const cat = s.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <style>{`
        @media (max-width: 480px) {
          .settings-modal-inputs { gap: 8px !important; }
          .settings-item-row { flex-direction: column !important; gap: 10px !important; }
          .settings-item-row > button { width: 100% !important; }
        }
      `}</style>
      <TopBar title="Pengaturan Sistem" subtitle={`${settings.length} konfigurasi`} onBack={goBack} />

      {/* Quick Access */}
      <div style={{ padding: '8px 12px', background: C.n50, borderBottom: `1px solid ${C.n200}` }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            onClick={() => navigate && navigate('admin_payment_config')}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 10,
              background: C.white, border: `1px solid ${C.n200}`,
              fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            💳 Konfigurasi Pembayaran
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.n200}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n700 }}>Memuat...</span>
          </div>
        )}

        {!loading && settings.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 10 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: `${C.primary}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${C.primary}18` }}>
              <span style={{ fontSize: 28 }}>⚙️</span>
            </div>
            <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n700 }}>Belum ada settings</span>
          </div>
        )}

        {!loading && Object.entries(grouped).map(([cat, list]) => {
          const meta = CATEGORY_META[cat] || CATEGORY_META.general;
          return (
            <div key={cat} style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: meta.color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                {meta.label}
              </div>
              {list.map((s) => {
                const display = KEY_DISPLAY[s.settingKey] || {};
                return (
                  <div key={s.id} style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 10, boxShadow: SHADOW.md, borderLeft: `4px solid ${meta.color}`, transition: 'all 0.2s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }} className="settings-item-row">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>
                          {display.label || s.settingKey}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.n400, marginTop: 1 }}>
                          {s.settingKey}
                        </div>
                        {(display.helper || s.description) && (
                          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 6, lineHeight: 1.4 }}>
                            {display.helper || s.description}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setEditing(s); setEditValue(s.settingValue); }}
                        style={{ padding: '7px 14px', borderRadius: 10, flexShrink: 0, border: `1.5px solid ${C.primary}40`, background: `${C.primary}10`, color: C.primary, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = `${C.primary}20`; e.currentTarget.style.borderColor = C.primary; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = `${C.primary}10`; e.currentTarget.style.borderColor = `${C.primary}40`; }}
                      >
                        Ubah
                      </button>
                    </div>
                    <div style={{ marginTop: 12, padding: '10px 14px', background: meta.bg, borderRadius: 10, border: `1px solid ${meta.border}`, fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: meta.color }}>
                      {display.formatPreview ? display.formatPreview(s.settingValue) : s.settingValue}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      <Modal visible={!!editing} onClose={() => setEditing(null)} title={editing ? `Ubah: ${KEY_DISPLAY[editing.settingKey]?.label || editing.settingKey}` : ''}>
        <div style={{ padding: '8px 4px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="settings-modal-inputs">
            {editing && (
              <>
                {KEY_DISPLAY[editing.settingKey]?.helper && (
                <div style={{ background: C.validationInfoBg, border: `1px solid ${C.validationInfoBorder}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontFamily: 'Poppins', fontSize: 12, color: C.validationInfoText, lineHeight: 1.5 }}>
                  💡 {KEY_DISPLAY[editing.settingKey].helper}
                </div>
              )}

              {editing.dataType === 'boolean' ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 12 }}>
                    Status: {editValue === 'true' || editValue === '1' ? '✅ Aktif' : '❌ Nonaktif'}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => setEditValue('true')}
                      style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: `2px solid ${editValue === 'true' || editValue === '1' ? C.success : C.n200}`, background: editValue === 'true' || editValue === '1' ? C.successBg : C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: editValue === 'true' || editValue === '1' ? C.success : C.n600 }}
                    >
                      ✅ Aktif
                    </button>
                    <button
                      onClick={() => setEditValue('false')}
                      style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: `2px solid ${editValue === 'false' || editValue === '0' ? C.danger : C.n200}`, background: editValue === 'false' || editValue === '0' ? C.validationErrorBg : C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: editValue === 'false' || editValue === '0' ? C.danger : C.n600 }}
                    >
                      ❌ Nonaktif
                    </button>
                  </div>
                </div>
              ) : editing.dataType === 'number' ? (
                <MoneyInput
                  label={`Nilai baru ${KEY_DISPLAY[editing.settingKey]?.suffix ? `(${KEY_DISPLAY[editing.settingKey].suffix})` : ''}`}
                  value={editValue}
                  onChange={setEditValue}
                  placeholder="0"
                  hint={editValue ? rp(Number(editValue)) : undefined}
                />
              ) : (
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6 }}>Nilai baru</div>
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={4}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${C.n200}`, background: C.white, fontFamily: 'Poppins', fontSize: 14, color: C.n900, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              {editing.dataType === 'number' && KEY_DISPLAY[editing.settingKey]?.formatPreview && editValue && (
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.primary, fontWeight: 600, marginTop: -6, marginBottom: 14 }}>
                  Preview: {KEY_DISPLAY[editing.settingKey].formatPreview(editValue)}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <Btn variant="secondary" onClick={() => setEditing(null)} style={{ flex: 1 }}>Batal</Btn>
                <Btn variant="primary" onClick={handleSave} loading={saving} style={{ flex: 1 }}>Simpan</Btn>
              </div>
            </>
          )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
