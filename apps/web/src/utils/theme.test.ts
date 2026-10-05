import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getStoredTheme, storeTheme, applyTheme, systemTheme } from './theme.ts';

describe('theme utils', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
    vi.stubGlobal('localStorage', storageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredTheme()).toBeNull();
  });

  it('stores and retrieves light and dark themes', () => {
    storeTheme('dark');
    expect(getStoredTheme()).toBe('dark');

    storeTheme('light');
    expect(getStoredTheme()).toBe('light');
  });

  it('returns null for invalid stored value', () => {
    localStorage.setItem('theme', 'invalid-theme');
    expect(getStoredTheme()).toBeNull();

    localStorage.setItem('theme', '');
    expect(getStoredTheme()).toBeNull();
  });

  it('handles localStorage throwing gracefully', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError: Access is denied');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });

    expect(getStoredTheme()).toBeNull();
    expect(() => storeTheme('dark')).not.toThrow();
  });

  it('systemTheme defaults to light when matchMedia is missing or false', () => {
    expect(systemTheme()).toBe('light');
  });

  it('systemTheme detects dark from matchMedia', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({
        matches: query.includes('dark'),
      }),
    });
    expect(systemTheme()).toBe('dark');
  });

  it('applyTheme sets and removes documentElement dataset theme', () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal('document', {
      documentElement: { dataset },
    });

    applyTheme('dark');
    expect(dataset.theme).toBe('dark');

    applyTheme('light');
    expect(dataset.theme).toBe('light');

    applyTheme(null);
    expect(dataset.theme).toBeUndefined();
  });
});
