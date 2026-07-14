// ─────────────────────────────────────────────────────────────────────────────
// LoginPage.jsx — Login with Smooth 3D Blur Slide Carousel
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';

// ─── Static Asset Imports ─────────────────────────────────────────────────────
import loginSlide1 from '../../assets/login-slide-1.webp';
import loginSlide2 from '../../assets/login-slide-2.webp';
import loginSlide3 from '../../assets/login-slide-3.webp';

// ─── Carousel Slides Data ─────────────────────────────────────────────────────
const CAROUSEL_SLIDES = [
  {
    id: 'slide-1',
    image: loginSlide1,
    quote: 'Selamat datang di Wäschen!',
    subquote: 'Laundry profesional untuk baju kesayanganmu',
  },
  {
    id: 'slide-2',
    image: loginSlide2,
    quote: 'Layanan Express 24 Jam',
    subquote: 'Baju bersih dalam waktu singkat',
  },
  {
    id: 'slide-3',
    image: loginSlide3,
    quote: 'Perawatan Premium',
    subquote: 'Bahan sensitif ditangani dengan hati-hati',
  },
];

const APP_VERSION = 'My Waschen v2.0.0';

// ─── Brand tokens ───────────────────────────────────────────────────────────
const BRAND = {
  deep: '#5B005F',
  deepDark: '#4D0051',
  deepLight: '#7A1481',
  deepLighter: '#9C3AA0',
  deepPale: '#F3E3F5',
  deepSoft: '#AD80AF',
  accent: '#F93E11',
  accentLight: '#FF7A4D',
  foam: '#FFFFFF',
  danger: '#E4664A',
};

// ─── Blob Animations ─────────────────────────────────────────────────────────
const BLOB_ANIMATIONS = `
  @keyframes blobFloatA {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-15px, 18px) scale(1.08); }
  }
  @keyframes blobFloatB {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(20px, -14px) scale(1.12); }
  }
  @keyframes blobFloatC {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(12px, 10px) scale(0.92); }
  }
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
    10% { opacity: 1; transform: scale(1) rotate(45deg); }
    30% { opacity: 1; transform: scale(1.2) rotate(90deg); }
    50% { opacity: 0.8; transform: scale(0.9) rotate(135deg); }
    70% { opacity: 1; transform: scale(1.1) rotate(180deg); }
    90% { opacity: 0.5; transform: scale(0.8) rotate(225deg); }
  }
  @keyframes bubbleRise1 {
    0% { transform: translateY(0) translateX(0) scale(0); opacity: 0; }
    10% { opacity: 0.6; transform: translateY(-10vh) translateX(5px) scale(1); }
    40% { transform: translateY(-40vh) translateX(-8px) scale(1); }
    70% { transform: translateY(-70vh) translateX(10px) scale(0.9); }
    95% { opacity: 0.4; }
    100% { transform: translateY(-110vh) translateX(-5px) scale(0.8); opacity: 0; }
  }
  @keyframes bubbleRise2 {
    0% { transform: translateY(0) translateX(0) scale(0); opacity: 0; }
    10% { opacity: 0.5; transform: translateY(-10vh) translateX(-8px) scale(1); }
    40% { transform: translateY(-40vh) translateX(12px) scale(1); }
    70% { transform: translateY(-70vh) translateX(-6px) scale(0.85); }
    95% { opacity: 0.3; }
    100% { transform: translateY(-110vh) translateX(8px) scale(0.75); opacity: 0; }
  }
  @keyframes bubbleRise3 {
    0% { transform: translateY(0) translateX(0) scale(0); opacity: 0; }
    10% { opacity: 0.55; transform: translateY(-10vh) translateX(10px) scale(1); }
    40% { transform: translateY(-40vh) translateX(-5px) scale(0.95); }
    70% { transform: translateY(-70vh) translateX(8px) scale(0.9); }
    95% { opacity: 0.35; }
    100% { transform: translateY(-110vh) translateX(-10px) scale(0.7); opacity: 0; }
  }
  @keyframes meshShift {
    0%, 100% { transform: translate(0%, 0%) scale(1); }
    25% { transform: translate(3%, -2%) scale(1.05); }
    50% { transform: translate(-2%, 3%) scale(0.98); }
    75% { transform: translate(2%, 1%) scale(1.02); }
  }
  @keyframes meshShift2 {
    0%, 100% { transform: translate(0%, 0%) scale(1); }
    33% { transform: translate(-3%, 2%) scale(0.97); }
    66% { transform: translate(2%, -2%) scale(1.04); }
  }
`;

// ─── 4-Pointed Sparkle Star Component ──────────────────────────────────────────
function SparkleStars() {
  const sparkles = [
    { left: '15%', top: '20%', delay: '0s', duration: '3s', size: 18 },
    { left: '85%', top: '15%', delay: '0.8s', duration: '3.5s', size: 14 },
    { left: '25%', top: '60%', delay: '1.2s', duration: '2.8s', size: 16 },
    { left: '75%', top: '70%', delay: '0.4s', duration: '3.2s', size: 20 },
    { left: '50%', top: '35%', delay: '1.8s', duration: '2.5s', size: 12 },
    { left: '10%', top: '80%', delay: '0.6s', duration: '3.3s', size: 15 },
    { left: '90%', top: '45%', delay: '1.5s', duration: '2.9s', size: 18 },
    { left: '35%', top: '90%', delay: '0.3s', duration: '3.1s', size: 14 },
    { left: '60%', top: '12%', delay: '2s', duration: '2.7s', size: 16 },
    { left: '40%', top: '75%', delay: '1s', duration: '3.4s', size: 13 },
  ];

  return (
    <>
      {sparkles.map((sparkle, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: sparkle.left,
            top: sparkle.top,
            animation: `sparkle ${sparkle.duration} ease-in-out infinite ${sparkle.delay}`,
            pointerEvents: 'none',
          }}
        >
          {/* 4-pointed star SVG */}
          <svg
            width={sparkle.size}
            height={sparkle.size}
            viewBox="0 0 24 24"
            fill="rgba(255,255,255,0.85)"
            style={{
              filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))',
            }}
          >
            <path d="M12 0 L13.5 9 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 9 Z" />
          </svg>
        </div>
      ))}
    </>
  );
}

// ─── Floating Bubbles Component (Performance Optimized) ──────────────────────
function FloatingBubbles() {
  // Reduced bubble count for better performance
  const bubbles = [
    { left: '10%', size: 40, delay: '0s', duration: '15s', animation: 'bubbleRise1' },
    { left: '25%', size: 25, delay: '3s', duration: '18s', animation: 'bubbleRise2' },
    { left: '45%', size: 35, delay: '6s', duration: '16s', animation: 'bubbleRise3' },
    { left: '65%', size: 30, delay: '2s', duration: '17s', animation: 'bubbleRise1' },
    { left: '80%', size: 45, delay: '8s', duration: '19s', animation: 'bubbleRise2' },
    { left: '15%', size: 20, delay: '5s', duration: '14s', animation: 'bubbleRise3' },
    { left: '55%', size: 28, delay: '9s', duration: '16s', animation: 'bubbleRise1' },
    { left: '75%', size: 38, delay: '4s', duration: '18s', animation: 'bubbleRise2' },
  ];

  return (
    <>
      {bubbles.map((bubble, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: bubble.left,
            bottom: '-60px',
            width: bubble.size,
            height: bubble.size,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0) 100%)',
            backdropFilter: 'blur(3px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            animation: `${bubble.animation} ${bubble.duration} ease-in-out infinite ${bubble.delay}`,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </>
  );
}

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
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ─── Blur Slide Character Carousel (FIXED - smooth in & out, no jump) ────────
function CharacterCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('visible'); // 'visible' | 'exiting' | 'entering'
  const [instant, setInstant] = useState(false);  // matikan transition sesaat pas snap posisi awal
  const [direction, setDirection] = useState('next');
  const busyRef = useRef(false);

  const goToSlide = (idx, dir = 'next') => {
    if (busyRef.current || idx === currentIndex) return;
    busyRef.current = true;
    setDirection(dir);
    setPhase('exiting'); // 1) slide lama geser+blur keluar

    setTimeout(() => {
      // 2) ganti gambar SAAT posisi opacity masih 0 (nggak kelihatan)
      setCurrentIndex(idx);
      setInstant(true);
      setPhase('entering'); // taruh slide baru di sisi berlawanan, tanpa transisi (snap)

      // 3) di frame berikutnya, nyalakan lagi transition & animasikan ke posisi visible
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setInstant(false);
          setPhase('visible');
        });
      });
    }, 350);

    // lepas kunci setelah seluruh transisi selesai
    setTimeout(() => {
      busyRef.current = false;
    }, 750);
  };

  // Auto-advance every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      goToSlide((currentIndex + 1) % CAROUSEL_SLIDES.length, 'next');
    }, 5000);
    return () => clearInterval(timer);
  }, [currentIndex]);

  const handleDotClick = (idx) => {
    const dir = idx > currentIndex ? 'next' : 'prev';
    goToSlide(idx, dir);
  };

  const slide = CAROUSEL_SLIDES[currentIndex];

  // Hitung style transform/opacity/blur berdasarkan phase — INI KUNCINYA
  const getImageStyle = () => {
    const offset = direction === 'next' ? 60 : -60;

    if (phase === 'exiting') {
      return { transform: `translateX(${-offset}px) scale(1.05)`, opacity: 0, filter: 'blur(8px)' };
    }
    if (phase === 'entering') {
      return { transform: `translateX(${offset}px) scale(1.05)`, opacity: 0, filter: 'blur(8px)' };
    }
    // visible
    return { transform: 'translateX(0) scale(1)', opacity: 1, filter: 'blur(0px)' };
  };

  const imgStyle = getImageStyle();

  return (
    <div style={{
      position: 'relative',
      zIndex: 2,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      padding: '32px 48px',
      boxSizing: 'border-box',
    }}>
      {/* Image Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 560,
        flex: '0 0 auto',
        minHeight: 320,
        maxHeight: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginTop: 16,
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute',
          width: '90%',
          height: '90%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249, 62, 17, 0.35) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        <img
          src={slide.image}
          alt=""
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            filter: `drop-shadow(0 30px 60px rgba(30, 0, 32, 0.4)) ${imgStyle.filter}`,
            transform: imgStyle.transform,
            opacity: imgStyle.opacity,
            transition: instant
              ? 'none'
              : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), filter 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            zIndex: 1,
          }}
        />
      </div>

      {/* Quote Text with Blur Fade */}
      <div
        key={`quote-${currentIndex}`}
        className="quote-fade"
        style={{
          textAlign: 'center',
          marginTop: '24px',
          maxWidth: 480,
          minHeight: 90,
          width: '100%',
        }}
      >
        <h3 style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 24,
          fontWeight: 700,
          color: '#fff',
          margin: '0 0 10px',
          textShadow: '0 2px 20px rgba(0,0,0,0.3)',
          lineHeight: 1.3,
        }}>
          {slide.quote}
        </h3>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 15,
          color: 'rgba(255,255,255,0.85)',
          margin: 0,
          lineHeight: 1.6,
        }}>
          {slide.subquote}
        </p>
      </div>

      {/* Dot indicators */}
      <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
        {CAROUSEL_SLIDES.map((_, idx) => (
          <div
            key={idx}
            onClick={() => handleDotClick(idx)}
            style={{
              width: idx === currentIndex ? 28 : 8,
              height: 8,
              borderRadius: 4,
              background: idx === currentIndex
                ? 'linear-gradient(90deg, #F93E11, #FF7A4D)'
                : 'rgba(255,255,255,0.35)',
              cursor: 'pointer',
              transition: 'width 0.3s ease, background 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Cuma sisain animasi quote fade, animasi slide udah dihandle via inline style di atas */}
      <style>{`
        .quote-fade {
          animation: quoteFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes quoteFadeIn {
          0% { opacity: 0; transform: translateY(10px); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
      `}</style>
    </div>
  );
}

// ─── LEFT SIDE: Hero Panel ────────────────────────────────────────────────────
function HeroPanel() {
  useEffect(() => {
    const styleId = 'login-page-blobs';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = BLOB_ANIMATIONS;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  return (
    <div style={{
      width: '56%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      background: `
        radial-gradient(120% 140% at 15% 10%, ${BRAND.deep} 0%, ${BRAND.deepDark} 42%, #3A0040 100%)
      `,
      isolation: 'isolate',
    }}>
      {/* Mesh Background - behind everything */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute',
          width: '160%',
          height: '160%',
          top: '-30%',
          left: '-30%',
          background: `
            radial-gradient(ellipse 50% 50% at 25% 30%, rgba(232, 90, 168, 0.35) 0%, transparent 55%),
            radial-gradient(ellipse 40% 60% at 75% 65%, rgba(139, 92, 246, 0.25) 0%, transparent 50%)
          `,
          filter: 'blur(60px)',
          animation: 'meshShift 20s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          width: '140%',
          height: '140%',
          top: '-20%',
          left: '-20%',
          background: `
            radial-gradient(ellipse 45% 55% at 60% 25%, rgba(95, 217, 174, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse 50% 40% at 30% 75%, rgba(59, 130, 246, 0.2) 0%, transparent 55%)
          `,
          filter: 'blur(80px)',
          animation: 'meshShift2 25s ease-in-out infinite',
        }} />
      </div>

      {/* Sparkle Stars - above mesh */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <SparkleStars />
      </div>

      {/* Decorative blobs - above mesh */}
      <div style={{
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(232,90,168,0.4) 0%, transparent 70%)',
        top: '-60px',
        right: '-40px',
        filter: 'blur(50px)',
        animation: 'blobFloatB 14s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      <div style={{
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(95,217,174,0.35) 0%, transparent 70%)',
        bottom: '15%',
        left: '-50px',
        filter: 'blur(40px)',
        animation: 'blobFloatC 16s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      <div style={{
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        top: '30%',
        right: '8%',
        filter: 'blur(30px)',
        animation: 'blobFloatA 11s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Floating Bubbles - above blobs */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
        <FloatingBubbles />
      </div>

      {/* Floor gradient */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 120,
        background: 'linear-gradient(to top, rgba(58, 0, 64, 0.5), rgba(58, 0, 64, 0.15), transparent)',
        zIndex: 3,
        pointerEvents: 'none',
      }} />

      {/* Character Carousel - centered overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <CharacterCarousel />
      </div>
    </div>
  );
}

// ─── RIGHT SIDE: Login Form ───────────────────────────────────────────────────
function FormPanel({ username, setUsername, password, setPassword, showPass, setShowPass, loading, errors, globalError, handleLogin, handleKeyDown }) {
  return (
    <div style={{
      width: '44%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8F4F9',
    }}>
      {/* Mesh gradient background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 60% 50% at 20% 30%, rgba(192, 36, 125, 0.08) 0%, transparent 60%),
          radial-gradient(ellipse 50% 60% at 80% 70%, rgba(95, 217, 174, 0.1) 0%, transparent 55%),
          radial-gradient(ellipse 70% 40% at 50% 10%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
          radial-gradient(ellipse 40% 50% at 10% 80%, rgba(232, 90, 168, 0.07) 0%, transparent 55%),
          radial-gradient(ellipse 55% 45% at 90% 20%, rgba(249, 62, 17, 0.05) 0%, transparent 50%)
        `,
        animation: 'meshShift 18s ease-in-out infinite',
      }} />

      {/* Login card - Glassmorphism form */}
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        borderRadius: 24,
        padding: '30px 28px',
        boxShadow: '0 24px 50px -18px rgba(59, 11, 71, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        position: 'relative',
        zIndex: 2,
      }}>
        {/* Badge */}
        <span style={{
          display: 'inline-block',
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: '0.5px',
          color: '#C0247D',
          background: 'rgba(192, 36, 125, 0.12)',
          padding: '6px 14px',
          borderRadius: 999,
        }}>
          SELAMAT DATANG KEMBALI
        </span>

        {/* Header */}
        <div style={{ marginTop: 14 }}>
          <h2 style={{
            fontFamily: "'Poppins', 'Outfit', sans-serif",
            fontWeight: 700,
            fontSize: 24,
            color: '#3B0B47',
            margin: 0,
          }}>
            Masuk ke akun Anda
          </h2>
          <p style={{
            fontSize: 13,
            color: '#7A6584',
            marginTop: 8,
            lineHeight: 1.5,
          }}>
            Kelola pesanan laundry Anda dengan mudah dan cepat.
          </p>
        </div>

        {/* Global error message */}
        {globalError && (
          <div style={{
            background: 'rgba(228, 102, 74, 0.08)',
            border: '1px solid rgba(228, 102, 74, 0.22)',
            borderRadius: 16,
            padding: '12px 16px',
            marginTop: 20,
          }}>
            <p style={{ fontSize: 13, color: '#E4664A', margin: 0, fontWeight: 500 }}>
              {globalError}
            </p>
          </div>
        )}

        <div onKeyDown={handleKeyDown}>
          {/* Username field */}
          <div style={{ marginTop: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#3B0B47',
            }}>
              Username
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 8,
              background: 'linear-gradient(145deg, #F0EAF6, #F7F2FA)',
              borderRadius: 12,
              padding: '12px 14px',
              boxShadow: 'inset 2px 2px 6px rgba(59, 11, 71, 0.08), inset -2px -2px 5px rgba(255, 255, 255, 0.7)',
            }}>
              <span style={{ color: '#C0247D', flexShrink: 0, display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                </svg>
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                style={{
                  border: 'none',
                  background: 'none',
                  outline: 'none',
                  flex: 1,
                  fontSize: 13.5,
                  fontFamily: "'Poppins', 'Plus Jakarta Sans', sans-serif",
                  color: '#2B1130',
                }}
              />
              {username && (
                <button
                  type="button"
                  onClick={() => setUsername('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: '#9ca3af',
                    cursor: 'pointer',
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
              <p style={{ fontSize: 12.5, color: '#E4664A', margin: '6px 0 0' }}>
                {errors.username}
              </p>
            )}
          </div>

          {/* Password field */}
          <div style={{ marginTop: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#3B0B47',
            }}>
              Kata sandi
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 8,
              background: 'linear-gradient(145deg, #F0EAF6, #F7F2FA)',
              borderRadius: 12,
              padding: '12px 14px',
              boxShadow: 'inset 2px 2px 6px rgba(59, 11, 71, 0.08), inset -2px -2px 5px rgba(255, 255, 255, 0.7)',
            }}>
              <span style={{ color: '#C0247D', flexShrink: 0, display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                autoComplete="current-password"
                style={{
                  border: 'none',
                  background: 'none',
                  outline: 'none',
                  flex: 1,
                  fontSize: 13.5,
                  fontFamily: "'Poppins', 'Plus Jakarta Sans', sans-serif",
                  color: '#2B1130',
                }}
              />
              <button
                onClick={() => setShowPass(!showPass)}
                type="button"
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#7A6584',
                  cursor: 'pointer',
                }}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p style={{ fontSize: 12.5, color: '#E4664A', margin: '6px 0 0' }}>
                {errors.password}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 24,
              background: loading
                ? '#9ca3af'
                : 'linear-gradient(150deg, #8A3FA0 0%, #3B0B47 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14.5,
              padding: 15,
              border: 'none',
              borderRadius: 16,
              boxShadow: '-4px -4px 10px rgba(255, 255, 255, 0.1), 6px 10px 20px rgba(59, 11, 71, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.12s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => {
              if (!loading) e.currentTarget.style.transform = 'translateY(1px) scale(0.99)';
            }}
            onMouseUp={(e) => {
              if (!loading) e.currentTarget.style.transform = 'translateY(0) scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
            }}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </div>
      </div>

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
      return;
    }
    setErrors({});
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

  // Mobile / Portrait view
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
        {/* ── Animated Mesh Background (mobile) ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          zIndex: 0,
          pointerEvents: 'none',
        }}>
          {/* Mesh layer 1 */}
          <div style={{
            position: 'absolute',
            width: '180%',
            height: '180%',
            top: '-40%',
            left: '-40%',
            background: `
              radial-gradient(ellipse 50% 50% at 30% 30%, rgba(232, 90, 168, 0.35) 0%, transparent 55%),
              radial-gradient(ellipse 40% 60% at 70% 70%, rgba(139, 92, 246, 0.25) 0%, transparent 50%)
            `,
            filter: 'blur(50px)',
            animation: 'meshShift 18s ease-in-out infinite',
          }} />
          {/* Mesh layer 2 */}
          <div style={{
            position: 'absolute',
            width: '160%',
            height: '160%',
            top: '-30%',
            left: '-30%',
            background: `
              radial-gradient(ellipse 45% 55% at 60% 25%, rgba(95, 217, 174, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse 50% 40% at 35% 75%, rgba(59, 130, 246, 0.2) 0%, transparent 55%)
            `,
            filter: 'blur(70px)',
            animation: 'meshShift2 22s ease-in-out infinite',
          }} />
        </div>

        {/* Sparkle stars for mobile */}
        <SparkleStars />

        {/* Floating bubbles for mobile */}
        <FloatingBubbles />

        {/* Animated glowing orbs */}
        <div style={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
          top: '10%',
          right: '-50px',
          filter: 'blur(40px)',
          animation: 'blobFloatA 12s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 1,
        }} />
        <div style={{
          position: 'absolute',
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,62,17,0.2) 0%, transparent 70%)',
          bottom: '20%',
          left: '-40px',
          filter: 'blur(35px)',
          animation: 'blobFloatB 14s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 1,
        }} />

        {/* Login form card - same style as desktop */}
        <div style={{
          width: '100%',
          maxWidth: 380,
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
          borderRadius: 24,
          padding: '28px 24px',
          boxShadow: '0 24px 50px -18px rgba(59, 11, 71, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          position: 'relative',
          zIndex: 10,
        }}>
          {/* Badge */}
          <span style={{
            display: 'inline-block',
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: '0.5px',
            color: '#C0247D',
            background: 'rgba(192, 36, 125, 0.12)',
            padding: '6px 14px',
            borderRadius: 999,
          }}>
            SELAMAT DATANG KEMBALI
          </span>

          {/* Header */}
          <div style={{ marginTop: 14 }}>
            <h2 style={{
              fontFamily: "'Poppins', 'Outfit', sans-serif",
              fontSize: 22,
              fontWeight: 700,
              color: '#3B0B47',
              margin: 0,
            }}>
              Masuk ke akun Anda
            </h2>
            <p style={{
              fontSize: 13,
              color: '#7A6584',
              marginTop: 8,
              lineHeight: 1.5,
            }}>
              Kelola pesanan laundry Anda dengan mudah dan cepat.
            </p>
          </div>

          {/* Global error message */}
          {globalError && (
            <div style={{
              background: 'rgba(228, 102, 74, 0.08)',
              border: '1px solid rgba(228, 102, 74, 0.22)',
              borderRadius: 16,
              padding: '12px 16px',
              marginTop: 20,
            }}>
              <p style={{ fontSize: 13, color: '#E4664A', margin: 0, fontWeight: 500 }}>
                {globalError}
              </p>
            </div>
          )}

          {/* Username field */}
          <div style={{ marginTop: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#3B0B47',
            }}>
              Username
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 8,
              background: 'linear-gradient(145deg, #F0EAF6, #F7F2FA)',
              borderRadius: 12,
              padding: '12px 14px',
              boxShadow: 'inset 2px 2px 6px rgba(59, 11, 71, 0.08), inset -2px -2px 5px rgba(255, 255, 255, 0.7)',
            }}>
              <span style={{ color: '#C0247D', flexShrink: 0, display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                </svg>
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                style={{
                  border: 'none',
                  background: 'none',
                  outline: 'none',
                  flex: 1,
                  fontSize: 13.5,
                  fontFamily: "'Poppins', 'Plus Jakarta Sans', sans-serif",
                  color: '#2B1130',
                }}
              />
              {username && (
                <button
                  type="button"
                  onClick={() => setUsername('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: '#9ca3af',
                    cursor: 'pointer',
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
              <p style={{ fontSize: 12.5, color: '#E4664A', margin: '6px 0 0' }}>
                {errors.username}
              </p>
            )}
          </div>

          {/* Password field */}
          <div style={{ marginTop: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#3B0B47',
            }}>
              Kata sandi
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 8,
              background: 'linear-gradient(145deg, #F0EAF6, #F7F2FA)',
              borderRadius: 12,
              padding: '12px 14px',
              boxShadow: 'inset 2px 2px 6px rgba(59, 11, 71, 0.08), inset -2px -2px 5px rgba(255, 255, 255, 0.7)',
            }}>
              <span style={{ color: '#C0247D', flexShrink: 0, display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                autoComplete="current-password"
                style={{
                  border: 'none',
                  background: 'none',
                  outline: 'none',
                  flex: 1,
                  fontSize: 13.5,
                  fontFamily: "'Poppins', 'Plus Jakarta Sans', sans-serif",
                  color: '#2B1130',
                }}
              />
              <button
                onClick={() => setShowPass(!showPass)}
                type="button"
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#7A6584',
                  cursor: 'pointer',
                }}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p style={{ fontSize: 12.5, color: '#E4664A', margin: '6px 0 0' }}>
                {errors.password}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 24,
              background: loading
                ? '#9ca3af'
                : 'linear-gradient(150deg, #8A3FA0 0%, #3B0B47 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14.5,
              padding: 15,
              border: 'none',
              borderRadius: 16,
              boxShadow: '-4px -4px 10px rgba(255, 255, 255, 0.1), 6px 10px 20px rgba(59, 11, 71, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.12s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => {
              if (!loading) e.currentTarget.style.transform = 'translateY(1px) scale(0.99)';
            }}
            onMouseUp={(e) => {
              if (!loading) e.currentTarget.style.transform = 'translateY(0) scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
            }}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>

          {/* Version */}
          <p style={{
            margin: '20px 0 0',
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
        </div>
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
      />
    </div>
  );
}