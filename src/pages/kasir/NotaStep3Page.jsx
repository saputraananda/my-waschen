import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Input, Select, Divider, Modal } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

function todayKeyWib() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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

function minSelectableDateWib() {
  const [y, m, d] = todayKeyWib().split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isWeekendWib(d) {
  const w = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(d);
  return w === 'Sat' || w === 'Sun';
}

function isTodayWib(d) {
  return dateKeyWib(d) === todayKeyWib();
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
  const [pickupType, setPickupType] = useState('self'); // 'self' | 'pickup' | 'delivery'
  const [scheduleDate, setScheduleDate] = useState(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [areaZoneId, setAreaZoneId] = useState('');
  const [areaZones, setAreaZones] = useState([]);
  const [payMethod, setPayMethod] = useState('cash');
  const [payTiming, setPayTiming] = useState('now');
  const [payPlan, setPayPlan] = useState('full');
  const [dpAmountStr, setDpAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qrisModal, setQrisModal] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [promos, setPromos] = useState([]);
  const [selectedPromoId, setSelectedPromoId] = useState('');

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
  const subtotal = notaCart.reduce((sum, c) => sum + (c.price + (c.express ? c.expressExtra || 5000 : 0)) * c.qty, 0);
  const selectedPromo = useMemo(
    () => promos.find((p) => p.id === selectedPromoId) || null,
    [promos, selectedPromoId]
  );
  const promoDiscount = useMemo(
    () => promoDiscountPreview(selectedPromo, subtotal),
    [selectedPromo, subtotal]
  );
  const total = subtotal - promoDiscount + logisticFee;

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  const doCheckout = async () => {
    setLoading(true);
    try {
      const formatDate = (d) => {
        if (!d) return null;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const dpNum = Math.max(0, Number(String(dpAmountStr).replace(/\D/g, '')) || 0);
      let paidAmount = total;
      let changeAmount = 0;
      if (payTiming === 'later' && payPlan === 'full') {
        paidAmount = 0;
      } else if (payPlan === 'dp') {
        paidAmount = Math.min(dpNum, total);
        changeAmount = Math.max(0, paidAmount - total);
      }

      const paymentPayload = {
        amount: total,
        paidAmount,
        changeAmount,
      };
      const needMethod = paidAmount > 0;
      if (needMethod) {
        paymentPayload.method = payMethod;
      }

      const payload = {
        customerId: notaCustomer.id,
        items: notaCart.map((c) => ({
          serviceId:   c.id,
          serviceName: c.name,
          unit:        c.unit,
          qty:         c.qty,
          price:       c.price + (c.express ? (c.expressExtra || 0) : 0),
          subtotal:    (c.price + (c.express ? (c.expressExtra || 0) : 0)) * c.qty,
          isExpress:   c.express || false,
          notes:       c.notes  || null,
        })),
        payment: paymentPayload,
        paymentIntent: {
          payTiming: payTiming === 'later' ? 'later' : 'now',
          payPlan: payPlan === 'dp' ? 'dp' : 'full',
          dpAmount: payPlan === 'dp' ? dpNum : 0,
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
        notes,
        dueDate: dueDate ? formatDate(dueDate) : null,
      };

      const res = await axios.post('/api/transactions/checkout', payload);
      const data = res?.data?.data;

      if (data) {
        setNotaCart([]);
        setNotaCustomer(null);
        const nota = {
          id:            data.transactionNo,
          customerName:  data.customerName,
          customerPhone: data.customerPhone,
          items:         data.items || [],
          total:         Number(data.total) || 0,
          payMethod:     data.payment?.method || payMethod,
          paidAmount:    data.payment?.paidAmount || total,
          changeAmount:  data.payment?.changeAmount || 0,
          pickup: pickupType === 'pickup',
          delivery: pickupType === 'delivery',
          notes,
          dueDate,
          status: 'baru',
          date:   new Date().toISOString().slice(0, 10),
        };
        navigate('nota_berhasil', nota);
      } else {
        showToast(res?.data?.message || 'Gagal membuat nota', 'error');
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal membuat nota. Silakan coba lagi.';
      console.error('Checkout error:', error);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const dpNumPreview = Math.max(0, Number(String(dpAmountStr).replace(/\D/g, '')) || 0);
  const effectivePaid =
    payTiming === 'later' && payPlan === 'full'
      ? 0
      : payPlan === 'dp'
        ? Math.min(dpNumPreview, total)
        : total;

  const handleConfirm = () => {
    if (selectedPromoId && promoDiscount <= 0) {
      showToast('Promo tidak memenuhi syarat untuk subtotal saat ini.', 'error');
      return;
    }
    if (payPlan === 'dp' && (!dpAmountStr || dpNumPreview <= 0)) {
      showToast('Isi nominal DP', 'error');
      return;
    }
    const runCheckout = () => doCheckout();
    if (payMethod === 'qris' && effectivePaid > 0) {
      setQrisModal(true);
      setTimeout(() => {
        setQrisModal(false);
        runCheckout();
      }, 3000);
    } else {
      runCheckout();
    }
  };

  const dateInputStyle = {
    width: '100%',
    height: 48,
    borderRadius: 10,
    padding: '0 14px',
    border: `1.5px solid ${C.n300}`,
    fontFamily: 'Poppins',
    fontSize: 14,
    color: C.n900,
    background: C.white,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const minDateForPicker = minSelectableDateWib();
  const filterPastDates = (d) => dateKeyWib(d) >= todayKeyWib();

  const calendarDayClassName = (date) => {
    const parts = [];
    if (isWeekendWib(date)) parts.push('nota-datepicker-weekend');
    if (isTodayWib(date)) parts.push('nota-datepicker-is-today');
    return parts.length ? parts.join(' ') : undefined;
  };

  const renderCalendarDayContents = (day, date) => (
    <span className="nota-datepicker-day-wrap">
      <span className="nota-datepicker-day-num">{day}</span>
      {isTodayWib(date) && <span className="nota-datepicker-today-badge">Hari ini</span>}
    </span>
  );

  const renderCalendarHeader = ({ date, decreaseMonth, increaseMonth }) => (
    <div className="nota-datepicker-header">
      <button type="button" className="nota-datepicker-nav-btn" onClick={decreaseMonth} aria-label="Bulan sebelumnya">
        ‹
      </button>
      <div className="nota-datepicker-month-label">
        {date.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
      </div>
      <button type="button" className="nota-datepicker-nav-btn" onClick={increaseMonth} aria-label="Bulan berikutnya">
        ›
      </button>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <style>{`
        .nota-datepicker {
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          font-family: Poppins, sans-serif;
          box-shadow: 0 12px 28px rgba(15,23,42,0.14);
          overflow: hidden;
        }
        .nota-datepicker .react-datepicker__triangle {
          display: none;
        }
        .nota-datepicker .react-datepicker__month-container {
          background: #F8FAFC;
        }
        .nota-datepicker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: linear-gradient(135deg, ${C.primary}, ${C.primaryDark || C.primary});
          color: #fff;
          padding: 12px 10px;
        }
        .nota-datepicker-month-label {
          font-size: 13px;
          font-weight: 700;
          text-transform: capitalize;
        }
        .nota-datepicker-nav-btn {
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 999px;
          background: rgba(255,255,255,0.2);
          color: #fff;
          font-size: 20px;
          line-height: 20px;
          cursor: pointer;
        }
        .nota-datepicker-nav-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        .nota-datepicker .react-datepicker__day-names {
          margin-top: 6px;
          margin-bottom: 2px;
        }
        .nota-datepicker .react-datepicker__day-name {
          color: #64748B;
          font-size: 11px;
          font-weight: 600;
          width: 2rem;
          line-height: 2rem;
        }
        .nota-datepicker .react-datepicker__day {
          color: #0F172A;
          border-radius: 9px;
          width: 2.35rem;
          min-height: 2.35rem;
          line-height: 1.15;
          margin: 0.14rem;
          font-size: 12px;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .nota-datepicker .react-datepicker__day:hover {
          background: #DBEAFE;
          color: #1D4ED8;
        }
        .nota-datepicker .react-datepicker__day--today {
          background: #E2E8F0;
          color: #334155;
          font-weight: 700;
        }
        .nota-datepicker .react-datepicker__day.nota-datepicker-weekend:not(.react-datepicker__day--selected):not(.react-datepicker__day--keyboard-selected) {
          color: #5B21B6;
          background: #EDE9FE;
        }
        .nota-datepicker .react-datepicker__day--outside-month {
          opacity: 0.38;
        }
        .nota-datepicker .react-datepicker__day--disabled {
          opacity: 0.28 !important;
          cursor: not-allowed !important;
          text-decoration: line-through;
          background: transparent !important;
        }
        .nota-datepicker .react-datepicker__day--selected,
        .nota-datepicker .react-datepicker__day--keyboard-selected {
          background: ${C.primary};
          color: #fff;
          font-weight: 700;
        }
        .nota-datepicker .react-datepicker__day--selected .nota-datepicker-today-badge,
        .nota-datepicker .react-datepicker__day--keyboard-selected .nota-datepicker-today-badge {
          color: #fff;
          background: rgba(255,255,255,0.28);
        }
        .nota-datepicker-day-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 2px 0;
        }
        .nota-datepicker-day-num {
          font-size: 12px;
          font-weight: 600;
          line-height: 1;
        }
        .nota-datepicker-today-badge {
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #1D4ED8;
          background: #DBEAFE;
          padding: 1px 5px;
          border-radius: 999px;
          line-height: 1.2;
        }
      `}</style>
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
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{rp((item.price + (item.express ? item.expressExtra || 5000 : 0)) * item.qty)}</div>
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
              <select
                value={selectedPromoId}
                onChange={(e) => setSelectedPromoId(e.target.value)}
                style={{ width: '100%', height: 42, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13 }}
              >
                <option value="">Tanpa promo</option>
                {promos.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
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
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Ongkir ({pickupType === 'pickup' ? 'Jemput' : 'Antar'})</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{rp(logisticFee)}</span>
            </div>
          )}
          <Divider my={8} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900 }}>Total</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.primary }}>{rp(total)}</span>
          </div>
        </div>

        {/* Pickup Type - 3 Options */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>TIPE PENGIRIMAN</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'self', label: 'Ambil Sendiri', icon: '🏪' },
              { key: 'pickup', label: 'Pickup', icon: '🚗' },
              { key: 'delivery', label: 'Delivery', icon: '🛵' },
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
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Schedule & Area Zone for Pickup/Delivery */}
          {pickupType !== 'self' && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>Tanggal Jadwal</div>
                  <DatePicker
                    selected={scheduleDate}
                    onChange={(date) => setScheduleDate(date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Pilih tanggal"
                    calendarClassName="nota-datepicker"
                    renderCustomHeader={renderCalendarHeader}
                    minDate={minDateForPicker}
                    filterDate={filterPastDates}
                    dayClassName={calendarDayClassName}
                    renderDayContents={renderCalendarDayContents}
                    customInput={
                      <input style={dateInputStyle} readOnly />
                    }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Input label="Jam" value={scheduleTime} onChange={setScheduleTime} type="time" />
                </div>
              </div>
              <Select
                label="Area Zone (ongkir)"
                value={areaZoneId}
                onChange={setAreaZoneId}
                options={[
                  { value: '', label: 'Pilih zona...' },
                  ...areaZones.map((z) => ({ value: z.id, label: `${z.name} - ${rp(z.fee)}` })),
                ]}
              />
            </div>
          )}
        </div>

        {/* Payment */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>WAKTU PEMBAYARAN</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[
              { key: 'now', label: 'Di kasir sekarang', sub: 'Bayar saat nota dibuat' },
              { key: 'later', label: 'Nanti', sub: 'Saat selesai / pengambilan' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => { setPayTiming(opt.key); if (opt.key === 'later') setPayMethod('cash'); }}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, textAlign: 'left',
                  border: `1.5px solid ${payTiming === opt.key ? C.primary : C.n300}`,
                  background: payTiming === opt.key ? C.primaryLight : C.white,
                  cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11,
                }}
              >
                <div style={{ fontWeight: 700, color: payTiming === opt.key ? C.primary : C.n900 }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: C.n600, marginTop: 2 }}>{opt.sub}</div>
              </button>
            ))}
          </div>

          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>SKEMA</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[
              { key: 'full', label: 'Lunas' },
              { key: 'dp', label: 'DP / cicil' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPayPlan(opt.key)}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                  border: `1.5px solid ${payPlan === opt.key ? C.primary : C.n300}`,
                  background: payPlan === opt.key ? C.primaryLight : C.white,
                  cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12,
                  fontWeight: payPlan === opt.key ? 700 : 500,
                  color: payPlan === opt.key ? C.primary : C.n600,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {payPlan === 'dp' && (
            <div style={{ marginBottom: 12 }}>
              <Input
                label="Nominal DP (Rp)"
                value={dpAmountStr}
                onChange={setDpAmountStr}
                placeholder="Contoh: 50000"
                type="number"
              />
            </div>
          )}

          {!(payTiming === 'later' && payPlan === 'full') && (
            <>
              <Select
                label={payTiming === 'later' ? 'Metode untuk DP / pembayaran yang dicatat sekarang' : 'Metode pembayaran'}
                value={payMethod}
                onChange={setPayMethod}
                options={[
                  { value: 'cash', label: 'Tunai' },
                  { value: 'transfer', label: 'Transfer Bank' },
                  { value: 'deposit', label: `Deposit (${rp(notaCustomer?.deposit || 0)})` },
                  { value: 'qris', label: 'QRIS (EDC)' },
                ]}
              />
              {payMethod === 'qris' && effectivePaid > 0 && (
                <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '8px 12px', marginTop: 6, marginBottom: 16, fontFamily: 'Poppins', fontSize: 11, color: '#1D4ED8' }}>
                  Saat klik "Buat Nota", sistem akan menunggu konfirmasi dari EDC QRIS.
                </div>
              )}
            </>
          )}
          {payTiming === 'later' && payPlan === 'full' && (
            <div style={{ background: '#FEF9C3', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontFamily: 'Poppins', fontSize: 11, color: '#854D0E' }}>
              Pelunasan dilakukan di kasir saat pengambilan atau saat laundry selesai — metode pembayaran bisa dipilih saat itu.
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>Estimasi Selesai</div>
            <DatePicker
              selected={dueDate}
              onChange={(date) => setDueDate(date)}
              dateFormat="dd/MM/yyyy"
              placeholderText="Pilih estimasi selesai"
              calendarClassName="nota-datepicker"
              renderCustomHeader={renderCalendarHeader}
              minDate={minDateForPicker}
              filterDate={filterPastDates}
              dayClassName={calendarDayClassName}
              renderDayContents={renderCalendarDayContents}
              customInput={
                <input style={dateInputStyle} readOnly />
              }
            />
          </div>
          <Input label="Catatan (opsional)" value={notes} onChange={setNotes} placeholder="Catatan khusus..." />
        </div>
      </div>

      {toast.visible && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: toast.type === 'success' ? '#DCFCE7' : '#FEE2E2',
          color: toast.type === 'success' ? '#166534' : '#991B1B',
          padding: '12px 20px', borderRadius: 12, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.type === 'success' ? '✓' : '⚠'} {toast.message}
        </div>
      )}

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
        <Btn variant="secondary" onClick={() => navigate('nota_step2')} style={{ flex: 1 }}>Kembali</Btn>
        <Btn variant="primary" onClick={handleConfirm} loading={loading} style={{ flex: 2 }}>
          Buat Nota {payTiming === 'later' && payPlan === 'full' ? `(belum bayar ${rp(total)})` : payPlan === 'dp' ? `(DP ${rp(Math.min(dpNumPreview, total))})` : rp(total)}
        </Btn>
      </div>
    </div>
  );
}
