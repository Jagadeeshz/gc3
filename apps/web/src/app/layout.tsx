import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, DM_Mono, DM_Sans } from 'next/font/google';
import { SessionProvider } from '@/lib/session-context';
import './globals.css';
import { GridBackground } from '@/components/site/grid-background';

/**
 * Type stack — BINDU v4 brand stack, verbatim.
 *
 * Display: Cormorant Garamond 700. Body: DM Sans (300 light / 400 / 500 label /
 * 600 strong). Mono: DM Mono 400/500. Weight is the only variable in this
 * system, so the families do not get substituted.
 */
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GC3 Portal — Foundation',
  description:
    'GC³ Portal: the operating platform for Global Cloud Capability & Consulting — client portal, delivery operations, pods and AI-augmented workflows.',
  applicationName: 'GC3 Portal',
};

export const viewport: Viewport = {
  themeColor: '#0d0c11',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <body className="min-h-dvh bg-void font-sans text-warm antialiased">
        {/* One fixed layer for the whole site: the architectural grid the surfaces sit on. */}
        <GridBackground />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
