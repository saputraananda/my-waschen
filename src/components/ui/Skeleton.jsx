// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Loaders — better UX than spinners for content-heavy pages
// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../../utils/theme';

const shimmerStyle = {
  background: `linear-gradient(90deg, ${C.n100} 0%, ${C.n50} 50%, ${C.n100} 100%)`,
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
  borderRadius: 8,
};

// Inject CSS animation once
if (typeof document !== 'undefined' && !document.getElementById('skeleton-anim-styles')) {
  const s = document.createElement('style');
  s.id = 'skeleton-anim-styles';
  s.textContent = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
  document.head.appendChild(s);
}

/**
 * SkeletonBar — basic shimmering rectangle
 * Props: width, height, radius, style
 */
export const SkeletonBar = ({ width = '100%', height = 14, radius = 8, style = {} }) => (
  <div style={{
    ...shimmerStyle,
    width, height,
    borderRadius: radius,
    ...style,
  }} />
);

/**
 * SkeletonCard — generic card placeholder for list items
 * Props: lines (number of text rows), avatar (boolean)
 */
export const SkeletonCard = ({ lines = 2, avatar = false, height }) => (
  <div style={{
    background: C.white,
    borderRadius: 14,
    padding: '14px 16px',
    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    ...(height ? { height } : {}),
  }}>
    {avatar && <SkeletonBar width={40} height={40} radius={20} />}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SkeletonBar width="60%" height={14} />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <SkeletonBar key={i} width={i === lines - 2 ? '40%' : '85%'} height={11} />
      ))}
    </div>
  </div>
);

/**
 * SkeletonList — multiple skeleton cards
 */
export const SkeletonList = ({ count = 4, ...cardProps }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} {...cardProps} />
    ))}
  </div>
);

/**
 * SkeletonStat — KPI/stat card placeholder
 */
export const SkeletonStat = () => (
  <div style={{
    background: C.white,
    borderRadius: 14,
    padding: '14px 16px',
    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 80,
  }}>
    <SkeletonBar width={80} height={10} />
    <SkeletonBar width={120} height={22} />
    <SkeletonBar width={60} height={9} />
  </div>
);

/**
 * SkeletonStatGrid — grid of stat cards
 */
export const SkeletonStatGrid = ({ count = 4, columns = 2 }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: 10,
  }}>
    {Array.from({ length: count }).map((_, i) => <SkeletonStat key={i} />)}
  </div>
);

/**
 * SkeletonTable — table placeholder with rows
 */
export const SkeletonTable = ({ rows = 5, columns = 4 }) => (
  <div style={{
    background: C.white,
    borderRadius: 14,
    padding: 16,
    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
  }}>
    {/* Header */}
    <div style={{ display: 'flex', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.n100}` }}>
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonBar key={i} width={i === 0 ? '30%' : '20%'} height={11} />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < rows - 1 ? `1px solid ${C.n100}` : 'none' }}>
        {Array.from({ length: columns }).map((_, j) => (
          <SkeletonBar key={j} width={j === 0 ? '30%' : '20%'} height={13} />
        ))}
      </div>
    ))}
  </div>
);
