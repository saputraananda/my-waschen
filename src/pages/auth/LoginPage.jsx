// ─────────────────────────────────────────────────────────────────────────────
// LoginPage.jsx — Premium Desktop Redesign with Glassmorphism & Claymorphism
// Laundrix-inspired design with stagger entrance + shake on error
// Focus: Desktop/Landscape POV
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';

// ─── Assets ───────────────────────────────────────────────────────────────────
import loginIllustration from '../../assets/login-illustration.webp';

const APP_VERSION = 'My Waschen v2.0.0';

// ─── Brand tokens ───────────────────────────────────────────────────────────
const BRAND = {
  deep: '#5B005F',
  deepDark: '#4D0051',
  deepLight: '#7A1481',
  deepLighter: '#9C3AA0',
  deepPale: '#F3E3F5',
  deepSoft: '#AD80AF',
  deepTint: '#E6D9E7',
  deepWash: '#F4EDF4',
  accent: '#F93E11',
  accentLight: '#FF7A4D',
  foam: '#FFFFFF',
  danger: '#E4664A',
};

// ─── CSS Keyframes (injected once) ───────────────────────────────────────────
const injectKeyframes = () => {
  if (document.getElementById('login-page-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'login-page-keyframes';
  style.textContent = `
    @keyframes float-up {
      0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
      10%  { opacity: 0.35; }
      90%  { opacity: 0.2; }
      100% { transform: translateY(-115vh) translateX(var(--drift, 30px)) scale(0.85); opacity: 0; }
    }
    @keyframes drift {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(24px, -18px) scale(1.06); }
    }
    @keyframes mesh-shift {
      0%, 100% { background-position: 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0 0; }
      50% { background-position: 12% 8%, -8% 6%, 10% -8%, -6% 6%, 0% 0%, 0 0; }
    }
    @keyframes sparkle {
      0%, 100% { transform: scale(0.8) rotate(0deg); opacity: 0.3; }
      50% { transform: scale(1.3) rotate(180deg); opacity: 1; }
    }
    @keyframes sparkle-pulse {
      0%, 100% { transform: scale(1); opacity: 0.25; }
      50% { transform: scale(1.6); opacity: 0.7; }
    }
    @keyframes field-shake {
      0%, 100% { transform: translateX(0); }
      15%       { transform: translateX(-7px); }
      30%       { transform: translateX(7px); }
      45%       { transform: translateX(-5px); }
      60%       { transform: translateX(5px); }
      75%       { transform: translateX(-2px); }
      90%       { transform: translateX(2px); }
    }
    @keyframes error-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .is-shaking {
      animation: field-shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
    }
  `;
  document.head.appendChild(style);
};

// ─── Responsive Hook ───────────────────────────────────────────────────────────
const useResponsive = () => {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return { isMobile: width < 768, isTablet: width >= 768 && width < 1024, isDesktop: width >= 1024 };
};

// ─── Icons ───────────────────────────────────────────────────────────────────
const IconEye = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1-5 12c0-7 4-11 11-11a10.07 10.07 0 0 1 5.94 2.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.45 18.45 0 0 1-5.06 5.94M9.9 4.24A9.12 9.12 0 0 0 5 12c0 .7.1 1.37.3 2M1 1l22 22" />
  </svg>
);

// ─── Floating Bubble Component ────────────────────────────────────────────────
const FloatingBubble = ({ size = 36, delay = 0, drift = 30, left = '50%', bottom = '-40px', opacity = 0.15 }) => {
  const duration = 10 + Math.random() * 8;
  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,${opacity * 0.8}) 0%, rgba(255,255,255,${opacity * 0.15}) 50%, rgba(255,255,255,${opacity * 0.05}) 70%)`,
        bottom,
        left,
        transform: 'translateX(-50%)',
        animation: `float-up ${duration}s ease-in infinite`,
        animationDelay: `${delay}s`,
        ['--drift']: `${drift}px`,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
};

// ─── LEFT SIDE: Hero Panel ────────────────────────────────────────────────────
function HeroPanel() {
  useEffect(() => {
    injectKeyframes();
  }, []);

  return (
    <div style={{
      width: '54%',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: `
        radial-gradient(120% 140% at 15% 10%, ${BRAND.deep} 0%, ${BRAND.deepDark} 42%, #3A0040 100%)
      `,
      isolation: 'isolate',
    }}>
      {/* Subtle background blobs - more transparent */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          width: 340,
          height: 340,
          borderRadius: '50%',
          filter: 'blur(8px)',
          opacity: 0.12,
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)',
          top: -80,
          left: -100,
          animation: 'drift 16s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          width: 260,
          height: 260,
          borderRadius: '50%',
          filter: 'blur(8px)',
          opacity: 0.08,
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)',
          bottom: -60,
          right: -60,
          animation: 'drift 16s ease-in-out infinite',
          animationDelay: '-5s',
        }} />
      </div>

      {/* Large transparent bubbles - left panel only */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <FloatingBubble
            key={i}
            size={20 + Math.random() * 50}
            delay={Math.random() * 6}
            drift={(Math.random() * 150 - 75).toFixed(0)}
            left={`${Math.random() * 100}%`}
            bottom={`${-80 - Math.random() * 80}px`}
            opacity={0.35 + Math.random() * 0.3}
          />
        ))}
      </div>

      {/* Sparkle effects */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 20, height: 20, top: '8%', left: '15%', animation: 'sparkle 2.8s ease-in-out infinite' }}>
          <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.95)"><path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" /></svg>
        </div>
        <div style={{ position: 'absolute', width: 16, height: 16, top: '12%', left: '35%', animation: 'sparkle 3.2s ease-in-out infinite', animationDelay: '0.3s' }}>
          <svg viewBox="0 0 24 24" fill="rgba(255,200,100,0.9)"><path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" /></svg>
        </div>
        <div style={{ position: 'absolute', width: 14, height: 14, top: '5%', left: '55%', animation: 'sparkle 2.5s ease-in-out infinite', animationDelay: '0.7s' }}>
          <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)"><path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" /></svg>
        </div>
        <div style={{ position: 'absolute', width: 18, height: 18, top: '18%', right: '20%', animation: 'sparkle 3s ease-in-out infinite', animationDelay: '0.5s' }}>
          <svg viewBox="0 0 24 24" fill="rgba(255,220,150,0.95)"><path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" /></svg>
        </div>
        <div style={{ position: 'absolute', width: 12, height: 12, top: '30%', left: '8%', animation: 'sparkle 2.7s ease-in-out infinite', animationDelay: '1s' }}>
          <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)"><path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" /></svg>
        </div>
        <div style={{ position: 'absolute', width: 22, height: 22, top: '25%', left: '25%', animation: 'sparkle 3.5s ease-in-out infinite', animationDelay: '1.2s' }}>
          <svg viewBox="0 0 24 24" fill="rgba(255,200,100,0.95)"><path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" /></svg>
        </div>
        <div style={{ position: 'absolute', width: 10, height: 10, top: '40%', left: '20%', animation: 'sparkle-pulse 3.8s ease-in-out infinite', animationDelay: '0.8s' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255,255,255,0.95)' }} />
        </div>
        <div style={{ position: 'absolute', width: 24, height: 24, bottom: '35%', left: '12%', animation: 'sparkle 2.4s ease-in-out infinite', animationDelay: '0.2s' }}>
          <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)"><path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" /></svg>
        </div>
        <div style={{ position: 'absolute', width: 15, height: 15, bottom: '28%', left: '30%', animation: 'sparkle 3.3s ease-in-out infinite', animationDelay: '1.5s' }}>
          <svg viewBox="0 0 24 24" fill="rgba(255,220,150,0.9)"><path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" /></svg>
        </div>
        <div style={{ position: 'absolute', width: 8, height: 8, bottom: '40%', left: '18%', animation: 'sparkle-pulse 4s ease-in-out infinite', animationDelay: '1.8s' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255,200,100,0.9)' }} />
        </div>
        <div style={{ position: 'absolute', width: 19, height: 19, bottom: '22%', right: '25%', animation: 'sparkle 2.9s ease-in-out infinite', animationDelay: '1.1s' }}>
          <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.95)"><path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" /></svg>
        </div>
        <div style={{ position: 'absolute', width: 13, height: 13, top: '50%', left: '5%', animation: 'sparkle 3.6s ease-in-out infinite', animationDelay: '0.6s' }}>
          <svg viewBox="0 0 24 24" fill="rgba(255,200,100,0.85)"><path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" /></svg>
        </div>
        <div style={{ position: 'absolute', width: 11, height: 11, bottom: '18%', left: '40%', animation: 'sparkle-pulse 3.5s ease-in-out infinite', animationDelay: '2s' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255,255,255,0.9)' }} />
        </div>
        <div style={{ position: 'absolute', width: 17, height: 17, top: '35%', right: '15%', animation: 'sparkle 2.6s ease-in-out infinite', animationDelay: '0.9s' }}>
          <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)"><path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" /></svg>
        </div>
      </div>

      {/* Centered Illustration */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
        {/* Glow effect behind illustration */}
        <div style={{ position: 'absolute', width: '60%', height: '60%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249, 62, 17, 0.45) 0%, rgba(255, 122, 77, 0.3) 30%, transparent 70%)', filter: 'blur(60px)', top: '20%', left: '20%' }} />
        {/* Login Illustration */}
        <motion.img
          src={loginIllustration}
          alt="Wäschen Laundry Service"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{ width: 'auto', height: '65vh', maxWidth: '95%', objectFit: 'contain', objectPosition: 'center', filter: 'drop-shadow(0 30px 60px rgba(30, 0, 32, 0.5))', zIndex: 1 }}
        />
      </div>

      {/* Floor gradient */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 90,
        background: 'linear-gradient(to top, rgba(58, 0, 64, 0.35), rgba(58, 0, 64, 0))',
        zIndex: 1,
      }} />
    </div>
  );
}

// ─── RIGHT SIDE: Login Form ───────────────────────────────────────────────────
function FormPanel({ username, setUsername, password, setPassword, showPass, setShowPass, loading, errors, globalError, handleLogin, handleKeyDown, shakeFields }) {
  // Field refs for shake animation
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  // Trigger shake when validation fails
  useEffect(() => {
    if (shakeFields?.username && usernameRef.current) {
      usernameRef.current.classList.remove('is-shaking');
      void usernameRef.current.offsetWidth;
      usernameRef.current.classList.add('is-shaking');
    }
    if (shakeFields?.password && passwordRef.current) {
      passwordRef.current.classList.remove('is-shaking');
      void passwordRef.current.offsetWidth;
      passwordRef.current.classList.add('is-shaking');
    }
  }, [shakeFields]);

  // Stagger animation variants for desktop
  const staggerVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.2 + i * 0.08,
        duration: 0.55,
        ease: [0.2, 0.8, 0.2, 1],
      },
    }),
  };

  // CSS variables for consistent styling
  const cssVars = {
    glassFill: 'rgba(255, 255, 255, 0.46)',
    glassBorder: 'rgba(255, 255, 255, 0.65)',
    clayOut: '10px 10px 22px rgba(77, 0, 81, 0.14), -10px -10px 20px rgba(255, 255, 255, 0.75)',
    clayOutSm: '6px 6px 14px rgba(77, 0, 81, 0.12), -6px -6px 12px rgba(255, 255, 255, 0.7)',
    clayIn: 'inset 4px 4px 10px rgba(77, 0, 81, 0.08), inset -4px -4px 10px rgba(255, 255, 255, 0.65)',
    clayPress: 'inset 3px 3px 8px rgba(77, 0, 81, 0.18), inset -3px -3px 8px rgba(255, 255, 255, 0.5)',
    fontDisplay: "'Poppins', sans-serif",
  };

  return (
    <div style={{
      width: '46%',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `
        radial-gradient(ellipse 80% 70% at 15% 15%, rgba(91, 0, 95, 0.12) 0%, transparent 50%),
        radial-gradient(ellipse 70% 60% at 85% 85%, rgba(249, 62, 17, 0.08) 0%, transparent 45%),
        radial-gradient(ellipse 60% 50% at 50% 50%, rgba(244, 237, 244, 0.98) 0%, transparent 55%),
        linear-gradient(135deg, #FDFBFE 0%, #F8F4F9 50%, #FDFBFE 100%)
      `,
      backgroundSize: '200% 200%',
    }}>
      {/* Subtle mesh blobs for depth */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', filter: 'blur(80px)', opacity: 0.15, background: 'radial-gradient(circle, rgba(91, 0, 95, 0.25) 0%, transparent 70%)', top: '-5%', left: '-5%' }} />
        <div style={{ position: 'absolute', width: 250, height: 250, borderRadius: '50%', filter: 'blur(70px)', opacity: 0.12, background: 'radial-gradient(circle, rgba(249, 62, 17, 0.2) 0%, transparent 70%)', bottom: '0%', right: '0%' }} />
      </div>

      {/* Login card - Glassmorphism shell + Claymorphism depth */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        style={{
          width: 'min(440px, calc(100% - 84px))',
          padding: '40px 36px 34px',
          borderRadius: 32,
          background: cssVars.glassFill,
          border: `1px solid ${cssVars.glassBorder}`,
          boxShadow: cssVars.clayOut,
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Eyebrow - Stagger: 0.2s */}
        <motion.span
          custom={0}
          variants={staggerVariants}
          initial="hidden"
          animate="visible"
          style={{
            display: 'inline-block',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: BRAND.deepDark,
            background: BRAND.deepPale,
            padding: '5px 12px',
            borderRadius: 999,
            marginBottom: 12,
          }}
        >
          Selamat datang kembali
        </motion.span>

        {/* Header - Stagger: 0.28s */}
        <motion.div
          custom={1}
          variants={staggerVariants}
          initial="hidden"
          animate="visible"
          style={{ marginBottom: 26 }}
        >
          <h2 style={{
            fontFamily: cssVars.fontDisplay,
            fontSize: 26,
            fontWeight: 700,
            margin: '0 0 8px',
            color: BRAND.deep,
          }}>
            Masuk ke akun Anda
          </h2>
          <p style={{
            margin: 0,
            fontSize: 14,
            color: BRAND.deepSoft,
            lineHeight: 1.5,
          }}>
            Kelola pesanan laundry Anda dengan mudah dan cepat.
          </p>
        </motion.div>

        {/* Global error message */}
        <AnimatePresence>
          {globalError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: 'rgba(228, 102, 74, 0.08)',
                border: '1px solid rgba(228, 102, 74, 0.22)',
                borderRadius: 16,
                padding: '12px 16px',
                marginBottom: 18,
              }}
            >
              <p style={{ fontSize: 13, color: BRAND.danger, margin: 0, fontWeight: 500 }}>
                {globalError}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div onKeyDown={handleKeyDown}>
          {/* Username field - Stagger: 0.36s */}
          <motion.div
            custom={2}
            variants={staggerVariants}
            initial="hidden"
            animate="visible"
            style={{ marginBottom: 18 }}
          >
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: BRAND.deep,
              marginBottom: 8,
            }}>
              Username
            </label>
            <div
              ref={usernameRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.55)',
                borderRadius: 16,
                border: `1.5px solid ${errors.username ? BRAND.danger : 'rgba(255, 255, 255, 0.7)'}`,
                boxShadow: errors.username
                  ? `${cssVars.clayIn}, 0 0 0 3px rgba(228, 102, 74, 0.18)`
                  : cssVars.clayIn,
                transition: 'box-shadow 0.25s ease, border-color 0.25s ease, transform 0.15s ease',
              }}
            >
              <span style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 14,
                color: BRAND.deepDark,
                opacity: 0.75,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M5 20c0-3.314 3.134-6 7-6s7 2.686 7 6" />
                </svg>
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  padding: '13px 12px',
                  fontSize: 14.5,
                  fontFamily: "'Poppins', sans-serif",
                  color: BRAND.deep,
                }}
                onFocus={(e) => {
                  if (!errors.username) {
                    e.target.parentElement.style.borderColor = BRAND.deep;
                    e.target.parentElement.style.boxShadow = `${cssVars.clayIn}, 0 0 0 3px rgba(91, 0, 95, 0.18)`;
                    e.target.parentElement.style.transform = 'translateY(-1px)';
                  }
                }}
                onBlur={(e) => {
                  e.target.parentElement.style.borderColor = errors.username ? BRAND.danger : 'rgba(255, 255, 255, 0.7)';
                  e.target.parentElement.style.boxShadow = errors.username
                    ? `${cssVars.clayIn}, 0 0 0 3px rgba(228, 102, 74, 0.18)`
                    : cssVars.clayIn;
                  e.target.parentElement.style.transform = 'translateY(0)';
                }}
              />
              {/* Clear username button */}
              {username && (
                <button
                  type="button"
                  onClick={() => setUsername('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '8px',
                    marginRight: 4,
                    display: 'flex',
                    alignItems: 'center',
                    color: BRAND.deepSoft,
                    cursor: 'pointer',
                    borderRadius: 8,
                    transition: 'color 0.2s ease, background 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = BRAND.danger;
                    e.currentTarget.style.background = 'rgba(228, 102, 74, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = BRAND.deepSoft;
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            {errors.username && (
              <p style={{
                fontSize: 12.5,
                color: BRAND.danger,
                margin: '6px 0 0',
                paddingLeft: 2,
                animation: 'error-in 0.3s ease both',
              }}>
                {errors.username}
              </p>
            )}
          </motion.div>

          {/* Password field - Stagger: 0.44s */}
          <motion.div
            custom={3}
            variants={staggerVariants}
            initial="hidden"
            animate="visible"
            style={{ marginBottom: 32 }}
          >
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: BRAND.deep,
              marginBottom: 8,
            }}>
              Kata sandi
            </label>
            <div
              ref={passwordRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.55)',
                borderRadius: 16,
                border: `1.5px solid ${errors.password ? BRAND.danger : 'rgba(255, 255, 255, 0.7)'}`,
                boxShadow: errors.password
                  ? `${cssVars.clayIn}, 0 0 0 3px rgba(228, 102, 74, 0.18)`
                  : cssVars.clayIn,
                transition: 'box-shadow 0.25s ease, border-color 0.25s ease, transform 0.15s ease',
              }}
            >
              <span style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 14,
                color: BRAND.deepDark,
                opacity: 0.75,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
                  <path d="M8 10.5V7.8a4 4 0 1 1 8 0v2.7" />
                </svg>
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                autoComplete="current-password"
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  padding: '13px 12px',
                  fontSize: 14.5,
                  fontFamily: "'Poppins', sans-serif",
                  color: BRAND.deep,
                }}
                onFocus={(e) => {
                  if (!errors.password) {
                    e.target.parentElement.style.borderColor = BRAND.deep;
                    e.target.parentElement.style.boxShadow = `${cssVars.clayIn}, 0 0 0 3px rgba(91, 0, 95, 0.18)`;
                    e.target.parentElement.style.transform = 'translateY(-1px)';
                  }
                }}
                onBlur={(e) => {
                  e.target.parentElement.style.borderColor = errors.password ? BRAND.danger : 'rgba(255, 255, 255, 0.7)';
                  e.target.parentElement.style.boxShadow = errors.password
                    ? `${cssVars.clayIn}, 0 0 0 3px rgba(228, 102, 74, 0.18)`
                    : cssVars.clayIn;
                  e.target.parentElement.style.transform = 'translateY(0)';
                }}
              />
              <button
                onClick={() => setShowPass(!showPass)}
                type="button"
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '8px 12px',
                  marginRight: 4,
                  display: 'flex',
                  alignItems: 'center',
                  color: BRAND.deepSoft,
                  cursor: 'pointer',
                  borderRadius: 8,
                  transition: 'color 0.2s ease, background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = BRAND.deep;
                  e.currentTarget.style.background = 'rgba(91, 0, 95, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = BRAND.deepSoft;
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {showPass ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p style={{
                fontSize: 12.5,
                color: BRAND.danger,
                margin: '6px 0 0',
                paddingLeft: 2,
                animation: 'error-in 0.3s ease both',
              }}>
                {errors.password}
              </p>
            )}
          </motion.div>

          {/* Submit button - Stagger: 0.52s */}
          <motion.button
            custom={4}
            variants={staggerVariants}
            initial="hidden"
            animate="visible"
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 18px',
              border: 'none',
              borderRadius: 16,
              background: `linear-gradient(155deg, ${BRAND.deep} 0%, ${BRAND.deepDark} 100%)`,
              color: '#fff',
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize: 16,
              letterSpacing: '0.01em',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: `${cssVars.clayOutSm}, 0 10px 20px rgba(77, 0, 81, 0.35)`,
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, opacity 0.15s ease',
              opacity: loading ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginTop: 6,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = `linear-gradient(155deg, ${BRAND.deepLight} 0%, ${BRAND.deep} 100%)`;
                e.currentTarget.style.boxShadow = `${cssVars.clayOutSm}, 0 14px 24px rgba(77, 0, 81, 0.42)`;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.background = `linear-gradient(155deg, ${BRAND.deep} 0%, ${BRAND.deepDark} 100%)`;
              e.currentTarget.style.boxShadow = `${cssVars.clayOutSm}, 0 10px 20px rgba(77, 0, 81, 0.35)`;
            }}
            onMouseDown={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = cssVars.clayPress;
              }
            }}
            onMouseUp={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `${cssVars.clayOutSm}, 0 14px 24px rgba(77, 0, 81, 0.42)`;
              }
            }}
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 16,
                  height: 16,
                  border: '2.5px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                }}
              />
            ) : (
              <span style={{ opacity: loading ? 0.75 : 1 }}>Masuk</span>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Version */}
      <p style={{
        position: 'absolute',
        left: '50%',
        bottom: 22,
        transform: 'translateX(-50%)',
        margin: 0,
        fontFamily: "'Poppins', sans-serif",
        fontSize: 12,
        color: 'rgba(91, 0, 95, 0.42)',
        zIndex: 4,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        {APP_VERSION}
      </p>
    </div>
  );
}

// ─── Main LoginPage Component ──────────────────────────────────────────────────
export default function LoginPage({ onLogin }) {
  const { isMobile } = useResponsive();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [shakeFields, setShakeFields] = useState({ username: false, password: false });
  const { handleLogin: doLoginContext } = useApp();

  const validate = () => {
    const errs = {};
    if (!username.trim()) errs.username = 'Username wajib diisi';
    else if (username.trim().length < 3) errs.username = 'Username minimal 3 karakter';
    if (!password) errs.password = 'Kata sandi wajib diisi';
    else if (password.length < 6) errs.password = 'Kata sandi minimal 6 karakter';
    return errs;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  const handleLogin = async () => {
    setGlobalError('');
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      // Trigger shake animation on error
      setShakeFields({
        username: !!errs.username,
        password: !!errs.password,
      });
      return;
    }
    setErrors({});
    setShakeFields({ username: false, password: false });
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', {
        username: username.trim(),
        password,
      });
      const loginPayload = response?.data?.data || {};
      doLoginContext({
        token: loginPayload.token,
        userId: loginPayload.userId,
        name: loginPayload.name,
        avatar: loginPayload.avatar,
        roleCode: loginPayload.roleCode || loginPayload.role,
        outletId: loginPayload.outletId,
        outletName: loginPayload.outletName,
        outlet: { id: loginPayload.outletId, name: loginPayload.outletName },
      });
      onLogin?.();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Login gagal. Coba lagi.';
      setGlobalError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Mobile view (keep as simple version)
  if (isMobile) {
    return (
      <div style={{
        minHeight: '100vh',
        background: `linear-gradient(145deg, ${BRAND.deep} 0%, #7A1481 45%, #9C3AA0 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: 24, zIndex: 1 }}
        >
          <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>
            Perawatan Ekstra untuk Baju Kesayanganmu.
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            width: '100%',
            maxWidth: 360,
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(20px)',
            borderRadius: 24,
            padding: '28px 24px',
            zIndex: 1,
          }}
        >
          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' }}>
            Selamat Datang 👋
          </h2>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
            Ayo masukan email dan password...
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukan email"
              style={{
                width: '100%',
                height: 48,
                padding: '0 16px',
                fontSize: 14,
                fontFamily: "'Poppins', sans-serif",
                border: '1.5px solid #e5e7eb',
                borderRadius: 12,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Kata Sandi
            </label>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukan kata sandi"
              style={{
                width: '100%',
                height: 48,
                padding: '0 16px',
                fontSize: 14,
                fontFamily: "'Poppins', sans-serif",
                border: '1.5px solid #e5e7eb',
                borderRadius: 12,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={handleLogin}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 12,
              border: 'none',
              background: `linear-gradient(135deg, ${BRAND.deep} 0%, ${BRAND.deepLighter} 100%)`,
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Poppins', sans-serif",
              cursor: 'pointer',
            }}
          >
            Masuk
          </button>

          <p style={{
            margin: '16px 0 0',
            fontFamily: "'Poppins', sans-serif",
            fontSize: 11,
            color: 'rgba(91, 0, 95, 0.55)',
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}>
            {APP_VERSION}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <HeroPanel />
      <FormPanel
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        showPass={showPass}
        setShowPass={setShowPass}
        loading={loading}
        errors={errors}
        globalError={globalError}
        handleLogin={handleLogin}
        handleKeyDown={handleKeyDown}
        shakeFields={shakeFields}
      />
    </div>
  );
}
