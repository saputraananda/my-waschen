// ─────────────────────────────────────────────────────────────────────────────
// AppHeader.jsx — Shared Header Component (Kasir & Admin)
// Ref: My_Waschen_Redesign_Spec_dan_Prompt.md Section 4.2
//
// Features:
// - Dynamic greeting based on time of day
// - Shift status badge (active = green pulse, inactive = gray)
// - Real-time clock
// - Avatar with notification ring
// - Aesthetic animated background (particles, shimmer, glow orbs)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';

// ─── Avatar Images (from spec Section 5) ────────────────────────────────────────
import { getAvatarSource } from '../utils/avatar';
import { ProfileAvatar } from './ui/ProfileAvatar';

// ─── Greeting Helper ────────────────────────────────────────────────────────────
const getGreeting = (name) => {
  const hour = new Date().getHours();
  let timeGreeting = 'Selamat Malam';

  if (hour >= 5 && hour < 11) {
    timeGreeting = 'Selamat Pagi';
  } else if (hour >= 11 && hour < 15) {
    timeGreeting = 'Selamat Siang';
  } else if (hour >= 15 && hour < 18) {
    timeGreeting = 'Selamat Sore';
  }

  const displayName = name ? `, ${name.split(' ')[0]}` : '';
  return `${timeGreeting}${displayName}`;
};

// ─── Floating Particles Component ───────────────────────────────────────────────
function FloatingParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 4 + 3,
      delay: Math.random() * 3,
      opacity: Math.random() * 0.4 + 0.1,
    }));
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.8)',
            opacity: p.opacity,
          }}
          animate={{
            y: [-10, 10, -10],
            x: [-5, 5, -5],
            scale: [1, 1.2, 1],
            opacity: [p.opacity, p.opacity * 1.5, p.opacity],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated Glow Orbs ─────────────────────────────────────────────────────────
function AnimatedGlowOrbs() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Top-left orb */}
      <motion.div
        style={{
          position: 'absolute',
          top: -60,
          left: -60,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(140, 76, 143, 0.4) 0%, transparent 70%)',
          filter: 'blur(30px)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Top-right orb */}
      <motion.div
        style={{
          position: 'absolute',
          top: -40,
          right: 100,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249, 62, 17, 0.3) 0%, transparent 70%)',
          filter: 'blur(25px)',
        }}
        animate={{
          scale: [1.1, 1, 1.1],
          opacity: [0.4, 0.6, 0.4],
          x: [0, 20, 0],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Bottom-right orb */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: -80,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(91, 0, 95, 0.6) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.6, 0.9, 0.6],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Sparkle effects */}
      {[
        { top: '20%', left: '30%', size: 6, delay: 0 },
        { top: '60%', left: '70%', size: 4, delay: 1 },
        { top: '40%', left: '50%', size: 5, delay: 2 },
        { top: '70%', left: '20%', size: 4, delay: 0.5 },
        { top: '30%', left: '80%', size: 6, delay: 1.5 },
      ].map((sparkle, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            top: sparkle.top,
            left: sparkle.left,
            width: sparkle.size,
            height: sparkle.size,
            background: 'white',
            borderRadius: '50%',
            boxShadow: '0 0 10px rgba(255,255,255,0.8)',
          }}
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 2,
            delay: sparkle.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Shimmer Effect ────────────────────────────────────────────────────────────
function ShimmerEffect() {
  return (
    <motion.div
      style={{
        position: 'absolute',
        top: 0,
        left: '-100%',
        width: '50%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
        transform: 'skewX(-20deg)',
        pointerEvents: 'none',
      }}
      animate={{
        left: ['-100%', '150%'],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        repeatDelay: 3,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── Breathing Background Gradient ───────────────────────────────────────────────
function BreathingGradient() {
  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        pointerEvents: 'none',
      }}
      animate={{
        background: [
          'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
          'linear-gradient(140deg, #620068 0%, #520055 100%)',
          'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        ],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── Shift Status Badge ─────────────────────────────────────────────────────────
function ShiftStatusBadge({ shiftActive, shiftType }) {
  if (shiftActive) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 999,
          background: 'rgba(5, 150, 105, 0.15)',
          border: '1px solid rgba(5, 150, 105, 0.4)',
          fontSize: 11,
          fontWeight: 600,
          color: '#34d399',
        }}
      >
        {/* Pulse dot animation */}
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#34d399',
              display: 'block',
            }}
          />
          <motion.span
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: '#34d399',
            }}
            animate={{ scale: [1, 2], opacity: [0.6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          />
        </span>
        Shift Aktif
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: 'rgba(154, 154, 154, 0.12)',
        border: '1px solid rgba(154, 154, 154, 0.3)',
        fontSize: 11,
        fontWeight: 600,
        color: '#9a9a9a',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#9a9a9a',
          display: 'block',
        }}
      />
      Belum Buka Shift
    </motion.div>
  );
}

// ─── Real-time Clock ────────────────────────────────────────────────────────────
function RealTimeClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatted = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: 12,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 0.5,
      }}
    >
      {formatted}
    </div>
  );
}

// ─── Notification Badge ─────────────────────────────────────────────────────────
function NotificationBadge({ count = 0 }) {
  if (count <= 0) return null;

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      style={{
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        background: '#F93E11',
        color: '#fff',
        fontSize: 10,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 4px',
        border: '2px solid white',
      }}
    >
      {count > 99 ? '99+' : count}
    </motion.span>
  );
}

// ─── Avatar Component ────────────────────────────────────────────────────────────
function UserAvatar({ user, size = 40, hasNotification = false }) {
  return (
    <ProfileAvatar
      user={user}
      size={size}
      showBorder={false}
      notificationDot={hasNotification}
    />
  );
}

// ─── Main AppHeader Component ───────────────────────────────────────────────────
export default function AppHeader({
  // Shift status
  shiftActive = false,
  shiftType = 'pagi',
  // Notification count
  notificationCount = 0,
  // Custom actions
  onNotificationClick,
  onProfileClick,
  // Outlet selector for admin (optional)
  showOutletSelector = false,
  selectedOutlet,
  outlets = [],
  onOutletChange,
  // Role indicator
  roleLabel,
}) {
  const { user } = useApp();
  const greeting = useMemo(() => getGreeting(user?.name), [user?.name]);

  // Update greeting every minute (for day change)
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render for greeting update
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.header
      initial={{ y: -64 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(91, 0, 95, 0.3)',
      }}
    >
      {/* Breathing Gradient Background */}
      <BreathingGradient />

      {/* Animated Glow Orbs */}
      <AnimatedGlowOrbs />

      {/* Floating Particles */}
      <FloatingParticles />

      {/* Shimmer Effect */}
      <ShimmerEffect />

      {/* Left section: Greeting + Shift Status */}
      <motion.div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 1,
        }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {/* Greeting */}
        <motion.h1
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: '#fff',
            margin: 0,
            lineHeight: 1.2,
          }}
          whileHover={{ scale: 1.02 }}
        >
          {greeting} 👋
        </motion.h1>

        {/* Shift Status + Role */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShiftStatusBadge shiftActive={shiftActive} shiftType={shiftType} />
          {roleLabel && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              • {roleLabel}
            </motion.span>
          )}
        </div>
      </motion.div>

      {/* Center: Outlet Selector (Admin only) */}
      {showOutletSelector && outlets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ zIndex: 1 }}
        >
          <select
            value={selectedOutlet || ''}
            onChange={(e) => onOutletChange?.(e.target.value)}
            style={{
              padding: '8px 32px 8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontFamily: "'Poppins', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='white' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
            }}
          >
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id} style={{ color: '#1a1a1a' }}>
                {outlet.name}
              </option>
            ))}
          </select>
        </motion.div>
      )}

      {/* Right section: Clock + Avatar */}
      <motion.div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          zIndex: 1,
        }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {/* Real-time Clock */}
        <RealTimeClock />

        {/* Notification Bell */}
        {onNotificationClick && (
          <motion.button
            onClick={onNotificationClick}
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.25)' }}
            whileTap={{ scale: 0.95 }}
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: 12,
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              transition: 'background 0.2s',
            }}
          >
            {/* Bell icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>

            {/* Notification count badge */}
            {notificationCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: '#F93E11',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  border: '1.5px solid #4D0051',
                }}
              >
                {notificationCount > 99 ? '99+' : notificationCount}
              </motion.span>
            )}
          </motion.button>
        )}

        {/* User Avatar */}
        <motion.button
          onClick={onProfileClick}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          style={{
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: 40,
          }}
        >
          <UserAvatar
            user={user}
            size={40}
            hasNotification={notificationCount > 0 && !onNotificationClick}
          />
        </motion.button>
      </motion.div>
    </motion.header>
  );
}

// ─── Compact Header (for pages with TopBar) ────────────────────────────────────
// Use this when you already have a TopBar and just need the header portion
export function CompactHeader({
  shiftActive = false,
  shiftType = 'pagi',
  notificationCount = 0,
  onNotificationClick,
  onProfileClick,
  roleLabel,
}) {
  const { user } = useApp();
  const greeting = useMemo(() => getGreeting(user?.name), [user?.name]);

  return (
    <motion.div
      initial={{ y: -56 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(91, 0, 95, 0.2)',
      }}
    >
      {/* Gradient Background */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        }}
        animate={{
          background: [
            'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
            'linear-gradient(140deg, #620068 0%, #520055 100%)',
            'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Subtle Glow Orb */}
      <motion.div
        style={{
          position: 'absolute',
          top: -30,
          left: -30,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(140, 76, 143, 0.3) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating Particles (fewer for compact) */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              left: `${20 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.6)',
            }}
            animate={{
              y: [-5, 5, -5],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Left: Greeting */}
      <motion.div
        style={{ display: 'flex', flexDirection: 'column', gap: 2, zIndex: 1 }}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <span
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            lineHeight: 1.2,
          }}
        >
          {greeting} 👋
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShiftStatusBadge shiftActive={shiftActive} shiftType={shiftType} />
          {roleLabel && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
              • {roleLabel}
            </span>
          )}
        </div>
      </motion.div>

      {/* Right: Actions */}
      <motion.div
        style={{ display: 'flex', alignItems: 'center', gap: 12, zIndex: 1 }}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <RealTimeClock />

        {onNotificationClick && (
          <motion.button
            onClick={onNotificationClick}
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.25)' }}
            whileTap={{ scale: 0.95 }}
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: 10,
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notificationCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  background: '#F93E11',
                  color: '#fff',
                  fontSize: 8,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid #4D0051',
                }}
              >
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </motion.button>
        )}

        <motion.button
          onClick={onProfileClick}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          <UserAvatar user={user} size={36} />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
