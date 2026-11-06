import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source; Next compiles them in-place.
  transpilePackages: ['@gc3/ui', '@gc3/types', '@gc3/validation'],
  typedRoutes: true,

  /**
   * HTML is never cached; hashed assets always are.
   *
   * Next's default for a prerendered page is `s-maxage=31536000`. That is right for
   * a CDN and wrong for a browser: after a rebuild the page keeps its old markup and
   * requests chunks that no longer exist, so the site "does not update" until someone
   * hard-refreshes. A one-year cache on a document that changes every deploy is a bug
   * that presents as a broken deploy.
   *
   * `/_next/static` keeps immutable caching — those filenames carry content hashes,
   * so a stale entry is impossible by construction.
   */
  async headers() {
    return [
      {
        source: '/:path((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      },
    ];
  },
};

export default nextConfig;
