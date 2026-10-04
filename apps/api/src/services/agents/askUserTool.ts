import { z } from 'zod';
import { defineTool, type Tool } from './toolRegistry.js';

export const AskUserArgs = z.object({
  question: z.string().min(1),
});
export type AskUserArgs = z.infer<typeof AskUserArgs>;

export const askUserTool: Tool = defineTool({
  name: 'ask_user',
  description: 'Ask the user a clarifying question when a request is ambiguous or missing required details',
  args: AskUserArgs,
  handler: (args) => args.question,
});
