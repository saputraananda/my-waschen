import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, Input, Btn, Select } from '../../components/ui';
import { useApp } from '../../context/AppContext';

export default function TambahCustomerPage({ navigate, screenParams }) {
  const { setNotaCustomer } = useApp();
  const isEdit = !!screenParams?.id;
  
  const [form, setForm] = useState({
    name: screenParams?.name || '',
    phone: screenParams?.phone || '',
    email: screenParams?.email || '',
    gender: screenParams?.gender || '',
    greeting: screenParams?.greeting || '',
    awareness_source_id: screenParams?.awareness_source_id || '',
    awareness_other_text: screenParams?.awareness_other_text || '',
    area_zone_id: screenParams?.area_zone_id || '',
    area_zone_other_text: screenParams?.area_zone_other_text || '',
    address_housing: screenParams?.address_housing || screenParams?.addressHousing || '',
    address_block: screenParams?.address_block || screenParams?.addressBlock || '',
    address_no: screenParams?.address_no || screenParams?.addressNo || '',
    address_detail: screenParams?.address_detail || screenParams?.addressDetail || '',
    notes: screenParams?.notes || '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  
  const [awarenessSources, setAwarenessSources] = useState([]);
  const [areaZones, setAreaZones] = useState([]);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [awarenessRes, zoneRes] = await Promise.all([
          axios.get('/api/master/awareness'),
          axios.get('/api/master/area-zones'),
        ]);
        if (awarenessRes?.data?.data) setAwarenessSources(awarenessRes.data.data);
        if (zoneRes?.data?.data) setAreaZones(zoneRes.data.data);
      } catch (error) {
        console.error('Failed to fetch master data:', error);
      }
    };
    fetchMasterData();
  }, []);

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  const handleSave = async () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Wajib diisi';
    if (!form.phone.trim()) errs.phone = 'Wajib diisi';
    else if (!/^08\d{7,11}$/.test(form.phone)) errs.phone = 'Format tidak valid';
    if (!form.gender) errs.gender = 'Wajib diisi';
    if (!form.greeting) errs.greeting = 'Wajib diisi';
    if (!form.awareness_source_id) errs.awareness_source_id = 'Wajib diisi';
    if (!form.area_zone_id) errs.area_zone_id = 'Wajib diisi';
    if (!form.address_housing.trim()) errs.address_housing = 'Wajib diisi';
    if (!form.address_block.trim()) errs.address_block = 'Wajib diisi';
    if (!form.address_no.trim()) errs.address_no = 'Wajib diisi';
    if (!form.address_detail.trim()) errs.address_detail = 'Wajib diisi';

    if (Object.keys(errs).length) { 
      setErrors(errs); 
      showToast('Harap lengkapi semua field yang wajib (*)', 'error');
      return; 
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        gender: form.gender,
        greeting: form.greeting,
        awareness_source_id: form.awareness_source_id,
        awareness_other_text: form.awareness_other_text.trim(),
        area_zone_id: form.area_zone_id,
        address_housing: form.address_housing.trim(),
        address_block: form.address_block.trim(),
        address_no: form.address_no.trim(),
        address_detail: form.address_detail.trim(),
        notes: form.notes.trim() || null,
      };
      
      let res;
      if (isEdit) {
        res = await axios.put(`/api/customers/${screenParams.id}`, payload);
      } else {
        res = await axios.post('/api/customers', payload);
      }

      if (res?.data?.success) {
        showToast(isEdit ? 'Pelanggan berhasil diupdate' : 'Pelanggan berhasil ditambahkan', 'success');
        setTimeout(() => {
          if (!isEdit && res.data.data) {
             setNotaCustomer(res.data.data);
             navigate('nota_step2');
          } else {
             navigate('customer');
          }
        }, 800);
      } else {
        showToast(res?.data?.message || 'Gagal memproses data pelanggan', 'error');
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal memproses data pelanggan. Silakan coba lagi.';
      console.error('Failed to process customer:', error);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedAwareness = awarenessSources.find(a => a.id === form.awareness_source_id);
  const isAwarenessOther = selectedAwareness?.is_other === 1 || selectedAwareness?.is_other === true;

  const selectedZone = areaZones.find(a => a.id === form.area_zone_id);
  const isZoneOther = selectedZone?.is_other === 1 || selectedZone?.is_other === true;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title={isEdit ? "Edit Customer" : "Tambah Customer"} onBack={() => navigate('customer')} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ background: C.white, borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <Input label="Nama Lengkap *" value={form.name} onChange={set('name')} placeholder="Contoh: Budi Santoso" error={errors.name} />
          
          <Input label="Nomor HP *" value={form.phone} onChange={set('phone')} placeholder="08xxxxxxxxxx" inputMode="tel" error={errors.phone} />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <Select label="Gender *" value={form.gender} onChange={set('gender')} options={[{ value: '', label: 'Pilih Gender' }, { value: 'male', label: 'Laki-laki' }, { value: 'female', label: 'Perempuan' }, { value: 'other', label: 'Lainnya' }]} />
              {errors.gender && <div style={{ color: C.error, fontSize: 11, marginTop: 4 }}>{errors.gender}</div>}
            </div>
            <div>
              <Select label="Sapaan *" value={form.greeting} onChange={set('greeting')} options={[{ value: '', label: 'Pilih Sapaan' }, { value: 'Bapak', label: 'Bapak' }, { value: 'Ibu', label: 'Ibu' }, { value: 'Kak', label: 'Kak' }, { value: 'Mas', label: 'Mas' }, { value: 'Mbak', label: 'Mbak' }, { value: 'Other', label: 'Lainnya' }]} />
              {errors.greeting && <div style={{ color: C.error, fontSize: 11, marginTop: 4 }}>{errors.greeting}</div>}
            </div>
          </div>

          <Input label="Email (Opsional)" value={form.email} onChange={set('email')} type="email" placeholder="email@example.com" />

          <div style={{ height: 1, background: C.n100, margin: '20px 0' }} />

          {/* Pengalaman & Awareness */}
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 12 }}>Informasi Pemasaran</div>
          
          <div>
            <Select 
              label="Sumber Mengetahui Waschen *" 
              value={form.awareness_source_id} 
              onChange={set('awareness_source_id')} 
              options={[
                { value: '', label: 'Pilih Sumber Info...' },
                ...awarenessSources.map(s => ({ value: s.id, label: s.name }))
              ]} 
            />
            {errors.awareness_source_id && <div style={{ color: C.error, fontSize: 11, marginTop: 4 }}>{errors.awareness_source_id}</div>}
          </div>

          {isAwarenessOther && (
            <div style={{ marginTop: 10 }}>
              <Input label="Sebutkan Sumber (Lainnya)" value={form.awareness_other_text} onChange={set('awareness_other_text')} placeholder="Tuliskan dari mana Anda tahu..." />
            </div>
          )}

          <div style={{ height: 1, background: C.n100, margin: '20px 0' }} />

          {/* Alamat Lengkap */}
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 12 }}>Alamat Tempat Tinggal</div>

          <div>
            <Select 
              label="Pilih Area/Zona *" 
              value={form.area_zone_id} 
              onChange={set('area_zone_id')} 
              options={[
                { value: '', label: 'Pilih Area...' },
                ...areaZones.map(s => ({ value: s.id, label: s.name }))
              ]} 
            />
            {errors.area_zone_id && <div style={{ color: C.error, fontSize: 11, marginTop: 4 }}>{errors.area_zone_id}</div>}
          </div>

          {isZoneOther && (
            <div style={{ marginTop: 10 }}>
              <Input label="Tulis Area (Lainnya)" value={form.area_zone_other_text} onChange={set('area_zone_other_text')} placeholder="Sebutkan nama desa/kelurahan..." />
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <Input label="Nama Komplek/Perumahan *" value={form.address_housing} onChange={set('address_housing')} placeholder="Contoh: Green Valley Residence" error={errors.address_housing} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label="Blok *" value={form.address_block} onChange={set('address_block')} placeholder="Contoh: A12" error={errors.address_block} />
            <Input label="No. Rumah *" value={form.address_no} onChange={set('address_no')} placeholder="Contoh: 5" error={errors.address_no} />
          </div>

          <Input label="Detail Alamat Lengkap *" value={form.address_detail} onChange={set('address_detail')} placeholder="Patokan, RT/RW, gang, dll" error={errors.address_detail} />

          <Input label="Catatan Internal (Opsional)" value={form.notes} onChange={set('notes')} placeholder="Contoh: Pelanggan minta cucian dilipat rapi..." />
        </div>

        {!isEdit && (
          <div style={{ background: C.primaryLight, borderRadius: 12, padding: 14, marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.primary, lineHeight: 1.5 }}>
              Setelah menambahkan customer, Anda bisa langsung membuat nota laundry untuknya.
            </div>
          </div>
        )}
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
        <Btn variant="primary" onClick={handleSave} loading={loading} style={{ flex: 2 }}>{isEdit ? "Simpan Perubahan" : "Simpan Customer"}</Btn>
      </div>
    </div>
  );
}
