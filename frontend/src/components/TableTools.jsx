"use client";
import { useEffect } from "react";

/* Adds search + pagination to every dashboard table (see lib/connectbhai/tableTools.js). Renders nothing. */
export default function TableTools() {
  useEffect(() => {
    let stop = null, cancelled = false;
    import("@/lib/connectbhai/tableTools").then(m => { if (!cancelled) stop = m.start(); });
    return () => { cancelled = true; if (stop) stop(); };
  }, []);
  return null;
}
