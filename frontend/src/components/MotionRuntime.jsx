"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { animate, stagger } from "motion";

/* Entrance animation for the site (Motion). Cards, plans, stat tiles and headings fade up one after another when a
   page opens. Only elements that appear while a page opens are animated (up to 6 s of loading, then 0.9 s after the first batch), so a filter click or the 30 s
   live refresh, which repaint the same page, never replay it. Switched off for "reduce motion" users unless localStorage cb-motion is "on" (Windows "animation effects: off" counts as reduce motion). */
const SEL = [
  ".hero-copy > *", ".hero-story", ".plan", ".pt-kpi", ".pt-card", ".kpi", ".cu-card", ".card", ".faq-item", ".trsteps li",
  ".dsh-page h1", ".pt-head", ".care-hero", ".legal-in > *", ".sk-card", "#app > .wrap > h1", ".dhead",
].join(",");
/** true when the visitor asked the system for less motion and has not switched the site animations on. */
export const reduceMotion = () => {
  if (process.env.NODE_ENV === "development") return false;   // local demo: always show the animations
  try { if (localStorage.getItem("cb-motion") === "on") return false; } catch (e) { /* storage blocked */ }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
const LOAD_MS = 6000, SETTLE_MS = 900, MAX = 28;   // a page may load for up to 6 s; 0.9 s after its first batch the window closes
let openUntil = 0;

function enter(nodes) {
  const els = [];
  for (const n of nodes) {
    if (n.nodeType !== 1 || n.closest("[role=dialog], .modal, .overlay")) continue;
    if (n.matches(SEL)) els.push(n);
    n.querySelectorAll && n.querySelectorAll(SEL).forEach(e => els.push(e));
  }
  const fresh = [...new Set(els)].filter(e => !e.dataset.mIn).slice(0, MAX);
  if (!fresh.length) return;
  fresh.forEach(e => { e.dataset.mIn = "1"; });
  openUntil = Math.min(openUntil, performance.now() + SETTLE_MS);   // first batch seen: the page is painting, close soon
  animate(fresh, { opacity: [0, 1], y: [16, 0] }, { duration: 0.5, ease: "easeOut", delay: stagger(0.045) });
}

export default function MotionRuntime() {
  const pathname = usePathname();
  useEffect(() => { openUntil = performance.now() + LOAD_MS; }, [pathname]);
  useEffect(() => {
    if (reduceMotion()) return;
    openUntil = performance.now() + LOAD_MS;
    enter([document.body]);
    const mo = new MutationObserver(list => {
      if (performance.now() > openUntil) return;
      const added = []; list.forEach(m => m.addedNodes.forEach(n => added.push(n)));
      if (added.length) enter(added);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
