import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp, STAGES } from '../../utils/helpers';
import { Avatar, Badge, Chip, SectionHeader } from '../../components/ui';

export default function ProduksiDashboardPage({ user, navigate }) {
  const [filter, setFilter] = useState('aktif');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchQueue = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/transactions/production/queue');
        setTransactions(res?.data?.data || []);
      } catch (error) {
        console.error('Failed to fetch production queue:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQueue();
  }, []);

  const antrianList = transactions.filter((t) => {
    if (filter === 'aktif') return t.status === 'baru' || t.status === 'proses';
    if (filter === 'selesai') return t.status === 'selesai';
    return true;
  });

  const stageCount = (stage) =>
    transactions.filter((t) => t.progress?.some((p) => p.stage === stage)).length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.n50 }}>
      <div style={{ background: `linear-gradient(135deg, #0C4A6E, #075985)`, padding: '16px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Hai,</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'white' }}>{user.name.split(' ')[0]} 👋</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Produksi · {user.outlet?.name}</div>
          </div>
          <Avatar photo={user.photo} initials={user.avatar} size={40} onClick={() => navigate('profil')} />
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -12, paddingBottom: 16 }}>
        {/* Stage summary */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.07)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 12 }}>Progress Produksi</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {STAGES.slice(0, 5).map((stage, i) => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <div style={{ background: C.primaryLight, borderRadius: 10, padding: '6px 10px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.primary }}>{stageCount(stage)}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>{stage}</div>
                </div>
                {i < 4 && <div style={{ color: C.n400, fontSize: 16 }}>›</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[
            { key: 'aktif', label: 'Aktif' },
            { key: 'selesai', label: 'Selesai' },
            { key: 'semua', label: 'Semua' },
          ].map((f) => (
            <Chip key={f.key} label={f.label} active={filter === f.key} onClick={() => setFilter(f.key)} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {antrianList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 24px', color: C.n600, fontFamily: 'Poppins', fontSize: 13 }}>
              Tidak ada antrian {filter}
            </div>
          )}
          {antrianList.map((tx) => {
            const doneStages = tx.progress?.map((p) => p.stage) || [];
            const currentStage = STAGES.find((s) => !doneStages.includes(s)) || 'Selesai';
            const progressPct = Math.round((doneStages.length / STAGES.length) * 100);
            return (
              <div key={tx.id} onClick={() => navigate('detail_item_produksi', tx)} style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Avatar initials={tx.customerName.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{tx.customerName}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {tx.items?.some((i) => i.express) && <span style={{ background: '#FEF3C7', color: C.warning, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>⚡</span>}
                        <Badge status={tx.status} small />
                      </div>
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>{tx.id} · {tx.date}</div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.primary, fontWeight: 600 }}>{currentStage}</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{progressPct}%</span>
                      </div>
                      <div style={{ height: 4, background: C.n100, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, background: `linear-gradient(90deg, ${C.primaryLight}, ${C.primary})`, borderRadius: 2, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
