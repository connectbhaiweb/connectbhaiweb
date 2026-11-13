"use client";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/* Goes one step back in the browser history. If this tab has no earlier page (opened straight on this URL), it goes to
   the parent route instead, or home, so Back never does nothing. */
export function useGoBack() {
  const router = useRouter();
  const pathname = usePathname();
  return () => {
    const sameSiteReferrer = typeof document !== "undefined" && document.referrer && new URL(document.referrer).origin === window.location.origin;
    if (window.history.length > 1 && (sameSiteReferrer || window.history.state?.idx > 0 || window.history.state)) { router.back(); return; }
    const parts = pathname.split("/").filter(Boolean);
    router.push(parts.length > 1 ? "/" + parts.slice(0, -1).join("/") : "/");
  };
}

/* Strip under the site header on every page except home. Dashboards hide it (they have a Back button in their top bar). */
export default function BackButton() {
  const pathname = usePathname();
  const back = useGoBack();
  if (pathname === "/") return null;
  return (
    <div className="backbar">
      <div className="wrap">
        <button type="button" className="backbtn" onClick={back} aria-label="Go back"><ArrowLeft aria-hidden="true" /><span>Back</span></button>
      </div>
    </div>
  );
}
