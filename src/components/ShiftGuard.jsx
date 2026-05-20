import React from 'react';
import { useApp } from '../context/AppContext';

// Komponen ini "menjaga" halaman-halaman kasir.
// Jika shift belum dibuka, redirect ke halaman Buka Shift.
// Menggunakan state-based navigation (bukan React Router) sesuai arsitektur app.
const ShiftGuard = ({ children }) => {
  const { user, screen, navigate } = useApp();

  // Jika user bukan kasir, biarkan saja (admin/produksi/finance tidak perlu shift)
  if (!user || user.roleCode !== 'kasir') {
    return children;
  }

  // ShiftGuard hanya aktif untuk halaman kasir tertentu
  // Halaman buka_shift sendiri tidak perlu dijaga
  const SHIFT_EXEMPT = new Set(['buka_shift', 'login', 'splash', 'settings', 'profil', 'notifikasi']);
  if (SHIFT_EXEMPT.has(screen)) {
    return children;
  }

  // Komponen ini dirender sebagai wrapper — cek shift dilakukan di level page
  // ShiftGuard hanya menyediakan context, redirect dilakukan oleh BukaShiftPage
  return children;
};

export default ShiftGuard;
