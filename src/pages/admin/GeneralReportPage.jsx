import { useState, useEffect, useCallback, memo } from 'react';
import axios from 'axios';
import { C, T } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Chip, Select, DateInput, StatCard, RevenueAreaChart, TxBarChart, PaymentPieChart, OutletBarChart, HourlyHeatBar } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { exportToExcel, exportToPDF, fmtCurrency } from '../../utils/exportReport';

const PRESETS = [
  { key: '7d', label: '7 hari' },
  { key: '30d', label: '30 hari' },
  { key: 'month', label: 'Bulan ini' },
  { key: '3m', label: '3 bulan' },
  { key: '6m', label: '6 bulan' },
];

function applyPresetDates(key) {
  const end = new Date();
  const start = new Date();
  if (key === '7d') start.setDate(end.getDate() - 6);
  else if (key === '30d') start.setDate(end.getDate() - 29);
  else if (key === 'month') start.setDate(1);
  else if (key === '3m') { start.setMonth(end.getMonth() - 2); start.setDate(1); }
  else { start.setMonth(end.getMonth() - 5); start.setDate(1); }
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const Delta = ({ value }) => {
  if (value == null || value === 0) return null;
  const up = value > 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: up ? C.success : C.danger, marginLeft: 4 }}>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
};

const SectionTitle = ({ children, icon }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <h3 style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900, margin: 0 }}>{children}</h3>
  </div>
);

const MiniBar = memo(function MiniBarInner({ points, valueKey = 'revenue', labelKey = 'label', height = 80, maxBars = 30 }) {
  const arr = [...(points || [])];
  const sliced = arr.length <= maxBars ? arr : arr.slice(-maxBars);
  if (!sliced.length) return <p style={{ fontSize: 12, color: C.n400 }}>Belum ada data</p>;
  const maxVal = Math.max(...sliced.map(p => Number(p[valueKey]) || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height, padding: '4px 0 0' }}>
      {sliced.map((p, i) => {
        const v = Number(p[valueKey]) || 0;
        const h = Math.max((v / maxVal) * 100, 4);
        const isLast = i === sliced.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <div title={`${p[labelKey]}: ${rp(v)}`} style={{
              width: '100%', maxWidth: 18, height: `${h}%`, minHeight: 3, borderRadius: '4px 4px 1px 1px',
              background: isLast ? `linear-gradient(180deg, ${C.primary}, ${C.primaryDark})` : `linear-gradient(180deg, ${C.primaryLight}, #94A3B844)`,
            }} />
            {sliced.length <= 14 && (
              <span style={{ fontFamily: 'Poppins', fontSize: 7, color: C.n500, textAlign: 'center' }}>
                {String(p[labelKey] || '').slice(-5)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

const HourBar = memo(function HourBarInner({ data }) {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map(d => d.txCount), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 80 }}>
      {data.map(d => {
        const h = Math.max((d.txCount / maxVal) * 100, 2);
        return (
          <div key={d.hour} title={`${d.hour}:00 - ${d.txCount} trx`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <div style={{
              width: '100%', maxWidth: 14, height: `${h}%`, minHeight: 2, borderRadius: '3px 3px 1px 1px',
              background: d.txCount === maxVal ? C.primary : C.primaryLight,
            }} />
          </div>
        );
      })}
    </div>
  );
});

const PaymentBar = ({ mix }) => {
  if (!mix?.length) return null;
  const colors = { cash: '#10B981', transfer: '#0EA5E9', qris: '#8B5CF6', deposit: '#F59E0B', mixed: '#EC4899' };
  const labels = { cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', deposit: 'Deposit', mixed: 'Campuran' };
  return (
    <div>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 24, marginBottom: 10 }}>
        {mix.map(m => (
          <div key={m.method} title={`${labels[m.method] || m.method}: ${m.pct}%`}
            style={{ width: `${m.pct}%`, minWidth: m.pct > 0 ? 2 : 0, background: colors[m.method] || C.n400 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        {mix.map(m => (
          <div key={m.method} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[m.method] || C.n400 }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>
              {labels[m.method] || m.method} <b>{m.pct}%</b> ({rp(m.amount)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function GeneralReportPage({ goBack }) {
  const { adminOutletId, setAdminOutletId } = useApp();
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState(adminOutletId && adminOutletId !== '_all' ? adminOutletId : '');
  const [preset, setPreset] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const [executive, setExecutive] = useState(null);
  const [outletPerf, setOutletPerf] = useState(null);
  const [services, setServices] = useState(null);
  const [cashiers, setCashiers] = useState(null);
  const [customers, setCustomers] = useState(null);

  useEffect(() => {
    if (adminOutletId === '_all' || !adminOutletId) setOutletId('');
    else setOutletId(adminOutletId);
  }, [adminOutletId]);

  useEffect(() => {
    const { start, end } = applyPresetDates('30d');
    setStartDate(start); setEndDate(end);
    (async () => {
      try {
        const r = await axios.get('/api/master/outlets');
        const rows = r?.data?.data || [];
        setOutlets(rows.map((o) => ({
          value: o.id,
          label: o.code ? `🏪 ${o.name} · ${o.code}` : `🏪 ${o.name}`,
        })));
      } catch {
        setOutlets([]);
      }
    })();
  }, []);

  const onOutletChange = (val) => {
    setOutletId(val);
    setAdminOutletId(val ? val : '_all');
  };

  const fetchAll = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    const params = { startDate, endDate };
    if (outletId) params.outletId = outletId;
    const cfg = { params };
    try {
      const [ex, op, sa, cp, ci] = await Promise.all([
        axios.get('/api/reports/executive-summary', cfg),
        axios.get('/api/reports/outlet-performance', cfg),
        axios.get('/api/reports/service-analytics', cfg),
        axios.get('/api/reports/cashier-performance', cfg),
        axios.get('/api/reports/customer-insights', cfg),
      ]);
      setExecutive(ex.data?.data || null);
      setOutletPerf(op.data?.data || null);
      setServices(sa.data?.data || null);
      setCashiers(cp.data?.data || null);
      setCustomers(ci.data?.data || null);
    } catch (err) {
      console.error('Report fetch error', err);
    }
    setLoading(false);
  }, [startDate, endDate, outletId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handlePreset = (key) => {
    const { start, end } = applyPresetDates(key);
    setStartDate(start); setEndDate(end);
    setPreset(key);
  };

  const outletOpts = [
    { value: '', label: '📊 Semua outlet (akumulasi)' },
    ...outlets,
  ];

  const selectedOutletLabel = outletId
    ? outlets.find((o) => o.value === outletId)?.label?.replace(/^🏪\s*/, '') || 'Outlet terpilih'
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.n100 }}>
      <TopBar title="General Report" subtitle="Ringkasan lintas outlet atau per outlet" onBack={goBack} />
      <div style={T.pageBody}>
        {/* Global Filters */}
        <div style={{ ...T.card, marginBottom: 14, padding: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {PRESETS.map(p => (
              <Chip key={p.key} label={p.label} active={preset === p.key} onClick={() => handlePreset(p.key)} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <DateInput label="Dari" value={startDate} onChange={setStartDate} placeholder="Start" />
            <DateInput label="Sampai" value={endDate} onChange={setEndDate} placeholder="End" />
          </div>
          <Select label="Outlet" value={outletId} onChange={onOutletChange} options={outletOpts} placeholder="Pilih outlet" />
          <p style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, margin: '8px 0 0', lineHeight: 1.4 }}>
            {outletId ? (
              <>Semua angka di bawah ini <strong>hanya untuk {selectedOutletLabel}</strong>. Pilih akumulasi untuk gabungan semua outlet.</>
            ) : (
              <>Data berikut <strong>digabung dari semua outlet</strong>. Scoreboard per outlet hanya tampil di mode ini.</>
            )}
          </p>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 32, color: C.n500, fontFamily: 'Poppins', fontSize: 13 }}>
            Memuat data report...
          </div>
        )}

        {!loading && executive && (
          <>
            {/* Section A: Executive Summary */}
            <div style={{ ...T.card, marginBottom: 14, padding: 14 }}>
              <SectionTitle icon="📊">Executive Summary</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <StatCard label="Total Omset" value={rp(executive.revenue)} icon="💰" color={C.primary}
                  sub={<Delta value={executive.revenueGrowth} />} />
                <StatCard label="Transaksi" value={executive.txCount} icon="🧾" color={C.info}
                  sub={<Delta value={executive.txGrowth} />} />
                <StatCard label="Rata-rata/Trx" value={rp(executive.avgPerTx)} icon="📈" color={C.success} />
                <StatCard label="Rata-rata/Hari" value={rp(executive.avgPerDay)} icon="📅" color={C.warning} />
              </div>
              <div style={{ marginTop: 4 }}>
                <p style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, margin: '0 0 4px' }}>Tren Harian — Omset & Pelunasan</p>
                <RevenueAreaChart
                  data={(executive.daily || []).map(d => ({ date: d.date, revenue: d.revenue, pelunasan: d.pelunasan || 0 }))}
                  height={160}
                />
              </div>
            </div>

            {/* Section B: Payment Mix — Recharts PieChart */}
            <div style={{ ...T.card, marginBottom: 14, padding: 14 }}>
              <SectionTitle icon="💳">Payment Mix</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
                <PaymentPieChart data={executive.paymentMix || []} height={180} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(executive.paymentMix || []).map((m, i) => (
                    <div key={m.method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>{m.method}</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n900 }}>{rp(m.amount)}</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>{m.pct}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Section C: Outlet Scoreboard (hanya mode semua outlet — hindari data multi-outlet membingungkan saat filter satu outlet) */}
            {!outletId && (outletPerf?.outlets?.length ?? 0) > 0 && (
              <div style={{ ...T.card, marginBottom: 14, padding: 14 }}>
                <SectionTitle icon="🏪">Outlet Scoreboard</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {outletPerf.outlets.map((o, i) => (
                    <div key={o.outletId} style={{
                      ...T.cardSm, padding: 12, border: i === 0 ? `1.5px solid ${C.primary}` : `1px solid ${C.n200}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>
                          #{i + 1} {o.outletName}
                        </span>
                        <Delta value={o.growth} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                        <MiniStat label="Omset" value={rp(o.revenue)} />
                        <MiniStat label="Trx" value={o.txCount} />
                        <MiniStat label="Avg/Trx" value={rp(o.avgPerTx)} />
                        <MiniStat label="Customer" value={o.uniqueCustomers} />
                        <MiniStat label="Express" value={o.expressCount} />
                        <MiniStat label="Selisih Kas" value={o.avgCashDiff != null ? rp(o.avgCashDiff) : '—'} warn={o.avgCashDiff > 5000} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section D: Top Layanan */}
            {services && (
              <div style={{ ...T.card, marginBottom: 14, padding: 14 }}>
                <SectionTitle icon="🧺">Top Layanan</SectionTitle>
                {services.topServices?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {services.topServices.slice(0, 10).map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, width: 20 }}>#{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</p>
                          <p style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, margin: 0 }}>{s.orderCount} order · {s.pct}%</p>
                        </div>
                        <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary }}>{rp(s.revenue)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ fontSize: 12, color: C.n400 }}>Belum ada data</p>}
                {services.expressVsRegular && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: C.n100, borderRadius: 10 }}>
                    <p style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, margin: '0 0 4px' }}>Express vs Regular</p>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>
                        ⚡ Express: {services.expressVsRegular.express.count} ({rp(services.expressVsRegular.express.revenue)})
                      </span>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>
                        📦 Regular: {services.expressVsRegular.regular.count} ({rp(services.expressVsRegular.regular.revenue)})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section E: Performa Kasir */}
            {cashiers?.cashiers?.length > 0 && (
              <div style={{ ...T.card, marginBottom: 14, padding: 14 }}>
                <SectionTitle icon="👤">Performa Kasir</SectionTitle>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Poppins', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1.5px solid ${C.n200}` }}>
                        <th style={thStyle}>Kasir</th>
                        <th style={thStyle}>Outlet</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Trx</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Omset</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Shift</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Selisih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashiers.cashiers.map((c, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.n100}` }}>
                          <td style={tdStyle}>{c.name}</td>
                          <td style={tdStyle}>{c.outlet}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{c.txCount}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{rp(c.revenue)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{c.shiftCount}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: c.avgCashDiff > 5000 ? C.danger : C.n700 }}>
                            {c.avgCashDiff != null ? rp(c.avgCashDiff) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Section F: Customer Insights */}
            {customers && (
              <div style={{ ...T.card, marginBottom: 14, padding: 14 }}>
                <SectionTitle icon="👥">Customer Insights</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <MiniStatCard label="Baru" value={customers.newCustomers} color={C.success} />
                  <MiniStatCard label="Returning" value={customers.returningCustomers} color={C.info} />
                  <MiniStatCard label="Member Ratio" value={
                    customers.memberVsNon ? `${Math.round((customers.memberVsNon.member.txCount / Math.max(customers.memberVsNon.member.txCount + customers.memberVsNon.nonMember.txCount, 1)) * 100)}%` : '—'
                  } color={C.primary} />
                </div>
                {customers.topCustomers?.length > 0 && (
                  <>
                    <p style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, margin: '0 0 6px' }}>Top Customer</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {customers.topCustomers.slice(0, 5).map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, width: 20 }}>#{i + 1}</span>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                              {c.name} {c.isMember && <span style={{ fontSize: 9, color: C.primary, background: C.primaryLight, padding: '1px 5px', borderRadius: 4 }}>Member</span>}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.primary }}>{rp(c.totalSpend)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {customers.awarenessSources?.length > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: C.n100, borderRadius: 10 }}>
                    <p style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, margin: '0 0 4px' }}>Sumber Awareness</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                      {customers.awarenessSources.map((a, i) => (
                        <span key={i} style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{a.source}: <b>{a.count}</b></span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section G: Peak Hours — Recharts */}
            {executive?.peakHours && (
              <div style={{ ...T.card, marginBottom: 14, padding: 14 }}>
                <SectionTitle icon="⏰">Peak Hours</SectionTitle>
                <HourlyHeatBar data={executive.peakHours} height={90} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n400 }}>00:00</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n400 }}>06:00</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n400 }}>12:00</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n400 }}>18:00</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n400 }}>23:00</span>
                </div>
                {(() => {
                  const peak = executive.peakHours.reduce((a, b) => (b.txCount > a.txCount ? b : a), { hour: 0, txCount: 0 });
                  return peak.txCount > 0 ? (
                    <p style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, margin: '8px 0 0', textAlign: 'center' }}>
                      Jam tersibuk: <b>{peak.hour}:00</b> ({peak.txCount} transaksi)
                    </p>
                  ) : null;
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const MiniStat = ({ label, value, warn }) => (
  <div>
    <p style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, margin: 0 }}>{label}</p>
    <p style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: warn ? C.danger : C.n900, margin: 0 }}>{value}</p>
  </div>
);

const MiniStatCard = ({ label, value, color }) => (
  <div style={{ textAlign: 'center', padding: '10px 6px', background: `${color}11`, borderRadius: 10 }}>
    <p style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color, margin: 0 }}>{value}</p>
    <p style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, margin: '2px 0 0' }}>{label}</p>
  </div>
);

const thStyle = { fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n500, padding: '6px 4px', textAlign: 'left', whiteSpace: 'nowrap' };
const tdStyle = { fontFamily: 'Poppins', fontSize: 11, color: C.n800, padding: '6px 4px', whiteSpace: 'nowrap' };
