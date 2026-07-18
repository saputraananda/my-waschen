/**
 * CreateOutstandingPage.jsx
 * Halaman untuk membuat piutang baru
 * Design System v3.0 - CSS Variables compliant
 */

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Search,
  User,
  Phone,
  Calendar,
  DollarSign,
  Receipt,
  X,
} from 'lucide-react';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Input, MoneyInput, Modal } from '../../components/ui';
import { alertSuccess, alertError } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Glass Styles ──────────────────────────────────────────────────────────────
const GLASS_STYLES = `
  :root {
    --glass-bg: #F3EEF7;
    --glass: rgba(255, 255, 255, 0.7);
    --glass-strong: rgba(255, 255, 255, 0.85);
    --piutang-primary: #065F46;
  }
`;

function useGlassStyles() {
  useEffect(() => {
    const styleId = 'create-outstanding-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = GLASS_STYLES;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
}

// ─── Clay Card Component ──────────────────────────────────────────────────────
function ClayCard({ children, style, padding = 16, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.3 }}
      style={{
        background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
        borderRadius: 16,
        padding: padding,
        boxShadow: SHADOW.sm,
        border: '1px solid rgba(139, 92, 246, 0.06)',
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Customer Selector Modal ─────────────────────────────────────────────────
function CustomerSelector({ isOpen, onClose, onSelect }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
    }
  }, [isOpen]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/customers?limit=50');
      setCustomers(res.data.data || []);
    } catch (err) {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  };

  const filtered = customers.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const handleSelect = () => {
    if (selectedCustomer) {
      onSelect(selectedCustomer);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 480,
          maxHeight: '75vh',
          overflowY: 'auto',
          padding: '20px 20px max(20px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <div style={{
            fontFamily: FONT,
            fontSize: 16,
            fontWeight: 700,
            color: C.n900,
          }}>
            Pilih Pelanggan
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: C.n100,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} color={C.n600} />
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: C.n400,
            }}
          />
          <input
            type="text"
            placeholder="Cari nama atau telepon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 12,
              border: `1.5px solid ${C.n200}`,
              padding: '0 12px 0 38px',
              fontFamily: FONT,
              fontSize: 13,
              color: C.n900,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Customer List */}
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ color: C.n500, fontFamily: FONT, fontSize: 13 }}>
                Memuat...
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <User size={32} color={C.n300} style={{ marginBottom: 8 }} />
              <div style={{ color: C.n500, fontFamily: FONT, fontSize: 13 }}>
                Tidak ada pelanggan ditemukan
              </div>
            </div>
          ) : (
            filtered.map((customer) => (
              <motion.div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px',
                  borderRadius: 12,
                  marginBottom: 8,
                  background: selectedCustomer?.id === customer.id ? C.primaryTint : 'transparent',
                  border: `2px solid ${selectedCustomer?.id === customer.id ? C.primary : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: C.primaryTint,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <User size={18} color={C.primary} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: FONT,
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.n900,
                  }}>
                    {customer.name}
                  </div>
                  <div style={{
                    fontFamily: FONT,
                    fontSize: 11,
                    color: C.n500,
                  }}>
                    {customer.phone}
                  </div>
                </div>
                {customer.is_member === 1 && (
                  <div style={{
                    padding: '3px 8px',
                    borderRadius: 10,
                    background: C.successBg,
                    fontFamily: FONT,
                    fontSize: 9,
                    fontWeight: 600,
                    color: C.success,
                  }}>
                    Member
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Select Button */}
        <motion.button
          whileTap={{ scale: selectedCustomer ? 0.98 : 1 }}
          onClick={handleSelect}
          disabled={!selectedCustomer}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 14,
            border: 'none',
            background: selectedCustomer
              ? 'linear-gradient(145deg, #047857, #065F46)'
              : C.n300,
            color: C.white,
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 600,
            cursor: selectedCustomer ? 'pointer' : 'not-allowed',
            marginTop: 16,
          }}
        >
          Pilih {selectedCustomer?.name || ''}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── Transaction Selector Modal ────────────────────────────────────────────────
function TransactionSelector({ isOpen, onClose, customerId, onSelect }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    if (isOpen && customerId) {
      loadTransactions();
    }
  }, [isOpen, customerId]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/transactions?customerId=${customerId}&paymentStatus=partial,unpaid&limit=20`);
      const txs = res.data.data || [];
      // Filter transactions that have remaining payment
      const unpaidTxs = txs.filter((t) => {
        const total = parseFloat(t.total || 0);
        const paid = parseFloat(t.paidAmount || t.paid_amount || 0);
        return total > paid;
      });
      setTransactions(unpaidTxs);
    } catch (err) {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedTx) {
      onSelect(selectedTx);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 480,
          maxHeight: '75vh',
          overflowY: 'auto',
          padding: '20px 20px max(20px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <div style={{
            fontFamily: FONT,
            fontSize: 16,
            fontWeight: 700,
            color: C.n900,
          }}>
            Pilih Transaksi (Opsional)
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: C.n100,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} color={C.n600} />
          </button>
        </div>

        <div style={{
          fontFamily: FONT,
          fontSize: 12,
          color: C.n500,
          marginBottom: 16,
        }}>
          Pilih transaksi terkait piutang ini (atau kosongkan untuk piutang umum)
        </div>

        {/* Transaction List */}
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ color: C.n500, fontFamily: FONT, fontSize: 13 }}>
                Memuat...
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Receipt size={32} color={C.n300} style={{ marginBottom: 8 }} />
              <div style={{ color: C.n500, fontFamily: FONT, fontSize: 13 }}>
                Tidak ada transaksi belum lunas
              </div>
              <div style={{
                color: C.n400,
                fontFamily: FONT,
                fontSize: 11,
                marginTop: 4,
              }}>
                Piutang akan dibuat tanpa transaksi terkait
              </div>
            </div>
          ) : (
            transactions.map((tx) => {
              const total = parseFloat(tx.total || 0);
              const paid = parseFloat(tx.paidAmount || tx.paid_amount || 0);
              const remaining = total - paid;

              return (
                <motion.div
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    borderRadius: 12,
                    marginBottom: 8,
                    background: selectedTx?.id === tx.id ? C.primaryTint : C.n50,
                    border: `2px solid ${selectedTx?.id === tx.id ? C.primary : 'transparent'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{
                      fontFamily: FONT,
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.n900,
                    }}>
                      {tx.transactionNo || tx.transaction_no}
                    </div>
                    <div style={{
                      fontFamily: FONT,
                      fontSize: 11,
                      color: C.n500,
                    }}>
                      {new Date(tx.createdAt || tx.created_at).toLocaleDateString('id-ID')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: FONT,
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.danger,
                    }}>
                      {rp(remaining)}
                    </div>
                    <div style={{
                      fontFamily: FONT,
                      fontSize: 10,
                      color: C.n400,
                    }}>
                      dari {rp(total)}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Skip Option */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            onSelect(null);
            onClose();
          }}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 14,
            border: `1.5px solid ${C.n200}`,
            background: C.white,
            color: C.n600,
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 16,
          }}
        >
          Lewati (Tanpa Transaksi)
        </motion.button>

        {/* Select Button */}
        {selectedTx && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSelect}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(145deg, #047857, #065F46)',
              color: C.white,
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 10,
            }}
          >
            Pilih Transaksi Ini
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function CreateOutstandingPage({ navigate, goBack }) {
  useGlassStyles();
  const { isMobile } = useResponsive();

  const [form, setForm] = useState({
    customerId: '',
    customerName: '',
    transactionId: '',
    amount: '',
    dueDate: '',
    notes: '',
  });
  const [showCustomer, setShowCustomer] = useState(false);
  const [showTransaction, setShowTransaction] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Calculate default due date (7 days from now)
  useEffect(() => {
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 7);
    setForm((prev) => ({
      ...prev,
      dueDate: defaultDue.toISOString().split('T')[0],
    }));
  }, []);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!form.customerId) return false;
    if (!form.amount || parseFloat(form.amount) <= 0) return false;
    return true;
  }, [submitting, form]);

  const handleCustomerSelect = (customer) => {
    setForm((prev) => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
    }));
  };

  const handleTransactionSelect = (tx) => {
    if (tx) {
      setForm((prev) => ({
        ...prev,
        transactionId: tx.id,
        amount: String(parseFloat(tx.total || 0) - parseFloat(tx.paidAmount || tx.paid_amount || 0)),
      }));
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const payload = {
        customerId: parseInt(form.customerId),
        amount: parseFloat(form.amount),
        dueDate: form.dueDate || null,
        transactionId: form.transactionId || null,
        notes: form.notes || null,
      };

      const res = await axios.post('/api/outstandings', payload);

      alertSuccess('Piutang berhasil dibuat!');
      navigate('outstanding_list', {}, { replace: true });
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal membuat piutang');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--glass-bg)',
      overflow: 'hidden',
    }}>
      <TopBar
        title="Tambah Piutang"
        onBack={goBack}
      />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? 12 : 16,
        paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '100px',
      }}>
        {/* Header Info */}
        <ClayCard padding={16} delay={0}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: C.successBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <DollarSign size={24} color={C.success} />
            </div>
            <div>
              <div style={{
                fontFamily: FONT,
                fontSize: 14,
                fontWeight: 700,
                color: C.n900,
              }}>
                Catat Piutang Baru
              </div>
              <div style={{
                fontFamily: FONT,
                fontSize: 12,
                color: C.n500,
              }}>
                Tambahkan piutang pelanggan
              </div>
            </div>
          </div>
        </ClayCard>

        {/* Customer Selection */}
        <ClayCard padding={16} delay={1} style={{ marginTop: 12 }}>
          <div style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 700,
            color: C.n500,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 12,
          }}>
            Pelanggan *
          </div>

          {form.customerId ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              background: C.successBg,
              borderRadius: 12,
              border: `1px solid ${C.success}30`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: C.white,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <User size={16} color={C.success} />
                </div>
                <div>
                  <div style={{
                    fontFamily: FONT,
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.n900,
                  }}>
                    {form.customerName}
                  </div>
                  {form.phone && (
                    <div style={{
                      fontFamily: FONT,
                      fontSize: 11,
                      color: C.n500,
                    }}>
                      {form.phone}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowCustomer(true)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: C.white,
                  border: `1px solid ${C.n200}`,
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 500,
                  color: C.n600,
                  cursor: 'pointer',
                }}
              >
                Ubah
              </button>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCustomer(true)}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                border: `2px dashed ${C.n300}`,
                background: C.white,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 500,
                color: C.n500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <User size={16} />
              Pilih Pelanggan
            </motion.button>
          )}
        </ClayCard>

        {/* Transaction Selection (Optional) */}
        <ClayCard padding={16} delay={2} style={{ marginTop: 12 }}>
          <div style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 700,
            color: C.n500,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 4,
          }}>
            Transaksi (Opsional)
          </div>
          <div style={{
            fontFamily: FONT,
            fontSize: 11,
            color: C.n400,
            marginBottom: 12,
          }}>
            Hubungkan dengan transaksi yang belum lunas
          </div>

          {form.transactionId ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              background: C.primaryTint,
              borderRadius: 12,
              border: `1px solid ${C.primary}30`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Receipt size={16} color={C.primary} />
                <div style={{
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.n900,
                }}>
                  Terhubung dengan transaksi
                </div>
              </div>
              <button
                onClick={() => setShowTransaction(true)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: C.white,
                  border: `1px solid ${C.n200}`,
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 500,
                  color: C.n600,
                  cursor: 'pointer',
                }}
              >
                Ubah
              </button>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowTransaction(true)}
              disabled={!form.customerId}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                border: `1.5px solid ${C.n200}`,
                background: C.white,
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 500,
                color: form.customerId ? C.n600 : C.n400,
                cursor: form.customerId ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Receipt size={14} />
              {form.customerId ? 'Pilih Transaksi' : 'Pilih Pelanggan dulu'}
            </motion.button>
          )}
        </ClayCard>

        {/* Amount */}
        <ClayCard padding={16} delay={3} style={{ marginTop: 12 }}>
          <MoneyInput
            label="Jumlah Piutang"
            value={form.amount}
            onChange={(val) => setForm((prev) => ({ ...prev, amount: val }))}
            placeholder="0"
          />
        </ClayCard>

        {/* Due Date */}
        <ClayCard padding={16} delay={4} style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
              color: C.n600,
              marginBottom: 6,
            }}>
              Jatuh Tempo
            </div>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              style={{
                width: '100%',
                height: 46,
                borderRadius: 12,
                border: `1.5px solid ${C.n200}`,
                padding: '0 14px',
                fontFamily: FONT,
                fontSize: 13,
                color: C.n900,
                outline: 'none',
                boxSizing: 'border-box',
                background: C.white,
              }}
            />
          </div>
        </ClayCard>

        {/* Notes */}
        <ClayCard padding={16} delay={5} style={{ marginTop: 12 }}>
          <Input
            label="Catatan (Opsional)"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Tambahkan catatan jika diperlukan..."
          />
        </ClayCard>
      </div>

      {/* Bottom Action */}
      <div style={{
        padding: isMobile ? '12px 16px' : '16px 24px',
        paddingBottom: isMobile ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : 16,
        background: C.white,
        borderTop: `1px solid ${C.n100}`,
      }}>
        <motion.button
          whileTap={{ scale: canSubmit ? 0.98 : 1 }}
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: '100%',
            height: 50,
            borderRadius: 14,
            border: 'none',
            background: canSubmit
              ? 'linear-gradient(145deg, #047857, #065F46)'
              : C.n300,
            color: C.white,
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            boxShadow: canSubmit ? '0 4px 12px rgba(6, 95, 70, 0.35)' : 'none',
          }}
        >
          {submitting ? 'Memproses...' : 'Simpan Piutang'}
        </motion.button>
      </div>

      {/* Modals */}
      <CustomerSelector
        isOpen={showCustomer}
        onClose={() => setShowCustomer(false)}
        onSelect={handleCustomerSelect}
      />
      <TransactionSelector
        isOpen={showTransaction}
        onClose={() => setShowTransaction(false)}
        customerId={form.customerId}
        onSelect={handleTransactionSelect}
      />
    </div>
  );
}
