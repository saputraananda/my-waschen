import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp, getCartLineSubtotal, getCartUnitPrice } from '../../utils/helpers';
import { TopBar, Btn, Input, Select, Divider, Modal, DateTimeInput, MoneyInput } from '../../components/ui';
import { alertError, alertWarning } from '../../utils/alert';
import { useApp } from '../../context/AppContext';
import { hapticSuccess, hapticError } from '../../utils/haptic';
import { chargePayment } from '../../utils/paymentApi';
import PaymentChannelSelector from '../../components/PaymentChannelSelector';
import PaymentMethodGrouped from '../../components/PaymentMethodGrouped';

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

// ─── Manual Diskon Calculator ───────────────────────────────────────────────────
// Kasir bisa kasih diskon manual (persen/fixed).
// Threshold: diskon > 20% atau > Rp 100.000 butuh approval admin.
// reason tersimpan sebagai JSON di tr_transaction_approval.reason.
export const DISKON_APPROVAL_THRESHOLD_PCT = 20;
export const DISKON_APPROVAL_THRESHOLD_AMOUNT = 100000;

export function manualDiskonPreview(type, value, subtotal) {
  if (!subtotal || !value || value <= 0) return 0;
  const d = type === 'percent'
    ? subtotal * (Number(value) / 100)
    : Math.min(Number(value), subtotal);
  return Math.round(d * 100) / 100;
}

export function needsApproval(type, value, subtotal) {
  const amount = manualDiskonPreview(type, value, subtotal);
  if (amount <= 0) return false;
  const pct = Number(value) || 0;
  return pct > DISKON_APPROVAL_THRESHOLD_PCT || amount > DISKON_APPROVAL_THRESHOLD_AMOUNT;
}

export default function NotaStep3Page({ goBack }) {
  const { navigate, user, notaCustomer, notaCart, setNotaCart, setNotaCustomer } = useApp();
  // pickupType: 'self' (default, customer ambil sendiri) | 'pickup' (jemput kotor) | 'delivery' (antar bersih)
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

  // Midtrans flow state
  const [showChannelSelector, setShowChannelSelector] = useState(false);
  // Channel Midtrans yang user pilih dari grouped picker (qris/gopay/etc)
  // Kalau di-set, langsung skip channel selector modal & charge ke channel itu.
  const [selectedMidtransChannel, setSelectedMidtransChannel] = useState(null);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qrisModal, setQrisModal] = useState(false);
  const [promos, setPromos] = useState([]);
  const [selectedPromoId, setSelectedPromoId] = useState('');
  // ─── Manual Diskon (kasir input) ─────────────────────────────────────────
  const [diskonMode, setDiskonMode] = useState('none'); // 'none' | 'percent' | 'fixed'
  const [diskonValue, setDiskonValue] = useState('');
  const [diskonApprovalId, setDiskonApprovalId] = useState(null); // approval ID kalau butuh approval

  // Fetch area zones for delivery fee calculation
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await axios.get('/api/logistics/area-zones');
        setAreaZones(res?.data?.data || []);
      } catch { /* fallback handled by API */ }
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
  const logisticFee = pickupType === 'self' ? 0 : (selectedZone?.fee || 10000);
  const subtotal = notaCart.reduce((sum, c) => sum + getCartLineSubtotal(c), 0);
  const selectedPromo = useMemo(
    () => promos.find((p) => p.id === selectedPromoId) || null,
    [promos, selectedPromoId]
  );
  const promoDiscount = useMemo(
    () => promoDiscountPreview(selectedPromo, subtotal),
    [selectedPromo, subtotal]
  );

  // ─── Manual Diskon calculation ────────────────────────────────────────────
  const diskonAmount = useMemo(
    () => diskonMode === 'none' || !diskonValue ? 0 : manualDiskonPreview(diskonMode, diskonValue, subtotal),
    [diskonMode, diskonValue, subtotal]
  );
  const diskonNeedApproval = useMemo(
    () => needsApproval(diskonMode, diskonValue, subtotal),
    [diskonMode, diskonValue, subtotal]
  );
  const total = subtotal - promoDiscount - diskonAmount + logisticFee;

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

      // Aturan baru:
      //   - "Bayar Nanti" → paidAmount=0, status unpaid. Pelunasan saat ambil cucian.
      //   - "Bayar Sekarang" → bisa lunas (full) atau DP (sebagian).
      //   - Midtrans → paid=0 sampai webhook konfirmasi (status=unpaid awalnya)
      const isMidtransNow = payTiming === 'now' && payMethod === 'midtrans';
      const dpValue = Math.max(0, Math.min(total, Number(dpAmountStr) || 0));

      if (payTiming === 'later') {
        paidAmount = 0;
      } else if (isMidtransNow) {
        paidAmount = 0; // Midtrans pending sampai webhook
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
      // Kirim method kalau:
      //   - paid > 0 (cash/transfer/etc), atau
      //   - midtrans now (perlu method='midtrans' supaya backend tahu pending gateway)
      if (paidAmount > 0 || isMidtransNow) {
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
        pickup:   pickupType === 'pickup',
        delivery: pickupType === 'delivery',
        pickupType,
        areaZoneId: areaZoneId || null,
        scheduleAt: (scheduleDate && scheduleTime) ? `${formatDate(scheduleDate)}T${scheduleTime}:00` : null,
        courierName: pickupType === 'delivery' ? (courierName.trim() || null) : null,
        deliveryNotes: pickupType === 'delivery' ? (deliveryNotes.trim() || null) : null,
        notes,
        dueDate: dueDate ? dueDate.slice(0, 10) : null,
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
          pickup: pickupType === 'pickup',
          delivery: pickupType === 'delivery',
          notes,
          dueDate,
          status: 'baru',
          date:   new Date().toISOString().slice(0, 10),
        };

        if (returnData) return data;

        if (isMidtransNow && total > 0) {
          return data;
        }

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

  const handleConfirm = () => {
    if (selectedPromoId && promoDiscount <= 0) {
      alertWarning('Promo tidak memenuhi syarat untuk subtotal saat ini.');
      return;
    }

    // Bayar Sekarang via Midtrans → skip modal kalau channel sudah dipilih
    // dari grouped picker. Kalau belum, buka modal channel selector.
    const willPayMidtransNow = payTiming === 'now' && payMethod === 'midtrans' && total > 0;
    if (willPayMidtransNow) {
      if (selectedMidtransChannel) {
        // Langsung charge tanpa buka modal
        handleSelectChannel(selectedMidtransChannel);
      } else {
        setShowChannelSelector(true);
      }
      return;
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

  // ── Handler untuk Midtrans channel selector
  // Atomic flow: checkout + charge dilakukan setelah user pilih channel.
  // Kalau gagal di mana saja, transaksi tidak ke-create di DB.
  const handleSelectChannel = async (channel) => {
    setShowChannelSelector(false);
    setLoading(true);
    try {
      // 1. Checkout dulu (paidAmount=0, statusnya unpaid)
      const checkoutData = await doCheckout({ silent: true, returnData: true });
      if (!checkoutData) {
        throw new Error('Gagal membuat nota.');
      }

      // 2. Charge ke Midtrans
      const result = await chargePayment({
        transactionId: checkoutData.id || checkoutData.transactionNo,
        channel,
        amount: effectivePaid,
      });

      hapticSuccess();
      // 3. Clear cart & navigate ke QR payment.
      // Replace: jangan biarkan user back ke step 3 setelah charge sukses —
      // transaksi sudah ke-create di DB, kalau back malah dobel.
      setNotaCart([]);
      setNotaCustomer(null);
      navigate('qr_payment', {
        paymentItemId: result.paymentItemId,
        orderId: result.orderId,
        channel: result.channel,
        amount: result.amount,
        qrImageUrl: result.qrImageUrl,
        qrString: result.qrString,
        vaNumber: result.vaNumber,
        billerCode: result.billerCode,
        deeplinkUrl: result.deeplinkUrl,
        expiresAt: result.expiresAt,
        transactionId: checkoutData.id || checkoutData.transactionNo,
        customerName: checkoutData.customerName,
      }, { replace: true });
    } catch (err) {
      hapticError();
      console.error('[charge] error:', err);
      alertError(err?.response?.data?.message || err?.message || 'Gagal memproses pembayaran. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelChannel = () => {
    // User batal pilih channel — gak ada efek samping, transaksi belum ke-create
    setShowChannelSelector(false);
  };
  const filterPastDates = (d) => dateKeyWib(d) >= todayKeyWib();

  // Guard: kalau customer atau cart hilang (misal page refresh), redirect
  if (!notaCustomer && !loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, background: C.n50 }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900, textAlign: 'center' }}>Data nota tidak lengkap</div>
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
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 6 }}>CUSTOMER</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>{notaCustomer?.name}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{notaCustomer?.phone}</div>
        </div>

        {/* Items */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>ITEM LAUNDRY</div>
          {notaCart.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{item.name}</span>
                  {item.express && <span style={{ background: '#FEF3C7', color: '#B45309', fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>Express</span>}
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
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Ongkir ({pickupType === 'pickup' ? 'Jemput cucian kotor' : 'Antar cucian bersih'})</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{rp(logisticFee)}</span>
            </div>
          )}
          <Divider my={8} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900 }}>Total</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.primary }}>{rp(total)}</span>
          </div>
        </div>

        {/* Layanan Antar/Jemput - Toggle + 2 Options */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>LAYANAN ANTAR/JEMPUT</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'self', label: 'Tidak Ada', icon: '🏪', desc: 'Customer ambil di outlet' },
              { key: 'pickup', label: 'Jemput', icon: '🚗', desc: 'Ambil cucian kotor ke rumah' },
              { key: 'delivery', label: 'Antar', icon: '🛵', desc: 'Antar cucian bersih ke rumah' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPickupType(opt.key)}
                style={{
                  flex: 1, padding: '10px 6px', borderRadius: 10, textAlign: 'center',
                  border: `1.5px solid ${pickupType === opt.key ? C.primary : C.n300}`,
                  background: pickupType === opt.key ? C.primaryLight : C.white,
                  cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11,
                  fontWeight: pickupType === opt.key ? 700 : 400,
                  color: pickupType === opt.key ? C.primary : C.n600,
                }}
                title={opt.desc}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Schedule & Area Zone for Pickup/Delivery */}
          {pickupType !== 'self' && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Customer address — auto-fill */}
              {notaCustomer && (notaCustomer.addressHousing || notaCustomer.addressDetail) && (
                <div style={{ background: '#F0F9FF', borderRadius: 10, padding: '10px 12px', border: `1px solid #BAE6FD` }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: '#0369A1', marginBottom: 4, letterSpacing: 0.3 }}>
                    📍 ALAMAT {pickupType === 'pickup' ? 'JEMPUT' : 'ANTAR'} (DARI DATA CUSTOMER)
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

              <DateTimeInput
                label={pickupType === 'pickup' ? 'Jadwal Jemput' : 'Jadwal Antar'}
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
              />
              <Select
                label="Area Zone (ongkir)"
                value={areaZoneId}
                onChange={setAreaZoneId}
                options={[
                  { value: '', label: 'Pilih zona...' },
                  ...areaZones.map((z) => ({ value: z.id, label: `${z.name} - ${rp(z.fee)}` })),
                ]}
              />

              {/* Tambahan untuk Delivery: nama kurir + catatan */}
              {pickupType === 'delivery' && (
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

        {/* Payment */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>WAKTU PEMBAYARAN</div>
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
                  onClick={() => { setPayTiming(opt.key); if (opt.key === 'later') setPayMethod('cash'); }}
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
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? C.primary : C.n900 }}>
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
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? C.primary : C.n900 }}>
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
                <div style={{ background: '#FEF9C3', borderRadius: 10, padding: '10px 12px', marginBottom: 12, border: '1px solid #FDE68A' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: '#854D0E', marginBottom: 8 }}>
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
                            border: `1px solid #FDE68A`, background: 'white',
                            fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: '#854D0E',
                            cursor: 'pointer',
                          }}
                        >
                          {Math.round(pct * 100)}% · {rp(v)}
                        </button>
                      );
                    })}
                  </div>
                  {dpValue > 0 && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#854D0E', marginTop: 8, lineHeight: 1.5 }}>
                      Bayar sekarang: <strong>{rp(dpValue)}</strong><br/>
                      Sisa tagihan: <strong>{rp(total - dpValue)}</strong> (dilunasi saat ambil)
                    </div>
                  )}
                  {dpAmountStr && dpValue <= 0 && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.danger, marginTop: 6 }}>
                      ⚠️ Nominal harus lebih dari 0
                    </div>
                  )}
                </div>
              )}

              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>METODE PEMBAYARAN</div>
              <PaymentMethodGrouped
                value={payMethod === 'midtrans' ? (selectedMidtransChannel || 'qris') : payMethod}
                onChange={(m) => {
                  // Map Midtrans channels (qris/gopay/etc) ke alur 'midtrans'
                  // tapi simpan channel terpilih untuk dipakai langsung ke chargePayment
                  if (['qris', 'gopay', 'shopeepay', 'bca_va', 'bni_va', 'bri_va', 'permata_va', 'mandiri_va'].includes(m)) {
                    setPayMethod('midtrans');
                    setSelectedMidtransChannel(m);
                  } else {
                    setPayMethod(m);
                    setSelectedMidtransChannel(null);
                  }
                }}
                showDeposit={!!notaCustomer?.depositBalance || !!notaCustomer?.deposit}
                depositBalance={Number(notaCustomer?.depositBalance ?? notaCustomer?.deposit ?? 0)}
                amount={effectivePaid}
                hint={payPlan === 'dp'
                  ? `DP ${rp(dpValue)}. Sisa ${rp(total - dpValue)} dilunasi saat ambil cucian.`
                  : 'Bayar lunas. Pilih "Bayar Nanti" kalau belum mau bayar.'}
              />
            </>
          ) : (
            <div style={{
              background: '#FEF9C3', borderRadius: 10, padding: '12px 14px',
              fontFamily: 'Poppins', fontSize: 12, color: '#854D0E', lineHeight: 1.5,
              border: '1px solid #FDE68A',
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>⏳ Bayar saat pengambilan</div>
              Tagihan akan tercatat sebagai <strong>BELUM LUNAS</strong>. Customer hanya bisa ambil cucian setelah lunas.
              Metode pembayaran dipilih di kasir saat customer datang.
            </div>
          )}

          <DateTimeInput
            label="Estimasi Selesai"
            value={dueDate}
            onChange={(v) => setDueDate(v)}
            placeholder="Pilih estimasi selesai"
            minDate={minDateForPicker}
            filterDate={filterPastDates}
            timeOptional
          />
          <Input label="Catatan (opsional)" value={notes} onChange={setNotes} placeholder="Catatan khusus..." />
        </div>
      </div>

      {/* QRIS EDC Loading Modal */}
      {qrisModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.white, borderRadius: 20, padding: '32px 28px', textAlign: 'center', maxWidth: 300, width: '85%' }}>
            <div style={{ width: 56, height: 56, border: `4px solid ${C.n200}`, borderTop: `4px solid ${C.primary}`, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900, marginBottom: 8 }}>Menunggu Pembayaran</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Menunggu konfirmasi dari EDC QRIS...</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.primary, marginTop: 12 }}>{rp(effectivePaid)}</div>
          </div>
        </div>
      )}

      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', gap: 10 }}>
        <Btn variant="secondary" onClick={() => goBack?.()} style={{ flex: 1 }}>Kembali</Btn>
        <Btn variant="primary" onClick={handleConfirm} loading={loading} style={{ flex: 2 }}
             disabled={payTiming === 'now' && payPlan === 'dp' && dpValue <= 0}>
          {payTiming === 'later'
            ? `Buat Nota (belum bayar ${rp(total)})`
            : payPlan === 'dp'
              ? `Bayar DP ${rp(dpValue)}`
              : `Bayar ${rp(total)}`}
        </Btn>
      </div>

      {/* Midtrans channel selector */}
      <PaymentChannelSelector
        visible={showChannelSelector}
        onClose={handleCancelChannel}
        onSelect={handleSelectChannel}
        amount={effectivePaid}
        title="Pilih Metode Pembayaran Customer"
      />
    </div>
  );
}
