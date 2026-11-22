import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchMe, loadTokens, logout as apiLogout, setLoggedOutHandler, verifyOtp, type User } from './api';

type Ctx = {
  user: User | null;
  ready: boolean;
  signIn: (phone: string, code: string, name?: string) => Promise<User>;
  signOut: () => Promise<void>;
};
const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(async () => { await apiLogout(); setUser(null); }, []);

  useEffect(() => {
    setLoggedOutHandler(() => setUser(null));
    (async () => {
      if (await loadTokens()) {
        try { setUser(await fetchMe()); } catch { /* offline or expired: show login */ }
      }
      setReady(true);
    })();
  }, []);

  const value = useMemo<Ctx>(() => ({
    user, ready, signOut,
    signIn: async (phone, code, name) => { const u = await verifyOtp(phone, code, name); setUser(u); return u; },
  }), [user, ready, signOut]);

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('useSession outside SessionProvider');
  return c;
}
