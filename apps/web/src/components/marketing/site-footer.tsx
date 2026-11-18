import Link from 'next/link';
import { QuantocosMark } from '@/components/brand/quantocos-mark';

/**
 * The site footer, shared by every page.
 *
 * The supplied avatar artwork is the ground: it sits behind the link columns at
 * low opacity with a radial mask, so the mark is present without competing with
 * the text on top of it. It is decorative (`aria-hidden`), never the only place
 * the brand appears, and it is only loaded once per page.
 */

const COLUMNS = [
  {
    heading: 'Pods',
    links: [
      { label: 'Creative', href: '/pods' },
      { label: 'Growth', href: '/pods' },
      { label: 'Strategy', href: '/pods' },
      { label: 'Automation', href: '/pods' },
      { label: 'Interactive', href: '/pods' },
      { label: 'REMAU', href: '/pods' },
    ],
  },
  {
    heading: 'Platform',
    links: [
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Why a pod', href: '/why-a-pod' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Book a demo', href: '/#contact' },
    ],
  },
  {
    heading: 'Portal',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Client workspace', href: '/login' },
      { label: 'Support', href: '/support' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-hairline bg-obsidian">
      {/* The supplied mark, as the ground. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <img
          src="/brand/quantocos-avatar.png"
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute -bottom-24 right-6 size-[360px] opacity-[0.22] [mask-image:radial-gradient(circle_at_center,black_46%,transparent_74%)] sm:right-16 sm:size-[420px]"
        />
        <div className="absolute inset-0 [background:linear-gradient(180deg,rgba(8,11,18,0.92)_0%,rgba(8,11,18,0.75)_55%,rgba(8,11,18,0.95)_100%)]" />
      </div>

      <div className="shell relative grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(3,minmax(0,0.6fr))]">
        <div>
          <Link href="/" aria-label="Quantocos home" className="inline-flex">
            <QuantocosMark size="lg" />
          </Link>
          <p className="mt-4 max-w-[34ch] text-[12px] leading-[1.7] text-ghost-muted">
            GC³ composes one pod around one outcome and sells it on one subscription: a standing team, a
            published credit pool, and no procurement between you and the work.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
              {column.heading}
            </p>
            <ul className="mt-3 grid gap-1.5">
              {column.links.map((link) => (
                <li key={`${column.heading}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="text-[12px] text-ghost-muted transition-colors hover:text-ghost"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="shell relative flex flex-wrap items-center justify-between gap-3 border-t border-hairline py-5 pr-0 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted sm:pr-36">
        <span>© 2026 Quantocos · GC³ is a capability pod platform</span>
        <span>Prices in USD · published, not quoted</span>
      </div>
    </footer>
  );
}
