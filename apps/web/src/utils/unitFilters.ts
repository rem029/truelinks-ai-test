import type { ConversationSummary } from '@truelinks/shared';

export interface StatusFilter {
  id: string;
  label: string;
  matches: (review: ConversationSummary) => boolean;
}

// The one filter that shows archived items; "All" and every filter below leave them out
export const ARCHIVED_FILTER = 'archived';

export const LEASE_FILTERS: StatusFilter[] = [
  { id: 'active', label: 'Active', matches: (r) => r.leaseTiming === 'active' },
  { id: 'next', label: 'Next', matches: (r) => r.leaseTiming === 'next' },
  { id: 'later', label: 'Later', matches: (r) => r.leaseTiming === 'later' },
  { id: 'draft', label: 'Draft', matches: (r) => r.leaseStatus !== 'confirmed' },
  { id: 'ended', label: 'Ended', matches: (r) => r.leaseTiming === 'ended' },
];

export const ISSUE_FILTERS: StatusFilter[] = [
  { id: 'needs-review', label: 'Needs review', matches: (r) => r.workOrder?.status === 'draft' },
  { id: 'accepted', label: 'Accepted', matches: (r) => r.workOrder?.status === 'accepted' },
  { id: 'rejected', label: 'Rejected', matches: (r) => r.workOrder?.status === 'rejected' },
  { id: 'no-work-order', label: 'No work order', matches: (r) => r.workOrder === null },
];

// A status from the URL that names no filter shows everything, like "All"
export function knownStatus(status: string | undefined, filters: StatusFilter[]): string | undefined {
  if (status === ARCHIVED_FILTER || filters.some((f) => f.id === status)) return status;
  return undefined;
}

export function matchesStatus(review: ConversationSummary, status: string | undefined, filters: StatusFilter[]): boolean {
  if (status === ARCHIVED_FILTER) return review.archivedAt !== null;
  if (review.archivedAt) return false;
  const filter = filters.find((f) => f.id === status);
  return filter ? filter.matches(review) : true;
}

export function isUrgent(review: ConversationSummary): boolean {
  return review.workOrder?.urgent === true;
}
