import { redirect } from 'next/navigation';

/**
 * `/dashboard` — an alias that redirects to `/overview`.
 *
 * The executive overview lives at `/overview`; this entry point exists so old
 * links, bookmarks and the ops console's "Open client view" all land on the same
 * screen rather than a 404.
 */
export default function DashboardAlias(): never {
  redirect('/overview');
}
