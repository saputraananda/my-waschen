import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp, getCartLineSubtotal, getCartUnitPrice } from '../../utils/helpers';
import { TopBar, Btn, Input, Select, Divider, DateTimeInput, MoneyInput } from '../../components/ui';
import { alertError, alertWarning } from '../../utils/alert';
import { useApp } from '../../context/AppContext';
import { hapticError } from '../../utils/haptic';
import PICSelector from '../../components/PICSelector';
import { usePICSelector } from '../../hooks/usePIC';
import { useResponsive, useWindowSize } from '../../utils/hooks';

// ─── Payment Status Auto-Detection ───────────────────────────────────────────
// Cash & Deposit: auto-detect from amount comparison (kasir holds cash / system owns deposit data)
// QRIS / EDC / Transfer: require explicit kasir confirmation — NEVER auto-lunas
function getPaymentStatus(paidAmountValue, total, payMethod, kasirConfirmedReceived) {
  if (!paidAmountValue || paidAmountValue <= 0) return 'pending';
  const external = ['qris', 'edc', 'transfer'].includes(payMethod);
  if (external) {
    if (paidAmountValue >= total && kasirConfirmedReceived) return 'lunas';
    if (paidAmountValue >= total && !kasirConfirmedReceived) return 'menunggu_verifikasi';
    return 'partial';
  }
  // cash & deposit: auto by comparison
  if (paidAmountValue >= total) return 'lunas';
  return 'partial';
}

const PAYMENT_STATUS_CONFIG = {
  lunas: {
    label: 'LUNAS',
    color: '#059669',
    bg: '#d1fae5',
    icon: '✅',
    desc: 'Pembayaran sudah lunas',
  },
  menunggu_verifikasi: {
    label: 'MENUNGGU',
    color: '#0EA5E9',
    bg: '#E0F2FE',
    icon: '⏳',
    desc: 'Kasir belum konfirmasi penerimaan',
  },
  partial: {
    label: 'UANG MUKA',
    color: '#d97706',
    bg: '#fef3c7',
    icon: '💰',
    desc: 'Sisa dilunasi nanti',
  },
  pending: {
    label: 'BELUM BAYAR',
    color: '#6b7280',
    bg: '#f3f4f6',
    icon: '⏳',
    desc: 'Nominal belum diisi',
  },
};

// ─── Payment Method Meta (icons, labels, accent colors) ─────────────────────
const METHOD_ICONS = {
  cash: '💵',
  qris: '📱',
  edc: '💳',
  transfer: '🏦',
  deposit: '👛',
};

const METHOD_LABELS = {
  cash: 'Tunai',
  qris: 'QRIS',
  edc: 'EDC',
  transfer: 'Transfer',
  deposit: 'Saldo',
};

const METHOD_COLORS = {
  cash: '#059669',
  qris: '#6e2e78',
  edc: '#7C3AED',
  transfer: '#2563EB',
  deposit: '#D97706',
};

// ─── Payment Photo Upload Component ──────────────────────────────────────────
function PaymentPhotoUpload({ photo, preview, onFileChange, onClear, mandatory = false, label }) {
  return (
    <div style={{
      background: C.n50,
      borderRadius: 12,
      padding: '16px',
      border: `1px solid ${C.n200}`
    }}>
      <div style={{
        fontFamily: 'Poppins',
        fontSize: 11,
        fontWeight: 600,
        color: C.n600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: 4
      }}>
        {label || '📷 Bukti Transaksi'} {mandatory && <span style={{ color: C.danger }}>*</span>}
      </div>
      <div style={{
        fontFamily: 'Poppins',
        fontSize: 10,
        color: C.n500,
        marginBottom: 12,
        lineHeight: 1.4
      }}>
        {mandatory ? 'Upload foto bukti transfer/rekonsiliasi. Wajib untuk verifikasi.' : 'Upload foto bukti untuk rekonsiliasi. Opsional tapi membantu verifikasi.'}
      </div>

      <label
        style={{
          display: 'block',
          border: `2px dashed ${C.n300}`,
          borderRadius: 12,
          padding: '24px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: C.white,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = C.primary;
          e.currentTarget.style.background = C.primaryLight;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = C.n300;
          e.currentTarget.style.background = C.white;
        }}
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onFileChange) onFileChange(file);
          }}
        />
        <div style={{ fontSize: 32, marginBottom: 8 }}>
          {preview ? '📷' : '📸'}
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 4 }}>
          {preview ? '📷 Foto Tersimpan' : 'Klik untuk Upload Foto'}
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
          {preview ? 'Klik untuk ganti foto' : (mandatory ? 'Foto wajib diupload' : 'Bukti transfer, screenshot, dll.')}
        </div>
      </label>

      {preview && (
        <div style={{ marginTop: 12, position: 'relative' }}>
          <img
            src={preview}
            alt="Bukti transaksi"
            style={{
              width: '100%',
              maxHeight: 150,
              objectFit: 'cover',
              borderRadius: 8,
              border: `1px solid ${C.n200}`
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (onClear) onClear();
            }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: C.danger,
              color: C.white,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Payment Status Badge Component ──────────────────────────────────────────
function PaymentStatusBadge({ status, compact = false }) {
  const config = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.pending;

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 999,
        background: config.bg,
        color: config.color,
        fontFamily: 'Poppins',
        fontSize: 10,
        fontWeight: 700,
      }}>
        {config.icon} {config.label}
      </span>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 14px',
      borderRadius: 12,
      background: config.bg,
      border: `1.5px solid ${config.color}40`,
    }}>
      <div style={{
        fontSize: 24,
        lineHeight: 1,
      }}>{config.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 14,
          fontWeight: 700,
          color: config.color,
        }}>{config.label}</div>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 11,
          color: config.color,
          opacity: 0.8,
          marginTop: 2,
        }}>{config.desc}</div>
      </div>
    </div>
  );
}

function todayKeyWib() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function minSelectableDateWib() {
  const [y, m, d] = todayKeyWib().split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateKeyWib(d) {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function promoDiscountPreview(promo, subtotal) {
  if (!promo || !subtotal) return 0;
  const minTrx = promo.minTrxAmount;
  if (minTrx != null && subtotal < minTrx) return 0;
  let d = promo.type === 'percent' ? subtotal * (Number(promo.value) / 100) : Number(promo.value);
  if (promo.maxDiscount != null) d = Math.min(d, Number(promo.maxDiscount));
  d = Math.min(d, subtotal);
  if (!Number.isFinite(d) || d < 0) return 0;
  return Math.round(d * 100) / 100;
}


export default function NotaStep3Page({ goBack }) {
  const { navigate, user, notaCustomer, notaCart, setNotaCart, setNotaCustomer } = useApp();

  // PIC Selection - track who is responsible for this transaction
  const {
    currentPIC,
    setCurrentPIC,
    availableUsers,
    refreshUsers,
    isLoading: picLoading,
  } = usePICSelector();

  // Fetch available users for PIC on mount
  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  // ── State Validation: Ensure customer and cart exist ──
  useEffect(() => {
    if (!notaCustomer?.id) {
      navigate('nota_step1', null, { replace: true });
    } else if (!notaCart || notaCart.length === 0) {
      navigate('nota_step2', null, { replace: true });
    }
  }, [notaCustomer, notaCart, navigate]);

  // Responsive hooks
  const { isMobile, isTablet } = useResponsive();
  const windowSize = useWindowSize();

  // pickupType: 'self' | 'pickup' | 'delivery' | 'both'
  const [pickupType, setPickupType] = useState('self');
  const [scheduleDate, setScheduleDate] = useState(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [areaZoneId, setAreaZoneId] = useState('');
  const [areaZones, setAreaZones] = useState([]);
  const [courierName, setCourierName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Payment method: 'cash' | 'qris' | 'edc' | 'transfer' | 'deposit'
  const [payMethod, setPayMethod] = useState('cash');

  const [paidAmountStr, setPaidAmountStr] = useState('');

  // Payment photo for external methods (optional for QRIS/EDC, mandatory for Transfer)
  const [paymentPhoto, setPaymentPhoto] = useState(null);
  const [paymentPhotoPreview, setPaymentPhotoPreview] = useState(null);

  // Kasir explicit confirmation for external methods (QRIS/EDC/Transfer)
  const [kasirConfirmedReceived, setKasirConfirmedReceived] = useState(false);

  // Transfer Bank: selected outlet bank account
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);

  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [promos, setPromos] = useState([]);
  const [selectedPromoId, setSelectedPromoId] = useState('');

  // Fetch area zones for delivery fee calculation
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await axios.get('/api/logistics/area-zones');
        setAreaZones(res?.data?.data || []);
      } catch (error) {
        // Silent fail - area zones optional
      }
    };
    fetchZones();
  }, []);

  useEffect(() => {
    const oid = user?.outletId || user?.outlet?.id;
    if (!oid) {
      setPromos([]);
      return;
    }
    axios.get(`/api/promos?outletId=${encodeURIComponent(oid)}`).then((r) => {
      setPromos(r?.data?.data || []);
    }).catch(() => setPromos([]));
  }, [user?.outletId, user?.outlet?.id]);

  // Load available promos for manual selection only — never auto-apply
  useEffect(() => {
    const fetchAutoPromo = async () => {
      const oid = user?.outletId || user?.outlet?.id;
      if (!oid || !notaCart || notaCart.length === 0) return;

      const serviceIds = notaCart.map((c) => c.id).join(',');
      const customerId = notaCustomer?.id || '';

      try {
        const res = await axios.get(
          `/api/promos/auto-applicable?outletId=${encodeURIComponent(oid)}&serviceIds=${serviceIds}&customerId=${customerId}`
        );
        if (res?.data?.success && res.data.data?.length > 0) {
          // Just populate the promo list for manual selection — do NOT auto-select
        }
      } catch (err) {
        // Silent fail
      }
    };

    const timer = setTimeout(fetchAutoPromo, 500);
    return () => clearTimeout(timer);
  }, [notaCart, notaCustomer?.id, user?.outletId, user?.outlet?.id]);

  // Fetch bank accounts for transfer payment method
  useEffect(() => {
    const oid = user?.outletId || user?.outlet?.id;
    if (!oid) return;
    axios.get(`/api/outlets/${oid}/bank-accounts`)
      .then((r) => setBankAccounts(r?.data?.data || []))
      .catch(() => setBankAccounts([]));
  }, [user?.outletId, user?.outlet?.id]);

  // Auto-select first bank account when only 1 available
  useEffect(() => {
    if (bankAccounts.length === 1 && !selectedBankAccountId) {
      setSelectedBankAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, selectedBankAccountId]);

  const selectedZone = areaZones.find((z) => z.id === areaZoneId);
  const logisticFee = pickupType === 'self' ? 0 : pickupType === 'both' ? (selectedZone?.fee || 10000) * 2 : (selectedZone?.fee || 10000);
  const subtotal = notaCart.reduce((sum, c) => sum + getCartLineSubtotal(c), 0);
  const selectedPromo = useMemo(
    () => promos.find((p) => p.id === selectedPromoId) || null,
    [promos, selectedPromoId]
  );
  const promoDiscount = useMemo(
    () => promoDiscountPreview(selectedPromo, subtotal),
    [selectedPromo, subtotal]
  );

  const isAutoAppliedPromo = useMemo(() => {
    if (!selectedPromo) return false;
    return selectedPromo.promoType === 'birthday' || selectedPromo.applicableType !== 'all';
  }, [selectedPromo]);

  const total = subtotal - promoDiscount + logisticFee;

  const paidAmountValue = Math.max(0, Number(paidAmountStr) || 0);

  const paymentStatus = getPaymentStatus(paidAmountValue, total, payMethod, kasirConfirmedReceived);

  const kembalian = paidAmountValue - total;

  const effectivePaid = Math.min(paidAmountValue, total);
  const remainingBalance = Math.max(0, total - paidAmountValue);

  // Auto-calculate due date from longest service duration in cart
  const estimatedDays = useMemo(() => {
    if (!notaCart || notaCart.length === 0) return 0;
    const maxDays = notaCart.reduce((max, item) => {
      const itemDays = Number(item.durationDays || 0);
      return itemDays > max ? itemDays : max;
    }, 0);
    return maxDays;
  }, [notaCart]);

  useEffect(() => {
    if (estimatedDays > 0 && !dueDate) {
      const due = new Date();
      due.setDate(due.getDate() + estimatedDays);
      setDueDate(due.toISOString().slice(0, 10));
    }
  }, [estimatedDays, dueDate]);

  const doCheckout = async (opts = {}) => {
    const { silent = false, returnData = false } = opts;
    if (!notaCustomer || !notaCustomer.id) {
      alertError('Customer belum dipilih. Silakan mulai ulang dari langkah 1.');
      navigate('nota_step1');
      return;
    }
    if (!notaCart || notaCart.length === 0) {
      alertError('Belum ada item layanan. Silakan pilih layanan dulu.');
      navigate('nota_step2');
      return;
    }
    setLoading(true);
    try {
      const formatDate = (d) => {
        if (!d) return null;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const photoBase64 = paymentPhoto ? await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result);
        reader.readAsDataURL(paymentPhoto);
      }) : null;

      const finalPaidAmount = Math.min(paidAmountValue, total);
      const finalChangeAmount = paymentStatus === 'lunas' ? Math.max(0, paidAmountValue - total) : 0;

      const paymentPayload = {
        amount: total,
        paidAmount: finalPaidAmount,
        changeAmount: finalChangeAmount,
      };
      if (finalPaidAmount > 0) {
        paymentPayload.method = payMethod;
      }

      const payload = {
        customerId: notaCustomer.id,
        items: notaCart.map((c) => ({
          serviceId:       c.id,
          serviceName:     c.name,
          unit:            c.unit,
          qty:             c.qty,
          price:           getCartUnitPrice(c),
          subtotal:        getCartLineSubtotal(c),
          isExpress:       c.express || false,
          notes:           c.notes  || null,
          carpetPanjangCm: c.carpetPanjangCm || null,
          carpetLebarCm:   c.carpetLebarCm   || null,
          material:        c.material || null,
          brand:           c.brand || null,
          specialCareAlert: c.specialCareAlert || null,
        })),
        payment: paymentPayload,
        paymentIntent: {
          paidAmount: finalPaidAmount,
          verifiedByKasir: ['qris', 'edc', 'transfer'].includes(payMethod) ? kasirConfirmedReceived : true,
          bankAccountId: payMethod === 'transfer' ? selectedBankAccountId : undefined,
          paymentPhotoBase64: photoBase64,
        },
        picId: currentPIC?.id || user?.userId || user?.id,
        picName: currentPIC?.name || user?.name,
        subtotal,
        discount: 0,
        total,
        promoId: selectedPromoId && promoDiscount > 0 ? selectedPromoId : undefined,
        pickup:   pickupType === 'pickup' || pickupType === 'both',
        delivery: pickupType === 'delivery' || pickupType === 'both',
        pickupType,
        areaZoneId: areaZoneId || null,
        scheduleAt: (scheduleDate && scheduleTime) ? `${formatDate(scheduleDate)}T${scheduleTime}:00` : null,
        courierName: (pickupType === 'delivery' || pickupType === 'both') ? (courierName.trim() || null) : null,
        deliveryNotes: (pickupType === 'delivery' || pickupType === 'both') ? (deliveryNotes.trim() || null) : null,
        notes,
        dueDate: (dueDate && dueDate.trim()) ? dueDate.slice(0, 10) : null,
      };

      const res = await axios.post('/api/transactions/checkout', payload);
      const data = res?.data?.data;

      if (data) {
        const nota = {
          id:            data.transactionNo,
          customerName:  data.customerName,
          customerPhone: data.customerPhone,
          items:         data.items || [],
          total:         Number(data.total) || 0,
          payMethod:     data.payment?.method || payMethod,
          paidAmount:    data.payment?.paidAmount ?? finalPaidAmount,
          changeAmount:  data.payment?.changeAmount ?? finalChangeAmount,
          pickup: pickupType === 'pickup' || pickupType === 'both',
          delivery: pickupType === 'delivery' || pickupType === 'both',
          notes,
          dueDate,
          status: 'baru',
          date:   new Date().toISOString().slice(0, 10),
        };

        if (returnData) return data;
        setNotaCart([]);
        setNotaCustomer(null);
        navigate('nota_berhasil', nota);
      } else {
        if (!silent) {
          hapticError();
          alertError(res?.data?.message || 'Gagal membuat nota');
        }
        return null;
      }
    } catch (error) {
      if (!silent) hapticError();
      const msg = error?.response?.data?.message || 'Gagal membuat nota. Silakan coba lagi.';
      if (!silent) alertError(msg);
      else throw error;
    } finally {
      setLoading(false);
    }
  };

  const externalMethods = ['qris', 'edc', 'transfer'];

  const isConfirmDisabled = (
    (externalMethods.includes(payMethod) && (effectivePaid < total || !kasirConfirmedReceived)) ||
    (payMethod === 'transfer' && (!selectedBankAccountId || !paymentPhoto)) ||
    (payMethod === 'deposit' && Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0) < total) ||
    ((pickupType === 'pickup' || pickupType === 'delivery') && (!scheduleDate || !scheduleTime))
  );

  const handleConfirm = () => {
    if (selectedPromoId && promoDiscount <= 0) {
      alertWarning('Promo tidak memenuhi syarat untuk subtotal saat ini.');
      return;
    }

    if (pickupType === 'pickup') {
      if (!scheduleDate || !scheduleTime) {
        alertError('Jadwal jemput cucian kotor wajib diisi.');
        hapticError();
        return;
      }
    } else if (pickupType === 'delivery') {
      if (!scheduleDate || !scheduleTime) {
        alertError('Jadwal antar cucian bersih wajib diisi.');
        hapticError();
        return;
      }
    }

    if (externalMethods.includes(payMethod) && effectivePaid < total) {
      alertWarning(`Pembayaran ${payMethod.toUpperCase()} harus LUNAS penuh (${rp(total)}).`);
      hapticError();
      return;
    }

    if (externalMethods.includes(payMethod) && !kasirConfirmedReceived) {
      alertWarning(`Konfirmasi penerimaan pembayaran ${payMethod.toUpperCase()} wajib ditekan.`);
      hapticError();
      return;
    }

    if (payMethod === 'transfer' && !selectedBankAccountId) {
      alertWarning('Pilih rekening tujuan transfer.');
      hapticError();
      return;
    }

    if (payMethod === 'transfer' && !paymentPhoto) {
      alertWarning('Upload bukti transfer wajib untuk verifikasi.');
      hapticError();
      return;
    }

    if (payMethod === 'deposit') {
      const balance = Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0);
      if (balance < total) {
        alertWarning('Saldo deposit tidak mencukupi.');
        hapticError();
        return;
      }
    }

    doCheckout();
  };

  const minDateForPicker = minSelectableDateWib();
  const filterPastDates = (d) => dateKeyWib(d) >= todayKeyWib();

  // Guard: kalau customer atau cart hilang (misal page refresh), redirect
  if (!notaCustomer && !loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, background: C.n50 }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900, textAlign: 'center' }}>Data nota tidak lengkap</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, textAlign: 'center' }}>Customer belum dipilih. Silakan mulai ulang dari langkah 1.</div>
        <Btn variant="primary" onClick={() => {
          setNotaCart([]);
          setNotaCustomer(null);
          navigate('nota_step1', null, { replace: true });
        }}>Mulai Ulang</Btn>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Buat Nota" subtitle="Langkah 3 dari 3 — Konfirmasi" onBack={goBack} />

      <div style={{ padding: isMobile ? '6px 12px' : '8px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: C.primary }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 12px' : '12px 16px', paddingBottom: isMobile ? 100 : 20 }}>
        {/* Customer info */}
        <div style={{ background: C.white, borderRadius: isMobile ? 12 : 14, padding: isMobile ? '10px 12px' : '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, fontWeight: 600, color: C.n600, marginBottom: 6 }}>CUSTOMER</div>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 13 : 14, fontWeight: 600, color: C.n900 }}>{notaCustomer?.name}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, color: C.n600 }}>{notaCustomer?.phone}</div>
        </div>

        {/* PIC Selector */}
        <PICSelector
          currentPIC={currentPIC}
          onChange={setCurrentPIC}
          users={availableUsers}
          loading={picLoading}
          compact
        />

        {/* Items */}
        <div style={{ background: C.white, borderRadius: isMobile ? 12 : 14, padding: isMobile ? '10px 12px' : '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>ITEM LAUNDRY</div>
          {notaCart.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  {item.express && <span style={{ background: C.validationWarningBg, color: C.validationWarningText, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999 }}>Express</span>}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11, color: C.n600 }}>{item.qty} {item.unit}</div>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 600, color: C.n900, marginLeft: 8 }}>{rp(getCartLineSubtotal(item))}</div>
            </div>
          ))}

          <Divider my={8} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, color: C.n600 }}>Subtotal</span>
            <span style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, color: C.n900 }}>{rp(subtotal)}</span>
          </div>

          {promos.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600 }}>PROMO</div>
                {selectedPromo && isAutoAppliedPromo && (
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: 9,
                    fontWeight: 700,
                    color: selectedPromo.promoType === 'birthday' ? '#E85D00' : C.primary,
                    background: selectedPromo.promoType === 'birthday' ? '#FFF3E0' : C.primaryLight,
                    padding: '2px 8px',
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    {selectedPromo.promoType === 'birthday' ? '🎂' : '✨'} Auto
                  </div>
                )}
              </div>
              <Select
                value={selectedPromoId}
                onChange={(val) => setSelectedPromoId(val)}
                options={[
                  { value: '', label: 'Tanpa promo' },
                  ...promos.map((p) => ({
                    value: p.id,
                    label: p.promoType === 'birthday'
                      ? `🎂 ${p.name} (Happy Birthday!)`
                      : p.applicableType !== 'all'
                      ? `✨ ${p.name} (Auto)`
                      : p.name
                  })),
                ]}
              />
              {selectedPromo && promoDiscount <= 0 && selectedPromo.minTrxAmount != null && (
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.warning, marginTop: 4 }}>
                  Min. transaksi {rp(selectedPromo.minTrxAmount)} untuk promo ini
                </div>
              )}
              {selectedPromo?.promoType === 'birthday' && (
                <div style={{
                  fontFamily: 'Poppins',
                  fontSize: 10,
                  color: '#E85D00',
                  background: '#FFF3E0',
                  padding: '6px 10px',
                  borderRadius: 8,
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  🎂 Selamat ulang tahun! Diskon otomatis dari sistem.
                </div>
              )}
            </div>
          )}
          {promoDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Diskon promo</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.success }}>-{rp(promoDiscount)}</span>
            </div>
          )}
          {pickupType !== 'self' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Ongkir ({
                pickupType === 'pickup' ? 'Jemput cucian kotor' :
                pickupType === 'delivery' ? 'Antar cucian bersih' :
                'Jemput + Antar'
              })</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{rp(logisticFee)}</span>
            </div>
          )}
          <Divider my={8} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900 }}>Total</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PaymentStatusBadge status={paymentStatus} compact />
              <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900 }}>{rp(total)}</span>
            </div>
          </div>
        </div>

        {/* Layanan Antar/Jemput */}
        <div style={{ background: C.white, borderRadius: isMobile ? 12 : 14, padding: isMobile ? '10px 12px' : '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>LAYANAN ANTAR/JEMPUT</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 6 : 8 }}>
            {[
              { key: 'self', label: 'Self', icon: '🏪', desc: 'Customer ambil sendiri' },
              { key: 'pickup', label: 'Jemput', icon: '🚗', desc: 'Ambil cucian kotor' },
              { key: 'delivery', label: 'Antar', icon: '🛵', desc: 'Antar cucian bersih' },
              { key: 'both', label: 'Both', icon: '🔄', desc: 'Jemput + Antar' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPickupType(opt.key)}
                style={{
                  padding: isMobile ? '8px 6px' : '10px 6px', borderRadius: 10, textAlign: 'center',
                  border: `1.5px solid ${pickupType === opt.key ? C.primary : C.n300}`,
                  background: pickupType === opt.key ? C.primaryLight : C.white,
                  cursor: 'pointer', fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11,
                  fontWeight: pickupType === opt.key ? 700 : 400,
                  color: pickupType === opt.key ? C.primary : C.n700,
                }}
                title={opt.desc}
              >
                <div style={{ fontSize: isMobile ? 16 : 18, marginBottom: 4 }}>{opt.icon}</div>
                {opt.label}
              </button>
            ))}
          </div>

          {pickupType !== 'self' && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(pickupType === 'pickup' || pickupType === 'delivery') && (!scheduleDate || !scheduleTime) && (
                <div style={{
                  background: C.scheduleErrorBg,
                  borderRadius: 10,
                  padding: '10px 12px',
                  border: `1.5px solid ${C.scheduleErrorBorder}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8
                }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <div>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.scheduleErrorText,
                      marginBottom: 2
                    }}>
                      Jadwal Wajib Diisi
                    </div>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 10,
                      color: C.scheduleErrorText,
                      lineHeight: 1.4
                    }}>
                      Untuk layanan {
                        pickupType === 'pickup' ? 'jemput cucian kotor' : 'antar cucian bersih'
                      }, jadwal harus dipilih terlebih dahulu.
                    </div>
                  </div>
                </div>
              )}

              {notaCustomer && (notaCustomer.addressHousing || notaCustomer.addressDetail) && (
                <div style={{ background: C.infoBg, borderRadius: 10, padding: '10px 12px', border: `1px solid ${C.infoBg}` }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.infoDark, marginBottom: 4, letterSpacing: 0.3 }}>
                    📍 ALAMAT {pickupType === 'pickup' ? 'JEMPUT' : pickupType === 'delivery' ? 'ANTAR' : 'JEMPUT & ANTAR'}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800, lineHeight: 1.4 }}>
                    {[notaCustomer.addressHousing, notaCustomer.addressBlock, notaCustomer.addressNo]
                      .filter(Boolean).join(' ')}
                    {notaCustomer.addressDetail && (
                      <div style={{ fontSize: 11, color: C.n600, marginTop: 2 }}>{notaCustomer.addressDetail}</div>
                    )}
                  </div>
                </div>
              )}

              {(pickupType === 'pickup' || pickupType === 'both') && (
                <div>
                  <DateTimeInput
                    label={`📅 Jadwal Jemput${pickupType === 'both' ? ' (Kotor)' : ''} *`}
                    value={
                      scheduleDate && scheduleTime
                        ? `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth()+1).padStart(2,'0')}-${String(scheduleDate.getDate()).padStart(2,'0')}T${scheduleTime}:00`
                        : null
                    }
                    onChange={(iso) => {
                      if (!iso) {
                        setScheduleDate(null);
                        setScheduleTime('');
                        return;
                      }
                      const d = new Date(iso);
                      setScheduleDate(d);
                      const hh = String(d.getHours()).padStart(2, '0');
                      const mm = String(d.getMinutes()).padStart(2, '0');
                      setScheduleTime(`${hh}:${mm}`);
                    }}
                    minDate={minDateForPicker}
                    required
                  />
                  {pickupType !== 'both' && (
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 10,
                      color: C.danger,
                      marginTop: 4,
                      fontStyle: 'italic'
                    }}>
                      * Wajib diisi untuk layanan jemput
                    </div>
                  )}
                </div>
              )}

              {(pickupType === 'delivery' || pickupType === 'both') && (
                <div>
                  <DateTimeInput
                    label={`📅 Jadwal Antar${pickupType === 'both' ? ' (Bersih)' : ''} *`}
                    value={
                      scheduleDate && scheduleTime
                        ? `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth()+1).padStart(2,'0')}-${String(scheduleDate.getDate()).padStart(2,'0')}T${scheduleTime}:00`
                        : null
                    }
                    onChange={(iso) => {
                      if (!iso) {
                        setScheduleDate(null);
                        setScheduleTime('');
                        return;
                      }
                      const d = new Date(iso);
                      setScheduleDate(d);
                      const hh = String(d.getHours()).padStart(2, '0');
                      const mm = String(d.getMinutes()).padStart(2, '0');
                      setScheduleTime(`${hh}:${mm}`);
                    }}
                    minDate={minDateForPicker}
                    required
                  />
                  {pickupType !== 'both' && (
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 10,
                      color: C.danger,
                      marginTop: 4,
                      fontStyle: 'italic'
                    }}>
                      * Wajib diisi untuk layanan antar
                    </div>
                  )}
                </div>
              )}

              <Select
                label="Area Zone (ongkir)"
                value={areaZoneId}
                onChange={setAreaZoneId}
                options={[
                  { value: '', label: 'Pilih zona...' },
                  ...areaZones.map((z) => ({ value: z.id, label: `${z.name} - ${rp(z.fee)}` })),
                ]}
              />

              {(pickupType === 'delivery' || pickupType === 'both') && (
                <>
                  <Input
                    label="Nama Kurir / Pengantar"
                    value={courierName}
                    onChange={setCourierName}
                    placeholder="Contoh: Pak Budi"
                  />
                  <Input
                    label="Catatan untuk Kurir (opsional)"
                    value={deliveryNotes}
                    onChange={setDeliveryNotes}
                    placeholder="Contoh: Pagar warna hijau, bel 2x"
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Waktu Pembayaran */}
        <div style={{ background: C.white, borderRadius: isMobile ? 12 : 14, padding: isMobile ? '10px 12px' : '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>WAKTU PEMBAYARAN</div>

          {/* Auto-detected Payment Status Banner */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 10,
                fontWeight: 600,
                color: C.n600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>Status Pembayaran</div>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 9,
                color: C.n500,
              }}>{['cash', 'deposit'].includes(payMethod) ? 'Auto-detected' : 'Konfirmasi Kasir'}</div>
            </div>
            <PaymentStatusBadge status={paymentStatus} />
          </div>

          {/* 5 Flat Payment Method Cards */}
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, fontWeight: 600, color: C.n600, marginBottom: 8, marginTop: 4 }}>METODE PEMBAYARAN</div>

          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 8,
            scrollbarWidth: 'none',
            marginBottom: 14,
          }}>
            {['cash', 'qris', 'edc', 'transfer', 'deposit'].map((mid) => {
              const active = payMethod === mid;
              const color = METHOD_COLORS[mid];
              const hasDeposit = !!(notaCustomer?.depositBalance ?? notaCustomer?.deposit);
              if (mid === 'deposit' && !hasDeposit) return null;

              return (
                <button
                  key={mid}
                  type="button"
                  onClick={() => {
                    setPayMethod(mid);
                    setKasirConfirmedReceived(false);
                    setPaidAmountStr('');
                    if (mid !== 'transfer') setSelectedBankAccountId('');
                  }}
                  style={{
                    flexShrink: 0,
                    minWidth: isMobile ? 64 : 80,
                    padding: '10px 8px',
                    borderRadius: 12,
                    border: `2px solid ${active ? color : C.n200}`,
                    background: active ? `${color}15` : C.white,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{METHOD_ICONS[mid]}</div>
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    color: active ? color : C.n700,
                  }}>{METHOD_LABELS[mid]}</div>
                </button>
              );
            })}
          </div>

          {/* ─── Method Content Panels ─────────────────────────── */}

          {/* CASH Panel */}
          {payMethod === 'cash' && (
            <div style={{ marginTop: 4, background: C.n50, borderRadius: 12, padding: '16px', border: `1px solid ${C.n200}` }}>
              <div style={{
                background: C.white,
                borderRadius: 12,
                padding: '16px',
                marginBottom: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
              }}>
                <div style={{
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 500,
                  color: C.n600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 8
                }}>
                  Nominal Diterima
                </div>
                <div style={{
                  fontFamily: 'Poppins',
                  fontSize: 32,
                  fontWeight: 700,
                  color: C.n900,
                  marginBottom: 4
                }}>
                  {effectivePaid > 0 ? rp(effectivePaid) : 'Rp 0'}
                </div>
                <div style={{
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  color: C.n500
                }}>
                  Uang Tunai · Kasir {user?.name || 'RH'}
                </div>
              </div>

              {effectivePaid > 0 && kembalian >= 0 && (
                <div style={{
                  background: `linear-gradient(135deg, ${C.successBg} 0%, #A7F3D0 100%)`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  marginBottom: 12,
                  border: `1.5px solid ${C.success}`,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{
                        fontFamily: 'Poppins',
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.successDark,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Kembalian
                      </div>
                      <div style={{
                        fontFamily: 'Poppins',
                        fontSize: 10,
                        color: C.success,
                        marginTop: 2
                      }}>
                        {rp(effectivePaid)} - {rp(effectivePaid)}
                      </div>
                    </div>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 24,
                      fontWeight: 700,
                      color: C.success
                    }}>
                      {rp(kembalian)}
                    </div>
                  </div>
                </div>
              )}

              <div style={{
                fontFamily: 'Poppins',
                fontSize: 11,
                fontWeight: 600,
                color: C.n600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 8
              }}>
                Nominal Cepat
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setPaidAmountStr(String(Math.ceil(total / 1000) * 1000))}
                  style={{
                    padding: '12px 8px',
                    borderRadius: 10,
                    border: `1.5px solid ${C.primary}`,
                    background: C.primaryLight,
                    fontFamily: 'Poppins',
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.primary,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 500, marginBottom: 2 }}>Total</div>
                  <div>{rp(Math.ceil(total / 1000) * 1000)}</div>
                </button>

                {[50000, 100000, 150000].map((amount) => {
                  const isSelected = effectivePaid === amount;
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setPaidAmountStr(String(amount))}
                      style={{
                        padding: '12px 8px',
                        borderRadius: 10,
                        border: `1.5px solid ${isSelected ? C.primary : C.n300}`,
                        background: isSelected ? C.primaryLight : C.white,
                        fontFamily: 'Poppins',
                        fontSize: 12,
                        fontWeight: 600,
                        color: isSelected ? C.primary : C.n700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'center'
                      }}
                    >
                      {rp(amount)}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setPaidAmountStr(String(total))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1.5px solid ${C.success}`,
                    background: C.successBg,
                    fontFamily: 'Poppins',
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.success,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                >
                  💵 Pas (Exact) — {rp(total)}
                </button>
              </div>

              <div style={{ marginTop: 12 }}>
                <MoneyInput
                  value={paidAmountStr}
                  onChange={setPaidAmountStr}
                  placeholder="Atau masukkan nominal lain..."
                  style={{
                    background: C.white,
                    border: `1.5px solid ${C.n300}`,
                    fontSize: 14
                  }}
                />
              </div>

              {effectivePaid > 0 && effectivePaid < total && (
                <div style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  background: C.validationErrorBg,
                  borderRadius: 8,
                  border: `1px solid ${C.validationErrorBorder}`
                }}>
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: 11,
                    color: C.validationErrorText,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span>⚠️</span>
                    <span>Uang yang diterima kurang <strong>{rp(total - effectivePaid)}</strong></span>
                  </div>
                </div>
              )}

              <div style={{
                marginTop: 12,
                padding: '10px 12px',
                background: C.infoBg,
                borderRadius: 8,
                border: `1px solid ${C.infoBg}`,
                fontFamily: 'Poppins',
                fontSize: 11,
                color: C.infoDark,
                lineHeight: 1.5
              }}>
                💰 {paymentStatus === 'pending' ? 'Masukkan nominal untuk melanjutkan.' : paymentStatus === 'lunas' ? 'Lunas dengan uang tunai.' : `Partial payment. Sisa ${rp(total - effectivePaid)} akan dilunasi nanti.`}
              </div>
            </div>
          )}

          {/* QRIS Panel */}
          {payMethod === 'qris' && (
            <div style={{ marginTop: 4, background: C.n50, borderRadius: 12, padding: '16px', border: `1px solid ${C.n200}` }}>
              <div style={{
                background: '#6e2e7810',
                borderRadius: 12,
                padding: '20px',
                textAlign: 'center',
                marginBottom: 12,
                border: '2px dashed #6e2e7840',
              }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#6e2e78', marginBottom: 6 }}>
                  📱 Tunjukkan QRIS ke Customer
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                <button type="button" onClick={() => setPaidAmountStr(String(Math.ceil(total / 1000) * 1000))}
                  style={{ padding: '10px', borderRadius: 10, border: `1.5px solid ${C.primary}`, background: C.primaryLight, fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.primary, cursor: 'pointer' }}>
                  Total {rp(Math.ceil(total / 1000) * 1000)}
                </button>
                <button type="button" onClick={() => setPaidAmountStr(String(total))}
                  style={{ padding: '10px', borderRadius: 10, border: `1.5px solid ${C.success}`, background: C.successBg, fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.success, cursor: 'pointer' }}>
                  Pas — {rp(total)}
                </button>
              </div>

              <MoneyInput value={paidAmountStr} onChange={setPaidAmountStr} placeholder="Masukkan nominal yang diklaim customer..." />

              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={() => setKasirConfirmedReceived(true)}
                  disabled={effectivePaid < total} style={{
                    width: '100%', padding: '14px', borderRadius: 12,
                    border: `2px solid ${kasirConfirmedReceived ? C.success : (effectivePaid >= total ? '#6e2e78' : C.n300)}`,
                    background: kasirConfirmedReceived ? C.successBg : (effectivePaid >= total ? '#6e2e7810' : C.n50),
                    fontFamily: 'Poppins', fontSize: 14, fontWeight: 600,
                    color: kasirConfirmedReceived ? C.success : (effectivePaid >= total ? '#6e2e78' : C.n500),
                    cursor: effectivePaid >= total ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {kasirConfirmedReceived ? '✅ Sudah Dikonfirmasi' : '🔒 Konfirmasi: Uang Sudah Diterima'}
                </button>
              </div>

              {effectivePaid >= total && !kasirConfirmedReceived && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#E0F2FE', borderRadius: 10, fontFamily: 'Poppins', fontSize: 11, color: '#0EA5E9', fontWeight: 600 }}>
                  ⏳ Nominal cukup. Tekan tombol konfirmasi di atas.
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <PaymentPhotoUpload photo={paymentPhoto} preview={paymentPhotoPreview}
                  onFileChange={(f) => { setPaymentPhoto(f); const r = new FileReader(); r.onload = (ev) => setPaymentPhotoPreview(ev.target?.result); r.readAsDataURL(f); }}
                  onClear={() => { setPaymentPhoto(null); setPaymentPhotoPreview(null); }}
                  mandatory={false} label="📷 Bukti QRIS (Opsional)" />
              </div>
            </div>
          )}

          {/* EDC Panel */}
          {payMethod === 'edc' && (
            <div style={{ marginTop: 4, background: C.n50, borderRadius: 12, padding: '16px', border: `1px solid ${C.n200}` }}>
              <div style={{
                background: '#7C3AED10', borderRadius: 12, padding: '20px',
                textAlign: 'center', marginBottom: 12, border: '2px dashed #7C3AED40',
              }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#7C3AED', marginBottom: 4 }}>💳 Gesek Kartu di Mesin EDC</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#7C3AED', opacity: 0.8 }}>Minta customer gesek kartu debit/kredit</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                <button type="button" onClick={() => setPaidAmountStr(String(Math.ceil(total / 1000) * 1000))}
                  style={{ padding: '10px', borderRadius: 10, border: `1.5px solid ${C.primary}`, background: C.primaryLight, fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.primary, cursor: 'pointer' }}>
                  Total {rp(Math.ceil(total / 1000) * 1000)}
                </button>
                <button type="button" onClick={() => setPaidAmountStr(String(total))}
                  style={{ padding: '10px', borderRadius: 10, border: `1.5px solid ${C.success}`, background: C.successBg, fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.success, cursor: 'pointer' }}>
                  Pas — {rp(total)}
                </button>
              </div>

              <MoneyInput value={paidAmountStr} onChange={setPaidAmountStr} placeholder="Masukkan nominal yang diklaim customer..." />

              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={() => setKasirConfirmedReceived(true)}
                  disabled={effectivePaid < total} style={{
                    width: '100%', padding: '14px', borderRadius: 12,
                    border: `2px solid ${kasirConfirmedReceived ? C.success : (effectivePaid >= total ? '#7C3AED' : C.n300)}`,
                    background: kasirConfirmedReceived ? C.successBg : (effectivePaid >= total ? '#7C3AED10' : C.n50),
                    fontFamily: 'Poppins', fontSize: 14, fontWeight: 600,
                    color: kasirConfirmedReceived ? C.success : (effectivePaid >= total ? '#7C3AED' : C.n500),
                    cursor: effectivePaid >= total ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {kasirConfirmedReceived ? '✅ Sudah Dikonfirmasi' : '🔒 Konfirmasi: Struk EDC Approved'}
                </button>
              </div>

              {effectivePaid >= total && !kasirConfirmedReceived && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#E0F2FE', borderRadius: 10, fontFamily: 'Poppins', fontSize: 11, color: '#0EA5E9', fontWeight: 600 }}>
                  ⏳ Nominal cukup. Tekan tombol konfirmasi di atas.
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <PaymentPhotoUpload photo={paymentPhoto} preview={paymentPhotoPreview}
                  onFileChange={(f) => { setPaymentPhoto(f); const r = new FileReader(); r.onload = (ev) => setPaymentPhotoPreview(ev.target?.result); r.readAsDataURL(f); }}
                  onClear={() => { setPaymentPhoto(null); setPaymentPhotoPreview(null); }}
                  mandatory={false} label="📷 Struk EDC (Opsional)" />
              </div>
            </div>
          )}

          {/* Transfer Bank Panel */}
          {payMethod === 'transfer' && (
            <div style={{ marginTop: 4, background: C.n50, borderRadius: 12, padding: '16px', border: `1px solid ${C.n200}` }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  Rekening Tujuan Transfer
                </div>
                {bankAccounts.length === 0 ? (
                  <div style={{ padding: '12px', background: C.white, borderRadius: 10, border: `1px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 11, color: C.n500, textAlign: 'center' }}>
                    Tidak ada rekening bank tersedia.
                  </div>
                ) : (
                  <Select
                    value={selectedBankAccountId}
                    onChange={setSelectedBankAccountId}
                    options={[
                      { value: '', label: 'Pilih rekening...' },
                      ...bankAccounts.map((b) => ({ value: b.id, label: `${b.bankName} — ${b.accountNumber} (a.n. ${b.accountHolder})` })),
                    ]}
                  />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                <button type="button" onClick={() => setPaidAmountStr(String(Math.ceil(total / 1000) * 1000))}
                  style={{ padding: '10px', borderRadius: 10, border: `1.5px solid ${C.primary}`, background: C.primaryLight, fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.primary, cursor: 'pointer' }}>
                  Total {rp(Math.ceil(total / 1000) * 1000)}
                </button>
                <button type="button" onClick={() => setPaidAmountStr(String(total))}
                  style={{ padding: '10px', borderRadius: 10, border: `1.5px solid ${C.success}`, background: C.successBg, fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.success, cursor: 'pointer' }}>
                  Pas — {rp(total)}
                </button>
              </div>

              <MoneyInput value={paidAmountStr} onChange={setPaidAmountStr} placeholder="Masukkan nominal transfer..." />

              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={() => setKasirConfirmedReceived(true)}
                  disabled={effectivePaid < total} style={{
                    width: '100%', padding: '14px', borderRadius: 12,
                    border: `2px solid ${kasirConfirmedReceived ? C.success : (effectivePaid >= total ? '#2563EB' : C.n300)}`,
                    background: kasirConfirmedReceived ? C.successBg : (effectivePaid >= total ? '#2563EB10' : C.n50),
                    fontFamily: 'Poppins', fontSize: 14, fontWeight: 600,
                    color: kasirConfirmedReceived ? C.success : (effectivePaid >= total ? '#2563EB' : C.n500),
                    cursor: effectivePaid >= total ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {kasirConfirmedReceived ? '✅ Sudah Dikonfirmasi' : '🔒 Konfirmasi: Transfer Sudah Masuk'}
                </button>
              </div>

              {effectivePaid >= total && !kasirConfirmedReceived && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#E0F2FE', borderRadius: 10, fontFamily: 'Poppins', fontSize: 11, color: '#0EA5E9', fontWeight: 600 }}>
                  ⏳ Nominal cukup. Tekan tombol konfirmasi di atas.
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <PaymentPhotoUpload photo={paymentPhoto} preview={paymentPhotoPreview}
                  onFileChange={(f) => { setPaymentPhoto(f); const r = new FileReader(); r.onload = (ev) => setPaymentPhotoPreview(ev.target?.result); r.readAsDataURL(f); }}
                  onClear={() => { setPaymentPhoto(null); setPaymentPhotoPreview(null); }}
                  mandatory={true} label="📷 Bukti Transfer (Wajib)" />
              </div>
            </div>
          )}

          {/* Deposit Panel */}
          {payMethod === 'deposit' && (
            <div style={{ marginTop: 4, background: C.n50, borderRadius: 12, padding: '16px', border: `1px solid ${C.n200}` }}>
              <div style={{
                background: C.white, borderRadius: 12, padding: '16px', marginBottom: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
              }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 500, color: C.n600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  Saldo Deposit Customer
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 32, fontWeight: 700, color: C.primary, marginBottom: 4 }}>
                  {rp(Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0))}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>
                  {notaCustomer?.name || 'Customer'} · {notaCustomer?.phone || '-'}
                </div>
              </div>

              <div style={{
                background: C.white, borderRadius: 12, padding: '14px 16px', marginBottom: 12,
                border: `1.5px solid ${C.n200}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Total Tagihan</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{rp(total)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Saldo Deposit</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.primary }}>{rp(Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0))}</div>
                </div>
                <div style={{ height: '1px', background: C.n200, margin: '8px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>Sisa Saldo</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: (Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0) - total) >= 0 ? C.success : C.danger }}>
                    {rp(Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0) - total)}
                  </div>
                </div>
              </div>

              {(Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0) < total) && (
                <div style={{ padding: '12px 14px', background: C.validationErrorBg, borderRadius: 10, border: `1.5px solid ${C.validationErrorBorder}` }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.validationErrorText, display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <span>⚠️</span><span>Saldo Deposit Tidak Cukup</span>
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.validationErrorText, lineHeight: 1.5, paddingLeft: 24 }}>
                    Saldo kurang <strong>{rp(total - Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0))}</strong>.
                    Customer perlu top up deposit atau pilih metode lain.
                  </div>
                </div>
              )}
              {(Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0) >= total) && (
                <div style={{ padding: '12px 14px', background: `linear-gradient(135deg, ${C.successBg} 0%, #A7F3D0 100%)`, borderRadius: 10, border: `1.5px solid ${C.success}` }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.successDark, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>✅</span><span>Saldo Deposit Mencukupi</span>
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.success, marginTop: 4, paddingLeft: 28 }}>
                    Pembayaran akan memotong deposit sebesar <strong>{rp(total)}</strong>. Status auto-lunas.
                  </div>
                </div>
              )}

              <div style={{ marginTop: 12, padding: '10px 12px', background: C.infoBg, borderRadius: 8, fontFamily: 'Poppins', fontSize: 11, color: C.infoDark, lineHeight: 1.5 }}>
                💳 Pembayaran via deposit otomatis memotong saldo customer. Tidak perlu konfirmasi tambahan.
              </div>
            </div>
          )}
        </div>

        {/* Estimasi Selesai - Auto-calculated from service duration */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>📅 ESTIMASI SELESAI</div>
          <Input
            type="date"
            label={estimatedDays > 0 ? `Estimasi ${estimatedDays} hari kerja` : 'Tanggal Selesai'}
            value={dueDate || ''}
            onChange={setDueDate}
            min={todayKeyWib()}
            placeholder="Pilih tanggal estimasi selesai"
          />
          {estimatedDays > 0 && (
            <div style={{
              marginTop: 8,
              padding: '8px 10px',
              background: C.successBg,
              borderRadius: 8,
              fontFamily: 'Poppins',
              fontSize: 10,
              color: C.successDark,
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              ✅ Auto: {estimatedDays} hari dari layanan terlama di cart
            </div>
          )}
        </div>

        {/* Catatan */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>📝 CATATAN</div>
          <Input label="Catatan (opsional)" value={notes} onChange={setNotes} placeholder="Catatan khusus..." />
        </div>
      </div>

      <div style={{
        padding: isMobile ? '10px 12px' : '12px 16px',
        background: C.white,
        borderTop: `1px solid ${C.n100}`,
        ...(isMobile ? { position: 'sticky', bottom: 0, boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 10 } : {}),
      }}>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 10 }}>
          <Btn variant="secondary" onClick={() => goBack?.()} style={{ flex: 1 }}>Kembali</Btn>
          <Btn variant="primary" onClick={handleConfirm} loading={loading}
            style={{ flex: isMobile ? 1.5 : 2 }}
            disabled={isConfirmDisabled}>
            {paymentStatus === 'pending' ? 'Konfirmasi Nota' : paymentStatus === 'lunas' ? `Bayar & Konfirmasi ${rp(effectivePaid)}` : `Bayar DP ${rp(effectivePaid)}`}
          </Btn>
        </div>
      </div>
    </div>
  );
}