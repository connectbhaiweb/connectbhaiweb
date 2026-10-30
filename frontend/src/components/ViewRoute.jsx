"use client";
import { useEffect } from "react";

/* One per route. Tells the app module which view/tab the URL points at; the view paints itself into <main id="app">. */
export default function ViewRoute({ view, tab = null }) {
  useEffect(() => {
    let cancelled = false;
    import("@/lib/connectbhai/ui").then(ui => { if (!cancelled) ui.show(view, tab); });
    return () => { cancelled = true; };
  }, [view, tab]);
  return null;
}
