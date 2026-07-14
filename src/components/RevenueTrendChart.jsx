// ─────────────────────────────────────────────────────────────────────────────
// RevenueTrendChart.jsx — Premium Smooth Area Chart (Aktual vs Target)
// Features: Smooth bezier curves, gradient fill, glow effects, animated hover
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';

// Smooth bezier curve generator (Catmull-Rom spline)
const generateSmoothPath = (points, tension = 0.4) => {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i === 0 ? points[0] : points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i + 2 >= points.length ? points[points.length - 1] : points[i + 2];

    const cp1x = p1.x + (p2.x - p0.x) * tension / 6;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 6;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 6;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
};

// Generate closed area path
const generateAreaPath = (points, baselineY) => {
  const linePath = generateSmoothPath(points);
  if (!linePath) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(2)} ${baselineY} L ${first.x.toFixed(2)} ${baselineY} Z`;
};

const FILTERS = [
  { value: 'today', label: 'Hari ini' },
  { value: '7d', label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
  { value: 'custom', label: 'Custom' },
];

const CHART_CONFIG = {
  width: 600,
  height: 200,
  paddingTop: 20,
  paddingBottom: 28,
  paddingLeft: 8,
  paddingRight: 8,
};

export default function RevenueTrendChart({ className }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [range, setRange] = useState('7d');
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 200 });

  // Responsive resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        // Maintain aspect ratio 3:1
        const height = Math.max(160, Math.min(240, width / 3));
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/dashboard/revenue-trend', { params: { range } });
        if (res?.data?.success) {
          setData(res.data.data.daily || []);
          setSummary(res.data.data.summary || null);
        }
      } catch (err) {
        console.error('Failed to fetch revenue trend:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range]);

  // Calculate chart dimensions
  const getChartDimensions = () => {
    const paddingTop = 20;
    const paddingBottom = 28;
    const paddingLeft = 8;
    const paddingRight = 8;
    const chartWidth = dimensions.width - paddingLeft - paddingRight;
    const chartHeight = dimensions.height - paddingTop - paddingBottom;
    return {
      chartWidth,
      chartHeight,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      width: dimensions.width,
      height: dimensions.height,
      baselineY: paddingTop + chartHeight,
    };
  };

  const safeNum = (v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  const getPoints = () => {
    if (data.length === 0) return { actualPoints: [], targetPoints: [] };

    const { chartWidth, chartHeight, paddingTop, paddingLeft } = getChartDimensions();
    const values = data.map(d => Math.max(safeNum(d.actual), safeNum(d.target)));
    const maxVal = Math.max(...values, 1);
    const divisor = Math.max(data.length - 1, 1);

    const actualPoints = data.map((d, i) => ({
      x: paddingLeft + (i / divisor) * chartWidth,
      y: paddingTop + chartHeight - (safeNum(d.actual) / maxVal) * chartHeight,
      value: safeNum(d.actual),
      target: safeNum(d.target),
      date: d.date,
    }));

    const targetPoints = data.map((d, i) => ({
      x: paddingLeft + (i / divisor) * chartWidth,
      y: paddingTop + chartHeight - (safeNum(d.target) / maxVal) * chartHeight,
      value: safeNum(d.target),
    }));

    return { actualPoints, targetPoints };
  };

  const { actualPoints, targetPoints } = getPoints();
  const { baselineY } = getChartDimensions();

  const actualLinePath = generateSmoothPath(actualPoints);
  const actualAreaPath = generateAreaPath(actualPoints, baselineY);
  const targetLinePath = generateSmoothPath(targetPoints);

  const handleMouseMove = (e) => {
    if (!containerRef.current || actualPoints.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * dimensions.width;
    const { chartWidth, paddingLeft } = getChartDimensions();
    const relativeX = svgX - paddingLeft;
    const index = Math.round((relativeX / chartWidth) * (actualPoints.length - 1));
    const clampedIndex = Math.max(0, Math.min(index, actualPoints.length - 1));

    if (clampedIndex !== hoveredIndex) {
      setHoveredIndex(clampedIndex);
      setTooltipPos({ x: actualPoints[clampedIndex]?.x || 0, y: actualPoints[clampedIndex]?.y || 0 });
    }
  };

  const hoveredPoint = hoveredIndex !== null ? actualPoints[hoveredIndex] : null;

  const formatDateRange = () => {
    if (!data.length) return '';
    const first = new Date(data[0].date);
    const last = new Date(data[data.length - 1].date);
    const options = { day: '2-digit', month: 'short' };
    return `${first.toLocaleDateString('id-ID', options)} - ${last.toLocaleDateString('id-ID', options)}`;
  };

  return (
    <div
      className={className}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        border: '1px solid #f0f0f0',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.n800 }}>Tren Omset</h3>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: C.n500 }}>{formatDateRange()}</p>
        </div>

        {/* Filter Buttons */}
        <div style={{
          display: 'flex',
          background: '#F5F5F7',
          borderRadius: 10,
          padding: 3,
          gap: 2,
        }}>
          {FILTERS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: range === opt.value ? '#fff' : 'transparent',
                color: range === opt.value ? '#8B5CF6' : C.n600,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: range === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.primaryHover || '#8B5CF6'}, ${C.primary})`,
            boxShadow: '0 2px 6px rgba(110, 46, 120, 0.4)',
          }} />
          <span style={{ fontSize: 10, color: C.n600, fontWeight: 500 }}>Aktual</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#EC4899', // chart-target color
            boxShadow: '0 2px 6px rgba(236, 72, 153, 0.4)',
          }} />
          <span style={{ fontSize: 10, color: C.n600, fontWeight: 500 }}>Target</span>
        </div>
      </div>

      {/* Chart Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: dimensions.height,
          position: 'relative',
          cursor: data.length > 0 ? 'crosshair' : 'default',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {loading ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.n400,
            fontSize: 12,
          }}>
            Memuat data...
          </div>
        ) : data.length === 0 ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.n400,
            fontSize: 12,
          }}>
            Tidak ada data
          </div>
        ) : (
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              {/* Gradient fill for actual area - using brand colors */}
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.6" />
                <stop offset="40%" stopColor="#8B5CF6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.02" />
              </linearGradient>

              {/* Glow filter for actual line */}
              <filter id="glowPurple" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Glow filter for target line */}
              <filter id="glowPink" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Drop shadow for dots */}
              <filter id="dotShadow" x="-100%" y="-100%" width="300%" height="300%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15" />
              </filter>
            </defs>

            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const dims = getChartDimensions();
              return (
              <line
                key={i}
                x1={dims.paddingLeft}
                y1={dims.paddingTop + pct * dims.chartHeight}
                x2={dims.chartWidth + dims.paddingLeft + dims.paddingRight}
                y2={dims.paddingTop + pct * dims.chartHeight}
                stroke="#E8E8ED"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            )})}

            {/* Target line - dashed pink */}
            {targetLinePath && (
              <path
                d={targetLinePath}
                fill="none"
                stroke="#EC4899"
                strokeWidth="2"
                strokeDasharray="6,4"
                strokeLinecap="round"
                filter="url(#glowPink)"
                opacity={hoveredIndex !== null ? 0.5 : 0.8}
                style={{ transition: 'opacity 0.2s ease' }}
              />
            )}

            {/* Target dots */}
            {targetPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === i ? 5 : 3.5}
                fill="#EC4899"
                stroke="#fff"
                strokeWidth="1.5"
                style={{ transition: 'r 0.15s ease' }}
              />
            ))}

            {/* Actual area fill */}
            {actualAreaPath && (
              <path
                d={actualAreaPath}
                fill="url(#areaGradient)"
                style={{ transition: 'opacity 0.2s ease' }}
                opacity={hoveredIndex !== null ? 0.6 : 1}
              />
            )}

            {/* Actual line - solid purple with glow */}
            {actualLinePath && (
              <path
                d={actualLinePath}
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glowPurple)"
              />
            )}

            {/* Actual dots */}
            {actualPoints.map((p, i) => (
              <g key={i}>
                {/* Outer glow */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIndex === i ? 10 : 7}
                  fill="#8B5CF6"
                  opacity={hoveredIndex === i ? 0.2 : 0.1}
                  style={{ transition: 'all 0.15s ease' }}
                />
                {/* Main dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIndex === i ? 6 : 4.5}
                  fill="#8B5CF6"
                  stroke="#fff"
                  strokeWidth="2"
                  filter="url(#dotShadow)"
                  style={{ transition: 'r 0.15s ease' }}
                />
              </g>
            ))}

            {/* Hover indicator line */}
            {hoveredIndex !== null && actualPoints[hoveredIndex] && (
              <line
                x1={actualPoints[hoveredIndex].x}
                y1={CHART_CONFIG.paddingTop}
                x2={actualPoints[hoveredIndex].x}
                y2={baselineY}
                stroke="#8B5CF6"
                strokeWidth="1"
                strokeDasharray="3,3"
                opacity="0.3"
              />
            )}

            {/* X-axis labels */}
            {actualPoints.map((p, i) => {
              const showLabel = data.length <= 7 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1;
              if (!showLabel) return null;
              const date = new Date(p.date);
              const dims = getChartDimensions();
              return (
                <text
                  key={i}
                  x={p.x}
                  y={dims.height - 6}
                  fontSize="10"
                  fill={hoveredIndex === i ? '#8B5CF6' : C.n500}
                  textAnchor="middle"
                  fontWeight={hoveredIndex === i ? '600' : '400'}
                  style={{ transition: 'fill 0.15s ease' }}
                >
                  {date.getDate()}
                </text>
              );
            })}
          </svg>
        )}

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: `${(hoveredPoint.x / dimensions.width) * 100}%`,
              top: Math.max(0, (hoveredPoint.y / dimensions.height) * 100 - 15) + '%',
              transform: 'translate(-50%, -100%)',
              background: '#1a1a2e',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: 10,
              fontSize: 10,
              pointerEvents: 'none',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {new Date(hoveredPoint.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6' }} />
              <span>Aktual:</span>
              <span style={{ fontWeight: 600 }}>{rp(hoveredPoint.value)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EC4899' }} />
              <span>Target:</span>
              <span style={{ fontWeight: 600 }}>{rp(hoveredPoint.target)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid #F0F0F5',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#8B5CF6' }}>{rp(summary.totalActual)}</div>
            <div style={{ fontSize: 10, color: C.n500, marginTop: 2 }}>Total Aktual</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#EC4899' }}>{rp(summary.totalTarget)}</div>
            <div style={{ fontSize: 10, color: C.n500, marginTop: 2 }}>Total Target</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              color: summary.achievementRate >= 100 ? '#10B981' : '#F59E0B'
            }}>
              {summary.achievementRate}%
            </div>
            <div style={{ fontSize: 10, color: C.n500, marginTop: 2 }}>Achievement</div>
          </div>
        </div>
      )}
    </div>
  );
}
