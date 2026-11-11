import Link from "next/link";
import { Ellipsis, X } from "lucide-react";
import { Badge } from "./Sidebar";
import { hrefOf } from "./nav";

/* Phones: the sidebar becomes a bottom bar. More than 5 items → first 4 + "More" sheet with everything. */
export default function BottomNav({ role, cfg, current, counts, moreOpen, onMore, onNavigate }) {
  const many = cfg.items.length > 5, shown = many ? cfg.items.slice(0, 4) : cfg.items;
  const inMore = many && !shown.some(i => i.tab === current);
  return (
    <>
      <nav className="dsh-bottom" aria-label="Dashboard">
        {shown.map(({ tab, label, short, Icon, badge }) => (
          <Link prefetch={false} key={tab} href={hrefOf(role, tab)} className="dsh-bn" aria-current={current === tab ? "page" : undefined} onClick={onNavigate}>
            <span className="dsh-bn-ico"><Icon aria-hidden="true" />{counts[tab] && badge ? <i className="dsh-dot" aria-label={`${counts[tab]} new`} /> : null}</span>{short || label}
          </Link>
        ))}
        {many && <button type="button" className="dsh-bn" aria-expanded={moreOpen} aria-controls="dsh-sheet" aria-current={inMore ? "page" : undefined} onClick={() => onMore(!moreOpen)}><span className="dsh-bn-ico"><Ellipsis aria-hidden="true" /></span>More</button>}
      </nav>
      {many && (
        <div id="dsh-sheet" className="dsh-sheet" hidden={!moreOpen} role="dialog" aria-label="All pages">
          <div className="dsh-sheet-head"><b>Menu</b><button type="button" onClick={() => onMore(false)} aria-label="Close menu"><X /></button></div>
          <ul>
            {cfg.items.map(({ tab, label, Icon, badge }) => (
              <li key={tab}><Link prefetch={false} href={hrefOf(role, tab)} className="dsh-sheet-item" aria-current={current === tab ? "page" : undefined} onClick={onNavigate}><Icon aria-hidden="true" /><span>{label}</span><Badge kind={badge} n={counts[tab]} /></Link></li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
