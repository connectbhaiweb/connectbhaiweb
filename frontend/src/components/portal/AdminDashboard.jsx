"use client";
import { useMemo, useState } from "react";
import { Building2, CalendarDays, ChartColumn, Check, CircleCheck, CircleX, Coins, Handshake, MapPin, Phone, Store, Ticket, UserRound, Users, Wrench } from "lucide-react";
import { useDashData } from "@/components/dashboard/useDashData";
import { Bars, Card, Chip, Counts, Failed, Kpi, Loading, More, Period, Pin, PortalHead } from "./parts";
import { byMonth, inr, mKey, monthKeys, planName, sum } from "./stats";

async function load(API, m) {
  const [leads, partners, bookings, tickets, comms, cities, locations, plans, threads] = await Promise.all([API.adminLeads(), API.adminPartners(), API.adminBookings(), API.adminTickets(), API.adminCommissions(),
    API.adminCities().catch(() => []), API.adminLocations().catch(() => []), API.adminPlans().catch(() => []), API.myThreads().catch(() => [])]);
  return { leads, partners, bookings, tickets, comms, cities, locations, plans, threads, ZONES: m.ZONES, ZONE_BY_PIN: m.ZONE_BY_PIN };
}
const fmtPh = p => (p ? String(p).replace(/^(\d{5})(\d{5})$/, "$1 $2") : "");

export default function AdminDashboard({ tab }) {
  const { active, pending, data, error, loading, reload } = useDashData("admin", load);
  const [months, setMonths] = useState(6);
  const z = useMemo(() => {
    if (!data) return [];
    const zoneOf = {}; data.locations.forEach(l => { if (l.zone) zoneOf[l.pincode] = l.zone; });
    const zid = pin => zoneOf[pin] || data.ZONE_BY_PIN[pin];
    const inst = data.bookings.filter(b => b.status === "installed");
    return data.ZONES.map(zn => { const ls = data.leads.filter(l => zid(l.pincode) === zn.id), is = inst.filter(b => b.lead && zid(b.lead.pincode) === zn.id).length; return { name: zn.name, leads: ls.length, installs: is, conv: ls.length ? Math.round(is / ls.length * 100) : 0 }; })
      .filter(r => r.leads).sort((a, b) => b.leads - a.leads);
  }, [data]);
  if (!(!tab || tab === "overview") || (!active && !pending)) return null;
  if (pending || loading) return <div className="dsh-page"><Loading /></div>;
  if (error && !data) return <div className="dsh-page"><Failed error={error} retry={reload} /></div>;

  const { leads, partners, bookings, tickets, comms, cities, plans, threads } = data;
  const unassigned = leads.filter(l => l.status === "new" && !l.assigned_dsa_id && !l.assigned_tip_id);
  const apps = partners.filter(p => p.status === "pending" && !p.approved_at);
  const cur = monthKeys(1)[0];
  const inst = bookings.filter(b => b.status === "installed");
  const openT = tickets.filter(t => ["open", "in_progress"].includes(t.status)).length;
  const counts = { leads: leads.filter(l => l.status === "new").length, partners: apps.length, plans: plans.filter(p => p.status === "pending").length, cities: sum(cities, c => c.waiting), chat: threads.reduce((a, t) => a + (t.unread || 0), 0) };
  const cityRows = [...cities].sort((a, b) => (a.status === "live" ? -1 : 0) - (b.status === "live" ? -1 : 0) || (b.waiting || 0) - (a.waiting || 0)).filter(c => c.status !== "hidden").slice(0, 5);

  return (
    <div className="dsh-page"><div className="pt">
      <Counts c={counts} />
      <PortalHead title="Admin portal" sub="Control panel for leads, partners, installations, plans and business operations." />
      <div className="pt-kpis pt-kpis-6">
        <Kpi tone="red" Icon={Users} label="Unassigned leads" value={unassigned.length} sub="Need assignment" />
        <Kpi tone="amber" Icon={CalendarDays} label="Installs pending" value={bookings.filter(b => ["scheduled", "in_progress"].includes(b.status)).length} />
        <Kpi tone="blue" Icon={Ticket} label="Open tickets" value={openT} />
        <Kpi tone="purple" Icon={Coins} label="Payouts to approve" value={inr(sum(comms.filter(c => c.status === "pending"), c => c.amount))} />
        <Kpi tone="blue" Icon={Store} label="Active partners" value={partners.filter(p => p.status === "active").length} />
        <Kpi tone="green" Icon={CircleCheck} label="Customers installed this month" value={inst.filter(b => mKey(b.installed_at) === cur).length} />
      </div>
      <div className="pt-row pt-row-adm1">
        <Card title="Leads waiting for assignment" Icon={Users} action={<More href="/admin/leads">View all leads</More>}>
          {unassigned.length ? (
            <div className="pt-table pt-t-assign" role="table" aria-label="Leads waiting for assignment">
              <div className="pt-tr pt-th" role="row"><span role="columnheader">Customer</span><span role="columnheader">Ref. code</span><span role="columnheader">PIN</span><span role="columnheader">Plan</span><span role="columnheader">Actions</span></div>
              {unassigned.slice(0, 5).map(l => (
                <div className="pt-tr" role="row" key={l.id}>
                  <span role="cell"><b>{l.name}</b></span><span role="cell" className="pt-mono">{l.ref_code}</span><span role="cell"><Pin>{l.pincode}</Pin></span>
                  <span role="cell" className="pt-ell">{l.plan ? planName(l.plan) : "Callback, no plan"}</span>
                  <span role="cell" className="pt-acts"><button type="button" className="pt-assign" data-act="assign" data-id={l.id}><UserRound aria-hidden="true" />Assign DSA</button><button type="button" className="pt-assign" data-act="assign" data-id={l.id}><Wrench aria-hidden="true" />Assign TIP</button></span>
                </div>
              ))}
            </div>
          ) : <p className="pt-muted">Every lead is assigned.</p>}
        </Card>
        <Card title="Partner applications" Icon={Handshake} action={<More href="/admin/partners">View all applications</More>}>
          {apps.length ? (
            <div className="pt-table pt-t-apps" role="table" aria-label="Partner applications">
              <div className="pt-tr pt-th" role="row"><span role="columnheader">Applicant</span><span role="columnheader">Type</span><span role="columnheader">Firm / Organization</span><span role="columnheader">Phone</span><span role="columnheader">Service PINs</span><span role="columnheader">Action</span></div>
              {apps.slice(0, 5).map(p => (
                <div className="pt-tr" role="row" key={p.id}>
                  <span role="cell"><b>{p.name}</b></span><span role="cell"><Chip label={p.type.toUpperCase()} tone={p.type === "dsa" ? "blue" : "purple"} /></span>
                  <span role="cell" className="pt-ell">{p.firm || "—"}</span>
                  <span role="cell" className="pt-ph"><Phone aria-hidden="true" />{fmtPh(p.phone)}</span>
                  <span role="cell" className="pt-ell">{p.service_pincodes || "—"}</span>
                  <span role="cell" className="pt-acts"><button type="button" className="pt-ok" data-act="approve-partner" data-id={p.id}><Check aria-hidden="true" />Approve</button><button type="button" className="pt-no" data-act="partner-status" data-id={p.id} data-s="rejected"><CircleX aria-hidden="true" />Reject</button></span>
                </div>
              ))}
            </div>
          ) : <p className="pt-muted">No applications waiting.</p>}
        </Card>
      </div>
      <div className="pt-row pt-row-adm2">
        <Card title="Leads and installs, last 6 months" Icon={ChartColumn} className="pt-chartcard" action={<Period value={months} onChange={setMonths} />}>
          <Bars legend="bottom" height={230} data={byMonth(months, leads, l => l.created_at, inst, b => b.installed_at)} series={[{ key: "leads", name: "Leads", color: "#2878FD" }, { key: "installs", name: "Installs", color: "#32B661" }]} />
        </Card>
        <Card title="Zone performance" Icon={MapPin} action={<More href="/admin/reports">View detailed report</More>}>
          <div className="pt-table pt-t-zone pt-plain" role="table" aria-label="Zone performance">
            <div className="pt-tr pt-th" role="row"><span role="columnheader">Zone</span><span role="columnheader">Leads</span><span role="columnheader">Installs</span><span role="columnheader">Conversion</span></div>
            {z.map(r => <div className="pt-tr" role="row" key={r.name}><span role="cell"><b>{r.name}</b></span><span role="cell">{r.leads}</span><span role="cell">{r.installs}</span><span role="cell"><Chip label={`${r.conv}%`} tone="green" /></span></div>)}
          </div>
        </Card>
        <Card title="Cities" Icon={Building2} action={<More href="/admin/cities">View all cities</More>}>
          <div className="pt-table pt-t-city pt-plain" role="table" aria-label="Cities">
            <div className="pt-tr pt-th" role="row"><span role="columnheader">City</span><span role="columnheader">Status</span><span role="columnheader">Waiting list</span></div>
            {cityRows.map(c => <div className="pt-tr" role="row" key={c.id}><span role="cell"><Pin><b>{c.name}</b></Pin></span><span role="cell"><Chip s={c.status === "live" ? "live" : "soon"} Icon={c.status === "live" ? CircleCheck : null} /></span><span role="cell"><b>{c.status === "live" ? "—" : (c.waiting || 0).toLocaleString("en-IN")}</b></span></div>)}
          </div>
        </Card>
      </div>
    </div></div>
  );
}

