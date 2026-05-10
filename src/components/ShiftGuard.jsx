import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

// Komponen ini "menjaga" route-route kasir.
// Jika shift belum dibuka, paksa redirect ke halaman Buka Shift.
const ShiftGuard = ({ children }) => {
  const { activeShift, shiftLoading, user } = useContext(AppContext);
  const location = useLocation();

  // Jika masih loading, tampilkan spinner atau halaman kosong
  if (shiftLoading || !user) {
    return <div>Loading...</div>; // Ganti dengan komponen loading yang lebih baik
  }

  // Jika user bukan kasir, biarkan saja
  if (user.roleCode !== 'kasir') {
    return children;
  }

  // Jika shift belum aktif dan user mencoba akses halaman selain buka shift
  if (!activeShift && location.pathname !== '/kasir/buka-shift') {
    return <Navigate to="/kasir/buka-shift" state={{ from: location }} replace />;
  }

  // Jika shift sudah aktif tapi user mencoba akses halaman buka shift, redirect ke dashboard
  if (activeShift && location.pathname === '/kasir/buka-shift') {
    return <Navigate to="/kasir/dashboard" replace />;
  }

  return children;
};

export default ShiftGuard;
