import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineTool, runTool, toToolSpecs } from './toolRegistry.js';

describe('toolRegistry', () => {
  const sampleTool = defineTool({
    name: 'update_rent',
    description: 'Updates rent amount',
    args: z.object({
      amount: z.number().positive(),
    }),
    handler: async (args) => {
      return { updated: true, newAmount: args.amount };
    },
  });

  const throwingTool = defineTool({
    name: 'crash_tool',
    description: 'Always crashes',
    args: z.object({ reason: z.string() }),
    handler: (args) => {
      throw new Error(`Intentional crash: ${args.reason}`);
    },
  });

  const tools = [sampleTool, throwingTool];

  it('runs tool successfully with valid args', async () => {
    const result = await runTool(tools, {
      id: 'call_1',
      name: 'update_rent',
      args: { amount: 8500 },
    });

    expect(result).toEqual({
      ok: true,
      result: { updated: true, newAmount: 8500 },
    });
  });

  it('returns error when tool is unknown', async () => {
    const result = await runTool(tools, {
      id: 'call_2',
      name: 'non_existent_tool',
      args: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Unknown tool: 'non_existent_tool'");
    }
  });

  it('returns error when args fail zod validation', async () => {
    const result = await runTool(tools, {
      id: 'call_3',
      name: 'update_rent',
      args: { amount: -500 }, // must be positive
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid arguments for tool 'update_rent'");
    }
  });

  it('returns error when handler throws', async () => {
    const result = await runTool(tools, {
      id: 'call_4',
      name: 'crash_tool',
      args: { reason: 'DB connection error' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Tool 'crash_tool' execution failed: Intentional crash: DB connection error");
    }
  });

  it('converts tools to tool specs', () => {
    const specs = toToolSpecs(tools);
    expect(specs).toHaveLength(2);
    expect(specs[0]?.name).toBe('update_rent');
    expect(specs[0]?.description).toBe('Updates rent amount');
    expect(specs[0]?.parameters).toBe(sampleTool.args);
    expect(specs[1]?.name).toBe('crash_tool');
  });
});
