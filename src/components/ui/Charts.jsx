// ─────────────────────────────────────────────────────────────────────────────
// Chart Components — Recharts wrappers dengan Waschen theme
// ─────────────────────────────────────────────────────────────────────────────
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { C } from '../../utils/theme';

// ── Theme colors ──────────────────────────────────────────
const CHART_COLORS = [
  C.primary,       // purple
  '#10B981',       // green
  '#0EA5E9',       // blue
  '#F59E0B',       // amber
  '#EF4444',       // red
  '#8B5CF6',       // violet
  '#EC4899',       // pink
  '#14B8A6',       // teal
];

// ── Formatters ────────────────────────────────────────────
const fmtRp = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
};

const fmtDate = (v) => {
  if (!v) return '';
  // YYYY-MM-DD → DD/MM
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(5).replace('-', '/');
  // YYYY-MM → Mon YY
  if (/^\d{4}-\d{2}$/.test(v)) {
    const [y, m] = v.split('-');
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
  }
  return v;
};

// ── Custom Tooltip ────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, currency = false }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'white', border: `1px solid ${C.n200}`,
      borderRadius: 10, padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
      fontFamily: 'Poppins', fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: C.n900, marginBottom: 6 }}>{fmtDate(label) || label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: p.color }} />
          <span style={{ color: C.n600 }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: C.n900 }}>
            {currency ? `Rp ${Number(p.value).toLocaleString('id-ID')}` : p.value?.toLocaleString('id-ID')}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── RevenueAreaChart ──────────────────────────────────────
/**
 * Area chart untuk tren omset & pelunasan.
 * Props: data [{ date, revenue, pelunasan }], height
 */
export const RevenueAreaChart = ({ data = [], height = 200 }) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={C.primary} stopOpacity={0.25} />
          <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="gradPelunasan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke={C.n100} />
      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontFamily: 'Poppins', fontSize: 9, fill: C.n500 }} axisLine={false} tickLine={false} />
      <YAxis tickFormatter={fmtRp} tick={{ fontFamily: 'Poppins', fontSize: 9, fill: C.n500 }} axisLine={false} tickLine={false} width={40} />
      <Tooltip content={<CustomTooltip currency />} />
      <Legend wrapperStyle={{ fontFamily: 'Poppins', fontSize: 11 }} />
      <Area type="monotone" dataKey="revenue" name="Omset" stroke={C.primary} strokeWidth={2} fill="url(#gradRevenue)" dot={false} activeDot={{ r: 4 }} />
      <Area type="monotone" dataKey="pelunasan" name="Pelunasan" stroke="#10B981" strokeWidth={2} fill="url(#gradPelunasan)" dot={false} activeDot={{ r: 4 }} />
    </AreaChart>
  </ResponsiveContainer>
);

// ── TxBarChart ────────────────────────────────────────────
/**
 * Bar chart untuk jumlah transaksi per hari/bulan.
 * Props: data [{ date, txCount }], height
 */
export const TxBarChart = ({ data = [], height = 160 }) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={14}>
      <CartesianGrid strokeDasharray="3 3" stroke={C.n100} vertical={false} />
      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontFamily: 'Poppins', fontSize: 9, fill: C.n500 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontFamily: 'Poppins', fontSize: 9, fill: C.n500 }} axisLine={false} tickLine={false} width={28} />
      <Tooltip content={<CustomTooltip />} />
      <Bar dataKey="txCount" name="Transaksi" fill={C.primary} radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

// ── PaymentPieChart ───────────────────────────────────────
/**
 * Pie chart untuk distribusi metode pembayaran.
 * Props: data [{ method, amount, pct }], height
 */
const METHOD_LABEL = { cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', deposit: 'Deposit', ovo: 'OVO', gopay: 'GoPay', dana: 'DANA', shopeepay: 'ShopeePay' };

export const PaymentPieChart = ({ data = [], height = 200 }) => {
  const total = data.reduce((s, d) => s + Number(d.amount || 0), 0) || 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="method"
          cx="50%"
          cy="50%"
          innerRadius={height * 0.22}
          outerRadius={height * 0.38}
          paddingAngle={2}
          label={({ method, amount }) => `${METHOD_LABEL[method] || method} ${((amount / total) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(val, name) => [`Rp ${Number(val).toLocaleString('id-ID')}`, METHOD_LABEL[name] || name]}
          contentStyle={{ fontFamily: 'Poppins', fontSize: 11, borderRadius: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ── OutletBarChart ────────────────────────────────────────
/**
 * Horizontal bar chart untuk perbandingan omset per outlet.
 * Props: data [{ outletName, revenue }], height
 */
export const OutletBarChart = ({ data = [], height = 200 }) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 0 }} barSize={16}>
      <CartesianGrid strokeDasharray="3 3" stroke={C.n100} horizontal={false} />
      <XAxis type="number" tickFormatter={fmtRp} tick={{ fontFamily: 'Poppins', fontSize: 9, fill: C.n500 }} axisLine={false} tickLine={false} />
      <YAxis type="category" dataKey="outletName" tick={{ fontFamily: 'Poppins', fontSize: 10, fill: C.n700 }} axisLine={false} tickLine={false} width={100} />
      <Tooltip content={<CustomTooltip currency />} />
      <Bar dataKey="revenue" name="Omset" radius={[0, 4, 4, 0]}>
        {data.map((_, i) => (
          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

// ── ComparisonLineChart ───────────────────────────────────
/**
 * Line chart untuk comparison mode (2 periode side-by-side).
 * Props: data [{ date, current, previous }], height
 */
export const ComparisonLineChart = ({ data = [], height = 200, label1 = 'Periode Ini', label2 = 'Periode Lalu' }) => (
  <ResponsiveContainer width="100%" height={height}>
    <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={C.n100} />
      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontFamily: 'Poppins', fontSize: 9, fill: C.n500 }} axisLine={false} tickLine={false} />
      <YAxis tickFormatter={fmtRp} tick={{ fontFamily: 'Poppins', fontSize: 9, fill: C.n500 }} axisLine={false} tickLine={false} width={40} />
      <Tooltip content={<CustomTooltip currency />} />
      <Legend wrapperStyle={{ fontFamily: 'Poppins', fontSize: 11 }} />
      <Line type="monotone" dataKey="current" name={label1} stroke={C.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
      <Line type="monotone" dataKey="previous" name={label2} stroke={C.n400} strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 3 }} />
    </LineChart>
  </ResponsiveContainer>
);

// ── HourlyHeatBar ─────────────────────────────────────────
/**
 * Peak hours visualization (24 bars).
 * Props: data [{ hour, txCount }], height
 */
export const HourlyHeatBar = ({ data = [], height = 80 }) => {
  const maxVal = Math.max(...data.map(d => d.txCount || 0), 1);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barSize={10}>
        <XAxis dataKey="hour" tick={{ fontFamily: 'Poppins', fontSize: 8, fill: C.n400 }} axisLine={false} tickLine={false}
          tickFormatter={(h) => h % 6 === 0 ? `${h}:00` : ''} />
        <Tooltip
          formatter={(val) => [val, 'Transaksi']}
          labelFormatter={(h) => `${h}:00 - ${h + 1}:00`}
          contentStyle={{ fontFamily: 'Poppins', fontSize: 11, borderRadius: 8 }}
        />
        <Bar dataKey="txCount" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.txCount === maxVal ? C.primary : `${C.primary}${Math.round((d.txCount / maxVal) * 0.7 * 255).toString(16).padStart(2, '0')}`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// Re-export CHART_COLORS for use in other components
export { CHART_COLORS };
