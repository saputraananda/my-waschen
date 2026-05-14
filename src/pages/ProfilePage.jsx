import { useState, useRef } from 'react';
import axios from 'axios';
import Cropper from 'react-easy-crop';
import { C } from '../utils/theme';
import { compressImage, getCroppedImg } from '../utils/helpers';
import { TopBar, Btn, Input } from '../components/ui';
import { useApp } from '../context/AppContext';

const ROLE_LABEL = { admin: 'Admin', kasir: 'Kasir', produksi: 'Produksi', finance: 'Finance' };

export default function ProfilePage({ navigate, goBack }) {
  const { user, updateUserProfile, handleSwitchRole } = useApp();
  const isAdmin = (user?.originalRoleCode ?? user?.roleCode) === 'admin';

  const ROLES = [
    { id: 'kasir',    label: 'Kasir',    icon: '🧾' },
    { id: 'produksi', label: 'Produksi', icon: '🧺' },
    { id: 'admin',    label: 'Admin',    icon: '👑' },
    { id: 'finance',  label: 'Finance',  icon: '💰' },
  ];

  const [name, setName]   = useState(user?.name  || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photo, setPhoto] = useState(user?.photo || null);

  const [oldPw, setOldPw]     = useState('');
  const [newPw, setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]   = useState(false);

  const [saving, setSaving]   = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [toast, setToast]     = useState({ visible: false, msg: '', type: 'success' });
  const fileRef = useRef();

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ visible: true, msg, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast('Menyiapkan gambar...', 'success');
      // Compress sedikit sebelum masuk ke cropper untuk mencegah lag browser
      const compressedDataUrl = await compressImage(file, 1600, 1600, 0.85);
      setCropImageSrc(compressedDataUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropModalOpen(true);
    } catch (error) {
      showToast('Gagal memproses file gambar ini', 'error');
    }
    
    if (fileRef.current) fileRef.current.value = '';
  };

  const initials = (name || user?.name || 'US')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const handleSaveProfile = async () => {
    if (!name.trim()) { showToast('Nama tidak boleh kosong', 'error'); return; }
    setSaving(true);
    try {
      await axios.patch('/api/users/me/profile', {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        photo,
      });
      updateUserProfile({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, photo });
      showToast('Profil berhasil disimpan');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal menyimpan profil', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw) { showToast('Password lama dan baru wajib diisi', 'error'); return; }
    if (newPw !== confirmPw) { showToast('Konfirmasi password tidak cocok', 'error'); return; }
    if (newPw.length < 6) { showToast('Password baru minimal 6 karakter', 'error'); return; }
    setPwLoading(true);
    try {
      await axios.patch('/api/users/me/password', { oldPassword: oldPw, newPassword: newPw });
      showToast('Password berhasil diubah');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal mengubah password', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Profil Saya" onBack={goBack} />

      {/* Toast */}
      {toast.visible && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1300, background: toast.type === 'success' ? '#DCFCE7' : '#FEE2E2', color: toast.type === 'success' ? '#166534' : '#991B1B', padding: '12px 20px', borderRadius: 12, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', whiteSpace: 'nowrap' }}>
          {toast.type === 'success' ? '✓' : '⚠'} {toast.msg}
        </div>
      )}

      {cropModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', background: '#111', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ color: 'white', fontFamily: 'Poppins', fontWeight: 600 }}>Sesuaikan Foto Profil</span>
          </div>
          
          <div style={{ flex: 1, position: 'relative' }}>
            <Cropper
              image={cropImageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={(pct, pixels) => setCroppedAreaPixels(pixels)}
              onZoomChange={setZoom}
            />
          </div>
          
          <div style={{ padding: '24px 20px', background: '#111', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 16 }}>➖</span>
              <input 
                type="range" 
                value={zoom} 
                min={1} 
                max={3} 
                step={0.1} 
                aria-labelledby="Zoom" 
                onChange={(e) => setZoom(Number(e.target.value))} 
                style={{ flex: 1, accentColor: C.primary }} 
              />
              <span style={{ fontSize: 16 }}>➕</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Btn variant="secondary" style={{ flex: 1, background: '#333', color: 'white', borderColor: '#444' }} onClick={() => setCropModalOpen(false)}>Batal</Btn>
              <Btn variant="primary" style={{ flex: 1 }} onClick={async () => {
                try {
                  const croppedBase64 = await getCroppedImg(cropImageSrc, croppedAreaPixels, 800, 0.8);
                  setPhoto(croppedBase64);
                  setCropModalOpen(false);
                } catch (err) {
                  showToast('Gagal memotong foto', 'error');
                }
              }}>Terapkan</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 32 }}>

        {/* Foto Profil */}
        <div style={{ background: C.white, borderRadius: 16, padding: '24px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            {photo ? (
              <img
                src={photo} alt="avatar"
                style={{ width: 96, height: 96, borderRadius: 48, objectFit: 'cover', border: `3px solid ${C.primary}` }}
              />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: 48, background: `linear-gradient(135deg, ${C.primaryLight}, ${C.secondary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 32, fontWeight: 700, color: C.primary }}>{initials}</span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              style={{ position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, background: C.primary, border: '2.5px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 17, fontWeight: 700, color: C.n900 }}>{user?.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ background: C.primaryLight, color: C.primary, fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999 }}>
                {ROLE_LABEL[user?.roleCode] || user?.roleCode?.toUpperCase()}
              </span>
              {user?.outlet?.name && (
                <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{user.outlet.name}</span>
              )}
            </div>
          </div>

          {photo && (
            <button
              onClick={() => setPhoto(null)}
              style={{ fontFamily: 'Poppins', fontSize: 12, color: C.danger, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
            >
              Hapus foto
            </button>
          )}
        </div>

        {/* Informasi Akun */}
        <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: 0.5, marginBottom: 14 }}>INFORMASI AKUN</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="Nama Lengkap" value={name} onChange={setName} placeholder="Masukkan nama lengkap" />
            <Input label="Nomor HP" value={phone} onChange={setPhone} placeholder="08xxxxxxxxxx" />
            <Input label="Email" value={email} onChange={setEmail} placeholder="nama@email.com" />
          </div>
          <div style={{ marginTop: 16 }}>
            <Btn variant="primary" fullWidth loading={saving} onClick={handleSaveProfile}>Simpan Profil</Btn>
          </div>
        </div>

        {/* Info readonly */}
        <div style={{ background: C.white, borderRadius: 16, padding: '12px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: 0.5, marginBottom: 10 }}>INFO TIDAK BISA DIUBAH</div>
          {[
            { label: 'Username',  value: user?.username || '-' },
            { label: 'Role',      value: ROLE_LABEL[user?.roleCode] || user?.roleCode || '-' },
            { label: 'Outlet',    value: user?.outlet?.name || '-' },
          ].map((item, i, arr) => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>{item.label}</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Switch Role — hanya admin */}
        {isAdmin && (
          <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: 0.5, marginBottom: 14 }}>TAMPIL SEBAGAI ROLE</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { handleSwitchRole(r.id); navigate('dashboard'); }}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    padding: '12px 4px', borderRadius: 12, cursor: 'pointer',
                    border: `1.5px solid ${user?.role === r.id ? C.primary : C.n100}`,
                    background: user?.role === r.id ? C.primaryLight : C.n50,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{r.icon}</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: user?.role === r.id ? 700 : 400, color: user?.role === r.id ? C.primary : C.n600 }}>
                    {r.label}
                  </span>
                  {user?.role === r.id && (
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: C.primary, display: 'block' }} />
                  )}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 10, textAlign: 'center' }}>
              Akun tetap sebagai Admin · hanya tampilan yang berubah
            </div>
          </div>
        )}

        {/* Ubah Password */}
        <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 8, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPw ? 14 : 0 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: 0.5 }}>UBAH PASSWORD</div>
            <button
              onClick={() => setShowPw((v) => !v)}
              style={{ fontFamily: 'Poppins', fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              {showPw ? 'Tutup' : 'Ubah'}
            </button>
          </div>

          {showPw && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Input label="Password Lama" value={oldPw} onChange={setOldPw} type="password" placeholder="••••••••" />
                <Input label="Password Baru" value={newPw} onChange={setNewPw} type="password" placeholder="Min. 6 karakter" />
                <Input label="Konfirmasi Password Baru" value={confirmPw} onChange={setConfirmPw} type="password" placeholder="Ulangi password baru" />
              </div>
              <div style={{ marginTop: 16 }}>
                <Btn variant="secondary" fullWidth loading={pwLoading} onClick={handleChangePassword}>
                  Konfirmasi Ubah Password
                </Btn>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
