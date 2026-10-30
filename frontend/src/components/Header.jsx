"use client";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/connectbhai/runtime";
import { ROLE_HOME, ROLE_NAME, ROLE_NAV_LABEL, initials, viewFromPath } from "@/lib/connectbhai/shared";

/* Sticky header. Navigation buttons keep the original data-go attributes; the delegated click handler turns them into
   router navigation (it also closes any open modal, exactly like the original site). */
export default function Header() {
  const { user } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const view = viewFromPath(usePathname());
  const nav = [["home", "Plans"], ["router", "Care plan"], ["speed", "Speed test"]];
  if (user) nav.push([ROLE_HOME[user.role], ROLE_NAV_LABEL[user.role]]);

  return (
    <header className="top">
      <div className="wrap">
        <button className="brand" data-go="home" type="button" aria-label="Connect Bhai home">
          <Logo variant="reveal" height={40} priority />
        </button>
        <nav className="topnav" id="topnav" aria-label="Main">
          {nav.map(([v, label]) => (
            <button key={v} type="button" data-go={v} aria-current={view === v ? "page" : undefined}>{label}</button>
          ))}
        </nav>
        <div className="acts" id="topacts">
          {user ? (
            <>
              <button className="btn btn-ghost btn-sm" data-go={ROLE_HOME[user.role]} type="button">
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
              <button className="btn btn-primary btn-sm" data-go="home" data-scroll="search" type="button">Find plans</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
