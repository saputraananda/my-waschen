import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Badge, Avatar } from '../../components/ui';

const NEXT_STATUS = {
  baru:   { label: 'Mulai Proses', next: 'proses' },
  proses: { label: 'Selesai', next: 'selesai' },
  selesai:{ label: 'Sudah Diambil', next: 'diambil' },
};

const COLS = [
  { key: 'baru',   label: 'Baru',    color: '#0EA5E9' },
  { key: 'proses', label: 'Proses',  color: C.warning },
  { key: 'selesai',label: 'Selesai', color: C.success },
  { key: 'diambil',label: 'Diambil', color: C.primary },
];

export default function MonitoringPage({ navigate }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/transactions');
      setTransactions(res?.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleUpdateStatus = async (e, txId, nextStatus) => {
    e.stopPropagation();
    setActionLoading(txId);
    try {
      await axios.put(`/api/transactions/${txId}/status`, { status: nextStatus });
      await fetchTransactions();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const byStatus = {
    baru:    transactions.filter((t) => t.status === 'baru'),
    proses:  transactions.filter((t) => t.status === 'proses'),
    selesai: transactions.filter((t) => t.status === 'selesai'),
    diambil: transactions.filter((t) => t.status === 'diambil'),
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Monitoring" subtitle="Real-time status laundry" onBack={() => navigate('dashboard')} />

      {/* Summary bar */}
      <div style={{ display: 'flex', padding: '12px 16px', gap: 10, background: C.white, borderBottom: `1px solid ${C.n100}` }}>
        {COLS.map((col) => (
          <div key={col.key} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: col.color }}>{byStatus[col.key].length}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>{col.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${C.n200}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat data...</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>
          {COLS.map((col) => (
            <div key={col.key} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: col.color }} />
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{col.label} ({byStatus[col.key].length})</div>
              </div>

              {byStatus[col.key].length === 0 && (
                <div style={{ background: C.white, borderRadius: 12, padding: '16px', textAlign: 'center', borderStyle: 'dashed', borderWidth: 1.5, borderColor: C.n200 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Tidak ada</div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {byStatus[col.key].map((tx) => (
                  <div key={tx.id} onClick={() => navigate('detail_transaksi', tx)} style={{ background: C.white, borderRadius: 12, padding: '10px 12px', boxShadow: '0 2px 6px rgba(15,23,42,0.05)', cursor: 'pointer', borderLeft: `3px solid ${col.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar initials={tx.customerName?.split(' ').map((w) => w[0]).join('').slice(0, 2) || '??'} size={36} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{tx.customerName}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{tx.id}</span>
                          {tx.items?.some((i) => i.express) && <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.warning }}>⚡ Express</span>}
                        </div>
                      </div>
                      <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(tx.total)}</span>
                    </div>

                    {NEXT_STATUS[tx.status] && (
                      <button
                        onClick={(e) => handleUpdateStatus(e, tx.id, NEXT_STATUS[tx.status].next)}
                        disabled={actionLoading === tx.id}
                        style={{
                          marginTop: 8, width: '100%', padding: '6px 0',
                          borderRadius: 8, border: `1px solid ${col.color}`,
                          background: actionLoading === tx.id ? C.n100 : `${col.color}12`,
                          color: col.color, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                          cursor: actionLoading === tx.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {actionLoading === tx.id ? 'Memproses...' : `→ ${NEXT_STATUS[tx.status].label}`}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
