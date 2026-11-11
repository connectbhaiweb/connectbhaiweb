"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/connectbhai/runtime";
import { ROLES, ROLE_BY_BASE, activeTab } from "./nav";
import { useLegacyBadges } from "./useLegacyBadges";
import { useRoleCounts } from "./roleCounts";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import BottomNav from "./BottomNav";

/* App shell for the four role dashboards (top bar, sidebar, bottom nav). Only shows for a signed-in user on their own
   role's routes; everywhere else the normal site header/footer stay. The page content itself is <main id="app">. */
export default function DashboardShell() {
  const { user, ready } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pathname = usePathname();
  const [, seg, tabSeg] = pathname.split("/");
  const role = ROLE_BY_BASE[seg];
  const active = !!(user && role && user.role === role);
  const cfg = active ? ROLES[role] : null;
  const current = cfg ? activeTab(cfg, (tabSeg && decodeURIComponent(tabSeg)) || cfg.items[0].tab) : null;
  const pageCounts = useLegacyBadges(active), roleCounts = useRoleCounts(active ? role : null);
  // one number per badge on every tab: the role's own counts (same formulas as its home page) win; the open page's strip
  // only fills a badge the role counts do not cover (older views count "open" leads, not "new" ones)
  const counts = { ...pageCounts };
  for (const [k, n] of Object.entries(roleCounts)) { if (n > 0) counts[k] = n; else delete counts[k]; }
  const [open, setOpen] = useState({ at: pathname, nav: false, more: false, acct: false });
  const o = open.at === pathname ? open : { at: pathname, nav: false, more: false, acct: false };
  const set = patch => setOpen({ ...o, ...patch });

  useEffect(() => {                         // one effect: the "pending" flag is cleared in the same commit that sets the shell (no flash)
    const el = document.documentElement;
    if (active) { el.dataset.shell = role; el.removeAttribute("data-shell-pending"); el.removeAttribute("data-entering"); }   // dashboard is up: drop the login cover
    else { delete el.dataset.shell; if (ready) el.removeAttribute("data-shell-pending"); }
    return () => { delete el.dataset.shell; };
  }, [active, role, ready]);
  useEffect(() => {
    if (!o.nav && !o.more && !o.acct) return;
    const onKey = e => { if (e.key === "Escape") setOpen({ at: pathname, nav: false, more: false, acct: false }); };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [o.nav, o.more, o.acct, pathname]);

  if (!active) return null;
  const closeAll = () => set({ nav: false, more: false, acct: false });
  return (
    <div className="dsh">
      <Topbar role={role} cfg={cfg} user={user} chatCount={counts.chat} navOpen={o.nav} onBurger={() => set({ nav: !o.nav })} acctOpen={o.acct} onAcct={v => set({ acct: v })} onClose={closeAll} />
      <Sidebar role={role} cfg={cfg} current={current} counts={counts} open={o.nav} onNavigate={closeAll} />
      {(o.nav || o.acct) && <div className="dsh-scrim" onClick={closeAll} aria-hidden="true" />}
      <BottomNav role={role} cfg={cfg} current={current} counts={counts} moreOpen={o.more} onMore={v => set({ more: v })} onNavigate={closeAll} />
    </div>
  );
}
