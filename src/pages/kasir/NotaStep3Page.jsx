import { useState } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Input, Select, Divider } from '../../components/ui';
import { useApp } from '../../context/AppContext';

export default function NotaStep3Page() {
  const { navigate, user, notaCustomer, notaCart, setNotaCart, setNotaCustomer } = useApp();
  const [pickup, setPickup] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const subtotal = notaCart.reduce((sum, c) => sum + (c.price + (c.express ? c.expressExtra || 5000 : 0)) * c.qty, 0);
  const pickupFee = pickup ? 10000 : 0;
  const deliveryFee = delivery ? 10000 : 0;
  const total = subtotal + pickupFee + deliveryFee;

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  const handleConfirm = async () => {
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
        pickup,
        delivery,
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
          pickup,
          delivery,
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
                <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{item.name}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{item.qty} {item.unit} {item.express ? '⚡' : ''}</div>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{rp((item.price + (item.express ? item.expressExtra || 5000 : 0)) * item.qty)}</div>
            </div>
          ))}

          <Divider my={8} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Subtotal</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{rp(subtotal)}</span>
          </div>
          {pickup && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Jemput</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{rp(pickupFee)}</span>
            </div>
          )}
          {delivery && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Antar</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{rp(deliveryFee)}</span>
            </div>
          )}
          <Divider my={8} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900 }}>Total</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.primary }}>{rp(total)}</span>
          </div>
        </div>

        {/* Options */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>OPSI LAYANAN</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setPickup(!pickup)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${pickup ? C.primary : C.n300}`, background: pickup ? C.primaryLight : C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: pickup ? 700 : 400, color: pickup ? C.primary : C.n600 }}>🚗 Jemput (+{rp(10000)})</button>
            <button onClick={() => setDelivery(!delivery)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${delivery ? C.primary : C.n300}`, background: delivery ? C.primaryLight : C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: delivery ? 700 : 400, color: delivery ? C.primary : C.n600 }}>🛵 Antar (+{rp(10000)})</button>
          </div>
        </div>

        {/* Payment */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <Select
            label="Metode Pembayaran"
            value={payMethod}
            onChange={setPayMethod}
            options={[
              { value: 'cash', label: '💵 Tunai' },
              { value: 'transfer', label: '🏦 Transfer Bank' },
              { value: 'deposit', label: `💳 Deposit (${rp(notaCustomer?.deposit || 0)})` },
              { value: 'qris', label: '📱 QRIS' },
            ]}
          />
          <Input label="Estimasi Selesai" value={dueDate} onChange={setDueDate} type="date" />
          <Input label="Catatan (opsional)" value={notes} onChange={setNotes} placeholder="Catatan khusus..." />
        </div>
      </div>

      {toast.visible && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: toast.type === 'success' ? '#DCFCE7' : '#FEE2E2',
          color: toast.type === 'success' ? '#166534' : '#991B1B',
          padding: '12px 20px',
          borderRadius: 12,
          fontFamily: 'Poppins',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {toast.type === 'success' ? '✓' : '⚠'} {toast.message}
        </div>
      )}

      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', gap: 10 }}>
        <Btn variant="secondary" onClick={() => navigate('nota_step2')} style={{ flex: 1 }}>Kembali</Btn>
        <Btn variant="primary" onClick={handleConfirm} loading={loading} style={{ flex: 2 }}>Buat Nota {rp(total)}</Btn>
      </div>
    </div>
  );
}
