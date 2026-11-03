/* Numbers for the partner and admin dashboards, computed from the same records the old views use. */
export const inr = n => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
export const sum = (a, f) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);
export const mKey = iso => (iso || "").slice(0, 7);
export function monthKeys(n) {
  const d = new Date(), a = [];
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); a.push(x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")); }
  return a;
}
export const mLabel = k => new Date(k + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });
export const fDate = d => (d ? `${new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${new Date(d).getFullYear()}` : "—");
export const fDay = d => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—");
export function fWhen(iso, withTime) {
  if (!iso) return "—";
  const day = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso), t = new Date(); t.setHours(0, 0, 0, 0);
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0);
  const diff = Math.round((d0 - t) / 864e5), name = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : fDay(day);
  return withTime && iso.length > 10 ? `${name}, ${day.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()}` : name;
}
export const planName = p => (p ? [p.provider && p.provider.name, p.name, p.speed_mbps ? p.speed_mbps + " Mbps" : ""].filter(Boolean).join(" ") : "No plan chosen (callback)");
export const planPrice = p => (p ? `${inr(p.price_monthly)}${p.category === "sim_prepaid" ? "" : "/month"} + GST` : "");
export const OPEN = ["new", "assigned", "contacted", "follow_up", "booked"];

/* leads vs installs per month */
export function byMonth(n, leads, leadDate, installs, installDate) {
  return monthKeys(n).map(k => ({ label: mLabel(k), leads: leads.filter(l => mKey(leadDate(l)) === k).length, installs: installs.filter(b => mKey(installDate(b)) === k).length }));
}
export function partnerStats(p, leads, bookings, comms) {
  const isT = p.type === "tip", cur = monthKeys(1)[0];
  const mine = leads.filter(l => (isT ? l.assigned_tip_id : l.assigned_dsa_id) === p.id);
  const given = isT ? mine : mine.filter(l => l.source !== "dsa");
  const inst = bookings.filter(b => b.status === "installed" && (isT ? b.tip_partner_id : b.dsa_partner_id) === p.id);
  const closed = mine.filter(l => ["installed", "lost"].includes(l.status)).length, won = mine.filter(l => l.status === "installed").length;
  const cm = comms.filter(c => c.status !== "rejected");
  return {
    mine, given, inst, cur, conv: closed ? Math.round(won / closed * 100) : 0,
    givenMonth: given.filter(l => mKey(l.assigned_at || l.created_at) === cur).length,
    instMonth: inst.filter(b => mKey(b.installed_at) === cur).length,
    comm: { all: sum(cm, c => c.amount), pending: sum(cm.filter(c => c.status === "pending"), c => c.amount), approved: sum(cm.filter(c => c.status === "approved"), c => c.amount), paid: sum(cm.filter(c => c.status === "paid"), c => c.amount) },
    billing: sum(inst, b => (b.plan ? b.plan.price_monthly : 0)),
  };
}
