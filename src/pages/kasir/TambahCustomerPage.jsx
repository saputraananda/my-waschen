import { useState } from 'react';
import { C } from '../../utils/theme';
import { TopBar, Input, Btn } from '../../components/ui';

export default function TambahCustomerPage({ navigate, onAdd }) {
  const [form, setForm] = useState({ name: '', phone: '', address: '', email: '' });
  const [errors, setErrors] = useState({});

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  const handleSave = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Nama wajib diisi';
    if (!form.phone.trim()) errs.phone = 'Nomor HP wajib diisi';
    else if (!/^08\d{7,11}$/.test(form.phone)) errs.phone = 'Format nomor HP tidak valid';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const customer = {
      id: 'C' + Date.now(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      email: form.email.trim(),
      avatar: form.name.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      totalTx: 0,
      deposit: 0,
      isPremium: false,
    };
    onAdd(customer);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Tambah Customer" onBack={() => navigate('customer')} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ background: C.white, borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <Input label="Nama Lengkap *" value={form.name} onChange={set('name')} placeholder="Contoh: Budi Santoso" error={errors.name} />
          <Input label="Nomor HP *" value={form.phone} onChange={set('phone')} placeholder="08xxxxxxxxxx" inputMode="tel" error={errors.phone} />
          <Input label="Alamat" value={form.address} onChange={set('address')} placeholder="Alamat domisili" />
          <Input label="Email" value={form.email} onChange={set('email')} type="email" placeholder="email@example.com" />
        </div>

        <div style={{ background: C.primaryLight, borderRadius: 12, padding: 14, marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.primary, lineHeight: 1.5 }}>
            Setelah menambahkan customer, Anda bisa langsung membuat nota laundry untuknya.
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 20px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', gap: 10 }}>
        <Btn variant="secondary" onClick={() => navigate('customer')} style={{ flex: 1 }}>Batal</Btn>
        <Btn variant="primary" onClick={handleSave} style={{ flex: 2 }}>Simpan Customer</Btn>
      </div>
    </div>
  );
}
