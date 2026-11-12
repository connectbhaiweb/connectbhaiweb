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
  const [acs, setAcs] = useState(null), [acsBusy, setAcsBusy] = useState(false), [acsErr, setAcsErr] = useState("");
  const [linkFor, setLinkFor] = useState(null), [cands, setCands] = useState(null), [pick, setPick] = useState(""), [linkBusy, setLinkBusy] = useState(false), [linkErr, setLinkErr] = useState("");
  const startLink = async d => {   // admin: choose which customer this modem belongs to
    setLinkFor(d); setPick(""); setLinkErr(""); setCands(null);
    try { const { API } = await import("@/lib/connectbhai/api"); setCands(await API.carePlanLinkCandidates()); } catch (e) { setCands([]); setLinkErr((e && e.message) || "Could not load customers."); }
  };
  const doLink = async () => {
    if (!pick || !linkFor) return;
    setLinkBusy(true); setLinkErr("");
    try { const { API } = await import("@/lib/connectbhai/api"); await API.carePlanLink(pick, linkFor); setLinkFor(null); await fetchAcs(); }
    catch (e) { setLinkErr((e && e.message) || "Could not link this modem."); }
    setLinkBusy(false);
  };
  const fetchAcs = async () => {   // admin: refresh the linked modems, then list everything GenieACS knows
    setAcsBusy(true); setAcsErr("");
    try { const { API } = await import("@/lib/connectbhai/api"); setAcs(await API.carePlanFetchAcs()); reload(); }
    catch (e) { setAcsErr((e && e.message) || "Could not reach GenieACS."); }
    setAcsBusy(false);
  };
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
      <header className="pt-head"><div><h1>Care plan</h1><p>{role === "admin" ? "Every customer router / ONT reported by GenieACS." : "Routers / ONTs of your customers, reported by GenieACS."}</p></div>
        {role === "admin" && <button type="button" className="cu-btn cu-btn-primary" onClick={fetchAcs} disabled={acsBusy}><RefreshCw aria-hidden="true" />{acsBusy ? "Fetching…" : "Fetch from GenieACS"}</button>}
      </header>
      {role === "admin" && acsErr && <p className="pt-muted" role="alert">{acsErr}</p>}
      {role === "admin" && acs && (
        <Card title={`Modems in GenieACS (${acs.total})`} Icon={Router}>
          {acs.mock ? <p className="pt-muted">GenieACS is not connected on this server (mock mode), so there is nothing to list.</p>
            : acs.items.length ? (
              <div className="pt-table cp-table" role="table" aria-label="Modems in GenieACS">
                <div className="pt-tr pt-th" role="row">{["Customer", "Status", "IP", "Signal", "Last seen", "Model", "SSID", "Firmware", "Linked"].map(h => <span key={h} role="columnheader">{h}</span>)}</div>
                {acs.items.map(d => (
                  <div className="pt-tr" role="row" key={d.id}>
                    <span role="cell" className="pt-name"><span><b>{d.linked_to ? d.linked_to.customer_name : "Not linked yet"}</b><small>{d.linked_to ? d.linked_to.ref_code : "no customer"}</small></span></span>
                    <span role="cell" data-l="Status"><Chip label={d.online ? "Online" : "Offline"} tone={d.online ? "green" : "red"} /></span>
                    <span role="cell" data-l="IP" className="pt-ell">{d.ip || "—"}</span>
                    <span role="cell" data-l="Signal">{d.rx_power_dbm != null ? <Chip label={`${d.rx_power_dbm >= -25 ? "Good" : d.rx_power_dbm >= -27 ? "Weak" : "Bad"} · ${d.rx_power_dbm} dBm`} tone={SIG[d.rx_power_dbm >= -25 ? "Good" : d.rx_power_dbm >= -27 ? "Weak" : "Bad"]} /> : "—"}</span>
                    <span role="cell" data-l="Last seen">{ago(d.last_inform)}</span>
                    <span role="cell" data-l="Model" className="pt-ell">{[d.manufacturer, d.model].filter(Boolean).join(" ") || "—"}<small className="cp-sn">{d.serial || d.id}</small></span>
                    <span role="cell" data-l="SSID" className="pt-ell">{d.wifi_ssid || "—"}</span>
                    <span role="cell" data-l="Firmware" className="pt-ell">{d.firmware || "—"}</span>
                    <span role="cell" data-l="Linked">{d.linked_to ? <Chip label="Linked" tone="green" /> : <button type="button" className="cu-btn cu-btn-soft" onClick={() => startLink(d)}>Link…</button>}</span>
                  </div>
                ))}
              </div>
            ) : <p className="pt-muted">GenieACS has no modems yet. A modem appears here after it checks in.</p>}
        </Card>
      )}
      {role === "admin" && linkFor && (
        <Card title={`Link ${[linkFor.manufacturer, linkFor.model].filter(Boolean).join(" ") || "modem"} · ${linkFor.serial || linkFor.id} to a customer`} Icon={Router}>
          {cands === null ? <p className="pt-muted">Loading customers…</p> : cands.length ? (
            <div className="cp-acts">
              <label className="cp-search"><span className="pt-sr">Customer</span>
                <select value={pick} onChange={e => setPick(e.target.value)} aria-label="Customer to link this modem to">
                  <option value="">Choose a customer…</option>
                  {cands.map(x => <option key={x.id} value={x.id}>{x.lead.customer_name} · {x.lead.ref_code} · {x.lead.customer_phone}</option>)}
                </select>
              </label>
              <button type="button" className="cu-btn cu-btn-primary" onClick={doLink} disabled={!pick || linkBusy}>{linkBusy ? "Linking…" : "Link modem"}</button>
              <button type="button" className="cu-btn cu-btn-soft" onClick={() => setLinkFor(null)} disabled={linkBusy}>Cancel</button>
            </div>
          ) : (
            <>
              <p className="pt-muted">No customer is waiting for a modem. A customer appears here after a TIP completes their installation with Care Plan.</p>
              <div className="cp-acts"><button type="button" className="cu-btn cu-btn-soft" onClick={() => setLinkFor(null)}>Close</button></div>
            </>
          )}
          {linkErr && <p className="pt-muted" role="alert">{linkErr}</p>}
        </Card>
      )}
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
            <div className="pt-tr pt-th" role="row">{["Customer", "Status", "Wi-Fi speed", "Signal", "Last seen", "Model", "SSID", "Devices", "Uptime", "Actions"].map(h => <span key={h} role="columnheader">{h}</span>)}</div>
            {list.map(d => (
              <div className="pt-tr" role="row" key={d.id}>
                <span role="cell" className="pt-name"><span><b>{d.customer.name}</b><small>{ph(d.customer.mobile)}</small></span></span>
                <span role="cell" data-l="Status"><Chip label={d.status === "online" ? "Online" : d.status === "unknown" ? "Not reported" : "Offline"} tone={d.status === "online" ? "green" : d.status === "unknown" ? "grey" : "red"} />{d.live === false && <small className="cp-sn" title="Not a live reading yet: shows Live once the modem reports through GenieACS">Simulated</small>}</span>
                <span role="cell" data-l="Wi-Fi speed">{d.wifi.speedMbps ? `${d.wifi.speedMbps} Mbps` : "—"}</span>
                <span role="cell" data-l="Signal"><Chip label={d.signal.rxPowerDbm != null ? `${d.signal.quality} · ${d.signal.rxPowerDbm} dBm` : "No signal"} tone={SIG[d.signal.quality]} /></span>
                <span role="cell" data-l="Last seen">{ago(d.lastInform)}</span>
                <span role="cell" data-l="Model" className="pt-ell">{d.manufacturer} {d.model}<small className="cp-sn">{d.serialNumber}</small></span>
                <span role="cell" data-l="SSID" className="pt-ell">{d.wifi.ssid}</span>
                <span role="cell" data-l="Devices">{d.wifi.connectedDevices}</span>
                <span role="cell" data-l="Uptime">{up(d.uptimeSeconds)}</span>
                <span role="cell" data-l="Actions"><DeviceActs d={d} onDone={reload} /></span>
              </div>
            ))}
          </div>
        ) : <p className="pt-muted">{all.length ? "No device matches this search." : "No devices yet. Routers appear after installation."}</p>}
      </Card>
      {role === "dsa" || role === "tip" ? <p className="pt-muted"><Link className="pt-more" href={hrefOf(role, "home")}>Back to Home</Link></p> : null}
    </div></div>
  );
}
/* QA 12/13: Refresh and Router test right in the dashboard. Router test needs a linked modem (GenieACS id or ONT serial),
   an active Care plan and the modem online; Refresh needs it linked. Each shows a loader and says what happened. */
function DeviceActs({ d, onDone }) {
  const [busy, setBusy] = useState(""), [msg, setMsg] = useState(null);
  const linked = d.linked !== false, canTest = linked && d.active !== false && d.status === "online";
  const why = !linked ? "Not linked to GenieACS yet" : d.active === false ? "Care plan is not active" : d.status !== "online" ? "Modem must be online" : "";
  const run = async kind => {
    setBusy(kind); setMsg(null);
    try {
      const { API } = await import("@/lib/connectbhai/api");
      if (kind === "refresh") {
        const r = await API.deviceRefresh(d.id);
        setMsg({ ok: true, t: r.state === "online" ? "Online now" : r.state === "offline" ? "Offline" : "Not reported yet" }); onDone && onDone();
      } else {
        setMsg({ ok: true, t: "Testing… up to 5 min" });
        const t = await API.deviceRouterTest(d.id);
        setMsg({ ok: true, t: `${Number(t.download_mbps).toFixed(1)} Mbps line speed${t.is_simulated ? " (simulated)" : ""}` });
        onDone && onDone();   // reload the list so the Wi-Fi speed column shows the new result
      }
    } catch (e) { setMsg({ ok: false, t: (e && e.message) || "Could not reach the modem. Try again." }); }
    finally { setBusy(""); }
  };
  return (
    <span className="cp-acts">
      <button type="button" className="pt-link" disabled={!linked || !!busy} title={linked ? "" : why} onClick={() => run("refresh")}>{busy === "refresh" ? "Refreshing…" : "Refresh"}</button>
      <button type="button" className="pt-link" disabled={!canTest || !!busy} title={why} onClick={() => run("test")}>{busy === "test" ? "Testing…" : "Router test"}</button>
      {msg ? <small role="status" className={msg.ok ? "cp-ok" : "cp-err"}>{msg.t}</small> : !canTest && why ? <small className="cp-sn">{why}</small> : null}
    </span>
  );
}

function facts(d) {
  return [["Status", d.status === "online" ? "Online" : "Offline"], ["Wi-Fi speed", d.wifi.speedMbps ? `${d.wifi.speedMbps} Mbps` : "—"], ["Signal", d.signal.rxPowerDbm != null ? `${d.signal.quality} (${d.signal.rxPowerDbm} dBm)` : "No signal"],
    ["Last seen", ago(d.lastInform)], ["Model", `${d.manufacturer} ${d.model}`], ["Serial number", d.serialNumber], ["SSID", `${d.wifi.ssid} · ${d.wifi.band}, ch ${d.wifi.channel}`],
    ["Connected devices", d.wifi.connectedDevices], ["Uptime", up(d.uptimeSeconds)], ["IP address", d.ip || "—"], ["Firmware", d.firmwareVersion]];
}
