// ─────────────────────────────────────────────────────────────────────────────
// LoginPage.jsx — Premium Desktop Redesign (Reference Match)
// Following reference images from user
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { GRADIENTS } from '../../utils/designSystem';
import { useApp } from '../../context/AppContext';
import waschenLogo from '../images/waschen.webp'

// ─── Assets ───────────────────────────────────────────────────────────────────
import fullSayHi from '../karakter Perempuan/full-say-hi.webp'
import soapBottle from '../Decorative icon/soap-bottle.webp'
import towelFolded from '../Decorative icon/towel-folded.webp'
import hanger from '../Decorative icon/hanger.webp'
import clothWithHanger from '../Decorative icon/cloth-with-hanger.webp'
import clothBasket from '../Decorative icon/cloth-basket.webp'

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
const IconUser = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconLock = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconEye = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94a10.07 10.07 0 0 1-5.94 2.06" />
    <path d="M9.9 4.24a9.12 9.12 0 0 1 6.1 2.76" />
    <path d="M12 4c-7 0-11 8-11 8a18.45 18.45 0 0 0 5.06 5.94" />
    <path d="M12 4c7 0 11 8 11 8a18.45 18.45 0 0 0-5.06-5.94" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const IconArrowRight = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// ─── Floating Visual Helpers ─────────────────────────────────────────────────
const BubbleOrb = ({ size = 80, delay = 0, duration = 8, opacity = 0.4, style = {} }) => (
  <motion.div
    animate={{ y: [0, -12, 0], x: [0, 4, 0], scale: [1, 1.04, 1], opacity: [opacity, opacity + 0.12, opacity] }}
    transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    style={{
      position: 'absolute',
      width: size,
      height: size,
      pointerEvents: 'none',
      ...style,
    }}
  >
    <div style={{
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.5) 16%, rgba(255,255,255,0.16) 38%, rgba(214,235,255,0.14) 58%, transparent 76%)',
      border: '1px solid rgba(255,255,255,0.3)',
      boxShadow: 'inset 0 0 16px rgba(255,255,255,0.45), 0 12px 24px rgba(14, 18, 55, 0.12)',
      backdropFilter: 'blur(2px)',
    }} />
  </motion.div>
);

const Sparkle = ({ size = 16, delay = 0, style = {} }) => (
  <motion.svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    animate={{ scale: [0.85, 1.05, 0.85], opacity: [0.45, 1, 0.45], rotate: [0, 10, 0] }}
    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay }}
    style={{ position: 'absolute', width: size, height: size, pointerEvents: 'none', ...style }}
  >
    <path d="M12 1.5L14.9 9.1L22.5 12L14.9 14.9L12 22.5L9.1 14.9L1.5 12L9.1 9.1L12 1.5Z" fill="rgba(255,255,255,0.95)" />
  </motion.svg>
);

const Leaf = ({ size = 36, delay = 0, style = {} }) => (
  <motion.svg
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
    animate={{ rotate: [-7, 7, -7], y: [0, -4, 0] }}
    transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay }}
    style={{ position: 'absolute', width: size, height: size, pointerEvents: 'none', ...style }}
  >
    <path d="M10 30C13 13 26 6 38 10C34 25 25 35 10 30Z" fill="url(#leafGradient)" />
    <defs>
      <linearGradient id="leafGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A8F0C1" />
        <stop offset="100%" stopColor="#4ABF83" />
      </linearGradient>
    </defs>
    <path d="M13 28C20 23 27 18 35 12" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" />
  </motion.svg>
);

const Confetti = ({ size = 8, delay = 0, style = {} }) => (
  <motion.div
    animate={{ y: [0, -8, 0], rotate: [0, 18, 0], opacity: [0.55, 1, 0.55] }}
    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay }}
    style={{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: 4,
      background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(253, 200, 147, 0.88))',
      boxShadow: '0 6px 12px rgba(10, 15, 42, 0.08)',
      pointerEvents: 'none',
      ...style,
    }}
  />
);

const SteamPuff = ({ size = 74, delay = 0, style = {} }) => (
  <motion.div
    animate={{ y: [0, -18, -28], opacity: [0, 0.9, 0] }}
    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut', delay }}
    style={{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.18) 38%, transparent 70%)',
      filter: 'blur(2px)',
      pointerEvents: 'none',
      ...style,
    }}
  />
);

const DottedArrow = ({ style = {} }) => (
  <motion.svg
    viewBox="0 0 240 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay: 0.4 }}
    style={{ position: 'absolute', width: 170, height: 90, pointerEvents: 'none', ...style }}
  >
    <path d="M14 18C76 8 116 26 152 48C175 62 194 68 224 58" stroke="rgba(255,255,255,0.92)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 10" />
    <path d="M212 51L226 58L212 65" stroke="rgba(255,255,255,0.92)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
  </motion.svg>
);

// Each "scene" component below now accepts a `style` override so it can be
// positioned precisely (percentage-based) from where it's used, and a
// `width`/`height` so it can be sized to match the reference composition
// instead of the previous oversized fixed dimensions.
const CalendarCard = ({ style = {} }) => (
  <motion.div
    animate={{ y: [0, -6, 0], rotate: [-1, 1, -1] }}
    transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
    style={{
      position: 'absolute',
      width: 96,
      height: 100,
      borderRadius: 18,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(229, 234, 255, 0.9))',
      boxShadow: '0 16px 26px rgba(10, 15, 42, 0.16), inset 0 1px 0 rgba(255,255,255,0.9)',
      border: '1px solid rgba(255,255,255,0.55)',
      padding: '10px 10px 8px',
      zIndex: 10,
      ...style,
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6A86FF' }} />
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6A86FF' }} />
    </div>
    <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, color: '#24315E', fontSize: 10, marginBottom: 8 }}>Calendar</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
      {Array.from({ length: 12 }).map((_, index) => (
        <span key={index} style={{ width: 8, height: 8, borderRadius: '50%', background: index % 3 === 0 ? '#7FA6FF' : 'rgba(127, 166, 255, 0.35)' }} />
      ))}
    </div>
  </motion.div>
);

const LaundryMachine = ({ style = {}, width = 200, height = 214 }) => (
  <motion.div
    animate={{ y: [0, -5, 0] }}
    transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
    style={{
      position: 'absolute',
      width,
      height,
      zIndex: 3,
      filter: 'drop-shadow(0 20px 26px rgba(8, 11, 30, 0.24))',
      ...style,
    }}
  >
    <div style={{
      position: 'absolute',
      inset: 0,
      borderRadius: 26,
      background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F7FF 62%, #E2E8F5 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -12px 20px rgba(84, 103, 154, 0.08)',
      border: '1px solid rgba(255,255,255,0.55)',
    }} />
    <div style={{
      position: 'absolute',
      left: 12,
      right: 12,
      top: 10,
      height: 34,
      borderRadius: 16,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(225,233,251,0.72))',
      border: '1px solid rgba(255,255,255,0.55)',
    }} />
    <div style={{
      position: 'absolute',
      left: '50%',
      top: '52%',
      width: '58%',
      height: '58%',
      transform: 'translate(-50%, -50%)',
      borderRadius: '50%',
      background: 'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.98) 0%, rgba(232,238,255,0.92) 22%, rgba(177,194,232,0.76) 45%, rgba(76, 94, 142, 0.9) 72%, rgba(20, 25, 45, 1) 100%)',
      boxShadow: 'inset 0 0 0 8px rgba(255,255,255,0.48), 0 16px 24px rgba(14, 17, 38, 0.34)',
    }} />
    <div style={{
      position: 'absolute',
      left: '50%',
      top: '52%',
      width: '42%',
      height: '42%',
      transform: 'translate(-50%, -50%)',
      borderRadius: '50%',
      background: 'radial-gradient(circle at 36% 30%, rgba(60, 79, 132, 1) 0%, rgba(31, 38, 70, 1) 62%, rgba(14, 17, 30, 1) 100%)',
      boxShadow: 'inset 0 2px 14px rgba(255,255,255,0.12)',
    }} />
    <div style={{ position: 'absolute', left: 20, right: 20, bottom: 14, height: 13, borderRadius: 999, background: 'linear-gradient(180deg, rgba(166,178,213,0.76), rgba(120,131,161,0.86))' }} />
    <div style={{ position: 'absolute', left: 18, top: 54, width: 14, height: 46, borderRadius: 7, background: 'linear-gradient(180deg, #dfe7f7, #b0bdd9)' }} />
    <div style={{ position: 'absolute', right: 18, top: 52, width: 15, height: 15, borderRadius: '50%', background: '#6c86f0', boxShadow: '0 0 0 3px rgba(108, 134, 240, 0.18)' }} />
    <div style={{ position: 'absolute', right: 18, top: 72, width: 15, height: 8, borderRadius: 999, background: '#ff9c74' }} />
    <div style={{ position: 'absolute', right: 18, top: 86, width: 15, height: 8, borderRadius: 999, background: '#73d7b5' }} />
  </motion.div>
);

const Iron = ({ style = {}, width = 108, height = 80 }) => (
  <motion.div
    animate={{ y: [0, -4, 0], rotate: [-2, 1, -2] }}
    transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
    style={{
      position: 'absolute',
      width,
      height,
      zIndex: 2,
      filter: 'drop-shadow(0 14px 22px rgba(9, 14, 36, 0.26))',
      ...style,
    }}
  >
    <div style={{
      position: 'absolute',
      left: 6,
      right: 6,
      top: 12,
      bottom: 8,
      borderRadius: '42% 58% 34% 66% / 56% 49% 51% 44%',
      background: 'linear-gradient(180deg, #FFFFFF 0%, #E9EEF7 58%, #C7D0E4 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
      clipPath: 'polygon(8% 42%, 56% 16%, 100% 100%, 14% 100%)',
    }} />
    <div style={{ position: 'absolute', left: 18, top: 1, width: 56, height: 18, borderRadius: 11, background: 'linear-gradient(180deg, #725d96 0%, #2f2447 100%)', boxShadow: '0 6px 12px rgba(0,0,0,0.22)' }} />
    <div style={{ position: 'absolute', left: 10, right: 17, bottom: 8, height: 10, borderRadius: 9, background: 'linear-gradient(180deg, #A5AECA, #7B86A4)' }} />
  </motion.div>
);

// ─── LEFT SIDE: Hero Panel ────────────────────────────────────────────────────
function HeroPanel() {
  return (
    <div style={{
      width: '50%',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #4D0051 0%, #5B005F 28%, #6F40B1 58%, #4E82FF 100%)',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 20% 18%, rgba(255,255,255,0.18), transparent 28%), radial-gradient(circle at 66% 22%, rgba(255,255,255,0.12), transparent 20%), radial-gradient(circle at 55% 80%, rgba(82, 255, 205, 0.14), transparent 24%), linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0))',
      }} />

      {/* Ambient bubbles kept large-scale and near the edges only, so they
          never sit on top of the headline or the character/machine scene. */}
      <BubbleOrb size={100} style={{ top: '3%', left: '6%' }} delay={0.2} duration={7.2} opacity={0.3} />
      <BubbleOrb size={64} style={{ top: '10%', right: '10%' }} delay={1.2} duration={8.1} opacity={0.28} />
      <BubbleOrb size={54} style={{ bottom: '30%', left: '3%' }} delay={0.7} duration={7.5} opacity={0.24} />
      <BubbleOrb size={70} style={{ bottom: '6%', right: '6%' }} delay={0.4} duration={7.9} opacity={0.26} />
      <BubbleOrb size={40} style={{ top: '32%', right: '4%' }} delay={0.9} duration={7.7} opacity={0.2} />
      <BubbleOrb size={36} style={{ bottom: '38%', right: '20%' }} delay={0.5} duration={8.3} opacity={0.2} />

      <Sparkle size={16} style={{ top: '9%', left: '48%' }} delay={0.1} />
      <Sparkle size={12} style={{ top: '22%', right: '10%' }} delay={0.9} />

      {/* ─── Logo ─── */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ position: 'absolute', top: 36, left: 40, zIndex: 20 }}
      >
        <img src={waschenLogo} alt="Wäschen" style={{ width: 130, height: 39, objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.22))' }} />
      </motion.div>

      {/* ─── Headline ─── */}
      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.2 }}
        style={{
          position: 'absolute',
          top: '9%',
          left: '6%',
          width: '58%',
          zIndex: 18,
        }}
      >
        <h1 style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 40,
          lineHeight: 1.12,
          letterSpacing: '-0.03em',
          fontWeight: 800,
          color: '#fff',
          margin: 0,
          textShadow: '0 14px 28px rgba(7, 10, 24, 0.22)',
        }}>
          Perawatan Ekstra untuk Baju Kesayanganmu.
        </h1>
      </motion.div>

      {/* small dotted arrow pointing from the headline toward the calendar card */}
      <DottedArrow style={{ top: '20%', right: '9%' }} />

      {/* ─── Calendar card, top-right corner ─── */}
      <CalendarCard style={{ top: '7%', right: '5%' }} />

      {/* ─── Scene: character, machine, iron, decorative icons ───
          Everything below is sized and positioned relative to the panel
          itself (not an inner wrapper) so percentages stay predictable. */}

      {/* character — anchored bottom-left, moderate size */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: '8%',
          bottom: 0,
          width: 148,
          height: 402,
          zIndex: 9,
          filter: 'drop-shadow(0 22px 30px rgba(10, 14, 36, 0.3))',
        }}
      >
        <img src={fullSayHi} alt="Staff" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </motion.div>

      {/* iron — small, sitting to the left of the character */}
      <Iron style={{ left: '2%', bottom: '4%' }} width={104} height={78} />

      {/* washing machine — center of the scene, slightly right of character */}
      <LaundryMachine style={{ left: '34%', bottom: '3%' }} width={200} height={214} />

      {/* soap bottle — resting on top edge of the washing machine */}
      <motion.div
        animate={{ y: [0, -6, 0], rotate: [-1, 1, -1] }}
        transition={{ duration: 4.9, repeat: Infinity, ease: 'easeInOut', delay: 0.18 }}
        style={{ position: 'absolute', left: '48%', bottom: '30%', zIndex: 7, filter: 'drop-shadow(0 14px 22px rgba(10, 14, 36, 0.22))' }}
      >
        <img src={soapBottle} alt="" style={{ width: 60, height: 98, objectFit: 'contain' }} />
      </motion.div>

      {/* folded towels — stacked next to the character */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 0.35 }}
        style={{ position: 'absolute', left: '20%', bottom: '30%', zIndex: 4, filter: 'drop-shadow(0 14px 24px rgba(10, 14, 36, 0.2))' }}
      >
        <img src={towelFolded} alt="" style={{ width: 96, height: 76, objectFit: 'contain' }} />
      </motion.div>

      {/* shirt on hanger — near the character's raised hand */}
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', left: '15%', top: '32%', zIndex: 8, filter: 'drop-shadow(0 14px 22px rgba(10, 14, 36, 0.22))' }}
      >
        <img src={clothWithHanger} alt="" style={{ width: 82, height: 83, objectFit: 'contain' }} />
      </motion.div>

      {/* cloth basket — near the character's feet */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        style={{ position: 'absolute', left: '13%', bottom: '10%', zIndex: 6, filter: 'drop-shadow(0 14px 22px rgba(10, 14, 36, 0.2))' }}
      >
        <img src={clothBasket} alt="" style={{ width: 82, height: 60, objectFit: 'contain' }} />
      </motion.div>

      {/* hanger — floating above the machine, to the right */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5.1, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        style={{ position: 'absolute', left: '52%', top: '30%', zIndex: 8, filter: 'drop-shadow(0 14px 20px rgba(10, 14, 36, 0.2))' }}
      >
        <img src={hanger} alt="" style={{ width: 56, height: 50, objectFit: 'contain' }} />
      </motion.div>

      {/* "Wangi" speech bubble, near the machine drum */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        style={{
          position: 'absolute',
          left: '58%',
          bottom: '22%',
          zIndex: 11,
          padding: '8px 16px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.92)',
          fontFamily: "'Poppins', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: '#3A2E52',
          boxShadow: '0 10px 20px rgba(10, 14, 36, 0.18)',
        }}
      >
        Wangi
      </motion.div>

      {/* steam puffs rising near the iron */}
      <SteamPuff size={54} style={{ left: '5%', bottom: '11%' }} delay={0.1} />
      <SteamPuff size={42} style={{ left: '8%', bottom: '13%' }} delay={0.55} />

      {/* pagination dots, bottom center */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '3%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 20px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.14)',
          backdropFilter: 'blur(8px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.24)',
        }}
      >
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.38)' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.96)', boxShadow: '0 0 0 4px rgba(255,255,255,0.12)' }} />
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.38)' }} />
      </motion.div>
    </div>
  );
}

// ─── RIGHT SIDE: Login Form ───────────────────────────────────────────────────
function FormPanel({ username, setUsername, password, setPassword, showPass, setShowPass, loading, errors, globalError, handleLogin, handleKeyDown }) {
  return (
    <div style={{
      width: '50%',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #FEFEFF 0%, #F8FAFF 28%, #FFF9F7 58%, #F3FFF8 100%)',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 18% 18%, rgba(196, 223, 255, 0.22) 0%, transparent 26%), radial-gradient(circle at 80% 18%, rgba(236, 214, 255, 0.20) 0%, transparent 24%), radial-gradient(circle at 72% 84%, rgba(186, 255, 232, 0.18) 0%, transparent 24%), radial-gradient(circle at 18% 78%, rgba(255, 226, 210, 0.16) 0%, transparent 22%)',
      }} />

      <BubbleOrb size={92} style={{ top: '7%', left: '8%' }} delay={0.3} duration={8.4} opacity={0.22} />
      <BubbleOrb size={64} style={{ top: '20%', right: '9%' }} delay={1.0} duration={7.7} opacity={0.2} />
      <BubbleOrb size={110} style={{ bottom: '14%', right: '7%' }} delay={0.6} duration={8.8} opacity={0.24} />
      <BubbleOrb size={74} style={{ bottom: '11%', left: '12%' }} delay={1.3} duration={7.9} opacity={0.18} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.2 }}
        style={{
          width: 'min(520px, calc(100% - 72px))',
          padding: '58px 56px 54px',
          borderRadius: 36,
          background: 'rgba(255, 255, 255, 0.72)',
          border: '1px solid rgba(255, 255, 255, 0.7)',
          boxShadow: '0 28px 80px rgba(24, 33, 74, 0.12), 0 8px 24px rgba(24, 33, 74, 0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          position: 'relative',
          zIndex: 5,
        }}
      >
        <div style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 32,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            fontWeight: 800,
            color: '#1E2438',
            margin: '0 0 10px',
          }}>
            Selamat Datang
          </h2>
          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 15,
            color: '#667085',
            margin: 0,
          }}>
            Masukkan email dan password untuk masuk ke akun Anda.
          </p>
        </div>

        <AnimatePresence>
          {globalError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.18)',
                borderRadius: 16,
                padding: '12px 16px',
                marginBottom: 18,
              }}
            >
              <p style={{ fontSize: 13, color: '#C62828', margin: 0, fontWeight: 500 }}>
                {globalError}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div onKeyDown={handleKeyDown}>
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block',
              fontFamily: "'Poppins', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: '#344054',
              marginBottom: 8,
            }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: 18,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#98A2B3',
              }}>
                <IconUser size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukan email"
                autoComplete="username"
                style={{
                  width: '100%',
                  height: 58,
                  padding: '0 52px 0 50px',
                  fontSize: 14,
                  fontFamily: "'Poppins', sans-serif",
                  color: '#1E2438',
                  background: 'rgba(255,255,255,0.92)',
                  border: `1.5px solid ${errors.username ? '#dc2626' : 'rgba(194, 203, 217, 0.92)'}`,
                  borderRadius: 18,
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = errors.username ? '#dc2626' : '#6A86FF';
                  e.target.style.boxShadow = '0 0 0 4px rgba(106, 134, 255, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.username ? '#dc2626' : 'rgba(194, 203, 217, 0.92)';
                  e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.95)';
                }}
              />
            </div>
            {errors.username && (
              <p style={{ fontSize: 11, color: '#dc2626', margin: '6px 0 0', fontWeight: 500 }}>{errors.username}</p>
            )}
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{
              display: 'block',
              fontFamily: "'Poppins', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: '#344054',
              marginBottom: 8,
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: 18,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#98A2B3',
              }}>
                <IconLock size={18} />
              </div>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukan kata sandi"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  height: 58,
                  padding: '0 56px 0 50px',
                  fontSize: 14,
                  fontFamily: "'Poppins', sans-serif",
                  color: '#1E2438',
                  background: 'rgba(255,255,255,0.92)',
                  border: `1.5px solid ${errors.password ? '#dc2626' : 'rgba(194, 203, 217, 0.92)'}`,
                  borderRadius: 18,
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = errors.password ? '#dc2626' : '#6A86FF';
                  e.target.style.boxShadow = '0 0 0 4px rgba(106, 134, 255, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.password ? '#dc2626' : 'rgba(194, 203, 217, 0.92)';
                  e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.95)';
                }}
              />
              <button
                onClick={() => setShowPass(!showPass)}
                type="button"
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#667085',
                  padding: 6,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPass ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p style={{ fontSize: 11, color: '#dc2626', margin: '6px 0 0', fontWeight: 500 }}>{errors.password}</p>
            )}
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="login-btn"
            style={{
              width: '100%',
              height: 58,
              borderRadius: 18,
              border: 'none',
              background: 'linear-gradient(135deg, #2F80FF 0%, #4FA0FF 50%, #6FD1FF 100%)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Poppins', sans-serif",
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: '0 16px 28px rgba(47, 128, 255, 0.28)',
              transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.2s',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 22,
                  height: 22,
                  border: '3px solid rgba(255,255,255,0.32)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                }}
              />
            ) : (
              <>LOGIN <IconArrowRight size={18} /></>
            )}
          </button>
        </div>
      </motion.div>
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

  // Preload assets
  useEffect(() => {
    [fullSayHi, soapBottle, towelFolded, hanger, clothWithHanger, clothBasket].forEach((src) => {
      if (src) {
        const img = new window.Image();
        img.src = src;
      }
    });
  }, []);

  const validate = () => {
    const errs = {};
    if (!username.trim()) errs.username = 'Email wajib diisi';
    if (!password) errs.password = 'Kata sandi wajib diisi';
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

  if (isMobile) {
    return (
      <div style={{
        minHeight: '100vh',
        background: GRADIENTS.hero,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <BubbleOrb size={300} style={{ top: '-10%', left: '-20%' }} delay={0.1} duration={8} opacity={0.32} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: 24, zIndex: 1 }}
        >
          <img src={waschenLogo} alt="Wäschen" style={{ width: 100, marginBottom: 8 }} />
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
              background: 'linear-gradient(135deg, #5B005F 0%, #8C4C8F 100%)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Poppins', sans-serif",
              cursor: 'pointer',
            }}
          >
            Masuk
          </button>
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
      />
    </div>
  );
}
