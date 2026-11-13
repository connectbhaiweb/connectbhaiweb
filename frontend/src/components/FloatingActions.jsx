"use client";
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { SUPPORT_WA_URL } from "@/lib/contact";

/* Bottom-right: a pulsing WhatsApp button (opens a chat with the support number) and a "Top" pill that appears after scrolling. */
const WaIcon = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img className="fab-wa-img" src="/whatsapp-float.png" alt="" width="96" height="96" draggable="false" />
);

export default function FloatingActions() {
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fab-stack" id="fab-stack">
      <a className="fab-wa" href={SUPPORT_WA_URL} target="_blank" rel="noopener noreferrer" aria-label="Chat with Connect Bhai on WhatsApp">
        <span className="fab-wa-ring" aria-hidden="true" /><span className="fab-wa-ring fab-wa-ring-2" aria-hidden="true" />
        <WaIcon />
      </a>
      <button className="fab-top" type="button" data-show={showTop} tabIndex={showTop ? 0 : -1} aria-hidden={!showTop}
        onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}>
        Top <ArrowUp aria-hidden="true" />
      </button>
    </div>
  );
}
