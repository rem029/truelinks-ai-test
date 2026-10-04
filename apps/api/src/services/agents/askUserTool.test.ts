import { describe, it, expect } from 'vitest';
import { askUserTool } from './askUserTool.ts';

describe('askUserTool', () => {
  it('runs successfully with a valid question', async () => {
    const result = await askUserTool.run({ question: 'Which field should I change?' });
    expect(result).toEqual({
      ok: true,
      result: 'Which field should I change?',
    });
  });

  it('fails with an empty question', async () => {
    const result = await askUserTool.run({ question: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid arguments for tool 'ask_user'");
    }
  });

  it('fails with missing question', async () => {
    const result = await askUserTool.run({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid arguments for tool 'ask_user'");
    }
  });
});
