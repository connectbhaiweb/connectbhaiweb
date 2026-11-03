"use client";
import { useId } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, MapPin, Phone } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WaGlyph } from "@/components/customer/art";
import { waLink } from "@/components/customer/format";

/* Building blocks shared by the DSA, TIP and Admin dashboards (design images at 1672 px). */
export function PortalHead({ title, sub, pins }) {
  return (
    <header className="pt-head">
      <div><h1>{title}</h1><p>{sub}</p></div>
      {pins ? <span className="pt-pins"><MapPin aria-hidden="true" />Service PINs: {pins}</span> : null}
    </header>
  );
}

export function Kpi({ tone, Icon, label, value, sub, up }) {
  return (
    <div className={`pt-kpi tone-${tone}`}>
      <span className="pt-kpi-ico"><Icon aria-hidden="true" /></span>
      <div className="pt-kpi-txt"><span>{label}</span><b>{value}</b>{sub ? <small className={up ? "is-up" : ""}>{up ? <i className="pt-up" aria-hidden="true" /> : null}{sub}</small> : null}</div>
    </div>
  );
}

export function Card({ title, Icon, action, className = "", children, id }) {
  const hid = useId();
  return (
    <section className={`pt-card ${className}`} aria-labelledby={id || hid}>
      <div className="pt-card-head"><h2 id={id || hid}>{Icon ? <Icon aria-hidden="true" /> : null}{title}</h2>{action}</div>
      {children}
    </section>
  );
}
export const More = ({ href, children }) => <Link className="pt-more" href={href}>{children}<ArrowRight aria-hidden="true" /></Link>;

export function Period({ value, onChange }) {
  return (
    <label className="pt-period"><span className="pt-sr">Chart period</span>
      <select value={value} onChange={e => onChange(Number(e.target.value))}>
        <option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option>
      </select><ChevronDown aria-hidden="true" />
    </label>
  );
}

export const CHIP = {
  new: ["New", "blue"], assigned: ["Assigned", "blue"], contacted: ["Contacted", "amber"], follow_up: ["Follow-up", "amber"], booked: ["Booked", "blue"], installed: ["Installed", "green"], lost: ["Lost", "red"],
  scheduled: ["Scheduled", "blue"], in_progress: ["Installation in progress", "amber"], cancelled: ["Cancelled", "red"],
  paid: ["Paid", "green"], approved: ["Approved", "blue"], pending: ["Pending", "amber"], rejected: ["Rejected", "red"],
  open: ["Open", "red"], resolved: ["Resolved", "green"], closed: ["Closed", "grey"], live: ["Live", "green"], soon: ["Launching soon", "amber"], pending_review: ["Pending review", "amber"],
};
export function Chip({ s, label, Icon, tone }) {
  const [l, t] = CHIP[s] || [label || s, tone || "grey"];
  return <span className={`pt-chip tone-${tone || t}`}>{Icon ? <Icon aria-hidden="true" /> : null}{label || l}</span>;
}

const AV = ["#DCE8FE:#0A4AE1", "#E6E2FE:#5B3FD9", "#DCF3E2:#107422", "#FBE3F1:#B4247F", "#FFEBD5:#B25A00"];
export function Ava({ name }) {
  const ini = String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  const [bg, fg] = AV[[...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length].split(":");
  return <span className="pt-ava" style={{ background: bg, color: fg }} aria-hidden="true">{ini}</span>;
}
export const Pin = ({ children }) => <span className="pt-pin"><MapPin aria-hidden="true" />{children}</span>;

export function CallWa({ phone, name, text }) {
  if (!phone) return null;
  return (
    <span className="pt-cw">
      <a className="pt-ibtn is-call" href={`tel:+91${phone}`} aria-label={`Call ${name}`}><Phone aria-hidden="true" /></a>
      <a className="pt-ibtn is-wa" href={waLink(phone, text)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${name}`}><WaGlyph /></a>
    </span>
  );
}

/* Grouped bars, one group per month (Recharts). series: [{ key, name, color }] */
export function Bars({ data, series, legend = "right", height = 168 }) {
  return (
    <div className={`pt-chart legend-${legend}`} role="img" aria-label={series.map(s => `${s.name}: ${data.map(d => `${d.label} ${d[s.key]}`).join(", ")}`).join(". ")}>
      <div className="pt-plot"><ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: -22 }} barGap={0} barCategoryGap="22%">
          <defs>{series.map(s => <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity={1} /><stop offset="1" stopColor={s.color} stopOpacity={.82} /></linearGradient>)}</defs>
          <CartesianGrid vertical={false} stroke="#E6ECF6" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#9AA6BD" }} tick={{ fill: "#1E2A4A", fontSize: 13 }} interval={0} />
          <YAxis tickLine={false} axisLine={{ stroke: "#9AA6BD" }} tick={{ fill: "#1E2A4A", fontSize: 13 }} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(20,80,230,.06)" }} contentStyle={{ borderRadius: 10, border: "1px solid #DCE4F2", fontSize: 13 }} />
          {series.map(s => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={`url(#g-${s.key})`} radius={[6, 6, 0, 0]} maxBarSize={34} isAnimationActive={false}>
              <LabelList dataKey={s.key} position="top" style={{ fill: "#0B1640", fontSize: 13, fontWeight: 700 }} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer></div>
      {legend !== "none" && <div className={`pt-legend${legend === "bottom" ? " is-bottom" : ""}`} aria-hidden="true">{series.map(x => <span key={x.key}><i style={{ background: x.color }} />{x.name}</span>)}</div>}
    </div>
  );
}

export function Loading() {
  const b = (w, h) => <span className="sk" style={{ width: w, height: h, display: "block", borderRadius: 10, marginBottom: 12 }} aria-hidden="true" />;
  return <div className="pt" aria-busy="true">{b("32%", 34)}{b("50%", 16)}<div className="pt-kpis">{[1, 2, 3, 4].map(i => <div key={i} className="pt-kpi">{b("100%", 70)}</div>)}</div><div className="pt-card">{b("100%", 220)}</div></div>;
}
export function Failed({ error, retry }) {
  return <div className="pt"><div className="pt-card pt-error" role="alert"><b>Could not load this page.</b><p>{error}</p><button type="button" className="cu-btn cu-btn-primary" onClick={retry}>Try again</button></div></div>;
}
export const Counts = ({ c }) => <div hidden data-cb-counts>{Object.entries(c).map(([k, n]) => <span key={k} data-tab={k}><span className="cnt">{n}</span></span>)}</div>;
