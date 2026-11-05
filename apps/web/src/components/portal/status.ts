import type {
  DeliverableStatus,
  InvoiceStatus,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from '@gc3/types';
import type { BadgeTone } from '@gc3/ui';

/** Status → label + tone. Kept in one place so every list and detail agrees. */
const REQUEST_LABELS: Record<ServiceRequestStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  TRIAGE: 'Triage',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  IN_REVIEW: 'In review',
  DELIVERED: 'Delivered',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

const REQUEST_TONES: Record<ServiceRequestStatus, BadgeTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'positive',
  TRIAGE: 'gold',
  IN_PROGRESS: 'positive',
  BLOCKED: 'critical',
  IN_REVIEW: 'gold',
  DELIVERED: 'positive',
  CLOSED: 'neutral',
  CANCELLED: 'critical',
};

const DELIVERABLE_LABELS: Record<DeliverableStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RELEASED: 'Released',
};

const DELIVERABLE_TONES: Record<DeliverableStatus, BadgeTone> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'gold',
  IN_REVIEW: 'gold',
  APPROVED: 'positive',
  REJECTED: 'critical',
  RELEASED: 'positive',
};

const PRIORITY_LABELS: Record<ServiceRequestPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function requestStatusLabel(status: ServiceRequestStatus): string {
  return REQUEST_LABELS[status];
}

export function requestStatusTone(status: ServiceRequestStatus): BadgeTone {
  return REQUEST_TONES[status];
}

export function deliverableStatusLabel(status: DeliverableStatus): string {
  return DELIVERABLE_LABELS[status];
}

export function deliverableStatusTone(status: DeliverableStatus): BadgeTone {
  return DELIVERABLE_TONES[status];
}

export function priorityLabel(priority: ServiceRequestPriority): string {
  return PRIORITY_LABELS[priority];
}

/** Short, deterministic date for tables and record cards. */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) {
    return '—';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** First 12 hex characters — enough to eyeball two digests, short enough to read. */
export function shortDigest(sha256: string | null): string {
  return sha256 ? sha256.slice(0, 12) : '—';
}

export function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Phase 4 — money and invoices
// ---------------------------------------------------------------------------

const INVOICE_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  VOID: 'Void',
};

const INVOICE_TONES: Record<InvoiceStatus, BadgeTone> = {
  DRAFT: 'neutral',
  ISSUED: 'gold',
  PAID: 'positive',
  OVERDUE: 'critical',
  VOID: 'neutral',
};

export function invoiceStatusLabel(status: InvoiceStatus): string {
  return INVOICE_LABELS[status];
}

export function invoiceStatusTone(status: InvoiceStatus): BadgeTone {
  return INVOICE_TONES[status];
}

/**
 * Money for humans, from integer minor units.
 *
 * en-IN grouping, because the tenants and the price list are in rupees: 2500000
 * paise reads as ₹25,000.00, not ₹2,500,000.00.
 */
export function formatMoney(minorUnits: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);
}

/** A calendar month key ("2026-11") as a readable label, without a date library. */
export function formatPeriodKey(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return period;
  }

  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The last complete month, which is what billing defaults to. */
export function previousPeriodKey(now: Date = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, '0')}`;
}

export function currentPeriodKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${`${now.getUTCMonth() + 1}`.padStart(2, '0')}`;
}
