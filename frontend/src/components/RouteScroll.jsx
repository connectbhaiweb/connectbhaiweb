"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/* After every page change (not the first load): scroll to the top and put keyboard focus on the page's main heading,
   so a link such as Privacy Policy opens at its first line. The view may paint a moment later, so the heading is
   looked for for about one second. Scrolling to a section (data-scroll) is done by the app after this and still wins. */
export default function RouteScroll() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    let tries = 0;
    const t = setInterval(() => {
      const h = document.querySelector(".legal h1, .dsh-page h1, #app h1, main h1");
      if (h && h.offsetParent !== null) { clearInterval(t); h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
      else if (++tries > 12) clearInterval(t);
    }, 80);
    return () => clearInterval(t);
  }, [pathname]);
  return null;
}
