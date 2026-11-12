"use client";
import { useEffect, useReducer, useState, useSyncExternalStore } from "react";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/connectbhai/runtime";

/* Loads data for a React dashboard page through the existing API (same module instance the app uses).
   Re-loads when the app re-renders after an action (pay, restart, chat…) and when the tab regains focus. */
export function useDashData(role, load, enabled = true) {   // enabled=false: the page is mounted on another tab, so nothing is fetched

  const { user, ready } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const active = ready && !!user && user.role === role && enabled;
  const [tick, bump] = useReducer(x => x + 1, 0);
  const [st, setSt] = useState({ data: null, error: null, at: -1 });

  useEffect(() => {
    if (!active) return;
    let off = false;
    import("@/lib/connectbhai/api")
      .then(m => load(m.API, m))
      .then(data => { if (!off) setSt({ data, error: null, at: tick }); })
      .catch(e => { if (!off) setSt(s => ({ data: s.data, error: (e && e.message) || "Could not load this page.", at: tick })); });
    return () => { off = true; };
  }, [active, tick, load]);

  useEffect(() => {
    if (!active) return;
    const again = () => bump();
    let hiddenAt = 0;
    const vis = () => { if (document.hidden) hiddenAt = Date.now(); else if (Date.now() - hiddenAt > 30_000) bump(); };   // a quick tab flick does not reload every list
    window.addEventListener("cb:render", again); window.addEventListener("cb:poll", again);   // cb:poll = the 30 s live refresh (ui.js)
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("cb:render", again); window.removeEventListener("cb:poll", again); document.removeEventListener("visibilitychange", vis); };
  }, [active]);

  return { active, pending: !ready, user, data: st.data, error: st.error, loading: active && !st.data && !st.error, reload: bump };
}
