import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, Input, Btn, Select, Modal, DateTimeInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../utils/hooks';
import AddressCascadingPicker from '../../components/AddressCascadingPicker';

const DRAFT_KEY = 'draft_customer_form';

// Glass styles
const useGlassStyles = () => {
  useEffect(() => {
    const styleId = 'tambah-customer-glass';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        :root { --glass-bg: #F3EEF7; --glass-strong: rgba(255, 255, 255, 0.85); }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
};

// Clay Card component
const ClayCard = ({ children, style, padding = 16 }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    style={{
      background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
      borderRadius: 20,
      padding: padding,
      boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.08)',
      ...style,
    }}
  >
    {children}
  </motion.div>
);

// Clay Icon component
const ClayIcon = ({ icon, color = C.primary, size = 32 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.25,
      background: `linear-gradient(145deg, ${color}15, ${color}05)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: color,
      fontSize: size * 0.45,
      boxShadow: `3px 3px 8px ${color}15, -1px -1px 4px rgba(255, 255, 255, 0.9)`,
    }}
  >
    {icon}
  </div>
);

// Section Title
const SectionTitle = ({ children, icon }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
    {icon && <ClayIcon icon={icon} size={32} color={C.primary} />}
    <span style={{ fontFamily: "'Poppins'", fontSize: 14, fontWeight: 700, color: C.n900 }}>
      {children}
    </span>
  </div>
);

// Divider
const Divider = () => (
  <div style={{ height: 1, background: C.n100, margin: '16px 0' }} />
);

export default function TambahCustomerPage({ navigate, screenParams }) {
  useGlassStyles();
  const { setNotaCustomer } = useApp();
  const { isMobile } = useResponsive();
  const isEdit = !!screenParams?.id;

  // Draft management
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
      // Storage full or unavailable
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
  const draftRestoredShown = useRef(!!draft && !isEdit);

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
        // Silent fail for master data
      }
    };
    fetchMasterData();
  }, []);

  const set = (key) => (v) => {
    markDirty();
    setForm((f) => ({ ...f, [key]: v }));
  };

  // Auto-capitalize untuk field nama & alamat
  const setCap = (key, mode = 'title') => (v) => {
    markDirty();
    let processed = v;
    if (mode === 'title') {
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
    if (!isEdit) clearDraft();
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

    if (Object.keys(errs).length) {
      setErrors(errs);
      alertWarning('Nama dan nomor HP wajib diisi');
      return;
    }

    setLoading(true);
    try {
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
        clearFormAndDraft();
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

  // Radio Button component
  const RadioBtn = ({ label, checked, onClick }) => (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: checked ? `${C.primary}08` : 'transparent',
        border: `1.5px solid ${checked ? C.primary : C.n200}`,
        borderRadius: 12,
        cursor: 'pointer',
        padding: '10px 16px',
        flex: 1,
        transition: 'all 0.2s',
      }}
    >
      <div style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        border: `2px solid ${checked ? C.primary : C.n300}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: checked ? C.primary : 'transparent',
      }}>
        {checked && <div style={{ width: 8, height: 8, borderRadius: 4, background: 'white' }} />}
      </div>
      <span style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: checked ? 600 : 400, color: checked ? C.primary : C.n700 }}>
        {label}
      </span>
    </motion.button>
  );

  // Collapsible Toggle Button
  const CollapsibleToggle = ({ open, onClick, icon, title, subtitle }) => (
    <motion.button
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        background: open ? `${C.primary}08` : C.white,
        border: `1.5px solid ${open ? C.primary + '30' : C.n200}`,
        borderRadius: 14,
        cursor: 'pointer',
        padding: '14px 16px',
        marginBottom: open ? 16 : 0,
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ClayIcon icon={icon} size={36} color={open ? C.primary : C.n500} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 600, color: open ? C.primary : C.n700 }}>
            {title}
          </div>
          <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n500, marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
      </div>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={open ? C.primary : C.n500}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </motion.button>
  );

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--glass-bg)',
      overflow: 'hidden',
    }}>
      <TopBar
        title={isEdit ? "Edit Konsumen" : "Buat Konsumen Baru"}
        onBack={handleBack}
      />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? 12 : 16,
        paddingBottom: isMobile ? 100 : 16,
      }}>
        {/* Main Form Card */}
        <ClayCard padding={isMobile ? 16 : 20} style={{ marginBottom: 12 }}>
          {/* Nama */}
          <Input
            label="Nama Konsumen *"
            value={form.name}
            onChange={setCap('name', 'title')}
            placeholder="Nama Lengkap"
            error={errors.name}
          />

          {/* Nomor HP */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 6 }}>
              Nomor Handphone *
            </div>
            <div style={{
              display: 'flex',
              borderRadius: 12,
              border: `1.5px solid ${errors.phone ? C.danger : C.n200}`,
              overflow: 'hidden',
              background: C.white,
            }}>
              <div style={{
                padding: '10px 14px',
                background: C.n50,
                fontFamily: "'Poppins'",
                fontSize: 14,
                fontWeight: 600,
                color: C.n700,
                borderRight: `1.5px solid ${C.n200}`,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}>
                +62
              </div>
              <input
                value={form.phone}
                onChange={(e) => set('phone')(e.target.value.replace(/\D/g, ''))}
                placeholder="857XXXXXXXXX"
                inputMode="tel"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  border: 'none',
                  outline: 'none',
                  fontFamily: "'Poppins'",
                  fontSize: 14,
                  color: C.n900,
                  background: 'transparent',
                  minWidth: 0,
                }}
              />
            </div>
            {errors.phone && (
              <div style={{ color: C.danger, fontFamily: "'Poppins'", fontSize: 11, marginTop: 4 }}>
                {errors.phone}
              </div>
            )}
            <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n500, marginTop: 4 }}>
              Untuk kirim nota, pengingat deposit & promo secara otomatis
            </div>
          </div>

          {/* Jenis Kelamin */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>
              Jenis Kelamin
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <RadioBtn label="Laki-laki" checked={form.gender === 'male'} onClick={() => set('gender')('male')} />
              <RadioBtn label="Perempuan" checked={form.gender === 'female'} onClick={() => set('gender')('female')} />
            </div>
          </div>

          <Divider />

          {/* Data Opsional */}
          <CollapsibleToggle
            open={optionalOpen}
            onClick={() => setOptionalOpen(!optionalOpen)}
            icon="+"
            title="Data Opsional"
            subtitle="Instansi, email, tanggal lahir, agama"
          />

          <AnimatePresence>
            {optionalOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: C.n50,
                  borderRadius: 14,
                  padding: 16,
                  border: `1px solid ${C.n100}`,
                  marginBottom: 16,
                }}
              >
                {/* Sapaan */}
                <Select
                  label="Sapaan"
                  value={form.greeting}
                  onChange={set('greeting')}
                  options={[
                    { value: '', label: 'Pilih...' },
                    { value: 'Pak', label: 'Pak' },
                    { value: 'Bu', label: 'Bu' },
                    { value: 'Kak', label: 'Kak' },
                    { value: 'Mas', label: 'Mas' },
                    { value: 'Mbak', label: 'Mbak' },
                  ]}
                />

                {/* Instansi */}
                <div style={{ marginTop: 12 }}>
                  <Input
                    label="Instansi"
                    value={form.instansi}
                    onChange={set('instansi')}
                    placeholder="Instansi Konsumen"
                  />
                  <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n500, marginTop: 4 }}>
                    Untuk pengkategorian konsumen berdasarkan instansi
                  </div>
                </div>

                {/* Email */}
                <div style={{ marginTop: 12 }}>
                  <Input
                    label="Email"
                    value={form.email}
                    onChange={set('email')}
                    type="email"
                    placeholder="Email konsumen"
                  />
                  <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n500, marginTop: 4 }}>
                    Untuk pengiriman promosi melalui email
                  </div>
                </div>

                {/* Tanggal Lahir */}
                <div style={{ marginTop: 12 }}>
                  <DateTimeInput
                    label="Tanggal Lahir"
                    value={form.birthDate ? (form.birthDate.includes('T') ? form.birthDate : `${form.birthDate}T00:00:00`) : ''}
                    onChange={(v) => set('birthDate')(v || '')}
                    placeholder="Atur Tanggal"
                    timeOptional
                  />
                  <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n500, marginTop: 4 }}>
                    Untuk keperluan promosi atau lainnya
                  </div>
                </div>

                {/* Agama */}
                <div style={{ marginTop: 12 }}>
                  <Select
                    label="Agama"
                    value={form.religion}
                    onChange={set('religion')}
                    options={[
                      { value: '', label: 'Pilih...' },
                      { value: 'islam', label: 'Islam' },
                      { value: 'kristen', label: 'Kristen' },
                      { value: 'katolik', label: 'Katolik' },
                      { value: 'hindu', label: 'Hindu' },
                      { value: 'buddha', label: 'Buddha' },
                      { value: 'konghucu', label: 'Konghucu' },
                    ]}
                  />
                  <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n500, marginTop: 4 }}>
                    Untuk keperluan promosi atau lainnya
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Divider />

          {/* Informasi Pemasaran */}
          <SectionTitle icon="+">Informasi Pemasaran</SectionTitle>
          <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n500, marginTop: -8, marginBottom: 12 }}>
            Dari mana customer tahu Waschen
          </div>

          <Select
            label="Sumber Mengetahui Waschen"
            value={form.awareness_source_id}
            onChange={set('awareness_source_id')}
            options={[
              { value: '', label: 'Pilih Sumber Info...' },
              ...awarenessSources.map(s => ({ value: s.id, label: s.name }))
            ]}
          />

          {isAwarenessOther && (
            <div style={{ marginTop: 12 }}>
              <Input
                label="Sebutkan Sumber (Lainnya)"
                value={form.awareness_other_text}
                onChange={set('awareness_other_text')}
                placeholder="Tuliskan dari mana Anda tahu..."
              />
            </div>
          )}

          <Divider />

          {/* Alamat Lengkap */}
          <SectionTitle icon="+">Alamat Tempat Tinggal</SectionTitle>
          <div style={{ fontFamily: "'Poppins'", fontSize: 10, color: C.n500, marginTop: -8, marginBottom: 12 }}>
            Untuk penjemputan &amp; pengantaran
          </div>

          <Select
            label="Pilih Area/Zona Outlet"
            value={form.area_zone_id}
            onChange={set('area_zone_id')}
            options={[
              { value: '', label: 'Pilih Area...' },
              ...areaZones.map(s => ({ value: s.id, label: s.name }))
            ]}
          />

          {isZoneOther && (
            <div style={{ marginTop: 12 }}>
              <Input
                label="Tulis Area (Lainnya)"
                value={form.area_zone_other_text}
                onChange={set('area_zone_other_text')}
                placeholder="Sebutkan nama desa/kelurahan..."
              />
            </div>
          )}

          {/* Cascading Address */}
          <div style={{ marginTop: 12 }}>
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

          <div style={{ marginTop: 12 }}>
            <Input
              label="No. Rumah"
              value={form.address_no}
              onChange={set('address_no')}
              placeholder="Contoh: 5"
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <Input
              label="Detail Alamat Lengkap"
              value={form.address_detail}
              onChange={setCap('address_detail', 'sentence')}
              placeholder="Patokan, RT/RW, gang, dll"
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <Input
              label="Catatan Internal (Opsional)"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Contoh: Pelanggan minta cucian dilipat rapi..."
            />
          </div>
        </ClayCard>

        {/* Info Card */}
        {!isEdit && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: `${C.primary}10`,
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              border: `1px solid ${C.primary}20`,
            }}
          >
            <div style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              background: C.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div style={{ fontFamily: "'Poppins'", fontSize: 12, color: C.primary, lineHeight: 1.5 }}>
              Setelah menambahkan customer, Anda bisa langsung membuat nota laundry untuknya.
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom Action */}
      <div style={{
        padding: isMobile ? '12px 16px' : '16px 24px',
        background: C.white,
        borderTop: `1px solid ${C.n200}`,
        boxShadow: isMobile ? '0 -4px 12px rgba(0,0,0,0.1)' : 'none',
      }}>
        <motion.button
          whileHover={{ scale: loading ? 1 : 1.01 }}
          whileTap={{ scale: loading ? 1 : 0.98 }}
          onClick={handleSave}
          disabled={loading}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 14,
            border: 'none',
            background: loading
              ? C.n300
              : 'linear-gradient(145deg, #6B2D7E, #4A1A59)',
            color: 'white',
            fontFamily: "'Poppins'",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading
              ? 'none'
              : '-4px -4px 10px rgba(255, 255, 255, 0.4), 5px 6px 14px rgba(59, 11, 71, 0.35)',
          }}
        >
          {loading ? 'Memproses...' : (isEdit ? "Simpan Perubahan" : "Simpan Data Konsumen")}
        </motion.button>
      </div>

      {/* Unsaved Changes Guard Modal */}
      <AnimatePresence>
        {exitGuard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExitGuard(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 500, // GlassModal level
              padding: 16,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: C.white,
                borderRadius: 20,
                padding: 24,
                maxWidth: 340,
                width: '100%',
              }}
            >
              <div style={{
                fontFamily: "'Poppins'",
                fontSize: 16,
                fontWeight: 700,
                color: C.n900,
                marginBottom: 8,
              }}>
                Ada Perubahan Belum Disimpan
              </div>
              <div style={{
                fontFamily: "'Poppins'",
                fontSize: 13,
                color: C.n600,
                marginBottom: 20,
                lineHeight: 1.6,
              }}>
                Data yang telah diubah <strong>tidak akan disimpan</strong> dan akan <strong>hilang</strong>. Lanjutkan untuk keluar?
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setExitGuard(false)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    border: `1.5px solid ${C.n200}`,
                    background: C.white,
                    fontFamily: "'Poppins'",
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.n700,
                    cursor: 'pointer',
                  }}
                >
                  Kembali
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setExitGuard(false);
                    if (!isEdit) clearDraft();
                    navigate('customer');
                  }}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    border: 'none',
                    background: C.primary,
                    fontFamily: "'Poppins'",
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Ya, Tetap Keluar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
