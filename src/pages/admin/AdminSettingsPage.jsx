// ─────────────────────────────────────────────────────────────────────────────
// Admin: Settings (key-value config)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, Input, Textarea, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { listSettings, updateSetting } from '../../utils/outletCashApi';

const CATEGORY_LABEL = {
  kas: { label: '💰 Kas Operasional', color: '#F59E0B' },
  transaction: { label: '🧾 Transaksi', color: '#3B82F6' },
  general: { label: '⚙️ Umum', color: '#64748B' },
};

const KEY_DISPLAY = {
  kas_minimum_balance: {
    label: 'Saldo Minimum Kas Outlet',
    helper: 'Kalau saldo kas outlet di bawah angka ini, kasir & admin akan dapat notifikasi.',
    suffix: 'Rp',
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
        {loading && <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Memuat…</div>}

        {!loading && settings.length === 0 && (
          <div style={{ textAlign: 'center', padding: 50, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>
            Belum ada settings.
          </div>
        )}

        {!loading && Object.entries(grouped).map(([cat, list]) => {
          const meta = CATEGORY_LABEL[cat] || CATEGORY_LABEL.general;
          return (
            <div key={cat} style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 700,
                color: meta.color, textTransform: 'uppercase', letterSpacing: 0.5,
                marginBottom: 8,
              }}>
                {meta.label}
              </div>
              {list.map((s) => {
                const display = KEY_DISPLAY[s.settingKey] || {};
                return (
                  <div key={s.id} style={{
                    background: 'white', borderRadius: 12,
                    padding: '14px 16px', marginBottom: 8,
                    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>
                          {display.label || s.settingKey}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.n400, marginTop: 1 }}>
                          {s.settingKey}
                        </div>
                        {(display.helper || s.description) && (
                          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 6, lineHeight: 1.4 }}>
                            {display.helper || s.description}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setEditing(s); setEditValue(s.settingValue); }}
                        style={{
                          padding: '6px 10px', borderRadius: 8,
                          border: `1px solid ${C.primary}30`, background: `${C.primary}10`,
                          color: C.primary, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Ubah
                      </button>
                    </div>
                    <div style={{
                      marginTop: 10, padding: '8px 12px',
                      background: C.n50, borderRadius: 8,
                      fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: meta.color,
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
        <div style={{ padding: '8px 18px 18px' }}>
          {editing && (
            <>
              {KEY_DISPLAY[editing.settingKey]?.helper && (
                <div style={{
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 14,
                  fontFamily: 'Poppins', fontSize: 11, color: '#1E40AF', lineHeight: 1.5,
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
                <Textarea
                  label="Nilai baru"
                  value={editValue}
                  onChange={setEditValue}
                  rows={3}
                />
              )}

              {editing.dataType === 'number' && KEY_DISPLAY[editing.settingKey]?.formatPreview && editValue && (
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.primary, fontWeight: 700, marginTop: -10, marginBottom: 14 }}>
                  Preview: {KEY_DISPLAY[editing.settingKey].formatPreview(editValue)}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
