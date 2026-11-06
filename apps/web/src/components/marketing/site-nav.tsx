'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

// The four acts are the navigation: the page is a story, so the menu is its table
// of contents. Anchors point at the act sections; pricing is a real route.
const NAV = [
  { href: '#act-problem', label: 'The problem' },
  { href: '#act-paradigm', label: 'What GC³ is' },
  { href: '#act-pods', label: 'Pods' },
  { href: '#act-engine', label: 'Engine' },
  { href: '/pricing', label: 'Pricing' },
] as const;

/**
 * Public site navigation. Two portal entry points are deliberate: `Client
 * Portal` is the low-key path for returning clients, `Portal Access` is the
 * primary conversion and both resolve to the authentication flow at /login.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Utility strip — mono metadata only, never a paragraph. */}
      <div className="border-b border-hairline/70 bg-obsidian">
        <div className="shell flex h-9 items-center justify-between gap-4">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted">
            Quantocos GC³ <span className="text-hairline">|</span> Global Cloud Capability Center
          </p>
          <p className="hidden shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-400/80" aria-hidden="true" />
            Portal live · governed delivery
          </p>
        </div>
      </div>

      <header
        className={[
          'sticky top-0 z-50 border-b bg-obsidian/85 backdrop-blur-xl transition-colors duration-300',
          lifted ? 'border-hairline shadow-[0_18px_40px_-32px_rgba(0,0,0,0.9)]' : 'border-transparent',
        ].join(' ')}
      >
        <div className="shell flex h-[72px] items-center justify-between gap-3 sm:gap-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5 sm:gap-3" aria-label="Quantocos GC³ home">
            <span className="grid size-9 place-items-center rounded-[10px] border border-gold/35 bg-gold/10 font-display text-base font-semibold text-gold-light transition-colors duration-200 group-hover:border-gold/60">
              Q
            </span>
            <span className="leading-none">
              <span className="block whitespace-nowrap font-display text-[15px] tracking-[-0.01em] text-ghost sm:text-[17px]">
                Quantocos <span className="text-gold-light">GC³</span>
              </span>
              <span className="mt-1 hidden font-mono text-[9px] uppercase tracking-[0.18em] text-ghost-muted sm:block">
                Capability, composed
              </span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="relative py-2 text-[13px] text-ghost-muted transition-colors duration-200 hover:text-ghost after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-left after:scale-x-0 after:bg-gold/70 after:transition-transform after:duration-300 hover:after:scale-x-100"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden text-[13px] text-ghost-muted transition-colors duration-200 hover:text-ghost sm:block"
            >
              Client Portal
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-gold-deep/40 bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] px-3 text-[12.5px] font-medium text-ink shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_10px_28px_-16px_rgba(217,182,93,0.7)] transition-[filter,transform] duration-200 hover:brightness-105 active:translate-y-px sm:px-4 sm:text-[13px]"
            >
              Portal Access
            </Link>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="grid size-11 place-items-center rounded-[10px] border border-hairline text-ghost transition-colors duration-200 hover:border-gold/40 lg:hidden"
            >
              {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div id="mobile-nav" className="fixed inset-x-0 bottom-0 top-[72px] z-40 overflow-y-auto border-t border-hairline bg-obsidian/98 backdrop-blur-xl lg:hidden">
          <nav aria-label="Mobile" className="shell flex flex-col py-4">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between border-b border-hairline/60 py-4 text-[15px] text-ghost transition-colors hover:text-gold-light"
              >
                {item.label}
                <span aria-hidden="true" className="font-mono text-[10px] text-ghost-muted">
                  →
                </span>
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[10px] border border-hairline px-4 text-sm text-ghost"
            >
              Client Portal
            </Link>
          </nav>
        </div>
      ) : null}
    </>
  );
}
