"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const HEADING = ".legal h1, .dsh-page h1, #app h1, main h1";

/* Scroll to the top and put keyboard focus on the page's main heading. The view may paint a moment later, so the
   heading is looked for for about one second. Returns a function that stops the search. */
function toTop() {
  window.scrollTo(0, 0);
  let tries = 0;
  const t = setInterval(() => {
    const h = document.querySelector(HEADING);
    if (h && h.offsetParent !== null) { clearInterval(t); h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    else if (++tries > 12) clearInterval(t);
  }, 80);
  return () => clearInterval(t);
}

/* After every page change (not the first load) the page opens at its first line. Clicking a link to the page you are
   already on changes no route, so the browser leaves the scroll where it is: that click is handled here too.
   Scrolling to a section (data-scroll, #hash) is done by the app or the browser after this and still wins. */
export default function RouteScroll() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    return toTop();
  }, [pathname]);
  useEffect(() => {
    let stop = null;
    const onClick = e => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      let u; try { u = new URL(a.href, window.location.href); } catch (err) { return; }
      if (u.origin !== window.location.origin || u.hash || u.pathname !== window.location.pathname || u.search !== window.location.search) return;
      if (stop) stop();
      stop = toTop();
    };
    document.addEventListener("click", onClick, true);   // capture: Next's Link calls preventDefault before a bubbling listener runs
    return () => { document.removeEventListener("click", onClick, true); if (stop) stop(); };
  }, []);
  return null;
}
