"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import BackButton from "./BackButton";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/connectbhai/runtime";
import { ROLE_HOME, ROLE_NAME, ROLE_NAV_LABEL, initials, viewFromPath } from "@/lib/connectbhai/shared";

/* Sticky header. Navigation buttons keep the original data-go attributes; the delegated click handler turns them into
   router navigation (it also closes any open modal, exactly like the original site). */
export default function Header() {
  const { user } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pathname = usePathname();
  const view = viewFromPath(pathname);
  const [openAt, setOpenAt] = useState(null);                              // path the menu was opened on: navigating closes it
  const open = openAt === pathname;
  useEffect(() => {                                                       // Esc closes, focus returns to the toggle
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") { setOpenAt(null); document.getElementById("menu-toggle")?.focus(); } };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const nav = [["home", "Plans"], ["router", "Care plan"], ["speed", "Speed test"]];
  if (user) nav.push([ROLE_HOME[user.role], ROLE_NAV_LABEL[user.role]]);

  return (
    <header className="top">
      <div className="wrap">
        <BackButton />
        <button className="brand" data-go="home" type="button" aria-label="Connect Bhai home">
          <Logo height={40} priority />
        </button>
        <nav className="topnav" id="topnav" aria-label="Main">
          {nav.map(([v, label]) => (
            <button key={v} type="button" data-go={v} aria-current={view === v ? "page" : undefined}>{label}</button>
          ))}
        </nav>
        <div className="acts" id="topacts">
          {user ? (
            <>
              <button className="btn btn-ghost btn-sm acts-who" data-go={ROLE_HOME[user.role]} type="button">
                <span className="who">
                  <span className="avatar">{initials(user.full_name)}</span>
                  <span className="nm">{user.full_name}</span>
                  <span className="rolechip">{ROLE_NAME[user.role]}</span>
                </span>
              </button>
              <button className="btn btn-ghost btn-sm" data-act="logout" type="button">Log out</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" data-act="login" type="button">Log in</button>
              <button className="btn btn-primary btn-sm acts-cta" data-go="home" data-scroll="search" type="button">Find plans</button>
            </>
          )}
        </div>
        <button id="menu-toggle" className="menu-toggle" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mnav" onClick={() => setOpenAt(open ? null : pathname)}>
          <span aria-hidden="true" className="burger" />
        </button>
      </div>
      <nav id="mnav" className="mnav" aria-label="Mobile" hidden={!open} onClick={() => setOpenAt(null)}>
        {nav.map(([v, label]) => (
          <button key={v} type="button" data-go={v} aria-current={view === v ? "page" : undefined}>{label}</button>
        ))}
        {!user && <button type="button" className="mnav-cta" data-go="home" data-scroll="search">Find plans</button>}
      </nav>
    </header>
  );
}
