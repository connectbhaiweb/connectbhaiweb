"use client";
import { useEffect } from "react";

/* On phones every table becomes a stack of cards (see the max-width:700px rules in portal.css and legacy-dash.css).
   A card cell has no column header any more, so each cell gets its header text as data-l, which the CSS prints in front
   of the value. Covers the React tables (role="table", header row .pt-th) and the legacy <table class="tbl">. */
const clean = t => t.replace(/\s+/g, " ").trim();

function label(root) {
  root.querySelectorAll('.pt-table[role="table"]:not(.cp-table)').forEach(t => {
    const head = t.querySelector(".pt-th");
    if (!head) return;
    const names = [...head.children].map(c => clean(c.textContent));
    t.querySelectorAll(".pt-tr:not(.pt-th)").forEach(row => {
      [...row.children].forEach((c, i) => { if (names[i] && c.getAttribute("data-l") !== names[i]) c.setAttribute("data-l", names[i]); });
    });
  });
  root.querySelectorAll("table.tbl").forEach(t => {
    const names = [...t.querySelectorAll("thead th")].map(h => clean(h.textContent));
    if (!names.length) return;
    t.querySelectorAll("tbody tr").forEach(row => {
      [...row.children].forEach((c, i) => {
        if (names[i] && c.getAttribute("data-l") !== names[i]) c.setAttribute("data-l", names[i]);
        if (c.tagName === "TD" && !(c.firstElementChild && c.firstElementChild.classList.contains("cv")) && c.childNodes.length) {   // one block per cell, so the card can put the label beside it
          const w = document.createElement("div"); w.className = "cv";
          while (c.firstChild) w.appendChild(c.firstChild);
          c.appendChild(w);
        }
      });
    });
  });
}

export default function ResponsiveTables() {
  useEffect(() => {
    let raf = 0;
    const run = () => { raf = 0; label(document.body); };
    run();
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(run); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}
