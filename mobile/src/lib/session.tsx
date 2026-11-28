/* Who is logged in, and whether the phone is online. */
import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { API, http } from './api';
import type { User } from './api/types';

type Session = {
  ready: boolean;
  user: User | null;
  offline: boolean;
  /** read the login again after something changed it (login, payment, profile) */
  sync: () => User | null;
  retry: () => Promise<void>;
  signOut: () => Promise<void>;
};
const Context = createContext<Session>({ ready: false, user: null, offline: false, sync: () => null, retry: async () => {}, signOut: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [offline, setOffline] = useState(false);

  const sync = useCallback(() => {
    const me = API.me();
    setUser(me);
    return me;
  }, []);
  const start = useCallback(async () => {
    try {
      await API.init();
    } finally {
      sync();
      setReady(true);
    }
  }, [sync]);

  useEffect(() => {
    start();
    return http.onSignedOut(() => setUser(null));
  }, [start]);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        // isInternetReachable stays unknown on some phones; only a definite "no" counts as offline
        setOffline(state.isConnected === false);
      }),
    [],
  );

  const retry = useCallback(async () => {
    const state = await NetInfo.refresh();
    setOffline(state.isConnected === false);
    if (state.isConnected !== false) {
      http.clearCache();
      await start();
    }
  }, [start]);
  const signOut = useCallback(async () => {
    await API.signOut();
    sync();
  }, [sync]);

  const value = useMemo(() => ({ ready, user, offline, sync, retry, signOut }), [ready, user, offline, sync, retry, signOut]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useSession = () => useContext(Context);
