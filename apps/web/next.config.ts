import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source; Next compiles them in-place.
  transpilePackages: ['@gc3/ui', '@gc3/types', '@gc3/validation'],
  typedRoutes: true,
};

export default nextConfig;
