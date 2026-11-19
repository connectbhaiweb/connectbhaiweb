/* One place for the public site URL, the environment flag and the shared SEO metadata. */

/* Public site URL without a trailing slash. Set NEXT_PUBLIC_SITE_URL in the hosting env (production: https://www.connectbhai.com). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.connectbhai.com").replace(/\/+$/, "");

/* Only NEXT_PUBLIC_ENV=production is indexable. Staging, preview and an unset value all get noindex. */
export const IS_PRODUCTION = process.env.NEXT_PUBLIC_ENV === "production";

export const SITE_NAME = "Connect Bhai";
export const SITE_TAGLINE = "Compare. Choose. Connect. Care.";
export const DEFAULT_DESCRIPTION =
  "Compare BSNL, Jio, Airtel and local ISP broadband plans by PIN code in Indore. Book a connection and get Connect Bhai Care.";

/* 1200x630 share image in /public (WhatsApp, Facebook, X). */
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "Connect Bhai: compare broadband plans in Indore" };

export const ROBOTS = IS_PRODUCTION ? { index: true, follow: true } : { index: false, follow: false };
export const NO_INDEX = { index: false, follow: false };

/* Per-page metadata: title (60 chars max), description (155 chars max), canonical path and Open Graph/Twitter.
   Next.js replaces openGraph and twitter per page instead of merging, so every page sets the full set here. */
export function pageMeta({ title, description = DEFAULT_DESCRIPTION, path = "/", noindex = false }) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    robots: noindex ? NO_INDEX : ROBOTS,
    openGraph: { title: fullTitle, description, url: path, siteName: SITE_NAME, type: "website", locale: "en_IN", images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [OG_IMAGE.url] },
  };
}
