"use client";
import { useEffect } from "react";

/* One per route. Tells the app module which view/tab the URL points at; the view paints itself into <main id="app">. */
export default function ViewRoute({ view, tab = null }) {
  useEffect(() => {
    let cancelled = false;
    import("@/lib/connectbhai/ui").then(async ui => {
      if (cancelled) return;
      await ui.show(view, tab);
      /* The painted view has its own h1: tell the server-rendered SEO intro to remove itself (components/SeoIntro.jsx). */
      if (!cancelled) window.dispatchEvent(new Event("cb:seo-intro-done"));
    });
    return () => { cancelled = true; };
  }, [view, tab]);
  return null;
}
