import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp, getCartLineSubtotal, getCartUnitPrice } from '../../utils/helpers';
import { TopBar, Btn, Input, Select, Divider, DateTimeInput, MoneyInput } from '../../components/ui';
import { alertError, alertWarning } from '../../utils/alert';
import { useApp } from '../../context/AppContext';
import { hapticSuccess, hapticError } from '../../utils/haptic';
import PaymentMethodGrouped from '../../components/PaymentMethodGrouped';

// ─── Payment Status Auto-Detection ───────────────────────────────────────────
// Helper: calculate payment status based on payment config
// Returns: 'lunas' | 'dp' | 'bayar_nanti' | null
function getPaymentStatus(payTiming, payPlan, paidAmount, total) {
  if (payTiming === 'later') return 'bayar_nanti';
  if (payPlan === 'dp') {
    const dpValue = Math.max(0, Math.min(total, Number(paidAmount) || 0));
    if (dpValue === 0) return 'bayar_nanti';
    if (dpValue >= total) return 'lunas';
    return 'dp';
  }
  // payPlan === 'full' or default
  if (paidAmount >= total) return 'lunas';
  if (paidAmount > 0) return 'dp';
  return 'bayar_nanti';
}

const PAYMENT_STATUS_CONFIG = {
  lunas: {
    label: 'LUNAS',
    color: '#059669',
    bg: '#d1fae5',
    icon: '✅',
    desc: 'Pembayaran sudah lunas',
  },
  dp: {
    label: 'UANG MUKA',
    color: '#d97706',
    bg: '#fef3c7',
    icon: '💰',
    desc: 'Ada uang muka / DP',
  },
  bayar_nanti: {
    label: 'BAYAR NANTI',
    color: '#6b7280',
    bg: '#f3f4f6',
    icon: '⏳',
    desc: 'Belum ada pembayaran',
  },
};

// ─── Payment Status Badge Component ──────────────────────────────────────────
function PaymentStatusBadge({ status, compact = false }) {
  const config = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.bayar_nanti;

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
  // pickupType: 'self' (default, customer ambil sendiri) | 'pickup' (jemput kotor) | 'delivery' (antar bersih) | 'both' (antar-jemput)
  const [pickupType, setPickupType] = useState('self');
  const [scheduleDate, setScheduleDate] = useState(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [areaZoneId, setAreaZoneId] = useState('');
  const [areaZones, setAreaZones] = useState([]);
  const [courierName, setCourierName] = useState(''); // siapa yang nganterin (delivery)
  const [deliveryNotes, setDeliveryNotes] = useState(''); // catatan untuk kurir
  const [payMethod, setPayMethod] = useState('cash');
  const [payTiming, setPayTiming] = useState('now');
  // 'full' = bayar lunas, 'dp' = bayar sebagian (DP)
  // Kalau bayar nanti, payPlan diabaikan
  const [payPlan, setPayPlan] = useState('full');
  const [dpAmountStr, setDpAmountStr] = useState('');
  // Enhanced payment UI - nominal diterima for change calculation
  const [nominalDiterima, setNominalDiterima] = useState('');
  // Payment tab: 'tunai' or 'non-tunai'
  const [paymentTab, setPaymentTab] = useState('tunai');
  // Remember last non-tunai method for better UX
  const [lastNonTunaiMethod, setLastNonTunaiMethod] = useState('qris');

  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qrisModal, setQrisModal] = useState(false);
  const [promos, setPromos] = useState([]);
  const [selectedPromoId, setSelectedPromoId] = useState('');
  
  // Fetch area zones for delivery fee calculation
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await axios.get('/api/logistics/area-zones');
        setAreaZones(res?.data?.data || []);
      } catch (error) {
        console.warn('Failed to fetch area zones:', error?.message);
        // Fallback: area zones will be empty, delivery fee uses default
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

  const selectedZone = areaZones.find((z) => z.id === areaZoneId);
  // Self: no fee, pickup/delivery: one fee, both: two fees
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

  const total = subtotal - promoDiscount + logisticFee;

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

      let paidAmount = 0;
      let changeAmount = 0;

      const dpValue = Math.max(0, Math.min(total, Number(dpAmountStr) || 0));

      if (payTiming === 'later') {
        paidAmount = 0;
      } else if (payPlan === 'dp') {
        paidAmount = dpValue;
        changeAmount = 0;
      } else {
        paidAmount = total;
        changeAmount = 0;
      }

      const paymentPayload = {
        amount: total,
        paidAmount,
        changeAmount,
      };
      if (paidAmount > 0) {
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
          payTiming: payTiming === 'later' ? 'later' : 'now',
          payPlan: payTiming === 'now' ? payPlan : 'full',
          dpAmount: payPlan === 'dp' ? dpValue : 0,
        },
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
          paidAmount:    data.payment?.paidAmount ?? paidAmount,
          changeAmount:  data.payment?.changeAmount ?? changeAmount,
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
      console.error('Checkout error:', error);
      if (!silent) alertError(msg);
      else throw error;
    } finally {
      setLoading(false);
    }
  };

  const dpValue = Math.max(0, Math.min(total, Number(dpAmountStr) || 0));
  const effectivePaid =
    payTiming === 'later' ? 0 :
    payPlan === 'dp' ? dpValue :
    total;

  // Auto-detect payment status based on current payment configuration
  const paymentStatus = getPaymentStatus(
    payTiming === 'later' ? 'later' : 'now',
    payPlan,
    payPlan === 'dp' ? dpValue : effectivePaid,
    total
  );

  // Calculate change for enhanced payment UI
  const nominalDiterimaValue = Number(nominalDiterima) || 0;
  const effectivePaidForChange = payPlan === 'dp' ? dpValue : total;
  const kembalian = nominalDiterimaValue - effectivePaidForChange;

  const handleConfirm = () => {
    if (selectedPromoId && promoDiscount <= 0) {
      alertWarning('Promo tidak memenuhi syarat untuk subtotal saat ini.');
      return;
    }

    // Validate schedule for pickup/delivery types
    // For 'both' type, schedule is optional (customer can schedule one or both)
    if (pickupType === 'pickup') {
      if (!scheduleDate || !scheduleTime) {
        alertError('Jadwal jemput cucian kotor wajib diisi. Silakan pilih tanggal dan waktu terlebih dahulu.');
        hapticError();
        return;
      }
    } else if (pickupType === 'delivery') {
      if (!scheduleDate || !scheduleTime) {
        alertError('Jadwal antar cucian bersih wajib diisi. Silakan pilih tanggal dan waktu terlebih dahulu.');
        hapticError();
        return;
      }
    }

    const runCheckout = () => doCheckout();
    if (payTiming === 'now' && payMethod === 'qris' && total > 0) {
      setQrisModal(true);
      setTimeout(() => {
        setQrisModal(false);
        runCheckout();
      }, 3000);
    } else {
      runCheckout();
    }
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
        <Btn variant="primary" onClick={() => navigate('nota_step1')}>Mulai Ulang</Btn>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Buat Nota" subtitle="Langkah 3 dari 3 — Konfirmasi" onBack={goBack} />

      <div style={{ padding: '8px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: C.primary }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Customer info */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 6 }}>CUSTOMER</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{notaCustomer?.name}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{notaCustomer?.phone}</div>
        </div>

        {/* Items */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>ITEM LAUNDRY</div>
          {notaCart.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{item.name}</span>
                  {item.express && <span style={{ background: C.validationWarningBg, color: C.validationWarningText, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999 }}>Express</span>}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{item.qty} {item.unit}</div>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{rp(getCartLineSubtotal(item))}</div>
            </div>
          ))}

          <Divider my={8} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Subtotal</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{rp(subtotal)}</span>
          </div>

          {promos.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 6 }}>PROMO</div>
              <Select
                value={selectedPromoId}
                onChange={(val) => setSelectedPromoId(val)}
                options={[
                  { value: '', label: 'Tanpa promo' },
                  ...promos.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
                ]}
              />
              {selectedPromo && promoDiscount <= 0 && selectedPromo.minTrxAmount != null && (
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.warning, marginTop: 4 }}>
                  Min. transaksi {rp(selectedPromo.minTrxAmount)} untuk promo ini
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

        {/* Layanan Antar/Jemput - Toggle + 4 Options */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>LAYANAN ANTAR/JEMPUT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
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
                  padding: '10px 6px', borderRadius: 10, textAlign: 'center',
                  border: `1.5px solid ${pickupType === opt.key ? C.primary : C.n300}`,
                  background: pickupType === opt.key ? C.primaryLight : C.white,
                  cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11,
                  fontWeight: pickupType === opt.key ? 700 : 400,
                  color: pickupType === opt.key ? C.primary : C.n700,
                }}
                title={opt.desc}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Schedule & Area Zone for Pickup/Delivery/Both */}
          {pickupType !== 'self' && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Schedule validation warning - only for pure pickup or delivery */}
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

              {/* Customer address — auto-fill */}
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

              {/* Schedule for pickup/delivery - REQUIRED for pickup and delivery types */}
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

              {/* Additional for Delivery: courier name + notes */}
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
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>WAKTU PEMBAYARAN</div>

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
              }}>Auto-detected</div>
            </div>
            <PaymentStatusBadge status={paymentStatus} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[
              { key: 'now',   label: 'Bayar Sekarang', sub: 'Customer bayar lunas di kasir', icon: '💵' },
              { key: 'later', label: 'Bayar Nanti',     sub: 'Saat customer ambil cucian',   icon: '⏳' },
            ].map((opt) => {
              const active = payTiming === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => { 
                    setPayTiming(opt.key); 
                    if (opt.key === 'later') {
                      setPayMethod('cash');
                      setPaymentTab('tunai');
                    }
                  }}
                  style={{
                    flex: 1, padding: '12px 10px', borderRadius: 12, textAlign: 'left',
                    border: `1.5px solid ${active ? C.primary : C.n300}`,
                    background: active ? C.primaryLight : C.white,
                    cursor: 'pointer', fontFamily: 'Poppins',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: active ? C.primary : C.n900 }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 10, color: C.n600, marginTop: 2, lineHeight: 1.4 }}>
                      {opt.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {payTiming === 'now' ? (
            <>
              {/* Pilihan: Lunas / DP */}
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>JUMLAH BAYAR</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[
                  { key: 'full', label: 'Lunas Penuh', desc: rp(total) },
                  { key: 'dp',   label: 'DP / Sebagian', desc: 'Sisa dilunasi nanti' },
                ].map((opt) => {
                  const active = payPlan === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPayPlan(opt.key)}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: 10, textAlign: 'left',
                        border: `1.5px solid ${active ? C.primary : C.n300}`,
                        background: active ? C.primaryLight : C.white,
                        cursor: 'pointer', fontFamily: 'Poppins',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: active ? C.primary : C.n900 }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 10, color: C.n600, marginTop: 2 }}>
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Input nominal DP — muncul kalau pilih DP */}
              {payPlan === 'dp' && (
                <div style={{ background: C.validationInfoBg, borderRadius: 10, padding: '10px 12px', marginBottom: 12, border: `1px solid ${C.validationInfoBorder}` }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.validationInfoText, marginBottom: 8 }}>
                    💰 Nominal DP yang dibayar sekarang
                  </div>
                  <MoneyInput
                    value={dpAmountStr}
                    onChange={setDpAmountStr}
                    placeholder={`Min Rp 1, max ${rp(total)}`}
                  />
                  {/* Quick presets — 25%, 50%, 75% dari total */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    {[0.25, 0.5, 0.75].map((pct) => {
                      const v = Math.round(total * pct);
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDpAmountStr(String(v))}
                          style={{
                            flex: 1, padding: '6px 8px', borderRadius: 8,
                            border: `1px solid ${C.validationInfoBorder}`, background: C.white,
                            fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.validationInfoText,
                            cursor: 'pointer',
                          }}
                        >
                          {Math.round(pct * 100)}% · {rp(v)}
                        </button>
                      );
                    })}
                  </div>
                  {dpValue > 0 && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.validationInfoText, marginTop: 8, lineHeight: 1.5 }}>
                      Bayar sekarang: <strong>{rp(dpValue)}</strong><br/>
                      Sisa tagihan: <strong>{rp(total - dpValue)}</strong> (dilunasi saat ambil)
                    </div>
                  )}
                  {dpAmountStr && dpValue <= 0 && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.danger, marginTop: 6 }}>
                      ⚠️ Nominal harus lebih dari 0
                    </div>
                  )}
                  {/* Warning jika input DP > total */}
                  {dpAmountStr && Number(dpAmountStr) > total && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      background: C.validationWarningBg,
                      borderRadius: 6,
                      fontFamily: 'Poppins',
                      fontSize: 10,
                      color: C.validationWarningText,
                      lineHeight: 1.4
                    }}>
                      ⚠️ Nominal DP maksimal {rp(total)}. Sistem akan otomatis adjust ke nilai maksimal.
                    </div>
                  )}
                </div>
              )}

              {/* Payment Method Tabs - Simplified to TUNAI and NON-TUNAI */}
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8, marginTop: 12 }}>METODE PEMBAYARAN</div>
              
              {/* Tab Switcher */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[
                  { key: 'tunai', label: '💵 Tunai', icon: '💵' },
                  { key: 'non-tunai', label: '🏦 Non-Tunai', icon: '🏦' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setPaymentTab(tab.key);
                      if (tab.key === 'tunai') {
                        setPayMethod('cash');
                      } else {
                        // Restore last non-tunai method untuk UX lebih baik
                        setPayMethod(lastNonTunaiMethod);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: 10,
                      border: `2px solid ${paymentTab === tab.key ? C.primary : C.n300}`,
                      background: paymentTab === tab.key ? C.primaryLight : C.white,
                      fontFamily: 'Poppins',
                      fontSize: 13,
                      fontWeight: 600,
                      color: paymentTab === tab.key ? C.primary : C.n600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TUNAI Tab Content */}
              {paymentTab === 'tunai' ? (
                <div style={{ marginTop: 16, background: C.n50, borderRadius: 12, padding: '16px', border: `1px solid ${C.n200}` }}>
                  {/* Nominal Diterima Section */}
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
                      {nominalDiterimaValue > 0 ? rp(nominalDiterimaValue) : 'Rp 0'}
                    </div>
                    <div style={{ 
                      fontFamily: 'Poppins', 
                      fontSize: 11, 
                      color: C.n500
                    }}>
                      Uang Tunai · Kasir {user?.name || 'RH'}
                    </div>
                  </div>

                  {/* Kembalian Display */}
                  {nominalDiterimaValue > 0 && kembalian >= 0 && (
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
                            {rp(nominalDiterimaValue)} - {rp(effectivePaidForChange)}
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

                  {/* Nominal Cepat - Quick Amount Buttons */}
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[50000, 100000, 150000, effectivePaidForChange].map((amount, idx) => {
                      const isExact = idx === 3;
                      const label = isExact ? `Pas (${rp(amount)})` : rp(amount);
                      const isSelected = nominalDiterimaValue === amount;
                      
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setNominalDiterima(String(amount))}
                          style={{
                            padding: '14px 12px',
                            borderRadius: 10,
                            border: `1.5px solid ${isSelected ? C.primary : C.n300}`,
                            background: isSelected ? C.primaryLight : C.white,
                            fontFamily: 'Poppins',
                            fontSize: 13,
                            fontWeight: 600,
                            color: isSelected ? C.primary : C.n700,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center'
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Manual Input for Custom Amount */}
                  <div style={{ marginTop: 12 }}>
                    <MoneyInput
                      value={nominalDiterima}
                      onChange={setNominalDiterima}
                      placeholder="Atau masukkan nominal lain..."
                      style={{ 
                        background: C.white,
                        border: `1.5px solid ${C.n300}`,
                        fontSize: 14
                      }}
                    />
                  </div>

                  {/* Warning if nominal < total */}
                  {nominalDiterimaValue > 0 && kembalian < 0 && (
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
                        <span>Uang yang diterima kurang <strong>{rp(Math.abs(kembalian))}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Info text */}
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
                    {payPlan === 'dp'
                      ? `💰 DP ${rp(dpValue)}. Sisa ${rp(total - dpValue)} dilunasi saat ambil cucian.`
                      : '💰 Bayar lunas dengan uang tunai.'}
                  </div>
                </div>
              ) : (
                /* NON-TUNAI Tab Content */
                <div style={{ marginTop: 4 }}>
                  <PaymentMethodGrouped
                    value={payMethod}
                    onChange={(m) => {
                      setPayMethod(m);
                      if (m !== 'cash') {
                        setLastNonTunaiMethod(m);
                      }
                    }}
                    showDeposit={!!notaCustomer?.depositBalance || !!notaCustomer?.deposit}
                    depositBalance={Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0)}
                    amount={effectivePaid}
                    hint={payPlan === 'dp'
                      ? `DP ${rp(dpValue)}. Sisa ${rp(total - dpValue)} dilunasi saat ambil cucian.`
                      : 'Pilih metode pembayaran non-tunai.'}
                    showCash={false}
                  />

                  {/* Deposit Payment Info - Show when deposit is selected */}
                  {payMethod === 'deposit' && (
                    <div style={{ marginTop: 16, background: C.n50, borderRadius: 12, padding: '16px', border: `1px solid ${C.n200}` }}>
                      {/* Saldo Deposit Display */}
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
                          Saldo Deposit Customer
                        </div>
                        <div style={{ 
                          fontFamily: 'Poppins', 
                          fontSize: 32, 
                          fontWeight: 700, 
                          color: C.primary,
                          marginBottom: 4
                        }}>
                          {rp(Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0))}
                        </div>
                        <div style={{ 
                          fontFamily: 'Poppins', 
                          fontSize: 11, 
                          color: C.n500
                        }}>
                          {notaCustomer?.name || 'Customer'} · {notaCustomer?.phone || '-'}
                        </div>
                      </div>

                      {/* Deposit Calculation Display */}
                      <div style={{ 
                        background: C.white,
                        borderRadius: 12,
                        padding: '14px 16px',
                        marginBottom: 12,
                        border: `1.5px solid ${C.n200}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ 
                            fontFamily: 'Poppins', 
                            fontSize: 12, 
                            color: C.n600
                          }}>
                            Total Tagihan
                          </div>
                          <div style={{ 
                            fontFamily: 'Poppins', 
                            fontSize: 13, 
                            fontWeight: 600, 
                            color: C.n900
                          }}>
                            {rp(effectivePaidForChange)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ 
                            fontFamily: 'Poppins', 
                            fontSize: 12, 
                            color: C.n600
                          }}>
                            Saldo Deposit
                          </div>
                          <div style={{ 
                            fontFamily: 'Poppins', 
                            fontSize: 13, 
                            fontWeight: 600, 
                            color: C.primary
                          }}>
                            {rp(Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0))}
                          </div>
                        </div>
                        <div style={{ 
                          height: '1px', 
                          background: C.n200, 
                          margin: '8px 0' 
                        }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ 
                            fontFamily: 'Poppins', 
                            fontSize: 13, 
                            fontWeight: 600, 
                            color: C.n900
                          }}>
                            Sisa Saldo
                          </div>
                          <div style={{ 
                            fontFamily: 'Poppins', 
                            fontSize: 15, 
                            fontWeight: 700, 
                            color: (Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0) - effectivePaidForChange) >= 0 ? C.success : C.danger
                          }}>
                            {rp(Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0) - effectivePaidForChange)}
                          </div>
                        </div>
                      </div>

                      {/* Warning if saldo kurang */}
                      {(Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0) < effectivePaidForChange) && (
                        <div style={{
                          padding: '12px 14px',
                          background: C.validationErrorBg,
                          borderRadius: 10,
                          border: `1.5px solid ${C.validationErrorBorder}`
                        }}>
                          <div style={{
                            fontFamily: 'Poppins',
                            fontSize: 11,
                            fontWeight: 600,
                            color: C.validationErrorText,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            marginBottom: 6
                          }}>
                            <span>⚠️</span>
                            <span>Saldo Deposit Tidak Cukup</span>
                          </div>
                          <div style={{
                            fontFamily: 'Poppins',
                            fontSize: 11,
                            color: C.validationErrorText,
                            lineHeight: 1.5,
                            paddingLeft: 24
                          }}>
                            Saldo kurang <strong>{rp(effectivePaidForChange - Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0))}</strong>.
                            Customer perlu top up deposit terlebih dahulu atau pilih metode pembayaran lain.
                          </div>
                        </div>
                      )}

                      {/* Success message if saldo cukup */}
                      {(Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0) >= effectivePaidForChange) && (
                        <div style={{
                          padding: '12px 14px',
                          background: `linear-gradient(135deg, ${C.successBg} 0%, #A7F3D0 100%)`,
                          borderRadius: 10,
                          border: `1.5px solid ${C.success}`
                        }}>
                          <div style={{
                            fontFamily: 'Poppins',
                            fontSize: 11,
                            fontWeight: 600,
                            color: C.successDark,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}>
                            <span>✅</span>
                            <span>Saldo Deposit Mencukupi</span>
                          </div>
                          <div style={{
                            fontFamily: 'Poppins',
                            fontSize: 11,
                            color: C.success,
                            marginTop: 4,
                            paddingLeft: 28
                          }}>
                            Pembayaran akan memotong deposit sebesar <strong>{rp(effectivePaidForChange)}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{
              background: C.validationInfoBg, borderRadius: 10, padding: '12px 14px',
              fontFamily: 'Poppins', fontSize: 12, color: C.validationInfoText, lineHeight: 1.5,
              border: `1px solid ${C.validationInfoBorder}`,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⏳ Bayar saat pengambilan</div>
              Tagihan akan tercatat sebagai <strong>BELUM LUNAS</strong>. Customer hanya bisa ambil cucian setelah lunas.
              Metode pembayaran dipilih di kasir saat customer datang.
            </div>
          )}
        </div>

        {/* Estimasi Selesai - Date Only */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>📅 ESTIMASI SELESAI</div>
          <Input
            type="date"
            label="Tanggal Selesai"
            value={dueDate || ''}
            onChange={setDueDate}
            min={todayKeyWib()}
            placeholder="Pilih tanggal estimasi selesai"
          />
          <div style={{
            marginTop: 8,
            padding: '8px 10px',
            background: C.infoBg,
            borderRadius: 8,
            fontFamily: 'Poppins',
            fontSize: 10,
            color: C.infoDark,
            lineHeight: 1.4
          }}>
            ℹ️ Hanya perlu pilih tanggal saja (tidak perlu jam/waktu)
          </div>
        </div>

        {/* Catatan */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>📝 CATATAN</div>
          <Input label="Catatan (opsional)" value={notes} onChange={setNotes} placeholder="Catatan khusus..." />
        </div>
      </div>

      {/* QRIS EDC Loading Modal */}
      {qrisModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.white, borderRadius: 20, padding: '32px 28px', textAlign: 'center', maxWidth: 300, width: '85%' }}>
            <div style={{ width: 56, height: 56, border: `4px solid ${C.n200}`, borderTop: `4px solid ${C.primary}`, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900, marginBottom: 8 }}>Menunggu Pembayaran</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Menunggu konfirmasi dari EDC QRIS...</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 600, color: C.primary, marginTop: 12 }}>{rp(effectivePaid)}</div>
          </div>
        </div>
      )}

      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', gap: 10 }}>
        <Btn variant="secondary" onClick={() => goBack?.()} style={{ flex: 1 }}>Kembali</Btn>
        <Btn variant="primary" onClick={handleConfirm} loading={loading} style={{ flex: 2 }}
             disabled={
               (payTiming === 'now' && payPlan === 'dp' && dpValue <= 0) ||
               (payTiming === 'now' && paymentTab === 'non-tunai' && payMethod === 'deposit' && 
                Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0) < effectivePaidForChange) ||
               ((pickupType === 'pickup' || pickupType === 'delivery') && (!scheduleDate || !scheduleTime))
             }>
          {payTiming === 'later'
            ? `Buat Nota (belum bayar ${rp(total)})`
            : payPlan === 'dp'
              ? `Bayar DP ${rp(dpValue)}`
              : `Bayar ${rp(total)}`}
        </Btn>
      </div>
    </div>
  );
}
