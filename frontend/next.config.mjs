const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.connectbhai.com").replace(/\/+$/, "");
const IS_PRODUCTION = process.env.NEXT_PUBLIC_ENV === "production";
const OLD_HOSTS = ["connectbhai.in", "www.connectbhai.in"];
const PRIVATE_ROUTES = "/(my|dsa|tip|admin)";
const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

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
      /* Staging, preview and an unset NEXT_PUBLIC_ENV: keep every page out of search engines. */
      ...(IS_PRODUCTION ? [] : [{ source: "/:path*", headers: NOINDEX }]),
      /* Dashboards and logins are private on every environment. */
      { source: PRIVATE_ROUTES, headers: NOINDEX },
      { source: `${PRIVATE_ROUTES}/:path*`, headers: NOINDEX },
    ];
  },
};
export default nextConfig;
