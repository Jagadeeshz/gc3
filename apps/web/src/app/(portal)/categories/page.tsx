'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ServiceCategory } from '@gc3/types';
import { Badge } from '@gc3/ui';
import {
  ApiClientError,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { formatDate } from '@/components/portal/status';

interface FormState {
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { name: '', slug: '', description: '', isActive: true };

/** Roles that hold `category:manage`. An affordance only — the API still checks. */
const MANAGER_ROLES = ['PLATFORM_ADMIN', 'OPERATIONS_MANAGER'];

export default function CategoriesPage() {
  const { session } = useSession();
  const [categories, setCategories] = useState<readonly ServiceCategory[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;

  const canManage = useMemo(
    () => (session?.actor.platformRole ? MANAGER_ROLES.includes(session.actor.platformRole) : false),
    [session],
  );

  // Inactive categories stay visible here — this is the administration screen.
  const load = useCallback(async () => {
    if (!token || !organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setCategories(await listCategories(token, organizationId, true));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load categories');
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEditing(category: ServiceCategory) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      isActive: category.isActive,
    });
    setError(null);
    setNotice(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !organizationId) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const name = form.name.trim();
      const slug = form.slug.trim();
      const description = form.description.trim();

      if (editingId) {
        // The slug is only sent when the operator changed it, so renaming a
        // category never silently re-slugs it.
        const original = categories.find((category) => category.id === editingId);

        await updateCategory(token, organizationId, editingId, {
          name,
          // On update null clears the description; the update schema accepts it.
          description: description === '' ? null : description,
          isActive: form.isActive,
          ...(slug && original && slug !== original.slug ? { slug } : {}),
        });
        setNotice(`Updated “${name}”.`);
      } else {
        // On create an empty description is simply omitted, not sent as null.
        await createCategory(token, organizationId, {
          name,
          isActive: form.isActive,
          ...(slug ? { slug } : {}),
          ...(description ? { description } : {}),
        });
        setNotice(`Created “${name}”.`);
      }

      resetForm();
      await load();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not save the category');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(category: ServiceCategory) {
    if (!token || !organizationId) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await updateCategory(token, organizationId, category.id, { isActive: !category.isActive });
      setNotice(
        `${category.name} is now ${category.isActive ? 'retired' : 'active'}.`,
      );
      await load();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not update the category');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(category: ServiceCategory) {
    if (!token || !organizationId) {
      return;
    }

    if (!window.confirm(`Delete “${category.name}”? Existing requests keep the label.`)) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await deleteCategory(token, organizationId, category.id);
      setNotice(`Deleted “${category.name}”.`);
      if (editingId === category.id) {
        resetForm();
      }
      await load();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not delete the category');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-[-0.01em] text-warm">Service categories</h1>
      <p className="mt-1 text-sm text-muted">
        The catalogue of services this organization can raise requests against.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-300"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-4 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold-light">
          {notice}
        </p>
      ) : null}

      {canManage ? (
        <form
          className="mt-5 rounded-[14px] border border-white/10 bg-graphite/85 p-5"
          onSubmit={onSubmit}
        >
          <h2 className="text-sm font-semibold text-warm">
            {editingId ? 'Edit category' : 'New category'}
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">Name</span>
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Cloud Migration"
                className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2.5 text-sm text-warm placeholder:text-muted/60 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">
                Slug <span className="text-muted/70">(optional, derived from the name)</span>
              </span>
              <input
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                placeholder="cloud-migration"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2.5 font-mono text-xs text-warm placeholder:text-muted/60 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
              />
            </label>
          </div>

          <label className="mt-3 grid gap-1.5">
            <span className="text-xs font-medium text-muted">Description</span>
            <input
              maxLength={500}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="What kind of work belongs here?"
              className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2.5 text-sm text-warm placeholder:text-muted/60 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
            />
          </label>

          <label className="mt-3 flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              className="size-4 rounded border-white/20 bg-graphite-elevated accent-gold"
            />
            Active — offered when raising a request
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-10 rounded-[10px] border border-gold-deep/40 bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create category'}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                disabled={busy}
                className="min-h-10 rounded-[10px] border border-white/15 bg-white/5 px-4 py-2 text-sm text-warm hover:bg-white/10 disabled:opacity-60"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="mt-5 rounded-[12px] border border-white/10 bg-graphite/85 px-4 py-3 text-xs text-muted">
          You can use the catalogue when raising requests. Managing it is limited to platform admins
          and operations managers.
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading categories…</p>
      ) : categories.length === 0 ? (
        <p className="mt-6 rounded-[14px] border border-white/10 bg-graphite/85 p-5 text-sm text-muted">
          No categories yet{canManage ? ' — create the first one above.' : '.'}
        </p>
      ) : (
        <ul className="mt-6 grid gap-2.5">
          {categories.map((category) => (
            <li
              key={category.id}
              className="rounded-[12px] border border-white/10 bg-graphite/85 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-warm">{category.name}</span>
                    <Badge tone={category.isActive ? 'positive' : 'neutral'}>
                      {category.isActive ? 'Active' : 'Retired'}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    {category.slug} · added {formatDate(category.createdAt)}
                  </p>
                  {category.description ? (
                    <p className="mt-1.5 text-xs text-muted">{category.description}</p>
                  ) : null}
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEditing(category)}
                      disabled={busy}
                      className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-warm hover:bg-white/10 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onToggleActive(category)}
                      disabled={busy}
                      className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-warm hover:bg-white/10 disabled:opacity-50"
                    >
                      {category.isActive ? 'Retire' : 'Reactivate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(category)}
                      disabled={busy}
                      className="rounded-md border border-red-400/35 bg-red-400/10 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-400/20 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
