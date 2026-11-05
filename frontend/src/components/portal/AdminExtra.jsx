"use client";
import { useState } from "react";
import Link from "next/link";
import { Receipt, User, Users } from "lucide-react";
import { useDashData } from "@/components/dashboard/useDashData";
import { Card, Chip, Failed, Loading, Pin, PortalHead } from "./parts";
import { fDate, inr, planName, sum } from "./stats";
import { GST_RATE, TDS_RATE } from "@/lib/connectbhai/rates";

const TARGET = 100;
const Progress = ({ n }) => (
  <span className="pt-prog"><span><b>{n}</b> / {TARGET}</span><i role="progressbar" aria-valuemin={0} aria-valuemax={TARGET} aria-valuenow={Math.min(n, TARGET)} aria-label={`${n} of ${TARGET} leads`}><em style={{ width: `${Math.min(100, n / TARGET * 100)}%` }} /></i></span>
);
export { Progress, TARGET };

async function loadPeople(API) {
  const [customers, partners, leads, bookings, charges, comms] = await Promise.all([API.adminCustomers(), API.adminPartners(), API.adminLeads(), API.adminBookings(), API.adminCharges(), API.adminCommissions()]);
  return { customers, partners, leads, bookings, charges, comms };
}

/* Admin → Customers: Customers / TIPs / DSA agents */
export function AdminCustomers({ tab }) {
  const { active, pending, data, error, loading, reload } = useDashData("admin", loadPeople);
  const [t, setT] = useState("customers");
  if (tab !== "customers" || (!active && !pending)) return null;
  if (pending || loading) return <div className="dsh-page"><Loading /></div>;
  if (error && !data) return <div className="dsh-page"><Failed error={error} retry={reload} /></div>;
  const { customers, partners, leads, bookings, charges, comms } = data;
  const tips = partners.filter(p => p.type === "tip"), dsas = partners.filter(p => p.type === "dsa");
  const T = [["customers", "Customers", customers.length], ["tip", "TIPs", tips.length], ["dsa", "DSA agents", dsas.length]];
  return (
    <div className="dsh-page"><div className="pt">
      <PortalHead title="Customers" sub="Everyone on Connect Bhai: customers, TIPs and DSA agents." />
      <div className="pt-filters" role="tablist" aria-label="Lists">{T.map(([k, l, n]) => <button key={k} type="button" role="tab" aria-selected={t === k} onClick={() => setT(k)}>{l}<span>{n}</span></button>)}</div>
      {t === "customers" && (
        <Card title={`Customers (${customers.length})`} Icon={User}>
          <div className="pt-table pt-t-pc" role="table" aria-label="Customers">
            <div className="pt-tr pt-th" role="row"><span role="columnheader">Customer</span><span role="columnheader">PIN / area</span><span role="columnheader">Latest plan</span><span role="columnheader">Requests</span><span role="columnheader">Status</span><span role="columnheader">Joined</span></div>
            {customers.map(c => { const ls = leads.filter(l => l.customer_id === c.id), l = ls[0]; return (
              <div className="pt-tr" role="row" key={c.id}>
                <span role="cell" className="pt-name"><span><b>{c.full_name}</b><small>{c.phone ? "+91 " + c.phone : c.email || ""}</small></span></span>
                <span role="cell">{l ? <Pin>{[l.pincode, l.area].filter(Boolean).join(", ")}</Pin> : "—"}</span>
                <span role="cell" className="pt-ell">{l ? planName(l.plan) : "—"}</span>
                <span role="cell">{ls.length}</span>
                <span role="cell">{l ? <Chip s={l.status} /> : <Chip label="No request" tone="grey" />}</span>
                <span role="cell">{fDate(c.created_at)}</span>
              </div>); })}
          </div>
        </Card>
      )}
      {t === "tip" && (
        <Card title={`TIPs (${tips.length})`} Icon={Users}>
          <div className="pt-table pt-t-pt" role="table" aria-label="TIPs">
            <div className="pt-tr pt-th" role="row"><span role="columnheader">DSA / TIP</span><span role="columnheader">Status</span><span role="columnheader">Leads given</span><span role="columnheader">Installed</span><span role="columnheader">Amount paid</span><span role="columnheader">Receipts</span></div>
            {tips.map(p => { const paid = charges.filter(c => c.partner_id === p.id && c.status === "paid"); return (
              <div className="pt-tr" role="row" key={p.id}>
                <span role="cell" className="pt-name"><span><b>{p.firm || p.name}</b><small>{p.name} · {p.service_pincodes || "—"}</small></span></span>
                <span role="cell"><Chip s={p.status === "active" ? "live" : p.status} label={p.status[0].toUpperCase() + p.status.slice(1)} tone={p.status === "active" ? "green" : p.status === "pending" ? "amber" : "red"} /></span>
                <span role="cell"><Progress n={leads.filter(l => l.assigned_tip_id === p.id).length} /></span>
                <span role="cell">{bookings.filter(b => b.tip_partner_id === p.id && b.status === "installed").length}</span>
                <span role="cell"><b>{inr(sum(paid, c => c.amount))}</b></span>
                <span role="cell" className="pt-acts">{paid.length}<Link className="pt-more" href="/admin/billing"><Receipt aria-hidden="true" />View</Link></span>
              </div>); })}
          </div>
        </Card>
      )}
      {t === "dsa" && (
        <Card title={`DSA agents (${dsas.length})`} Icon={Users}>
          <div className="pt-table pt-t-pt" role="table" aria-label="DSA agents">
            <div className="pt-tr pt-th" role="row"><span role="columnheader">Agent</span><span role="columnheader">Status</span><span role="columnheader">Leads</span><span role="columnheader">Installed</span><span role="columnheader">Commission paid</span><span role="columnheader">Payouts</span></div>
            {dsas.map(p => { const cm = comms.filter(c => c.partner_id === p.id && c.status !== "rejected"); return (
              <div className="pt-tr" role="row" key={p.id}>
                <span role="cell" className="pt-name"><span><b>{p.name}</b><small>{p.firm || "—"} · {p.service_pincodes || "—"}</small></span></span>
                <span role="cell"><Chip label={p.status[0].toUpperCase() + p.status.slice(1)} tone={p.status === "active" ? "green" : p.status === "pending" ? "amber" : "red"} /></span>
                <span role="cell">{leads.filter(l => l.assigned_dsa_id === p.id).length}</span>
                <span role="cell">{bookings.filter(b => b.dsa_partner_id === p.id && b.status === "installed").length}</span>
                <span role="cell"><b>{inr(sum(cm.filter(c => c.status === "paid"), c => c.amount))}</b></span>
                <span role="cell" className="pt-acts">{cm.length}<Link className="pt-more" href="/admin/payments"><Receipt aria-hidden="true" />View</Link></span>
              </div>); })}
          </div>
        </Card>
      )}
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
async function loadMoney(API) { const [charges, comms] = await Promise.all([API.adminCharges(), API.adminCommissions()]); return { charges, comms }; }

/* Admin → Billing & fees: GST / TDS breakdown under the existing billing page */
export function BillingBreakdown({ tab }) {
  const { active, data, error, reload } = useDashData("admin", loadMoney);
  if (tab !== "billing" || !active) return null;
  return (
    <div className="dsh-page dsh-addon"><div className="pt pt-addon">
      {error && !data ? <Failed error={error} retry={reload} /> : !data ? <Loading /> : (
        <div className="pt-row pt-row-2">
          <Breakdown title="TIP fees: GST / TDS" sub="Registration and platform fees charged to TIPs (excluding waived/cancelled)."
            base={sum(data.charges.filter(c => c.partner_id && !["waived", "cancelled"].includes(c.status)), c => c.base_amount)} />
          <Breakdown title="DSA payouts: GST / TDS" sub="Commission owed to DSA agents (excluding rejected)."
            base={sum(data.comms.filter(c => c.status !== "rejected"), c => c.amount)} />
        </div>
      )}
      <p className="pt-muted pt-small">GST {Math.round(GST_RATE * 100)}% and TDS {Math.round(TDS_RATE * 100)}% are placeholder rates (src/lib/connectbhai/rates.js).</p>
    </div></div>
  );
}
