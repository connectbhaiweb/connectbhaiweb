"use client";
import { useMemo, useState } from "react";
import { CalendarDays, ChartColumn, CircleCheck, Clock, CloudUpload, Coins, Database, Download, Loader, Ticket, Users, Wallet, Wifi } from "lucide-react";
import { useDashData } from "@/components/dashboard/useDashData";
import { Bars, CallWa, Card, Chip, Counts, Failed, Kpi, Loading, More, Period, Pin, PortalHead } from "./parts";
import { CarePlanCard } from "@/components/careplan/CarePlan";
import { Progress, TARGET } from "./AdminExtra";
import { byMonth, fDate, fWhen, inr, partnerStats, planName, planPrice, sum } from "./stats";

async function load(API) {
  const [leads, bookings, tickets, comms, partner, plans, settings, threads, charges] = await Promise.all([API.partnerLeads(), API.partnerBookings(), API.partnerTickets(), API.myCommissions(), API.myPartner(),
    API.tipPlans().catch(() => ({ live: [], mine: [] })), API.getSettings(), API.myThreads().catch(() => []), API.myCharges()]);
  return { leads, bookings, tickets, comms, partner, plans, settings, threads, charges };
}
const OWN = t => !t || ["home", "leads"].includes(t);
const BOOK_ICON = { scheduled: CalendarDays, in_progress: Loader, installed: CircleCheck };

export default function TipDashboard({ tab }) {
  const { active, pending, data, error, loading, reload } = useDashData("tip", load);
  const [months, setMonths] = useState(6);
  const s = useMemo(() => (data ? partnerStats(data.partner, data.leads, data.bookings, data.comms) : null), [data]);
  if (!OWN(tab) || (!active && !pending)) return null;
  if (pending || loading) return <div className="dsh-page"><Loading /></div>;
  if (error && !data) return <div className="dsh-page"><Failed error={error} retry={reload} /></div>;
  const { leads, bookings, tickets, partner, threads, charges } = data;
  const toBook = leads.filter(l => ["assigned", "contacted", "follow_up"].includes(l.status));
  const counts = { leads: toBook.length, tickets: tickets.filter(t => ["open", "in_progress"].includes(t.status)).length, chat: threads.reduce((a, t) => a + (t.unread || 0), 0),
    bookings: bookings.filter(b => ["scheduled", "in_progress"].includes(b.status)).length, payments: charges.filter(c => ["due", "failed"].includes(c.status)).length };
  return (
    <div className="dsh-page"><div className="pt">
      <Counts c={counts} />
      {(tab || "home") === "home" ? <Home {...{ data, s, months, setMonths }} /> : <Leads leads={leads} partner={partner} />}
    </div></div>
  );
}

function Home({ data, s, months, setMonths }) {
  const { bookings, tickets, partner, plans, settings, charges } = data;
  const paid = charges.filter(c => c.status === "paid");
  const share = Number(settings.tip_share_percent) || 0;
  const chart = byMonth(months, s.mine, l => l.assigned_at || l.created_at, s.inst, b => b.installed_at);
  const t0 = new Date(); t0.setHours(0, 0, 0, 0); const from = new Date(t0 - 3 * 864e5).toISOString().slice(0, 10), to = new Date(+t0 + 7 * 864e5).toISOString().slice(0, 10);
  const week = bookings.filter(b => b.scheduled_date && b.scheduled_date >= from && b.scheduled_date <= to).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)).slice(0, 5);
  const openT = tickets.filter(t => ["open", "in_progress"].includes(t.status));
  const ups = [...plans.mine].slice(0, 3);
  return (
    <>
      <PortalHead title="TIP portal" sub="Manage installations, update plans and track your performance with Connect Bhai." pins={partner.service_pincodes} />
      <div className="pt-kpis">
        <Kpi tone="blue" Icon={Users} label="Leads from Connect Bhai" value={s.mine.length} sub={`${s.givenMonth} this month`} up />
        <Kpi tone="green" Icon={CircleCheck} label="Customers installed" value={s.inst.length} sub={`${s.instMonth} this month · ${s.conv}% conversion`} up />
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
        <Card title={`Open tickets (${openT.length})`} Icon={Ticket} action={<More href="/tip/tickets">View all tickets</More>}>
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
          <p className="pt-big"><b>{s.mine.length}</b> of {TARGET}</p>
          <Progress n={s.mine.length} />
          <p className="pt-muted">All-time leads Connect Bhai has given you. Target: {TARGET}.</p>
        </Card>
        <Card title="Amount paid to Connect Bhai" Icon={Wallet} action={<More href="/tip/payments">View</More>}>
          <p className="pt-big"><b>{inr(sum(paid, c => c.amount))}</b></p>
          <p className="pt-muted">{paid.length} paid fee{paid.length === 1 ? "" : "s"} (incl. GST){paid[0] ? ` · last on ${fDate(paid[0].paid_at || paid[0].created_at)}` : ""}</p>
        </Card>
        <CarePlanCard role="tip" />
      </div>
    </>
  );
}

function Leads({ leads, partner }) {
  const [f, setF] = useState("open");
  const F = [["open", "Open"], ["assigned", "New to call"], ["contacted", "Contacted"], ["follow_up", "Follow-up"], ["booked", "Booked"], ["installed", "Installed"], ["lost", "Lost"], ["all", "All"]];
  const shown = leads.filter(l => f === "all" || (f === "open" ? !["installed", "lost"].includes(l.status) : l.status === f));
  return (
    <>
      <PortalHead title="Leads" sub="Requests from your PIN codes. Call, schedule the installation and keep the status updated." pins={partner.service_pincodes} />
      <div className="pt-filters" role="group" aria-label="Filter leads">{F.map(([k, l]) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}<span>{leads.filter(x => k === "all" || (k === "open" ? !["installed", "lost"].includes(x.status) : x.status === k)).length}</span></button>)}</div>
      <Card title={`${F.find(x => x[0] === f)[1]} leads (${shown.length})`} Icon={Users}>
        {shown.length ? (
          <div className="pt-table pt-t-leads" role="table" aria-label="Leads">
            <div className="pt-tr pt-th" role="row"><span role="columnheader">Customer</span><span role="columnheader">PIN / area</span><span role="columnheader">Plan</span><span role="columnheader">Status</span><span role="columnheader">Requested</span><span role="columnheader">Actions</span></div>
            {shown.map(l => (
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
        ) : <p className="pt-muted">No leads in this list.</p>}
      </Card>
    </>
  );
}
