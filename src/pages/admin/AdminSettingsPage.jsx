// ─────────────────────────────────────────────────────────────────────────────
// Admin: Settings (key-value config)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { listSettings, updateSetting } from '../../utils/outletCashApi';

const CATEGORY_META = {
  kas: { label: '💰 Kas Operasional', color: C.warning, bg: C.validationWarningBg, border: C.validationWarningBorder },
  transaction: { label: '🧾 Transaksi', color: C.info, bg: C.validationInfoBg, border: C.validationInfoBorder },
  general: { label: '⚙️ Umum', color: C.n800, bg: C.n50, border: C.n200 },
};

const KEY_DISPLAY = {
  kas_minimum_balance: {
    label: 'Saldo Minimum Kas Outlet',
    helper: 'Kalau saldo kas outlet di bawah angka ini, kasir & admin akan dapat notifikasi.',
    formatPreview: (v) => rp(Number(v) || 0),
  },
};

export default function AdminSettingsPage({ goBack }) {
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
      console.error('[fetchSettings]', err);
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

  // Group settings by category
  const grouped = settings.reduce((acc, s) => {
    const cat = s.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Pengaturan Sistem" subtitle={`${settings.length} konfigurasi`} onBack={goBack} />

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
              <div style={{
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                color: meta.color, textTransform: 'uppercase', letterSpacing: 0.5,
                marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {meta.label}
              </div>
              {list.map((s) => {
                const display = KEY_DISPLAY[s.settingKey] || {};
                return (
                  <div key={s.id} style={{
                    background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 10,
                    boxShadow: SHADOW.md, borderLeft: `4px solid ${meta.color}`,
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
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
                        style={{
                          padding: '7px 14px', borderRadius: 10, flexShrink: 0,
                          border: `1.5px solid ${C.primary}40`, background: `${C.primary}10`,
                          color: C.primary, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = `${C.primary}20`; e.currentTarget.style.borderColor = C.primary; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = `${C.primary}10`; e.currentTarget.style.borderColor = `${C.primary}40`; }}
                      >
                        Ubah
                      </button>
                    </div>
                    <div style={{
                      marginTop: 12, padding: '10px 14px',
                      background: meta.bg, borderRadius: 10, border: `1px solid ${meta.border}`,
                      fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: meta.color,
                    }}>
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
          {editing && (
            <>
              {KEY_DISPLAY[editing.settingKey]?.helper && (
                <div style={{
                  background: C.validationInfoBg, border: `1px solid ${C.validationInfoBorder}`,
                  borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                  fontFamily: 'Poppins', fontSize: 12, color: C.validationInfoText, lineHeight: 1.5,
                }}>
                  💡 {KEY_DISPLAY[editing.settingKey].helper}
                </div>
              )}

              {editing.dataType === 'number' ? (
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
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: `1.5px solid ${C.n200}`, background: C.white,
                      fontFamily: 'Poppins', fontSize: 14, color: C.n900,
                      outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    }}
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
      </Modal>
    </div>
  );
}