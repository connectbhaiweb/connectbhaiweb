"use client";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/connectbhai/runtime";

/* A table that loads ONE page at a time from the API: status filter, search text and page number go to the server.
   Rows reload after an action elsewhere on the page (the app fires "cb:render"). Uses the same bar / footer classes as the old
   client-side tableTools, which skips any table marked data-server. */
export function usePaged(role, kind, { status, size = 10, extra, load } = {}) {
  const { user, ready } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const active = ready && !!user && user.role === role;
  const [page, setPage] = useState(1), [q, setQ] = useState(""), [limit, setLimit] = useState(size);
  const [dq, setDq] = useState(""), [tick, bump] = useReducer(x => x + 1, 0);
  const [st, setSt] = useState({ rows: [], total: 0, error: null, for: null });   // `for` = the request these rows answer
  const key = JSON.stringify([status, extra]);
  const seq = useRef(0);
  // a new filter or page size goes back to page 1 (set while rendering, React's pattern for state that follows props)
  const [shape, setShape] = useState(key + "|" + limit);
  if (shape !== key + "|" + limit) { setShape(key + "|" + limit); setPage(1); }
  const req = JSON.stringify([active, role, kind, page, limit, dq, key, tick]);
  const loading = st.for !== req;   // still waiting for this exact request (old rows stay visible meanwhile)

  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    if (!active) return;
    const again = () => bump(); window.addEventListener("cb:render", again); window.addEventListener("cb:poll", again);   // cb:poll = 30 s live refresh
    return () => { window.removeEventListener("cb:render", again); window.removeEventListener("cb:poll", again); };
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const n = ++seq.current;
    Promise.all([import("@/lib/connectbhai/api"), import("@/lib/connectbhai/paging")])
      .then(([a, p]) => (load ? load(a.API, { page, limit, status, q: dq, ...(extra || {}) }) : p.fetchPage(a.API, role, kind, { page, limit, status, q: dq, ...(extra || {}) })))
      .then(d => { if (n === seq.current) setSt({ rows: d.items, total: d.total, error: null, for: req }); })
      .catch(e => { if (n === seq.current) setSt(s => ({ ...s, error: (e && e.message) || "Could not load this list.", for: req })); });
  }, [active, role, kind, page, limit, dq, key, tick]);   // eslint-disable-line react-hooks/exhaustive-deps

  return { rows: st.rows, total: st.total, error: st.error, loading, page, setPage, q, setQ, dq, limit, setLimit, pages: Math.max(1, Math.ceil(st.total / limit)) };
}

export function PagedBar({ p, label = "Search this table" }) {
  return (
    <div className="tt-bar">
      <label className="tt-size">Rows <select aria-label="Rows per page" value={p.limit} onChange={e => p.setLimit(Number(e.target.value))}>{[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      <input type="search" className="tt-q" placeholder="Search name, phone, code…" aria-label={label} value={p.q} onChange={e => p.setQ(e.target.value)} />
    </div>
  );
}

export function PagedFoot({ p }) {
  const { page, pages, total, limit, dq, loading } = p, from = (page - 1) * limit + 1, to = Math.min(page * limit, total);
  const nums = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
  const out = []; let last = 0;
  for (const i of nums) { if (i - last > 1) out.push(<span key={"g" + i} className="tt-gap">…</span>); out.push(<button key={i} type="button" className={i === page ? "on" : ""} aria-current={i === page ? "page" : undefined} onClick={() => p.setPage(i)}>{i}</button>); last = i; }
  return (
    <div className="tt-foot" aria-busy={loading}>
      <span className="tt-count" aria-live="polite">{total ? `${from}–${to} of ${total}` : loading ? "Loading…" : dq ? `No rows match “${dq}”` : ""}</span>
      {total > 0 && <span className="tt-pager">{/* QA 14: always shown, ‹ 1 › on a single page */}
        <button type="button" disabled={page === 1} aria-label="Previous page" onClick={() => p.setPage(page - 1)}>‹</button>{out}
        <button type="button" disabled={page === pages} aria-label="Next page" onClick={() => p.setPage(page + 1)}>›</button>
      </span>}
    </div>
  );
}
