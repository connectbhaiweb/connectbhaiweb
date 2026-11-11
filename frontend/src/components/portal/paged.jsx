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
  const [st, setSt] = useState({ rows: [], total: 0, loading: true, error: null });
  const key = JSON.stringify([status, extra]);
  const seq = useRef(0);

  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [key, limit]);
  useEffect(() => {
    if (!active) return;
    const again = () => bump(); window.addEventListener("cb:render", again);
    return () => window.removeEventListener("cb:render", again);
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const n = ++seq.current;
    setSt(s => ({ ...s, loading: true }));
    Promise.all([import("@/lib/connectbhai/api"), import("@/lib/connectbhai/paging")])
      .then(([a, p]) => (load ? load(a.API, { page, limit, status, q: dq, ...(extra || {}) }) : p.fetchPage(a.API, role, kind, { page, limit, status, q: dq, ...(extra || {}) })))
      .then(d => { if (n === seq.current) setSt({ rows: d.items, total: d.total, loading: false, error: null }); })
      .catch(e => { if (n === seq.current) setSt(s => ({ ...s, loading: false, error: (e && e.message) || "Could not load this list." })); });
  }, [active, role, kind, page, limit, dq, key, tick]);   // eslint-disable-line react-hooks/exhaustive-deps

  return { ...st, page, setPage, q, setQ, dq, limit, setLimit, pages: Math.max(1, Math.ceil(st.total / limit)) };
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
      {pages > 1 && <span className="tt-pager">
        <button type="button" disabled={page === 1} aria-label="Previous page" onClick={() => p.setPage(page - 1)}>‹</button>{out}
        <button type="button" disabled={page === pages} aria-label="Next page" onClick={() => p.setPage(page + 1)}>›</button>
      </span>}
    </div>
  );
}
