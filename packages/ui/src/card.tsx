import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * Surface primitive. Dark cards use translucent graphite with a fine border
 * and restrained blur; light cards use mineral/ivory with an ink shadow.
 */
export type CardTone = 'graphite' | 'elevated' | 'mineral';

const TONE_CLASS: Record<CardTone, string> = {
  graphite:
    'bg-graphite/85 border-white/10 text-warm shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_24px_60px_-40px_rgba(0,0,0,0.9)]',
  elevated:
    'bg-graphite-elevated/90 border-white/15 text-warm shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]',
  mineral: 'bg-editorial border-stone text-ink shadow-[0_18px_44px_-32px_rgba(17,19,24,0.45)]',
};

/**
 * Rendered element is selectable so cards can be list items or sections.
 * Handlers are typed against the generic element to stay polymorphic.
 */
export interface CardProps extends HTMLAttributes<HTMLElement> {
  readonly tone?: CardTone;
  readonly as?: 'div' | 'section' | 'article' | 'li';
}

export function Card({ tone = 'graphite', as = 'div', className, children, ...rest }: CardProps) {
  const Element: ElementType = as;
  return (
    <Element
      className={cn(
        'rounded-[14px] border backdrop-blur-[2px]',
        'transition-colors duration-150 hover:border-gold/35',
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </Element>
  );
}

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold tracking-[-0.01em]', className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 py-4 text-sm leading-relaxed', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-3 px-5 pb-5', className)} {...rest}>
      {children}
    </div>
  );
}

/** Small label used for metadata — monospace only for short strings. */
export function MetaLabel({ children }: { readonly children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{children}</span>
  );
}
