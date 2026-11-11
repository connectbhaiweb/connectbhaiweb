"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Router, Search, Settings, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { useDashData } from "@/components/dashboard/useDashData";
import { Card, Chip, Failed, More } from "@/components/portal/parts";
import { hrefOf } from "@/components/dashboard/nav";

/* Care plan (GenieACS) list + summary card. Data: API.carePlanDevices (rest.js) */
const ago = iso => { if (!iso) return "—"; const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 6e4)); return m < 1 ? "Just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const up = s => { if (!s) return "—"; const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600); return d ? `${d}d ${h}h` : `${h}h`; };
const ph = m => String(m).replace(/^(\d{5})(\d{5})$/, "+91 $1 $2");
const SIG = { Good: "green", Weak: "amber", Bad: "red" };
const ROLE_OF = { my: "customer", dsa: "dsa", tip: "tip", admin: "admin" };

async function loadDevices(API) {
  const user = API.me();                                             // { id, role } of the signed-in account
  const devices = API.carePlanDevices ? await API.carePlanDevices() : [];   // real modems from the API only; there is no sample list
  const bookings = user.role === "customer" ? await API.myBookings() : [];
  return { devices, booking: bookings.find(b => b.status === "installed") || null };
}

export function CarePlanCard({ role }) {
  const { data, error, reload } = useDashData(role, loadDevices);
  const d = data ? data.devices : null, on = d ? d.filter(x => x.status === "online").length : 0;
  return (
    <Card title="Care plan" Icon={ShieldCheck} className="cp-card" action={<More href={hrefOf(role, "careplan")}>View all</More>}>
      {error && !d ? <p className="pt-muted">Could not load devices. <button type="button" className="pt-more" onClick={reload}>Retry</button></p> : (
        <div className="cp-sum" aria-busy={!d}>
          <div className="tone-blue"><span>Total</span><b>{d ? d.length : "…"}</b></div>
          <div className="tone-green"><span>Online</span><b>{d ? on : "…"}</b></div>
          <div className="tone-red"><span>Offline</span><b>{d ? d.length - on : "…"}</b></div>
        </div>
      )}
    </Card>
  );
}

export default function CarePlanPage({ base, tab }) {
  const role = ROLE_OF[base];
  const own = base === "my" ? tab === "devices" : tab === "careplan";
  const { active, pending, data, error, loading, reload } = useDashData(role, loadDevices);
  const [q, setQ] = useState(""), [f, setF] = useState("all");
  const list = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    return data.devices.filter(d => (f === "all" || d.status === f) && (!t || [d.customer.name, d.customer.mobile, d.serialNumber].some(x => x.toLowerCase().includes(t))));
  }, [data, q, f]);
  if (!own || (!active && !pending)) return null;
  const sk = <div className="pt" aria-busy="true">{[34, 90, 300].map((h, i) => <span key={i} className="sk" style={{ display: "block", height: h, borderRadius: 12, marginBottom: 14 }} />)}</div>;
  if (pending || loading) return <div className="dsh-page">{sk}</div>;
  if (error && !data) return <div className="dsh-page"><Failed error={error} retry={reload} /></div>;
  const all = data.devices, on = all.filter(d => d.status === "online").length;

  if (role === "customer") {
    const d = all[0], b = data.booking, live = !!(b && b.device && b.device.acs && b.device.active !== false && b.device.state === "online");
    return (
      <div className="dsh-page"><div className="pt">
        <header className="pt-head"><div><h1>Care plan</h1><p>Your router, Wi-Fi and connection health, reported by GenieACS.</p></div></header>
        {d ? (
          <Card title={`${d.manufacturer} ${d.model}`} Icon={Router} action={<Chip label={d.status === "online" ? "Online" : "Offline"} tone={d.status === "online" ? "green" : "red"} />}>
            <dl className="cp-dl">{facts(d).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <div className="cp-acts">
              <button type="button" className="cu-btn cu-btn-soft" data-act="modem-reboot" data-id={b ? b.id : ""} disabled={!live}><RefreshCw aria-hidden="true" />Restart router</button>
              <button type="button" className="cu-btn cu-btn-primary" data-act="modem-wifi" data-id={b ? b.id : ""} data-ssid={(b && b.device && b.device.ssid) || ""} disabled={!live}><Settings aria-hidden="true" />Change Wi-Fi</button>
            </div>
            {!live && <p className="pt-muted">Restart and Wi-Fi change work once your installer links the modem and it is online.</p>}
          </Card>
        ) : <Card title="No device yet" Icon={Router}><p className="pt-muted">Your router shows here after installation.</p></Card>}
      </div></div>
    );
  }
  return (
    <div className="dsh-page"><div className="pt">
      <header className="pt-head"><div><h1>Care plan</h1><p>{role === "admin" ? "Every customer router / ONT reported by GenieACS." : "Routers / ONTs of your customers, reported by GenieACS."}</p></div></header>
      <div className="cp-sum cp-sum-lg">
        <div className="tone-blue"><span><Router aria-hidden="true" />Total</span><b>{all.length}</b></div>
        <div className="tone-green"><span><Wifi aria-hidden="true" />Online</span><b>{on}</b></div>
        <div className="tone-red"><span><WifiOff aria-hidden="true" />Offline</span><b>{all.length - on}</b></div>
      </div>
      <Card title={`Devices (${list.length})`} Icon={Router} action={
        <div className="cp-tools">
          <label className="cp-search"><Search aria-hidden="true" /><span className="pt-sr">Search devices</span><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, mobile or serial" /></label>
          <div className="pt-filters cp-f" role="group" aria-label="Filter by status">{[["all", "All"], ["online", "Online"], ["offline", "Offline"]].map(([k, l]) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}</div>
        </div>}>
        {list.length ? (
          <div className="pt-table cp-table" role="table" aria-label="Devices">
            <div className="pt-tr pt-th" role="row">{["Customer", "Status", "Wi-Fi speed", "Signal", "Last seen", "Model", "SSID", "Devices", "Uptime"].map(h => <span key={h} role="columnheader">{h}</span>)}</div>
            {list.map(d => (
              <div className="pt-tr" role="row" key={d.id}>
                <span role="cell" className="pt-name"><span><b>{d.customer.name}</b><small>{ph(d.customer.mobile)}</small></span></span>
                <span role="cell" data-l="Status"><Chip label={d.status === "online" ? "Online" : "Offline"} tone={d.status === "online" ? "green" : "red"} /></span>
                <span role="cell" data-l="Wi-Fi speed">{d.wifi.speedMbps ? `${d.wifi.speedMbps} Mbps` : "—"}</span>
                <span role="cell" data-l="Signal"><Chip label={d.signal.rxPowerDbm != null ? `${d.signal.quality} · ${d.signal.rxPowerDbm} dBm` : "No signal"} tone={SIG[d.signal.quality]} /></span>
                <span role="cell" data-l="Last seen">{ago(d.lastInform)}</span>
                <span role="cell" data-l="Model" className="pt-ell">{d.manufacturer} {d.model}<small className="cp-sn">{d.serialNumber}</small></span>
                <span role="cell" data-l="SSID" className="pt-ell">{d.wifi.ssid}</span>
                <span role="cell" data-l="Devices">{d.wifi.connectedDevices}</span>
                <span role="cell" data-l="Uptime">{up(d.uptimeSeconds)}</span>
              </div>
            ))}
          </div>
        ) : <p className="pt-muted">{all.length ? "No device matches this search." : "No devices yet. Routers appear after installation."}</p>}
      </Card>
      {role === "dsa" || role === "tip" ? <p className="pt-muted"><Link className="pt-more" href={hrefOf(role, "home")}>Back to Home</Link></p> : null}
    </div></div>
  );
}
function facts(d) {
  return [["Status", d.status === "online" ? "Online" : "Offline"], ["Wi-Fi speed", d.wifi.speedMbps ? `${d.wifi.speedMbps} Mbps` : "—"], ["Signal", d.signal.rxPowerDbm != null ? `${d.signal.quality} (${d.signal.rxPowerDbm} dBm)` : "No signal"],
    ["Last seen", ago(d.lastInform)], ["Model", `${d.manufacturer} ${d.model}`], ["Serial number", d.serialNumber], ["SSID", `${d.wifi.ssid} · ${d.wifi.band}, ch ${d.wifi.channel}`],
    ["Connected devices", d.wifi.connectedDevices], ["Uptime", up(d.uptimeSeconds)], ["IP address", d.ip || "—"], ["Firmware", d.firmwareVersion]];
}
