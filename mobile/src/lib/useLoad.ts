/* Load something for a screen: skeleton while loading, error with retry, pull to refresh. */
import { useCallback, useEffect, useRef, useState } from 'react';

import { http } from './api';
import { errMsg } from './forms';

export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [refreshing, setRefreshing] = useState(false);
  const run = useRef(0);
  const reload = useCallback(async (quiet?: boolean) => {
    const mine = ++run.current;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const data = await load();
      if (mine === run.current) setState({ data, loading: false });
    } catch (e) {
      // a quiet refresh keeps what is already on screen
      if (mine === run.current) setState((s) => (quiet && s.data !== undefined ? { ...s, loading: false } : { error: errMsg(e), loading: false }));
    }
    // the caller lists what the loader depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    http.clearCache();
    await reload(true);
    setRefreshing(false);
  }, [reload]);
  return { ...state, reload, refresh, refreshing };
}
