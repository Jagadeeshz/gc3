'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ServiceCategory, ServiceRequestPriority } from '@gc3/types';
import { ApiClientError, createRequest, listCategories } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

const PRIORITIES: ServiceRequestPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

/** Request creation form — mirrors the prototype's `formbox` panel. */
export default function NewRequestPage() {
  const router = useRouter();
  const { session } = useSession();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ServiceRequestPriority>('NORMAL');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<readonly ServiceCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'DRAFT' | 'SUBMITTED' | null>(null);

  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;

  // Catalogue is optional context: an empty list just means no category to pick.
  useEffect(() => {
    if (!token || !organizationId) {
      return;
    }

    let cancelled = false;

    void listCategories(token, organizationId)
      .then((loaded) => {
        if (!cancelled) {
          setCategories(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCategories([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, organizationId]);

  async function submit(status: 'DRAFT' | 'SUBMITTED') {
    if (!session?.accessToken || !session.activeOrganizationId) {
      setError('No active organization — sign in again.');
      return;
    }

    setSaving(status);
    setError(null);

    try {
      const created = await createRequest(
        session.accessToken,
        session.activeOrganizationId,
        {
          title: title.trim(),
          description: description.trim(),
          priority,
          status,
          ...(categoryId ? { categoryId } : {}),
        },
      );

      router.push(`/requests/${created.id}`);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not create the request');
      setSaving(null);
    }
  }

  return (
    <div className="max-w-[680px]">
      <h1 className="font-display text-3xl tracking-[-0.01em] text-slate-100">New service request</h1>
      <p className="mt-1 text-sm text-slate-400">
        Describe the outcome you need. Drafts stay private until you submit them.
      </p>

      <form
        className="mt-6 grid gap-4 rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit('SUBMITTED');
        }}
      >
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-slate-400">Title</span>
          <input
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Provision a staging cluster"
            className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-slate-400">Description</span>
          <textarea
            required
            minLength={10}
            rows={5}
            maxLength={20_000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What needs to happen, for whom, and by when?"
            className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-slate-400">Priority</span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as ServiceRequestPriority)}
            className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0) + value.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-slate-400">Category</span>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {categories.length === 0 ? (
            <span className="text-[11px] text-slate-400">
              No active categories in this workspace yet.
            </span>
          ) : null}
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving !== null}
            className="inline-flex min-h-11 items-center justify-center rounded-[6px] border border-[#8B6410]/60 bg-[linear-gradient(120deg,#F2D582_0%,#C9911A_52%,#8B6410_100%)] px-4 py-3 text-sm font-medium text-ink transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving === 'SUBMITTED' ? 'Submitting…' : 'Submit request'}
          </button>
          <button
            type="button"
            onClick={() => void submit('DRAFT')}
            disabled={saving !== null}
            className="inline-flex min-h-11 items-center justify-center rounded-[6px] border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-100 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving === 'DRAFT' ? 'Saving…' : 'Save as draft'}
          </button>
        </div>
      </form>
    </div>
  );
}
