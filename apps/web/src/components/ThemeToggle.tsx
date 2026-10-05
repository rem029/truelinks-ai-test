import { useState, useEffect } from 'react';
import {
  type Theme,
  getStoredTheme,
  storeTheme,
  systemTheme,
  applyTheme,
} from '../utils/theme.ts';

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export interface ThemeToggleProps {
  // Show "Light mode" / "Dark mode" next to the icon
  showLabel?: boolean;
}

export function ThemeToggle({ showLabel = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? systemTheme());

  useEffect(() => {
    const stored = getStoredTheme();
    if (stored) {
      applyTheme(stored);
      return;
    }

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => {
      if (getStoredTheme() === null) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  function handleToggle() {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    storeTheme(nextTheme);
    applyTheme(nextTheme);
  }

  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      className="btn btn-subtle theme-toggle"
      onClick={handleToggle}
      aria-label={label}
      title={label}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      {showLabel && <span>{isDark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
}
