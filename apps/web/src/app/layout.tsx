import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Plus_Jakarta_Sans, Source_Serif_4 } from 'next/font/google';
import './globals.css';

/**
 * Brand type stack (01-brand-and-design-system): serif display, geometric sans
 * for body and controls, mono reserved for labels and metadata.
 */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-serif',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
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
    <html lang="en" className={`${plusJakarta.variable} ${sourceSerif.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh bg-void font-sans text-warm antialiased">{children}</body>
    </html>
  );
}
