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
  backgroundSrc,
  backgroundMode = 'photo',
  plateSrc,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly lede: string;
  readonly primary?: { label: string; href: string } | 'demo';
  readonly secondary?: { label: string; href: string };
  /** When set, the band sits on this image instead of the blueprint grid. */
  readonly backgroundSrc?: string;
  /**
   * How the image should occupy the band. `photo` fills and crops, `art` holds the
   * whole drawing and lets it sit on the page colour (a transparent vector has no
   * edges to hide, so cropping it would only cut figures in half).
   */
  readonly backgroundMode?: 'photo' | 'art';
  /**
   * Renders the image as a lit plate standing in the band instead of as a flat
   * background — perspective, gold rim, its own shadow, and a slow float. Use this
   * for photography that should read as an object in the room.
   */
  readonly plateSrc?: string;
}) {
  return (
    <header className="relative overflow-hidden border-b border-hairline bg-obsidian">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {backgroundSrc ? (
          <>
            {/* The image is anchored right, so the copy keeps the darker left
                third to itself and the scrim only has to carry the middle. */}
            <div
              className={`${backgroundMode === 'art' ? 'hero-art' : 'hero-photo'} absolute inset-0`}
              style={{ backgroundImage: `url('${backgroundSrc}')` }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, #0d0c11 0%, rgba(13,12,17,0.94) 30%, rgba(13,12,17,0.6) 58%, rgba(13,12,17,0.35) 100%)',
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-40"
              style={{ background: 'linear-gradient(180deg, transparent, #0d0c11)' }}
            />
          </>
        ) : (
          <>
            <div className="blueprint absolute inset-0 opacity-[0.12]" />
            <div className="absolute -left-[12%] top-[-40%] size-[46vw] rounded-full opacity-70 blur-[100px] [background:radial-gradient(circle_at_center,rgba(0,221,170,0.14),transparent_70%)]" />
          </>
        )}
      </div>

      {plateSrc ? (
        <div aria-hidden="true" className="hero-plate-wrap">
          <div className="hero-plate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={plateSrc} alt="" />
            <span className="hero-plate__rim" />
          </div>
        </div>
      ) : null}

      <div className="shell relative py-14 sm:py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-gold-light)]">{eyebrow}</p>
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
                className="inline-flex items-center gap-2 rounded-full btn-gold px-5 py-2.5 text-[13px] font-semibold"
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
