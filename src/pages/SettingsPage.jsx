// ─────────────────────────────────────────────────────────────────────────────
// SettingsPage.jsx — Settings Page with Premium Glassmorphism UI
// Design: Header with Cosmic Gradient → Floating Shift Card → Menu List
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useResponsive } from '../utils/hooks';
import { useApp } from '../context/AppContext';
import { ProfileAvatar } from '../components/ui';
import {
  Printer, Home, Bell, Users, HelpCircle, Lock, LogOut,
  Plus, Square, ChevronRight, Clock, Building
} from 'lucide-react';

// ─── Token Colors ───────────────────────────────────────────────────────────────
const tokens = {
  purpleDeep: '#3B0B47',
  purpleMid: '#5C1A6B',
  magenta: '#C0247D',
  mint: '#5FD9AE',
  mintDeep: '#1F9E75',
  coral: '#F0466B',
  bg: '#F3EEF7',
  ink: '#2B1130',
  inkSoft: '#7A6584',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const ROLE_LABEL = {
  admin: 'Admin',
  kasir: 'Frontliner',
  frontline: 'Frontliner',
  produksi: 'Produksi',
  finance: 'Finance'
};

const formatShiftDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', '');
};

// ─── Clay Button Component ────────────────────────────────────────────────────
function ClayButton({ icon, label, subLabel, variant = 'success', onClick, disabled = false }) {
  const isSuccess = variant === 'success';
  const colors = isSuccess
    ? { bg: 'linear-gradient(150deg, #7DEFC4 0%, #45C593 100%)', text: '#063D2B', shadow: 'rgba(31,158,117,0.45)' }
    : { bg: 'linear-gradient(150deg, #FF7D93 0%, #E23A5C 100%)', text: '#4E020F', shadow: 'rgba(184,40,72,0.45)' };

  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      whileTap={disabled ? {} : { translateY: 2, scale: 0.98 }}
      style={{
        flex: 1,
        border: 'none',
        borderRadius: 18,
        padding: '14px 10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled
          ? 'linear-gradient(150deg, #E8E8ED, #D8D8DD)'
          : colors.bg,
        color: disabled ? '#888' : colors.text,
        boxShadow: disabled
          ? 'none'
          : `-5px -5px 12px rgba(255,255,255,0.55), 6px 8px 16px ${colors.shadow}, inset 0 1px 1px rgba(255,255,255,0.4)`,
        opacity: disabled ? 0.7 : 1,
        position: 'relative',
      }}
    >
      {variant === 'danger' && !disabled && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: '#10B981',
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <span style={{ fontSize: 10 }}>•</span> Buka
        </div>
      )}
      <div style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        background: disabled ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: disabled ? '#aaa' : colors.text,
      }}>
        {icon}
      </div>
      <div style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 13,
        fontWeight: 700,
        color: disabled ? '#888' : colors.text,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 9.5,
        opacity: 0.85,
        fontWeight: 500,
        color: disabled ? '#aaa' : colors.text,
      }}>
        {subLabel}
      </div>
    </motion.button>
  );
}

// ─── Logout Confirmation Modal ────────────────────────────────────────────────
function LogoutModal({ onClose, onConfirm }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9500, // ConfirmDialog level — above Select (9000), below Toast (9800)
        padding: 16,
      }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 24 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 24,
          padding: 28,
          width: '100%',
          maxWidth: 320,
          textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.08)',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(145deg, #FFE5EA, #FFDCE3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 8px 20px rgba(222,50,85,0.18)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DE3255" strokeWidth="2.2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>

        {/* Text */}
        <h3 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 22,
          fontWeight: 700,
          color: '#2B1130',
          margin: '0 0 10px',
          letterSpacing: 0.1,
        }}>
          Keluar Aplikasi?
        </h3>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 13.5,
          color: '#7A6584',
          margin: '0 0 28px',
          lineHeight: 1.6,
        }}>
          Kamu yakin ingin keluar dari aplikasi ini.
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.97 }}
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: 14,
              background: 'linear-gradient(150deg, #F5F5FA, #EEEEF5)',
              border: 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 13.5,
              fontWeight: 700,
              color: '#2B1130',
              cursor: 'pointer',
              boxShadow: '-3px -3px 8px rgba(255,255,255,0.7), 3px 4px 10px rgba(59,11,71,0.08)',
            }}
          >
            Batal
          </motion.button>
          <motion.button
            onClick={onConfirm}
            whileTap={{ scale: 0.97 }}
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: 14,
              background: 'linear-gradient(150deg, #FF8B9E, #DE3255)',
              border: 'none',
              color: '#fff',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '-3px -3px 8px rgba(255,255,255,0.25), 4px 8px 20px rgba(222,50,85,0.38)',
            }}
          >
            Ya, Keluar
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Menu Item Component ──────────────────────────────────────────────────────
function MenuItem({ icon, label, badge, onClick, chevron = true }) {
  const icons = {
    printer: <Printer size={16} />,
    building: <Home size={16} />,
    bell: <Bell size={16} />,
    users: <Users size={16} />,
    help: <HelpCircle size={16} />,
    lock: <Lock size={16} />,
    chevron: <ChevronRight size={16} />,
  };

  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 14px',
        cursor: onClick ? 'pointer' : 'default',
        borderBottom: '1px solid rgba(59, 11, 71, 0.06)',
      }}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 13,
        background: 'linear-gradient(145deg, #F5E9FB, #E9D3F2)',
        boxShadow: '-2px -2px 5px rgba(255, 255, 255, 0.7), 2px 3px 7px rgba(59, 11, 71, 0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6B2D7D',
        flexShrink: 0,
      }}>
        {icons[icon]}
      </div>
      <div style={{
        flex: 1,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 13.5,
        fontWeight: 600,
        color: '#2B1130',
      }}>
        {label}
      </div>
      {badge && (
        <div style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 10,
          fontWeight: 700,
          color: '#1F9E75',
          background: 'rgba(95, 217, 174, 0.18)',
          padding: '3px 9px',
          borderRadius: 999,
          marginRight: 6,
        }}>
          {badge}
        </div>
      )}
      {chevron && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A6584" strokeWidth="2" style={{ opacity: 0.5 }}>
          <path d="M9 6l6 6-6 6"/>
        </svg>
      )}
    </motion.div>
  );
}

// ─── Main Settings Page Component ─────────────────────────────────────────────
export default function SettingsPage({ navigate }) {
  const { isMobile } = useResponsive();
  const { user, handleLogout } = useApp();
  const [currentShift, setCurrentShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const role = user?.role;
  const isAdmin = (user?.originalRoleCode ?? user?.roleCode) === 'admin';

  // Fetch current shift status
  useEffect(() => {
    const fetchShift = async () => {
      setLoadingShift(true);
      try {
        const res = await axios.get('/api/shifts/status');
        setCurrentShift(res.data);
      } catch {
        setCurrentShift(null);
      } finally {
        setLoadingShift(false);
      }
    };
    if (role === 'frontline') {
      fetchShift();
    }
  }, [role]);

  const shiftOpen = currentShift?.isOpen || currentShift?.bypass;

  const openLogoutConfirm = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    handleLogout();
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#F3EEF7',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ── HEADER - Premium Cosmic Theme ── */}
      <div style={{
        background: `
          radial-gradient(circle at 85% -10%, rgba(232,90,168,0.55) 0%, transparent 55%),
          radial-gradient(circle at -10% 20%, rgba(95,217,174,0.25) 0%, transparent 45%),
          linear-gradient(155deg, #3B0B47 0%, #5C1A6B 55%, #4A1259 100%)
        `,
        padding: '26px 20px 90px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background blobs */}
        <div style={{
          position: 'absolute',
          width: 260, height: 260,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          top: -120, right: -80,
          filter: 'blur(2px)',
          animation: 'floatA 14s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          width: 180, height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,90,168,0.55) 0%, transparent 70%)',
          top: -60, right: -40,
          filter: 'blur(18px)',
          animation: 'floatB 11s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          width: 150, height: 150,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(95,217,174,0.35) 0%, transparent 70%)',
          bottom: 20, left: -50,
          filter: 'blur(18px)',
          animation: 'floatC 16s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          width: 90, height: 90,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)',
          top: 40, left: '55%',
          filter: 'blur(18px)',
          animation: 'floatA 9s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* Sparkles */}
        <div className="sparkle" style={{ width: 14, top: 24, right: 70, animationDelay: '0s' }}>
          <svg viewBox="0 0 24 24"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg>
        </div>
        <div className="sparkle" style={{ width: 8, top: 60, right: 30, animationDelay: '1.1s' }}>
          <svg viewBox="0 0 24 24"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg>
        </div>
        <div className="sparkle" style={{ width: 10, top: 15, left: '30%', animationDelay: '2s' }}>
          <svg viewBox="0 0 24 24"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg>
        </div>
        <div className="sparkle" style={{ width: 6, bottom: 40, left: '15%', animationDelay: '0.6s' }}>
          <svg viewBox="0 0 24 24"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg>
        </div>
        <div className="sparkle" style={{ width: 9, top: 90, right: 110, animationDelay: '1.7s' }}>
          <svg viewBox="0 0 24 24"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg>
        </div>

        {/* Header Top Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 5,
          marginBottom: 22,
        }}>
          <div>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.65)',
              fontWeight: 500,
              letterSpacing: 0.2,
            }}>
              Selamat bekerja
              <div style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 700,
                fontSize: 16,
                marginTop: 2,
                color: '#fff',
              }}>
                {ROLE_LABEL[role] || 'User'}
              </div>
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(95,217,174,0.18)',
            border: '1px solid rgba(95,217,174,0.4)',
            backdropFilter: 'blur(6px)',
            padding: '6px 12px 6px 10px',
            borderRadius: 999,
          }}>
            <div style={{
              width: 7, height: 7,
              borderRadius: '50%',
              background: '#5FD9AE',
              boxShadow: '0 0 8px #5FD9AE',
            }} />
            <span style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 11.5,
              fontWeight: 600,
              color: '#BEFCE3',
            }}>
              Aktif
            </span>
          </div>
        </div>

        {/* User Info Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          position: 'relative',
          zIndex: 5,
        }}>
          {/* Avatar */}
          <div style={{
            position: 'relative',
            width: 68, height: 68,
            flexShrink: 0,
          }}>
            <div style={{
              width: 68, height: 68,
              borderRadius: 26,
              overflow: 'hidden',
              boxShadow: '-6px -6px 14px rgba(255,255,255,0.5), 6px 8px 18px rgba(20,4,26,0.45), inset 0 0 0 1px rgba(255,255,255,0.4)',
            }}>
              {user?.photo ? (
                <img src={user.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <ProfileAvatar user={user} size={68} showBorder={false} />
              )}
            </div>
          </div>

          {/* User Details */}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700,
              fontSize: 19,
              color: '#fff',
              letterSpacing: 0.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user?.name || 'Pengguna'}
            </div>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 12,
              color: 'rgba(255,255,255,0.6)',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user?.outlet?.name || 'Waschen Laundry'}
            </div>
            <div style={{
              display: 'flex',
              gap: 6,
              marginTop: 9,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <div style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: '#F0DFFF',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.18)',
                padding: '4px 12px',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                lineHeight: 1.2,
              }}>
                {ROLE_LABEL[role] || role?.toUpperCase()}
              </div>
              <motion.button
                onClick={() => navigate('profil')}
                whileTap={{ scale: 0.95 }}
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: '#fff',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.35)',
                  padding: '4px 10px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Lihat profil
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                  <path d="M9 6l6 6-6 6"/>
                </svg>
              </motion.button>
            </div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes floatA {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(-14px, 16px) scale(1.08); }
          }
          @keyframes floatB {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(18px, -12px) scale(1.1); }
          }
          @keyframes floatC {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(16px, 10px) scale(0.95); }
          }
          .sparkle {
            position: absolute;
            pointer-events: none;
            animation: twinkle 3.2s ease-in-out infinite;
          }
          .sparkle svg {
            width: 100%;
            height: 100%;
            fill: #fff;
            filter: drop-shadow(0 0 4px rgba(255,255,255,0.9));
          }
          @keyframes twinkle {
            0%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); }
            50% { opacity: 1; transform: scale(1) rotate(20deg); }
          }
          @media (prefers-reduced-motion: reduce) {
            .sparkle { animation: none; opacity: 0.6; }
          }
        `}} />
      </div>

      {/* ── CONTENT - Scrollable ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px 120px',
        marginTop: -64,
        position: 'relative',
        zIndex: 10,
      }}>
        {/* ── FLOATING SHIFT CARD (only for kasir/frontline) ── */}
        {(role === 'frontline') && (
          <div style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(18px) saturate(160%)',
            WebkitBackdropFilter: 'blur(18px) saturate(160%)',
            border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: 26,
            padding: '18px 18px 20px',
            marginBottom: 18,
            boxShadow: '0 20px 40px -12px rgba(59,11,71,0.28), 0 2px 6px rgba(59,11,71,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 14,
            }}>
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  color: '#7A6584',
                  textTransform: 'uppercase',
                }}>
                  <div style={{
                    width: 20, height: 20,
                    borderRadius: 8,
                    background: 'linear-gradient(145deg, #F0DFFF, #E0C4F2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '-2px -2px 4px rgba(255,255,255,0.7), 2px 2px 5px rgba(59,11,71,0.15)',
                  }}>
                    <Clock size={11} color="#6B2B7D" />
                  </div>
                  Shift kasir
                </div>
                <div style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: '#2B1130',
                  marginTop: 6,
                }}>
                  {loadingShift ? 'Memuat...' : shiftOpen ? 'Shift sedang aktif' : 'Shift belum aktif'}
                </div>
                <div style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 11.5,
                  color: '#7A6584',
                  marginTop: 3,
                }}>
                  Dibuka <span style={{ color: '#1F9E75', fontWeight: 700 }}>
                    {currentShift?.session?.openedAt ? formatShiftDate(currentShift.session.openedAt) : '—'}
                  </span>
                </div>
              </div>
              <div style={{
                background: loadingShift ? '#E8E8ED' : 'linear-gradient(145deg, #7EE8C4, #4FCB9E)',
                color: '#08402D',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 10.5,
                fontWeight: 800,
                padding: '5px 12px',
                borderRadius: 999,
                boxShadow: loadingShift ? 'none' : '-2px -2px 5px rgba(255,255,255,0.5), 2px 3px 8px rgba(31,158,117,0.4)',
              }}>
                ● {loadingShift ? '...' : shiftOpen ? 'Buka' : 'Tutup'}
              </div>
            </div>

            {/* Shift Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <ClayButton
                icon={<Plus size={15} />}
                label="Buka shift"
                subLabel="Mulai transaksi"
                variant="success"
                onClick={() => navigate('buka_shift')}
                disabled={shiftOpen}
              />
              <ClayButton
                icon={<Square size={15} />}
                label="Tutup shift"
                subLabel="Akhiri sesi"
                variant="danger"
                onClick={() => navigate('tutup_shift')}
                disabled={!shiftOpen}
              />
            </div>
          </div>
        )}

        {/* ── MENU CARD ── */}
        <div style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.6)',
          borderRadius: 24,
          padding: '6px 6px',
          marginBottom: 18,
          boxShadow: '0 14px 30px -12px rgba(59,11,71,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
        }}>
          {/* Profil Saya - First item with magenta accent */}
          <div
            onClick={() => navigate('profil')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 14px',
              cursor: 'pointer',
              borderBottom: '1px solid rgba(59, 11, 71, 0.06)',
            }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 13,
              background: 'linear-gradient(145deg, #FCE7EF, #F8BBD9)',
              boxShadow: '-2px -2px 5px rgba(255, 255, 255, 0.7), 2px 3px 7px rgba(192, 36, 125, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#C0247D',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M5 20c0-3.314 3.134-6 7-6s7 2.686 7 6" />
              </svg>
            </div>
            <div style={{
              flex: 1,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 13.5,
              fontWeight: 600,
              color: '#2B1130',
            }}>
              Profil Saya
            </div>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 12,
              color: '#7A6584',
            }}>
              Lihat dan edit profil
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A6584" strokeWidth="2" style={{ opacity: 0.5 }}>
              <path d="M9 6l6 6-6 6"/>
            </svg>
          </div>

          <MenuItem
            icon="printer"
            label="Pengaturan printer"
            onClick={() => navigate('printer_settings')}
          />
          <MenuItem
            icon="building"
            label="Info outlet"
            badge="● Aktif"
            onClick={() => navigate('info_outlet', { outletId: user?.outletId })}
          />
          <MenuItem
            icon="bell"
            label="Notifikasi"
            onClick={() => navigate('notifikasi')}
          />
          <MenuItem
            icon="users"
            label="Daftar member"
            onClick={() => navigate('customer')}
          />
          <MenuItem
            icon="help"
            label="Bantuan"
            onClick={() => navigate('bantuan')}
          />
          <MenuItem
            icon="lock"
            label="Kebijakan privasi"
            onClick={() => navigate('kebijakan_privasi')}
          />
        </div>

        {/* ── ADMIN ROLE SWITCHER ── */}
        {isAdmin && (
          <div style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: 24,
            padding: 16,
            marginBottom: 18,
            boxShadow: '0 14px 30px -12px rgba(59,11,71,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
          }}>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: '#7A6584',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 14,
            }}>
              Ganti Tampilan Role
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
            }}>
              {[
                { id: 'frontline', label: 'Frontliner' },
                { id: 'produksi', label: 'Produksi' },
                { id: 'admin', label: 'Admin' },
              ].map((r) => (
                <motion.button
                  key={r.id}
                  onClick={() => navigate('dashboard', { role: r.id })}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    padding: '12px 4px',
                    borderRadius: 12,
                    border: role === r.id ? '2px solid #5B005F' : '2px solid #E6D9E7',
                    background: role === r.id ? '#E6D9E7' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 20 }}>
                    {r.id === 'frontline' ? '🧾' : r.id === 'produksi' ? '🧺' : r.id === 'admin' ? '👑' : '💰'}
                  </span>
                  <span style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 10,
                    fontWeight: role === r.id ? 700 : 500,
                    color: role === r.id ? '#5B005F' : '#5a5a5a',
                  }}>
                    {r.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ── LOGOUT BUTTON ── */}
        <motion.button
          onClick={openLogoutConfirm}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%',
            background: 'linear-gradient(150deg, #FF8B9E 0%, #DE3255 100%)',
            color: '#fff',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            textAlign: 'center',
            padding: 15,
            borderRadius: 20,
            border: 'none',
            boxShadow: '-5px -5px 12px rgba(255,255,255,0.3), 6px 10px 20px rgba(184,40,72,0.4)',
            marginTop: 16,
            cursor: 'pointer',
            letterSpacing: 0.2,
          }}
        >
          Keluar
        </motion.button>

        {/* ── FOOTER NOTE ── */}
        <div style={{
          textAlign: 'center',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 10.5,
          color: '#7A6584',
          marginTop: 16,
          opacity: 0.7,
        }}>
          Waschen v1.0.0 • PT Waschen Alora Indonesia
        </div>
      </div>

      {/* ── LOGOUT CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <LogoutModal onClose={() => setShowLogoutConfirm(false)} onConfirm={confirmLogout} />
        )}
      </AnimatePresence>
    </div>
  );
}
