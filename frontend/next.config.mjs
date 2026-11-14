/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/router", destination: "/care", permanent: true }];
  },
};
export default nextConfig;
