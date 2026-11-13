import Link from "next/link";
import Mascot from "./Mascot";
import { BADGE_TEXT, hrefOf } from "./nav";

export function Badge({ kind, n }) {
  if (!kind || !n) return null;
  if (kind.startsWith("dot-")) return <span className={`dsh-badge b-circle b-${kind.slice(4)}`}>{n}</span>;
  const tone = kind === "new" || kind === "due" ? "red" : kind === "pending" ? "amber" : "blue";
  return <span className={`dsh-badge b-pill b-${tone}`}>{BADGE_TEXT[kind](n)}</span>;
}

/* Left sidebar (desktop full, tablet icon rail that expands). Items are real links: /my/bookings, /admin/leads … */
export default function Sidebar({ role, cfg, current, counts, open, onNavigate }) {
  return (
    <aside className="dsh-side" data-open={open || undefined} style={{ "--n": cfg.items.length }} aria-label={`${cfg.title} menu`}>
      <nav>
        <ul>
          {cfg.items.map(({ tab, label, Icon, badge }) => (
            <li key={tab}>
              <Link prefetch={false} href={hrefOf(role, tab)} className="dsh-item" aria-current={current === tab ? "page" : undefined} title={label} onClick={onNavigate}>
                <Icon aria-hidden="true" /><span className="dsh-lbl">{label}</span><Badge kind={badge} n={counts[tab]} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="dsh-mascot">
        <Mascot className="dsh-mascot-art" />
        <p>Compare. Choose. Connect. Care.</p>
      </div>
      <svg className="dsh-wave" viewBox="0 0 296 56" preserveAspectRatio="xMinYMax slice" aria-hidden="true">
        <defs><linearGradient id="dshWave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0B3EA6" /><stop offset="1" stopColor="#062B78" /></linearGradient></defs>
        <path d="M0 20C25 10 50 2 78 2c32 0 57 10 112 34 35-8 70-22 106-23v43H0z" fill="url(#dshWave)" />
        <path d="M128 56c22-10 42-18 62-20 35-8 70-22 106-23v43z" fill="#0A3A9C" opacity=".35" />
      </svg>
    </aside>
  );
}
