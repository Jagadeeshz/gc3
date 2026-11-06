'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * The capability-pod selector on the public home page.
 *
 * Reads the official catalogue from `GET /api/v1/pricing/pods` — the same endpoint
 * the pricing page and the client portal use — so the home page cannot advertise a
 * price the platform does not hold. There is no price literal in this file.
 *
 * Tabs are a real tablist (roving tabindex, arrow keys, Home/End) so keyboard users
 * get the same reveal as pointer users, which is how this component was built.
 */

const money = (minor: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);

function priceOf(pod: CapabilityPod): { value: string; unit: string } {
  return pod.isCustomPriced
    ? { value: money(pod.creditRateCents, pod.currency), unit: 'per credit' }
    : { value: money(pod.monthlyPriceCents, pod.currency), unit: 'per month' };
}

function composition(pod: CapabilityPod): readonly string[] {
  const rows: string[] = [];

  if (pod.managers > 0) {
    rows.push(`${pod.managers} manager${pod.managers > 1 ? 's' : ''}`);
  }
  if (pod.specialists > 0) {
    rows.push(`${pod.specialists} specialist${pod.specialists > 1 ? 's' : ''}`);
  }
  if (pod.agents > 0) {
    rows.push(`${pod.agents} supervised agent${pod.agents > 1 ? 's' : ''}`);
  }

  return rows.length > 0 ? rows : [pod.teamSummary ?? 'Custom team, scoped per engagement'];
}

export function PodTabs() {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let alive = true;

    fetchPods()
      .then((rows) => {
        if (alive) setPods(rows);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  /*
   * Loading and failure both reserve the panel's height: a price section that
   * collapses shifts the whole page under the reader, and a marketing page that
   * renders a broken state is worse than one that names the problem and links to
   * the catalogue.
   */
  if (pods.length === 0) {
    return (
      <div className="grid gap-px overflow-hidden rounded-[16px] border border-hairline bg-hairline lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="grid gap-px bg-hairline lg:grid-rows-6">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="flex items-center justify-between gap-4 bg-obsidian-soft px-5 py-4">
              <span className="h-3 w-24 animate-pulse rounded bg-obsidian-raised" />
              <span className="h-3 w-12 animate-pulse rounded bg-obsidian-raised" />
            </div>
          ))}
        </div>
        <div className="min-h-[300px] bg-obsidian-soft p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted">
            {failed ? 'Catalogue unavailable' : 'Loading the catalogue…'}
          </p>
          {failed ? (
            <p className="mt-3 max-w-[38ch] text-[13px] leading-relaxed text-ghost-muted">
              The price list could not be reached just now.{' '}
              <Link href="/pricing" className="text-emerald-300 underline-offset-4 hover:underline">
                Open the pricing page
              </Link>{' '}
              for the current pods.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const pod = pods[active % pods.length] as CapabilityPod;
  const price = priceOf(pod);
  const includedPods = pod.includesCodes
    .map((code) => pods.find((entry) => entry.code === code)?.name ?? code)
    .filter(Boolean);

  function focusTab(next: number) {
    const index = (next + pods.length) % pods.length;
    setActive(index);
    tabRefs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusTab(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusTab(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(pods.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div className="grid gap-px overflow-hidden rounded-[16px] border border-hairline bg-hairline lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div
        role="tablist"
        aria-label="Capability pods and pricing"
        aria-orientation="vertical"
        className="flex gap-px overflow-x-auto bg-hairline lg:flex-col"
      >
        {pods.map((item, index) => {
          const selected = index === active;
          const itemPrice = priceOf(item);
          const meter =
            item.creditsIncluded > 0
              ? `${item.creditsIncluded} credits`
              : item.hoursIncluded > 0
                ? `${item.hoursIncluded}h a month`
                : 'Custom team';

          return (
            <button
              key={item.code}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              type="button"
              id={`pod-tab-${item.code.toLowerCase()}`}
              aria-selected={selected}
              aria-controls={`pod-panel-${item.code.toLowerCase()}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={[
                'group relative flex min-w-[200px] flex-1 items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 lg:min-w-0',
                selected
                  ? 'bg-obsidian-raised text-ghost'
                  : 'bg-obsidian-soft text-ghost-muted hover:bg-obsidian-raised/60 hover:text-ghost',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={[
                  'absolute inset-y-0 left-0 w-px transition-opacity duration-200 lg:w-[2px]',
                  selected ? 'bg-emerald-400 opacity-100' : 'opacity-0',
                ].join(' ')}
              />
              <span className="grid gap-1">
                <span className="text-[14px] font-medium tracking-[-0.01em]">{item.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ghost-muted">
                  {meter}
                </span>
              </span>
              <span
                className={[
                  'shrink-0 text-right font-mono text-[12px] tabular-nums transition-colors',
                  selected ? 'text-emerald-300' : 'text-ghost-muted group-hover:text-emerald-300',
                ].join(' ')}
              >
                {itemPrice.value}
                <span className="block text-[9px] uppercase tracking-[0.1em] text-ghost-muted">
                  {item.isCustomPriced ? '/credit' : '/mo'}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`pod-panel-${pod.code.toLowerCase()}`}
        aria-labelledby={`pod-tab-${pod.code.toLowerCase()}`}
        className="bg-obsidian-soft p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[40ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300/90">
              {pod.tagline ?? 'Capability pod'}
            </p>
            <p className="mt-3 font-display text-[22px] leading-[1.25] tracking-[-0.01em] sm:text-[26px]">
              <span className="tabular-nums text-ghost">{price.value}</span>{' '}
              <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-ghost-muted">
                {price.unit}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pod.creditsIncluded > 0 ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-300">
                {pod.creditsIncluded} credits / mo
              </span>
            ) : null}
            {pod.hoursIncluded > 0 ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-300">
                {pod.hoursIncluded}h / mo
              </span>
            ) : null}
            {pod.peakHoursIncluded > 0 ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-300">
                {pod.peakHoursIncluded}h peak
              </span>
            ) : null}
            {pod.minTermMonths > 0 ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-300">
                {pod.minTermMonths}-month minimum
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted">
              What it covers
            </p>
            <ul className="mt-3 grid gap-2">
              {pod.perks.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ghost-muted">
                  <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-emerald-400/70" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted">
              Representative composition
            </p>
            <ul className="mt-3 grid gap-px overflow-hidden rounded-[10px] border border-hairline bg-hairline">
              {composition(pod).map((role) => (
                <li
                  key={role}
                  className="bg-obsidian-raised px-3 py-2 font-mono text-[11px] tracking-[0.02em] text-ghost-muted"
                >
                  {role}
                </li>
              ))}
            </ul>

            {includedPods.length > 0 ? (
              <>
                <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted">
                  Carries
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-emerald-200">
                  {includedPods.join(' + ')} — on the same credit pool.
                </p>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5">
          <p className="max-w-[52ch] text-[12px] leading-relaxed text-ghost-muted">
            {pod.description}
          </p>
          <Link
            href="/pricing"
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300 underline-offset-4 hover:underline"
          >
            Full pricing →
          </Link>
        </div>
      </div>
    </div>
  );
}
