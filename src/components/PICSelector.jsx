// ─────────────────────────────────────────────────────────────────────────────
// PICSelector.jsx — PIC (Penanggung Jawab) Selection Component
// Phase 1.3: PIC Selection System
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { C, SHADOW } from '../utils/theme';
import { Modal, Btn } from './ui';
import { Check, ChevronDown, User, Users, RefreshCw } from 'lucide-react';

/**
 * PICSelector — Component untuk memilih/mengganti PIC
 *
 * Usage:
 *   <PICSelector
 *     currentPIC={user}
 *     onChange={(pic) => setUser(pic)}
 *     users={availableUsers}
 *     loading={isLoading}
 *   />
 *
 * Props:
 *   - currentPIC: User object PIC saat ini
 *   - onChange: Callback when PIC changed
 *   - users: Array of available users (same outlet)
 *   - loading: Loading state
 *   - compact: Show in compact mode (for header)
 */
export default function PICSelector({
  currentPIC,
  onChange,
  users = [],
  loading = false,
  compact = false,
  outletId,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter users by search
  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle user selection
  const handleSelect = (user) => {
    onChange(user);
    setModalOpen(false);
    setSearchQuery('');
  };

  // Compact mode (dropdown)
  if (compact) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: C.white,
            border: `1px solid ${C.n200}`,
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            background: C.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: 'white',
          }}>
            {currentPIC?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: C.n900,
              fontFamily: 'Poppins',
            }}>
              {currentPIC?.name || 'Pilih PIC'}
            </div>
            <div style={{
              fontSize: 10,
              color: C.n500,
              fontFamily: 'Poppins',
            }}>
              {currentPIC?.role || '-'}
            </div>
          </div>
          <ChevronDown size={16} color={C.n400} />
        </button>

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Pilih PIC"
        >
          <UserSelectorContent
            users={filteredUsers}
            loading={loading}
            currentPIC={currentPIC}
            onSelect={handleSelect}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClose={() => setModalOpen(false)}
          />
        </Modal>
      </>
    );
  }

  // Full mode
  return (
    <div style={{
      background: C.white,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      border: `1px solid ${C.n200}`,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 13,
          fontWeight: 600,
          color: C.n700,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <User size={18} color={C.primary} />
          Penanggung Jawab (PIC)
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            background: C.primaryLight,
            border: 'none',
            borderRadius: 6,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'Poppins',
            fontSize: 11,
            fontWeight: 600,
            color: C.primary,
          }}
        >
          <RefreshCw size={12} />
          {loading ? 'Memuat...' : 'Ganti'}
        </button>
      </div>

      {/* Current PIC Display */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: C.n50,
        borderRadius: 10,
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          background: C.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 600,
          color: 'white',
          flexShrink: 0,
        }}>
          {currentPIC?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 14,
            fontWeight: 600,
            color: C.n900,
          }}>
            {currentPIC?.name || 'Belum dipilih'}
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 11,
            color: C.n500,
          }}>
            {currentPIC?.role
              ? `${currentPIC.role.charAt(0).toUpperCase() + currentPIC.role.slice(1)}`
              : 'Pilih penanggung jawab'}
          </div>
        </div>
        <ChevronDown size={20} color={C.n400} />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Pilih Penanggung Jawab"
      >
        <UserSelectorContent
          users={filteredUsers}
          loading={loading}
          currentPIC={currentPIC}
          onSelect={handleSelect}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClose={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

// ─── User Selector Content (shared between modes) ────────────────────────────
function UserSelectorContent({
  users,
  loading,
  currentPIC,
  onSelect,
  searchQuery,
  onSearchChange,
  onClose,
}) {
  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari nama atau role..."
          style={{
            width: '100%',
            padding: '10px 12px',
            fontFamily: 'Poppins',
            fontSize: 13,
            border: `1.5px solid ${C.n200}`,
            borderRadius: 10,
            outline: 'none',
          }}
          onFocus={(e) => e.target.style.borderColor = C.primary}
          onBlur={(e) => e.target.style.borderColor = C.n200}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: 24,
          color: C.n500,
          fontFamily: 'Poppins',
          fontSize: 13,
        }}>
          Memuat daftar user...
        </div>
      )}

      {/* User List */}
      {!loading && (
        <div style={{
          maxHeight: 300,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {users.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: 24,
              color: C.n500,
              fontFamily: 'Poppins',
              fontSize: 13,
            }}>
              Tidak ada user ditemukan
            </div>
          )}

          {users.map((user) => {
            const isSelected = currentPIC && String(user.id) === String(currentPIC.id);

            return (
              <button
                key={user.id}
                onClick={() => onSelect(user)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: isSelected ? `${C.primary}12` : C.white,
                  border: `2px solid ${isSelected ? C.primary : C.n200}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: isSelected ? C.primary : C.n200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 600,
                  color: isSelected ? 'white' : C.n600,
                  flexShrink: 0,
                }}>
                  {user.name?.charAt(0)?.toUpperCase() || '?'}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: 13,
                    fontWeight: 600,
                    color: isSelected ? C.primary : C.n900,
                  }}>
                    {user.name}
                    {user.isCurrentUser && (
                      <span style={{
                        marginLeft: 6,
                        fontSize: 10,
                        fontWeight: 400,
                        color: C.n500,
                      }}>
                        (Anda)
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: 11,
                    color: C.n500,
                  }}>
                    {user.role
                      ? `${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`
                      : '-'}
                  </div>
                </div>

                {isSelected && (
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    background: C.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Check size={14} color="white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Cancel Button */}
      <div style={{ marginTop: 16 }}>
        <Btn
          variant="outline"
          onClick={onClose}
          style={{ width: '100%' }}
        >
          Batal
        </Btn>
      </div>
    </div>
  );
}

// ─── Compact PIC Badge (for display in transaction header) ───────────────────
/**
 * PICBadge — Small badge showing current PIC
 *
 * Usage:
 *   <PICBadge pic={currentPIC} />
 */
export function PICBadge({ pic }) {
  if (!pic) return null;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      background: `${C.primary}15`,
      borderRadius: 20,
      border: `1px solid ${C.primary}30`,
    }}>
      <div style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        background: C.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 600,
        color: 'white',
      }}>
        {pic.name?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <span style={{
        fontFamily: 'Poppins',
        fontSize: 11,
        fontWeight: 500,
        color: C.primary,
      }}>
        {pic.name}
      </span>
    </div>
  );
}

// ─── PIC History Card ─────────────────────────────────────────────────────────
/**
 * PICHISTORYCard — Shows recent PIC changes
 *
 * Usage:
 *   <PICHistoryCard history={picHistory} />
 */
export function PICHistoryCard({ history = [] }) {
  if (history.length === 0) return null;

  return (
    <div style={{
      background: C.white,
      borderRadius: 12,
      padding: 14,
      border: `1px solid ${C.n200}`,
    }}>
      <div style={{
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: 600,
        color: C.n700,
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <Users size={14} />
        Riwayat Ganti PIC
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {history.slice(-5).reverse().map((record, idx) => (
          <div
            key={record.id || idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: C.n50,
              borderRadius: 8,
            }}
          >
            <div style={{
              fontSize: 10,
              color: C.n400,
              fontFamily: 'Poppins',
              minWidth: 50,
            }}>
              {new Date(record.timestamp).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div style={{
              flex: 1,
              fontFamily: 'Poppins',
              fontSize: 11,
              color: C.n700,
            }}>
              <span style={{ color: C.n500 }}>{record.from?.name || '?'}</span>
              {' → '}
              <span style={{ fontWeight: 600 }}>{record.to?.name || '?'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
