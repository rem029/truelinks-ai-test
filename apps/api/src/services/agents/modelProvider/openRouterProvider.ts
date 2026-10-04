import OpenAI from 'openai';
import { z } from 'zod';
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResult,
  ImageInput,
  ModelProvider,
  ToolCall,
  ToolSpec,
} from './types.ts';

export interface OpenAIClientLike {
  chat: {
    completions: {
      create(
        params: OpenAI.ChatCompletionCreateParamsNonStreaming
      ): Promise<OpenAI.ChatCompletion>;
    };
  };
}

export interface OpenRouterProviderOptions {
  apiKey: string;
  model: string;
  client?: OpenAIClientLike;
}

function toOpenAiJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  const { $schema, ...rest } = jsonSchema;
  return rest;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return match && match[1] ? match[1].trim() : trimmed;
}

function parseOutput<T>(
  text: string | null,
  schema: z.ZodType<T>
): { ok: true; output: T } | { ok: false; error: string } {
  if (!text) {
    return { ok: false, error: 'Empty response content' };
  }
  const cleaned = stripCodeFence(text);
  try {
    const json = JSON.parse(cleaned);
    const parsed = schema.safeParse(json);
    if (parsed.success) {
      return { ok: true, output: parsed.data };
    }
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join(', ');
    return { ok: false, error: issues };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export function mapChatMessagesToOpenAI(
  messages: ChatMessage[],
  images?: ImageInput[]
): OpenAI.ChatCompletionMessageParam[] {
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.role === 'user') {
      lastUserIdx = i;
      break;
    }
  }

  if (images && images.length > 0 && lastUserIdx === -1) {
    throw new Error('Cannot attach images: no user message found in request messages');
  }

  const result: OpenAI.ChatCompletionMessageParam[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;

    if (msg.role === 'system') {
      result.push({ role: 'system', content: msg.content });
    } else if (msg.role === 'tool') {
      result.push({
        role: 'tool',
        tool_call_id: msg.toolCallId,
        content: msg.content,
      });
    } else if (msg.role === 'assistant') {
      const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: msg.content || null,
      };
      if ('toolCalls' in msg && msg.toolCalls && msg.toolCalls.length > 0) {
        assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args),
          },
        }));
      }
      result.push(assistantMsg);
    } else if (msg.role === 'user') {
      if (i === lastUserIdx && images && images.length > 0) {
        const parts: OpenAI.ChatCompletionContentPart[] = [
          { type: 'text', text: msg.content },
        ];
        for (const img of images) {
          parts.push({
            type: 'image_url',
            image_url: {
              url: `data:${img.mimeType};base64,${img.data.toString('base64')}`,
            },
          });
        }
        result.push({ role: 'user', content: parts });
      } else {
        result.push({ role: 'user', content: msg.content });
      }
    }
  }

  return result;
}

export function mapToolsToOpenAI(tools?: ToolSpec[]): OpenAI.ChatCompletionTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toOpenAiJsonSchema(tool.parameters),
    },
  }));
}

export function parseOpenAIToolCalls(
  toolCalls?: OpenAI.ChatCompletionMessageToolCall[]
): ToolCall[] {
  if (!toolCalls || toolCalls.length === 0) return [];
  const results: ToolCall[] = [];
  for (const tc of toolCalls) {
    if (tc.type === 'function') {
      let args: unknown;
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = tc.function.arguments;
      }
      results.push({
        id: tc.id,
        name: tc.function.name,
        args,
      });
    }
  }
  return results;
}

export function createOpenRouterProvider(options: OpenRouterProviderOptions): ModelProvider {
  const model = options.model;
  const client: OpenAIClientLike =
    options.client ??
    new OpenAI({
      apiKey: options.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });

  return {
    name: 'openrouter',
    async complete<T = unknown>(req: CompletionRequest<T>): Promise<CompletionResult<T>> {
      let currentMessages = mapChatMessagesToOpenAI(req.messages, req.images);
      const openAiTools = mapToolsToOpenAI(req.tools);
      const responseFormat = req.responseSchema
        ? {
            type: 'json_schema' as const,
            json_schema: {
              name: 'output',
              // strict: false because optional/nullable Zod fields cause schema rejections on some OpenRouter models; we validate with Zod ourselves
              strict: false,
              schema: toOpenAiJsonSchema(req.responseSchema),
            },
          }
        : undefined;

      async function callModel(messagesToCall: OpenAI.ChatCompletionMessageParam[]) {
        const start = performance.now();
        try {
          const resp = await client.chat.completions.create({
            model,
            messages: messagesToCall,
            ...(openAiTools ? { tools: openAiTools } : {}),
            ...(responseFormat ? { response_format: responseFormat } : {}),
          });
          const ms = Math.round(performance.now() - start);
          return { resp, ms };
        } catch (err) {
          const ms = Math.round(performance.now() - start);
          console.log(`model ${req.purpose} ${model} 0/0 tok ${ms}ms error`);
          throw err;
        }
      }

      let totalInTok = 0;
      let totalOutTok = 0;
      const maxAttempts = req.responseSchema ? 2 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const { resp, ms } = await callModel(currentMessages);
        const choice = resp.choices[0];
        const inTok = resp.usage?.prompt_tokens ?? 0;
        const outTok = resp.usage?.completion_tokens ?? 0;
        totalInTok += inTok;
        totalOutTok += outTok;

        if (!choice || (choice.finish_reason as unknown) === 'error') {
          console.log(`model ${req.purpose} ${model} ${inTok}/${outTok} tok ${ms}ms error`);
          const reason = choice ? choice.finish_reason : 'no_choice';
          throw new Error(`OpenRouter ${model} failed for '${req.purpose}': finish_reason=${reason}`);
        }

        const text = choice.message?.content ?? null;
        const toolCalls = parseOpenAIToolCalls(choice.message?.tool_calls);

        if (!req.responseSchema) {
          console.log(`model ${req.purpose} ${model} ${inTok}/${outTok} tok ${ms}ms ok`);
          return {
            text,
            toolCalls,
            output: null,
            model,
            usage: { inputTokens: totalInTok, outputTokens: totalOutTok },
          };
        }

        const parsed = parseOutput(text, req.responseSchema);
        if (parsed.ok) {
          console.log(`model ${req.purpose} ${model} ${inTok}/${outTok} tok ${ms}ms ok`);
          return {
            text,
            toolCalls,
            output: parsed.output,
            model,
            usage: { inputTokens: totalInTok, outputTokens: totalOutTok },
          };
        }

        if (attempt < maxAttempts) {
          console.log(`model ${req.purpose} ${model} ${inTok}/${outTok} tok ${ms}ms retry`);
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: text ?? '' },
            {
              role: 'user',
              content: `Validation error: ${parsed.error}. Please output valid JSON matching the requested schema.`,
            },
          ];
        } else {
          console.log(`model ${req.purpose} ${model} ${inTok}/${outTok} tok ${ms}ms error`);
          throw new Error(
            `Validation failed for purpose '${req.purpose}' after retry: ${parsed.error}`
          );
        }
      }

      throw new Error(`Unexpected termination for purpose '${req.purpose}'`);
    },
  };
}
