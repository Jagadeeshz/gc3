import type { Metadata, Viewport } from 'next';
import { DM_Mono, DM_Sans, Inter } from 'next/font/google';
import { SessionProvider } from '@/lib/session-context';
import './globals.css';
import { GridBackground } from '@/components/site/grid-background';

/**
 * Type stack.
 *
 * Two families, split by job: DM Sans carries display type, headlines and KPI
 * figures (its geometry holds at 60px and at 28px); Inter carries every control,
 * table and paragraph, where the smaller x-height keeps dense screens readable.
 * Mono stays for labels and metadata.
 */
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
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
    <html lang="en" className={`${dmSans.variable} ${inter.variable} ${dmMono.variable}`}>
      <body className="min-h-dvh bg-void font-sans text-warm antialiased">
        {/* One fixed layer for the whole site: the architectural grid the surfaces sit on. */}
        <GridBackground />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
