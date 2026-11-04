/**
 * Minimal class-name joiner. Kept dependency-free on purpose — the shared
 * UI package must not pull runtime weight into every consumer.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
}
