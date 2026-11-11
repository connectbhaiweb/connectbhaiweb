"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Menu, Search, Store, UserRound } from "lucide-react";
import Logo from "@/components/Logo";
import { CONFIG, LIVE } from "@/lib/connectbhai/config";
import { initials } from "@/lib/connectbhai/shared";
import { FEES, hrefOf } from "./nav";
import { search as runSearch } from "./search";

const PLACEHOLDER = { customer: "Search plans, bookings or help (e.g. Airtel, 452010)...", dsa: "Search leads, customers, bookings (e.g. CB-104B2, mobile)...", tip: "Search leads, installations, customers or tickets...", admin: "Search leads, DSAs, TIPs, plans, locations, tickets (e.g. CB-104B2, 452010)..." };

function WhatsAppIcon() { return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="#fff" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>; }

export default function Topbar({ role, cfg, user, chatCount, navOpen, onBurger, acctOpen, onAcct, onClose }) {
  const router = useRouter();
  const [mOpen, setMOpen] = useState(false), [q, setQ] = useState(""), [res, setRes] = useState({ q: "", list: [] }), [open, setOpen] = useState(false), [hi, setHi] = useState(-1);
  const box = useRef(null), lid = useId();
  useEffect(() => {
    const t = q.trim(); if (!t) return;
    let off = false; const timer = setTimeout(() => runSearch(role, t).then(list => { if (!off) { setRes({ q: t, list }); setHi(-1); } }), 160);
    return () => { off = true; clearTimeout(timer); };
  }, [q, role]);
  useEffect(() => {
    if (!open) return;
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away); return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const list = q.trim() && res.q === q.trim() ? res.list : [];
  const go = r => { setOpen(false); setMOpen(false); setQ(""); router.push(r.href); };
  const submit = async e => {
    e.preventDefault(); const t = q.trim(); if (!t) return;
    const l = res.q === t ? res.list : await runSearch(role, t);
    if (l.length) { go(l[Math.max(0, hi)]); return; }
    import("@/lib/connectbhai/ui").then(m => m.speedBridge.toast(`Nothing found for "${t}".`));
  };
  const keys = e => {
    if (e.key === "Escape") { setOpen(false); setMOpen(false); return; }
    if (!list.length || !["ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault(); setOpen(true); setHi(h => (e.key === "ArrowDown" ? (h + 1) % list.length : (h - 1 + list.length) % list.length));
  };
  return (
    <header className="dsh-top">
      <button type="button" className="dsh-burger" aria-label="Open menu" aria-expanded={navOpen} onClick={onBurger}><Menu aria-hidden="true" /></button>
      <Link href="/" className="dsh-logo" aria-label="Connect Bhai home"><Logo height={38} /></Link>
      <form className={`dsh-search${mOpen ? " is-open" : ""}`} id="dsh-search" role="search" onSubmit={submit} ref={box}>
        <Search aria-hidden="true" />
        <input name="q" type="search" placeholder={PLACEHOLDER[role]} aria-label="Search" autoComplete="off" value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={keys}
          role="combobox" aria-expanded={open && list.length > 0} aria-controls={lid} aria-activedescendant={hi >= 0 ? `${lid}-${hi}` : undefined} />
        {open && list.length > 0 && (
          <ul className="dsh-results" id={lid} role="listbox" aria-label="Search results">
            {list.map((r, i) => (
              <li key={r.kind + r.href + r.title} id={`${lid}-${i}`} role="option" aria-selected={i === hi}>
                <Link href={r.href} onClick={e => { e.preventDefault(); go(r); }} tabIndex={-1}><em>{r.kind}</em><b>{r.title}</b><span>{r.sub}</span></Link>
              </li>
            ))}
          </ul>
        )}
      </form>
      <div className="dsh-right">
        <button type="button" className="dsh-msearch" aria-label="Search" aria-expanded={mOpen} aria-controls="dsh-search" onClick={() => { setMOpen(v => !v); setTimeout(() => { const i = document.querySelector("#dsh-search input"); if (i) i.focus(); }, 30); }}><Search aria-hidden="true" /></button>
        <a className="dsh-wa" href={`https://wa.me/91${CONFIG.SUPPORT_PHONE}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp support"><WhatsAppIcon /></a>
        <Link prefetch={false} className="dsh-bell" href={hrefOf(role, "chat")} aria-label={chatCount ? `Messages, ${chatCount} unread` : "Messages"}><Bell aria-hidden="true" />{chatCount ? <i /> : null}</Link>
        <span className="dsh-sep" aria-hidden="true" />
        <div className="dsh-acct">
          <button type="button" className="dsh-acct-btn" aria-expanded={acctOpen} aria-haspopup="menu" onClick={() => onAcct(!acctOpen)}>
            <span className={`dsh-avatar av-${role}`}>{role === "tip" ? <Store aria-hidden="true" /> : role === "admin" ? <UserRound aria-hidden="true" /> : initials(user.full_name)}</span>
            <span className="dsh-who"><b>{user.full_name}</b>{role !== "customer" && <em>{cfg.title}</em>}</span>
            <ChevronDown aria-hidden="true" />
          </button>
          <div className="dsh-menu" role="menu" hidden={!acctOpen} onClick={onClose}>
            {FEES[role] && <Link prefetch={false} href={hrefOf(role, FEES[role][0])} role="menuitem">{FEES[role][1]}</Link>}
            <Link href="/" role="menuitem">Go to website</Link>
            {!LIVE && <button type="button" role="menuitem" data-act="reset-demo">Reset demo data</button>}
            <button type="button" role="menuitem" data-act="logout">Log out</button>
          </div>
        </div>
      </div>
    </header>
  );
}
