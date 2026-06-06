/**
 * AppContext.jsx — Backward-compatible re-export.
 * 
 * The actual logic is split into:
 *   - AuthContext.jsx  (auth, navigation, screen state)
 *   - BusinessContext.jsx (customers, transactions, nota)
 *
 * Existing code using `useApp()` continues to work. New code should
 * prefer `useAuth()` or `useBusiness()` for more granular subscriptions.
 */
import { AuthProvider, useAuth } from './AuthContext';
import { BusinessProvider, useBusiness } from './BusinessContext';

/** Combined hook — returns ALL context values. For backward compat only. */
export const useApp = () => {
  const auth = useAuth();
  const biz = useBusiness();
  return { ...auth, ...biz };
};

/** Combined provider wrapping both Auth + Business contexts */
export const AppProvider = ({ children }) => (
  <AuthProvider>
    <BusinessProvider>
      {children}
    </BusinessProvider>
  </AuthProvider>
);

// Re-export sub-hooks for new code
export { useAuth } from './AuthContext';
export { useBusiness } from './BusinessContext';
