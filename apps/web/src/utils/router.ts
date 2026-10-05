export type UnitTab = 'issues' | 'leases';

export type Route =
  | { name: 'home' }
  | { name: 'thread'; conversationId: string }
  | { name: 'unit'; unitId: string; tab: UnitTab }
  | { name: 'unassigned' }
  | { name: 'report'; unitId: string | null };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').trim();
  const parts = clean.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'c' && parts[1]) {
    return { name: 'thread', conversationId: parts[1] };
  }
  if (parts[0] === 'u' && parts[1]) {
    return { name: 'unit', unitId: parts[1], tab: parts[2] === 'leases' ? 'leases' : 'issues' };
  }
  if (parts[0] === 'unassigned') {
    return { name: 'unassigned' };
  }
  if (parts[0] === 'report') {
    return { name: 'report', unitId: parts[1] ?? null };
  }
  return { name: 'home' };
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'thread':
      return `#/c/${encodeURIComponent(route.conversationId)}`;
    case 'unit':
      return `#/u/${encodeURIComponent(route.unitId)}/${route.tab}`;
    case 'unassigned':
      return '#/unassigned';
    case 'report':
      return route.unitId ? `#/report/${encodeURIComponent(route.unitId)}` : '#/report';
    case 'home':
      return '#/';
  }
}

export function navigate(route: Route): void {
  window.location.hash = toHash(route);
}

// Where a thread's back link goes: the unit's matching tab, or the unassigned list
export function threadParent(kind: 'lease' | 'issue', unitId: string | null): Route {
  if (!unitId) {
    return kind === 'lease' ? { name: 'unassigned' } : { name: 'home' };
  }
  return { name: 'unit', unitId, tab: kind === 'issue' ? 'issues' : 'leases' };
}
