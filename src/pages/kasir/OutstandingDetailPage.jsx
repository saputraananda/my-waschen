/**
 * OutstandingDetailPage.jsx
 * Halaman detail Piutang dengan opsi pembayaran dan reminder
 * Design System v3.0 - CSS Variables compliant
 */

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle,
  MessageCircle,
  Phone,
  Calendar,
  User,
  DollarSign,
  Receipt,
  Send,
  X,
  RefreshCw,
  FileText,
  Edit,
} from 'lucide-react';
import { C, SHADOW } from '../../utils/theme';
import { rp, buildWaMeLink, buildCallLink } from '../../utils/helpers';
import { TopBar, Btn, Badge, Modal, Input, MoneyInput, EmptyState } from '../../components/ui';
import { alertSuccess, alertError } from '../../utils/alert';
import PaymentMethodGrouped from '../../components/PaymentMethodGrouped';
import { useResponsive } from '../../utils/hooks';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Status Configuration ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  unpaid: {
    label: 'Belum Bayar',
    color: C.danger,
    bg: C.dangerBg,
    border: C.dangerBg,
    icon: Clock,
  },
  partial: {
    label: 'Sebagian',
    color: C.warning,
    bg: C.warningBg,
    border: C.warningBg,
    icon: AlertCircle,
  },
  paid: {
    label: 'Lunas',
    color: C.success,
    bg: C.successBg,
    border: C.successBg,
    icon: CheckCircle,
  },
  overdue: {
    label: 'Jatuh Tempo',
    color: C.danger,
    bg: C.dangerBg,
    border: C.dangerBg,
    icon: AlertCircle,
  },
  written_off: {
    label: 'Write-Off',
    color: C.n500,
    bg: C.n100,
    border: C.n100,
    icon: Clock,
  },
};

// ─── Glass Styles ──────────────────────────────────────────────────────────────
const GLASS_STYLES = `
  :root {
    --glass-bg: #F3EEF7;
    --glass: rgba(255, 255, 255, 0.7);
    --glass-strong: rgba(255, 255, 255, 0.85);
    --piutang-primary: #065F46;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

function useGlassStyles() {
  useEffect(() => {
    const styleId = 'outstanding-detail-styles';
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

// ─── Info Row Component ────────────────────────────────────────────────────────
function InfoRow({ label, value, icon: Icon, valueColor, small }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: small ? '6px 0' : '10px 0',
      borderBottom: `1px solid ${C.n100}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={14} color={C.n400} />}
        <span style={{ fontFamily: FONT, fontSize: 12, color: C.n500 }}>{label}</span>
      </div>
      <span style={{
        fontFamily: FONT,
        fontSize: small ? 12 : 14,
        fontWeight: 600,
        color: valueColor || C.n900,
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── Payment Modal Component ───────────────────────────────────────────────────
function PaymentModal({ isOpen, onClose, outstanding, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(null);
  const [ref, setRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const remaining = parseFloat(outstanding?.remaining_amount || 0);

  useEffect(() => {
    if (isOpen && remaining > 0) {
      setAmount(String(remaining));
    }
  }, [isOpen, remaining]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!amount || parseFloat(amount) <= 0) return false;
    if (!method) return false;
    if (method === 'transfer' && !ref.trim()) return false;
    return true;
  }, [submitting, amount, method, ref]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await axios.post(`/api/outstandings/${outstanding.id}/payment`, {
        amount: parseFloat(amount),
        paymentMethod: method,
        referenceNo: method === 'transfer' ? ref.trim() : null,
      });
      alertSuccess('Pembayaran berhasil dicatat!');
      onSuccess();
      onClose();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mencatat pembayaran');
    } finally {
      setSubmitting(false);
    }
  };

  const changeAmount = (val) => {
    const num = parseFloat(val) || 0;
    setAmount(String(Math.min(num, remaining)));
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '20px 20px max(20px, env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <div style={{
                fontFamily: FONT,
                fontSize: 16,
                fontWeight: 700,
                color: C.n900,
              }}>
                Catat Pembayaran
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

            {/* Amount Display */}
            <div style={{
              background: `linear-gradient(145deg, ${C.dangerBg}, #FEE2E2)`,
              borderRadius: 16,
              padding: '16px',
              marginBottom: 16,
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 600,
                color: C.danger,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Sisa Pembayaran
              </div>
              <div style={{
                fontFamily: FONT,
                fontSize: 28,
                fontWeight: 800,
                color: C.danger,
              }}>
                {rp(remaining)}
              </div>
            </div>

            {/* Amount Input */}
            <div style={{ marginBottom: 16 }}>
              <MoneyInput
                label="Jumlah Bayar"
                value={amount}
                onChange={changeAmount}
                placeholder="0"
              />
              <div style={{
                display: 'flex',
                gap: 6,
                marginTop: 8,
                flexWrap: 'wrap',
              }}>
                {[remaining, remaining * 0.5, remaining * 0.25].map((val) => (
                  val > 0 && (
                    <button
                      key={val}
                      onClick={() => setAmount(String(Math.round(val)))}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 20,
                        border: `1px solid ${C.n200}`,
                        background: C.white,
                        fontFamily: FONT,
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.n700,
                        cursor: 'pointer',
                      }}
                    >
                      {rp(Math.round(val))}
                    </button>
                  )
                ))}
                <button
                  onClick={() => setAmount(String(remaining))}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: `1px solid ${C.success}`,
                    background: C.successBg,
                    fontFamily: FONT,
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.success,
                    cursor: 'pointer',
                  }}
                >
                  Lunasi
                </button>
              </div>
            </div>

            {/* Payment Method */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 600,
                color: C.n600,
                marginBottom: 10,
              }}>
                Metode Pembayaran
              </div>
              <PaymentMethodGrouped
                value={method}
                onChange={setMethod}
                amount={parseFloat(amount) || 0}
              />
            </div>

            {/* Reference for Transfer */}
            <AnimatePresence>
              {method === 'transfer' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ marginBottom: 16 }}
                >
                  <Input
                    label="Bukti / Referensi Transfer"
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    placeholder="Mis. BCA 22/11 14:30 — Andi"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button
              whileTap={{ scale: canSubmit ? 0.98 : 1 }}
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: '100%',
                height: 48,
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
              {submitting ? 'Memproses...' : `Bayar ${rp(parseFloat(amount) || 0)}`}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Reminder Modal Component ──────────────────────────────────────────────────
function ReminderModal({ isOpen, onClose, outstanding, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [messageType, setMessageType] = useState('wa');

  const handleSend = async () => {
    setSubmitting(true);
    try {
      const messages = {
        wa: `Halo ${outstanding.principal_name || outstanding.customer_name}, reminder untuk pembayaran piutang ${outstanding.invoice_no} sebesar ${rp(outstanding.remaining_amount)}. Terima kasih.`,
        sms: `Reminder: Piutang ${outstanding.invoice_no} sebesar ${rp(outstanding.remaining_amount)}. Mohon segera dilunasi. Terima kasih.`,
      };

      await axios.post(`/api/outstandings/${outstanding.id}/reminder`, {
        reminderType: messageType,
        message: messages[messageType],
      });

      alertSuccess('Reminder berhasil dikirim!');
      onSuccess();
      onClose();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengirim reminder');
    } finally {
      setSubmitting(false);
    }
  };

  const waLink = outstanding?.phone
    ? `https://wa.me/${outstanding.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Halo ${outstanding.principal_name || outstanding.customer_name}, reminder untuk pembayaran piutang ${outstanding.invoice_no} sebesar ${rp(outstanding.remaining_amount)}. Terima kasih.`
      )}`
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
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
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white,
              borderRadius: 20,
              width: '100%',
              maxWidth: 360,
              padding: 24,
            }}
          >
            <div style={{
              fontFamily: FONT,
              fontSize: 16,
              fontWeight: 700,
              color: C.n900,
              marginBottom: 8,
              textAlign: 'center',
            }}>
              Kirim Reminder
            </div>
            <div style={{
              fontFamily: FONT,
              fontSize: 13,
              color: C.n600,
              marginBottom: 20,
              textAlign: 'center',
            }}>
              Kirim notifikasi pembayaran ke {outstanding?.principal_name || outstanding?.customer_name}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (waLink) {
                    window.open(waLink, '_blank');
                    onClose();
                  }
                }}
                disabled={!waLink}
                style={{
                  width: '100%',
                  height: 50,
                  borderRadius: 14,
                  border: 'none',
                  background: '#25D366',
                  color: C.white,
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: waLink ? 'pointer' : 'not-allowed',
                  opacity: waLink ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <MessageCircle size={18} />
                Kirim via WhatsApp
              </motion.button>

              {outstanding?.phone && (
                <motion.a
                  whileTap={{ scale: 0.98 }}
                  href={buildCallLink(outstanding.phone)}
                  style={{
                    width: '100%',
                    height: 50,
                    borderRadius: 14,
                    border: `1.5px solid ${C.n200}`,
                    background: C.white,
                    color: C.n800,
                    fontFamily: FONT,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    textDecoration: 'none',
                  }}
                >
                  <Phone size={18} />
                  Hubungi via Telepon
                </motion.a>
              )}

              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 12,
                  border: 'none',
                  background: 'transparent',
                  color: C.n600,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  marginTop: 8,
                }}
              >
                Batal
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────────
export default function OutstandingDetailPage({ navigate, goBack, screenParams }) {
  useGlassStyles();
  const { isMobile } = useResponsive();

  const [outstanding, setOutstanding] = useState(screenParams?.outstanding || null);
  const [loading, setLoading] = useState(!screenParams?.outstanding);
  const [error, setError] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchDetail = async () => {
    if (!outstanding?.id) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/outstandings/${outstanding.id}`);
      setOutstanding(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat detail piutang');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [refreshKey]);

  const statusCfg = STATUS_CONFIG[outstanding?.status] || STATUS_CONFIG.unpaid;
  const StatusIcon = statusCfg.icon;
  const remaining = parseFloat(outstanding?.remaining_amount || 0);
  const isOverdue = outstanding?.due_date && new Date(outstanding.due_date) < new Date() && outstanding?.status !== 'paid';
  const progressPct = outstanding?.amount > 0
    ? Math.round((outstanding.paid_amount / outstanding.amount) * 100)
    : 0;

  if (loading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--glass-bg)',
      }}>
        <TopBar title="Detail Piutang" onBack={goBack} />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: C.n400 }} />
        </div>
      </div>
    );
  }

  if (error || !outstanding) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--glass-bg)',
      }}>
        <TopBar title="Detail Piutang" onBack={goBack} />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{ textAlign: 'center' }}>
            <AlertCircle size={48} color={C.danger} style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: FONT, fontSize: 14, color: C.n600 }}>
              {error || 'Piutang tidak ditemukan'}
            </div>
            <button
              onClick={goBack}
              style={{
                marginTop: 16,
                padding: '10px 20px',
                borderRadius: 12,
                background: C.primary,
                color: C.white,
                border: 'none',
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--glass-bg)',
      overflow: 'hidden',
    }}>
      <TopBar
        title="Detail Piutang"
        subtitle={outstanding.invoice_no}
        onBack={goBack}
      />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? 12 : 16,
        paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '100px',
      }}>
        {/* Hero Amount Card */}
        <div style={{
          background: `
            radial-gradient(circle at 85% -10%, rgba(6, 95, 70, 0.4) 0%, transparent 55%),
            linear-gradient(155deg, #065F46 0%, #047857 55%, #059669 100%)
          `,
          borderRadius: 20,
          padding: '20px 24px',
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative blob */}
          <div style={{
            position: 'absolute',
            width: 150,
            height: 150,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            top: -60,
            right: -40,
            filter: 'blur(20px)',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Status Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.2)',
              marginBottom: 12,
            }}>
              <StatusIcon size={14} color="white" />
              <span style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 600,
                color: 'white',
              }}>
                {isOverdue ? 'Jatuh Tempo' : statusCfg.label}
              </span>
            </div>

            {/* Remaining Amount */}
            <div style={{
              fontFamily: FONT,
              fontSize: 10,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.8)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              Sisa Pembayaran
            </div>
            <div style={{
              fontFamily: FONT,
              fontSize: 32,
              fontWeight: 800,
              color: 'white',
              marginTop: 4,
              lineHeight: 1.1,
            }}>
              {rp(remaining)}
            </div>

            {/* Progress */}
            {outstanding.paid_amount > 0 && outstanding.status !== 'paid' && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: FONT,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.8)',
                  marginBottom: 8,
                }}>
                  <span>Progress pembayaran</span>
                  <span style={{ fontWeight: 700, color: 'white' }}>{progressPct}%</span>
                </div>
                <div style={{
                  height: 8,
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${progressPct}%`,
                    height: '100%',
                    background: 'white',
                    borderRadius: 4,
                  }} />
                </div>
              </div>
            )}

            {/* Total */}
            <div style={{
              display: 'flex',
              gap: 20,
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid rgba(255,255,255,0.2)',
            }}>
              <div>
                <div style={{
                  fontFamily: FONT,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.7)',
                }}>
                  Total Piutang
                </div>
                <div style={{
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white',
                }}>
                  {rp(outstanding.amount)}
                </div>
              </div>
              <div>
                <div style={{
                  fontFamily: FONT,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.7)',
                }}>
                  Sudah Bayar
                </div>
                <div style={{
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white',
                }}>
                  {rp(outstanding.paid_amount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <ClayCard padding={16} delay={1}>
          <div style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 700,
            color: C.n500,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 12,
          }}>
            Informasi Pelanggan
          </div>
          <InfoRow
            label="Nama"
            value={outstanding.principal_name || outstanding.customer_name || '-'}
            icon={User}
          />
          <InfoRow
            label="No. Telepon"
            value={outstanding.phone || outstanding.customer_phone || '-'}
            icon={Phone}
          />
          {outstanding.transaction_no && (
            <InfoRow
              label="No. Transaksi"
              value={outstanding.transaction_no}
              icon={Receipt}
            />
          )}
          <InfoRow
            label="Outlet"
            value={outstanding.outlet_name || '-'}
            icon={Receipt}
          />
        </ClayCard>

        {/* Due Date & Notes */}
        <ClayCard padding={16} delay={2} style={{ marginTop: 12 }}>
          <div style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 700,
            color: C.n500,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 12,
          }}>
            Detail Piutang
          </div>
          {outstanding.due_date && (
            <InfoRow
              label="Jatuh Tempo"
              value={new Date(outstanding.due_date).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
              icon={Calendar}
              valueColor={isOverdue ? C.danger : C.n900}
            />
          )}
          <InfoRow
            label="Dibuat"
            value={new Date(outstanding.created_at).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            icon={Calendar}
          />
          {outstanding.notes && (
            <div style={{
              marginTop: 12,
              padding: 12,
              background: C.n50,
              borderRadius: 10,
            }}>
              <div style={{
                fontFamily: FONT,
                fontSize: 10,
                fontWeight: 600,
                color: C.n500,
                marginBottom: 4,
              }}>
                Catatan
              </div>
              <div style={{
                fontFamily: FONT,
                fontSize: 12,
                color: C.n800,
              }}>
                {outstanding.notes}
              </div>
            </div>
          )}
        </ClayCard>

        {/* Payment History */}
        {outstanding.payments && outstanding.payments.length > 0 && (
          <ClayCard padding={16} delay={3} style={{ marginTop: 12 }}>
            <div style={{
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 700,
              color: C.n500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 12,
            }}>
              Riwayat Pembayaran
            </div>
            {outstanding.payments.map((payment, idx) => (
              <div
                key={payment.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: idx < outstanding.payments.length - 1 ? `1px solid ${C.n100}` : 'none',
                }}
              >
                <div>
                  <div style={{
                    fontFamily: FONT,
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.n900,
                  }}>
                    {rp(payment.amount)}
                  </div>
                  <div style={{
                    fontFamily: FONT,
                    fontSize: 11,
                    color: C.n500,
                  }}>
                    {payment.payment_method} • {new Date(payment.created_at).toLocaleDateString('id-ID')}
                  </div>
                </div>
                <div style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: C.successBg,
                  fontFamily: FONT,
                  fontSize: 10,
                  fontWeight: 600,
                  color: C.success,
                }}>
                  Lunas
                </div>
              </div>
            ))}
          </ClayCard>
        )}

        {/* Quick Actions */}
        {outstanding.status !== 'paid' && outstanding.status !== 'written_off' && (
          <div style={{
            display: 'flex',
            gap: 10,
            marginTop: 16,
            flexWrap: 'wrap',
          }}>
            {/* Pay Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowPayment(true)}
              style={{
                flex: 1,
                minWidth: '45%',
                height: 48,
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(145deg, #047857, #065F46)',
                color: C.white,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(6, 95, 70, 0.35)',
              }}
            >
              <DollarSign size={16} />
              Bayar
            </motion.button>

            {/* Reminder Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowReminder(true)}
              style={{
                flex: 1,
                minWidth: '45%',
                height: 48,
                borderRadius: 14,
                border: `1.5px solid ${C.n200}`,
                background: C.white,
                color: C.n800,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Send size={16} />
              Reminder
            </motion.button>
          </div>
        )}

        {/* Contact Buttons */}
        {outstanding.phone && (
          <div style={{
            display: 'flex',
            gap: 10,
            marginTop: 10,
          }}>
            <motion.a
              whileTap={{ scale: 0.98 }}
              href={buildWaMeLink(outstanding.phone)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                border: 'none',
                background: '#25D366',
                color: C.white,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.35)',
              }}
            >
              <MessageCircle size={16} />
              WhatsApp
            </motion.a>
            <motion.a
              whileTap={{ scale: 0.98 }}
              href={buildCallLink(outstanding.phone)}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                border: `1.5px solid ${C.n200}`,
                background: C.white,
                color: C.n800,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                textDecoration: 'none',
              }}
            >
              <Phone size={16} />
              Telepon
            </motion.a>
          </div>
        )}
      </div>

      {/* Modals */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        outstanding={outstanding}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
      <ReminderModal
        isOpen={showReminder}
        onClose={() => setShowReminder(false)}
        outstanding={outstanding}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
