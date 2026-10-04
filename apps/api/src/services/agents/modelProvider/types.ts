import type { z } from 'zod';

export type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export type ToolCall = {
  id: string;
  name: string;
  args: unknown; // raw/unvalidated
};

export type ToolSpec = {
  name: string;
  description: string;
  parameters: z.ZodType;
};

export type ImageInput = {
  filename: string;
  mimeType: string;
  data: Buffer;
};

export interface CompletionRequest<T = unknown> {
  purpose: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  responseSchema?: z.ZodType<T>;
  images?: ImageInput[];
}

export interface CompletionResult<T = unknown> {
  text: string | null;
  toolCalls: ToolCall[];
  output: T | null; // validated against responseSchema when given
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ModelProvider {
  name: 'stub' | 'openrouter';
  complete<T = unknown>(req: CompletionRequest<T>): Promise<CompletionResult<T>>;
}
