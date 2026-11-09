import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, DM_Mono, DM_Sans } from 'next/font/google';
import { SessionProvider } from '@/lib/session-context';
import './globals.css';

/**
 * Brand type stack (01-brand-and-design-system): serif display, geometric sans
 * for body and controls, mono reserved for labels and metadata.
 */
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-source-serif',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GC3 Portal — Foundation',
  description:
    'GC³ Portal: the operating platform for Global Cloud Capability & Consulting — client portal, delivery operations, pods and AI-augmented workflows.',
  applicationName: 'GC3 Portal',
};

export const viewport: Viewport = {
  themeColor: '#07080B',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${cormorant.variable} ${dmMono.variable}`}>
      <body className="min-h-dvh bg-void font-sans text-warm antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
