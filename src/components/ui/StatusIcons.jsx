// ─────────────────────────────────────────────────────────────────────────────
// StatusIcons.jsx — SVG Icon Components for Status Indicators
// Replaces emoji-based icons with professional SVG components
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';

// ─── Status Icon Base ─────────────────────────────────────────────────────────

const iconBaseStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

// ─── Transaction Status Icons ─────────────────────────────────────────────────

export const IconNew = ({ size = 14, color = '#7C3AED' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconProcess = ({ size = 14, color = '#D97706' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
        fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconDone = ({ size = 14, color = '#059669' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 4L12 14.01L9 11.01"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconReady = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.27 6.96L12 12.01L20.73 6.96"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 22.08V12"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconPickedUp = ({ size = 14, color = '#2563EB' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="3" width="15" height="13" rx="2" ry="2"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 8h4l3 3v5h-7V8z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="5.5" cy="18.5" r="2.5" stroke={color} strokeWidth="2"/>
      <circle cx="18.5" cy="18.5" r="2.5" stroke={color} strokeWidth="2"/>
    </svg>
  </span>
);

export const IconDelivered = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="3" width="15" height="13" rx="2" ry="2"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 8h4l3 3v5h-7V8z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="5.5" cy="18.5" r="2.5" stroke={color} strokeWidth="2"/>
      <circle cx="18.5" cy="18.5" r="2.5" stroke={color} strokeWidth="2"/>
      <path d="M5 12l3 3 5-6"
        stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconCancelled = ({ size = 14, color = '#DC2626' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M15 9L9 15M9 9l6 6"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

// ─── Payment Status Icons ─────────────────────────────────────────────────────

export const IconPaid = ({ size = 14, color = '#059669' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M9 12l2 2 4-4"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconPartial = ({ size = 14, color = '#D97706' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M12 6v6l4 2"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconUnpaid = ({ size = 14, color = '#DC2626' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M12 8v4M12 16h.01"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

// ─── Membership Status Icons ──────────────────────────────────────────────────

export const IconActive = ({ size = 14, color = '#059669' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill="#F59E0B" stroke="#F59E0B" strokeWidth="1.5"/>
    </svg>
  </span>
);

export const IconInactive = ({ size = 14, color = '#64748B' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M4.93 4.93l14.14 14.14"
        stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </span>
);

export const IconExpired = ({ size = 14, color = '#DC2626' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M12 6v6l4 2"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2"
        stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </span>
);

// ─── General Purpose Icons ────────────────────────────────────────────────────

export const IconWarning = ({ size = 14, color = '#D97706' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 9v4M12 17h.01"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconInfo = ({ size = 14, color = '#2563EB' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M12 16v-4M12 8h.01"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconSuccess = ({ size = 14, color = '#059669' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M8 12l2 2 4-4"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconError = ({ size = 14, color = '#DC2626' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M15 9l-6 6M9 9l6 6"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

// ─── Action Icons ─────────────────────────────────────────────────────────────

export const IconEdit = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconPrint = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 9V2h12v7"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="6" y="14" width="12" height="8"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconList = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconUsers = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="2"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconChart = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 20V10M12 20V4M6 20v-6"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconMoney = ({ size = 14, color = '#059669' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"
        stroke={color} strokeWidth="2"/>
      <path d="M12 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
        stroke={color} strokeWidth="2"/>
      <path d="M1 10h2M21 10h2M1 14h2M21 14h2"
        stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </span>
);

export const IconClock = ({ size = 14, color = '#64748B' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M12 6v6l4 2"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconPerson = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2"/>
    </svg>
  </span>
);

export const IconCheck = ({ size = 14, color = '#059669' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconClose = ({ size = 14, color = '#DC2626' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconCar = ({ size = 14, color = '#2563EB' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="3" width="15" height="13" rx="2" ry="2"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 8h4l3 3v5h-7V8z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="5.5" cy="18.5" r="2.5" stroke={color} strokeWidth="2"/>
      <circle cx="18.5" cy="18.5" r="2.5" stroke={color} strokeWidth="2"/>
    </svg>
  </span>
);

export const IconCelebration = ({ size = 14, color = '#F59E0B' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5.5 9.5L3 12l2.5 2.5M18.5 9.5L21 12l-2.5 2.5"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3"
        stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2"/>
    </svg>
  </span>
);

export const IconPackage = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.27 6.96L12 12.01L20.73 6.96"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 22.08V12"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconTrendDown = ({ size = 14, color = '#DC2626' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M23 18l-9.5-9.5-5 5L1 6"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 18h6v-6"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconTrendUp = ({ size = 14, color = '#059669' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M23 6l-9.5 9.5-5-5L1 18"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 6h6v6"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconStar = ({ size = 14, color = '#F59E0B' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconHandshake = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconWavingHand = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M14.5 3.5c1.5 1 2.5 2.5 2.5 4.5 0 1.5-1 2.5-2 3l-1.5-1.5M8.5 7.5c1 0 2-1 2-2.5S8.5 2 7.5 2 5.5 3 5.5 5s1 2.5 3 2.5z"
        stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5.5 7.5l-3 10c-.5 2 .5 4 2.5 4.5s3.5-1 4-3l1-3 4 1 2.5-2.5c1.5-1.5 2-3.5 1.5-5.5L16 5"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconScale = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3v18M5 8l7-5 7 5M5 8v6l7 7 7-7V8"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconCalendar = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 2v4M8 2v4M3 10h18"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconStore = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 22V12h6v10"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconBell = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconSearch = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2"/>
      <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </span>
);

export const IconHelp = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 17h.01"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconLock = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconSparkle = ({ size = 14, color = '#7C3AED' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
        fill={color}/>
      <path d="M5 19l1 3 1-3-3-1 3-1-1-3-1 3z"
        fill={color} opacity="0.6"/>
      <path d="M19 5l.5 1.5L21 7l-1.5.5L19 9l-.5-1.5L17 7l1.5-.5L19 5z"
        fill={color} opacity="0.6"/>
    </svg>
  </span>
);

// ─── Payment Method Icons ──────────────────────────────────────────────────────

export const IconCash = ({ size = 14, color = '#10B981' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M12 6v12M9 9c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2z" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <path d="M9 15h6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </span>
);

export const IconQris = ({ size = 14, color = '#6366F1' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="2"/>
      <rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="2"/>
      <rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="2"/>
      <rect x="14" y="14" width="3" height="3" fill={color}/>
      <path d="M17 14v3h3" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </span>
);

export const IconTransfer = ({ size = 14, color = '#3B82F6' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M17 3l4 4-4 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 7H9a4 4 0 0 0-4 4v0" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <path d="M7 21l-4-4 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 17h12a4 4 0 0 1 0 8h0" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </span>
);

export const IconEdc = ({ size = 14, color = '#8B5CF6' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth="2"/>
      <path d="M2 10h20" stroke={color} strokeWidth="2"/>
      <path d="M6 15h4" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </span>
);

export const IconDeposit = ({ size = 14, color = '#F59E0B' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h2v2h4v-4c1-.5 1.7-1 2-2h2l1-3V5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="9" cy="12" r="1" fill={color}/>
      <circle cx="15" cy="12" r="1" fill={color}/>
    </svg>
  </span>
);

export const IconWallet = ({ size = 14, color = '#6B7280' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="20" height="14" rx="2" stroke={color} strokeWidth="2"/>
      <path d="M22 12h-4a2 2 0 0 1-2-2V10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="18" cy="12" r="1" fill={color}/>
    </svg>
  </span>
);

export const IconReceipt = ({ size = 14, color = '#6e2e78' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 10h8M8 14h5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </span>
);

export const IconChevronRight = ({ size = 14, color = '#6B7280' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

export const IconRefresh = ({ size = 14, color = '#6B7280' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M1 4v6h6M23 20v-6h-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

// Alias for IconClose (used by ShiftPage)
export const IconX = ({ size = 14, color = '#DC2626' }) => (
  <span style={{ ...iconBaseStyle }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
);

// ─── Status Icon Registry ─────────────────────────────────────────────────────

export const STATUS_ICONS = {
  // Transaction statuses
  baru: IconSparkle,
  baru_selesai: IconDone,
  diproses: IconProcess,
  selesai: IconDone,
  siap_diambil: IconReady,
  selesai_diambil: IconPickedUp,
  picked: IconPickedUp,
  delivered: IconDelivered,
  completed: IconDone,
  dibatalkan: IconCancelled,
  cancelled: IconCancelled,
  pending: IconClock,

  // Payment statuses
  lunas: IconPaid,
  paid: IconPaid,
  belum_lunas: IconUnpaid,
  unpaid: IconUnpaid,
  partial: IconPartial,
  sebagian: IconPartial,

  // Membership statuses
  aktif: IconActive,
  active: IconActive,
  non_aktif: IconInactive,
  inactive: IconInactive,
  expired: IconExpired,

  // General
  warning: IconWarning,
  info: IconInfo,
  success: IconSuccess,
  error: IconError,
  edit: IconEdit,
  print: IconPrint,
  list: IconList,
  users: IconUsers,
  chart: IconChart,
  money: IconMoney,
  clock: IconClock,
  person: IconPerson,
  check: IconCheck,
  close: IconClose,
  car: IconCar,
  celebration: IconCelebration,
  package: IconPackage,
  trend_down: IconTrendDown,
  trend_up: IconTrendUp,
  star: IconStar,
  handshake: IconHandshake,
  waving_hand: IconWavingHand,
  scale: IconScale,
  calendar: IconCalendar,
};

// ─── Get Icon by Name ─────────────────────────────────────────────────────────

export const getIcon = (name, { size, color } = {}) => {
  const IconComponent = STATUS_ICONS[name];
  if (!IconComponent) {
    return null;
  }
  return <IconComponent size={size} color={color} />;
};

export default STATUS_ICONS;
