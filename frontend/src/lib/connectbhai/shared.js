/* Small pure helpers shared by React components and the legacy UI module. SSR-safe. */
export const ROLE_HOME = { customer: "my", dsa: "dsa", tip: "tip", admin: "admin" };
export const ROLE_NAME = { customer: "Customer", dsa: "DSA", tip: "TIP partner", admin: "Administrator" };
export const ROLE_NAV_LABEL = { customer: "My dashboard", dsa: "DSA portal", tip: "TIP portal", admin: "Admin portal" };
export const VIEWS = ["home", "speed", "router", "my", "dsa", "tip", "admin"];

export const initials = s => String(s || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");

/* view + tab  →  URL path.  Old hash URLs (#my-bookings) became real routes (/my/bookings). */
export const pathFor = (view, tab) => (view === "home" ? "/" : "/" + view + (tab ? "/" + encodeURIComponent(tab) : ""));

export function viewFromPath(pathname) {
  const seg = String(pathname || "/").split("/")[1] || "home";
  return VIEWS.includes(seg) ? seg : "home";
}

/* "#my-bookings" → { view: "my", tab: "bookings" } (legacy links); null when the hash is not an old route. */
export function parseLegacyHash(hash) {
  const [v, t] = String(hash || "").replace("#", "").split("-");
  return VIEWS.includes(v) ? { view: v, tab: t || null } : null;
}
