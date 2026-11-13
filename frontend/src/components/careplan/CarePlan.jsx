"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Check, Gauge, Power, RefreshCw, Router, Search, Settings, ShieldCheck, Wifi, WifiOff, X } from "lucide-react";
import { useDashData } from "@/components/dashboard/useDashData";
import { Card, Chip, Failed, More } from "@/components/portal/parts";
import { hrefOf } from "@/components/dashboard/nav";

/* Care plan (Gene) list + summary card. Data: API.carePlanDevices (rest.js) */
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
  const fetchAcs = async () => {   // admin: refresh the linked modems, then list everything Gene knows
    setAcsBusy(true); setAcsErr("");
    try { const { API } = await import("@/lib/connectbhai/api"); setAcs(await API.carePlanFetchAcs()); reload(); }
    catch (e) { setAcsErr((e && e.message) || "Could not reach Gene."); }
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
        <header className="pt-head"><div><h1>Care plan</h1><p>Your router, Wi-Fi and connection health, reported by Gene, your personal assistant.</p></div></header>
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
      <header className="pt-head"><div><h1>Care plan</h1><p>{role === "admin" ? "Every customer router / ONT reported by Gene, your personal assistant." : "Routers / ONTs of your customers, reported by Gene, your personal assistant."}</p></div>
        {role === "admin" && <button type="button" className="cu-btn cu-btn-primary" onClick={fetchAcs} disabled={acsBusy}><RefreshCw aria-hidden="true" />{acsBusy ? "Fetching…" : "Fetch from Gene"}</button>}
      </header>
      {role === "admin" && acsErr && <p className="pt-muted" role="alert">{acsErr}</p>}
      {role === "admin" && acs && (
        <Card title={`Modems in Gene (${acs.total})`} Icon={Router}>
          {acs.mock ? <p className="pt-muted">Gene is not connected on this server (mock mode), so there is nothing to list.</p>
            : acs.items.length ? (
              <div className="pt-table cp-table" role="table" aria-label="Modems in Gene">
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
            ) : <p className="pt-muted">Gene has no modems yet. A modem appears here after it checks in.</p>}
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
                <span role="cell" data-l="Status"><Chip label={d.status === "online" ? "Online" : d.status === "unknown" ? "Not reported" : "Offline"} tone={d.status === "online" ? "green" : d.status === "unknown" ? "grey" : "red"} />{d.live === false && <small className="cp-sn" title="Not a live reading yet: shows Live once the modem reports through Gene, your personal assistant">Simulated</small>}</span>
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
/* Device actions in the Care plan list: Refresh, Router test, Restart and Wi-Fi change.
   Every action opens the same step-by-step progress box the customer sees (command sent, modem picks it up, applying,
   done) with a timer, and restart / Wi-Fi follow the saved command on the server until it is done or failed. */
const STEPS = {
  refresh: ["Asking the modem for its status", "Modem answered", "Status updated"],
  test: ["Command sent", "Modem is testing the line (up to 5 minutes)", "Result ready"],
  reboot: ["Command sent", "Waiting for the modem to pick it up (about a minute)", "Modem is restarting (about 2 minutes)", "Modem is back online"],
  wifi: ["Command sent", "Waiting for the modem to pick it up (about a minute)", "Applying the new Wi-Fi settings", "Wi-Fi is updated"],
};
const HEAD = { refresh: ["Refreshing status", "Status refreshed"], test: ["Testing the line speed", "Speed test finished"], reboot: ["Restarting the modem", "Restart finished"], wifi: ["Changing the Wi-Fi", "Wi-Fi changed"] };
const mmss = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

function Progress({ job, onClose }) {
  const [sec, setSec] = useState(0);
  const running = job.state === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSec(Math.round((Date.now() - job.t0) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running, job.t0]);
  const steps = STEPS[job.kind], done = job.state === "done", bad = job.state === "failed" || job.state === "timeout";
  const step = done ? steps.length : job.step;
  return (
    <div className={`cp-prog ${done ? "is-ok" : bad ? "is-bad" : ""}`} role="status" aria-live="polite">
      <div className="cp-prog-h"><b>{done ? HEAD[job.kind][1] : job.state === "failed" ? "Could not finish" : job.state === "timeout" ? "Still waiting for the modem" : HEAD[job.kind][0]}</b>
        {running ? <span className="cp-prog-t">{mmss(sec)}</span> : <button type="button" className="cp-prog-x" onClick={onClose} aria-label="Close status"><X aria-hidden="true" /></button>}</div>
      <ul>{steps.map((t, i) => {
        const ok = i < step, cur = running && i === step, x = bad && i === step;
        return <li key={t} className={ok ? "ok" : cur ? "cur" : x ? "bad" : ""}><span className="cp-prog-d">{ok ? <Check aria-hidden="true" /> : x ? <X aria-hidden="true" /> : cur ? <i className="cp-prog-spin" /> : i + 1}</span><span>{t}</span></li>;
      })}</ul>
      {job.note ? <p className="cp-prog-n">{job.note}</p> : null}
    </div>
  );
}

function CpModal({ title, sub, locked, onClose, children }) {
  useEffect(() => {
    const k = e => { if (e.key === "Escape" && !locked) onClose(); };
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }, [locked, onClose]);
  return createPortal(
    <div className="cp-modal" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !locked) onClose(); }}>
      <div className="cp-dlg" role="dialog" aria-modal="true" aria-label={title}>
        <div className="cp-dlg-h"><div><h3>{title}</h3><small>{sub}</small></div>{!locked && <button type="button" className="cp-prog-x" onClick={onClose} aria-label="Close"><X aria-hidden="true" /></button>}</div>
        {children}
      </div>
    </div>, document.body);
}

function ActBtn({ Icon, label, off, why, running, tone = "", onClick, on }) {
  return <button type="button" className={`cp-act ${tone} ${on ? "is-on" : ""}`} disabled={off || running} title={off && why ? `${label}: ${why}` : label} aria-label={label} onClick={onClick}><Icon aria-hidden="true" /><span>{label}</span></button>;
}

function DeviceActs({ d, onDone }) {
  const [job, setJob] = useState(null), [panel, setPanel] = useState(null), [ssid, setSsid] = useState(""), [pw, setPw] = useState(""), [formErr, setFormErr] = useState("");
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const running = !!job && job.state === "running";
  const linked = d.linked !== false, online = d.status === "online", ready = linked && d.active !== false && online;
  const why = !linked ? "Not linked to Gene yet" : d.active === false ? "Care plan is not active" : !online ? "Modem must be online" : "";
  const patch = p => alive.current && setJob(j => (j ? { ...j, ...p } : j));
  const start = (kind, note) => { setPanel("progress"); setFormErr(""); setJob({ kind, state: "running", step: 1, t0: Date.now(), note: note || "" }); };

  const run = async (kind, extra) => {
    start(kind, kind === "reboot" ? "Internet and Wi-Fi at the customer's home are off for about 2 minutes." : kind === "wifi" ? "Phones and laptops on this Wi-Fi will disconnect for about a minute." : "");
    try {
      const { API } = await import("@/lib/connectbhai/api");
      if (kind === "refresh") {
        const r = await API.deviceRefresh(d.id);
        patch({ state: "done", note: r.state === "online" ? "The modem is online." : r.state === "offline" ? "The modem is offline." : "The modem has not reported yet." }); onDone && onDone();
      } else if (kind === "test") {
        patch({ step: 1 });
        const t = await API.deviceRouterTest(d.id);
        patch({ state: "done", note: `${Number(t.download_mbps).toFixed(1)} Mbps line speed${t.is_simulated ? " (simulated)" : ""}.` }); onDone && onDone();
      } else {
        if (typeof API.deviceActById !== "function") throw new Error("This action is not available in demo mode.");
        await API.deviceActById(d.id, kind === "reboot" ? "reboot" : "change_wifi", kind === "wifi" ? { ssid: extra.ssid || undefined, password: extra.password || undefined } : undefined);
        if (kind === "wifi") { setSsid(""); setPw(""); }
        const t0 = Date.now(); let st = "queued";
        while (alive.current && st !== "done" && st !== "failed") {
          await new Promise(r => setTimeout(r, 4000));
          if (Date.now() - t0 > 25 * 60 * 1000) { patch({ state: "timeout", note: "The modem has not checked in. It will apply this when it is back online." }); return; }
          try {
            const a = (await API.deviceActsById(d.id)).find(x => x.action === kind);
            if (a) { st = a.status === "done" ? "done" : a.status === "failed" ? "failed" : a.status === "sent" ? "sent" : "queued"; if (st === "failed") patch({ state: "failed", note: a.error || "The modem did not accept it. Please try again." }); else patch({ step: st === "sent" ? 2 : st === "done" ? 3 : 1 }); }
          } catch (e) { /* keep waiting; the next poll tries again */ }
        }
        if (st === "done") { patch({ state: "done", note: kind === "wifi" ? `Customer can join ${extra.ssid ? extra.ssid : "the Wi-Fi"}${extra.password ? " with the new password" : ""}.` : "The internet is back." }); onDone && onDone(); }
      }
    } catch (e) { patch({ state: "failed", note: (e && e.message) || "Could not reach the modem. Try again." }); }
  };

  return (
    <span className="cp-actbox">
      <span className="cp-btns">
        <ActBtn Icon={RefreshCw} label="Refresh" off={!linked} why={why} running={running} onClick={() => run("refresh")} />
        <ActBtn Icon={Gauge} label="Router test" off={!ready} why={why} running={running} onClick={() => run("test")} />
        <ActBtn Icon={Power} label="Restart" off={!ready} why={why} running={running} tone="cp-warn" onClick={() => setPanel("confirm")} />
        <ActBtn Icon={Wifi} label="Wi-Fi" off={!ready} why={why} running={running} onClick={() => setPanel("wifi")} />
      </span>
      {panel && <CpModal title={panel === "confirm" ? "Restart modem?" : panel === "wifi" ? "Change Wi-Fi name / password" : ({ refresh: "Refreshing status", test: "Router speed test", reboot: "Restarting the modem", wifi: "Changing the Wi-Fi" })[job ? job.kind : "refresh"]}
        sub={`${d.customer.name} · ${d.model || "Modem"} ${d.serialNumber || ""}`} locked={running} onClose={() => { setPanel(null); if (!running) setJob(null); }}>
        {panel === "confirm" && (
          <>
            <p className="cp-mp">Internet and Wi-Fi at the customer&apos;s home will be off for about 2 minutes while the modem restarts. Phones and laptops reconnect by themselves.</p>
            <div className="cp-mrow"><button type="button" className="cp-act cp-danger cp-big" onClick={() => run("reboot")}><Power aria-hidden="true" />Restart now</button><button type="button" className="cp-act cp-big" onClick={() => setPanel(null)}>Cancel</button></div>
          </>
        )}
        {panel === "wifi" && (
          <form className="cp-wifi" onSubmit={e => { e.preventDefault(); if (!ssid && !pw) { setFormErr("Enter a new Wi-Fi name, a password, or both."); return; } if (pw && pw.length < 8) { setFormErr("The password needs at least 8 characters."); return; } run("wifi", { ssid, password: pw }); }}>
            <p className="cp-mp">Every phone and laptop on this Wi-Fi will disconnect. After about a minute they can join the new name with the new password.</p>
            <label><span>New Wi-Fi name</span><input value={ssid} onChange={e => setSsid(e.target.value)} placeholder={d.wifi && d.wifi.ssid ? d.wifi.ssid : "Wi-Fi name"} autoComplete="off" maxLength={32} /></label>
            <label><span>New password</span><input type="text" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 8 characters" autoComplete="off" maxLength={63} /></label>
            {formErr && <small className="cp-formerr" role="alert">{formErr}</small>}
            <div className="cp-mrow"><button type="submit" className="cp-act cp-go cp-big">Save Wi-Fi</button><button type="button" className="cp-act cp-big" onClick={() => setPanel(null)}>Cancel</button></div>
          </form>
        )}
        {panel === "progress" && job && <Progress job={job} onClose={() => { setPanel(null); setJob(null); }} />}
      </CpModal>}
      {!panel && why ? <small className="cp-msg cp-sn">{why}</small> : null}
    </span>
  );
}

function facts(d) {
  return [["Status", d.status === "online" ? "Online" : "Offline"], ["Wi-Fi speed", d.wifi.speedMbps ? `${d.wifi.speedMbps} Mbps` : "—"], ["Signal", d.signal.rxPowerDbm != null ? `${d.signal.quality} (${d.signal.rxPowerDbm} dBm)` : "No signal"],
    ["Last seen", ago(d.lastInform)], ["Model", `${d.manufacturer} ${d.model}`], ["Serial number", d.serialNumber], ["SSID", `${d.wifi.ssid} · ${d.wifi.band}, ch ${d.wifi.channel}`],
    ["Connected devices", d.wifi.connectedDevices], ["Uptime", up(d.uptimeSeconds)], ["IP address", d.ip || "—"], ["Firmware", d.firmwareVersion]];
}
