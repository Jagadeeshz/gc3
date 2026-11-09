'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, LayoutGrid, Loader2, X } from 'lucide-react';
import type { ServiceCategory, ServiceRequest, ServiceRequestPriority } from '@gc3/types';
import { ApiClientError, createRequest, listCategories } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { PodPriceStrip } from '@/components/pricing/pod-catalogue';
import { EmptyState, ErrorNote, Loading, PageHeader, Panel } from '@/components/portal/kit';

/**
 * Services.
 *
 * The catalogue as the tenant has defined it, each card opening a request form
 * that arrives with its category already chosen. Nothing here is a mock: the grid
 * is `GET /service-categories` (active rows only) and submission is
 * `POST /service-requests`, the same contract the request page uses.
 *
 * A tenant with no catalogue is shown an honest empty state — categories are
 * staff-maintained (`category:manage`), so a client cannot create one and is not
 * offered a button that would fail.
 */
const PRIORITIES: readonly ServiceRequestPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

interface DraftState {
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  priority: ServiceRequestPriority;
}

const EMPTY_DRAFT: DraftState = {
  categoryId: '',
  categoryName: '',
  title: '',
  description: '',
  priority: 'NORMAL',
};

export default function ServicesPage() {
  const { session } = useSession();
  const router = useRouter();
  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;

  const [categories, setCategories] = useState<readonly ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<ServiceRequest | null>(null);

  const load = useCallback(async () => {
    if (!token || !organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rows = await listCategories(token, organizationId);
      setCategories(rows.filter((category) => category.isActive));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load the catalogue.');
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fastest = useMemo(
    () =>
      categories
        .map((category) => category.slaDeliveryHours)
        .filter((hours): hours is number => typeof hours === 'number')
        .sort((a, b) => a - b)[0] ?? null,
    [categories],
  );

  function openForm(category?: ServiceCategory) {
    setCreated(null);
    setSubmitError(null);
    setDraft({
      ...EMPTY_DRAFT,
      categoryId: category?.id ?? '',
      categoryName: category?.name ?? '',
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft || !token || !organizationId) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const request = await createRequest(token, organizationId, {
        title: draft.title.trim(),
        description: draft.description.trim(),
        priority: draft.priority,
        ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
        status: 'SUBMITTED',
      });

      setCreated(request);
      setDraft(null);
    } catch (caught) {
      setSubmitError(
        caught instanceof ApiClientError ? caught.message : 'Could not submit that request.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading label="Loading the service catalogue…" />;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Services"
        title="Service catalogue"
        description="Every service this workspace can request, with the delivery commitment we hold ourselves to."
        actions={
          <button
            type="button"
            onClick={() => openForm()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/20"
          >
            <LayoutGrid aria-hidden className="size-3.5" strokeWidth={2} />
            Request a service
          </button>
        }
      />

      {error ? <ErrorNote message={error} /> : null}

      <PodPriceStrip token={token} />

      {created ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-emerald-400/30 bg-emerald-400/5 px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-emerald-200">
            <CheckCircle2 aria-hidden className="size-4" strokeWidth={1.75} />
            {created.reference} submitted — {created.title}
          </p>
          <button
            type="button"
            onClick={() => router.push(`/requests/${created.id}`)}
            className="inline-flex items-center gap-1.5 text-xs text-emerald-300 underline-offset-4 hover:underline"
          >
            Open the request
            <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
      ) : null}

      {categories.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No services are published yet"
          body="Your account team maintains this catalogue. Until it is published you can still raise a general request and we will route it to the right pod."
          action={{ href: '/requests/new', label: 'Raise a general request' }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <article
              key={category.id}
              className="flex flex-col justify-between rounded-[6px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-4 transition-colors hover:border-emerald-400/30"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-100">{category.name}</h2>
                  <span className="shrink-0 rounded-full border border-[color:var(--bindu-surface-border)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">
                    {category.slaDeliveryHours ? `${category.slaDeliveryHours}h SLA` : 'SLA default'}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-slate-400">
                  {category.description ?? 'No description has been published for this service yet.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openForm(category)}
                className="mt-4 inline-flex items-center justify-between rounded-lg border border-[color:var(--bindu-surface-border)] px-3 py-2 text-xs text-slate-100 transition-colors hover:border-emerald-400/35 hover:text-emerald-200"
              >
                Request this service
                <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.75} />
              </button>
            </article>
          ))}
        </div>
      )}

      {fastest ? (
        <p className="text-[11px] text-slate-400">
          Fastest published commitment: {fastest} hours from submission.
        </p>
      ) : null}

      {/* Request form — a modal over the catalogue, prefilled with the chosen service. */}
      {draft ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-form-title"
          className="fixed inset-0 z-50 grid place-items-center bg-void/80 px-4 py-8 backdrop-blur-sm"
        >
          <div className="w-full max-w-[560px] rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-graphite shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--bindu-surface-border)] px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  New service request
                </p>
                <h2 id="request-form-title" className="mt-1 font-display text-lg font-semibold text-slate-100">
                  {draft.categoryName || 'General request'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDraft(null)}
                aria-label="Close"
                className="rounded-lg border border-[color:var(--bindu-surface-border)] p-1.5 text-slate-400 transition-colors hover:text-slate-100"
              >
                <X aria-hidden className="size-4" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={submit} className="grid gap-4 px-5 py-5">
              <label className="grid gap-1.5">
                <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Service</span>
                <select
                  value={draft.categoryId}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, categoryId: event.target.value } : current,
                    )
                  }
                  className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
                >
                  <option value="">General request</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Title</span>
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => (current ? { ...current, title: event.target.value } : current))
                  }
                  placeholder="What do you need delivered?"
                  className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-emerald-400/60 focus:outline-none"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Requirements</span>
                <textarea
                  required
                  minLength={10}
                  rows={5}
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, description: event.target.value } : current,
                    )
                  }
                  placeholder="Scope, audience, deadline, anything we should know."
                  className="resize-y rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-emerald-400/60 focus:outline-none"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Priority</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITIES.map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setDraft((current) => (current ? { ...current, priority } : current))}
                      className={[
                        'rounded-lg border px-2.5 py-1 text-[11px] capitalize transition-colors',
                        draft.priority === priority
                          ? 'border-emerald-400/45 bg-emerald-400/15 text-emerald-200-light'
                          : 'border-[color:var(--bindu-surface-border)] text-slate-400 hover:text-slate-100',
                      ].join(' ')}
                    >
                      {priority.toLowerCase()}
                    </button>
                  ))}
                </div>
              </label>

              {submitError ? <ErrorNote message={submitError} /> : null}

              <div className="flex items-center justify-end gap-2 border-t border-[color:var(--bindu-surface-border)] pt-4">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="rounded-lg border border-[color:var(--bindu-surface-border)] px-3 py-2 text-xs text-slate-400 transition-colors hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gold/45 bg-gold/15 px-4 py-2 text-xs font-semibold text-gold-light transition-colors hover:bg-emerald-400/20 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 aria-hidden className="size-3.5 animate-spin" strokeWidth={2} />
                  ) : null}
                  {submitting ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <Panel title="How requests move" subtitle="The statuses you will see on your request">
        <ol className="grid gap-2 text-[11px] text-slate-400 sm:grid-cols-3">
          <li className="rounded-lg border border-[color:var(--bindu-surface-border)] px-3 py-2">
            <span className="font-mono uppercase tracking-[0.1em] text-gold-light">Submitted</span> — we
            have it and will triage it shortly.
          </li>
          <li className="rounded-lg border border-[color:var(--bindu-surface-border)] px-3 py-2">
            <span className="font-mono uppercase tracking-[0.1em] text-gold-light">In progress</span> — a
            delivery pod is working on it.
          </li>
          <li className="rounded-lg border border-[color:var(--bindu-surface-border)] px-3 py-2">
            <span className="font-mono uppercase tracking-[0.1em] text-gold-light">In review</span> —
            deliverables are with you for approval.
          </li>
        </ol>
      </Panel>
    </div>
  );
}
