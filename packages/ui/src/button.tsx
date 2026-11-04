import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * Button variants follow the GC3 brand rules (#01-brand-and-design-system):
 * gold is reserved for authority and primary actions; secondary surfaces stay
 * smoked or mineral. Minimum touch target is 44x44.
 */
export type ButtonVariant = 'primary' | 'secondary-dark' | 'secondary-light' | 'ghost';
export type ButtonSize = 'sm' | 'md';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] text-ink border border-gold-deep/40 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_8px_24px_-12px_rgba(217,182,93,0.55)] hover:brightness-105',
  'secondary-dark': 'bg-white/5 text-warm border border-white/15 backdrop-blur-sm hover:bg-white/10',
  'secondary-light': 'bg-editorial text-ink border border-stone hover:bg-white',
  ghost: 'bg-transparent text-muted border border-transparent hover:text-warm hover:border-white/10',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-2 tracking-[0.02em]',
  md: 'text-sm px-4 py-3',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly iconLeft?: ReactNode;
  readonly iconRight?: ReactNode;
}

export function buttonStyles(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[10px] font-medium',
    'transition-[background-color,border-color,filter,transform] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonStyles(variant, size, className)} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
