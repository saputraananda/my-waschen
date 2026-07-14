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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Konfigurasi Pembayaran" subtitle="Rekening bank & metode bayar" onBack={goBack} />

      {/* Tab Switcher */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.n200}`, background: C.white }}>
        {[
          { key: 'bank-accounts', label: '🏦 Rekening Bank' },
          { key: 'methods', label: '💳 Metode Bayar' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 8px', border: 'none', background: 'transparent',
              fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
              color: tab === t.key ? C.primary : C.n500,
              borderBottom: tab === t.key ? `2px solid ${C.primary}` : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Outlet Selector for Admin */}
      {tab === 'bank-accounts' && outlets.length > 1 && (
        <div style={{ padding: '8px 12px', background: C.n50, borderBottom: `1px solid ${C.n200}` }}>
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
            {/* Info Card */}
            <div style={{
              background: C.primaryLight, borderRadius: 12, padding: '12px 14px', marginBottom: 16,
              border: `1px solid ${C.primaryLight}`
            }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.primary, marginBottom: 6 }}>
                ℹ️ Cara Kerja Pembayaran
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.values(METHOD_CONFIG).map(m => (
                  <div key={m.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{m.icon}</span>
                    <div>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: m.color }}>{m.label}: </span>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>{m.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bank Accounts List */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n800 }}>
                Rekening Bank ({bankAccounts.length})
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn variant="secondary" size="sm" onClick={handleSeed}>Seed Data</Btn>
                <Btn variant="primary" size="sm" onClick={() => handleOpenModal()}>+ Tambah</Btn>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.n500 }}>Memuat...</div>
            ) : bankAccounts.length === 0 ? (
              <EmptyState
                icon="🏦"
                title="Belum ada rekening"
                desc="Tambahkan rekening bank untuk metode pembayaran transfer."
                action={
                  <Btn variant="primary" onClick={() => handleOpenModal()}>+ Tambah Rekening</Btn>
                }
              />
            ) : (
              bankAccounts.map((acc) => (
                <motion.div
                  key={acc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: C.white, borderRadius: 12, padding: '12px 14px', marginBottom: 10,
                    boxShadow: SHADOW.sm, opacity: acc.isActive === 0 ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 18 }}>🏦</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>
                          {acc.bankName}
                        </span>
                        {!acc.isActive && (
                          <span style={{
                            fontSize: 9, fontFamily: 'Poppins', fontWeight: 600,
                            background: C.n100, color: C.n500, padding: '1px 6px', borderRadius: 99
                          }}>
                            NONAKTIF
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginBottom: 2 }}>
                        {acc.accountNumber}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
                        a.n. {acc.accountHolder}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleToggleActive(acc)}
                        style={{
                          padding: '6px 10px', border: `1px solid ${acc.isActive ? C.danger : C.success}`,
                          borderRadius: 8, background: 'transparent', cursor: 'pointer',
                          fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                          color: acc.isActive ? C.danger : C.success,
                        }}
                      >
                        {acc.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button
                        onClick={() => handleOpenModal(acc)}
                        style={{
                          padding: '6px 10px', border: `1px solid ${C.n300}`,
                          borderRadius: 8, background: 'transparent', cursor: 'pointer',
                          fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700,
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(acc.id)}
                        style={{
                          padding: '6px 10px', border: `1px solid ${C.danger}`,
                          borderRadius: 8, background: 'transparent', cursor: 'pointer',
                          fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.danger,
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </>
        )}

        {tab === 'methods' && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n800, marginBottom: 12 }}>
              Metode Pembayaran
            </div>
            {PAYMENT_METHODS.map(m => (
              <div key={m.value} style={{
                background: C.white, borderRadius: 12, padding: '14px 16px', marginBottom: 10,
                boxShadow: SHADOW.sm, display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: METHOD_CONFIG[m.value]?.color + '15',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>
                  {METHOD_CONFIG[m.value]?.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>
                    {m.label}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>
                    {METHOD_CONFIG[m.value]?.desc}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Modal for Add/Edit */}
      <AnimatePresence>
        {modalOpen && (
          <Modal onClose={() => setModalOpen(false)} title={editAccount ? 'Edit Rekening' : 'Tambah Rekening'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Select
                label="Bank"
                value={form.bankName}
                onChange={(v) => setForm(f => ({ ...f, bankName: v }))}
                options={[
                  { value: '', label: 'Pilih bank...' },
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
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Btn variant="secondary" onClick={() => setModalOpen(false)} style={{ flex: 1 }}>
                  Batal
                </Btn>
                <Btn variant="primary" onClick={handleSave} loading={saving} style={{ flex: 1 }}>
                  {editAccount ? 'Simpan' : 'Tambah'}
                </Btn>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
