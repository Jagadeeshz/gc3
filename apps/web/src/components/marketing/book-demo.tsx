'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { ApiClientError, requestDemo } from '@/lib/api-client';

/**
 * "Book a demo" — one CTA instead of two.
 *
 * The header used to offer "Client Portal" and "Portal Access", which both went to
 * /login: two doors, one room. Now there is one primary action (this form) and one
 * secondary (Sign in).
 *
 * The form persists: it posts to `POST /api/v1/demo-requests`, which validates the
 * shape, stores the request and records an audit entry. A lead form that only shows
 * a success toast is a lie with good manners.
 *
 * Opened from anywhere via `openBookDemo()` (a window event), so the header, the
 * closing section and any future CTA share one dialog without prop plumbing.
 */

const EVENT = 'gc3:open-demo';

export function openBookDemo(): void {
  window.dispatchEvent(new Event(EVENT));
}

const SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;

/**
 * A trigger for server components.
 *
 * The handler has to live in a client component: a server component cannot pass
 * `onClick`. This is why the CTA is a component rather than an inline button.
 */
export function BookDemoTrigger({
  label = 'Book a demo',
  className,
}: {
  readonly label?: string;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => openBookDemo()}
      className={
        className ??
        'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold bg-[linear-gradient(120deg,#F2D582_0%,#C9911A_52%,#8B6410_100%)] text-[#080B12] transition-[filter] hover:brightness-[1.08]'
      }
    >
      {label}
    </button>
  );
}

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function BookDemoDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    companyName: '',
    companySize: '',
    message: '',
  });

  const firstField = useRef<HTMLInputElement | null>(null);
  const trigger = useRef<Element | null>(null);

  useEffect(() => {
    const onOpen = () => {
      trigger.current = document.activeElement;
      setOpen(true);
      setStatus('idle');
      setError(null);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener(EVENT, onOpen);
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener(EVENT, onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      // 60ms: let the dialog paint before stealing focus, or the caret lands in a
      // field that is still being laid out.
      const timer = window.setTimeout(() => firstField.current?.focus(), 60);

      return () => window.clearTimeout(timer);
    }

    document.body.style.overflow = '';
    if (trigger.current instanceof HTMLElement) trigger.current.focus();

    return undefined;
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setError(null);

    try {
      await requestDemo({
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        companyName: form.companyName.trim(),
        companySize: form.companySize as (typeof SIZES)[number],
        ...(form.message.trim().length > 0 ? { message: form.message.trim() } : {}),
        source: 'website',
      });

      setStatus('sent');
    } catch (caught) {
      setStatus('error');
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : 'That did not send. Try again, or email hello@quantocos.com.',
      );
    }
  }

  if (!open) return null;

  const field =
    'w-full rounded-[10px] border border-[#1E293B] bg-[#080f19] px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 transition-colors focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/15';
  const label =
    'mb-1.5 block font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500';

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto px-4 py-[8vh]">
      <button
        type="button"
        aria-label="Close"
        onClick={() => setOpen(false)}
        className="fixed inset-0 cursor-default bg-obsidian/85 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-title"
        className="palette-in relative w-full max-w-[640px] overflow-hidden rounded-[16px] border border-emerald-400/20 bg-[#0b111c] p-6 shadow-[0_50px_140px_-50px_rgba(0,0,0,0.95)] sm:p-8"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close the demo form"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
        >
          <X aria-hidden className="size-4" strokeWidth={1.9} />
        </button>

        {status === 'sent' ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full border border-emerald-400/40 bg-emerald-400/10">
              <Check aria-hidden className="size-6 text-emerald-300" strokeWidth={2.2} />
            </span>
            <h2 id="demo-title" className="mt-4 font-display text-[22px] text-ghost">
              Request received
            </h2>
            <p className="mx-auto mt-2 max-w-[44ch] text-[12.5px] leading-relaxed text-ghost-muted">
              We have your details and the team will come back with times. If it is urgent, reply to
              the confirmation or write to hello@quantocos.com.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-4 py-2 text-[12px] font-medium text-emerald-200 transition-colors hover:bg-emerald-400/20"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 id="demo-title" className="font-display text-[clamp(1.3rem,2.4vw,1.7rem)] tracking-[-0.02em] text-ghost">
              Book a demo <span className="text-ghost-muted">with our experts</span>
            </h2>
            <p className="mt-2 max-w-[52ch] text-[12px] leading-relaxed text-ghost-muted">
              Thirty minutes, one screen share, your actual problem. No deck.
            </p>

            <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="demo-email">
                  Business email
                </label>
                <input
                  ref={firstField}
                  id="demo-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="Enter your business email"
                  className={field}
                />
              </div>

              <div>
                <label className={label} htmlFor="demo-name">
                  Full name
                </label>
                <input
                  id="demo-name"
                  required
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  placeholder="Enter your full name"
                  className={field}
                />
              </div>

              <div>
                <label className={label} htmlFor="demo-size">
                  Company size
                </label>
                <select
                  id="demo-size"
                  required
                  value={form.companySize}
                  onChange={(event) => setForm({ ...form, companySize: event.target.value })}
                  className={`${field} appearance-none`}
                >
                  <option value="" disabled>
                    Select the size of your company
                  </option>
                  {SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} employees
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={label} htmlFor="demo-company">
                  Company name
                </label>
                <input
                  id="demo-company"
                  required
                  autoComplete="organization"
                  value={form.companyName}
                  onChange={(event) => setForm({ ...form, companyName: event.target.value })}
                  placeholder="Enter your company name"
                  className={field}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={label} htmlFor="demo-message">
                  What are you trying to solve? <span className="normal-case tracking-normal text-slate-600">(optional)</span>
                </label>
                <textarea
                  id="demo-message"
                  rows={3}
                  maxLength={1000}
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  placeholder="A launch, a backlog, a capability you are missing…"
                  className={`${field} resize-none`}
                />
              </div>

              {error ? (
                <p className="sm:col-span-2 rounded-lg border border-red-400/30 bg-red-400/[0.07] px-3 py-2 text-[11.5px] text-red-300">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-3 sm:col-span-2">
                <p className="max-w-[34ch] text-[10px] leading-relaxed text-slate-500">
                  We store your details to answer the request. Nothing else.
                </p>
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-400/15 px-4 py-2.5 text-[12.5px] font-medium text-emerald-100 transition-colors hover:bg-emerald-400/25 disabled:opacity-60"
                >
                  {status === 'sending' ? 'Sending…' : 'Book a demo'}
                  <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.9} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
