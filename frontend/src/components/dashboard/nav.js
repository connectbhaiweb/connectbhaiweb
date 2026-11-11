import { House, Users, Wrench, User, Layers, Database, Ticket, CalendarDays, Headphones, ShieldCheck, CreditCard, Handshake, Radio, Building2, MapPin, IndianRupee, History, ChartNoAxesColumnIncreasing, UserCog, Settings } from "lucide-react";
import { ChatBubbles, WhatsAppOutline } from "./icons";

/* One entry per sidebar item, in the order of the design images.
   tab = URL segment (/my/<tab>); legacy views already exist for most of them.
   badge = how the live count (read from the page's own data) is shown: "new" | "pending" | "due" | "plain" | "dot-white" | "dot-red" | "dot-blue". */
export const ROLES = {
  customer: { base: "my", title: "Customer", items: [
    { tab: "bookings", label: "Bookings", short: "Bookings", Icon: CalendarDays, badge: "dot-white" },
    { tab: "support", label: "Complaints & requests", short: "Support", Icon: Headphones, badge: "dot-red" },
    { tab: "devices", label: "Care plan", short: "Care plan", Icon: ShieldCheck },
    { tab: "payments", label: "Payments", short: "Payments", Icon: CreditCard, badge: "due" },
    { tab: "chat", label: "Chat", short: "Chat", Icon: ChatBubbles, badge: "dot-blue" },
  ] },
  dsa: { base: "dsa", title: "DSA", items: [
    { tab: "home", label: "Home", Icon: House },
    { tab: "careplan", label: "Care plan", Icon: ShieldCheck },
    { tab: "leads", label: "Leads", Icon: Users, badge: "new" },
    { tab: "installs", label: "Installs", Icon: Wrench },
    { tab: "customers", label: "My customers", Icon: User },
    { tab: "commission", label: "Commission", Icon: Database },
    { tab: "tickets", label: "Tickets", Icon: Ticket },
    { tab: "chat", label: "Chat", Icon: ChatBubbles, badge: "dot-blue" },
  ] },
  tip: { base: "tip", title: "TIP", items: [
    { tab: "home", label: "Home", Icon: House },
    { tab: "careplan", label: "Care plan", Icon: ShieldCheck },
    { tab: "leads", label: "Leads", Icon: Users, badge: "new" },
    { tab: "bookings", label: "Installs", Icon: Wrench },
    { tab: "customers", label: "Customers", Icon: User, also: ["payments"] },
    { tab: "plans", label: "Plans (update sheet)", short: "Plans", Icon: Database },
    { tab: "tickets", label: "Tickets", Icon: Ticket },
    { tab: "chat", label: "Chat", Icon: ChatBubbles, badge: "dot-blue" },
  ] },
  admin: { base: "admin", title: "Administrator", items: [
    { tab: "overview", label: "Overview", Icon: House },
    { tab: "careplan", label: "Care plan", Icon: ShieldCheck },
    { tab: "leads", label: "Leads", Icon: Users, badge: "new" },
    { tab: "customers", label: "Customers", Icon: User },
    { tab: "partners", label: "DSA & TIP", Icon: Handshake, badge: "pending" },
    { tab: "team", label: "Team & logins", Icon: UserCog },
    { tab: "providers", label: "Providers", Icon: Radio },
    { tab: "plans", label: "Plans", Icon: Layers, badge: "pending" },
    { tab: "locations", label: "Locations", Icon: MapPin },
    { tab: "cities", label: "Cities & waiting list", short: "Cities", Icon: Building2, badge: "plain" },
    { tab: "billing", label: "Billing & fees", short: "Billing", Icon: CreditCard },
    { tab: "commissions", label: "DSA payouts", short: "Payouts", Icon: IndianRupee },
    { tab: "payments", label: "Payout history", short: "History", Icon: History },
    { tab: "chat", label: "Chat", Icon: ChatBubbles, badge: "dot-blue" },
    { tab: "messages", label: "WhatsApp log", short: "WhatsApp", Icon: WhatsAppOutline },
    { tab: "reports", label: "Reports", Icon: ChartNoAxesColumnIncreasing },
    { tab: "settings", label: "Settings", Icon: Settings },
  ] },
};
export const ROLE_BY_BASE = { my: "customer", dsa: "dsa", tip: "tip", admin: "admin" };
export const BADGE_TEXT = { new: n => `${n} new`, pending: n => `${n} pending`, due: n => `${n} due`, plain: n => String(n) };
export const FEES = { tip: ["payments", "Payments to Connect Bhai"] };   // a DSA pays nothing: only a commission after install
/* sidebar item that is active for a URL tab (fee pages sit under Commission / Customers) */
export const activeTab = (cfg, tab) => (cfg.items.find(i => i.tab === tab || (i.also || []).includes(tab)) || {}).tab;
export const hrefOf = (role, tab) => `/${ROLES[role].base}/${tab}`;
