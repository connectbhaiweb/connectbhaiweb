import { SITE_URL, IS_PRODUCTION } from "@/lib/site";

/* Private areas stay out of search on every environment. */
const PRIVATE = ["/my", "/dsa", "/tip", "/admin", "/ui-kit"];
/* Search and AI crawlers named on purpose. A crawler follows only its own group, so each repeats the private paths. */
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

export default function robots() {
  if (!IS_PRODUCTION) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_BOTS.map(userAgent => ({ userAgent, allow: "/", disallow: PRIVATE })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
