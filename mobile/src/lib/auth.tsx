import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, hasTokens, loadTokens, setSignedOutHandler, type User } from './api';

interface AuthState {
  user: User | null;
  ready: boolean;
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState>({ user: null, ready: false, signIn: () => {}, signOut: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(async () => { await api.signOut(); setUser(null); }, []);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    (async () => {
      await loadTokens();
      if (hasTokens()) { try { setUser(await api.me()); } catch { await api.signOut(); } }
      setReady(true);
    })();
  }, []);

  const value = useMemo(() => ({ user, ready, signIn: setUser, signOut }), [user, ready, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
