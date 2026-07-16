import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { TopBar, Input, Btn, Select, Modal, DateTimeInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../utils/hooks';
import AddressCascadingPicker from '../../components/AddressCascadingPicker';
import { inferRegionFromHousing } from '../../data/housingSeed';

const DRAFT_KEY = 'draft_customer_form';

export default function TambahCustomerPage({ navigate, screenParams }) {
  const { setNotaCustomer } = useApp();
  const { isMobile } = useResponsive();
  const isEdit = !!screenParams?.id;

  // ─── Draft Management ──────────────────────────────────────────────────────────
  const loadDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const saveDraft = (data) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable — silent fail
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Silent fail
    }
  };

  // Get initial values: draft > screenParams > defaults
  const draft = !isEdit ? loadDraft() : null;
  const initialPhone = (screenParams?.phone || draft?.phone || '').replace(/^\+?62/, '').replace(/^0/, '');

  const [form, setForm] = useState({
    name: screenParams?.name || draft?.name || '',
    phone: initialPhone,
    email: screenParams?.email || draft?.email || '',
    gender: screenParams?.gender || draft?.gender || '',
    greeting: screenParams?.greeting || draft?.greeting || '',
    instansi: screenParams?.instansi || draft?.instansi || '',
    birthDate: screenParams?.birthDate || draft?.birthDate || '',
    religion: screenParams?.religion || draft?.religion || '',
    awareness_source_id: screenParams?.awareness_source_id || draft?.awareness_source_id || '',
    awareness_other_text: screenParams?.awareness_other_text || draft?.awareness_other_text || '',
    area_zone_id: screenParams?.area_zone_id || draft?.area_zone_id || '',
    area_zone_other_text: screenParams?.area_zone_other_text || draft?.area_zone_other_text || '',
    housing_region: screenParams?.housing_region || screenParams?.housingRegion || draft?.housing_region || '',
    address_housing: screenParams?.address_housing || screenParams?.addressHousing || draft?.address_housing || '',
    address_block: screenParams?.address_block || screenParams?.addressBlock || draft?.address_block || '',
    address_no: screenParams?.address_no || screenParams?.addressNo || draft?.address_no || '',
    address_detail: screenParams?.address_detail || screenParams?.addressDetail || draft?.address_detail || '',
    notes: screenParams?.notes || draft?.notes || '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [exitGuard, setExitGuard] = useState(false);
  const isDirty = useRef(false);
  const isDraftRestored = useRef(!!draft && !isEdit);
  const draftRestoredShown = useRef(false);

  const [awarenessSources, setAwarenessSources] = useState([]);
  const [areaZones, setAreaZones] = useState([]);

  // Show toast if draft was restored
  useEffect(() => {
    if (isDraftRestored.current && !draftRestoredShown.current) {
      draftRestoredShown.current = true;
      alertWarning('Data draft ditemukan. Form telah dipulihkan dari penyimpanan browser.');
    }
  }, []);

  // Save to localStorage on every form change (only for new customer)
  useEffect(() => {
    if (!isEdit && Object.keys(form).length > 0) {
      saveDraft(form);
    }
  }, [form, isEdit]);

  // Clear draft on successful save
  const clearFormAndDraft = () => {
    clearDraft();
    isDirty.current = false;
  };

  const markDirty = () => { isDirty.current = true; };

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
        // Silent fail for master data, UI will show empty options
      }
    };
    fetchMasterData();
  }, []);

  const set = (key) => (v) => { markDirty(); setForm((f) => ({ ...f, [key]: v })); };

  // Auto-capitalize untuk field nama & alamat
  const setCap = (key, mode = 'title') => (v) => {
    markDirty();
    let processed = v;
    if (mode === 'title') {
      // Title case tiap kata
      processed = String(v).split(/(\s+)/).map((p) => {
        if (!p.trim()) return p;
        return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
      }).join('');
    } else if (mode === 'sentence') {
      processed = String(v).charAt(0).toUpperCase() + String(v).slice(1);
    }
    setForm((f) => ({ ...f, [key]: processed }));
  };

  const handleBack = () => {
    if (!isEdit) clearDraft(); // Clear draft on back navigation
    if (isDirty.current) {
      setExitGuard(true);
    } else {
      navigate('customer');
    }
  };

  const handleSave = async () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Wajib diisi';
    if (!form.phone.trim()) errs.phone = 'Wajib diisi';
    else if (!/^0?8\d{7,12}$/.test(form.phone)) errs.phone = 'Nomor tidak valid (08xxxxxxxxxx, 8-13 digit)';
    // Semua field lain opsional — sesuai kebutuhan customer menengah ke atas yang ga banyak waktu

    if (Object.keys(errs).length) { 
      setErrors(errs); 
      alertWarning('Nama dan nomor HP wajib diisi');
      return; 
    }

    setLoading(true);
    try {
      // Normalize phone: strip +62/62 prefix, then leading zeros, ensure starts with 0
      const cleaned = form.phone.replace(/^(\+?62)/, '').replace(/^0+/, '');
      const fullPhone = '0' + cleaned;
      const payload = {
        name: form.name.trim(),
        phone: fullPhone,
        email: form.email.trim() || null,
        gender: form.gender || null,
        greeting: form.greeting || null,
        instansi: form.instansi.trim() || null,
        birth_date: form.birthDate || null,
        religion: form.religion || null,
        awareness_source_id: form.awareness_source_id || null,
        awareness_other_text: form.awareness_other_text.trim() || null,
        area_zone_id: form.area_zone_id || null,
        address_housing: form.address_housing.trim() || null,
        address_block: form.address_block.trim() || null,
        address_no: form.address_no.trim() || null,
        address_detail: form.address_detail.trim() || null,
        notes: form.notes.trim() || null,
      };
      
      let res;
      if (isEdit) {
        res = await axios.put(`/api/customers/${screenParams.id}`, payload);
      } else {
        res = await axios.post('/api/customers', payload);
      }

      if (res?.data?.success) {
        clearFormAndDraft(); // Clear draft on successful save
        alertSuccess(isEdit ? 'Pelanggan berhasil diupdate' : 'Pelanggan berhasil ditambahkan');
        setTimeout(() => {
          if (!isEdit && res.data.data) {
             setNotaCustomer(res.data.data);
             navigate('nota_step2');
          } else {
             navigate('customer');
          }
        }, 800);
      } else {
        alertError(res?.data?.message || 'Gagal memproses data pelanggan');
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal memproses data pelanggan. Silakan coba lagi.';
      alertError(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedAwareness = awarenessSources.find(a => a.id === form.awareness_source_id);
  const isAwarenessOther = selectedAwareness?.is_other === 1 || selectedAwareness?.is_other === true;

  const selectedZone = areaZones.find(a => a.id === form.area_zone_id);
  const isZoneOther = selectedZone?.is_other === 1 || selectedZone?.is_other === true;

  const RadioBtn = ({ label, checked, onClick }) => (
    <button onClick={onClick} type="button" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}>
      <div style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${checked ? C.primary : C.n300}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {checked && <div style={{ width: 10, height: 10, borderRadius: 5, background: C.primary }} />}
      </div>
      <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{label}</span>
    </button>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title={isEdit ? "Edit Konsumen" : "Buat Konsumen Baru"} onBack={handleBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 20 }}>
        <div style={{ background: C.white, borderRadius: isMobile ? 12 : 16, padding: isMobile ? 14 : 20, boxShadow: SHADOW.sm }}>
          <Input label="Nama Konsumen *" value={form.name} onChange={setCap('name', 'title')} placeholder="Nama Lengkap" error={errors.name} />

          {/* Nomor HP +62 prefix */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6 }}>Nomor Handphone</div>
            <div style={{ display: 'flex', borderRadius: 10, border: `1.5px solid ${errors.phone ? C.danger : C.n300}`, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', background: C.n50, fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n700, borderRight: `1.5px solid ${C.n200}`, display: 'flex', alignItems: 'center', flexShrink: 0 }}>+62</div>
              <input
                value={form.phone}
                onChange={(e) => set('phone')(e.target.value.replace(/\D/g, ''))}
                placeholder="857XXXXXXXXX"
                inputMode="tel"
                style={{ flex: 1, padding: '10px 12px', border: 'none', outline: 'none', fontFamily: 'Poppins', fontSize: 14, color: C.n900, background: 'transparent', minWidth: 0 }}
              />
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 4 }}>Untuk kirim nota, pengingat deposit & promo secara otomatis. Wajib diisi jika daftar member.</div>
            {errors.phone && <div style={{ color: C.danger, fontFamily: 'Poppins', fontSize: 11, marginTop: 4 }}>{errors.phone}</div>}
          </div>

          {/* Jenis Kelamin — Radio (opsional) */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6 }}>Jenis Kelamin</div>
            <div style={{ display: 'flex', gap: isMobile ? 12 : 20 }}>
              <RadioBtn label="Laki-laki" checked={form.gender === 'male'} onClick={() => set('gender')('male')} />
              <RadioBtn label="Perempuan" checked={form.gender === 'female'} onClick={() => set('gender')('female')} />
            </div>
          </div>

          <div style={{ height: 1, background: C.n100, margin: '16px 0' }} />

          {/* ─── Data Opsional — collapsible ─── */}
          <button onClick={() => setOptionalOpen(!optionalOpen)} type="button" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
            background: optionalOpen ? `${C.primary}08` : C.n50,
            border: `1.5px solid ${optionalOpen ? `${C.primary}30` : C.n200}`,
            borderRadius: 12, cursor: 'pointer', padding: '12px 14px',
            marginBottom: optionalOpen ? 16 : 0,
            transition: 'all 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: optionalOpen ? `${C.primary}15` : C.n100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'background 0.2s' }}>📝</div>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: optionalOpen ? C.primary : C.n600, textAlign: 'left' }}>Data Opsional</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 1, textAlign: 'left' }}>Instansi, email, tanggal lahir, agama</div>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={optionalOpen ? C.primary : C.n600} strokeWidth="2.5" strokeLinecap="round" style={{ transform: optionalOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
          </button>

          {optionalOpen && (
            <div style={{ background: C.n50, borderRadius: 12, padding: '16px 14px', border: `1px solid ${C.n100}` }}>
              {/* Alamat */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6 }}>Alamat</div>
                <button type="button" onClick={() => {}} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.primary }}>
                  + Tambah Alamat
                </button>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 4 }}>Untuk pengantaran / penjemputan ke lokasi konsumen</div>
              </div>

              {/* Sapaan */}
              <Select label="Sapaan" value={form.greeting} onChange={set('greeting')} options={[{ value: '', label: 'Pilih...' }, { value: 'Pak', label: 'Pak' }, { value: 'Bu', label: 'Bu' }, { value: 'Kak', label: 'Kak' }, { value: 'Mas', label: 'Mas' }, { value: 'Mbak', label: 'Mbak' }]} />

              {/* Instansi */}
              <Input label="Instansi" value={form.instansi} onChange={set('instansi')} placeholder="Instansi Konsumen" />
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: -8, marginBottom: 14 }}>Untuk pengkategorian konsumen berdasarkan instansi-nya</div>

              {/* Email */}
              <Input label="Email" value={form.email} onChange={set('email')} type="email" placeholder="Email konsumen" />
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: -8, marginBottom: 14 }}>Untuk pengiriman promosi melalui email</div>

              {/* Tanggal Lahir */}
              <DateTimeInput label="Tanggal Lahir" value={form.birthDate ? (form.birthDate.includes('T') ? form.birthDate : `${form.birthDate}T00:00:00`) : ''} onChange={(v) => set('birthDate')(v || '')} placeholder="Atur Tanggal" timeOptional />
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: -8, marginBottom: 14 }}>Untuk keperluan promosi atau lainnya</div>

              {/* Agama */}
              <Select label="Agama" value={form.religion} onChange={set('religion')} options={[{ value: '', label: 'Pilih...' }, { value: 'islam', label: 'Islam' }, { value: 'kristen', label: 'Kristen' }, { value: 'katolik', label: 'Katolik' }, { value: 'hindu', label: 'Hindu' }, { value: 'buddha', label: 'Buddha' }, { value: 'konghucu', label: 'Konghucu' }]} />
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: -8, marginBottom: 14 }}>Untuk keperluan promosi atau lainnya</div>
            </div>
          )}

          <div style={{ height: 1, background: C.n100, margin: '16px 0' }} />

          {/* ─── Informasi Pemasaran ─── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.infoBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📣</div>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>Informasi Pemasaran</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>Dari mana customer tahu Waschen</div>
            </div>
          </div>
          
          <div>
            <Select 
              label="Sumber Mengetahui Waschen" 
              value={form.awareness_source_id} 
              onChange={set('awareness_source_id')} 
              options={[
                { value: '', label: 'Pilih Sumber Info...' },
                ...awarenessSources.map(s => ({ value: s.id, label: s.name }))
              ]} 
            />
          </div>

          {isAwarenessOther && (
            <div style={{ marginTop: 10 }}>
              <Input label="Sebutkan Sumber (Lainnya)" value={form.awareness_other_text} onChange={set('awareness_other_text')} placeholder="Tuliskan dari mana Anda tahu..." />
            </div>
          )}

          <div style={{ height: 1, background: C.n100, margin: '16px 0' }} />

          {/* ─── Alamat Lengkap ─── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📍</div>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>Alamat Tempat Tinggal</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>Untuk penjemputan & pengantaran</div>
            </div>
          </div>

          <div>
            <Select 
              label="Pilih Area/Zona Outlet" 
              value={form.area_zone_id} 
              onChange={set('area_zone_id')} 
              options={[
                { value: '', label: 'Pilih Area...' },
                ...areaZones.map(s => ({ value: s.id, label: s.name }))
              ]} 
            />
          </div>

          {isZoneOther && (
            <div style={{ marginTop: 10 }}>
              <Input label="Tulis Area (Lainnya)" value={form.area_zone_other_text} onChange={set('area_zone_other_text')} placeholder="Sebutkan nama desa/kelurahan..." />
            </div>
          )}

          {/* Cascading: Region → Komplek → Blok (searchable + free-text) */}
          <div style={{ marginTop: 6 }}>
            <AddressCascadingPicker
              value={{
                regionId: form.housing_region,
                housing: form.address_housing,
                block: form.address_block,
              }}
              onChange={(next) => {
                markDirty();
                setForm((f) => ({
                  ...f,
                  housing_region: next.regionId ?? f.housing_region,
                  address_housing: next.housing ?? f.address_housing,
                  address_block: next.block ?? f.address_block,
                }));
              }}
            />
          </div>

          <div>
            <Input label="No. Rumah" value={form.address_no} onChange={set('address_no')} placeholder="Contoh: 5" />
          </div>

          <Input label="Detail Alamat Lengkap" value={form.address_detail} onChange={setCap('address_detail', 'sentence')} placeholder="Patokan, RT/RW, gang, dll" />

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

      <div style={{
        padding: '12px 20px',
        background: C.white,
        borderTop: `1px solid ${C.n100}`,
        position: isMobile ? 'sticky' : 'relative',
        bottom: isMobile ? 0 : 'auto',
        left: 0,
        right: 0,
        zIndex: isMobile ? 10 : 'auto',
        boxShadow: isMobile ? '0 -2px 10px rgba(0,0,0,0.1)' : 'none',
      }}>
        <Btn variant="primary" onClick={handleSave} loading={loading} style={{ width: '100%' }}>{isEdit ? "Simpan Perubahan" : "Simpan Data Konsumen"}</Btn>
      </div>

      {/* Unsaved Changes Guard Modal */}
      <Modal visible={exitGuard} onClose={() => setExitGuard(false)} title="Ada Perubahan Belum Disimpan">
        <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n700, lineHeight: 1.6, marginBottom: 20 }}>
          Data-data yang telah diubah <strong>tidak akan disimpan</strong> dan akan <strong>hilang</strong>. Lanjutkan untuk keluar?
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={() => setExitGuard(false)} style={{ flex: 1 }}>Kembali</Btn>
          <Btn variant="secondary" onClick={() => { setExitGuard(false); if (!isEdit) clearDraft(); navigate('customer'); }} style={{ flex: 1, fontWeight: 600 }}>Ya, Tetap Keluar</Btn>
        </div>
      </Modal>
    </div>
  );
}
