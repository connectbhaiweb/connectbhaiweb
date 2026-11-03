"use client";
import { useEffect, useState } from "react";

/* Live counts for the sidebar, read from the page's tab strip: the old views' <main id="app"> .tabs, or the hidden
   [data-cb-counts] strip a React dashboard page renders. */
export function useLegacyBadges(enabled) {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    if (!enabled) return;
    const host = document.body;
    const read = () => {
      const next = {};
      host.querySelectorAll("#app .tabs [data-tab], [data-cb-counts] [data-tab]").forEach(t => { const n = parseInt(t.querySelector(".cnt")?.textContent || "", 10); if (n > 0) next[t.dataset.tab] = n; });
      setCounts(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    read();
    const mo = new MutationObserver(read); mo.observe(host, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [enabled]);
  return counts;
}
