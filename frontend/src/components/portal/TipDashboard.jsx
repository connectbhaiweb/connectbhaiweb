"use client";
import { useState } from "react";
import { CalendarDays, ChartColumn, CircleCheck, Clock, CloudUpload, Coins, Database, Download, Loader, Ticket, Users, Wallet, Wifi } from "lucide-react";
import { useDashData } from "@/components/dashboard/useDashData";
import { Bars, CallWa, Card, Chip, Counts, Failed, Kpi, Loading, More, Period, Pin, PortalHead } from "./parts";
import { CarePlanCard } from "@/components/careplan/CarePlan";
import { Progress, TARGET } from "./AdminExtra";
import { fDate, fWhen, inr, mLabel, planName, planPrice } from "./stats";
import { PagedBar, PagedFoot, usePaged } from "./paged";
import { dashboard, fetchPage } from "@/lib/connectbhai/paging";

const day = off => { const d = new Date(); d.setHours(0, 0, 0, 0); return new Date(+d + off * 864e5).toISOString().slice(0, 10); };
async function load(API) {   // KPIs and charts come from the server's aggregates; only this week's installs and three open tickets are fetched as rows
  const [stats, partner, plans, settings, threads, week, tix] = await Promise.all([dashboard(API, "tip", { months: 12 }), API.myPartner(),
    API.tipPlans().catch(() => ({ live: [], mine: [] })), API.getSettings(), API.myThreads().catch(() => []),
    fetchPage(API, "tip", "bookings", { from: day(-3), to: day(8), limit: 5 }), fetchPage(API, "tip", "tickets", { status: "open_all", limit: 3 })]);
  return { stats, partner, plans, settings, threads, week: week.items, openTickets: tix.items };
}
const OWN = t => !t || ["home", "leads"].includes(t);
const BOOK_ICON = { scheduled: CalendarDays, in_progress: Loader, installed: CircleCheck };

export default function TipDashboard({ tab }) {
  const { active, pending, data, error, loading, reload } = useDashData("tip", load, OWN(tab));
  const [months, setMonths] = useState(6);
  if (!OWN(tab) || (!active && !pending)) return null;
  if (pending || loading) return <div className="dsh-page"><Loading /></div>;
  if (error && !data) return <div className="dsh-page"><Failed error={error} retry={reload} /></div>;
  const { stats, partner, threads } = data, L = stats.leads, closed = L.installed + L.lost, cc = stats.charges_count || {};
  const s = { total: stats.leads_total, givenMonth: stats.leads_month, inst: stats.installs_total, instMonth: stats.installs_month, conv: closed ? Math.round(L.installed / closed * 100) : 0, billing: stats.installs_billing,
    paid: { total: (stats.charges || {}).paid || 0, count: cc.paid || 0, last: stats.last_paid_at } };
  const counts = { leads: L.contacted + L.follow_up + (L.assigned || 0), tickets: stats.open_tickets, chat: threads.reduce((a, t) => a + (t.unread || 0), 0), bookings: stats.installs_pending, payments: (cc.pending || 0) + (cc.due || 0) + (cc.failed || 0) };
  return (
    <div className="dsh-page"><div className="pt">
      <Counts c={counts} />
      {(tab || "home") === "home" ? <Home {...{ data, s, months, setMonths }} /> : <Leads stats={stats} partner={partner} />}
    </div></div>
  );
}

function Home({ data, s, months, setMonths }) {
  const { stats, partner, plans, settings, week, openTickets: openT } = data;
  const share = Number(settings.tip_share_percent) || 0;
  const chart = stats.by_month.slice(-months).map(m => ({ label: mLabel(m.month), leads: m.leads, installs: m.installs }));
  const ups = [...plans.mine].slice(0, 3);
  return (
    <>
      <PortalHead title="TIP portal" sub="Manage installations, update plans and track your performance with Connect Bhai." pins={partner.service_pincodes} />
      <div className="pt-kpis">
        <Kpi tone="blue" Icon={Users} label="Leads from Connect Bhai" value={s.total} sub={`${s.givenMonth} this month`} up />
        <Kpi tone="green" Icon={CircleCheck} label="Customers installed" value={s.inst} sub={`${s.instMonth} this month · ${s.conv}% conversion`} up />
        <Kpi tone="amber" Icon={Coins} label="Monthly billing added" value={inr(s.billing)} sub={`${inr(s.billing * 12)} a year`} />
        <Kpi tone="purple" Icon={Wallet} label="Your est. monthly income" value={share ? inr(s.billing * share / 100) : "—"} sub={share ? `${share}% share` : "Share % to be set by admin"} />
      </div>
      <div className="pt-row pt-row-tip1">
        <Card title="Leads delivered and installed" Icon={ChartColumn} className="pt-chartcard" action={<Period value={months} onChange={setMonths} />}>
          <Bars data={chart} series={[{ key: "leads", name: "Leads", color: "#2878FD" }, { key: "installs", name: "Installed", color: "#32B661" }]} />
        </Card>
        <Card title="Plan update sheet" Icon={Database} action={<button type="button" className="pt-more" data-act="plan-template"><Download aria-hidden="true" />Download template</button>}>
          <div className="pt-sheet">
            <button type="button" className="pt-drop" data-act="plan-import" data-mode="tip">
              <CloudUpload aria-hidden="true" /><b>Upload plan sheet</b><span>Drag &amp; drop or click to upload<br />.xlsx / .csv (max 5 MB)</span><span className="cu-btn cu-btn-primary">Upload .xlsx / .csv</span>
            </button>
            <div className="pt-uploads">
              <h3>Recent uploads</h3>
              {ups.length ? (
                <div className="pt-table pt-t-up" role="table" aria-label="Recent uploads">
                  <div className="pt-tr pt-th" role="row"><span role="columnheader">Plan</span><span role="columnheader">Uploaded on</span><span role="columnheader">Price</span><span role="columnheader">Status</span></div>
                  {ups.map(p => <div className="pt-tr" role="row" key={p.id}><span role="cell" className="pt-ell">{p.name}</span><span role="cell">{fWhen(p.created_at, true)}</span><span role="cell">{inr(p.price_monthly)}</span><span role="cell"><Chip s={p.status === "live" ? "live" : p.status === "rejected" ? "rejected" : "pending_review"} Icon={p.status === "live" ? CircleCheck : Clock} /></span></div>)}
                </div>
              ) : <p className="pt-muted">No uploads yet. Your {plans.live.length} live plans are listed under Plans.</p>}
            </div>
          </div>
        </Card>
      </div>
      <div className="pt-row pt-row-tip2">
        <Card title="Installations this week" Icon={CalendarDays} action={<More href="/tip/bookings">View all installs</More>}>
          {week.length ? (
            <div className="pt-table pt-t-inst" role="table" aria-label="Installations this week">
              <div className="pt-tr pt-th" role="row"><span role="columnheader">Date &amp; Time</span><span role="columnheader">Customer</span><span role="columnheader">Address / Area</span><span role="columnheader">Plan</span><span role="columnheader">Status</span></div>
              {week.map(b => { const I = BOOK_ICON[b.status] || CalendarDays; return (
                <div className="pt-tr" role="row" key={b.id}>
                  <span role="cell" className="pt-when"><CalendarDays aria-hidden="true" />{fWhen(b.scheduled_date)}</span>
                  <span role="cell"><b>{b.lead ? b.lead.name : "—"}</b></span>
                  <span role="cell"><Pin>{b.lead ? [b.lead.area, b.lead.pincode].filter(Boolean).join(", ") : "—"}</Pin></span>
                  <span role="cell" className="pt-ell">{planName(b.plan)}</span>
                  <span role="cell"><button type="button" className="pt-chipbtn" data-act="booking-status" data-id={b.id} aria-label={`Update installation ${b.ref_code}`}><Chip s={b.status} Icon={I} /></button></span>
                </div>); })}
            </div>
          ) : <p className="pt-muted">No installations scheduled this week.</p>}
        </Card>
        <Card title={`Open tickets (${stats.open_tickets})`} Icon={Ticket} action={<More href="/tip/tickets">View all tickets</More>}>
          {openT.length ? (
            <ul className="pt-tickets">
              {openT.slice(0, 3).map(t => (
                <li key={t.id}><button type="button" data-act="ticket-status" data-id={t.id} data-s="in_progress">
                  <span className="pt-tk-ico"><Wifi aria-hidden="true" /></span>
                  <span className="pt-tk-txt"><b>{t.ref_code} · {t.category}</b><small>{t.booking && t.booking.lead ? `${t.booking.lead.name} · ${[t.booking.lead.pincode, t.booking.lead.area].filter(Boolean).join(", ")}` : t.description}</small></span>
                  <span className="pt-tk-meta"><Chip s={t.status} label={t.status === "in_progress" ? "In progress" : "Open"} tone={t.status === "in_progress" ? "amber" : "red"} /><small><Clock aria-hidden="true" />{fWhen(t.created_at, true)}</small></span>
                </button></li>
              ))}
            </ul>
          ) : <p className="pt-muted">No open tickets.</p>}
        </Card>
      </div>
      <div className="pt-row pt-row-3">
        <Card title="Leads given" Icon={Users}>
          <p className="pt-big"><b>{s.total}</b> of {TARGET}</p>
          <Progress n={s.total} />
          <p className="pt-muted">All-time leads Connect Bhai has given you. Target: {TARGET}.</p>
        </Card>
        <Card title="Amount paid to Connect Bhai" Icon={Wallet} action={<More href="/tip/payments">View</More>}>
          <p className="pt-big"><b>{inr(s.paid.total)}</b></p>
          <p className="pt-muted">{s.paid.count} paid fee{s.paid.count === 1 ? "" : "s"} (incl. GST){s.paid.last ? ` · last on ${fDate(s.paid.last)}` : ""}</p>
        </Card>
        <CarePlanCard role="tip" />
      </div>
    </>
  );
}

function Leads({ stats, partner }) {
  const [f, setF] = useState("open");
  const L = stats.leads, open = L.new + L.contacted + L.follow_up + L.booked;
  const F = [["open", "Open", open], ["assigned", "New to call", L.assigned || 0], ["contacted", "Contacted", L.contacted], ["follow_up", "Follow-up", L.follow_up], ["booked", "Booked", L.booked], ["installed", "Installed", L.installed], ["lost", "Lost", L.lost], ["all", "All", stats.leads_total]];
  const p = usePaged("tip", "leads", { status: f });
  return (
    <>
      <PortalHead title="Leads" sub="Requests from your PIN codes. Call, schedule the installation and keep the status updated." pins={partner.service_pincodes} />
      <div className="pt-filters" role="group" aria-label="Filter leads">{F.map(([k, l, n]) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}<span>{n}</span></button>)}</div>
      <Card title={`${F.find(x => x[0] === f)[1]} leads (${p.total})`} Icon={Users}>
        <PagedBar p={p} label="Search leads" />
        <div className="pt-table pt-t-leads" role="table" aria-label="Leads" data-server>
          <div className="pt-tr pt-th" role="row"><span role="columnheader">Customer</span><span role="columnheader">PIN / area</span><span role="columnheader">Plan</span><span role="columnheader">Status</span><span role="columnheader">Requested</span><span role="columnheader">Actions</span></div>
          {p.rows.map(l => (
            <div className="pt-tr" role="row" key={l.id}>
              <span role="cell" className="pt-name"><span><b>{l.name}</b><small>{l.ref_code}{l.dsa ? ` · DSA ${l.dsa.name}` : ""}</small></span></span>
              <span role="cell"><Pin>{[l.pincode, l.area].filter(Boolean).join(", ")}</Pin></span>
              <span role="cell" className="pt-plan"><b>{planName(l.plan)}</b><small>{planPrice(l.plan)}</small></span>
              <span role="cell"><Chip s={l.status} /></span>
              <span role="cell">{fDate(l.created_at)}</span>
              <span role="cell" className="pt-acts">
                <CallWa phone={l.phone} name={l.name} text={`Namaste ${l.name}, this is about your Connect Bhai request ${l.ref_code}`} />
                <button type="button" className="cu-btn cu-btn-soft pt-sm" data-act="lead" data-id={l.id}>Update</button>
                {["assigned", "contacted", "follow_up"].includes(l.status) && <button type="button" className="cu-btn cu-btn-primary pt-sm" data-act="book" data-id={l.id}>Schedule</button>}
              </span>
            </div>
          ))}
        </div>
        {p.loading ? <p className="pt-muted">Loading…</p> : !p.rows.length && <p className="pt-muted">{p.dq ? `No leads match “${p.dq}”.` : "No leads in this list."}</p>}
        <PagedFoot p={p} />
      </Card>
    </>
  );
}
