// ─────────────────────────────────────────────────────────────────────────────
// designSystem.js — Design tokens, shadows, gradients, animations
// Premium Claymorphism + Glassmorphism Design System v3.0 (July 2026)
// Updated: Colors aligned with official logo color sampling
// Ref: My_Waschen_Redesign_Spec_dan_Prompt.md Section 2
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR TOKENS — From Logo Sampling
// ═══════════════════════════════════════════════════════════════════════════════

export const COLORS = {
  // Purple family (from logo)
  purple: {
    900: '#4D0051',  // Shade - dasar gradient gelap
    700: '#5B005F',  // Core - logo, teks penting
    500: '#8C4C8F',  // Mid - hover state
    300: '#AD80AF',  // Soft - ilustrasi pendukung
    100: '#E6D9E7',  // Tint - background terang
    50:  '#F4EDF4',  // Wash - background halaman
  },

  // Orange family (from logo)
  orange: {
    700: '#F93E11',  // Core - CTA utama
    400: '#FA6541',  // Soft - hover
    100: '#FDB2A0',  // Tint - chip ringan
    50:  '#FED8CF',  // Wash - background alert
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHADOW TOKENS — Claymorphism (using new brand color #5B005F)
// ═══════════════════════════════════════════════════════════════════════════════

export const SHADOWS = {
  // Soft claymorphism (cards, containers)
  clay: {
    sm: `4px 4px 10px rgba(91, 0, 95, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.9)`,
    md: `8px 8px 20px rgba(91, 0, 95, 0.10), -4px -4px 12px rgba(255, 255, 255, 0.9)`,
    lg: `12px 12px 32px rgba(91, 0, 95, 0.12), -6px -6px 16px rgba(255, 255, 255, 0.95)`,
    xl: `16px 16px 40px rgba(91, 0, 95, 0.15), -8px -8px 20px rgba(255, 255, 255, 0.98)`,
  },

  // Inset shadows (inputs, pressed states)
  inset: {
    sm: `inset 2px 2px 4px rgba(91, 0, 95, 0.05), inset -1px -1px 3px rgba(255, 255, 255, 0.8)`,
    md: `inset 3px 3px 6px rgba(91, 0, 95, 0.06), inset -2px -2px 4px rgba(255, 255, 255, 0.85)`,
    lg: `inset 4px 4px 8px rgba(91, 0, 95, 0.08), inset -3px -3px 6px rgba(255, 255, 255, 0.9)`,
  },

  // Elevated (floating elements)
  elevated: {
    sm: '0 2px 8px rgba(91, 0, 95, 0.1), 0 4px 12px rgba(91, 0, 95, 0.05)',
    md: '0 4px 16px rgba(91, 0, 95, 0.12), 0 8px 24px rgba(91, 0, 95, 0.08)',
    lg: '0 8px 32px rgba(91, 0, 95, 0.15), 0 16px 48px rgba(91, 0, 95, 0.1)',
  },

  // Glow effects (accent colors)
  glow: {
    purple: '0 0 20px rgba(91, 0, 95, 0.3), 0 0 40px rgba(91, 0, 95, 0.15)',
    orange: '0 0 20px rgba(249, 62, 17, 0.3), 0 0 40px rgba(249, 62, 17, 0.15)',
    success: '0 0 20px rgba(5, 150, 105, 0.3), 0 0 40px rgba(5, 150, 105, 0.15)',
  },

  // Button shadows
  button: {
    primary: '4px 4px 12px rgba(91, 0, 95, 0.3), -2px -2px 8px rgba(255, 255, 255, 0.2)',
    secondary: '3px 3px 8px rgba(91, 0, 95, 0.15), -2px -2px 6px rgba(255, 255, 255, 0.9)',
    danger: '4px 4px 12px rgba(220, 38, 38, 0.3), -2px -2px 8px rgba(255, 255, 255, 0.2)',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GRADIENT PRESETS (from Spec Section 2)
// ═══════════════════════════════════════════════════════════════════════════════

export const GRADIENTS = {
  // Primary brand gradient (Purple 900 → 700 → 500)
  primary: 'linear-gradient(160deg, #4D0051 0%, #5B005F 35%, #8C4C8F 100%)',
  primaryHover: 'linear-gradient(160deg, #5B005F 0%, #8C4C8F 35%, #AD80AF 100%)',

  // Hero gradient (specific for login hero panel)
  hero: 'linear-gradient(160deg, #4D0051 0%, #5B005F 35%, #8C4C8F 100%)',

  // Shell gradient (app background - subtle)
  shell: 'linear-gradient(180deg, #F4EDF4 0%, #FFFFFF 60%)',

  // CTA gradient (Orange - use sparingly)
  cta: 'linear-gradient(135deg, #F93E11 0%, #FA6541 100%)',

  // Purple accent
  purple: 'linear-gradient(135deg, #5B005F 0%, #8C4C8F 50%, #AD80AF 100%)',
  purpleSoft: 'linear-gradient(135deg, #F4EDF4 0%, #E6D9E7 50%, #F4EDF4 100%)',

  // Orange accent
  orange: 'linear-gradient(135deg, #F93E11 0%, #FA6541 50%, #FDB2A0 100%)',
  orangeSoft: 'linear-gradient(135deg, #FED8CF 0%, #FDB2A0 50%, #FED8CF 100%)',

  // Success
  success: 'linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)',
  successSoft: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 50%, #ECFDF5 100%)',

  // Glassmorphism backgrounds
  glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.1) 100%)',
  glassDark: 'linear-gradient(135deg, rgba(91, 0, 95, 0.3) 0%, rgba(91, 0, 95, 0.1) 100%)',

  // Background gradients
  bgPrimary: 'linear-gradient(145deg, #F4EDF4 0%, #E6D9E7 50%, #F4EDF4 100%)',
  bgWhite: 'linear-gradient(145deg, #FFFFFF 0%, #F4EDF4 100%)',

  // Card background
  card: 'linear-gradient(145deg, #FFFFFF 0%, #F4EDF4 100%)',
  cardHover: 'linear-gradient(145deg, #F4EDF4 0%, #E6D9E7 100%)',

  // Input fields
  input: 'linear-gradient(145deg, #F4EDF4 0%, #E6D9E7 100%)',
  inputFocus: 'linear-gradient(145deg, #FFFFFF 0%, #FAFAFA 100%)',
};

// ═══════════════════════════════════════════════════════════════════════════════
// BORDER RADIUS TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const RADIUS = {
  // Small elements
  xs: 6,
  sm: 8,
  md: 10,

  // Medium elements (inputs, small cards)
  lg: 14,
  xl: 16,

  // Large elements (cards, modals)
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,

  // Pill shapes
  pill: 999,
  full: 9999,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION TIMING
// ═══════════════════════════════════════════════════════════════════════════════

export const TIMING = {
  // Fast transitions (hover, click feedback)
  fast: '0.15s',
  normal: '0.2s',
  medium: '0.3s',

  // Slow transitions (page transitions, modal)
  slow: '0.4s',
  slower: '0.5s',

  // Spring-like transitions
  spring: '0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
  bounce: '0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION KEYFRAMES (for CSS-in-JS)
// Ref: My_Waschen_Redesign_Spec_dan_Prompt.md Section 6
// ═══════════════════════════════════════════════════════════════════════════════

export const KEYFRAMES = {
  // Float animation for mascots/3D elements (4-6s)
  float: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-10px)' },
  },

  // Fade animations
  fadeIn: {
    '0%': { opacity: 0 },
    '100%': { opacity: 1 },
  },
  fadeInUp: {
    '0%': { opacity: 0, transform: 'translateY(20px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' },
  },
  fadeInDown: {
    '0%': { opacity: 0, transform: 'translateY(-20px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' },
  },
  fadeInLeft: {
    '0%': { opacity: 0, transform: 'translateX(-20px)' },
    '100%': { opacity: 1, transform: 'translateX(0)' },
  },
  fadeInRight: {
    '0%': { opacity: 0, transform: 'translateX(20px)' },
    '100%': { opacity: 1, transform: 'translateX(0)' },
  },

  // Scale animations
  scaleIn: {
    '0%': { opacity: 0, transform: 'scale(0.9)' },
    '100%': { opacity: 1, transform: 'scale(1)' },
  },
  scaleInBounce: {
    '0%': { opacity: 0, transform: 'scale(0.8)' },
    '50%': { transform: 'scale(1.05)' },
    '100%': { opacity: 1, transform: 'scale(1)' },
  },

  // Slide animations
  slideInUp: {
    '0%': { transform: 'translateY(100%)' },
    '100%': { transform: 'translateY(0)' },
  },
  slideInDown: {
    '0%': { transform: 'translateY(-100%)' },
    '100%': { transform: 'translateY(0)' },
  },

  // Pulse animation (for badges)
  pulse: {
    '0%, 100%': { transform: 'scale(1)', opacity: 1 },
    '50%': { transform: 'scale(1.05)', opacity: 0.8 },
  },

  // Pulse ring (for live indicators)
  pulseRing: {
    '0%': { transform: 'scale(1)', opacity: 0.6 },
    '100%': { transform: 'scale(1.5)', opacity: 0 },
  },

  // Shimmer (for skeleton loading)
  shimmer: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },

  // Glow (for brand glow effects)
  glow: {
    '0%, 100%': { boxShadow: '0 0 20px rgba(91, 0, 95, 0.3)' },
    '50%': { boxShadow: '0 0 40px rgba(91, 0, 95, 0.5)' },
  },

  // Rotate (for loading spinner)
  rotate: {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },

  // Wiggle (for attention-grabbing)
  wiggle: {
    '0%, 100%': { transform: 'rotate(-3deg)' },
    '50%': { transform: 'rotate(3deg)' },
  },

  // Bounce (for success states)
  bounce: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-5px)' },
  },

  // Count-up (for number animations) - handled in JS
  countUp: {
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CSS STRING FOR GLOBAL STYLES (add to index.css)
// Ref: My_Waschen_Redesign_Spec_dan_Prompt.md Section 6
// ═══════════════════════════════════════════════════════════════════════════════

export const GLOBAL_ANIMATIONS = `
  /* ─── Login Animations (Spec Section 4.1) ──────────────────────── */
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  @keyframes bubble-float {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
    50% { transform: translateY(-20px) scale(1.1); opacity: 0.8; }
  }

  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(2); opacity: 0; }
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(91, 0, 95, 0.3); }
    50% { box-shadow: 0 0 40px rgba(91, 0, 95, 0.5); }
  }

  /* ─── Skeleton Loading ─────────────────────────────────────────── */
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  /* ─── Stagger Animations (Spec Section 6) ─────────────────────── */
  @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fade-in-down {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes slide-in-right {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes blur-in {
    from { opacity: 0; filter: blur(10px); }
    to { opacity: 1; filter: blur(0); }
  }

  /* ─── Animation Utility Classes (Spec Section 6) ───────────────── */
  .animate-float { animation: float 4s ease-in-out infinite; }
  .animate-float-slow { animation: float 6s ease-in-out infinite; }
  .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
  .animate-shimmer { animation: shimmer 2s linear infinite; }
  .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
  .animate-fade-in-down { animation: fade-in-down 0.5s ease-out forwards; }
  .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
  .animate-slide-in-right { animation: slide-in-right 0.4s ease-out forwards; }
  .animate-gradient { background-size: 200% 200%; animation: gradient-shift 3s ease infinite; }

  /* ─── Stagger children animation (Spec Section 6) ─────────────── */
  .stagger-children > *:nth-child(1) { animation-delay: 0ms; }
  .stagger-children > *:nth-child(2) { animation-delay: 50ms; }
  .stagger-children > *:nth-child(3) { animation-delay: 100ms; }
  .stagger-children > *:nth-child(4) { animation-delay: 150ms; }
  .stagger-children > *:nth-child(5) { animation-delay: 200ms; }
  .stagger-children > *:nth-child(6) { animation-delay: 250ms; }
  .stagger-children > *:nth-child(7) { animation-delay: 300ms; }
  .stagger-children > *:nth-child(8) { animation-delay: 350ms; }
  .stagger-children > *:nth-child(9) { animation-delay: 400ms; }
  .stagger-children > *:nth-child(10) { animation-delay: 450ms; }

  /* ─── Hover lift effect (Spec Section 6) ───────────────────────── */
  .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .hover-lift:hover { transform: translateY(-4px); }

  /* ─── Badge pulse for active shift (Spec Section 6) ───────────── */
  .pulse-active::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: inherit;
    animation: pulse-ring 1.5s ease-out infinite;
  }

  /* ─── Count-up animation helper (Spec Section 4.2) ────────────── */
  .count-up {
    animation: fade-in-up 0.6s ease-out forwards;
  }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: COMBINE STYLES
// ═══════════════════════════════════════════════════════════════════════════════

export function clayCardStyle(variant = 'md', hover = false) {
  const shadows = {
    sm: hover ? SHADOWS.clay.md : SHADOWS.clay.sm,
    md: hover ? SHADOWS.clay.lg : SHADOWS.clay.md,
    lg: hover ? SHADOWS.clay.xl : SHADOWS.clay.lg,
  };
  return {
    background: GRADIENTS.card,
    boxShadow: shadows[variant] || shadows.md,
    borderRadius: RADIUS[variant === 'sm' ? 'lg' : variant === 'lg' ? '3xl' : '2xl'],
  };
}

export function glassStyle(intensity = 'medium') {
  const configs = {
    light: {
      background: 'rgba(255, 255, 255, 0.15)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    medium: {
      background: 'rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(15px)',
      border: '1px solid rgba(255, 255, 255, 0.25)',
    },
    heavy: {
      background: 'rgba(255, 255, 255, 0.25)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
    },
  };
  return configs[intensity] || configs.medium;
}

export default {
  SHADOWS,
  GRADIENTS,
  RADIUS,
  TIMING,
  KEYFRAMES,
  GLOBAL_ANIMATIONS,
  clayCardStyle,
  glassStyle,
};
