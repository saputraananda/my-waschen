// ─────────────────────────────────────────────────────────────────────────────
// usePIC.js — PIC (Penanggung Jawab) Selection Hook
// Phase 1.3: PIC Selection System
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/**
 * usePIC — Hook untuk manage PIC (Penanggung Jawab) selection
 *
 * Usage:
 *   const { currentPIC, setCurrentPIC, availableUsers, isLoading, refreshUsers } = usePIC();
 *
 * Features:
 * - Get current active PIC from session/shift
 * - Set active PIC for transactions
 * - List available users (same outlet)
 * - Track PIC change history
 */
export function usePIC() {
  const { user } = useAuth();

  // Current active PIC
  const [currentPIC, setCurrentPICState] = useState(null);

  // Available users for PIC selection
  const [availableUsers, setAvailableUsers] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize: use logged-in user as default PIC
  useEffect(() => {
    if (user && !currentPIC) {
      setCurrentPICState({
        id: user.userId || user.id,
        name: user.name || user.userName,
        role: user.roleCode || user.role,
      });
    }
  }, [user, currentPIC]);

  // Fetch available users for PIC selection
  const fetchAvailableUsers = useCallback(async () => {
    if (!user?.outletId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await axios.get('/api/users/pic', {
        params: {
          role: 'kasir,frontliner',
          isActive: true,
        }
      });

      const users = res?.data?.data || res?.data || [];

      // getPICUsers already filters by outlet from JWT, no extra filter needed
      setAvailableUsers(users.map(u => ({
        id: u.id || u.userId,
        name: u.name || u.userName,
        role: u.roleCode || u.role,
        isCurrentUser: String(u.id || u.userId) === String(user.userId || user.id),
      })));

    } catch (err) {
      setError('Gagal memuat daftar user');

      // Fallback: just include current user
      if (user) {
        setAvailableUsers([{
          id: user.userId || user.id,
          name: user.name || user.userName,
          role: user.roleCode || user.role,
          isCurrentUser: true,
        }]);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.outletId, user?.userId, user?.id, user?.name, user?.userName, user?.roleCode, user?.role]);

  // Set current PIC
  const setCurrentPIC = useCallback((pic) => {
    if (!pic) return;

    const picData = {
      id: pic.id || pic.userId || pic.value,
      name: pic.name || pic.userName || pic.label,
      role: pic.role || pic.roleCode,
      changedAt: new Date().toISOString(),
    };

    setCurrentPICState(picData);

    // Persist to session storage (survives refresh within same session)
    try {
      sessionStorage.setItem('waschen_active_pic', JSON.stringify(picData));
    } catch (e) {
      // Silent fail - PIC persist optional
    }
  }, []);

  // Restore PIC from session storage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('waschen_active_pic');
      if (stored) {
        const picData = JSON.parse(stored);
        // Verify user still exists
        if (user && String(picData.id) === String(user.userId || user.id)) {
          setCurrentPICState(picData);
        }
      }
    } catch (e) {
      // Silent fail - PIC restore optional
    }
  }, [user]);

  // Clear PIC (on logout)
  const clearPIC = useCallback(() => {
    setCurrentPICState(null);
    try {
      sessionStorage.removeItem('waschen_active_pic');
    } catch (e) {
      // Silent fail - PIC clear optional
    }
  }, []);

  return {
    // Current active PIC
    currentPIC,

    // Set current PIC
    setCurrentPIC,

    // Clear PIC (on logout)
    clearPIC,

    // Available users for selection
    availableUsers,

    // Fetch available users
    refreshUsers: fetchAvailableUsers,

    // Loading states
    isLoading: loading,
    error,

    // Quick helpers
    isCurrentUserPIC: currentPIC &&
      String(currentPIC.id) === String(user?.userId || user?.id),
  };
}

/**
 * usePICAudit — Hook untuk audit trail PIC changes
 *
 * Usage:
 *   const { recordPICChange, picHistory } = usePICAudit();
 */
export function usePICAudit() {
  const [picHistory, setPicHistory] = useState([]);

  // Record PIC change
  const recordPICChange = useCallback((fromPIC, toPIC, reason) => {
    const record = {
      id: Date.now(),
      from: fromPIC,
      to: toPIC,
      reason: reason || 'manual_change',
      timestamp: new Date().toISOString(),
    };

    setPicHistory(prev => [...prev, record]);

    // Persist to session
    try {
      const stored = sessionStorage.getItem('waschen_pic_history');
      const history = stored ? JSON.parse(stored) : [];
      history.push(record);
      // Keep last 50 records
      if (history.length > 50) history.shift();
      sessionStorage.setItem('waschen_pic_history', JSON.stringify(history));
    } catch (e) {
      // Silent fail - PIC history optional
    }
  }, []);

  // Load history from session
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('waschen_pic_history');
      if (stored) {
        setPicHistory(JSON.parse(stored));
      }
    } catch (e) {
      // Silent fail - PIC history optional
    }
  }, []);

  return {
    picHistory,
    recordPICChange,
    clearHistory: () => {
      setPicHistory([]);
      sessionStorage.removeItem('waschen_pic_history');
    },
  };
}

/**
 * usePICSelector — Combined hook for component use
 *
 * Usage:
 *   const { currentPIC, setCurrentPIC, availableUsers, isLoading } = usePICSelector();
 */
export function usePICSelector() {
  const picHook = usePIC();
  const auditHook = usePICAudit();

  // Wrap setCurrentPIC to also record audit
  const setCurrentPICWithAudit = useCallback((pic, reason) => {
    const fromPIC = picHook.currentPIC;
    picHook.setCurrentPIC(pic);

    if (fromPIC && pic && String(fromPIC.id) !== String(pic.id)) {
      auditHook.recordPICChange(fromPIC, pic, reason);
    }
  }, [picHook, auditHook]);

  return {
    ...picHook,
    setCurrentPIC: setCurrentPICWithAudit,
    picHistory: auditHook.picHistory,
  };
}

export default usePIC;
