import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  ArrowLeft, Copy, Check, Camera, Plus, Printer, RotateCcw,
  Trash2, Pencil, ChevronDown, ChevronRight, Store, X,
  AlertTriangle, MapPin, StickyNote,
  Package, FileEdit, DollarSign, Truck, Calendar, User,
} from 'lucide-react';
import { C } from '../../utils/theme';
import { rp, photoTypeLabel, getTransactionItemLineTotal } from '../../utils/helpers';
import { TopBar, Btn, Badge, ProgressTimeline, Modal, Input, Select, MoneyInput, DateTimeInput, ProfileAvatar } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { uploadImage } from '../../utils/imageUpload';
import RefundCancelModal from '../../components/RefundCancelModal';
import { useResponsive } from '../../utils/hooks';
import { printReceipt } from '../../utils/printService';
import { useScrollLock } from '../../utils/useScrollLock';

// ─── Design tokens (Waschen Design Template v3.0) ──────────────────────────
const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";

// Payment method labels
const PAY_METHOD_LABEL = {
  cash: 'Tunai', transfer: 'Transfer', deposit: 'Deposit',
  qris: 'QRIS', ovo: 'OVO', gopay: 'GoPay', dana: 'DANA',
  shopeepay: 'ShopeePay', mixed: 'Campuran',
};

// ─── Injected stylesheet (glass + clay + blob animations) ───────────────
const GLASS_STYLES = `
  :root {
    --glass-bg: #F3EEF7;
    --glass: rgba(255, 255, 255, 0.7);
    --glass-strong: rgba(255, 255, 255, 0.85);
  }
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');

  * { box-sizing: border-box; }
  .wd-page-header {
    background:
      radial-gradient(circle at 85% -10%, rgba(232,90,168,0.55) 0%, transparent 55%),
      radial-gradient(circle at -10% 20%, rgba(95,217,174,0.25) 0%, transparent 45%),
      linear-gradient(155deg, #3B0B47 0%, #5C1A6B 55%, #4A1259 100%);
    position: relative;
    overflow: hidden;
  }
  .wd-blob { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(18px); }
  .wd-blob-1 { width: 200px; height: 200px; background: radial-gradient(circle, rgba(232,90,168,0.55) 0%, transparent 70%); top: -60px; right: -40px; animation: wd-floatB 11s ease-in-out infinite; }
  .wd-blob-2 { width: 170px; height: 170px; background: radial-gradient(circle, rgba(95,217,174,0.35) 0%, transparent 70%); bottom: -30px; left: -50px; animation: wd-floatC 16s ease-in-out infinite; }
  .wd-blob-3 { width: 100px; height: 100px; background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%); top: 30px; left: 55%; animation: wd-floatA 9s ease-in-out infinite; }

  @keyframes wd-floatA { 0%, 100% { transform: translate(0,0) scale(1);} 50% { transform: translate(-14px,16px) scale(1.08);} }
  @keyframes wd-floatB { 0%, 100% { transform: translate(0,0) scale(1);} 50% { transform: translate(18px,-12px) scale(1.1);} }
  @keyframes wd-floatC { 0%, 100% { transform: translate(0,0) scale(1);} 50% { transform: translate(16px,10px) scale(0.95);} }
  @keyframes wd-fadeUp { from { opacity: 0; transform: translateY(14px);} to { opacity: 1; transform: translateY(0);} }
  @keyframes wd-scaleIn { from { opacity: 0; transform: scale(0.92);} to { opacity: 1; transform: scale(1);} }
  @keyframes wd-fadeIn { from { opacity: 0;} to { opacity: 1;} }
  @keyframes wd-slideUp { from { opacity: 0; transform: translateY(40px);} to { opacity: 1; transform: translateY(0);} }

  @media (prefers-reduced-motion: reduce) {
    .wd-blob-1, .wd-blob-2, .wd-blob-3 { animation: none; }
    .wd-anim, .wd-sheet { animation: none !important; }
  }
  .wd-anim { animation: wd-fadeUp 0.45s cubic-bezier(.2,.7,.3,1) both; }
  .wd-sheet { animation: wd-slideUp 0.28s cubic-bezier(.2,.8,.3,1) both; }
  .wd-clay-card { transition: transform .18s ease, box-shadow .18s ease; }
  .wd-clay-card.wd-tappable:hover { transform: translateY(-2px); }
  .wd-clay-card.wd-tappable:active { transform: scale(0.99); }
  .wd-btn { transition: transform .12s ease, filter .12s ease, box-shadow .12s ease; cursor: pointer; }
  .wd-btn:hover { filter: brightness(1.04); transform: translateY(-1px); }
  .wd-btn:active { transform: scale(0.96); }
  .wd-chip-btn { transition: transform .12s ease, background .15s ease; cursor: pointer; }
  .wd-chip-btn:hover { background: ${C.primaryTint}; }
  .wd-chip-btn:active { transform: scale(0.95); }
  .wd-list-row { transition: transform .15s ease, background .15s ease; cursor: pointer; }
  .wd-list-row:hover { transform: translateX(3px); }
  .wd-list-row:active { transform: scale(0.99); }
  .wd-option-row { transition: transform .13s ease, background .15s ease; cursor: pointer; }
  .wd-option-row:hover { background: ${C.n50}; }
  .wd-option-row:active { transform: scale(0.98); }
  .wd-icon-btn { transition: background .15s ease, transform .12s ease; cursor: pointer; }
  .wd-icon-btn:hover { background: rgba(255,255,255,0.18); }
  .wd-icon-btn:active { transform: scale(0.92); }
`;

function useGlassStyles() {
  useEffect(() => {
    const id = 'wd-detail-tx-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = GLASS_STYLES;
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);
}

// ─── Reusable components ──────────────────────────────────────────────

// Section wrapper - clean, no box shadows on desktop
function SectionBox({ children, delay = 0, style }) {
  return (
    <div
      className="wd-anim"
      style={{
        animationDelay: `${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Section label header
function SectionLabel({ children, icon }) {
  return (
    <span style={{
      fontFamily: FONT,
      fontSize: 11,
      fontWeight: 700,
      color: C.n500,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      {icon}
      {children}
    </span>
  );
}

// Clean row for data
function DataRow({ label, value, valueColor, small, borderTop }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: small ? '6px 0' : '10px 0',
      borderTop: borderTop ? `1px solid ${C.n100}` : 'none',
    }}>
      <span style={{ fontFamily: FONT, fontSize: small ? 12 : 14, color: C.n500 }}>
        {label}
      </span>
      <span style={{ fontFamily: FONT, fontSize: small ? 13 : 14, fontWeight: 600, color: valueColor || C.n900, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

// Info chip/badge
function InfoChip({ label, value, color = C.primary }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      background: `${color}15`,
      borderRadius: 10,
      border: `1px solid ${color}30`,
    }}>
      <span style={{ fontFamily: FONT, fontSize: 10.5, color: color, fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: FONT, fontSize: 12.5, color: C.n900, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function ClayCard({ children, style, padding = 20, onClick, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { delay: delay * 0.1 } }}
      whileHover={onClick ? { y: -3, scale: 1.01 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      onClick={onClick}
      style={{
        background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
        borderRadius: 18,
        padding,
        boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(139, 92, 246, 0.08)',
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

function ClayIcon({ icon, color = C.primary, size = 44 }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size * 0.28,
      background: `linear-gradient(145deg, ${color}20, ${color}08)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, flexShrink: 0,
      boxShadow: `3px 3px 8px ${color}15, -1px -1px 4px rgba(255, 255, 255, 0.9)`,
    }}>
      {icon}
    </div>
  );
}

function Chip({ label, color = C.primary, icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 12px', borderRadius: 999,
      background: `${color}15`, border: `1px solid ${color}30`,
      fontFamily: FONT, fontSize: 11.5, fontWeight: 600, color,
    }}>
      {icon}{label}
    </span>
  );
}

function WdBtn({ children, onClick, variant = 'primary', fullWidth, style, disabled }) {
  const variants = {
    primary: {
      background: disabled ? C.n300 : 'linear-gradient(145deg, #6B2D7E, #4A1A59)',
      color: C.white, border: 'none',
      boxShadow: disabled ? 'none' : '-4px -4px 10px rgba(255,255,255,0.4), 5px 6px 14px rgba(59,11,71,0.35)',
    },
    secondary: {
      background: 'linear-gradient(145deg, #F5E9FB, #E9D3F2)',
      color: C.primary, border: '1.5px solid #e8e2ea',
      boxShadow: '-4px -4px 10px rgba(255,255,255,0.6), 5px 6px 14px rgba(59,11,71,0.15)',
    },
    success: {
      background: 'linear-gradient(145deg, #5FD9AE, #1F9E75)',
      color: C.white, border: 'none',
      boxShadow: '0 6px 14px rgba(31,158,117,0.3)',
    },
    warning: {
      background: 'linear-gradient(135deg, #E8850A, #ba7517)',
      color: C.white, border: 'none',
      boxShadow: '0 6px 14px rgba(232,133,10,0.3)',
    },
    danger: {
      background: 'linear-gradient(135deg, #E11D48, #a32d2d)',
      color: C.white, border: 'none',
      boxShadow: '0 6px 14px rgba(225,29,72,0.3)',
    },
    dangerOutline: {
      background: C.dangerBg, color: C.dangerDark,
      border: '1.5px solid #f0b8c4', boxShadow: 'none',
    },
    ghost: {
      background: 'transparent', color: C.n600,
      border: `1.5px solid ${C.n200}`, boxShadow: 'none',
    },
  };
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02, y: -1 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: fullWidth ? '100%' : 'auto',
        height: 50, padding: '0 22px',
        borderRadius: 14,
        fontFamily: FONT, fontSize: 14, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </motion.button>
  );
}

function Row({ label, value, valueColor = C.n900, icon, small }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: small ? '6px 0' : '9px 0' }}>
      <span style={{ fontFamily: FONT, fontSize: small ? 12 : 14, color: C.n500, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}{label}
      </span>
      <span style={{ fontFamily: FONT, fontSize: small ? 13 : 14, fontWeight: 600, color: valueColor, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ icon, title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ClayIcon icon={icon} size={36} />
        <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: C.n900 }}>{title}</span>
      </div>
      {right}
    </div>
  );
}

// Progress stepper (production status)
function ProgressStepper({ steps, currentStatus }) {
  const statusOrder = ['diterima', 'proses', 'selesai', 'diambil'];
  const currentIdx = statusOrder.indexOf(currentStatus);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 14 }}>
      {steps.map((s, i) => {
        const sIdx = statusOrder.indexOf(s.key);
        const state = sIdx < currentIdx ? 'done' : sIdx === currentIdx ? 'current' : 'pending';
        return (
          <React.Fragment key={s.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 64 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: FONT, fontSize: 12, fontWeight: 700,
                color: state === 'pending' ? C.n400 : '#fff',
                background: state === 'done'
                  ? 'linear-gradient(135deg, #5FD9AE, #1F9E75)'
                  : state === 'current'
                  ? 'linear-gradient(145deg, #6B2D7E, #4A1A59)'
                  : C.white,
                border: state === 'pending' ? `2px solid ${C.n200}` : 'none',
                boxShadow: state !== 'pending' ? '0 3px 8px rgba(59,11,71,0.25)' : 'none',
              }}>
                {state === 'done' ? <Check size={14} /> : i + 1}
              </div>
              <span style={{
                fontFamily: FONT, fontSize: 11,
                fontWeight: state === 'pending' ? 500 : 700,
                color: state === 'pending' ? C.n400 : C.n600,
                textAlign: 'center',
              }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginTop: 14,
                background: sIdx < currentIdx ? '#5FD9AE' : C.n200,
                borderRadius: 2,
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Main component
export default function DetailTransaksiPage({ navigate, goBack, screenParams }) {
  useGlassStyles();
  const { isMobile } = useResponsive();

  // ─── All existing state (PRESERVED) ───────────────────────────────────
  const [tx, setTx] = useState(screenParams);
  const [approvalModal, setApprovalModal] = useState(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [logisticOrders, setLogisticOrders] = useState([]);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [pelunasanModal, setPelunasanModal] = useState(false);
  const [pelMethod, setPelMethod] = useState('cash');
  const [pelAmountStr, setPelAmountStr] = useState('');
  const [pelCashStr, setPelCashStr] = useState('');
  const [pelLoading, setPelLoading] = useState(false);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [dlvType, setDlvType] = useState('self');
  const [dlvSchedule, setDlvSchedule] = useState('');
  const [dlvNotes, setDlvNotes] = useState('');
  const [dlvLoading, setDlvLoading] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(true);
  const [payOpen, setPayOpen] = useState(true);
  const [packingModal, setPackingModal] = useState(null);
  const [pkgNeeded, setPkgNeeded] = useState(1);
  const [pkgNotes, setPkgNotes] = useState('');
  const [pkgSaving, setPkgSaving] = useState(false);
  const [refundTx, setRefundTx] = useState(null);

  // UI state baru untuk styling
  const [copied, setCopied] = useState(false);
  const [showPayHistory, setShowPayHistory] = useState(false);
  const [showRequestSheet, setShowRequestSheet] = useState(false);

  // Scroll lock for bottom sheets
  const hasOpenSheet = showPayHistory || showRequestSheet;
  useScrollLock(hasOpenSheet);

  // Copy ID
  const handleCopyId = () => {
    const txId = tx?.id || tx?.transactionNo || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txId).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // Documentation photos
  const [docPhotos, setDocPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(null);

  const handleAddPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const txId = tx?.id || tx?.transactionNo;
      if (!txId) { alertError('Transaksi belum siap. Coba refresh dulu.'); return; }
      setPhotoUploading(true);
      setPhotoProgress({ current: 0, total: files.length, status: 'compress' });
      try {
        const compressed = [];
        for (let i = 0; i < files.length; i++) {
          setPhotoProgress({ current: i + 1, total: files.length, status: 'compress' });
          const result = await uploadImage(files[i], 'documentation');
          compressed.push({ url: result.dataUrl, type: 'initial_condition' });
        }
        setPhotoProgress({ current: files.length, total: files.length, status: 'upload' });
        await axios.post(`/api/transactions/${txId}/condition`, {
          photos: compressed, notes: 'Lampiran dari kasir', isDamage: false, phase: 'receive',
        });
        await refreshDetail();
        setDocPhotos([]);
        alertSuccess(`${compressed.length} foto berhasil disimpan.`);
      } catch (err) {
        alertError(err?.response?.data?.message || err.message || 'Gagal mengupload foto.');
      } finally {
        setPhotoUploading(false);
        setPhotoProgress(null);
      }
    };
    input.click();
  };

  useEffect(() => {
    const id = screenParams?.id || screenParams?.transactionNo;
    if (!id) return;
    const fetchDetail = async () => {
      setFetching(true);
      try {
        const res = await axios.get(`/api/transactions/${id}`);
        if (res?.data?.data) setTx(res.data.data);
      } catch (error) { /* silent */ } finally { setFetching(false); }
    };
    fetchDetail();
  }, [screenParams?.id, screenParams?.transactionNo]);

  const refreshDetail = async () => {
    const raw = screenParams?.id || screenParams?.transactionNo;
    if (!raw) return;
    try {
      const res = await axios.get(`/api/transactions/${raw}`);
      if (res?.data?.data) setTx(res.data.data);
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    if (!tx?.id && !tx?.transactionNo) return;
    const fetchLogistics = async () => {
      try {
        const rawId = tx?.transactionNo || tx?.id;
        const res = await axios.get(`/api/logistics?transactionId=${rawId}`);
        setLogisticOrders(res?.data?.data || []);
      } catch (e) { /* no logistics */ }
    };
    fetchLogistics();
  }, [tx?.id, tx?.transactionNo]);

  if (!tx) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <WdBtn onClick={() => navigate('transaksi')}>Kembali</WdBtn>
    </div>
  );

  // ─── All existing handlers (PRESERVED) ───────────────────────────────

  const openRefundModal = () => {
    setRefundTx({
      id: tx.id, transactionNo: tx.id || tx.transactionNo,
      customerName: tx.customerName, total: tx.total,
      paidAmount: tx.paidAmount || 0, paymentMethod: tx.payMethod, items: tx.items,
    });
  };

  const openPackingModal = (item) => {
    setPackingModal(item);
    setPkgNeeded(Number(item.packingNeeded) || 1);
    setPkgNotes(item.packingNotes || '');
  };

  const savePackingInfo = async () => {
    if (!packingModal) return;
    setPkgSaving(true);
    try {
      await axios.patch(`/api/transactions/${tx.id}/items/${packingModal.id}/packing`, {
        packingNeeded: pkgNeeded, packingNotes: pkgNotes || null,
      });
      setTx(prev => ({
        ...prev,
        items: (prev.items || []).map(i =>
          i.id === packingModal.id ? { ...i, packingNeeded: pkgNeeded, packingNotes: pkgNotes } : i
        ),
      }));
      setPackingModal(null);
      alertSuccess('Info packing disimpan.');
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan info packing.');
    } finally { setPkgSaving(false); }
  };

  const handleRequestApproval = async (type) => {
    if (!approvalReason.trim()) return;
    setLoading(true);
    try {
      await axios.post(`/api/transactions/${tx.id}/request-approval`, { type, reason: approvalReason.trim() });
      setApprovalModal(null);
      setApprovalReason('');
      alertSuccess(type === 'cancel_nota'
        ? 'Pengajuan pembatalan dikirim. Menunggu persetujuan Admin.'
        : 'Pengajuan penghapusan dikirim. Menunggu persetujuan Admin.'
      );
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengajukan.');
    } finally { setLoading(false); }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) { alertWarning('Tanggal dan jam baru wajib diisi.'); return; }
    const loOrder = logisticOrders.find((lo) => !['done', 'cancelled', 'failed'].includes(lo.status));
    if (!loOrder) { alertWarning('Tidak ada order logistik yang bisa di-reschedule.'); return; }
    setLoading(true);
    try {
      await axios.post(`/api/logistics/${loOrder.id}/reschedule`, {
        new_scheduled_at: `${rescheduleDate}T${rescheduleTime}:00`,
        reason: rescheduleReason || null,
      });
      setRescheduleModal(false);
      setRescheduleDate(''); setRescheduleTime(''); setRescheduleReason('');
      alertSuccess('Jadwal berhasil diubah.');
      const res = await axios.get(`/api/logistics?transactionId=${tx.id}`);
      setLogisticOrders(res?.data?.data || []);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengubah jadwal.');
    } finally { setLoading(false); }
  };

  const handlePickedUp = async () => {
    const balanceDueNow = Math.max(0, Number(tx.total || 0) - Number(tx.paidAmount || 0));
    if (balanceDueNow > 0) {
      alertError(`Cucian belum bisa diambil. Tagihan masih kurang ${rp(balanceDueNow)}. Selesaikan pembayaran dulu.`, { title: '⚠️ Belum Lunas' });
      return;
    }
    setActionLoading('pickup');
    try {
      await axios.put(`/api/transactions/${tx.id}/status`, { status: 'diambil' });
      setTx((prev) => ({ ...prev, status: 'diambil' }));
      alertSuccess('Konfirmasi pengambilan berhasil!');
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal update status.');
    } finally { setActionLoading(null); }
  };

  const handleSubmitReview = async () => {
    setLoading(true);
    try {
      await axios.post(`/api/transactions/${tx.id}/review`, { rating: reviewRating, comment: reviewNote });
      alertSuccess('Review berhasil disimpan!');
      setReviewModal(false);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan review.');
    } finally { setLoading(false); }
  };

  const hasLogistics = logisticOrders.length > 0;
  const activeLogistic = logisticOrders.find((lo) => !['done', 'cancelled', 'failed'].includes(lo.status));
  const balanceDue = tx.balanceDue != null ? Number(tx.balanceDue) : Math.max(0, Number(tx.total || 0) - Number(tx.paidAmount || 0));
  const paymentStatus = tx.paymentStatus || 'paid';
  const needsSettlement = balanceDue > 0.009 && tx.status !== 'dibatalkan';

  const openDeliveryModal = () => {
    const pt = tx?.pickupType || 'self';
    setDlvType(pt); setDlvSchedule(''); setDlvNotes('');
    setDeliveryModal(true);
  };

  const submitDeliveryChange = async () => {
    setDlvLoading(true);
    try {
      const tid = tx.transactionUuid || tx.id;
      const body = { pickupType: dlvType, notes: dlvNotes || undefined };
      if (dlvSchedule) body.scheduleAt = dlvSchedule;
      const res = await axios.patch(`/api/transactions/${tid}/delivery-type`, body);
      alertSuccess('Jenis pengantaran berhasil diubah.');
      setDeliveryModal(false);
      setTx((prev) => ({ ...prev, pickupType: dlvType, deliveryFee: res.data?.data?.deliveryFee ?? prev.deliveryFee, total: res.data?.data?.total ?? prev.total }));
      await refreshDetail();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengubah pengantaran.');
    } finally { setDlvLoading(false); }
  };

  const submitPelunasan = async () => {
    const payAmt = Number(pelAmountStr);
    if (!Number.isFinite(payAmt) || payAmt <= 0) { alertWarning('Nominal tidak valid.'); return; }
    const tid = tx.transactionUuid || tx.id;
    setPelLoading(true);
    try {
      const body = { method: pelMethod, payAmount: payAmt };
      if (pelMethod === 'cash' && pelCashStr && Number(pelCashStr) > 0) body.cashReceived = Number(pelCashStr);
      await axios.post(`/api/transactions/${tid}/payments`, body);
      alertSuccess('Pembayaran berhasil dicatat.');
      setPelunasanModal(false);
      await refreshDetail();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mencatat pembayaran.');
    } finally { setPelLoading(false); }
  };

  // Production steps
  const productionSteps = [
    { key: 'diterima', label: 'Diterima' },
    { key: 'proses', label: 'Diproses' },
    { key: 'selesai', label: 'Selesai' },
    { key: 'diambil', label: 'Diambil' },
  ];

  const progressSteps = tx.progress && tx.progress.length > 0
    ? tx.progress.map(p => ({ key: p.status || p.step, label: p.label || p.status }))
    : productionSteps;

  // Payment chip
  const payStatusConfig = {
    paid: { color: C.success, label: 'Lunas' },
    partial: { color: C.warning, label: 'Sebagian' },
    unpaid: { color: C.danger, label: 'Belum Lunas' },
    refunded: { color: C.info, label: 'Refund' },
    void: { color: C.n500, label: 'Void' },
  };
  const payChip = payStatusConfig[paymentStatus] || payStatusConfig.unpaid;

  // Request sheet options
  const requestOptions = [
    {
      key: 'edit', icon: <Pencil size={18} />, color: C.primary,
      title: 'Edit Transaksi', desc: 'Ubah detail layanan, qty, atau harga',
      onClick: () => {
        setShowRequestSheet(false);
        navigate('adjust_nota', { id: tx.id || tx.transactionNo });
      },
    },
    {
      key: 'refund', icon: <RotateCcw size={18} />, color: C.warning,
      title: 'Ajukan Refund', desc: 'Kembalikan sebagian / seluruh pembayaran',
      onClick: () => {
        setShowRequestSheet(false);
        navigate('ajuakan_refund', { id: tx.id || tx.transactionNo });
      },
    },
  ];

  // Balance & status helpers
  const isCancelled = tx.status === 'dibatalkan';
  const isTaken = tx.status === 'diambil';
  const isReady = tx.status === 'selesai';
  const isUnpaid = balanceDue > 0;

  const userNotes = (tx.notes || '').replace(/\[Bayar:[^\]]*\]/g, '').trim();
  const hasConditionPhotos = (tx.conditionPhotos || []).filter((p) => p.url && p.url !== 'note_only').length > 0;

  // ─── RENDER ──────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--glass-bg)',
      fontFamily: FONT,
    }}>
      <div style={{ width: '100%', paddingBottom: isMobile ? 90 : 90 }}>

        {/* ── Header hero with blob gradient ───────────────────────── */}
        <div className="wd-page-header">
          <div className="wd-blob wd-blob-1" />
          <div className="wd-blob wd-blob-2" />
          <div className="wd-blob wd-blob-3" />

          <div style={{ position: 'relative', zIndex: 1, padding: '18px 24px 26px', maxWidth: 1400, margin: '0 auto' }}>
            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
              <button
                className="wd-icon-btn"
                onClick={goBack}
                style={{
                  width: 40, height: 40, borderRadius: 13,
                  border: 'none', background: 'rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ArrowLeft size={21} color="#fff" />
              </button>
              <span style={{
                flex: 1, textAlign: 'center',
                fontFamily: FONT, fontSize: 17.5, fontWeight: 700, color: '#fff',
                marginRight: 40,
              }}>
                Detail Transaksi
              </span>
            </div>

            {/* Customer summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <ProfileAvatar
                user={{ name: tx.customerName, photo: tx.customerPhoto, gender: tx.customerGender, type: 'customer' }}
                size={58}
                style={{ borderRadius: 18, width: 58, height: 58 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: '#fff' }}>
                    {tx.customerName || 'Pelanggan'}
                  </span>
                  <Badge status={tx.status || 'baru'} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                    {tx.customerPhone || '-'}
                  </span>
                  <span style={{
                    fontFamily: FONT, fontSize: 10.5, fontWeight: 700, color: '#fff',
                    background: 'rgba(255,255,255,0.18)', borderRadius: 999, padding: '3px 9px',
                  }}>
                    {tx.isExpress ? '⚡ Express' : '📦 Reguler'}
                  </span>
                </div>
              </div>
            </div>

            {/* Total + Order ID */}
            <div style={{
              marginTop: 22, display: 'flex', alignItems: 'flex-end',
              justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
            }}>
              <div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                  Total tagihan
                </div>
                <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1.15 }}>
                  {rp(tx.total || 0)}
                </div>
              </div>
              <button
                className="wd-icon-btn"
                onClick={handleCopyId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 11, padding: '8px 12px',
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: '#fff', fontWeight: 600 }}>
                  {tx.id || tx.transactionNo}
                </span>
                {copied
                  ? <Check size={15} color="#5FD9AE" />
                  : <Copy size={15} color="rgba(255,255,255,0.85)" />
                }
              </button>
            </div>

            {/* Outlet + Kasir */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              marginTop: 14, fontFamily: FONT, fontSize: 12,
              color: 'rgba(255,255,255,0.65)', flexWrap: 'wrap',
            }}>
              <Store size={14} />
              {tx.outletName || 'Waschen Outlet'}
              <span style={{ opacity: 0.4 }}>•</span>
              Kasir: {tx.createdBy || tx.kasirName || '-'}
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '18px 24px',
          paddingBottom: isMobile ? 'max(80px, calc(60px + env(safe-area-inset-bottom, 0px)))' : 80,
        }}>

          {/* ── Top: Photos + Status Pengerjaan ────────────────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr',
            gap: 16,
            marginBottom: 16,
          }}>
            {/* Foto Produksi */}
            <div style={{
              background: C.white,
              borderRadius: 18,
              padding: 20,
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              border: `1px solid ${C.n100}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <ClayIcon icon={<Camera size={17} />} size={36} />
                <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.n900 }}>Bukti Foto</span>
              </div>
              {hasConditionPhotos ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(tx.conditionPhotos || []).filter(p => p.url && p.url !== 'note_only').map((p) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                      <img src={p.url} alt="" style={{ width: 60, height: 60, borderRadius: 12, objectFit: 'cover', border: `1px solid ${C.n100}` }} />
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0', color: C.n400 }}>
                  <Camera size={28} />
                  <p style={{ fontFamily: FONT, fontSize: 12, marginTop: 6 }}>Belum ada foto</p>
                </div>
              )}
              <button onClick={handleAddPhoto} style={{
                marginTop: 12, width: '100%', padding: '10px 12px',
                background: C.primaryTint, border: 'none', borderRadius: 12,
                fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.primary, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Plus size={14} /> Tambah Foto
              </button>
            </div>

            {/* Status Pengerjaan */}
            <div style={{
              background: C.white,
              borderRadius: 18,
              padding: 20,
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              border: `1px solid ${C.n100}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.n500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status Pengerjaan</span>
                <span style={{ fontFamily: FONT, fontSize: 11, color: C.n400 }}>
                  Est. {tx.estimatedDoneAt ? new Date(tx.estimatedDoneAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                </span>
              </div>
              <ProgressStepper steps={progressSteps} currentStatus={tx.status || 'diterima'} />
              {tx.status === 'diterima' || tx.status === 'baru' ? (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, background: C.warningBg, borderRadius: 10, padding: '8px 12px' }}>
                  <AlertTriangle size={14} color={C.warningDark} />
                  <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.warningDark }}>Belum dikerjakan</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Main Content: Services + Info + Actions ────────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 280px',
            gap: 16,
            marginBottom: 16,
          }}>
            {/* Left: Services + Payment + Order Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Rincian Layanan */}
              <div style={{
                background: C.white,
                borderRadius: 18,
                padding: 20,
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                border: `1px solid ${C.n100}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ClayIcon icon={<Package size={17} />} size={36} />
                    <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: C.n900 }}>Rincian Layanan</span>
                  </div>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: C.n400 }}>{tx.items?.length || 0} item</span>
                </div>

                {/* Toggle items */}
                <button
                  onClick={() => setItemsOpen(v => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: itemsOpen ? 12 : 0,
                  }}
                >
                  <span style={{ fontFamily: FONT, fontSize: 11, color: C.n500 }}>
                    Ketuk untuk lihat detail
                  </span>
                  <ChevronDown size={16} color={C.n400} style={{ transform: itemsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </button>

                {itemsOpen && (
                  <>
                    {(tx.items || []).map((item, index) => {
                      const itemStatus = tx.status === 'selesai' || tx.status === 'diambil' ? 'Selesai'
                        : tx.status === 'proses' ? 'Diproses'
                        : 'Menunggu';
                      const itemStatusColor = tx.status === 'selesai' || tx.status === 'diambil' ? C.success
                        : tx.status === 'proses' ? C.info : C.n600;
                      const pkgNeededVal = Number(item.packingNeeded) || 1;
                      const pkgDoneVal = Number(item.packingDone) || 0;
                      return (
                        <div key={item.id || `item-${index}`} className="wd-list-row" style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 12,
                          background: C.n50,
                          borderRadius: 14,
                          padding: '12px 14px',
                          marginBottom: 8,
                          border: `1px solid ${C.n100}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                            <div style={{
                              width: 44, height: 44, borderRadius: 10,
                              background: `${C.primary}15`,
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              color: C.primary, flexShrink: 0,
                            }}>
                              <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, lineHeight: 1 }}>
                                {item.unit === 'm2' ? Number(item.qty).toFixed(1) : item.qty}
                              </span>
                              <span style={{ fontFamily: FONT, fontSize: 9, lineHeight: 1, marginTop: 2 }}>
                                {item.unit === 'm2' ? 'm²' : item.unit}
                              </span>
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.n900 }}>
                                  {item.name || item.serviceName}
                                </span>
                                {item.express && <span style={{ background: C.warningBg, color: C.warning, fontFamily: FONT, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999 }}>⚡</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <Chip label={itemStatus} color={itemStatusColor} />
                                <span style={{ fontFamily: FONT, fontSize: 11, color: C.n400 }}>📦 {pkgDoneVal}/{pkgNeededVal}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.n900 }}>
                              {rp(getTransactionItemLineTotal(item))}
                            </span>
                            <button onClick={() => openPackingModal(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                              <Pencil size={15} color={C.primary} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${C.n200}` }}>
                      <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.n600 }}>Total</span>
                      <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: C.n900 }}>{rp(tx.total || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Pembayaran */}
              <div style={{
                background: C.white,
                borderRadius: 18,
                padding: 20,
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                border: `1px solid ${C.n100}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.n500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pembayaran</span>
                  <Chip label={payChip.label} color={payChip.color} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <DataRow small label="Sub Total" value={rp(tx.subtotal || tx.total)} />
                  {tx.deliveryFee > 0 && <DataRow small label="Ongkir" value={rp(tx.deliveryFee)} />}
                  {balanceDue > 0 && <DataRow small label="Sisa" value={rp(balanceDue)} valueColor={C.danger} />}
                </div>
                {needsSettlement && (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: C.dangerBg, borderRadius: 10 }}>
                    <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.dangerDark }}>⚠️ Belum lunas — tap "Lunasi" untuk bayar</span>
                  </div>
                )}
                {(tx.payments || []).length > 0 && (
                  <button
                    onClick={() => setShowPayHistory(v => !v)}
                    style={{
                      marginTop: 10, background: 'none', border: `1px dashed ${C.n200}`, borderRadius: 10,
                      padding: '8px 12px', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 600, color: C.n500 }}>Riwayat Pembayaran</span>
                    <ChevronDown size={14} color={C.n400} style={{ transform: showPayHistory ? 'rotate(180deg)' : 'none' }} />
                  </button>
                )}
                {showPayHistory && (tx.payments || []).map((p, i) => (
                  <div key={i} style={{ marginTop: 8, padding: '8px 10px', background: C.n50, borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.n800 }}>{PAY_METHOD_LABEL[p.method] || p.method}</span>
                      <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.n900 }}>{rp(p.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info Order */}
              <div style={{
                background: C.white,
                borderRadius: 18,
                padding: 20,
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                border: `1px solid ${C.n100}`,
              }}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.n500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Info Order</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <DataRow small label="Kasir" value={tx.createdBy || tx.kasirName || '-'} />
                  <DataRow small label="Outlet" value={tx.outletName || '-'} />
                  <DataRow small label="Tgl Masuk" value={tx.createdAt ? new Date(tx.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short' }) : '-'} />
                  <DataRow small label="Tipe" value={tx.isExpress ? '⚡ Express' : '📦 Reguler'} />
                  <DataRow small label="Pengantaran" value={tx.pickupType === 'delivery' ? '🚚 Antar' : tx.pickupType === 'pickup' ? '🛵 Jemput' : '🏪 Ambil'} />
                </div>
                {tx.status !== 'dibatalkan' && tx.status !== 'diambil' && (
                  <button onClick={openDeliveryModal} style={{
                    marginTop: 12, width: '100%', padding: '10px 12px',
                    background: C.primaryTint, border: 'none', borderRadius: 12,
                    fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.primary, cursor: 'pointer',
                  }}>
                    Ubah Pengantaran
                  </button>
                )}
              </div>
            </div>

            {/* Right: Actions Panel - responsive grid */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              {/* Cetak Nota - HIGHLIGHTED */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  background: 'linear-gradient(145deg, #6B2D7E, #4A1A59)',
                  borderRadius: 18,
                  padding: 20,
                  boxShadow: '-4px -4px 10px rgba(255,255,255,0.4), 5px 6px 14px rgba(59,11,71,0.35)',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('cetak_nota', { id: tx.id || tx.transactionNo })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Printer size={22} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: '#fff' }}>Cetak Nota</div>
                    <div style={{ fontFamily: FONT, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Langsung print struk</div>
                  </div>
                </div>
              </motion.div>

              {/* Lunasi - muncul hanya kalau ada piutang */}
              {!isCancelled && !isTaken && isUnpaid && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('pelunasan', { id: tx.id || tx.transactionNo })}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #E11D72, #A32D2D)',
                    borderRadius: 16,
                    padding: '15px 18px',
                    boxShadow: '0 6px 14px rgba(225,29,72,0.3)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    border: 'none',
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: 'rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 20 }}>💰</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#fff' }}>
                      Lunasi Sekarang
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                      Bayar sisa {rp(balanceDue)} — status langsung lunas
                    </div>
                  </div>
                  <ChevronRight size={18} color="rgba(255,255,255,0.6)" />
                </motion.button>
              )}

              {/* Pengajuan - Single Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowRequestSheet(true)}
                style={{
                  width: '100%',
                  background: C.white,
                  border: `1px solid ${C.n100}`,
                  borderRadius: 18,
                  padding: '16px 18px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <ClayIcon icon={<FileEdit size={17} />} size={40} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.n900 }}>Pengajuan</div>
                  <div style={{ fontFamily: FONT, fontSize: 11, color: C.n500, marginTop: 1 }}>Edit nota & ajukan refund</div>
                </div>
                <ChevronRight size={18} color={C.n400} />
              </motion.button>
            </div>
          </div>

        </div>


        {/* ── Sticky bottom actions ───────────────────────────────── */}
        {/* Konfirmasi Diambil — hanya saat cucian siap dan belum dilunasi */}
        {(isReady && !isUnpaid) ? (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
        }}>
          <div style={{
            width: '100%',
            background: C.white,
            padding: `10px 16px`,
            paddingBottom: `max(10px, env(safe-area-inset-bottom, 0px))`,
          }}>
            <WdBtn
              variant="success"
              fullWidth
              loading={actionLoading === 'pickup'}
              onClick={handlePickedUp}
            >
              ✅ Konfirmasi Diambil
            </WdBtn>
          </div>
        </div>
        ) : null}

        {/* ── Ajukan Pengajuan bottom sheet ───────────────────────── */}
        {showRequestSheet && (
          <>
            {/* Backdrop */}
            <div onClick={() => setShowRequestSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,30,0.5)', zIndex: 30, animation: 'wd-fadeIn .2s ease' }} />
            {/* Sheet */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.white, borderRadius: '24px 24px 0 0', padding: '22px 18px', paddingBottom: 'max(22px, env(safe-area-inset-bottom, 0px))', zIndex: 31, boxShadow: '0 -20px 40px rgba(59,11,71,0.25)', animation: 'wd-slideUp 0.28s cubic-bezier(.2,.8,.3,1) both' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: 40, height: 4, borderRadius: 999, background: C.n200, margin: '0 auto 18px' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <div style={{ fontFamily: FONT, fontSize: 17.5, fontWeight: 700, color: C.n900 }}>Ajukan Pengajuan</div>
                  <div style={{ fontFamily: FONT, fontSize: 12.5, color: C.n500, marginTop: 3 }}>
                    Pilih jenis pengajuan yang diperlukan
                  </div>
                </div>
                <button
                  onClick={() => setShowRequestSheet(false)}
                  className="wd-icon-btn"
                  style={{ background: C.n100, border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <X size={15} color={C.n500} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {requestOptions.map((opt) => (
                  <div
                    key={opt.key}
                    onClick={opt.onClick}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 16, border: `1px solid ${C.n100}`,
                      background: C.white, cursor: 'pointer',
                      transition: 'transform .12s ease',
                    }}
                  >
                    <ClayIcon icon={opt.icon} color={opt.color} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.n900 }}>{opt.title}</div>
                      <div style={{ fontFamily: FONT, fontSize: 11.5, color: C.n500, marginTop: 2 }}>{opt.desc}</div>
                    </div>
                    <ChevronRight size={18} color={C.n400} style={{ flexShrink: 0 }} />
                  </div>
                ))}
                {/* Ubah Pengantaran - separate option at bottom */}
                <div
                  onClick={() => { setShowRequestSheet(false); openDeliveryModal(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 16, border: `1px solid ${C.n100}`,
                    background: C.white, cursor: 'pointer',
                  }}
                >
                  <ClayIcon icon={<Truck size={18} />} color={C.info} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.n900 }}>Ubah Pengantaran</div>
                    <div style={{ fontFamily: FONT, fontSize: 11.5, color: C.n500, marginTop: 2 }}>Ganti metode penjemputan/pesan</div>
                  </div>
                  <ChevronRight size={18} color={C.n400} style={{ flexShrink: 0 }} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── All existing modals (PRESERVED) ─────────────────────── */}

        {/* Approval Modal */}
        <Modal visible={!!approvalModal} onClose={() => { setApprovalModal(null); setApprovalReason(''); }} title={approvalModal === 'cancel_nota' ? 'Ajukan Pembatalan' : 'Ajukan Penghapusan'}>
          <div style={{ fontFamily: FONT, fontSize: 12, color: C.n500, marginBottom: 12 }}>
            {approvalModal === 'cancel_nota'
              ? 'Pengajuan pembatalan akan dikirim ke Admin untuk disetujui.'
              : 'Pengajuan penghapusan (soft-delete) akan dikirim ke Admin. Data tetap ada di database untuk audit keuangan.'}
          </div>
          <Input label="Alasan" value={approvalReason} onChange={setApprovalReason} placeholder="Tuliskan alasan..." />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => { setApprovalModal(null); setApprovalReason(''); }} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="danger" onClick={() => handleRequestApproval(approvalModal)} loading={loading} style={{ flex: 1 }}>Kirim Pengajuan</Btn>
          </div>
        </Modal>

        {/* Reschedule Modal */}
        <Modal visible={rescheduleModal} onClose={() => setRescheduleModal(false)} title="Ubah Jadwal Logistik">
          <DateTimeInput
            label="Jadwal Baru"
            value={rescheduleDate && rescheduleTime ? `${rescheduleDate}T${rescheduleTime}:00` : null}
            onChange={(iso) => {
              if (!iso) { setRescheduleDate(''); setRescheduleTime(''); return; }
              const [d, t] = iso.split('T');
              setRescheduleDate(d); setRescheduleTime(t.slice(0, 5));
            }}
            minDate={new Date()}
          />
          <Input label="Alasan (opsional)" value={rescheduleReason} onChange={setRescheduleReason} placeholder="Alasan reschedule..." />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => setRescheduleModal(false)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="primary" onClick={handleReschedule} loading={loading} style={{ flex: 1 }}>Simpan Jadwal</Btn>
          </div>
        </Modal>

        {/* Pelunasan Modal */}
        <Modal visible={pelunasanModal} onClose={() => setPelunasanModal(false)} title="Catat pelunasan">
          <div style={{ fontFamily: FONT, fontSize: 12, color: C.n500, marginBottom: 12 }}>
            Sisa tagihan: <strong>{rp(balanceDue)}</strong>. Nominal tidak boleh melebihi sisa.
          </div>
          <Select
            label="Metode"
            value={pelMethod} onChange={setPelMethod}
            options={[
              { value: 'cash', label: 'Tunai' },
              { value: 'transfer', label: 'Transfer Bank' },
              { value: 'qris', label: 'QRIS (EDC manual)' },
              { value: 'deposit', label: 'Deposit member' },
            ]}
          />
          <MoneyInput label="Nominal ke tagihan (Rp)" value={pelAmountStr} onChange={setPelAmountStr} placeholder={Number(Math.round(balanceDue)).toLocaleString('id-ID')} />
          {pelMethod === 'cash' && (
            <MoneyInput label="Uang diterima (opsional)" value={pelCashStr} onChange={setPelCashStr} placeholder="Untuk hitung kembalian" />
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Btn variant="secondary" onClick={() => setPelunasanModal(false)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="primary" onClick={submitPelunasan} loading={pelLoading} style={{ flex: 1 }}>Simpan</Btn>
          </div>
        </Modal>

        {/* Edit Delivery Type Modal */}
        {deliveryModal && (
          <>
            {/* Backdrop */}
            <div onClick={() => setDeliveryModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200 }} />
            {/* Sheet */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.white, borderRadius: '20px 20px 0 0', padding: '20px 20px max(32px, env(safe-area-inset-bottom, 0px))', boxShadow: '0 20px 60px rgba(59,11,71,0.2)', zIndex: 201 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: C.n200, margin: '0 auto 16px' }} />
              <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.n900, marginBottom: 4 }}>Ubah Jenis Pengantaran</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: C.n500, marginBottom: 16 }}>Pilih bagaimana customer mendapatkan laundry mereka.</div>

              {[
                { key: 'self', label: '🏪 Ambil Sendiri', desc: 'Customer datang langsung ke outlet' },
                { key: 'pickup', label: '🛵 Dijemput Kurir', desc: 'Kurir menjemput laundry dari customer' },
                { key: 'delivery', label: '🚚 Diantar Kurir', desc: 'Kurir mengantar laundry ke customer' },
                { key: 'both', label: '🔄 Jemput + Antar', desc: 'Jemput kotoran, antar cucian bersih' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setDlvType(opt.key)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 8,
                    border: `2px solid ${dlvType === opt.key ? C.primary : C.n200}`,
                    background: dlvType === opt.key ? `${C.primary}08` : C.white,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: dlvType === opt.key ? C.primary : C.n900 }}>{opt.label}</div>
                    <div style={{ fontFamily: FONT, fontSize: 11, color: C.n500, marginTop: 2 }}>{opt.desc}</div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: 9, border: `2px solid ${dlvType === opt.key ? C.primary : C.n300}`, background: dlvType === opt.key ? C.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {dlvType === opt.key && <div style={{ width: 6, height: 6, borderRadius: 3, background: 'white' }} />}
                  </div>
                </button>
              ))}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeliveryModal(false)} style={{ flex: 1, height: 46, borderRadius: 12, border: `1.5px solid ${C.n200}`, background: C.white, fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.n700, cursor: 'pointer' }}>Batal</button>
                <button onClick={submitDeliveryChange} disabled={dlvLoading} style={{ flex: 2, height: 46, borderRadius: 12, border: 'none', background: dlvLoading ? C.n300 : C.primary, fontFamily: FONT, fontSize: 13, fontWeight: 600, color: 'white', cursor: dlvLoading ? 'default' : 'pointer' }}>
                  {dlvLoading ? 'Menyimpan…' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Review Modal */}
        <Modal visible={reviewModal} onClose={() => setReviewModal(false)} title="Customer Review">
          <div style={{ fontFamily: FONT, fontSize: 13, color: C.n500, marginBottom: 16, textAlign: 'center' }}>
            Tanyakan kepada {tx?.customerName || 'pelanggan'} bagaimana pengalaman laundry-nya.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setReviewRating(star)} style={{ background: 'none', border: 'none', fontSize: 36, color: star <= reviewRating ? C.warning : C.n200, cursor: 'pointer' }}>★</button>
            ))}
          </div>
          <Input label="Komentar / Feedback" value={reviewNote} onChange={setReviewNote} placeholder="Komentar pelanggan..." />
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => setReviewModal(false)} style={{ flex: 1 }}>Nanti</Btn>
            <Btn variant="primary" onClick={handleSubmitReview} loading={loading} style={{ flex: 1 }}>Simpan</Btn>
          </div>
        </Modal>

        {/* Edit Packing Modal */}
        <Modal isOpen={!!packingModal} onClose={() => setPackingModal(null)} title={`📦 Info Packing — ${packingModal?.name || ''}`}>
          <div style={{ fontFamily: FONT, fontSize: 12, color: C.n500, marginBottom: 16 }}>
            Atur jumlah paket dan catatan untuk layanan ini.
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Butuh berapa paket?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setPkgNeeded(v => Math.max(1, v - 1))} style={{ width: 40, height: 40, borderRadius: 20, border: `1.5px solid ${C.n300}`, background: C.n100, cursor: 'pointer', fontFamily: FONT, fontSize: 20, fontWeight: 600, color: C.n700 }}>−</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <span style={{ fontFamily: FONT, fontSize: 32, fontWeight: 900, color: C.primary }}>{pkgNeeded}</span>
                <span style={{ fontFamily: FONT, fontSize: 13, color: C.n500 }}> paket</span>
              </div>
              <button onClick={() => setPkgNeeded(v => v + 1)} style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: C.primary, cursor: 'pointer', fontFamily: FONT, fontSize: 20, fontWeight: 600, color: 'white' }}>+</button>
            </div>
          </div>
          <Input label="Catatan Packing (opsional)" value={pkgNotes} onChange={setPkgNotes} placeholder="Contoh: pisahkan baju putih..." />
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => setPackingModal(null)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="primary" onClick={savePackingInfo} loading={pkgSaving} style={{ flex: 1 }}>Simpan</Btn>
          </div>
        </Modal>

        {/* Refund Cancel Modal */}
        <RefundCancelModal
          isOpen={!!refundTx}
          onClose={() => setRefundTx(null)}
          transaction={refundTx}
          onSuccess={(data) => {
            alertSuccess('Refund berhasil diajukan!');
            setRefundTx(null);
            refreshDetail();
          }}
        />

      </div>
    </div>
  );
}
