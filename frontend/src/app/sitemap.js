import { SITE_URL, IS_PRODUCTION } from "@/lib/site";

/* Public routes only. Update `modified` when a page's content changes. Plans and cities come from the API behind login views, so they have no public URLs yet. */
const ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1, modified: "2026-11-18" },
  { path: "/care", changeFrequency: "monthly", priority: 0.8, modified: "2026-11-18" },
  { path: "/speed", changeFrequency: "monthly", priority: 0.7, modified: "2026-11-18" },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3, modified: "2026-11-14" },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3, modified: "2026-11-14" },
  { path: "/refund", changeFrequency: "yearly", priority: 0.3, modified: "2026-11-14" },
  { path: "/shipping", changeFrequency: "yearly", priority: 0.3, modified: "2026-11-14" },
  { path: "/delete-account", changeFrequency: "yearly", priority: 0.2, modified: "2026-11-14" },
];

export default function sitemap() {
  if (!IS_PRODUCTION) return [];
  return ROUTES.map(({ path, modified, ...rest }) => ({ url: `${SITE_URL}${path === "/" ? "" : path}`, lastModified: new Date(modified), ...rest }));
}
