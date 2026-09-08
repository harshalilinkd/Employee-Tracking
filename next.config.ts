import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // typedRoutes is off deliberately: filter state lives in the URL (SPEC §9.4),
  // so routes are built as dynamic query strings that a literal route union
  // cannot express without casting at every call site.
}

export default nextConfig
