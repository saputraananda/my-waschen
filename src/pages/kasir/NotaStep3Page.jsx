import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp, getCartLineSubtotal, getCartUnitPrice } from '../../utils/helpers';
import { TopBar, Btn, Input, Select, Divider, MoneyInput } from '../../components/ui';
import { alertError, alertErrorDetailed, alertWarning } from '../../utils/alert';
import { useApp } from '../../context/AppContext';
import { hapticError } from '../../utils/haptic';
import PICSelector from '../../components/PICSelector';
import { usePICSelector } from '../../hooks/usePIC';
import { useResponsive, useWindowSize } from '../../utils/hooks';

// ─── Client-side Image Compression ────────────────────────────────────────────
// Resize to max 800px width, PNG format (lossless) → text stays sharp
// Typical size: 200-400KB vs original 2-5MB phone photo
const compressImage = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_W = 800;
      let { width, height } = img;
      if (width > MAX_W) {
        height = Math.round((height * MAX_W) / width);
        width = MAX_W;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });

// ─── Payment Status Auto-Detection ───────────────────────────────────────────
// Cash & Deposit: auto-detect from amount comparison
// QRIS / EDC / Transfer: now also auto-detect like cash (no separate confirmation needed)
function getPaymentStatus(paidAmountValue, total, payMethod) {
  if (!paidAmountValue || paidAmountValue <= 0) return 'pending';
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
  qris: '#5B005F',
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
        <div style={{ marginTop: 12, position: 'relative', display: 'inline-block' }}>
          <img
            src={preview}
            alt="Bukti transaksi"
            style={{
              width: 80,
              height: 80,
              objectFit: 'cover',
              borderRadius: 10,
              border: `2px solid ${C.n200}`,
              display: 'block',
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (onClear) onClear();
            }}
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: C.danger,
              color: C.white,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              padding: 0,
            }}
          >
            ×
          </button>
          <div style={{ marginTop: 6, fontFamily: 'Poppins', fontSize: 9, color: C.n500, textAlign: 'center' }}>
            {Math.round(preview.length * 0.75 / 1024)} KB
          </div>
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

  // Navigation guard state - must be BEFORE any useEffect that uses it
  const [isNavigatingAway, setIsNavigatingAway] = useState(false);

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
    // Skip validation if we're navigating away after successful checkout
    console.log('[USEFFECT-VALIDATION] isNavigatingAway:', isNavigatingAway, '| notaCustomer:', !!notaCustomer, '| notaCart length:', notaCart?.length);
    if (isNavigatingAway) return;
    if (!notaCustomer?.id) {
      console.log('[USEFFECT-VALIDATION] Redirecting to nota_step1 - no customer');
      navigate('nota_step1', null, { replace: true });
    } else if (!notaCart || notaCart.length === 0) {
      console.log('[USEFFECT-VALIDATION] Redirecting to nota_step2 - no cart');
      navigate('nota_step2', null, { replace: true });
    }
  }, [notaCustomer, notaCart, navigate, isNavigatingAway]);

  // Responsive hooks
  const { isMobile, isTablet } = useResponsive();
  const windowSize = useWindowSize();

  // pickupType: 'self' | 'pickup' | 'delivery' | 'both'
  const [pickupType, setPickupType] = useState('self');
  // Separate schedules for pickup (jemput cucian kotor) and delivery (antar cucian bersih)
  const [pickupScheduleDate, setPickupScheduleDate] = useState(null);
  const [deliveryScheduleDate, setDeliveryScheduleDate] = useState(null);
  const [areaZoneId, setAreaZoneId] = useState('');
  const [areaZones, setAreaZones] = useState([]);
  const [courierName, setCourierName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Payment method: 'cash' | 'qris' | 'edc' | 'transfer' | 'deposit'
  const [payMethod, setPayMethod] = useState('cash');

  const [paidAmountStr, setPaidAmountStr] = useState('');

  // Payment photo state removed — photo upload for payment confirmation no longer required

  // Transfer Bank state removed — bank account selection no longer required

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
        const zones = res?.data?.data || [];
        setAreaZones(zones);
        // Auto-select "Isi" zone if available
        const isiZone = zones.find((z) => z.name?.toLowerCase().includes('isi'));
        if (isiZone) {
          setAreaZoneId(isiZone.id);
        } else if (zones.length === 1) {
          // Fallback: auto-select the only zone available
          setAreaZoneId(zones[0].id);
        }
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

  // Bank accounts fetch & auto-select removed — no longer required

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

  const paymentStatus = getPaymentStatus(paidAmountValue, total, payMethod);

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

    const formatDate = (d) => {
        if (!d) return null;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // photoBase64 removed — payment photo upload no longer required

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
        // Send separate schedules for pickup and delivery (date only, no time)
        scheduleAt: (pickupType === 'pickup' || pickupType === 'both') && pickupScheduleDate
          ? `${formatDate(pickupScheduleDate)}`
          : (pickupType === 'delivery') && deliveryScheduleDate
          ? `${formatDate(deliveryScheduleDate)}`
          : null,
        pickupScheduleAt: (pickupType === 'pickup' || pickupType === 'both') && pickupScheduleDate
          ? `${formatDate(pickupScheduleDate)}`
          : null,
        deliveryScheduleAt: (pickupType === 'delivery' || pickupType === 'both') && deliveryScheduleDate
          ? `${formatDate(deliveryScheduleDate)}`
          : null,
        courierName: (pickupType === 'delivery' || pickupType === 'both') ? (courierName.trim() || null) : null,
        deliveryNotes: (pickupType === 'delivery' || pickupType === 'both') ? (deliveryNotes.trim() || null) : null,
        notes,
        dueDate: (dueDate && dueDate.trim()) ? dueDate.slice(0, 10) : null,
      };

      // DEBUG: Log full payload
      console.log('[CHECKOUT] 🚀 Sending checkout payload:', JSON.stringify(payload, null, 2));
      console.log('[CHECKOUT]   customerId:', payload.customerId, '| type:', typeof payload.customerId);
      console.log('[CHECKOUT]   items count:', payload.items.length);
      payload.items.forEach((item, i) => {
        console.log(`[CHECKOUT]   item[${i}]: serviceId=${item.serviceId} (type=${typeof item.serviceId}) | unit=${item.unit} | qty=${item.qty} | carpetPanjangCm=${item.carpetPanjangCm} | carpetLebarCm=${item.carpetLebarCm}`);
      });
      console.log('[CHECKOUT]   pickupType:', payload.pickupType, '| pickup:', payload.pickup, '| delivery:', payload.delivery);
      console.log('[CHECKOUT]   pickupScheduleAt:', payload.pickupScheduleAt);
      console.log('[CHECKOUT]   deliveryScheduleAt:', payload.deliveryScheduleAt);
      console.log('[CHECKOUT]   payment:', JSON.stringify(payload.payment));

      let res;
      try {
        res = await axios.post('/api/transactions/checkout', payload, { timeout: 30000 });
        console.log('[CHECKOUT] ✅ Response received:', { status: res?.status, data: res?.data });
        const data = res?.data?.data;
        console.log('[CHECKOUT] data value:', data, 'typeof:', typeof data, 'keys:', data ? Object.keys(data) : 'N/A');
        if (!data) {
          console.error('[CHECKOUT] FATAL: data is null/undefined! Response:', res?.data);
        }

        if (data) {
          const isExpressOrder = notaCart.some(c => c.express);
          const nota = {
            transactionId: data.id,
            transactionNo: data.transactionNo,
            sessionId: data.sessionId,
            subSessionId: data.subSessionId,
            customerId: notaCustomer?.id,
            customerName: notaCustomer?.name,
            customerPhone: notaCustomer?.phone,
            items: notaCart.map((c) => ({ id: c.id, name: c.name, qty: c.qty, unit: c.unit })),
            total,
            subtotal,
            paidAmount: finalPaidAmount,
            changeAmount: finalChangeAmount,
            payMethod,
            paymentStatus,
            pickupType,
            dueDate: payload.dueDate,
            notes,
            isExpress: isExpressOrder,
            promoDiscount,
            birthdayDiscount: data.birthdayDiscount || 0,
            deliveryFee: logisticFee,
          };

          if (returnData) return data;
          // Set navigating flag BEFORE clearing state to prevent guard from triggering
          console.log('[CHECKOUT] 🚀 Navigating to nota_berhasil, setting isNavigatingAway=true');
          setIsNavigatingAway(true);
          setNotaCart([]);
          setNotaCustomer(null);
          navigate('nota_berhasil', nota);
          console.log('[CHECKOUT] ✅ navigate() called');
        } else {
          // Server returned success:false or no data
          if (!silent) {
            hapticError();
            const errorMsg = res?.data?.message || 'Gagal membuat nota';
            const errorDetails = res?.data?.errors;
            const errorType = res?.data?.error;

            // Build detailed error message
            let detailedMsg = errorMsg;

            // Add field-specific errors if available
            if (errorDetails && Object.keys(errorDetails).length > 0) {
              const fieldErrors = Object.entries(errorDetails)
                .map(([field, desc]) => {
                  const fieldLabel = {
                    pickup_schedule_at: '📅 Jadwal Pickup',
                    delivery_schedule_at: '📅 Jadwal Delivery',
                    material_id: '🧵 Material',
                    carpetPanjangCm: '📐 Panjang Karpet',
                    carpetLebarCm: '📐 Lebar Karpet',
                    service_id: '🧺 Layanan',
                  }[field] || `❓ ${field}`;
                  return `${fieldLabel}: ${desc}`;
                })
                .join('\n');
              detailedMsg = `${errorMsg}\n\n📋 Detail Error:\n${fieldErrors}`;
            }

            // Add hint for specific error types
            const hints = {
              'INVALID_CUSTOMER': '\n\n💡 Pilih customer dari daftar yang tersedia.',
              'INVALID_SERVICE': '\n\n💡 Hapus layanan dan pilih ulang.',
              'INVALID_PROMO': '\n\n💡 Pilih promo lain atau hapus promo.',
              'NO_ACTIVE_SHIFT': '\n\n💡 Buka shift kasir terlebih dahulu.',
            };
            if (hints[errorType]) {
              detailedMsg += hints[errorType];
            }

            // Use detailed alert for complex errors
            if (errorDetails && Object.keys(errorDetails).length > 0) {
              alertErrorDetailed('Validasi Gagal', detailedMsg);
            } else if (detailedMsg.length > 100 || hints[errorType]) {
              alertErrorDetailed('Error', detailedMsg);
            } else {
              alertError(detailedMsg);
            }
          }
          return null;
        }
      } catch (error) {
        if (!silent) hapticError();

        // Extract error details
        const errorData = error?.response?.data;
        const statusCode = error?.response?.status;
        const errorType = errorData?.error;
        const errorDetails = errorData?.details;
        const fieldErrors = errorData?.errors;

        // Build error message based on status code
        let userMessage = errorData?.message || 'Gagal membuat nota. Silakan coba lagi.';

        // Add field-specific errors if available
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          const fieldList = Object.entries(fieldErrors)
            .map(([field, desc]) => {
              const fieldLabel = {
                pickup_schedule_at: '📅 Jadwal Pickup',
                delivery_schedule_at: '📅 Jadwal Delivery',
                material_id: '🧵 Material',
                carpetPanjangCm: '📐 Panjang Karpet',
                carpetLebarCm: '📐 Lebar Karpet',
                service_id: '🧺 Layanan',
              }[field] || `❓ ${field}`;
              return `${fieldLabel}: ${desc}`;
            })
            .join('\n');
          userMessage = `${userMessage}\n\n📋 Detail Error:\n${fieldList}`;
        }

        // Add contextual hints based on error type and status
        if (statusCode === 403 && errorData?.requiresShift) {
          userMessage = '⚠️ Shift belum dibuka.\n\nBuka shift kasir terlebih dahulu sebelum membuat transaksi.';
        } else if (statusCode === 422) {
          // Validation error - field-specific guidance
          if (errorData?.message?.includes('pickup')) {
            userMessage = '⚠️ ' + errorData.message + '\n\n💡 Isi tanggal jemput cucian kotor.';
          } else if (errorData?.message?.includes('delivery')) {
            userMessage = '⚠️ ' + errorData.message + '\n\n💡 Isi tanggal antar cucian bersih.';
          } else if (errorData?.message?.includes('material')) {
            userMessage = '⚠️ ' + errorData.message + '\n\n💡 Pilih jenis material untuk layanan ini.';
          } else if (errorData?.message?.includes('dimensi') || errorData?.message?.includes('m²')) {
            userMessage = '⚠️ ' + errorData.message + '\n\n💡 Masukkan panjang dan lebar karpet.';
          }
        } else if (statusCode === 400) {
          // Bad request
          if (errorData?.message?.includes('deposit') || errorData?.message?.includes('saldo')) {
            userMessage = '⚠️ ' + errorData.message;
          }
        } else if (statusCode === 500) {
          // Server error - add troubleshooting hints
          const hints = {
            'INVALID_CUSTOMER': 'Pilih customer dari daftar yang tersedia.',
            'INVALID_SERVICE': 'Hapus layanan dan pilih ulang.',
            'INVALID_PROMO': 'Pilih promo lain atau hapus promo.',
            'INVALID_OUTLET': 'Logout dan login kembali.',
            'INVALID_CASHIER': 'Logout dan login kembali.',
            'INVALID_PAYMENT_METHOD': 'Pilih metode pembayaran lain.',
            'INVALID_REFERENCE': 'Data tidak valid. Hubungi administrator.',
            'DUPLICATE_TRANSACTION': 'Coba ulangi transaksi.',
            'SCHEMA_MISMATCH': 'Hubungi administrator untuk update database.',
            'LOCK_TIMEOUT': 'Tunggu beberapa detik, lalu coba lagi.',
            'NETWORK_ERROR': 'Periksa koneksi internet Anda.',
            'DB_CONNECTION_ERROR': 'Server sedang sibuk. Coba lagi nanti.',
          };
          const hint = hints[errorType];
          if (hint) {
            userMessage = `❌ ${errorData?.message}\n\n💡 ${hint}`;
          } else {
            userMessage = `❌ ${errorData?.message || 'Terjadi kesalahan server.'}\n\n💡 Coba ulangi transaksi. Jika masih gagal, hubungi administrator.`;
          }
        }

        // Log for debugging
        console.error('[CHECKOUT] ❌ Checkout failed:', {
          status: statusCode,
          errorType,
          errorDetails,
          userMessage,
          debug: errorData?.debug,
          fullResponse: errorData,
        });

        if (!silent) {
          // Use detailed alert for complex errors with field-specific info
          if (fieldErrors && Object.keys(fieldErrors).length > 0) {
            alertErrorDetailed('Validasi Gagal', userMessage);
          } else if (statusCode === 403 && errorData?.requiresShift) {
            alertErrorDetailed('Shift Belum Dibuka', userMessage);
          } else if (statusCode === 422) {
            alertErrorDetailed('Validasi Gagal', userMessage);
          } else if (statusCode === 500 && errorType) {
            alertErrorDetailed('Error Server', userMessage);
          } else if (userMessage.length > 100) {
            // For longer messages, use detailed alert
            alertErrorDetailed('Error', userMessage);
          } else {
            alertError(userMessage);
          }
        }
        else throw error;
      } finally {
        setLoading(false);
      }
  };

  const isConfirmDisabled = (
    (payMethod === 'deposit' && Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0) < total) ||
    // Only require date for pickup/delivery (no time needed)
    (pickupType === 'pickup' && !pickupScheduleDate) ||
    (pickupType === 'delivery' && !deliveryScheduleDate)
  );

  const handleConfirm = () => {
    if (selectedPromoId && promoDiscount <= 0) {
      alertWarning('Promo tidak memenuhi syarat untuk subtotal saat ini.');
      return;
    }

    if (pickupType === 'pickup') {
      if (!pickupScheduleDate) {
        alertError('Tanggal jemput cucian kotor wajib diisi.');
        hapticError();
        return;
      }
    } else if (pickupType === 'delivery') {
      if (!deliveryScheduleDate) {
        alertError('Tanggal antar cucian bersih wajib diisi.');
        hapticError();
        return;
      }
    }

    // Transfer & QRIS/EDC payment validation removed — confirmation is automatic based on amount only

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
  // But don't redirect if we're navigating away after successful checkout
  console.log('[GUARD] notaCustomer:', !!notaCustomer, '| loading:', loading, '| isNavigatingAway:', isNavigatingAway);
  if (!notaCustomer && !loading && !isNavigatingAway) {
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
                'Antar Jemput'
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
              { key: 'both', label: 'Antar Jemput', icon: '🔄', desc: 'Jemput + Antar cucian' },
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
              {(pickupType === 'pickup' && !pickupScheduleDate) && (
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
                      Tanggal Wajib Diisi
                    </div>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 10,
                      color: C.scheduleErrorText,
                      lineHeight: 1.4
                    }}>
                      Untuk layanan jemput cucian kotor, tanggal harus dipilih terlebih dahulu.
                    </div>
                  </div>
                </div>
              )}

              {(pickupType === 'delivery' && !deliveryScheduleDate) && (
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
                      Tanggal Wajib Diisi
                    </div>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 10,
                      color: C.scheduleErrorText,
                      lineHeight: 1.4
                    }}>
                      Untuk layanan antar cucian bersih, tanggal harus dipilih terlebih dahulu.
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
                  <Input
                    type="date"
                    label={`📅 Tanggal Jemput${pickupType === 'both' ? ' (Kotor)' : ''} *`}
                    value={
                      pickupScheduleDate
                        ? `${pickupScheduleDate.getFullYear()}-${String(pickupScheduleDate.getMonth()+1).padStart(2,'0')}-${String(pickupScheduleDate.getDate()).padStart(2,'0')}`
                        : ''
                    }
                    onChange={(val) => {
                      if (!val) {
                        setPickupScheduleDate(null);
                        return;
                      }
                      const d = new Date(val + 'T12:00:00');
                      setPickupScheduleDate(d);
                    }}
                    min={todayKeyWib()}
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
                  <Input
                    type="date"
                    label={`📅 Tanggal Antar${pickupType === 'both' ? ' (Bersih)' : ''} *`}
                    value={
                      deliveryScheduleDate
                        ? `${deliveryScheduleDate.getFullYear()}-${String(deliveryScheduleDate.getMonth()+1).padStart(2,'0')}-${String(deliveryScheduleDate.getDate()).padStart(2,'0')}`
                        : ''
                    }
                    onChange={(val) => {
                      if (!val) {
                        setDeliveryScheduleDate(null);
                        return;
                      }
                      const d = new Date(val + 'T12:00:00');
                      setDeliveryScheduleDate(d);
                    }}
                    min={todayKeyWib()}
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

              {selectedZone && (
                <div style={{
                  background: C.primaryLight,
                  borderRadius: 10,
                  padding: '10px 12px',
                  border: `1px solid ${C.primary}30`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.primary, marginBottom: 2 }}>
                      ZONA ONGKIR
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>
                      {selectedZone.name}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.primary }}>
                    {rp(selectedZone.fee || 0)}
                  </div>
                </div>
              )}
              {!selectedZone && areaZones.length > 0 && (
                <div style={{
                  background: C.n50,
                  borderRadius: 10,
                  padding: '10px 12px',
                  border: `1px solid ${C.n200}`,
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  color: C.n500,
                  textAlign: 'center',
                }}>
                  Zona ongkir belum tersedia
                </div>
              )}

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
            <div style={{ marginTop: 4, background: '#F8F5FB', borderRadius: 16, padding: '20px 16px 16px', border: '1.5px solid #E8D8F0' }}>
              <div style={{
                background: C.white,
                borderRadius: 16,
                padding: '20px 16px',
                marginBottom: 12,
                boxShadow: '0 2px 12px rgba(110, 46, 104, 0.1)',
                textAlign: 'center',
                border: '1.5px solid #E8D8F0',
              }}>
                <div style={{
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.n500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 6,
                }}>
                  Nominal Diterima
                </div>
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 36,
                  fontWeight: 800,
                  color: effectivePaid > 0 ? C.primary : C.n900,
                  marginBottom: 4,
                  transition: 'color 0.2s',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {effectivePaid > 0 ? rp(effectivePaid) : 'Rp 0'}
                </div>
                <div style={{
                  fontFamily: 'Poppins',
                  fontSize: 10.5,
                  color: C.n400,
                }}>
                  💵 Uang Tunai · {user?.name || 'Kasir'}
                </div>
              </div>

              {effectivePaid > 0 && kembalian >= 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #EFFDF4 0%, #A7F3D0 100%)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 12,
                  border: '1.5px solid #6E2E68',
                  boxShadow: '0 2px 8px rgba(110, 46, 104, 0.12)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 10,
                      fontWeight: 700,
                      color: C.primary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Kembalian
                    </div>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 9.5,
                      color: '#9C3F7E',
                      marginTop: 1,
                    }}>
                      {rp(effectivePaid)} - {rp(total)}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 22,
                    fontWeight: 800,
                    color: C.primary,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {rp(kembalian)}
                  </div>
                </div>
              )}

              <div style={{
                fontFamily: 'Poppins',
                fontSize: 10,
                fontWeight: 700,
                color: C.n500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 8,
              }}>
                Nominal Cepat
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setPaidAmountStr(String(Math.ceil(total / 1000) * 1000))}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 12,
                    border: '1.5px solid #6E2E68',
                    background: '#F3EEF8',
                    fontFamily: 'Poppins',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#6E2E68',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 9.5, fontWeight: 500, marginBottom: 2, color: '#9C3F7E' }}>Total</div>
                  <div style={{ fontVariantNumeric: 'tabular-nums' }}>{rp(Math.ceil(total / 1000) * 1000)}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaidAmountStr(String(50000))}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 12,
                    border: '1.5px solid #E4E9F1',
                    background: C.white,
                    fontFamily: 'Poppins',
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.n800,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                  }}
                >
                  Rp 50.000
                </button>

                <button
                  type="button"
                  onClick={() => setPaidAmountStr(String(100000))}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 12,
                    border: '1.5px solid #E4E9F1',
                    background: C.white,
                    fontFamily: 'Poppins',
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.n800,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                  }}
                >
                  Rp 100.000
                </button>

                <button
                  type="button"
                  onClick={() => setPaidAmountStr(String(150000))}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 12,
                    border: '1.5px solid #E4E9F1',
                    background: C.white,
                    fontFamily: 'Poppins',
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.n800,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                  }}
                >
                  Rp 150.000
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPaidAmountStr(String(total))}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 12,
                  border: '1.5px solid #16A34A',
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                  fontFamily: 'Poppins',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  marginBottom: 10,
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                💵 Uang Pas — {rp(total)}
              </button>

              <div style={{ marginBottom: 10 }}>
                <div style={{
                  fontFamily: 'Poppins',
                  fontSize: 10,
                  fontWeight: 600,
                  color: C.n500,
                  marginBottom: 5,
                }}>
                  Atau masukkan nominal lain
                </div>
                <MoneyInput
                  value={paidAmountStr}
                  onChange={setPaidAmountStr}
                  placeholder="Ketik nominal..."
                  style={{
                    background: C.white,
                    border: '1.5px solid #E4E9F1',
                    fontSize: 15,
                    fontWeight: 700,
                    color: C.n900,
                    borderRadius: 10,
                    padding: '10px 12px',
                  }}
                />
              </div>

              {effectivePaid > 0 && effectivePaid < total && (
                <div style={{
                  marginTop: 8,
                  padding: '9px 12px',
                  background: '#FEE2E2',
                  borderRadius: 8,
                  border: '1px solid #FECACA',
                }}>
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: 11,
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    ⚠️ Kurang <strong>{rp(total - effectivePaid)}</strong>
                  </div>
                </div>
              )}

              <div style={{
                marginTop: 10,
                padding: '9px 12px',
                background: '#F0EDF5',
                borderRadius: 8,
                border: '1px solid #DDD0EB',
                fontFamily: 'Poppins',
                fontSize: 11,
                color: '#6E2E68',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                💰 {paymentStatus === 'pending' ? 'Masukkan nominal untuk melanjutkan.' : paymentStatus === 'lunas' ? 'Lunas dengan uang tunai.' : `Partial. Sisa ${rp(total - effectivePaid)} akan dilunasi nanti.`}
              </div>
            </div>
          )}

          {/* QRIS Panel */}
          {payMethod === 'qris' && (
            <div style={{ marginTop: 4, background: C.n50, borderRadius: 12, padding: '16px', border: `1px solid ${C.n200}` }}>
              <div style={{
                background: '#5B005F10',
                borderRadius: 12,
                padding: '20px',
                textAlign: 'center',
                marginBottom: 12,
                border: '2px dashed #5B005F40',
              }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#5B005F', marginBottom: 6 }}>
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

              {effectivePaid >= total && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#D1FAE5', borderRadius: 10, fontFamily: 'Poppins', fontSize: 11, color: '#059669', fontWeight: 600 }}>
                  ✅ Nominal cukup — Status: <strong>LUNAS</strong>
                </div>
              )}
              {effectivePaid > 0 && effectivePaid < total && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#FEF3C7', borderRadius: 10, fontFamily: 'Poppins', fontSize: 11, color: '#D97706', fontWeight: 600 }}>
                  💰 Nominal kurang — Status: <strong>UANG MUKA</strong> (kekurangan {rp(total - effectivePaid)})
                </div>
              )}

              {/* Payment photo upload removed — confirmation is automatic based on amount */}
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

              {effectivePaid >= total && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#D1FAE5', borderRadius: 10, fontFamily: 'Poppins', fontSize: 11, color: '#059669', fontWeight: 600 }}>
                  ✅ Nominal cukup — Status: <strong>LUNAS</strong>
                </div>
              )}
              {effectivePaid > 0 && effectivePaid < total && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#FEF3C7', borderRadius: 10, fontFamily: 'Poppins', fontSize: 11, color: '#D97706', fontWeight: 600 }}>
                  💰 Nominal kurang — Status: <strong>UANG MUKA</strong> (kekurangan {rp(total - effectivePaid)})
                </div>
              )}

              {/* EDC payment photo upload removed — confirmation is automatic based on amount */}
            </div>
          )}

          {/* Transfer Bank Panel */}
          {payMethod === 'transfer' && (
            <div style={{ marginTop: 4, background: C.n50, borderRadius: 12, padding: '16px', border: `1px solid ${C.n200}` }}>
          {/* Transfer Bank Panel — simplified, no bank account selection or photo upload required */}
          {payMethod === 'transfer' && (
            <div style={{ marginTop: 4, background: C.n50, borderRadius: 12, padding: '16px', border: `1px solid ${C.n200}` }}>
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

              {effectivePaid >= total && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#D1FAE5', borderRadius: 10, fontFamily: 'Poppins', fontSize: 11, color: '#059669', fontWeight: 600 }}>
                  ✅ Nominal cukup — Status: <strong>LUNAS</strong>
                </div>
              )}
              {effectivePaid > 0 && effectivePaid < total && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#FEF3C7', borderRadius: 10, fontFamily: 'Poppins', fontSize: 11, color: '#D97706', fontWeight: 600 }}>
                  💰 Nominal kurang — Status: <strong>UANG MUKA</strong> (kekurangan {rp(total - effectivePaid)})
                </div>
              )}
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