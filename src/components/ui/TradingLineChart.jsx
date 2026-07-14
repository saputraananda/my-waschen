// ─────────────────────────────────────────────────────────────────────────────
// TradingLineChart.jsx — Trading-style animated line chart
// Shows today vs yesterday comparison with gradient area fill
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';

// Custom tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
      }}>
        <p style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#FFFFFF', margin: '0 0 6px' }}>
          {label}
        </p>
        {payload.map((entry, index) => (
          <p key={index} style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight: 600,
            color: entry.color,
            margin: '2px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: entry.color,
            }} />
            {entry.name}: Rp {entry.value?.toLocaleString('id-ID') || 0}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Format currency for Y-axis
const formatCurrency = (value) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}jt`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}rb`;
  return value;
};

// Format hour label
const formatHour = (hour) => {
  return `${hour}:00`;
};

export default function TradingLineChart({
  data = [],
  height = 280,
  showGrid = true,
  showLegend = true,
  animationDuration = 1500,
}) {
  // Transform data for chart
  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      // Ensure numeric values
      current: Number(item.current) || 0,
      previous: Number(item.previous) || 0,
    }));
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #FFFFFF, #F4EDF4)',
        borderRadius: 16,
        color: '#AD80AF',
        fontFamily: 'Poppins',
        fontSize: 13,
      }}>
        📊 Memuat data grafik...
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F4EDF4)',
        borderRadius: 20,
        padding: '20px 16px 16px',
        boxShadow: '8px 8px 20px rgba(0, 0, 0, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.8)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <h3 style={{
            fontFamily: 'Poppins',
            fontSize: 14,
            fontWeight: 700,
            color: '#FFFFFF',
            margin: 0,
          }}>
            📈 Omset per Jam
          </h3>
          <p style={{
            fontFamily: 'Poppins',
            fontSize: 11,
            color: '#AD80AF',
            margin: '2px 0 0',
          }}>
            Perbandingan hari ini vs kemarin
          </p>
        </div>
        {/* Legend */}
        {showLegend && (
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 12,
                height: 3,
                borderRadius: 2,
                background: 'linear-gradient(90deg, #FFFFFF, rgba(255,255,255,0.7))',
              }} />
              <span style={{ fontFamily: 'Poppins', fontSize: 10, color: '#FFFFFF', fontWeight: 600 }}>
                Hari Ini
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 12,
                height: 3,
                borderRadius: 2,
                background: '#E8D4E8',
                border: '1px dashed #AD80AF',
              }} />
              <span style={{ fontFamily: 'Poppins', fontSize: 10, color: '#AD80AF', fontWeight: 600 }}>
                Kemarin
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
        >
          <defs>
            {/* Gradient for today's area */}
            <linearGradient id="todayGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.35} />
              <stop offset="50%" stopColor="rgba(255,255,255,0.2)" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.02} />
            </linearGradient>
            {/* Gradient for yesterday's area */}
            <linearGradient id="yesterdayGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#AD80AF" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#AD80AF" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Grid */}
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255, 255, 255, 0.15)"
              vertical={false}
            />
          )}

          {/* X Axis */}
          <XAxis
            dataKey="hour"
            tickFormatter={formatHour}
            tick={{ fontFamily: 'Poppins', fontSize: 10, fill: '#AD80AF' }}
            axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
            tickLine={{ stroke: 'transparent' }}
            dy={5}
          />

          {/* Y Axis */}
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontFamily: 'Poppins', fontSize: 10, fill: '#AD80AF' }}
            axisLine={{ stroke: 'transparent' }}
            tickLine={{ stroke: 'transparent' }}
            width={50}
          />

          {/* Tooltip */}
          <Tooltip content={<CustomTooltip />} />

          {/* Yesterday Line + Area (draw first, behind) */}
          <Area
            type="monotone"
            dataKey="previous"
            name="Kemarin"
            stroke="#E8D4E8"
            strokeWidth={2}
            strokeDasharray="4 2"
            fill="url(#yesterdayGradient)"
            animationDuration={animationDuration}
            dot={false}
            activeDot={{ r: 4, fill: '#AD80AF', stroke: '#fff', strokeWidth: 2 }}
          />

          {/* Today Line + Area */}
          <Area
            type="monotone"
            dataKey="current"
            name="Hari Ini"
            stroke="#FFFFFF"
            strokeWidth={3}
            fill="url(#todayGradient)"
            animationDuration={animationDuration}
            dot={false}
            activeDot={{ r: 5, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
