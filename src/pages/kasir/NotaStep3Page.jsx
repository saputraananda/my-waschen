import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Input, Select, Divider, Modal } from '../../components/ui';
import { useApp } from '../../context/AppContext';

export default function NotaStep3Page() {
  const { navigate, user, notaCustomer, notaCart, setNotaCart, setNotaCustomer } = useApp();
  const [pickupType, setPickupType] = useState('self'); // 'self' | 'pickup' | 'delivery'
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [areaZoneId, setAreaZoneId] = useState('');
  const [areaZones, setAreaZones] = useState([]);
  const [payMethod, setPayMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrisModal, setQrisModal] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

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

  const selectedZone = areaZones.find((z) => z.id === areaZoneId);
  const logisticFee = pickupType === 'self' ? 0 : (selectedZone?.fee || 10000);
  const subtotal = notaCart.reduce((sum, c) => sum + (c.price + (c.express ? c.expressExtra || 5000 : 0)) * c.qty, 0);
  const total = subtotal + logisticFee;

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  const doCheckout = async () => {
    setLoading(true);
    try {
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
        payment: {
          method:      payMethod,
          amount:      total,
          paidAmount:  total,
          changeAmount: 0,
        },
        subtotal,
        discount: 0,
        total,
        pickup:   pickupType === 'pickup',
        delivery: pickupType === 'delivery',
        pickupType,
        areaZoneId: areaZoneId || null,
        scheduleAt: (scheduleDate && scheduleTime) ? `${scheduleDate}T${scheduleTime}:00` : null,
        notes,
        dueDate: dueDate || null,
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

  const handleConfirm = () => {
    // QRIS EDC Simulation
    if (payMethod === 'qris') {
      setQrisModal(true);
      setTimeout(() => {
        setQrisModal(false);
        doCheckout();
      }, 3000);
    } else {
      doCheckout();
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Buat Nota" subtitle="Langkah 3 dari 3 — Konfirmasi" onBack={() => navigate('nota_step2')} />

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
                <div style={{ flex: 1 }}>
                  <Input label="Tanggal Jadwal" value={scheduleDate} onChange={setScheduleDate} type="date" />
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
          <Select
            label="Metode Pembayaran"
            value={payMethod}
            onChange={setPayMethod}
            options={[
              { value: 'cash', label: 'Tunai' },
              { value: 'transfer', label: 'Transfer Bank' },
              { value: 'deposit', label: `Deposit (${rp(notaCustomer?.deposit || 0)})` },
              { value: 'qris', label: 'QRIS (EDC)' },
            ]}
          />
          {payMethod === 'qris' && (
            <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '8px 12px', marginTop: 6, fontFamily: 'Poppins', fontSize: 11, color: '#1D4ED8' }}>
              Saat klik "Buat Nota", sistem akan menunggu konfirmasi dari EDC QRIS.
            </div>
          )}
          <Input label="Estimasi Selesai" value={dueDate} onChange={setDueDate} type="date" />
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
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.primary, marginTop: 12 }}>{rp(total)}</div>
          </div>
        </div>
      )}

      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', gap: 10 }}>
        <Btn variant="secondary" onClick={() => navigate('nota_step2')} style={{ flex: 1 }}>Kembali</Btn>
        <Btn variant="primary" onClick={handleConfirm} loading={loading} style={{ flex: 2 }}>Buat Nota {rp(total)}</Btn>
      </div>
    </div>
  );
}
