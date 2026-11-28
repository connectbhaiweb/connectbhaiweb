/* Live data without pulling: every 30 s while the screen is in front, and at once when the person comes back. */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { http } from './api';

export function useAutoRefresh(refresh: () => void, every = 30000) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      const run = () => {
        http.clearCache();
        latest.current();
      };
      if (!first.current) run();
      first.current = false;
      const timer = setInterval(() => AppState.currentState === 'active' && run(), every);
      let away = 0;
      const sub = AppState.addEventListener('change', (state) => {
        if (state !== 'active') away = Date.now();
        else if (away && Date.now() - away > 5000) run();
      });
      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [every]),
  );
}
