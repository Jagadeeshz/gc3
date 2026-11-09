'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Command, Search } from 'lucide-react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * Command palette (⌘K / Ctrl+K).
 *
 * This is not a screenshot of a product feature — it works: it searches the real
 * catalogue and the real routes, and Enter navigates. The pods it lists are the
 * live ones with their published prices, so the palette can never offer something
 * the site does not sell.
 *
 * Keyboard contract: ⌘K/Ctrl+K opens, ↑↓ move, Enter runs, Esc closes, and focus
 * returns to the trigger on close. Roles are listbox/option so it is announced as a
 * combobox rather than a div full of text.
 */

const money = (minor: number, currency: string): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    minor / 100,
  );

interface Command {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly href: string;
  readonly group: 'Pods' | 'Sections' | 'Account';
}

const STATIC_COMMANDS: readonly Command[] = [
  { id: 'sec-home', label: 'Home', hint: 'The story, in three acts', href: '/', group: 'Sections' },
  { id: 'sec-pricing', label: 'Pricing', hint: 'All six pods, published', href: '/pricing', group: 'Sections' },
  { id: 'sec-login', label: 'Sign in', hint: 'Client portal', href: '/login', group: 'Account' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPods()
      .then((rows) => {
        if (alive) setPods(rows);
      })
      .catch(() => {
        /* the palette still works over routes without the catalogue */
      });
    return () => {
      alive = false;
    };
  }, []);

  const commands = useMemo<readonly Command[]>(() => {
    const podCommands: Command[] = pods.map((pod) => ({
      id: `pod-${pod.code}`,
      label: pod.name,
      hint: pod.isCustomPriced
        ? `${money(pod.creditRateCents, pod.currency)}/credit · custom team`
        : `${money(pod.monthlyPriceCents, pod.currency)}/mo · ${
            pod.creditsIncluded > 0 ? `${pod.creditsIncluded} credits` : `${pod.hoursIncluded} hours`
          }`,
      href: '/pricing',
      group: 'Pods',
    }));

    return [...podCommands, ...STATIC_COMMANDS];
  }, [pods]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return commands;

    return commands.filter((command) =>
      `${command.label} ${command.hint} ${command.group}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setCursor(0);
    triggerRef.current?.focus();
  }, []);

  const run = useCallback(
    (command: Command | undefined) => {
      if (!command) return;
      close();
      router.push(command.href);
    },
    [close, router],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if (event.key === 'Escape' && open) {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the command palette"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-[color:var(--bindu-void-2)]/90 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-200 backdrop-blur-md transition-colors hover:border-emerald-400/60 hover:bg-emerald-400/10"
      >
        <Command aria-hidden className="size-3.5" strokeWidth={1.9} />
        <span className="hidden sm:inline">Search</span>
        <kbd className="rounded border border-emerald-400/25 px-1 py-0.5 text-[9px] text-emerald-300/80">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close the command palette"
        onClick={close}
        className="absolute inset-0 cursor-default bg-obsidian/80 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="palette-in glass glass--dark relative w-full max-w-[560px] overflow-hidden rounded-[12px] shadow-[var(--bindu-shadow-modal)]"
      >
        <div className="flex items-center gap-2.5 border-b border-[color:var(--bindu-surface-border)] px-4 py-3">
          <Search aria-hidden className="size-4 shrink-0 text-emerald-300/80" strokeWidth={1.9} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setCursor((current) => Math.min(current + 1, matches.length - 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setCursor((current) => Math.max(current - 1, 0));
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                run(matches[cursor]);
              }
            }}
            placeholder="Search pods, sections, pages…"
            aria-label="Search pods, sections and pages"
            aria-controls="command-results"
            aria-activedescendant={matches[cursor] ? `command-${matches[cursor].id}` : undefined}
            role="combobox"
            aria-expanded="true"
            className="w-full bg-transparent text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-[color:var(--bindu-surface-border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">
            esc
          </kbd>
        </div>

        <ul id="command-results" role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto py-1.5">
          {matches.length === 0 ? (
            <li className="px-4 py-6 text-center text-[12px] text-slate-500">
              Nothing matches “{query}”.
            </li>
          ) : (
            matches.map((command, index) => {
              const active = index === cursor;

              return (
                <li key={command.id} id={`command-${command.id}`} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => run(command)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                      active ? 'bg-emerald-400/[0.08]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-emerald-300/70">
                          {command.group}
                        </span>
                        <span className="truncate text-[12.5px] text-slate-100">{command.label}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                        {command.hint}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className={`size-3.5 shrink-0 ${active ? 'text-emerald-300' : 'text-slate-600'}`}
                      strokeWidth={1.9}
                    />
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-[color:var(--bindu-surface-border)] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
          <span>↑↓ move · ↵ open · esc close</span>
          <span>{matches.length} result{matches.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}
