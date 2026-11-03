/* Display helpers for the customer dashboard (pure, SSR-safe). */
export const inr = n => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const D = d => (d instanceof Date ? d : new Date(d));
export const fDay = d => (d ? D(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
export const fDate = d => (d ? `${fDay(d)}, ${D(d).getFullYear()}` : "—");
export const fTime = d => D(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase().replace(/\s+/g, " ");
export const fDayTime = d => (d ? `${fDay(d)}, ${fTime(d)}` : "");

/* "tomorrow" / "today" / "25 Oct" for a YYYY-MM-DD date */
export function fWhen(iso) {
  if (!iso) return "";
  const day = new Date(iso.slice(0, 10) + "T00:00:00"), t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((day - t) / 864e5);
  return diff === 0 ? "today" : diff === 1 ? "tomorrow" : fDay(day);
}

export const planTitle = p => (p ? [p.provider && p.provider.name, p.name, p.speed_mbps ? p.speed_mbps + " Mbps" : ""].filter(Boolean).join(" ") : "No plan chosen yet");
export const planPrice = p => (p ? `${inr(p.price_monthly)}${p.category === "sim_prepaid" ? "" : "/month"} + GST` : "We will call you with plans");

const SIMPLE = ["sim", "ott"];
const productOf = cat => (["sim_prepaid", "sim_postpaid"].includes(cat) ? "sim" : cat === "fiber" || !cat ? "broadband" : cat);
export const leadProduct = l => l.product || productOf(l.plan && l.plan.category);

/* The 5 tracker steps (same wording as the old tracker, incl. SIM / OTT variants). */
export function steps(product) {
  return [["new", "Requested"], ["assigned", "Assigned"], ["contacted", "Contacted"],
    ["booked", SIMPLE.includes(product) ? (product === "sim" ? "KYC & delivery" : "Confirming") : "Booked"],
    ["installed", SIMPLE.includes(product) ? "Activated" : "Installed"]];
}
export const STEP_OF = { new: 0, assigned: 1, contacted: 2, follow_up: 2, booked: 3, installed: 4 };

/* Status chip for a lead: label + tone */
export function leadChip(status, product) {
  const simple = SIMPLE.includes(product);
  return ({
    new: ["Request received", "blue"], assigned: ["Agent assigned", "blue"], contacted: ["Agent in touch", "blue"], follow_up: ["Follow-up planned", "amber"],
    booked: [simple ? "Activation in progress" : "Installation in progress", "blue"], installed: [simple ? "Activated" : "Installed", "green"], lost: ["Lost", "red"],
  })[status] || [status, "blue"];
}
export const fmtPhone = p => (p ? "+91 " + String(p).replace(/^(\d{5})(\d{5})$/, "$1 $2") : "");
export const waLink = (phone, text) => `https://wa.me/91${phone}${text ? "?text=" + encodeURIComponent(text) : ""}`;
export const cityOf = pin => (/^452/.test(String(pin || "")) ? "Indore" : "");
