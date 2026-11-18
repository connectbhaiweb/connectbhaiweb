"use client";
import { useEffect } from "react";

/* One per route. Tells the app module which view/tab the URL points at; the view paints itself into <main id="app">. */
export default function ViewRoute({ view, tab = null }) {
  useEffect(() => {
    let cancelled = false;
    import("@/lib/connectbhai/ui").then(async ui => {
      if (cancelled) return;
      await ui.show(view, tab);
      /* The painted view has its own h1: hide the server-rendered SEO intro (components/SeoIntro.jsx). */
      if (!cancelled) document.querySelectorAll("[data-seo-intro]").forEach(el => { el.hidden = true; });
    });
    return () => { cancelled = true; };
  }, [view, tab]);
  return null;
}
