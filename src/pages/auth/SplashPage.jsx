// ─────────────────────────────────────────────────────────────────────────────
// SplashPage.jsx — Premium Redesign v3.0 (July 2026)
// Ref: My_Waschen_Redesign_Spec_dan_Prompt.md
//
// Features:
// - Premium gradient background with cinematic lighting
// - Floating bubbles and sparkle animations
// - Glassmorphism loading indicator
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GRADIENTS } from '../../utils/designSystem';

// ─── Asset Imports ─────────────────────────────────────────────────────────────
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';
import soapBubble from '../../assets/Decorative icon/soap-bubble.webp';

// ─── Floating Bubble Component ─────────────────────────────────────────────────
const FloatingBubble = ({ src, size, top, left, right, bottom, delay = 0, duration = 5 }) => (
  <motion.div
    animate={{
      y: [0, -20, 0],
      scale: [1, 1.1, 1],
      opacity: [0.4, 0.7, 0.4],
    }}
    transition={{
      duration,
      repeat: Infinity,
      ease: 'easeInOut',
      delay,
    }}
    style={{
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      width: size,
      height: size,
    }}
  >
    <img
      src={src}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
      }}
      loading="lazy"
    />
  </motion.div>
);

// ─── Sparkle Component ───────────────────────────────────────────────────────
const Sparkle = ({ top, left, size = 8, delay = 0 }) => (
  <motion.div
    style={{
      position: 'absolute',
      top,
      left,
      width: size,
      height: size,
      background: 'white',
      borderRadius: '50%',
      boxShadow: '0 0 12px rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.5)',
    }}
    animate={{
      scale: [0, 1, 0],
      opacity: [0, 1, 0],
      rotate: [0, 180, 360],
    }}
    transition={{
      duration: 2,
      delay,
      repeat: Infinity,
      ease: 'easeOut',
    }}
  />
);

// ─── Glow Orb Component ───────────────────────────────────────────────────────
const GlowOrb = ({ color, size, top, left, right, bottom, blur = 40 }) => (
  <motion.div
    animate={{
      scale: [1, 1.15, 1],
      opacity: [0.4, 0.6, 0.4],
    }}
    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    style={{
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      width: size,
      height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      filter: `blur(${blur}px)`,
      pointerEvents: 'none',
    }}
  />
);

export default function SplashPage({ onDone }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  useEffect(() => {
    const interval = setInterval(() => setProgress((p) => Math.min(p + 3, 100)), 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        flex: 1,
        background: GRADIENTS.hero,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient Glow Orbs */}
      <GlowOrb color="rgba(140, 76, 143, 0.5)" size={350} top="-15%" left="-10%" blur={60} />
      <GlowOrb color="rgba(249, 62, 17, 0.3)" size={250} top="10%" right="-5%" blur={50} />
      <GlowOrb color="rgba(91, 0, 95, 0.4)" size={300} bottom="-20%" right="10%" blur={70} />
      <GlowOrb color="rgba(173, 128, 175, 0.3)" size={200} bottom="20%" left="10%" blur={45} />

      {/* Sparkle Particles */}
      <Sparkle top="15%" left="20%" size={6} delay={0} />
      <Sparkle top="25%" left="75%" size={8} delay={0.5} />
      <Sparkle top="40%" left="30%" size={5} delay={1} />
      <Sparkle top="55%" left="70%" size={7} delay={1.5} />
      <Sparkle top="70%" left="40%" size={6} delay={2} />
      <Sparkle top="30%" left="55%" size={5} delay={0.3} />
      <Sparkle top="60%" left="85%" size={6} delay={0.8} />
      <Sparkle top="80%" left="15%" size={7} delay={1.2} />

      {/* Floating Bubbles */}
      <FloatingBubble src={bubbleIcon} size={56} top="10%" left="8%" delay={0} duration={5} />
      <FloatingBubble src={bubble2Icon} size={46} top="18%" right="13%" delay={0.5} duration={6} />
      <FloatingBubble src={bubbleIcon} size={50} top="33%" left="7%" delay={0.3} duration={5.5} />
      <FloatingBubble src={soapBubble} size={42} top="48%" right="9%" delay={0.8} duration={5} />
      <FloatingBubble src={bubble2Icon} size={48} top="63%" left="10%" delay={0.4} duration={6} />
      <FloatingBubble src={bubbleIcon} size={40} bottom="24%" right="18%" delay={1} duration={5.5} />
      <FloatingBubble src={soapBubble} size={38} bottom="34%" left="7%" delay={0.6} duration={5} />
      <FloatingBubble src={bubble2Icon} size={44} bottom="13%" right="7%" delay={0.2} duration={6} />

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          zIndex: 10,
        }}
      >
        {/* Logo Wäschen — Premium Version */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 200 }}
          style={{ width: 280, marginBottom: 16, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))' }}
        >
          <svg viewBox="0 0 320 100" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
            {/* Bubbles */}
            <circle cx="28" cy="52" r="14" fill="none" stroke="#E85D04" strokeWidth="3.5"/>
            <circle cx="18" cy="72" r="8" fill="none" stroke="#E85D04" strokeWidth="3"/>
            <circle cx="38" cy="78" r="5" fill="#E85D04"/>
            <circle cx="48" cy="38" r="5" fill="#E85D04"/>
            {/* Text "Wäschen" */}
            <text x="52" y="68" fontFamily="'Poppins', Arial, sans-serif" fontSize="46" fontWeight="800" fill="white" letterSpacing="-1">
              W<tspan fontSize="42">ä</tspan>schen
            </text>
            {/* ® symbol */}
            <text x="285" y="42" fontFamily="'Poppins', Arial, sans-serif" fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.7)">®</text>
            {/* Tagline bar */}
            <rect x="52" y="76" width="195" height="18" rx="2" fill="#E85D04"/>
            <text x="150" y="89" fontFamily="'Poppins', Arial, sans-serif" fontSize="10" fontWeight="700" fill="white" textAnchor="middle" letterSpacing="0.5">
              EXPERT LAUNDRY SOLUTIONS
            </text>
          </svg>
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            fontFamily: 'Poppins',
            fontSize: 13,
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 400,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}
        >
          Smart Laundry Management
        </motion.div>
      </motion.div>

      {/* Loading Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        style={{
          position: 'absolute',
          bottom: 80,
          left: 60,
          right: 60,
          zIndex: 10,
        }}
      >
        {/* Glassmorphism Progress Bar */}
        <div style={{
          height: 4,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 4,
          overflow: 'hidden',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.08, ease: 'linear' }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.7) 100%)',
              borderRadius: 4,
              boxShadow: '0 0 10px rgba(255,255,255,0.5)',
            }}
          />
        </div>

        {/* Version Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            fontFamily: 'Poppins',
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
            marginTop: 14,
          }}
        >
          v1.0.0 · PT Waschen Alora Indonesia
        </motion.div>
      </motion.div>

      {/* Shimmer Sweep Effect */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: '-50%',
          width: '40%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
          transform: 'skewX(-15deg)',
          pointerEvents: 'none',
        }}
        animate={{
          left: ['-50%', '120%'],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          repeatDelay: 3,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
}
