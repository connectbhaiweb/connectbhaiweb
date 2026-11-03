"use client";
import { useEffect, useRef, useState } from "react";

const STATIC = "/brand/logo-full.png";      // first frame of ConnectBhai_Refined_Clear_BC_Text_Reveal.gif, transparent
const ANIM = "/brand/logo-reveal.webp";     // the same GIF, transparent animated WebP (all 46 frames, same timing)
const PLAY_MS = 3600;
const RATIO = 452 / 96;

let animBytes = null;
const loadAnim = () => (animBytes ||= fetch(ANIM).then(r => r.blob()).catch(() => null));

/* Brand logo: static by default; plays the reveal on hover / keyboard focus / tap, back to static on leave.
   Each play uses a fresh object URL of the preloaded file, so the animation always starts at frame 1. */
export default function Logo({ variant = "hover", height = 38, priority = false }) {
  const [src, setSrc] = useState(STATIC);
  const box = useRef(null);
  const animated = variant === "hover";

  useEffect(() => {
    if (!animated) return;
    loadAnim();
    const host = box.current?.closest("a,button") || box.current;
    let timer, holdUntil = 0, url = null;
    const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stop = () => { clearTimeout(timer); setSrc(STATIC); if (url) { const u = url; url = null; setTimeout(() => URL.revokeObjectURL(u), 1000); } };
    const play = () => {
      if (calm()) return;
      loadAnim().then(blob => {
        if (url) URL.revokeObjectURL(url);
        url = blob ? URL.createObjectURL(blob) : `${ANIM}?t=${Date.now()}`;
        setSrc(url);
      });
    };
    const enter = () => { if (Date.now() >= holdUntil) play(); };
    const leave = () => { if (Date.now() >= holdUntil) stop(); };
    const touch = () => { if (calm()) return; holdUntil = Date.now() + PLAY_MS; play(); clearTimeout(timer); timer = setTimeout(() => { holdUntil = 0; stop(); }, PLAY_MS); };
    const ev = [["mouseenter", enter], ["mouseleave", leave], ["focus", play], ["blur", leave]];
    ev.forEach(([e, f]) => host.addEventListener(e, f));
    host.addEventListener("touchstart", touch, { passive: true });
    return () => { clearTimeout(timer); ev.forEach(([e, f]) => host.removeEventListener(e, f)); host.removeEventListener("touchstart", touch); if (url) URL.revokeObjectURL(url); };
  }, [animated]);

  return (
    <span ref={box} className="logo-swap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Connect Bhai" width={Math.round(height * RATIO)} height={height} className="logo-img" draggable={false}
        fetchPriority={priority ? "high" : undefined} style={{ height: `var(--logo-h, ${height}px)`, width: "auto" }} />
    </span>
  );
}
