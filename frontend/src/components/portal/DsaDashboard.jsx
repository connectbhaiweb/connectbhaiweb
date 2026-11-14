"use client";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarDays, ChevronRight, CircleCheck, CircleX, Clock, Coins, Database, Filter, MessageCircle, Phone, ThumbsUp, Ticket, UserPlus, Users, User, Wallet, CircleCheckBig } from "lucide-react";
import { useDashData } from "@/components/dashboard/useDashData";
import { Ava, CallWa, Card, Chip, Counts, Failed, Kpi, Loading, More, Pin, PortalHead } from "./parts";
import { CarePlanCard } from "@/components/careplan/CarePlan";
import { fDate, fWhen, inr, planName, planPrice } from "./stats";
import { PagedBar, PagedFoot, usePaged } from "./paged";
import { dashboard, fetchPage } from "@/lib/connectbhai/paging";

async function load(API) {   // numbers from the server's aggregates; only the five "to call" leads and the latest payouts are fetched as rows
  const [stats, partner, threads, today, recent] = await Promise.all([dashboard(API, "dsa", { months: 1 }), API.myPartner(), API.myThreads().catch(() => []),
    fetchPage(API, "dsa", "leads", { status: "open", sort: "followup", limit: 5 }), fetchPage(API, "dsa", "commissions", { limit: 20 })]);
  return { stats, partner, threads, today: today.items, recent: recent.items };
}
const OWN = t => !t || ["home", "customers", "tickets"].includes(t);
const PIPE = [["new", "New", UserPlus, "blue"], ["assigned", "Assigned", User, "blue"], ["contacted", "Contacted", Phone, "amber"], ["follow_up", "Follow-up", CalendarDays, "amber"], ["booked", "Booked", CalendarDays, "blue"], ["installed", "Installed", CircleCheckBig, "green"], ["lost", "Lost", CircleX, "red"]];

export default function DsaDashboard({ tab }) {
  const { active, pending, data, error, loading, reload } = useDashData("dsa", load, OWN(tab));
  const view = tab || "home";
  if (!OWN(tab) || (!active && !pending)) return null;
  if (pending || loading) return <div className="dsh-page"><Loading /></div>;
  if (error && !data) return <div className="dsh-page"><Failed error={error} retry={reload} /></div>;
  const { stats, partner, threads } = data, L = stats.leads, C = stats.commission, closed = L.installed + L.lost;
  const s = { given: stats.leads_given, givenMonth: stats.leads_given_month, inst: stats.installs_total, instMonth: stats.installs_month, conv: closed ? Math.round(L.installed / closed * 100) : 0,
    comm: { all: C.pending + C.approved + C.paid, pending: C.pending, approved: C.approved, paid: C.paid } };
  const counts = { leads: L.new + (L.assigned || 0), chat: threads.reduce((a, t) => a + (t.unread || 0), 0), commission: stats.commission_count, payments: 0 };

  return (
    <div className="dsh-page"><div className="pt">
      <Counts c={counts} />
      {view === "home" && <Home {...{ data, s, partner }} />}
      {view === "customers" && <Customers n={L.installed} partner={partner} />}
      {view === "tickets" && <Tickets threads={threads} />}
    </div></div>
  );
}

function Home({ data, s, partner }) {
  const { stats, today, recent: comms } = data;
  const groups = Object.values(comms.reduce((g, c) => { const k = c.status + (c.payment_id || c.created_at.slice(0, 10)); (g[k] = g[k] || { date: c.created_at, n: 0, amt: 0, status: c.status }).n++; g[k].amt += Number(c.amount); if (c.created_at > g[k].date) g[k].date = c.created_at; return g; }, {}))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  return (
    <>
      <PortalHead title="Agent portal" sub="Manage your leads, installations and earnings from Connect Bhai." pins={partner.service_pincodes} />
      <div className="pt-kpis">
        <Kpi tone="blue" Icon={Users} label="Your leads" value={s.given.length} sub={`${s.givenMonth} this month`} up />
        <Kpi tone="green" Icon={CircleCheck} label="Installed" value={s.inst.length} sub={`${s.instMonth} this month · ${s.conv}% conversion`} up />
        <Kpi tone="amber" Icon={Coins} label="Total earned" value={inr(s.comm.all)} sub={`${inr(partner.commission_per_install)} per installation`} />
        <Kpi tone="purple" Icon={Wallet} label="Paid to you" value={inr(s.comm.paid)} sub={`${inr(s.comm.approved)} approved · ${inr(s.comm.pending)} awaiting`} />
      </div>
      <Card title="Lead pipeline" Icon={Filter} className="pt-pipecard" action={<More href="/dsa/leads">All leads ({stats.leads_total})</More>}>
        <ol className="pt-pipe">
          {PIPE.map(([k, l, I, tone]) => <li key={k} className={`tone-${tone}`}><Link href="/dsa/leads"><I aria-hidden="true" /><span>{l}</span><b>{stats.leads[k] || 0}</b></Link></li>)}
        </ol>
      </Card>
      <div className="pt-row pt-row-dsa2">
        <Card title="Leads to call today" Icon={Phone} action={<More href="/dsa/leads">View all leads</More>}>
          {today.length ? (
            <div className="pt-table pt-t-calls" role="table" aria-label="Leads to call today">
              <div className="pt-tr pt-th" role="row"><span role="columnheader">Name</span><span role="columnheader">PIN</span><span role="columnheader">Plan</span><span role="columnheader">Status</span><span role="columnheader">Next follow-up</span><span role="columnheader" className="pt-sr">Contact</span></div>
              {today.map(l => (
                <div className="pt-tr" role="row" key={l.id}>
                  <span role="cell" className="pt-name"><Ava name={l.name} /><b>{l.name}</b></span>
                  <span role="cell"><Pin>{l.pincode}</Pin></span>
                  <span role="cell" className="pt-plan"><b>{planName(l.plan)}</b><small>{planPrice(l.plan)}</small></span>
                  <span role="cell"><Chip s={l.status} Icon={l.status === "new" ? UserPlus : l.status === "follow_up" ? CalendarDays : l.status === "assigned" ? User : Phone} /></span>
                  <span role="cell" className="pt-when"><CalendarDays aria-hidden="true" />{l.next_follow_up ? fWhen(l.next_follow_up, true) : "Call now"}</span>
                  <span role="cell"><CallWa phone={l.phone} name={l.name} text={`Namaste ${l.name}, this is about your Connect Bhai request ${l.ref_code}`} /></span>
                </div>
              ))}
            </div>
          ) : <p className="pt-muted">No open leads. New leads from your PIN codes appear here.</p>}
        </Card>
        <div className="pt-stack"><Card title="My commission" Icon={Database} className="pt-comm">
          <div className="pt-tiles">
            <div className="tone-amber"><span><Clock aria-hidden="true" />Pending</span><b>{inr(s.comm.pending)}</b></div>
            <div className="tone-blue"><span><BadgeCheck aria-hidden="true" />Approved</span><b>{inr(s.comm.approved)}</b></div>
            <div className="tone-green"><span><ThumbsUp aria-hidden="true" />Paid</span><b>{inr(s.comm.paid)}</b></div>
          </div>
          <div className="pt-subhead"><h3>Recent payout history</h3><More href="/dsa/commission">View all</More></div>
          {groups.length ? (
            <div className="pt-table pt-t-pay" role="table" aria-label="Recent payout history">
              <div className="pt-tr pt-th" role="row"><span role="columnheader">Date</span><span role="columnheader">Installations</span><span role="columnheader">Amount</span><span role="columnheader">Status</span></div>
              {groups.map((g, i) => <div className="pt-tr" role="row" key={i}><span role="cell">{fDate(g.date)}</span><span role="cell">{g.n}</span><span role="cell"><b>{inr(g.amt)}</b></span><span role="cell"><Chip s={g.status} Icon={g.status === "pending" ? Clock : CircleCheck} /></span></div>)}
            </div>
          ) : <p className="pt-muted">Commissions appear after your first installation.</p>}
        </Card>
        <CarePlanCard role="dsa" /></div>
      </div>
    </>
  );
}

function Customers({ n, partner }) {
  const p = usePaged("dsa", "leads", { status: "installed", load: loadCustomers });
  return (
    <>
      <PortalHead title="My customers" sub="Everyone you brought to Connect Bhai who is now connected." pins={partner.service_pincodes} />
      <Card title={`Installed customers (${p.dq ? p.total : n})`} Icon={User}>
        <PagedBar p={p} label="Search customers" />
        <div className="pt-table pt-t-cust" role="table" aria-label="My customers" data-server>
          <div className="pt-tr pt-th" role="row"><span role="columnheader">Customer</span><span role="columnheader">PIN / area</span><span role="columnheader">Plan</span><span role="columnheader">Installed</span><span role="columnheader">Commission</span><span role="columnheader" className="pt-sr">Contact</span></div>
          {p.rows.map(l => { const c = l.comm; return (
            <div className="pt-tr" role="row" key={l.id}>
              <span role="cell" className="pt-name"><Ava name={l.name} /><span><b>{l.name}</b><small>{l.ref_code}</small></span></span>
              <span role="cell"><Pin>{[l.pincode, l.area].filter(Boolean).join(", ")}</Pin></span>
              <span role="cell" className="pt-plan"><b>{planName(l.plan)}</b><small>{planPrice(l.plan)}</small></span>
              <span role="cell">{fDate(l.booking && l.booking.installed_at)}</span>
              <span role="cell">{c ? <Chip s={c.status} label={`${inr(c.amount)} · ${(c.status[0].toUpperCase() + c.status.slice(1))}`} tone={{ paid: "green", approved: "blue", pending: "amber", rejected: "red" }[c.status]} /> : "—"}</span>
              <span role="cell"><CallWa phone={l.phone} name={l.name} text={`Namaste ${l.name}, this is your Connect Bhai agent.`} /></span>
            </div>); })}
        </div>
        {p.loading ? <p className="pt-muted">Loading…</p> : !p.rows.length && <p className="pt-muted">{p.dq ? `No customers match “${p.dq}”.` : "No installed customers yet. They appear here once the installer completes the installation."}</p>}
        <PagedFoot p={p} />
      </Card>
    </>
  );
}
/* one page of installed leads + the commissions of just those leads */
async function loadCustomers(API, f) {
  const r = await fetchPage(API, "dsa", "leads", f);
  const cm = r.items.length ? (await fetchPage(API, "dsa", "commissions", { limit: 100, lead_ids: r.items.map(l => l.id).join(",") })).items : [];
  return { ...r, items: r.items.map(l => ({ ...l, comm: cm.find(c => c.lead_id === l.id || (l.booking && c.booking_id === String(l.booking.id))) })) };
}

function Tickets({ threads }) {
  const list = threads.filter(t => t.last);
  return (
    <>
      <PortalHead title="Tickets" sub="Messages and issues from your customers, the installer and Connect Bhai. Complaints are fixed by the installer; you see every update here." />
      <Card title={`Conversations (${list.length})`} Icon={Ticket}>
        {list.length ? (
          <ul className="pt-threads">
            {list.map(t => (
              <li key={t.id}>
                <button type="button" data-act="chat" data-thread={t.id}>
                  <span className="pt-thread-ico"><MessageCircle aria-hidden="true" /></span>
                  <span className="pt-thread-txt"><b>{t.title}</b><small>{t.last.sender_name ? t.last.sender_name + ": " : ""}{t.last.body}</small></span>
                  <span className="pt-thread-meta">{t.unread ? <Chip label={`${t.unread} new`} tone="red" /> : null}<small>{fWhen(t.last.created_at, true)}</small></span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="pt-muted">No messages yet.</p>}
      </Card>
    </>
  );
}

