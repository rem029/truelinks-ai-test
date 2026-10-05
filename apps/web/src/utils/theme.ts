export type Theme = 'light' | 'dark';

export function getStoredTheme(): Theme | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const val = localStorage.getItem('theme');
    if (val === 'light' || val === 'dark') {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

export function storeTheme(t: Theme): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('theme', t);
  } catch {
    // Storage can throw in restricted or quota-exceeded environments
  }
}

export function systemTheme(): Theme {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  } catch {
    // matchMedia can throw or be unavailable
  }
  return 'light';
}

export function applyTheme(t: Theme | null): void {
  try {
    if (typeof document === 'undefined') return;
    if (t === 'light' || t === 'dark') {
      document.documentElement.dataset.theme = t;
    } else {
      delete document.documentElement.dataset.theme;
    }
  } catch {
    // Document access guard
  }
}
