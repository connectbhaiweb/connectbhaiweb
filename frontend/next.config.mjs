const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.connectbhai.com").replace(/\/+$/, "");
const IS_PRODUCTION = process.env.NEXT_PUBLIC_ENV === "production";
const OLD_HOSTS = ["connectbhai.in", "www.connectbhai.in"];
const PRIVATE_ROUTES = "/(my|dsa|tip|admin)";
const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
/* Safe-by-default security headers. No CSP on purpose: the legacy views and payment scripts need a tested policy first.
   HSTS is production only, so a staging host without HTTPS is not locked out. */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ...(IS_PRODUCTION ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/router", destination: "/care", permanent: true },
      /* Old domain: every path goes to the same path on the main site. */
      ...OLD_HOSTS.map(host => ({ source: "/:path*", has: [{ type: "host", value: host }], destination: `${SITE_URL}/:path*`, permanent: true })),
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      /* Staging, preview and an unset NEXT_PUBLIC_ENV: keep every page out of search engines. */
      ...(IS_PRODUCTION ? [] : [{ source: "/:path*", headers: NOINDEX }]),
      /* Dashboards and logins are private on every environment. */
      { source: PRIVATE_ROUTES, headers: NOINDEX },
      { source: `${PRIVATE_ROUTES}/:path*`, headers: NOINDEX },
    ];
  },
};
export default nextConfig;
