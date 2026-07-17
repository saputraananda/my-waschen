// Admin: Settings (key-value config)
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Btn, Modal, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { listSettings, updateSetting } from '../../utils/outletCashApi';
import { GlowOrb, FloatingBubble } from '../../components/ui/PremiumAnimations';

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

// Premium card styles
const cardGradient = 'linear-gradient(145deg, #FFFFFF, #F8F4FF)';
const cardShadow = '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)';
const innerGlowShadow = 'inset 0 2px 4px rgba(255, 255, 255, 0.8), inset 0 -2px 4px rgba(110, 46, 120, 0.05)';

// Skeleton loading
const shimmerStyle = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
};

const SkeletonBlock = ({ height = 20, width = '100%', style = {} }) => (
  <div style={{ height, width, borderRadius: 10, ...shimmerStyle, ...style }} />
);

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
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--glass-bg, #F3EEF7)', overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Background decorative elements */}
      <GlowOrb color="#5B005F" size={280} top="-80px" right="-80px" opacity={0.07} />
      <GlowOrb color="#9B59B6" size={180} bottom="150px" left="-60px" opacity={0.05} />
      <FloatingBubble color="#5B005F" size={10} top="25%" right="6%" delay={0.5} />
      <FloatingBubble color="#E8D5F0" size={14} bottom="30%" left="4%" delay={1.5} />

      <style>{`
        @media (max-width: 480px) {
          .settings-modal-inputs { gap: 8px !important; }
          .settings-item-row { flex-direction: column !important; gap: 10px !important; }
          .settings-item-row > button { width: 100% !important; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <TopBar title="Pengaturan Sistem" subtitle={`${settings.length} konfigurasi`} onBack={goBack} />

      {/* Premium Quick Access */}
      <div style={{
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(110, 46, 120, 0.08)',
      }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate && navigate('admin_payment_config')}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 12,
              background: cardGradient,
              border: '1.5px solid rgba(110, 46, 120, 0.15)',
              fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.primary,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '4px 4px 12px rgba(110, 46, 120, 0.1), -2px -2px 8px rgba(255, 255, 255, 0.9)',
            }}
          >
            💳 Konfigurasi Pembayaran
          </motion.button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                style={{
                  background: cardGradient, borderRadius: 18, padding: '16px 18px',
                  boxShadow: cardShadow,
                }}
              >
                <SkeletonBlock height={14} width="30%" style={{ marginBottom: 12 }} />
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  background: C.n50, borderRadius: 12, padding: '12px 14px',
                  ...innerGlowShadow,
                }}>
                  <div style={{ flex: 1 }}>
                    <SkeletonBlock height={16} width="60%" style={{ marginBottom: 6 }} />
                    <SkeletonBlock height={10} width="40%" />
                  </div>
                  <SkeletonBlock height={32} width={70} style={{ borderRadius: 10 }} />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && settings.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 24px', gap: 10,
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              background: cardGradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '12px 12px 28px rgba(110, 46, 120, 0.15), -6px -6px 16px rgba(255, 255, 255, 0.95)',
            }}>
              <span style={{ fontSize: 36 }}>⚙️</span>
            </div>
            <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n700 }}>Belum ada settings</span>
          </div>
        )}

        {!loading && Object.entries(grouped).map(([cat, list], catIdx) => {
          const meta = CATEGORY_META[cat] || CATEGORY_META.general;
          return (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: catIdx * 0.06 }}
              style={{ marginBottom: 20 }}
            >
              <div style={{
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                color: meta.color, textTransform: 'uppercase', letterSpacing: 0.5,
                marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                background: `${meta.color}10`,
                borderRadius: 10,
              }}>
                <span style={{ fontSize: 16 }}>{meta.label.split(' ')[0]}</span>
                <span>{meta.label.split(' ').slice(1).join(' ')}</span>
              </div>
              {list.map((s, idx) => {
                const display = KEY_DISPLAY[s.settingKey] || {};
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (catIdx * list.length + idx) * 0.03 }}
                    style={{
                      background: cardGradient, borderRadius: 18, padding: '16px 18px',
                      marginBottom: 12, boxShadow: cardShadow,
                      borderLeft: `4px solid ${meta.color}`,
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    {/* Inner subtle glow */}
                    <div style={{
                      position: 'absolute', top: 0, right: 0, width: 100, height: 100,
                      background: `radial-gradient(circle at top right, ${meta.color}08, transparent 60%)`,
                      pointerEvents: 'none',
                    }} />

                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      gap: 12, flexWrap: 'wrap', position: 'relative', zIndex: 1,
                    }} className="settings-item-row">
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
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setEditing(s); setEditValue(s.settingValue); }}
                        style={{
                          padding: '8px 16px', borderRadius: 12, flexShrink: 0,
                          border: '2px solid rgba(91, 0, 95, 0.25)',
                          background: 'linear-gradient(135deg, rgba(91, 0, 95, 0.08), rgba(91, 0, 95, 0.04))',
                          color: C.primary, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(91, 0, 95, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.8)',
                          backdropFilter: 'blur(8px)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(91, 0, 95, 0.15), rgba(91, 0, 95, 0.08))';
                          e.currentTarget.style.borderColor = C.primary;
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(91, 0, 95, 0.18)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(91, 0, 95, 0.08), rgba(91, 0, 95, 0.04))';
                          e.currentTarget.style.borderColor = 'rgba(91, 0, 95, 0.25)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(91, 0, 95, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.8)';
                        }}
                      >
                        Ubah
                      </motion.button>
                    </div>
                    <div style={{
                      marginTop: 14, padding: '12px 16px',
                      background: cardGradient,
                      borderRadius: 12, border: `1.5px solid ${meta.border}`,
                      fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: meta.color,
                      boxShadow: innerGlowShadow,
                      position: 'relative', zIndex: 1,
                    }}>
                      {display.formatPreview ? display.formatPreview(s.settingValue) : s.settingValue}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          );
        })}
      </div>

      {/* Premium Edit Modal */}
      <Modal visible={!!editing} onClose={() => setEditing(null)} title={editing ? `Ubah: ${KEY_DISPLAY[editing.settingKey]?.label || editing.settingKey}` : ''}>
        <div style={{ padding: '8px 4px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="settings-modal-inputs">
            {editing && (
              <>
                {KEY_DISPLAY[editing.settingKey]?.helper && (
                  <div style={{
                    background: cardGradient,
                    border: '1.5px solid rgba(14, 165, 233, 0.2)',
                    borderRadius: 12, padding: '12px 16px',
                    fontFamily: 'Poppins', fontSize: 12, color: C.info,
                    lineHeight: 1.5,
                    boxShadow: '0 4px 12px rgba(14, 165, 233, 0.1)',
                  }}>
                    💡 {KEY_DISPLAY[editing.settingKey].helper}
                  </div>
                )}

                {editing.dataType === 'boolean' ? (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 12 }}>
                      Status: {editValue === 'true' || editValue === '1' ? '✅ Aktif' : '❌ Nonaktif'}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setEditValue('true')}
                        style={{
                          flex: 1, padding: '14px 16px', borderRadius: 12,
                          border: `2px solid ${editValue === 'true' || editValue === '1' ? C.success : 'rgba(5, 150, 105, 0.2)'}`,
                          background: editValue === 'true' || editValue === '1' ? cardGradient : 'rgba(255,255,255,0.7)',
                          cursor: 'pointer', fontFamily: 'Poppins', fontSize: 14, fontWeight: 600,
                          color: editValue === 'true' || editValue === '1' ? C.success : C.n600,
                          boxShadow: editValue === 'true' || editValue === '1' ? '0 4px 12px rgba(5, 150, 105, 0.2)' : 'none',
                          backdropFilter: 'blur(10px)',
                        }}
                      >
                        ✅ Aktif
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setEditValue('false')}
                        style={{
                          flex: 1, padding: '14px 16px', borderRadius: 12,
                          border: `2px solid ${editValue === 'false' || editValue === '0' ? C.danger : 'rgba(220, 38, 38, 0.2)'}`,
                          background: editValue === 'false' || editValue === '0' ? cardGradient : 'rgba(255,255,255,0.7)',
                          cursor: 'pointer', fontFamily: 'Poppins', fontSize: 14, fontWeight: 600,
                          color: editValue === 'false' || editValue === '0' ? C.danger : C.n600,
                          boxShadow: editValue === 'false' || editValue === '0' ? '0 4px 12px rgba(220, 38, 38, 0.2)' : 'none',
                          backdropFilter: 'blur(10px)',
                        }}
                      >
                        ❌ Nonaktif
                      </motion.button>
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
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: 12,
                        border: '1.5px solid rgba(110, 46, 120, 0.15)',
                        background: 'rgba(255,255,255,0.95)',
                        fontFamily: 'Poppins', fontSize: 14, color: C.n900,
                        outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                        boxShadow: innerGlowShadow,
                      }}
                    />
                  </div>
                )}

                {editing.dataType === 'number' && KEY_DISPLAY[editing.settingKey]?.formatPreview && editValue && (
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 12, color: C.primary, fontWeight: 600,
                    marginTop: -6, marginBottom: 14,
                    padding: '8px 12px',
                    background: `${C.primary}10`,
                    borderRadius: 8,
                  }}>
                    Preview: {KEY_DISPLAY[editing.settingKey].formatPreview(editValue)}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setEditing(null)}
                    style={{
                      flex: 1, padding: '12px 16px', borderRadius: 12,
                      background: cardGradient,
                      border: '1.5px solid rgba(110, 46, 120, 0.15)',
                      fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(110, 46, 120, 0.08)',
                    }}
                  >
                    Batal
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      flex: 1, padding: '12px 16px', borderRadius: 12,
                      background: 'linear-gradient(135deg, #5B005F, #4D0051)',
                      border: 'none',
                      fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: '#FFFFFF',
                      cursor: saving ? 'wait' : 'pointer',
                      boxShadow: '0 4px 16px rgba(91, 0, 95, 0.35)',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </motion.button>
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
