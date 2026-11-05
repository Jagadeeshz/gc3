'use client';

import Link from 'next/link';
import { BookOpen, ClipboardList, FolderKanban, LifeBuoy, MessageSquare, Package } from 'lucide-react';
import { PageHeader, Panel } from '@/components/portal/kit';

/**
 * Knowledge Centre.
 *
 * This page is navigation, not content: it points at the places where the answers
 * actually live — your own requests, your deliverables, your threads — rather than
 * pretending to be a document library the platform does not have yet. A CMS-backed
 * article library is a separate slice; inventing placeholder articles would be
 * worse than saying so.
 */
const GUIDE = [
  {
    href: '/services',
    title: 'Starting work',
    body: 'The catalogue lists every service with its delivery commitment. Pick one and describe the outcome you need — that is a request.',
    icon: BookOpen,
  },
  {
    href: '/requests',
    title: 'Tracking a request',
    body: 'Each request shows its status, its commitment and its conversation. Statuses move from submitted to in progress, in review, delivered, closed.',
    icon: ClipboardList,
  },
  {
    href: '/projects',
    title: 'Projects and deliverables',
    body: 'A project is a request plus everything produced against it. Deliverables carry a version and a review state until they are released.',
    icon: FolderKanban,
  },
  {
    href: '/deliverables',
    title: 'Reviewing work',
    body: 'Anything in review is waiting on you. Approving or rejecting it is recorded against the deliverable, and a replacement bumps the version.',
    icon: Package,
  },
  {
    href: '/messages',
    title: 'Talking to the team',
    body: 'Every request has its own thread. Replies notify the pod working on it; internal notes are never shown to clients.',
    icon: MessageSquare,
  },
  {
    href: '/support',
    title: 'When something is broken',
    body: 'A support ticket enters the same queue and SLA clock as any other request, so it cannot get lost in a side channel.',
    icon: LifeBuoy,
  },
] as const;

export default function KnowledgePage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Engagement"
        title="Knowledge Centre"
        description="How this workspace works, and where each answer lives."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDE.map((entry) => {
          const Icon = entry.icon;

          return (
            <Link
              key={entry.href}
              href={entry.href}
              className="group flex flex-col gap-2 rounded-[12px] border border-[#1E293B] bg-[#0B1220] p-4 transition-colors hover:border-emerald-400/30"
            >
              <Icon aria-hidden className="size-4 text-gold-light" strokeWidth={1.75} />
              <h2 className="text-sm font-semibold text-slate-100">{entry.title}</h2>
              <p className="text-[11px] leading-relaxed text-slate-400">{entry.body}</p>
            </Link>
          );
        })}
      </div>

      <Panel title="Not here yet" subtitle="Stated rather than faked">
        <p className="text-[11px] leading-relaxed text-slate-400">
          The platform does not ship an article library or a document CMS. When those are published they
          will appear on this screen; until then this page stays a map of where things genuinely are,
          because a search box over empty content is worse than an honest index.
        </p>
      </Panel>
    </div>
  );
}
