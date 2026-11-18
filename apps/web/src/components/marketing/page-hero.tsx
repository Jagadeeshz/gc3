import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BookDemoTrigger } from './book-demo';

/**
 * The header band shared by the secondary marketing pages.
 *
 * Same rhythm as the home hero — eyebrow, display headline, one paragraph, at most
 * two actions — so a reader moving between pages never re-learns the layout.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  primary,
  secondary,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly lede: string;
  readonly primary?: { label: string; href: string } | 'demo';
  readonly secondary?: { label: string; href: string };
}) {
  return (
    <header className="relative overflow-hidden border-b border-hairline bg-obsidian">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="blueprint absolute inset-0 opacity-[0.12]" />
        <div className="absolute -left-[12%] top-[-40%] size-[46vw] rounded-full opacity-70 blur-[100px] [background:radial-gradient(circle_at_center,rgba(0,221,170,0.14),transparent_70%)]" />
      </div>

      <div className="shell relative py-14 sm:py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">{eyebrow}</p>
        <h1 className="mt-4 max-w-[24ch] font-display text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1.03] tracking-[-0.03em] text-ghost">
          {title}
        </h1>
        <p className="mt-5 max-w-[62ch] text-[14.5px] leading-[1.8] text-ghost-muted">{lede}</p>

        {primary || secondary ? (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {primary === 'demo' ? <BookDemoTrigger label="Book a demo" /> : null}
            {primary && primary !== 'demo' ? (
              <Link
                href={primary.href}
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(120deg,#F2D582_0%,#C9911A_52%,#8B6410_100%)] px-5 py-2.5 text-[13px] font-semibold text-[#080B12] transition-[filter] hover:brightness-[1.08]"
              >
                {primary.label}
                <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={2} />
              </Link>
            ) : null}
            {secondary ? (
              <Link
                href={secondary.href}
                className="inline-flex items-center gap-2 rounded-full border border-ghost/25 px-5 py-2.5 text-[13px] font-medium text-ghost transition-colors hover:border-ghost/55"
              >
                {secondary.label}
                <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.9} />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
