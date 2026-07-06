// ─────────────────────────────────────────────────────────────────────────────
// DriverDashboardPage — Delivery/Pickup task management
// Premium claymorphism design with 3D assets
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { Avatar, Btn, ErrorBoundary, useAppRefresh } from '../../components/ui';
import { CharacterAvatar, DeliveryVehicle, BrandBadge } from '../../components/CharacterAvatar';

// ─── Premium Animation Assets ───────────────────────────────────────────────
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp'
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp'
import soapBubble from '../../assets/Decorative icon/soap-bubble.webp'

// ─── Premium Animation Components ──────────────────────────────────────────────
const FloatingBubble = ({ src, size, top, left, right, bottom, delay = 0, duration = 5, opacity = 0.35 }) => (
  <motion.div
    animate={{ y: [0, -12, 0], scale: [1, 1.06, 1], opacity: [opacity * 0.5, opacity, opacity * 0.5] }}
    transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    style={{ position: 'absolute', top, left, right, bottom, width: size, height: size, pointerEvents: 'none', zIndex: 0 }}
  >
    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.08))' }} loading="lazy" />
  </motion.div>
);

// Stats card component
function StatCard({ label, value, icon, color = C.primary }) {
  return (
    <div style={{
      flex: 1,
      background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
      borderRadius: 20,
      padding: '16px 12px',
      boxShadow: `6px 6px 16px rgba(60, 10, 99, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.9)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      minWidth: 100,
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        background: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
      }}>
        {icon}
      </div>
      <div style={{
        fontFamily: 'Poppins',
        fontSize: 22,
        fontWeight: 700,
        color: color,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'Poppins',
        fontSize: 11,
        color: C.n600,
        textAlign: 'center',
      }}>
        {label}
      </div>
    </div>
  );
}

// Task card component
function TaskCard({ task, onStatusUpdate, onCall }) {
  const statusColors = {
    pending: { bg: C.validationWarningBg, color: C.warning, label: 'Menunggu' },
    picked: { bg: C.infoBg, color: C.info, label: 'Dijemput' },
    delivered: { bg: C.successBg, color: C.success, label: 'Diantar' },
    completed: { bg: C.primaryTint, color: C.primary, label: 'Selesai' },
  };

  const status = statusColors[task.status] || statusColors.pending;

  return (
    <div style={{
      background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
      borderRadius: 20,
      padding: 16,
      boxShadow: `6px 6px 16px rgba(60, 10, 99, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.9)`,
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 14,
            fontWeight: 600,
            color: C.n800,
          }}>
            {task.customerName}
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            color: C.n500,
          }}>
            {task.orderCode}
          </div>
        </div>
        <div style={{
          padding: '4px 12px',
          borderRadius: 20,
          background: status.bg,
          color: status.color,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'Poppins',
        }}>
          {status.label}
        </div>
      </div>

      {/* Type badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}>
        <BrandBadge
          text={task.type === 'pickup' ? '📦 Jemput' : '🚚 Antar'}
          variant={task.type === 'pickup' ? 'accent' : 'primary'}
        />
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          color: C.n600,
        }}>
          {task.address?.substring(0, 40)}
          {(task.address?.length || 0) > 40 ? '...' : ''}
        </div>
      </div>

      {/* Items summary */}
      <div style={{
        background: C.n100,
        borderRadius: 12,
        padding: '8px 12px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>👕</span>
        <span style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          color: C.n700,
        }}>
          {task.itemCount} item • {task.weight || '-'} kg
        </span>
        {task.totalAmount > 0 && (
          <>
            <span style={{ color: C.n300 }}>•</span>
            <span style={{
              fontFamily: 'Poppins',
              fontSize: 12,
              fontWeight: 600,
              color: C.primary,
            }}>
              {rp(task.totalAmount)}
            </span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: 8,
      }}>
        <Btn
          variant="primary"
          size="sm"
          style={{ flex: 1 }}
          onClick={() => onStatusUpdate(task)}
        >
          {task.status === 'pending' && '▶️ Jemput Sekarang'}
          {task.status === 'picked' && '✓ Sudah Dijemput'}
          {task.status === 'delivered' && '✓ Selesai'}
        </Btn>
        <Btn
          variant="secondary"
          size="sm"
          onClick={() => onCall(task)}
          style={{
            padding: '8px 12px',
            minWidth: 44,
          }}
        >
          📞
        </Btn>
      </div>
    </div>
  );
}

// Empty state component
function EmptyState({ type }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 24px',
      textAlign: 'center',
    }}>
      <DeliveryVehicle type="van" size={100} />
      <div style={{
        fontFamily: 'Poppins',
        fontSize: 18,
        fontWeight: 600,
        color: C.n700,
        marginTop: 20,
        marginBottom: 8,
      }}>
        {type === 'pickup' ? 'Tidak ada jemputan' : 'Tidak ada pengiriman'}
      </div>
      <div style={{
        fontFamily: 'Poppins',
        fontSize: 13,
        color: C.n500,
      }}>
        {type === 'pickup'
          ? 'Semua laundry sudah dijemput 👍'
          : 'Semua pesanan sudah diantar 👍'}
      </div>
    </div>
  );
}

// Main dashboard component
export default function DriverDashboardPage({ user, navigate }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    picked: 0,
    delivered: 0,
    completed: 0,
  });
  const [activeTab, setActiveTab] = useState('pickup');

  const { refresh } = useAppRefresh();

  const loadTasks = async () => {
    try {
      const res = await axios.get('/api/deliveries/tasks', {
        params: { driverId: user?.id }
      });
      if (res?.data?.success) {
        setTasks(res.data.data || []);
        // Calculate stats
        const s = { pending: 0, picked: 0, delivered: 0, completed: 0 };
        (res.data.data || []).forEach(t => {
          if (s[t.status] !== undefined) s[t.status]++;
        });
        setStats(s);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
  };

  const handleStatusUpdate = async (task) => {
    try {
      const nextStatus = {
        pending: 'picked',
        picked: 'delivered',
        delivered: 'completed',
      }[task.status];

      if (!nextStatus) return;

      const res = await axios.put(`/api/deliveries/${task.id}/status`, {
        status: nextStatus,
      });

      if (res?.data?.success) {
        refresh('deliveries');
        loadTasks();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleCall = (task) => {
    if (task.phone) {
      window.open(`tel:${task.phone}`, '_self');
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (activeTab === 'pickup') return t.type === 'pickup';
    if (activeTab === 'delivery') return t.type === 'delivery';
    if (activeTab === 'completed') return t.status === 'completed';
    return t.status !== 'completed';
  });

  return (
    <ErrorBoundary>
      <div style={{
        flex: 1,
        background: C.primaryTint2 || C.n50,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
          padding: '16px 20px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'rgba(232, 93, 0, 0.15)',
            filter: 'blur(30px)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
          }} />

          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 11,
                color: 'rgba(255,255,255,0.7)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                👋 Driver
              </div>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 22,
                fontWeight: 700,
                color: 'white',
                marginTop: 2,
              }}>
                {user?.name || 'Driver'}
              </div>
            </div>
            <Avatar
              photo={user?.photo}
              initials={user?.name?.charAt(0)}
              size={48}
              onClick={() => navigate('profile')}
            />
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          marginTop: -16,
          marginLeft: 16,
          marginRight: 16,
          display: 'flex',
          gap: 10,
        }}>
          <StatCard
            label="Menunggu"
            value={stats.pending}
            icon="⏳"
            color={C.warning}
          />
          <StatCard
            label="Dijemput"
            value={stats.picked}
            icon="📦"
            color={C.info}
          />
          <StatCard
            label="Selesai"
            value={stats.completed}
            icon="✅"
            color={C.success}
          />
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '16px 16px 8px',
        }}>
          {[
            { key: 'pickup', label: '📦 Jemput', count: tasks.filter(t => t.type === 'pickup').length },
            { key: 'delivery', label: '🚚 Antar', count: tasks.filter(t => t.type === 'delivery').length },
            { key: 'all', label: '📋 Semua', count: tasks.filter(t => t.status !== 'completed').length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: 14,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: 600,
                background: activeTab === tab.key
                  ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`
                  : 'white',
                color: activeTab === tab.key ? 'white' : C.n700,
                boxShadow: activeTab === tab.key
                  ? `4px 4px 12px rgba(60, 10, 99, 0.25)`
                  : `2px 2px 6px rgba(0,0,0,0.08)`,
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Task list */}
        <div style={{
          flex: 1,
          padding: '8px 16px 100px',
          overflowY: 'auto',
        }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.n500 }}>
              Memuat...
            </div>
          ) : filteredTasks.length === 0 ? (
            <EmptyState type={activeTab} />
          ) : (
            filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusUpdate={handleStatusUpdate}
                onCall={handleCall}
              />
            ))
          )}
        </div>

        {/* Bottom nav placeholder - actual nav is handled by App.jsx */}
      </div>
    </ErrorBoundary>
  );
}
