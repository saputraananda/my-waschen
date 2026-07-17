// ─────────────────────────────────────────────────────────────────────────────
// AdminPaymentConfigPage — Manage Bank Accounts & Payment Methods
// Flow: Tunai (laci fisik), EDC (mesin), QRIS/Transfer (konfirmasi + foto)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile } from '../../utils/hooks';
import { TopBar, Btn, Modal, Input, Select, EmptyState } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { GlowOrb, FloatingBubble } from '../../components/ui/PremiumAnimations';

const METHOD_CONFIG = {
  cash:     { label: 'Tunai', icon: '💵', color: '#059669', desc: 'Uang fisik masuk laci kasir. Sistem menghitung kembalian.' },
  edc:      { label: 'EDC', icon: '💳', color: '#7C3AED', desc: 'Gesek kartu di mesin EDC. Frontliner konfirmasi setelah customer bayar.' },
  qris:     { label: 'QRIS', icon: '📱', color: '#0EA5E9', desc: 'Customer scan QR sendiri. Frontliner konfirmasi: sudah bayar belum?' },
  transfer: { label: 'Transfer', icon: '🏦', color: '#8B5CF6', desc: 'Customer transfer ke rekening. Frontliner konfirmasi + foto bukti dari HP customer.' },
  deposit:  { label: 'Deposit', icon: '🎁', color: '#F59E0B', desc: 'Potong dari saldo deposit customer.' },
};

const PAYMENT_METHODS = [
  { value: 'cash', label: '💵 Tunai — Laci kasir' },
  { value: 'edc', label: '💳 EDC — Mesin kartu' },
  { value: 'qris', label: '📱 QRIS — Pembayaran digital' },
  { value: 'transfer', label: '🏦 Transfer — Rekening bank' },
  { value: 'deposit', label: '🎁 Deposit — Saldo customer' },
];

// Premium styles
const cardGradient = 'linear-gradient(145deg, #FFFFFF, #F8F4FF)';
const cardShadow = '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)';

// Skeleton loading
const shimmerStyle = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
};

const SkeletonBlock = ({ height = 20, width = '100%', style = {} }) => (
  <div style={{ height, width, borderRadius: 10, ...shimmerStyle, ...style }} />
);

export default function AdminPaymentConfigPage({ goBack }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('bank-accounts');
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [form, setForm] = useState({ bankName: '', accountNumber: '', accountHolder: '', displayOrder: 0 });
  const [saving, setSaving] = useState(false);

  // Fetch outlets for admin
  const fetchOutlets = useCallback(async () => {
    try {
      const res = await axios.get('/api/outlets/admin/all');
      setOutlets(res.data?.data || []);
      if (res.data?.data?.length > 0 && !selectedOutlet) {
        setSelectedOutlet(res.data.data[0].id);
      }
    } catch {
      console.error('Failed to fetch outlets');
    }
  }, [selectedOutlet]);

  // Fetch bank accounts
  const fetchBankAccounts = useCallback(async () => {
    if (!selectedOutlet) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/outlets/${selectedOutlet}/bank-accounts`);
      setBankAccounts(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch bank accounts:', err);
      setBankAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedOutlet]);

  useEffect(() => { fetchOutlets(); }, []);
  useEffect(() => { if (selectedOutlet) fetchBankAccounts(); }, [selectedOutlet, fetchBankAccounts]);

  const handleOpenModal = (account = null) => {
    if (account) {
      setEditAccount(account);
      setForm({
        bankName: account.bankName || '',
        accountNumber: account.accountNumber || '',
        accountHolder: account.accountHolder || '',
        displayOrder: account.displayOrder || 0,
      });
    } else {
      setEditAccount(null);
      setForm({ bankName: '', accountNumber: '', accountHolder: '', displayOrder: bankAccounts.length + 1 });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountHolder.trim()) {
      alertWarning('Semua field wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      if (editAccount) {
        await axios.put(`/api/bank-accounts/${editAccount.id}`, form);
        alertSuccess('Rekening berhasil diperbarui.');
      } else {
        await axios.post('/api/bank-accounts', { ...form, outletId: selectedOutlet });
        alertSuccess('Rekening berhasil ditambahkan.');
      }
      setModalOpen(false);
      fetchBankAccounts();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus rekening ini?')) return;
    try {
      await axios.delete(`/api/bank-accounts/${id}`);
      alertSuccess('Rekening berhasil dihapus.');
      fetchBankAccounts();
    } catch {
      alertError('Gagal menghapus rekening.');
    }
  };

  const handleToggleActive = async (account) => {
    try {
      await axios.put(`/api/bank-accounts/${account.id}`, { isActive: !account.isActive });
      alertSuccess(`Rekening ${account.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      fetchBankAccounts();
    } catch {
      alertError('Gagal mengubah status.');
    }
  };

  const handleSeed = async () => {
    try {
      const res = await axios.post('/api/bank-accounts/seed');
      alertSuccess(res.data.message);
      fetchBankAccounts();
    } catch {
      alertError('Gagal seed data.');
    }
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--glass-bg, #F3EEF7)', overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Background decorative elements */}
      <GlowOrb color="#5B005F" size={260} top="-70px" right="-70px" opacity={0.07} />
      <GlowOrb color="#7C3AED" size={160} bottom="200px" left="-50px" opacity={0.05} />
      <FloatingBubble color="#5B005F" size={10} top="20%" right="5%" delay={0.3} />
      <FloatingBubble color="#E8D5F0" size={12} bottom="40%" left="3%" delay={1.2} />

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <TopBar title="Konfigurasi Pembayaran" subtitle="Rekening bank & metode bayar" onBack={goBack} />

      {/* Premium Tab Switcher */}
      <div style={{
        display: 'flex',
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(110, 46, 120, 0.1)',
      }}>
        {[
          { key: 'bank-accounts', label: '🏦 Rekening Bank' },
          { key: 'methods', label: '💳 Metode Bayar' },
        ].map(t => (
          <motion.button
            key={t.key}
            onClick={() => setTab(t.key)}
            whileTap={{ scale: 0.98 }}
            style={{
              flex: 1, padding: '12px 8px', border: 'none',
              background: tab === t.key ? cardGradient : 'transparent',
              fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
              color: tab === t.key ? C.primary : C.n500,
              borderBottom: tab === t.key ? '3px solid #5B005F' : '3px solid transparent',
              cursor: 'pointer',
              boxShadow: tab === t.key ? '0 4px 12px rgba(91, 0, 95, 0.08)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      {/* Outlet Selector for Admin */}
      {tab === 'bank-accounts' && outlets.length > 1 && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(110, 46, 120, 0.08)',
        }}>
          <Select
            label="Outlet"
            value={selectedOutlet}
            onChange={(v) => setSelectedOutlet(v)}
            options={outlets.map(o => ({ value: o.id, label: o.name }))}
          />
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 12px' : '16px' }}>
        {tab === 'bank-accounts' && (
          <>
            {/* Premium Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: cardGradient,
                borderRadius: 18, padding: '14px 16px', marginBottom: 16,
                boxShadow: cardShadow,
                border: '1px solid rgba(91, 0, 95, 0.08)',
              }}
            >
              <div style={{
                fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                color: C.primary, marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 16 }}>ℹ️</span> Cara Kerja Pembayaran
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.values(METHOD_CONFIG).map(m => (
                  <div key={m.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: `${m.color}15`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, flexShrink: 0,
                      boxShadow: `0 2px 8px ${m.color}18`,
                    }}>
                      {m.icon}
                    </div>
                    <div>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: m.color }}>{m.label}: </span>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>{m.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Premium Bank Accounts Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 14,
              padding: '10px 14px',
              background: cardGradient,
              borderRadius: 14,
              boxShadow: '0 4px 12px rgba(110, 46, 120, 0.08)',
            }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n800 }}>
                Rekening Bank ({bankAccounts.length})
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSeed}
                  style={{
                    padding: '7px 12px', borderRadius: 10,
                    background: cardGradient,
                    border: '1.5px solid rgba(110, 46, 120, 0.15)',
                    fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(110, 46, 120, 0.06)',
                  }}
                >
                  Seed Data
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleOpenModal()}
                  style={{
                    padding: '7px 14px', borderRadius: 10,
                    background: 'linear-gradient(135deg, #5B005F, #4D0051)',
                    border: 'none',
                    fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#FFFFFF',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(91, 0, 95, 0.3)',
                  }}
                >
                  + Tambah
                </motion.button>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    style={{
                      background: cardGradient, borderRadius: 16, padding: '14px 16px',
                      boxShadow: cardShadow,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <SkeletonBlock height={16} width={120} style={{ marginBottom: 6 }} />
                        <SkeletonBlock height={12} width={100} />
                        <SkeletonBlock height={10} width={140} />
                      </div>
                      <SkeletonBlock height={32} width={80} style={{ borderRadius: 8 }} />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : bankAccounts.length === 0 ? (
              <EmptyState
                icon="🏦"
                title="Belum ada rekening"
                desc="Tambahkan rekening bank untuk metode pembayaran transfer."
                action={
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleOpenModal()}
                    style={{
                      padding: '10px 18px', borderRadius: 12,
                      background: 'linear-gradient(135deg, #5B005F, #4D0051)',
                      border: 'none',
                      fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#FFFFFF',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(91, 0, 95, 0.3)',
                    }}
                  >
                    + Tambah Rekening
                  </motion.button>
                }
              />
            ) : (
              bankAccounts.map((acc, idx) => (
                <motion.div
                  key={acc.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{
                    background: cardGradient, borderRadius: 18, padding: '14px 16px', marginBottom: 12,
                    boxShadow: cardShadow,
                    opacity: acc.isActive === 0 ? 0.65 : 1,
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  {/* Top accent line */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: acc.isActive
                      ? 'linear-gradient(90deg, #5B005F, #9B59B6)'
                      : 'linear-gradient(90deg, #9CA3AF, #D1D5DB)',
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, paddingTop: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: 12,
                          background: cardGradient,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22,
                          boxShadow: '0 4px 12px rgba(91, 0, 95, 0.12), -2px -2px 6px rgba(255, 255, 255, 0.9)',
                        }}>
                          🏦
                        </div>
                        <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>
                          {acc.bankName}
                        </span>
                        {!acc.isActive && (
                          <span style={{
                            fontSize: 9, fontFamily: 'Poppins', fontWeight: 700,
                            background: C.n100, color: C.n500, padding: '2px 8px', borderRadius: 99,
                            letterSpacing: 0.5,
                          }}>
                            NONAKTIF
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n700, marginBottom: 2, marginLeft: 52 }}>
                        {acc.accountNumber}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginLeft: 52 }}>
                        a.n. {acc.accountHolder}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleToggleActive(acc)}
                        style={{
                          padding: '7px 12px', border: `1.5px solid ${acc.isActive ? C.danger : C.success}`,
                          borderRadius: 10, background: cardGradient, cursor: 'pointer',
                          fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                          color: acc.isActive ? C.danger : C.success,
                          boxShadow: `0 2px 8px ${acc.isActive ? C.danger : C.success}15`,
                        }}
                      >
                        {acc.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleOpenModal(acc)}
                        style={{
                          padding: '7px 12px', border: '1.5px solid rgba(110, 46, 120, 0.2)',
                          borderRadius: 10, background: cardGradient, cursor: 'pointer',
                          fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700,
                          boxShadow: '0 2px 8px rgba(110, 46, 120, 0.08)',
                        }}
                      >
                        Edit
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleDelete(acc.id)}
                        style={{
                          padding: '7px 12px', border: `1.5px solid ${C.danger}`,
                          borderRadius: 10, background: cardGradient, cursor: 'pointer',
                          fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.danger,
                          boxShadow: `0 2px 8px ${C.danger}15`,
                        }}
                      >
                        Hapus
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </>
        )}

        {tab === 'methods' && (
          <>
            <div style={{
              fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n800,
              marginBottom: 14, padding: '10px 14px',
              background: cardGradient, borderRadius: 14,
              boxShadow: '0 4px 12px rgba(110, 46, 120, 0.08)',
            }}>
              Metode Pembayaran
            </div>
            {PAYMENT_METHODS.map((m, idx) => (
              <motion.div
                key={m.value}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{
                  background: cardGradient, borderRadius: 18, padding: '16px 18px', marginBottom: 12,
                  boxShadow: cardShadow,
                  display: 'flex', alignItems: 'center', gap: 14,
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {/* Left accent */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
                  background: METHOD_CONFIG[m.value]?.color,
                  borderRadius: '18px 0 0 18px',
                }} />

                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: `${METHOD_CONFIG[m.value]?.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0, marginLeft: 8,
                  boxShadow: `0 4px 14px ${METHOD_CONFIG[m.value]?.color}20`,
                }}>
                  {METHOD_CONFIG[m.value]?.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>
                    {m.label}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>
                    {METHOD_CONFIG[m.value]?.desc}
                  </div>
                </div>
              </motion.div>
            ))}
          </>
        )}
      </div>

      {/* Premium Modal for Add/Edit */}
      <AnimatePresence>
        {modalOpen && (
          <Modal onClose={() => setModalOpen(false)} title={editAccount ? 'Edit Rekening' : 'Tambah Rekening'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Select
                label="Bank"
                value={form.bankName}
                onChange={(v) => setForm(f => ({ ...f, bankName: v }))}
                options={[
                  { value: '', label: 'Pilih bank...' },
                  // TODO: Fetch from API /api/master/banks when endpoint is available
                  { value: 'BCA', label: '🏦 BCA' },
                  { value: 'Mandiri', label: '🏦 Mandiri' },
                  { value: 'BNI', label: '🏦 BNI' },
                  { value: 'BRI', label: '🏦 BRI' },
                  { value: 'BTPN', label: '🏦 BTPN / Jenius' },
                  { value: 'CIMB', label: '🏦 CIMB Niaga' },
                  { value: 'Danamon', label: '🏦 Danamon' },
                  { value: 'BSI', label: '🏦 BSI' },
                  { value: 'OVO', label: '📱 OVO' },
                  { value: 'DANA', label: '📱 DANA' },
                  { value: 'GoPay', label: '📱 GoPay' },
                ]}
              />
              <Input
                label="Nomor Rekening"
                value={form.accountNumber}
                onChange={(v) => setForm(f => ({ ...f, accountNumber: v }))}
                placeholder="Contoh: 1234567890"
              />
              <Input
                label="Nama Pemilik Rekening"
                value={form.accountHolder}
                onChange={(v) => setForm(f => ({ ...f, accountHolder: v }))}
                placeholder="Contoh: PT Laundry Bersih Indonesia"
              />
              <Input
                label="Urutan Tampilan"
                type="number"
                value={form.displayOrder}
                onChange={(v) => setForm(f => ({ ...f, displayOrder: Number(v) || 0 }))}
                placeholder="1"
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setModalOpen(false)}
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
                  {editAccount ? 'Simpan' : 'Tambah'}
                </motion.button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
