import { useState } from 'react';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Input, Select, Divider } from '../../components/ui';

export default function NotaStep3Page({ navigate, notaCustomer, notaCart, user, onConfirm }) {
  const [pickup, setPickup] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const subtotal = notaCart.reduce((sum, c) => sum + (c.price + (c.express ? c.expressExtra || 5000 : 0)) * c.qty, 0);
  const pickupFee = pickup ? 10000 : 0;
  const deliveryFee = delivery ? 10000 : 0;
  const total = subtotal + pickupFee + deliveryFee;

  const handleConfirm = () => {
    setLoading(true);
    setTimeout(() => {
      const nota = {
        id: 'TRX-' + Date.now().toString().slice(-6),
        customerId: notaCustomer.id,
        customerName: notaCustomer.name,
        customerPhone: notaCustomer.phone,
        items: notaCart,
        total,
        payMethod,
        pickup,
        delivery,
        notes,
        dueDate,
        status: 'baru',
        date: new Date().toISOString().slice(0, 10),
        createdBy: user?.name,
        progress: [],
      };
      setLoading(false);
      onConfirm(nota);
    }, 1000);
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

      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', gap: 10 }}>
        <Btn variant="secondary" onClick={() => navigate('nota_step2')} style={{ flex: 1 }}>Kembali</Btn>
        <Btn variant="primary" onClick={handleConfirm} loading={loading} style={{ flex: 2 }}>Buat Nota {rp(total)}</Btn>
      </div>
    </div>
  );
}
