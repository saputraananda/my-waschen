// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ProfilePage.jsx â€” Redesigned with 2-Column Asymmetric Layout
// Ref: My_Waschen_Redesign_Spec_dan_Prompt.md Section 4.4
//
// Layout:
// - Left column (35%): Sticky - Avatar, Name, Role, Outlet, Actions
// - Right column (65%): Scrollable - Stats, Shift History, Activity Log
// - Mobile: Left collapses to header, right becomes full-width
//
// Phase 4 Polish: Framer Motion animations, count-up stats, hover effects
// Phase 7: Responsive QA at 4 breakpoints
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { useState, useRef, useMemo, useEffect } from 'react';
import axios from 'axios';
import Cropper from 'react-easy-crop';
import { motion } from 'framer-motion';
import { C, T } from '../utils/theme';
import { rp } from '../utils/helpers';
import { compressImage, getCroppedImg } from '../utils/helpers';
import { TopBar, Btn, Input } from '../components/ui';
import { alertError, alertInfo, alertSuccess, alertWarning } from '../utils/alert';
import { useApp } from '../context/AppContext';

// â”€â”€â”€ Premium Animation Assets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import bubbleIcon from '../assets/Decorative icon/bubble-1.webp'
import bubble2Icon from '../assets/Decorative icon/bubble-2.webp'
import soapBubble from '../assets/Decorative icon/soap-bubble.webp'

// â”€â”€â”€ Premium Animation Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FloatingBubble = ({ src, size, top, left, right, bottom, delay = 0, duration = 5, opacity = 0.4 }) => (
  <motion.div
    animate={{ y: [0, -15, 0], scale: [1, 1.08, 1], opacity: [opacity * 0.6, opacity, opacity * 0.6] }}
    transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    style={{ position: 'absolute', top, left, right, bottom, width: size, height: size, pointerEvents: 'none', zIndex: 0 }}
  >
    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.08))' }} loading="lazy" />
  </motion.div>
);

const Sparkle = ({ top, left, size = 5, delay = 0 }) => (
  <motion.div
    style={{ position: 'absolute', top, left, width: size, height: size, background: '#E85D04', borderRadius: '50%', boxShadow: `0 0 ${size}px #E85D04`, pointerEvents: 'none', zIndex: 1 }}
    animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 180, 360] }}
    transition={{ duration: 2, delay, repeat: Infinity, ease: 'easeOut' }}
  />
);

const ROLE_LABEL = { admin: 'Admin', kasir: 'Frontline', frontline: 'Frontline', produksi: 'Produksi', finance: 'Finance' };

// â”€â”€â”€ Avatar Images â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import staffGirl from '../assets/Avatar set/staff-girl.webp'
import staffBoy from '../assets/Avatar set/staff-boy.webp'
import adminLaptop from '../assets/Avatar set/admin-laptop.webp'

const getAvatarSource = (user) => {
  const role = user?.roleCode || user?.originalRoleCode;
  const gender = user?.gender?.toLowerCase();
  if (role === 'admin') return adminLaptop;
  if (role === 'frontline' || role === 'kasir') return gender === 'male' ? staffBoy : staffGirl;
  return gender === 'male' ? staffBoy : staffGirl;
};

// â”€â”€â”€ Count-up Animation Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function useCountUp(target, duration = 700, delay = 0) {
  const [value, setValue] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    const timeout = setTimeout(() => {
      hasAnimated.current = true;
      const startTime = performance.now();
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * easeOut));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);

  return value;
}

// â”€â”€â”€ Animated Number Display â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AnimatedNumber({ value, prefix = '', suffix = '', duration = 700, delay = 0 }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0, duration, delay);
  return <span>{prefix}{typeof value === 'number' ? animated.toLocaleString() : value}{suffix}</span>;
}

// â”€â”€â”€ Responsive Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const useResponsive = () => {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  return { isMobile: width < 768, isTablet: width >= 768 && width < 1024, isDesktop: width >= 1024 };
};

// â”€â”€â”€ Left Column - Profile Card (Sticky) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ProfileCard({ user, photo, initials, onPhotoChange, onPhotoClick }) {
  const avatarSrc = useMemo(() => getAvatarSource(user), [user]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(91, 0, 95, 0.35)' }}
      style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        borderRadius: 20,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(91, 0, 95, 0.25)',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* Background decoration */}
      <div style={{
        position: 'absolute', top: -50, right: -50,
        width: 150, height: 150, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        filter: 'blur(40px)',
      }} />

      {/* Avatar */}
      <motion.div
        style={{
          position: 'relative',
          marginBottom: 16,
          cursor: onPhotoClick ? 'pointer' : 'default',
        }}
        onClick={onPhotoClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          border: '4px solid rgba(255,255,255,0.3)',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          {photo ? (
            <img src={photo} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 36, fontWeight: 700, color: '#fff' }}>
                {initials}
              </span>
            </div>
          )}
        </div>
        {/* Edit button */}
        <motion.button
          onClick={onPhotoChange}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 32,
            height: 32,
            borderRadius: 16,
            background: '#F93E11',
            border: '3px solid white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </motion.button>
      </motion.div>

      {/* Name */}
      <h2 style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: 18,
        fontWeight: 700,
        color: '#fff',
        margin: '0 0 8px',
      }}>
        {user?.name}
      </h2>

      {/* Role Badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.15)',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 11,
          fontWeight: 600,
          color: '#fff',
        }}>
          {ROLE_LABEL[user?.roleCode] || user?.roleCode?.toUpperCase()}
        </span>
      </div>

      {/* Outlet */}
      {user?.outlet?.name && (
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 12,
          color: 'rgba(255,255,255,0.7)',
        }}>
          ðŸ“ {user.outlet.name}
        </span>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginTop: 20,
        width: '100%',
      }}>
        <motion.button
          onClick={() => document.getElementById('edit-profile-btn')?.click()}
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.25)' }}
          whileTap={{ scale: 0.98 }}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            fontFamily: "'Poppins', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          âœï¸ Edit
        </motion.button>
        <motion.button
          onClick={() => document.getElementById('change-password-btn')?.click()}
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.15)' }}
          whileTap={{ scale: 0.98 }}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'Poppins', sans-serif",
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          ðŸ”’ Password
        </motion.button>
      </div>
    </motion.div>
  );
}

// â”€â”€â”€ Right Column - Stats & Activity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatsSection({ stats, animationDelay = 0 }) {
  // Omset/cash hanya dimunculkan jika parent mengirim totalRevenue (artinya role boleh lihat)
  const statItems = [
    { label: 'Total Shift', value: stats?.totalShifts || 0, icon: 'ðŸ•', color: '#5B005F' },
    { label: 'Transaksi', value: stats?.totalTransactions || 0, icon: 'ðŸ“‹', color: '#059669' },
    stats?.totalRevenue != null
      ? { label: 'Omset', value: stats.totalRevenue, icon: 'ðŸ’°', color: '#F93E11', isCurrency: true }
      : null,
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: animationDelay }}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        boxShadow: '0 2px 8px rgba(91, 0, 95, 0.08)',
      }}
    >
      <h3 style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        color: '#1a1a1a',
        margin: '0 0 16px',
      }}>
        ðŸ“Š Statistik Bulanan
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${statItems.length}, 1fr)`, gap: 12 }}>
        {statItems.map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: animationDelay + 0.1 + idx * 0.1 }}
            whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(91, 0, 95, 0.15)' }}
            style={{
              background: `${item.color}10`,
              borderRadius: 12,
              padding: 12,
              textAlign: 'center',
              cursor: 'default',
              transition: 'box-shadow 0.2s ease',
            }}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <div style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 18,
              fontWeight: 800,
              color: item.color,
              margin: '4px 0 2px',
            }}>
              {item.isCurrency ? (
                <AnimatedNumber value={item.value} prefix="Rp " duration={700} delay={animationDelay + 300 + idx * 100} />
              ) : (
                <AnimatedNumber value={item.value} duration={700} delay={animationDelay + 300 + idx * 100} />
              )}
            </div>
            <div style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 10,
              color: '#5a5a5a',
            }}>
              {item.label}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function ShiftHistorySection({ shifts, hideCash = false, animationDelay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: animationDelay }}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        boxShadow: '0 2px 8px rgba(91, 0, 95, 0.08)',
      }}
    >
      <h3 style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        color: '#1a1a1a',
        margin: '0 0 16px',
      }}>
        ðŸ• Riwayat Shift Terakhir
      </h3>
      {shifts && shifts.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shifts.slice(0, 5).map((shift, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: animationDelay + 0.1 + idx * 0.08 }}
              whileHover={{ x: 4, backgroundColor: '#F9F5F9' }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: '#F4EDF4',
                borderRadius: 10,
                cursor: 'default',
                transition: 'background-color 0.2s ease',
              }}
            >
              <motion.div
                animate={shift.status !== 'closed' ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: shift.status === 'closed' ? '#05966920' : '#F93E1120',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <span style={{ fontSize: 16 }}>
                  {shift.status === 'closed' ? 'âœ…' : 'â³'}
                </span>
              </motion.div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#1a1a1a',
                }}>
                  {shift.date || new Date(shift.openedAt).toLocaleDateString('id-ID')}
                </div>
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 10,
                  color: '#5a5a5a',
                }}>
                  {shift.type || 'Regular'} â€¢ {shift.startTime || '-'} - {shift.endTime || 'ongoing'}
                </div>
              </div>
              <motion.span
                animate={!hideCash && shift.status === 'open' ? { opacity: [1, 0.6, 1] } : {}}
                transition={{ repeat: !hideCash && shift.status === 'open' ? Infinity : undefined, duration: 1.5 }}
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  color: shift.status === 'closed' ? '#059669' : '#F93E11',
                }}
              >
                {hideCash
                  ? shift.status === 'closed' ? 'Tutup' : 'Aktif'
                  : shift.status === 'closed' ? rp(shift.cashTotal || 0) : 'Aktif'
                }
              </motion.span>
            </motion.div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 20, color: '#9a9a9a' }}>
          Belum ada data shift
        </div>
      )}
    </motion.div>
  );
}

function ActivityLogSection({ activities, animationDelay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: animationDelay }}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: 16,
        boxShadow: '0 2px 8px rgba(91, 0, 95, 0.08)',
      }}
    >
      <h3 style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        color: '#1a1a1a',
        margin: '0 0 16px',
      }}>
        ðŸ“ Aktivitas Terbaru
      </h3>
      {activities && activities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activities.slice(0, 8).map((activity, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: animationDelay + 0.1 + idx * 0.06 }}
              whileHover={{ x: 4, backgroundColor: '#FAF8FA' }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 0',
                borderBottom: idx < activities.length - 1 ? '1px solid #E6D9E7' : 'none',
                cursor: 'default',
                transition: 'background-color 0.2s ease',
              }}
            >
              <span style={{ fontSize: 14, marginTop: 2 }}>{activity.icon || 'ðŸ“‹'}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#1a1a1a',
                }}>
                  {activity.description}
                </div>
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 10,
                  color: '#9a9a9a',
                  marginTop: 2,
                }}>
                  {activity.time || activity.createdAt ? new Date(activity.createdAt || activity.time).toLocaleString('id-ID') : '-'}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 20, color: '#9a9a9a' }}>
          Belum ada aktivitas terbaru
        </div>
      )}
    </motion.div>
  );
}

// â”€â”€â”€ Mobile Profile Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MobileProfileHeader({ user, photo, initials, onPhotoClick }) {
  const avatarSrc = useMemo(() => getAvatarSource(user), [user]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: '16px 16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
        borderRadius: 16,
      }}
    >
      <motion.div
        style={{
          position: 'relative',
          cursor: onPhotoClick ? 'pointer' : 'default',
        }}
        onClick={onPhotoClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          border: '3px solid rgba(255,255,255,0.3)',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          {photo ? (
            <img src={photo} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 24, fontWeight: 700, color: '#fff' }}>
                {initials}
              </span>
            </div>
          )}
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        style={{ flex: 1 }}
      >
        <h2 style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: '#fff',
          margin: '0 0 4px',
        }}>
          {user?.name}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.2)',
            fontFamily: "'Poppins', sans-serif",
            fontSize: 10,
            fontWeight: 600,
            color: '#fff',
          }}>
            {ROLE_LABEL[user?.roleCode] || user?.roleCode?.toUpperCase()}
          </span>
          {user?.outlet?.name && (
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 10,
              color: 'rgba(255,255,255,0.7)',
            }}>
              ðŸ“ {user.outlet.name}
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// â”€â”€â”€ Edit Profile Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function EditProfileForm({ name, phone, email, saving, onSave, isMobile, animationDelay = 0 }) {
  return (
    <motion.div
      id="edit-profile-btn"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      whileHover={{ y: -2, boxShadow: '0 4px 16px rgba(91, 0, 95, 0.12)' }}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: isMobile ? 16 : 20,
        boxShadow: '0 2px 8px rgba(91, 0, 95, 0.08)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      <h3 style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        color: '#1a1a1a',
        margin: '0 0 16px',
      }}>
        âœï¸ Edit Profil
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label="Nama Lengkap" value={name} onChange={(v) => {}} placeholder="Masukkan nama lengkap" />
        <Input label="Nomor HP" value={phone} onChange={(v) => {}} placeholder="08xxxxxxxxxx" />
        <Input label="Email" value={email} onChange={(v) => {}} placeholder="nama@email.com" />
      </div>
      <div style={{ marginTop: 16 }}>
        <Btn variant="primary" fullWidth loading={saving} onClick={onSave}>Simpan Profil</Btn>
      </div>
    </motion.div>
  );
}

// â”€â”€â”€ Change Password Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ChangePasswordForm({ oldPw, newPw, confirmPw, pwLoading, onChange, isMobile, animationDelay = 0 }) {
  return (
    <motion.div
      id="change-password-btn"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      whileHover={{ y: -2, boxShadow: '0 4px 16px rgba(91, 0, 95, 0.12)' }}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: isMobile ? 16 : 20,
        boxShadow: '0 2px 8px rgba(91, 0, 95, 0.08)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      <h3 style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        color: '#1a1a1a',
        margin: '0 0 16px',
      }}>
        ðŸ”’ Ubah Password
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label="Password Lama" value={oldPw} onChange={(v) => {}} type="password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" />
        <Input label="Password Baru" value={newPw} onChange={(v) => {}} type="password" placeholder="Min. 6 karakter" />
        <Input label="Konfirmasi Password Baru" value={confirmPw} onChange={(v) => {}} type="password" placeholder="Ulangi password baru" />
      </div>
      <div style={{ marginTop: 16 }}>
        <Btn variant="secondary" fullWidth loading={pwLoading} onClick={onChange}>Konfirmasi Ubah Password</Btn>
      </div>
    </motion.div>
  );
}

// â”€â”€â”€ Role Switcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RoleSwitcher({ ROLES, user, isAdmin, handleSwitchRole, navigate, isMobile, animationDelay = 0 }) {
  if (!isAdmin) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      whileHover={{ y: -2, boxShadow: '0 4px 16px rgba(91, 0, 95, 0.12)' }}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: isMobile ? 16 : 20,
        boxShadow: '0 2px 8px rgba(91, 0, 95, 0.08)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      <h3 style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        color: '#1a1a1a',
        margin: '0 0 16px',
      }}>
        ðŸ‘‘ Tampil Sebagai Role
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: isMobile ? 8 : 10
      }}>
        {ROLES.map((r) => (
          <motion.button
            key={r.id}
            onClick={() => { handleSwitchRole(r.id); navigate('dashboard'); }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: isMobile ? '12px 4px' : '14px 8px',
              borderRadius: 12,
              border: `1.5px solid ${user?.role === r.id ? '#5B005F' : '#E6D9E7'}`,
              background: user?.role === r.id ? '#E6D9E7' : '#fff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: isMobile ? 4 : 6,
            }}
          >
            <span style={{ fontSize: isMobile ? 20 : 24 }}>{r.icon}</span>
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: isMobile ? 10 : 11,
              fontWeight: user?.role === r.id ? 700 : 500,
              color: user?.role === r.id ? '#5B005F' : '#5a5a5a',
            }}>
              {r.label}
            </span>
          </motion.button>
        ))}
      </div>
      <p style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: 10,
        color: '#9a9a9a',
        textAlign: 'center',
        marginTop: 12,
      }}>
        Akun tetap sebagai Admin Â· hanya tampilan yang berubah
      </p>
    </motion.div>
  );
}

// â”€â”€â”€ Main Profile Page Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function ProfilePage({ navigate, goBack }) {
  const { user, updateUserProfile, handleSwitchRole } = useApp();
  const roleCode = user?.originalRoleCode ?? user?.roleCode;
  const isAdmin = roleCode === 'admin';
  // PRODUCTION sees NO financial data (omset, cash totals, setoran nominal) â€” hanya frontline & admin
  const isProduksi = roleCode === 'produksi';
  const showFinancials = isAdmin || !isProduksi; // frontline/admin = visible, produksi = hidden
  const { isMobile, isTablet } = useResponsive();

  const ROLES = [
    { id: 'frontline', label: 'Frontline', icon: 'ðŸ§¾' },
    { id: 'produksi', label: 'Produksi', icon: 'ðŸ§º' },
    { id: 'admin',    label: 'Admin',    icon: 'ðŸ‘‘' },
    { id: 'finance',  label: 'Finance',  icon: 'ðŸ’°' },
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
  const fileRef = useRef();

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Mock data for stats, shifts, activities
  const [stats] = useState({ totalShifts: 24, totalTransactions: 156, totalRevenue: 28450000 });
  const [shifts] = useState([
    { date: '02 Jul 2026', type: 'Pagi', startTime: '07:00', endTime: '15:00', status: 'closed', cashTotal: 4250000 },
    { date: '01 Jul 2026', type: 'Pagi', startTime: '07:00', endTime: '15:00', status: 'closed', cashTotal: 3890000 },
    { date: '30 Jun 2026', type: 'Siang', startTime: '15:00', endTime: '22:00', status: 'closed', cashTotal: 3120000 },
  ]);
  const [activities] = useState([
    { icon: 'ðŸ’°', description: 'Melakukan setoran tunai Rp 5.000.000', time: '2 Jul 2026, 14:30' },
    { icon: 'ðŸ“‹', description: 'Membuat transaksi Nota #1247', time: '2 Jul 2026, 13:45' },
    { icon: 'ðŸ‘¤', description: 'Menambah customer baru: Budi Santoso', time: '2 Jul 2026, 11:20' },
    { icon: 'ðŸ”„', description: 'Oper shift ke Maya', time: '2 Jul 2026, 10:00' },
  ]);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      alertInfo('Menyiapkan gambar...');
      const compressedDataUrl = await compressImage(file, 1600, 1600, 0.85);
      setCropImageSrc(compressedDataUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropModalOpen(true);
    } catch (error) {
      alertError(error?.response?.data?.message || 'Gagal memproses file gambar ini');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const initials = (name || user?.name || 'US')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const handleSaveProfile = async () => {
    if (!name.trim()) { alertWarning('Nama tidak boleh kosong'); return; }
    setSaving(true);
    try {
      await axios.patch('/api/users/me/profile', {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        photo,
      });
      updateUserProfile({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, photo });
      alertSuccess('Profil berhasil disimpan');
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw) { alertWarning('Password lama dan baru wajib diisi'); return; }
    if (newPw !== confirmPw) { alertWarning('Konfirmasi password tidak cocok'); return; }
    if (newPw.length < 6) { alertWarning('Password baru minimal 6 karakter'); return; }
    setPwLoading(true);
    try {
      await axios.patch('/api/users/me/password', { oldPassword: oldPw, newPassword: newPw });
      alertSuccess('Password berhasil diubah');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengubah password');
    } finally {
      setPwLoading(false);
    }
  };

  // Calculate animation delays based on device
  const baseDelay = isMobile ? 0.1 : 0;
  const statsDelay = baseDelay + 0.1;
  const shiftDelay = baseDelay + 0.2;
  const activityDelay = baseDelay + 0.3;
  const editDelay = baseDelay + (isMobile ? 0.3 : 0.4);
  const passwordDelay = baseDelay + (isMobile ? 0.4 : 0.5);
  const roleDelay = baseDelay + (isMobile ? 0.5 : 0.6);

  // â”€â”€â”€ Main Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F4EDF4', overflow: 'hidden' }}>
      <TopBar title="Profil Saya" onBack={goBack} />

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

      {/* Content - Scrollable */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? 16 : 24,
        }}
      >
        {/* Responsive Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'minmax(240px, 30%) 1fr' : 'minmax(280px, 35%) 1fr',
          gap: isMobile ? 16 : 24,
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          {/* Left Column - Sticky (Desktop/Tablet only) */}
          {!isMobile && (
            <div style={{
              position: 'sticky',
              top: 24,
              alignSelf: 'start',
            }}>
              <ProfileCard
                user={user}
                photo={photo}
                initials={initials}
                onPhotoChange={() => fileRef.current?.click()}
                onPhotoClick={() => fileRef.current?.click()}
              />
            </div>
          )}

          {/* Right Column - Scrollable */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Mobile: Avatar Header */}
            {isMobile && (
              <MobileProfileHeader
                user={user}
                photo={photo}
                initials={initials}
                onPhotoClick={() => fileRef.current?.click()}
              />
            )}

            {/* Stats â€” produksi lihat SHIFT + TRANSAKSI, TANPA omset/cash */}
            <StatsSection
              stats={showFinancials ? stats : {
                totalShifts: stats?.totalShifts,
                totalTransactions: stats?.totalTransactions,
                // omset/pelunasan/hari ini â†’ tidak dikirim ke produksi
              }}
              animationDelay={statsDelay}
            />

            {/* Shift History â€” produksi lihat SHIFT LIST, TANPA nominal kas */}
            <ShiftHistorySection
              shifts={shifts}
              hideCash={isProduksi}
              animationDelay={shiftDelay}
            />

            {/* Activity Log â€” produksi lihat aktivitas NON-FINANSIAL saja */}
            <ActivityLogSection
              activities={
                showFinancials
                  ? activities
                  : activities?.filter(a => !/setoran|rp|[\d.]+(?:\.\d{3})/.test(a.description ?? '')) ?? []
              }
              animationDelay={activityDelay}
            />

            {/* Activity Log */}
            <ActivityLogSection activities={activities} animationDelay={activityDelay} />

            {/* Edit Profile Form */}
            <EditProfileForm
              name={name}
              phone={phone}
              email={email}
              saving={saving}
              onSave={handleSaveProfile}
              isMobile={isMobile}
              animationDelay={editDelay}
            />

            {/* Change Password */}
            <ChangePasswordForm
              oldPw={oldPw}
              newPw={newPw}
              confirmPw={confirmPw}
              pwLoading={pwLoading}
              onChange={handleChangePassword}
              isMobile={isMobile}
              animationDelay={passwordDelay}
            />

            {/* Role Switcher */}
            <RoleSwitcher
              ROLES={ROLES}
              user={user}
              isAdmin={isAdmin}
              handleSwitchRole={handleSwitchRole}
              navigate={navigate}
              isMobile={isMobile}
              animationDelay={roleDelay}
            />
          </div>
        </div>
      </motion.div>

      {/* Crop Modal */}
      {cropModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 16, background: '#111', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ color: 'white', fontFamily: "'Poppins', sans-serif", fontWeight: 600 }}>Sesuaikan Foto Profil</span>
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
          <div style={{ padding: 24, background: '#111', display: 'flex', gap: 12 }}>
            <Btn variant="secondary" style={{ flex: 1, background: '#333', color: 'white' }} onClick={() => setCropModalOpen(false)}>Batal</Btn>
            <Btn variant="primary" style={{ flex: 1 }} onClick={async () => {
              try {
                const croppedBase64 = await getCroppedImg(cropImageSrc, croppedAreaPixels, 800, 0.8);
                setPhoto(croppedBase64);
                setCropModalOpen(false);
              } catch (err) {
                alertError('Gagal memotong foto');
              }
            }}>Terapkan</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
