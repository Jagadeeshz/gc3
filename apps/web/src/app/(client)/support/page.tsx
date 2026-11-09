'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, LifeBuoy, Loader2, Send } from 'lucide-react';
import type { ServiceCategory, ServiceRequest, ServiceRequestPriority } from '@gc3/types';
import { ApiClientError, createRequest, listCategories, listRequests } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { formatDate, requestStatusLabel, requestStatusTone } from '@/components/portal/status';
import { ErrorNote, Loading, PageHeader, Panel } from '@/components/portal/kit';

/**
 * Support.
 *
 * A support ticket here *is* a service request: it enters the same triage queue,
 * the same SLA engine and the same delivery pods. Building a second, parallel
 * ticket system would mean two queues and one of them would rot.
 *
 * The form prefers a category whose name mentions support when the tenant has one,
 * and falls back to an uncategorised request so the button always works.
 */
const PRIORITIES: readonly { value: ServiceRequestPriority; label: string; hint: string }[] = [
  { value: 'NORMAL', label: 'Normal', hint: 'Within the standard commitment' },
  { value: 'HIGH', label: 'High', hint: 'Blocking some of the team' },
  { value: 'URGENT', label: 'Urgent', hint: 'Blocking delivery entirely' },
];

export default function SupportPage() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;

  const [categories, setCategories] = useState<readonly ServiceCategory[]>([]);
  const [recent, setRecent] = useState<readonly ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<ServiceRequestPriority>('NORMAL');
  const [categoryId, setCategoryId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ServiceRequest | null>(null);

  const load = useCallback(async () => {
    if (!token || !organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [catalogue, page] = await Promise.all([
        listCategories(token, organizationId).catch(() => [] as ServiceCategory[]),
        listRequests(token, organizationId, { pageSize: 20 }),
      ]);

      setCategories(catalogue.filter((category) => category.isActive));
      setRecent(page.items.slice(0, 5));

      const support = catalogue.find((category) => /support|help|incident/i.test(category.name));
      if (support) {
        setCategoryId(support.id);
      }
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load support options.');
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const supportCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !organizationId) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const request = await createRequest(token, organizationId, {
        title: `Support · ${subject.trim()}`,
        description: details.trim(),
        priority,
        status: 'SUBMITTED',
        ...(categoryId ? { categoryId } : {}),
      });

      setSubmitted(request);
      setSubject('');
      setDetails('');
      setPriority('NORMAL');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not submit that ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading label="Loading support…" />;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Engagement"
        title="Support"
        description="Raise a ticket with the delivery team. It enters the same queue and SLA clock as any other request, so nothing gets lost in a side channel."
      />

      {error ? <ErrorNote message={error} /> : null}

      {submitted ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-emerald-400/30 bg-emerald-400/5 px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-emerald-200">
            <CheckCircle2 aria-hidden className="size-4" strokeWidth={1.75} />
            Ticket {submitted.reference} raised — the team has been notified.
          </p>
          <Link
            href={`/requests/${submitted.id}`}
            className="text-xs text-emerald-300 underline-offset-4 hover:underline"
          >
            Open the ticket
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Raise a ticket" subtitle="Tell us what is broken or blocked">
          <form onSubmit={submit} className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Subject</span>
              <input
                required
                minLength={3}
                maxLength={160}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Short summary — e.g. Deliverable upload failing"
                className="rounded-lg border border-white/10 bg-[rgba(12,16,32,0.55)] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-emerald-400/60 focus:outline-none"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">What is happening?</span>
              <textarea
                required
                minLength={10}
                rows={5}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="What you expected, what happened, and anything you have already tried."
                className="resize-y rounded-lg border border-white/10 bg-[rgba(12,16,32,0.55)] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-emerald-400/60 focus:outline-none"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Priority</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as ServiceRequestPriority)}
                  className="rounded-lg border border-white/10 bg-[rgba(12,16,32,0.55)] px-3 py-2 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
                >
                  {PRIORITIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} — {option.hint}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Area</span>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="rounded-lg border border-white/10 bg-[rgba(12,16,32,0.55)] px-3 py-2 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
                >
                  <option value="">General support</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <p className="text-[11px] text-slate-400">
                {supportCategory?.slaDeliveryHours
                  ? `Support commitment: ${supportCategory.slaDeliveryHours} hours.`
                  : 'Response times follow the SLA for the priority you choose.'}
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gold/45 bg-gold/15 px-4 py-2 text-xs font-semibold text-gold-light transition-colors hover:bg-emerald-400/20 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 aria-hidden className="size-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Send aria-hidden className="size-3.5" strokeWidth={1.9} />
                )}
                {submitting ? 'Sending…' : 'Raise ticket'}
              </button>
            </div>
          </form>
        </Panel>

        <div className="grid gap-4">
          <Panel title="How support works" subtitle="Same queue, same clock">
            <ul className="grid gap-2 text-[11px] leading-relaxed text-slate-400">
              <li className="flex gap-2">
                <LifeBuoy aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gold-light" strokeWidth={1.75} />
                A ticket is a service request: it is triaged, routed to a pod and tracked against an SLA.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-300/80" strokeWidth={1.75} />
                Urgent tickets are picked up first. Use it when delivery is blocked, not to queue-jump.
              </li>
              <li className="flex gap-2">
                <Send aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gold-light" strokeWidth={1.75} />
                Replies land in <Link href="/messages" className="text-emerald-300 underline-offset-4 hover:underline">Messages</Link>, on the ticket itself.
              </li>
            </ul>
          </Panel>

          <Panel title="Recent tickets" subtitle="Last five requests">
            {recent.length === 0 ? (
              <p className="text-xs text-slate-400">Nothing raised yet.</p>
            ) : (
              <ul className="grid gap-2">
                {recent.map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/requests/${request.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 transition-colors hover:border-gold/30"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs text-slate-100">{request.title}</span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">
                          {request.reference} · {formatDate(request.createdAt)}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                          requestStatusTone(request.status) === 'positive'
                            ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'
                            : requestStatusTone(request.status) === 'critical'
                              ? 'border-red-400/35 bg-red-400/10 text-red-300'
                              : 'border-white/15 bg-white/5 text-slate-400'
                        }`}
                      >
                        {requestStatusLabel(request.status)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
