"use client";
import { useEffect, useState } from "react";

/* Server-rendered h1 and intro text for pages whose visible content is painted by JavaScript into <main id="app"> (/ and /care).
   Crawlers and AI tools that do not run JS read it. It is visually hidden at first. When the painted view (which has its own h1)
   is on screen, ViewRoute fires "cb:seo-intro-done" and this component removes itself, so the page keeps exactly one h1. */
const VISUALLY_HIDDEN = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };

export default function SeoIntro({ title, children }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const finish = () => setDone(true);
    window.addEventListener("cb:seo-intro-done", finish);
    return () => window.removeEventListener("cb:seo-intro-done", finish);
  }, []);
  if (done) return null;
  return (
    <div style={VISUALLY_HIDDEN}>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
