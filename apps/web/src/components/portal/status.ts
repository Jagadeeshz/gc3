import type { DeliverableStatus, ServiceRequestPriority, ServiceRequestStatus } from '@gc3/types';
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
  SUBMITTED: 'gold',
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
