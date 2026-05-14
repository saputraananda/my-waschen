import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Chip } from '../../components/ui';

function fmtDt(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) {
    return String(v);
  }
}

const METHOD_LABEL = {
  cash: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
  ovo: 'OVO',
  gopay: 'GoPay',
  dana: 'DANA',
  shopeepay: 'ShopeePay',
  deposit: 'Deposit',
};

const hoursSince = (v) => {
  if (!v) return 0;
  const ms = Date.now() - new Date(v).getTime();
  return Number.isFinite(ms) ? ms / 3600000 : 0;
};

const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const pctChange = (current, prev) => {
  const c = Number(current || 0);
  const p = Number(prev || 0);
  if (p === 0 && c === 0) return 0;
  if (p === 0) return 100;
  return ((c - p) / p) * 100;
};

const trendVisual = (current, prev, reverseGood = false) => {
  const delta = pctChange(current, prev);
  const up = delta > 0;
  const down = delta < 0;
  const good = reverseGood ? down : up;
  return {
    delta,
    arrow: up ? '↑' : down ? '↓' : '→',
    color: up || down ? (good ? C.success : C.danger) : C.n600,
    label: `${up ? '+' : ''}${delta.toFixed(1)}% vs minggu lalu`,
  };
};

const badgeMeta = (level) => ({
  high: { bg: '#FEE2E2', fg: '#991B1B' },
  medium: { bg: '#FEF3C7', fg: '#92400E' },
  low: { bg: '#DCFCE7', fg: '#166534' },
}[level] || { bg: '#E5E7EB', fg: '#374151' });

export default function AdminShiftReportPage({ navigate, goBack }) {
  const [tab, setTab] = useState('sessions');
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState([]);
  const [prevSummary, setPrevSummary] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const disciplinedOutlet = summary
    .filter((o) => o.closedCount > 0 && o.avgAbsCashDiff != null)
    .slice()
    .sort((a, b) => a.avgAbsCashDiff - b.avgAbsCashDiff || b.closedCount - a.closedCount)[0] || null;

  const problematicOutlet = summary
    .filter((o) => o.closedCount > 0)
    .slice()
    .sort((a, b) => {
      const scoreA = (a.largeDiffCount * 10) + (a.avgAbsCashDiff || 0);
      const scoreB = (b.largeDiffCount * 10) + (b.avgAbsCashDiff || 0);
      return scoreB - scoreA;
    })[0] || null;

  const staleCashiers = sessions
    .filter((s) => s.status === 'open' && hoursSince(s.openedAt) >= 24)
    .slice()
    .sort((a, b) => hoursSince(b.openedAt) - hoursSince(a.openedAt));

  const prevByOutlet = prevSummary.reduce((acc, o) => {
    acc[o.outletId] = o;
    return acc;
  }, {});

  const trendDiscipline = disciplinedOutlet
    ? trendVisual(
        disciplinedOutlet.avgAbsCashDiff || 0,
        prevByOutlet[disciplinedOutlet.outletId]?.avgAbsCashDiff || 0,
        true
      )
    : null;

  const trendProblem = problematicOutlet
    ? trendVisual(
        problematicOutlet.largeDiffCount || 0,
        prevByOutlet[problematicOutlet.outletId]?.largeDiffCount || 0,
        true
      )
    : null;

  const stalePrevTotal = prevSummary.reduce((n, o) => n + Number(o.staleOpenCount || 0), 0);
  const staleTrend = trendVisual(staleCashiers.length, stalePrevTotal, true);

  useEffect(() => {
    axios.get('/api/master/outlets').then((r) => setOutlets(r?.data?.data || [])).catch(() => setOutlets([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const q = new URLSearchParams({ dateFrom, dateTo });
      if (outletId) q.set('outletId', outletId);
      const dayCount = Math.max(1, Math.round((new Date(`${dateTo}T00:00:00`) - new Date(`${dateFrom}T00:00:00`)) / 86400000) + 1);
      const prevDateTo = addDays(dateFrom, -1);
      const prevDateFrom = addDays(prevDateTo, -(dayCount - 1));

      const [sRes, uRes, prevRes] = await Promise.all([
        axios.get(`/api/shifts/sessions?${q.toString()}`),
        axios.get(`/api/shifts/outlet-summary?dateFrom=${dateFrom}&dateTo=${dateTo}`),
        axios.get(`/api/shifts/outlet-summary?dateFrom=${prevDateFrom}&dateTo=${prevDateTo}`),
      ]);
      setSessions(sRes?.data?.data || []);
      setSummary(uRes?.data?.data || []);
      setPrevSummary(prevRes?.data?.data || []);
      setMeta(uRes?.data?.meta || null);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Gagal memuat data shift.');
      setSessions([]);
      setSummary([]);
      setPrevSummary([]);
    } finally {
      setLoading(false);
    }
  }, [outletId, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Shift kasir" subtitle="Buka/tutup shift, selisih kas, dan perbandingan outlet" onBack={goBack} />

      <div style={{ padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 140px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Dari</div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins' }} />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Sampai</div>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins' }} />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Filter outlet</div>
          <select value={outletId} onChange={(e) => setOutletId(e.target.value)} style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins' }}>
            <option value="">Semua outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <Btn variant="primary" size="sm" onClick={load} loading={loading}>Muat ulang</Btn>
      </div>

      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8 }}>
        <Chip label="Riwayat shift" active={tab === 'sessions'} onClick={() => setTab('sessions')} />
        <Chip label="Ringkasan outlet" active={tab === 'outlet'} onClick={() => setTab('outlet')} />
      </div>

      {err && (
        <div style={{ margin: '0 16px 12px', padding: 12, borderRadius: 10, background: '#FEF2F2', color: '#991B1B', fontFamily: 'Poppins', fontSize: 13 }}>
          {err}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
        <div style={{ background: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 12, border: '1px solid #DBEAFE' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#1E3A8A', marginBottom: 6 }}>
            Cara baca cepat (awam)
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#1E3A8A', lineHeight: 1.6 }}>
            - Badge <strong>hijau</strong> berarti aman, <strong>kuning</strong> perlu pantau, <strong>merah</strong> perlu tindakan.<br />
            - Panah <strong>↑</strong> naik, <strong>↓</strong> turun dibanding minggu lalu.<br />
            - Untuk risiko (selisih kas, shift lewat 24 jam), turun = membaik.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ background: C.white, borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.success }}>
                Outlet paling disiplin minggu ini
              </div>
              {(() => {
                const lv = disciplinedOutlet && (disciplinedOutlet.avgAbsCashDiff || 0) <= 10000 ? 'low' : 'medium';
                const st = badgeMeta(lv);
                return <span style={{ background: st.bg, color: st.fg, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>{lv === 'low' ? 'AMAN' : 'PANTAU'}</span>;
              })()}
            </div>
            {disciplinedOutlet ? (
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800, lineHeight: 1.6 }}>
                <strong>{disciplinedOutlet.outletName}</strong> · rata-rata |selisih| {rp(disciplinedOutlet.avgAbsCashDiff)} · closed shift {disciplinedOutlet.closedCount}
                {trendDiscipline && (
                  <div style={{ color: trendDiscipline.color, fontWeight: 600 }}>
                    {trendDiscipline.arrow} {trendDiscipline.label}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Belum ada shift tertutup pada periode ini.</div>
            )}
          </div>

          <div style={{ background: C.white, borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.warning }}>
                Outlet paling sering selisih
              </div>
              {(() => {
                const count = problematicOutlet?.largeDiffCount || 0;
                const lv = count >= 3 ? 'high' : count > 0 ? 'medium' : 'low';
                const st = badgeMeta(lv);
                return <span style={{ background: st.bg, color: st.fg, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>{lv === 'high' ? 'TINGGI' : lv === 'medium' ? 'SEDANG' : 'RENDAH'}</span>;
              })()}
            </div>
            {problematicOutlet ? (
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800, lineHeight: 1.6 }}>
                <strong>{problematicOutlet.outletName}</strong> · kasus selisih ≥ 50rb: {problematicOutlet.largeDiffCount} · rata-rata |selisih| {problematicOutlet.avgAbsCashDiff != null ? rp(problematicOutlet.avgAbsCashDiff) : '-'}
                {trendProblem && (
                  <div style={{ color: trendProblem.color, fontWeight: 600 }}>
                    {trendProblem.arrow} {trendProblem.label}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Belum ada data selisih pada periode ini.</div>
            )}
          </div>

          <div style={{ background: C.white, borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: '#B91C1C' }}>
                Kasir dengan open shift lewat 24 jam
              </div>
              {(() => {
                const lv = staleCashiers.length > 0 ? 'high' : 'low';
                const st = badgeMeta(lv);
                return <span style={{ background: st.bg, color: st.fg, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>{lv === 'high' ? 'ALERT' : 'AMAN'}</span>;
              })()}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: staleTrend.color, fontWeight: 600, marginBottom: 4 }}>
              {staleTrend.arrow} {staleTrend.label}
            </div>
            {staleCashiers.length > 0 ? (
              staleCashiers.slice(0, 5).map((s, idx) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Poppins', fontSize: 12, color: C.n800, padding: '5px 0', borderBottom: idx < Math.min(staleCashiers.length, 5) - 1 ? `1px solid ${C.n100}` : 'none' }}>
                  <span>{idx + 1}. {s.cashierName} · {s.outletName}</span>
                  <strong>{hoursSince(s.openedAt).toFixed(1)} jam</strong>
                </div>
              ))
            ) : (
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Tidak ada shift open melebihi 24 jam.</div>
            )}
          </div>
        </div>

        {tab === 'sessions' && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 10, lineHeight: 1.5 }}>
              Timestamp <strong>buka</strong> dan <strong>tutup</strong> tercatat per kasir per outlet. Selisih kas (positif/negatif) membantu melihat outlet yang perlu pembinaan.
            </div>
            {loading && !sessions.length ? (
              <div style={{ color: C.n500, fontFamily: 'Poppins', fontSize: 13 }}>Memuat…</div>
            ) : sessions.map((s) => (
              <div key={s.id} style={{ background: C.white, borderRadius: 12, padding: 12, marginBottom: 8, fontFamily: 'Poppins', fontSize: 12, boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.n900 }}>{s.outletName}</div>
                    <div style={{ color: C.n600, marginTop: 2 }}>{s.cashierName} · {s.shift}</div>
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: s.status === 'open' ? '#DCFCE7' : C.n100,
                    color: s.status === 'open' ? '#166534' : C.n700,
                  }}>
                    {s.status === 'open' ? 'BUKA' : 'TUTUP'}
                  </span>
                </div>
                <div style={{ marginTop: 8, color: C.n700 }}>
                  <div>Buka: <strong>{fmtDt(s.openedAt)}</strong></div>
                  <div>Tutup: <strong>{fmtDt(s.closedAt)}</strong></div>
                </div>
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: C.n600 }}>
                  <span>Modal awal {rp(s.openingCash)}</span>
                  {s.status === 'closed' && (
                    <>
                      <span>Penjualan tunai → sistem {rp(s.systemCash != null ? s.systemCash - s.openingCash : 0)}</span>
                      <span>Hitung fisik {s.closingCash != null ? rp(s.closingCash) : '—'}</span>
                      <span style={{ color: s.cashDiff != null && Math.abs(s.cashDiff) > 10000 ? C.warning : C.n800 }}>
                        Selisih {s.cashDiff != null ? rp(s.cashDiff) : '—'}
                      </span>
                    </>
                  )}
                </div>
                {Array.isArray(s.paymentSummary) && s.paymentSummary.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Metode pembayaran sesi:</div>
                    {s.paymentSummary.map((p) => (
                      <div key={`${s.id}-${p.method}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.n600, padding: '2px 0' }}>
                        <span>{METHOD_LABEL[p.method] || p.method} ({p.count}x)</span>
                        <span>{rp(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {s.notes && <div style={{ marginTop: 6, fontSize: 11, color: C.n600, fontStyle: 'italic' }}>Catatan: {s.notes}</div>}
              </div>
            ))}
          </>
        )}

        {tab === 'outlet' && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 10, lineHeight: 1.5 }}>
              Diurutkan dari <strong>rata-rata |selisih kas| terkecil</strong> (shift yang sudah tutup) sebagai indikator disiplin kas. Outlet dengan <strong>shift terbuka lama</strong> atau <strong>selisih besar</strong> perlu perhatian.
              {meta && <span> Periode {meta.dateFrom} — {meta.dateTo}.</span>}
            </div>
            {summary.map((o, idx) => (
              <div key={o.outletId} style={{ background: C.white, borderRadius: 12, padding: 12, marginBottom: 8, fontFamily: 'Poppins', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: C.n900 }}>{idx + 1}. {o.outletName}</div>
                  {o.staleOpenCount > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '2px 8px', borderRadius: 999 }}>Shift terbuka &gt;24j: {o.staleOpenCount}</span>
                  )}
                </div>
                <div style={{ marginTop: 6, color: C.n600, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <span>Shift tercatat: {o.sessionCount}</span>
                  <span>Sudah tutup: {o.closedCount}</span>
                  <span>Masih buka: {o.openCount}</span>
                  <span>Selisih ≥50rb: {o.largeDiffCount}</span>
                  <span style={{ gridColumn: '1 / -1' }}>
                    Rata-rata |selisih|: {o.avgAbsCashDiff != null ? rp(o.avgAbsCashDiff) : '—'}
                  </span>
                  <span style={{ gridColumn: '1 / -1' }}>Ada catatan kasir: {o.notesCount}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
