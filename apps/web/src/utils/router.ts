export type Route =
  | { name: 'home' }
  | { name: 'thread'; conversationId: string };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean) {
    return { name: 'home' };
  }
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'c' && parts[1]) {
    return { name: 'thread', conversationId: decodeURIComponent(parts[1]) };
  }
  return { name: 'home' };
}

export function toHash(route: Route): string {
  if (route.name === 'thread') {
    return `#/c/${encodeURIComponent(route.conversationId)}`;
  }
  return '#/';
}

export function navigate(route: Route): void {
  window.location.hash = toHash(route);
}
