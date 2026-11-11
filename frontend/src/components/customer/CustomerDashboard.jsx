"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, Check, ChevronRight, CircleCheck, CircleX, Clock, CreditCard, FileText, Gauge, MapPin, Phone, RefreshCw, Settings, Store, UserCheck, UserRound, Wifi } from "lucide-react";
import { useDashData } from "@/components/dashboard/useDashData";
import { RouterArt, SignalBars, PayMarks, WaGlyph } from "./art";
import { STEP_OF, cityOf, fDate, fDayTime, fWhen, fmtPhone, inr, leadChip, leadProduct, planPrice, planTitle, steps, waLink } from "./format";

const STEP_ICON = [FileText, UserCheck, Phone, CalendarDays, Wifi];

async function loadCustomer(API) {
  const [leads, bookings, tickets, charges, threads] = await Promise.all([API.myLeads(), API.myBookings(), API.myTickets(), API.myCharges(), API.myThreads().catch(() => [])]);
  const events = {}, tests = {};
  await Promise.all(leads.map(l => API.leadDetail(l.id).then(d => { events[l.id] = d.events || []; }).catch(() => { events[l.id] = []; })));
  await Promise.all(bookings.filter(b => b.status === "installed").map(b => API.speedTests(b.id).then(t => { tests[b.id] = t; }).catch(() => { tests[b.id] = []; })));
  return { leads, bookings, tickets, charges, events, tests, unread: threads.reduce((a, t) => a + (t.unread || 0), 0) };
}

/* Customer home (/my and /my/bookings), built from Connect_Bhai_Booking_Dashboard.png + ConnectBhai_Mobile_Dashboard.png.
   Data comes from the existing API; actions reuse the app's own handlers (data-act / data-go). */
export default function CustomerDashboard({ tab }) {
  const owned = !tab || tab === "bookings";
  const { active, pending, user, data, error, loading, reload } = useDashData("customer", loadCustomer, !tab || tab === "bookings");
  const ref = useSearchParams().get("ref");
  if (!owned || (!active && !pending)) return null;

  if (pending || loading) return <div className="dsh-page"><div className="cu" aria-busy="true"><Skeleton /></div></div>;
  if (error && !data) return (
    <div className="dsh-page"><div className="cu"><div className="cu-card cu-error" role="alert"><b>Could not load your dashboard.</b><p>{error}</p><button type="button" className="cu-btn cu-btn-primary" onClick={reload}>Try again</button></div></div></div>
  );

  const { leads, bookings, tickets, charges, events, tests, unread } = data;
  const current = leads.find(l => l.status !== "lost") || leads[0];
  const sel = (ref && leads.find(l => l.ref_code === ref)) || current;
  const booking = sel && bookings.find(b => b.lead_id === sel.id);
  const conn = booking && booking.status === "installed" ? booking : bookings.find(b => b.status === "installed");   // router of the selected booking, else your live connection
  const due = charges.filter(c => ["due", "failed"].includes(c.status));
  const counts = { bookings: leads.length, support: tickets.filter(t => ["open", "in_progress"].includes(t.status)).length, payments: due.length, chat: unread };
  const first = (user.full_name || "").split(" ")[0];

  return (
    <div className="dsh-page">
      <div className="cu">
        <div hidden data-cb-counts>{Object.entries(counts).map(([k, n]) => <span key={k} data-tab={k}><span className="cnt">{n}</span></span>)}</div>
        <header className="cu-head">
          <div className="cu-hello">
            <h1>Namaste{first ? `, ${first}` : ""} <span aria-hidden="true">👋</span></h1>
            <span className="cu-role"><UserRound aria-hidden="true" />Customer</span>
            <p><span>Manage your bookings, payments and service requests</span><span className="cu-wide"> — all in one place</span>.</p>
          </div>
          <button type="button" className="cu-btn cu-btn-primary cu-find" data-go="home" data-scroll="search">Find plans <ArrowRight aria-hidden="true" /></button>
        </header>

        <div className="cu-grid">
          <div className="cu-main">
            {sel ? <BookingCard lead={sel} booking={booking} events={events[sel.id] || []} /> : <NoBooking />}
            <PastRequests leads={leads.filter(l => l !== sel)} />
          </div>
          <aside className="cu-side" aria-label="Your connection">
            <RouterCard booking={conn} tests={conn ? tests[conn.id] || [] : []} />
            <PaymentsCard due={due} />
            <section className="cu-card cu-speed">
              <span className="cu-speed-ico"><Gauge aria-hidden="true" /></span>
              <div><h2>Run speed test</h2><p>Check your current internet speed.</p></div>
              <button type="button" className="cu-btn cu-btn-primary" data-go="speed">Test now</button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function BookingCard({ lead, booking, events }) {
  const product = leadProduct(lead), st = steps(product), [chip, tone] = leadChip(lead.status, product);
  const at = STEP_OF[lead.status], lost = lead.status === "lost";
  const when = s => { const e = [...events].reverse().find(x => x.to_status === s || (s === "contacted" && x.to_status === "follow_up")); return e ? e.created_at : null; };
  const sub = [
    fDayTime(lead.created_at),
    [lead.tip ? lead.tip.firm || lead.tip.name : lead.dsa ? lead.dsa.name : "", fDayTime(lead.assigned_at || when("assigned"))].filter(Boolean),
    fDayTime(when("contacted")),
    booking && booking.scheduled_date ? `${product === "broadband" ? "Installation" : "Visit"} scheduled ${fWhen(booking.scheduled_date)}` : fDayTime(when("booked")),
    booking && booking.installed_at ? fDayTime(booking.installed_at) : "",
  ];
  const ChipIcon = tone === "green" ? CircleCheck : tone === "red" ? CircleX : CalendarDays;
  return (
    <section className="cu-card cu-booking" aria-labelledby="cu-bk-title">
      <div className="cu-bk-top">
        <span className="cu-bk-ico"><Wifi aria-hidden="true" /></span>
        <div className="cu-bk-txt">
          <h2 id="cu-bk-title">Booking #{lead.ref_code}</h2>
          <p className="cu-plan"><b>{planTitle(lead.plan)}</b><span className="cu-dot" aria-hidden="true">·</span><span>{planPrice(lead.plan)}</span></p>
          <span className="cu-loc"><MapPin aria-hidden="true" />{[lead.pincode, lead.area, cityOf(lead.pincode)].filter(Boolean).join(", ")}</span>
        </div>
        <span className={`cu-chip cu-chip-${tone} cu-bk-chip`}><ChipIcon aria-hidden="true" />{chip}</span>
      </div>

      <ol className={`cu-track${lost ? " is-lost" : ""}`} aria-label="Booking progress">
        {st.map(([k, label], i) => {
          const state = lost ? "todo" : i < at || (at === 4 && i === 4) ? "done" : i === at ? "now" : "todo";
          const Ico = STEP_ICON[i], lines = Array.isArray(sub[i]) ? sub[i] : [sub[i]];
          return (
            <li key={k} className={`cu-step is-${state}`} aria-current={state === "now" ? "step" : undefined}>
              <span className="cu-node">{state === "done" ? <Check aria-hidden="true" /> : state === "now" ? <Ico aria-hidden="true" /> : null}</span>
              <div className="cu-step-txt"><b>{label}</b>{state !== "todo" && lines.filter(Boolean).map((t, j) => <span key={j}>{t}</span>)}</div>
            </li>
          );
        })}
      </ol>
      {lost && <p className="cu-note">This request was closed. Search your PIN code again to request a new connection.</p>}

      <div className="cu-people">
        <Person label="Your agent" city={cityOf(lead.pincode)} p={lead.dsa} kind="DSA" text={`Namaste, about my Connect Bhai request ${lead.ref_code}`} />
        <Person label="Your installer" city={cityOf(lead.pincode)} p={lead.tip} kind={`${lead.plan && lead.plan.provider ? lead.plan.provider.name + " " : ""}TIP`} text={`Namaste, about my connection ${lead.ref_code}`} store />
      </div>
    </section>
  );
}

function Person({ label, p, kind, text, store, city }) {
  const name = p ? (store ? p.firm || p.name : p.name) : null;
  return (
    <div className="cu-person">
      <span className={`cu-ava${store ? " is-store" : ""}`} aria-hidden="true">{store ? <Store /> : p ? p.name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() : <UserRound />}</span>
      <div className="cu-person-txt"><span>{label}</span><b>{name || "Assigned shortly"}</b><em>{p ? [kind, city].filter(Boolean).join(" · ") : "You get a WhatsApp message"}</em></div>
      <div className="cu-person-acts">
        {p ? <>
          <a className="cu-btn cu-btn-call" href={`tel:+91${p.phone}`} aria-label={`Call ${name}, ${fmtPhone(p.phone)}`}><Phone aria-hidden="true" />Call</a>
          <a className="cu-btn cu-btn-wa" href={waLink(p.phone, text)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${name}`}><WaGlyph />WhatsApp</a>
        </> : null}
      </div>
    </div>
  );
}

function NoBooking() {
  return (
    <section className="cu-card cu-empty">
      <span className="cu-bk-ico"><Wifi aria-hidden="true" /></span>
      <div><h2>No bookings yet</h2><p>Search your PIN code, compare plans and request a connection.</p></div>
      <button type="button" className="cu-btn cu-btn-primary" data-go="home" data-scroll="search">Find plans <ArrowRight aria-hidden="true" /></button>
    </section>
  );
}

function StatusChip({ status, product }) {
  const [label, tone] = leadChip(status, product);
  const Ico = tone === "green" ? CircleCheck : tone === "red" ? CircleX : Clock;
  return <span className={`cu-chip cu-chip-${tone} cu-chip-sm`}><Ico aria-hidden="true" />{label === "Request received" ? "Requested" : label}</span>;
}

function PastRequests({ leads }) {
  return (
    <section className="cu-card cu-past" aria-labelledby="cu-past-title">
      <h2 id="cu-past-title" className="cu-h2"><Clock aria-hidden="true" />Your past requests</h2>
      {leads.length ? (
        <div className="cu-table" role="table" aria-label="Your past requests">
          <div className="cu-tr cu-th" role="row"><span role="columnheader">Request ID</span><span role="columnheader">Plan &amp; Provider</span><span role="columnheader">Location (PIN)</span><span role="columnheader">Date</span><span role="columnheader">Status</span><span role="columnheader" className="cu-sr">Details</span></div>
          {leads.map(l => (
            <div className="cu-tr" role="row" key={l.id}>
              <span role="cell" className="cu-id">{l.ref_code}</span>
              <span role="cell" className="cu-pp"><b>{planTitle(l.plan)}</b><small>{planPrice(l.plan)}</small></span>
              <span role="cell" className="cu-pin" data-pin={l.pincode}><MapPin aria-hidden="true" />{[l.pincode, l.area].filter(Boolean).join(", ")}</span>
              <span role="cell" className="cu-date">{fDate(l.created_at)}</span>
              <span role="cell"><StatusChip status={l.status} product={leadProduct(l)} /></span>
              <span role="cell" className="cu-more">
                <Link className="cu-btn cu-btn-soft" href={`/my/bookings?ref=${encodeURIComponent(l.ref_code)}`} scroll aria-label={`View details of ${l.ref_code}`}><span>View details</span><ArrowRight aria-hidden="true" /></Link>
                <Link className="cu-chev" href={`/my/bookings?ref=${encodeURIComponent(l.ref_code)}`} scroll aria-label={`View details of ${l.ref_code}`}><ChevronRight aria-hidden="true" /></Link>
              </span>
            </div>
          ))}
        </div>
      ) : <p className="cu-muted">No other requests yet. Each new connection you request shows up here.</p>}
    </section>
  );
}

const RX = v => (v == null ? null : v >= -25 ? ["Good", 4, "#16A34A", "#15803D"] : v >= -27 ? ["Weak", 2, "#D97706", "#B45309"] : ["Bad", 1, "#DC2626", "#B91C1C"]);   // label, bars, bar colour, text colour (AA)

function RouterCard({ booking, tests }) {
  const d = booking && booking.device, installed = booking && booking.status === "installed";
  const on = !!(d && d.state === "online"), off = !!(d && d.state === "offline"), linked = !!(installed && booking.ont_serial && d && d.acs);
  const last = [...tests].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).find(t => t.download_mbps);
  const rx = installed && d ? RX(d.rx_dbm) : null;
  const [chip, tone] = !installed ? ["Not installed", "grey"] : on ? ["Online", "green"] : off ? ["Offline", "red"] : ["Unknown", "grey"];
  return (
    <section className="cu-card cu-router" aria-labelledby="cu-rt-title">
      <div className="cu-card-head"><h2 id="cu-rt-title" className="cu-h2"><Wifi aria-hidden="true" />Router status</h2><span className={`cu-chip cu-chip-${tone} cu-dotchip`}><i aria-hidden="true" />{chip}</span></div>
      <div className="cu-rt-body">
        <RouterArt on={on} />
        <div className="cu-rt-stats">
          <span>Internet speed</span>
          <b>{last ? `${Math.floor(last.download_mbps)} Mbps` : "—"}</b>
          <span className="cu-signal">{rx ? <><SignalBars level={rx[1]} tone={rx[2]} />Signal: <em style={{ color: rx[3] }}>{rx[0]}</em></> : installed ? "Signal: not reported yet" : "Shows after installation"}</span>
        </div>
      </div>
      <div className="cu-rt-acts">
        <button type="button" className="cu-btn cu-btn-soft" data-act="modem-reboot" data-id={booking && booking.id} disabled={!(linked && on)}><RefreshCw aria-hidden="true" />Restart router</button>
        <button type="button" className="cu-btn cu-btn-primary" data-act="modem-wifi" data-id={booking && booking.id} data-ssid={(d && d.ssid) || ""} disabled={!(linked && on)}><Settings aria-hidden="true" />Change Wi-Fi</button>
      </div>
      {installed && !linked ? <p className="cu-muted cu-small">Restart and Wi-Fi change work once your installer links the modem.</p> : installed && !on ? <p className="cu-muted cu-small">The modem is offline. Restart and Wi-Fi change need it online.</p> : null}
    </section>
  );
}

function PaymentsCard({ due }) {
  const c = due[0];
  return (
    <section className="cu-card cu-pay" aria-labelledby="cu-pay-title">
      <h2 id="cu-pay-title" className="cu-h2"><CreditCard aria-hidden="true" />Payments due</h2>
      {c ? <>
        <div className="cu-pay-row">
          <div><span className="cu-pay-what">{c.description}</span><b className="cu-amt">{inr(c.amount)}</b></div>
          <span className="cu-chip cu-chip-red cu-due">{c.status === "failed" ? "Failed" : "Due"}</span>
        </div>
        <p className="cu-pay-note">{/install/i.test(c.description) ? "Pay to confirm your installation slot." : `Includes GST · Ref ${c.ref_code}`}{due.length > 1 ? <> · <Link href="/my/payments">{due.length - 1} more due</Link></> : null}</p>
        <button type="button" className="cu-btn cu-btn-primary cu-btn-block" data-act="pay" data-id={c.id}>Pay now <ArrowRight aria-hidden="true" /></button>
      </> : <>
        <div className="cu-pay-row"><div><span className="cu-pay-what">Nothing to pay right now</span><b className="cu-amt">{inr(0)}</b></div><span className="cu-chip cu-chip-green cu-due">Paid</span></div>
        <Link href="/my/payments" className="cu-btn cu-btn-soft cu-btn-block">View payments <ArrowRight aria-hidden="true" /></Link>
      </>}
      <PayMarks />
    </section>
  );
}

function Skeleton() {
  const b = (w, h) => <span className="sk" style={{ width: w, height: h }} aria-hidden="true" />;
  return (
    <>
      <div className="cu-head">{b("38%", 34)}{b(160, 50)}</div>
      <div className="cu-grid">
        <div className="cu-main"><div className="cu-card">{b("50%", 26)}{b("70%", 18)}{b("100%", 110)}{b("100%", 100)}</div><div className="cu-card">{b("30%", 22)}{b("100%", 120)}</div></div>
        <div className="cu-side"><div className="cu-card">{b("50%", 22)}{b("100%", 120)}</div><div className="cu-card">{b("50%", 22)}{b("100%", 140)}</div></div>
      </div>
    </>
  );
}

