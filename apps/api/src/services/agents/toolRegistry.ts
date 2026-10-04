import type { z } from 'zod';
import type { ToolCall, ToolSpec } from './modelProvider/types.ts';

export type ToolResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

export interface Tool {
  name: string;
  description: string;
  args: z.ZodType;
  run(rawArgs: unknown): Promise<ToolResult>;
}

export function defineTool<TArgs, TResult>(spec: {
  name: string;
  description: string;
  args: z.ZodType<TArgs>;
  handler: (args: TArgs) => Promise<TResult> | TResult;
}): Tool {
  return {
    name: spec.name,
    description: spec.description,
    args: spec.args,
    async run(rawArgs: unknown): Promise<ToolResult> {
      // Validate at the boundary before invoking handler
      const parsed = spec.args.safeParse(rawArgs);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
          .join(', ');
        return { ok: false, error: `Invalid arguments for tool '${spec.name}': ${issues}` };
      }
      try {
        const result = await spec.handler(parsed.data);
        return { ok: true, result };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `Tool '${spec.name}' execution failed: ${error}` };
      }
    },
  };
}

export function toToolSpecs(tools: readonly Tool[]): ToolSpec[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.args,
  }));
}

export async function runTool(tools: readonly Tool[], call: ToolCall): Promise<ToolResult> {
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) {
    return { ok: false, error: `Unknown tool: '${call.name}'` };
  }
  return tool.run(call.args);
}
