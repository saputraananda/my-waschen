// ─────────────────────────────────────────────────────────────────────────────
// EditProfilePage.jsx — Edit User Profile
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { alertError, alertSuccess, alertWarning } from '../utils/alert';
import { compressImage, getCroppedImg } from '../utils/helpers';
import { useResponsive } from '../utils/hooks';
import { TopBar, Btn, Input } from '../components/ui';
import Cropper from 'react-easy-crop';

const THEME = {
  purpleDeep: '#3B0B47',
  purpleMid: '#5C1A6B',
  magenta: '#C0247D',
  bg: '#F3EEF7',
};

export default function EditProfilePage({ navigate, goBack }) {
  const { isMobile } = useResponsive();
  const { user, updateUserProfile } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photo, setPhoto] = useState(user?.photo || null);
  const [saving, setSaving] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const fileRef = useRef();

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImage(file, 1600, 1600, 0.85);
      setCropImageSrc(compressedDataUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropModalOpen(true);
    } catch { alertError('Gagal memproses file gambar ini'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) { alertWarning('Nama tidak boleh kosong'); return; }
    setSaving(true);
    try {
      await axios.patch('/api/users/me/profile', { name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, photo });
      updateUserProfile({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, photo });
      alertSuccess('Profil berhasil disimpan');
      goBack();
    } catch (err) { alertError(err?.response?.data?.message || 'Gagal menyimpan profil'); }
    finally { setSaving(false); }
  };

  const initials = String(name || user?.name || 'US').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: THEME.bg, minHeight: '100vh' }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

      <TopBar title="Edit Profil" onBack={goBack} />

      {/* Avatar Section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobile ? '20px 16px' : '24px 20px' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: isMobile ? 80 : 100, height: isMobile ? 80 : 100, borderRadius: isMobile ? 22 : 28, background: 'linear-gradient(145deg, #F6E4FF 0%, #E4B8F0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: isMobile ? 28 : 32, color: THEME.purpleDeep, boxShadow: '-6px -6px 14px rgba(255,255,255,0.5), 6px 8px 18px rgba(59,11,71,0.25)', overflow: 'hidden' }}>
            {photo || user?.photo ? <img src={photo || user?.photo} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => fileRef.current?.click()} style={{ position: 'absolute', bottom: -4, right: -4, width: isMobile ? 30 : 36, height: isMobile ? 30 : 36, borderRadius: isMobile ? 10 : 12, background: THEME.magenta, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(192,36,125,0.55)', border: `2px solid ${THEME.purpleDeep}`, cursor: 'pointer' }}>
            <svg width={isMobile ? 12 : 14} height={isMobile ? 12 : 14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4Z"/></svg>
          </motion.button>
        </div>
        <p style={{ marginTop: 12, fontSize: isMobile ? 12 : 13, color: '#7A6584' }}>Ketuk untuk ganti foto</p>
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: '0 16px', paddingBottom: isMobile ? 120 : 100 }}>
        <Input label="Nama Lengkap" value={name} onChange={setName} placeholder="Masukkan nama lengkap" />
        <Input label="Nomor HP" value={phone} onChange={setPhone} placeholder="08xxxxxxxxxx" />
        <Input label="Email" value={email} onChange={setEmail} placeholder="nama@email.com" />

        {/* Account Info (read-only) */}
        <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.7)', borderRadius: 16, border: '1px solid rgba(59,11,71,0.08)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#7A6584', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Info Akun</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(59,11,71,0.06)', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#7A6584' }}>Role</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2B1130' }}>{user?.roleCode || 'frontline'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(59,11,71,0.06)', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#7A6584' }}>Outlet</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2B1130' }}>{user?.outlet?.name || '-'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#7A6584' }}>ID User</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2B1130' }}>#{user?.id || '-'}</span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: isMobile ? '12px 16px' : '16px 20px', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.05)', zIndex: 100 }}>
        <Btn variant="primary" fullWidth loading={saving} onClick={handleSaveProfile}>Simpan Perubahan</Btn>
      </div>

      {/* Crop Modal */}
      {cropModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 16, background: '#111', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ color: 'white', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>Sesuaikan Foto Profil</span>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <Cropper image={cropImageSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={(pct, px) => setCroppedAreaPixels(px)} onZoomChange={setZoom} />
          </div>
          <div style={{ padding: 24, background: '#111', display: 'flex', gap: 12 }}>
            <Btn variant="secondary" style={{ flex: 1, background: '#333', color: 'white' }} onClick={() => setCropModalOpen(false)}>Batal</Btn>
            <Btn variant="primary" style={{ flex: 1 }} onClick={async () => { try { const b = await getCroppedImg(cropImageSrc, croppedAreaPixels, 800, 0.8); setPhoto(b); setCropModalOpen(false); } catch { alertError('Gagal memotong foto'); } }}>Terapkan</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
