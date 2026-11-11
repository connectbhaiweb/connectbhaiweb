"use client";
import { useState } from "react";
import Link from "next/link";
import { Receipt, User, Users } from "lucide-react";
import { useDashData } from "@/components/dashboard/useDashData";
import { Card, Chip, Failed, Loading, Pin, PortalHead } from "./parts";
import { fDate, inr, planName } from "./stats";
import { PagedBar, PagedFoot, usePaged } from "./paged";
import { customerSummaries, dashboard, fetchPage, partnerTotals } from "@/lib/connectbhai/paging";
import { GST_RATE, TDS_RATE } from "@/lib/connectbhai/rates";

const TARGET = 100;
const Progress = ({ n }) => (
  <span className="pt-prog"><span><b>{n}</b> / {TARGET}</span><i role="progressbar" aria-valuemin={0} aria-valuemax={TARGET} aria-valuenow={Math.min(n, TARGET)} aria-label={`${n} of ${TARGET} leads`}><em style={{ width: `${Math.min(100, n / TARGET * 100)}%` }} /></i></span>
);
export { Progress, TARGET };

async function loadPeople(API) {   // only the three list sizes and the per-partner totals, never the lists themselves
  const [c, t, d, totals] = await Promise.all([fetchPage(API, "admin", "customers", { limit: 1 }), fetchPage(API, "admin", "partners", { type: "tip", limit: 1 }), fetchPage(API, "admin", "partners", { type: "dsa", limit: 1 }), partnerTotals(API)]);
  return { n: { customers: c.total, tip: t.total, dsa: d.total }, totals };
}
const withSummaries = async (API, f) => {
  const r = await fetchPage(API, "admin", "customers", f), sums = await customerSummaries(API, r.items.map(x => x.id));
  return { ...r, items: r.items.map(c => ({ ...c, s: sums[c.id] })) };
};
const Empty = ({ p, what }) => (p.loading ? <p className="pt-muted">Loading…</p> : p.error ? <p className="pt-muted" role="alert">{p.error}</p> : !p.rows.length ? <p className="pt-muted">{p.dq ? `No ${what} match “${p.dq}”.` : `No ${what} yet.`}</p> : null);

function CustomersTable() {
  const p = usePaged("admin", "customers", { load: withSummaries });
  return (
    <Card title={`Customers (${p.total})`} Icon={User}>
      <PagedBar p={p} label="Search customers" />
      <div className="pt-table pt-t-pc" role="table" aria-label="Customers" data-server>
        <div className="pt-tr pt-th" role="row"><span role="columnheader">Customer</span><span role="columnheader">PIN / area</span><span role="columnheader">Latest plan</span><span role="columnheader">Requests</span><span role="columnheader">Status</span><span role="columnheader">Joined</span></div>
        {p.rows.map(c => { const l = c.s && c.s.latest; return (
          <div className="pt-tr" role="row" key={c.id}>
            <span role="cell" className="pt-name"><span><b>{c.full_name}</b><small>{c.phone ? "+91 " + c.phone : c.email || ""}</small></span></span>
            <span role="cell">{l ? <Pin>{[l.pincode, l.area].filter(Boolean).join(", ")}</Pin> : "—"}</span>
            <span role="cell" className="pt-ell">{l ? planName(l.plan) : "—"}</span>
            <span role="cell">{c.s ? c.s.requests : 0}</span>
            <span role="cell">{l ? <Chip s={l.status} /> : <Chip label="No request" tone="grey" />}</span>
            <span role="cell">{fDate(c.created_at)}</span>
          </div>); })}
      </div>
      <Empty p={p} what="customers" /><PagedFoot p={p} />
    </Card>
  );
}
function PartnersTable({ type, totals }) {
  const p = usePaged("admin", "partners", { extra: { type } }), isT = type === "tip", T = (totals && totals[type]) || {};
  return (
    <Card title={`${isT ? "TIPs" : "DSA agents"} (${p.total})`} Icon={Users}>
      <PagedBar p={p} label={isT ? "Search TIPs" : "Search DSA agents"} />
      <div className="pt-table pt-t-pt" role="table" aria-label={isT ? "TIPs" : "DSA agents"} data-server>
        <div className="pt-tr pt-th" role="row"><span role="columnheader">{isT ? "DSA / TIP" : "Agent"}</span><span role="columnheader">Status</span><span role="columnheader">Leads{isT ? " given" : ""}</span><span role="columnheader">Installed</span><span role="columnheader">{isT ? "Amount paid" : "Commission paid"}</span><span role="columnheader">{isT ? "Receipts" : "Payouts"}</span></div>
        {p.rows.map(x => { const t = T[x.id] || {}; return (
          <div className="pt-tr" role="row" key={x.id}>
            <span role="cell" className="pt-name"><span><b>{isT ? x.firm || x.name : x.name}</b><small>{isT ? x.name : x.firm || "—"} · {x.service_pincodes || "—"}</small></span></span>
            <span role="cell"><Chip s={isT && x.status === "active" ? "live" : x.status} label={x.status[0].toUpperCase() + x.status.slice(1)} tone={x.status === "active" ? "green" : x.status === "pending" ? "amber" : "red"} /></span>
            <span role="cell">{isT ? <Progress n={t.leads || 0} /> : t.leads || 0}</span>
            <span role="cell">{t.installs || 0}</span>
            <span role="cell"><b>{inr(isT ? t.paid_amount : t.comm_paid)}</b></span>
            <span role="cell" className="pt-acts">{isT ? t.paid_count || 0 : t.comm_count || 0}<Link className="pt-more" href={isT ? "/admin/billing" : "/admin/payments"}><Receipt aria-hidden="true" />View</Link></span>
          </div>); })}
      </div>
      <Empty p={p} what={isT ? "TIPs" : "DSA agents"} /><PagedFoot p={p} />
    </Card>
  );
}

/* Admin → Customers: Customers / TIPs / DSA agents (each list is fetched a page at a time, searched by the server) */
export function AdminCustomers({ tab }) {
  const { active, pending, data, error, loading, reload } = useDashData("admin", loadPeople, tab === "customers");
  const [t, setT] = useState("customers");
  if (tab !== "customers" || (!active && !pending)) return null;
  if (pending || loading) return <div className="dsh-page"><Loading /></div>;
  if (error && !data) return <div className="dsh-page"><Failed error={error} retry={reload} /></div>;
  const T = [["customers", "Customers", data.n.customers], ["tip", "TIPs", data.n.tip], ["dsa", "DSA agents", data.n.dsa]];
  return (
    <div className="dsh-page"><div className="pt">
      <PortalHead title="Customers" sub="Everyone on Connect Bhai: customers, TIPs and DSA agents." />
      <div className="pt-filters" role="tablist" aria-label="Lists">{T.map(([k, l, n]) => <button key={k} type="button" role="tab" aria-selected={t === k} onClick={() => setT(k)}>{l}<span>{n}</span></button>)}</div>
      {t === "customers" && <CustomersTable />}
      {t === "tip" && <PartnersTable type="tip" totals={data.totals} />}
      {t === "dsa" && <PartnersTable type="dsa" totals={data.totals} />}
    </div></div>
  );
}

const Row = ({ k, v, neg, strong }) => <div className={strong ? "is-total" : ""}><dt>{k}</dt><dd>{neg ? "− " : ""}{inr(v)}</dd></div>;
function Breakdown({ title, sub, base }) {
  const gst = base * GST_RATE, tds = base * TDS_RATE;
  return (
    <Card title={title} Icon={Receipt}>
      <p className="pt-muted">{sub}</p>
      <dl className="pt-bd">
        <Row k="Subtotal" v={base} /><Row k={`GST (${Math.round(GST_RATE * 100)}%)`} v={gst} /><Row k={`TDS (${Math.round(TDS_RATE * 100)}%)`} v={tds} neg /><Row k="Net payable" v={base + gst - tds} strong />
      </dl>
    </Card>
  );
}
async function loadMoney(API) { const d = await dashboard(API, "admin", { months: 1 }); return { tipBase: d.tip_fee_base, dsaBase: (d.commission.pending || 0) + (d.commission.approved || 0) + (d.commission.paid || 0) }; }

/* Admin → Billing & fees: GST / TDS breakdown under the existing billing page */
export function BillingBreakdown({ tab }) {
  const { active, data, error, reload } = useDashData("admin", loadMoney, tab === "billing");
  if (tab !== "billing" || !active) return null;
  return (
    <div className="dsh-page dsh-addon"><div className="pt pt-addon">
      {error && !data ? <Failed error={error} retry={reload} /> : !data ? <Loading /> : (
        <div className="pt-row pt-row-2">
          <Breakdown title="TIP fees: GST / TDS" sub="Registration and platform fees charged to TIPs (excluding waived/cancelled)."
            base={data.tipBase} />
          <Breakdown title="DSA payouts: GST / TDS" sub="Commission owed to DSA agents (excluding rejected)."
            base={data.dsaBase} />
        </div>
      )}
      <p className="pt-muted pt-small">GST {Math.round(GST_RATE * 100)}% and TDS {Math.round(TDS_RATE * 100)}% are placeholder rates (src/lib/connectbhai/rates.js).</p>
    </div></div>
  );
}
