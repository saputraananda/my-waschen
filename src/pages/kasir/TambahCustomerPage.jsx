import { useState } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, Input, Btn, Select } from '../../components/ui';

export default function TambahCustomerPage({ navigate }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    gender: 'other',
    greeting: 'Other',
    addressHousing: '',
    addressBlock: '',
    addressNo: '',
    addressDetail: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  const handleSave = async () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Nama wajib diisi';
    if (!form.phone.trim()) errs.phone = 'Nomor HP wajib diisi';
    else if (!/^08\d{7,11}$/.test(form.phone)) errs.phone = 'Format nomor HP tidak valid';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        gender: form.gender,
        greeting: form.greeting,
        addressHousing: form.addressHousing.trim(),
        addressBlock: form.addressBlock.trim(),
        addressNo: form.addressNo.trim(),
        addressDetail: form.addressDetail.trim(),
      };
      const res = await axios.post('/api/customers', payload);
      if (res?.data?.success) {
        showToast('Pelanggan berhasil ditambahkan', 'success');
        setTimeout(() => navigate('customer'), 800);
      } else {
        showToast(res?.data?.message || 'Gagal menambahkan pelanggan', 'error');
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal menambahkan pelanggan. Silakan coba lagi.';
      console.error('Failed to add customer:', error);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Tambah Customer" onBack={() => navigate('customer')} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ background: C.white, borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <Input label="Nama Lengkap *" value={form.name} onChange={set('name')} placeholder="Contoh: Budi Santoso" error={errors.name} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Select label="Gender" value={form.gender} onChange={set('gender')} options={[{ value: 'male', label: 'Laki-laki' }, { value: 'female', label: 'Perempuan' }, { value: 'other', label: 'Lainnya' }]} />
            <Select label="Sapaan" value={form.greeting} onChange={set('greeting')} options={[{ value: 'Bapak', label: 'Bapak' }, { value: 'Ibu', label: 'Ibu' }, { value: 'Kak', label: 'Kak' }, { value: 'Mas', label: 'Mas' }, { value: 'Mbak', label: 'Mbak' }, { value: 'Other', label: 'Lainnya' }]} />
          </div>
          <Input label="Nomor HP *" value={form.phone} onChange={set('phone')} placeholder="08xxxxxxxxxx" inputMode="tel" error={errors.phone} />
          <Input label="Email" value={form.email} onChange={set('email')} type="email" placeholder="email@example.com" />
          <Input label="Nama Komplek/Perumahan" value={form.addressHousing} onChange={set('addressHousing')} placeholder="Contoh: Green Valley Residence" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label="Blok" value={form.addressBlock} onChange={set('addressBlock')} placeholder="Contoh: A12" />
            <Input label="No. Rumah" value={form.addressNo} onChange={set('addressNo')} placeholder="Contoh: 5" />
          </div>
          <Input label="Detail Alamat" value={form.addressDetail} onChange={set('addressDetail')} placeholder="Patokan, RT/RW, dll" />
        </div>

        <div style={{ background: C.primaryLight, borderRadius: 12, padding: 14, marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.primary, lineHeight: 1.5 }}>
            Setelah menambahkan customer, Anda bisa langsung membuat nota laundry untuknya.
          </div>
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

      <div style={{ padding: '12px 20px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', gap: 10 }}>
        <Btn variant="secondary" onClick={() => navigate('customer')} style={{ flex: 1 }}>Batal</Btn>
        <Btn variant="primary" onClick={handleSave} loading={loading} style={{ flex: 2 }}>Simpan Customer</Btn>
      </div>
    </div>
  );
}
