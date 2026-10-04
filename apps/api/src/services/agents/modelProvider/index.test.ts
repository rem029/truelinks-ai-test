import { describe, it, expect, vi } from 'vitest';
import { createModelProvider } from './index.js';

describe('createModelProvider', () => {
  it('selects stub provider when apiKey is undefined or empty', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const p1 = createModelProvider({ model: 'test-model' });
    expect(p1.name).toBe('stub');

    const p2 = createModelProvider({ apiKey: '', model: 'test-model' });
    expect(p2.name).toBe('stub');

    const p3 = createModelProvider({ apiKey: '   ', model: 'test-model' });
    expect(p3.name).toBe('stub');

    expect(consoleSpy).toHaveBeenCalledWith('Model provider: stub');
    consoleSpy.mockRestore();
  });

  it('selects openrouter provider when apiKey is provided', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const p = createModelProvider({ apiKey: 'sk-or-test-key', model: 'my-model' });
    expect(p.name).toBe('openrouter');

    expect(consoleSpy).toHaveBeenCalledWith('Model provider: openrouter (my-model)');
    consoleSpy.mockRestore();
  });
});
