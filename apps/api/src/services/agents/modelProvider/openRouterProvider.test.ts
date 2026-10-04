import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type OpenAI from 'openai';
import {
  createOpenRouterProvider,
  mapChatMessagesToOpenAI,
  mapToolsToOpenAI,
  parseOpenAIToolCalls,
  type OpenAIClientLike,
} from './openRouterProvider.ts';

describe('openRouterProvider', () => {
  describe('message & tool mapping', () => {
    it('maps chat messages and attaches images to last user message', () => {
      const messages = [
        { role: 'system' as const, content: 'You are an agent.' },
        { role: 'user' as const, content: 'First user msg' },
        {
          role: 'assistant' as const,
          content: 'I will call a tool',
          toolCalls: [{ id: 'call_1', name: 'my_tool', args: { a: 1 } }],
        },
        { role: 'tool' as const, toolCallId: 'call_1', content: 'tool result' },
        { role: 'user' as const, content: 'Please inspect this photo.' },
      ];

      const image = {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        data: Buffer.from('fake-image-bytes'),
      };

      const mapped = mapChatMessagesToOpenAI(messages, [image]);

      expect(mapped).toHaveLength(5);
      expect(mapped[0]).toEqual({ role: 'system', content: 'You are an agent.' });
      expect(mapped[1]).toEqual({ role: 'user', content: 'First user msg' });
      expect(mapped[2]).toEqual({
        role: 'assistant',
        content: 'I will call a tool',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'my_tool', arguments: '{"a":1}' },
          },
        ],
      });
      expect(mapped[3]).toEqual({
        role: 'tool',
        tool_call_id: 'call_1',
        content: 'tool result',
      });

      const lastUser = mapped[4];
      expect(lastUser?.role).toBe('user');
      const parts = lastUser?.content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
      expect(parts).toHaveLength(2);
      expect(parts[0]).toEqual({ type: 'text', text: 'Please inspect this photo.' });
      expect(parts[1]?.type).toBe('image_url');
      expect(parts[1]?.image_url?.url).toContain('data:image/jpeg;base64,');
    });

    it('throws error when images are provided but no user message exists', () => {
      const messages = [{ role: 'system' as const, content: 'System instruction only.' }];
      const image = {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        data: Buffer.from('fake'),
      };

      expect(() => mapChatMessagesToOpenAI(messages, [image])).toThrow(
        'Cannot attach images: no user message found in request messages'
      );
    });

    it('maps tool specs to OpenAI format and strips $schema', () => {
      const tools = [
        {
          name: 'get_weather',
          description: 'Get weather for city',
          parameters: z.object({ city: z.string() }),
        },
      ];

      const mapped = mapToolsToOpenAI(tools);
      expect(mapped).toHaveLength(1);
      const tool = mapped?.[0];
      expect(tool?.type).toBe('function');
      if (tool && tool.type === 'function') {
        expect(tool.function.name).toBe('get_weather');
        expect(tool.function.description).toBe('Get weather for city');
        expect(tool.function.parameters).toHaveProperty('type', 'object');
        expect(tool.function.parameters).not.toHaveProperty('$schema');
      }
    });

    it('parses valid and invalid tool call arguments', () => {
      const rawCalls: OpenAI.ChatCompletionMessageToolCall[] = [
        {
          id: 'call_ok',
          type: 'function',
          function: { name: 'tool_a', arguments: '{"count": 42}' },
        },
        {
          id: 'call_bad',
          type: 'function',
          function: { name: 'tool_b', arguments: 'not valid json' },
        },
      ];

      const parsed = parseOpenAIToolCalls(rawCalls);
      expect(parsed).toEqual([
        { id: 'call_ok', name: 'tool_a', args: { count: 42 } },
        { id: 'call_bad', name: 'tool_b', args: 'not valid json' },
      ]);
    });
  });

  describe('createOpenRouterProvider completion flow', () => {
    it('completes request with text and tool calls without responseSchema', async () => {
      const fakeCompletion: OpenAI.ChatCompletion = {
        id: 'comp_1',
        created: Date.now(),
        model: 'test-model',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            logprobs: null,
            message: {
              role: 'assistant',
              content: 'Hello world',
              refusal: null,
            },
          },
        ],
        usage: { prompt_tokens: 15, completion_tokens: 5, total_tokens: 20 },
      };

      const mockCreate = vi.fn().mockResolvedValue(fakeCompletion);
      const fakeClient: OpenAIClientLike = {
        chat: { completions: { create: mockCreate } },
      };

      const provider = createOpenRouterProvider({
        apiKey: 'test-key',
        model: 'test-model',
        client: fakeClient,
      });

      const res = await provider.complete({
        purpose: 'greeting',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(res.text).toBe('Hello world');
      expect(res.output).toBeNull();
      expect(res.model).toBe('test-model');
      expect(res.usage).toEqual({ inputTokens: 15, outputTokens: 5 });
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('validates response against responseSchema on first try and strips code fences', async () => {
      const fakeCompletion: OpenAI.ChatCompletion = {
        id: 'comp_2',
        created: Date.now(),
        model: 'test-model',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            logprobs: null,
            message: {
              role: 'assistant',
              content: '```json\n{"score": 95}\n```',
              refusal: null,
            },
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      };

      const mockCreate = vi.fn().mockResolvedValue(fakeCompletion);
      const fakeClient: OpenAIClientLike = {
        chat: { completions: { create: mockCreate } },
      };

      const provider = createOpenRouterProvider({
        apiKey: 'test-key',
        model: 'test-model',
        client: fakeClient,
      });

      const schema = z.object({ score: z.number() });
      const res = await provider.complete({
        purpose: 'scoring',
        messages: [{ role: 'user', content: 'Score this' }],
        responseSchema: schema,
      });

      expect(res.output).toEqual({ score: 95 });
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Verify response_format passed to client has strict: false and no $schema
      const createArgs = mockCreate.mock.calls[0]?.[0];
      expect(createArgs?.response_format?.json_schema?.strict).toBe(false);
      expect(createArgs?.response_format?.json_schema?.schema).not.toHaveProperty('$schema');
    });

    it('retries once when responseSchema fails and succeeds on retry', async () => {
      const badCompletion: OpenAI.ChatCompletion = {
        id: 'comp_bad',
        created: Date.now(),
        model: 'test-model',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            logprobs: null,
            message: {
              role: 'assistant',
              content: '{"score": "not-a-number"}',
              refusal: null,
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const goodCompletion: OpenAI.ChatCompletion = {
        id: 'comp_good',
        created: Date.now(),
        model: 'test-model',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            logprobs: null,
            message: {
              role: 'assistant',
              content: '{"score": 100}',
              refusal: null,
            },
          },
        ],
        usage: { prompt_tokens: 25, completion_tokens: 6, total_tokens: 31 },
      };

      const mockCreate = vi
        .fn()
        .mockResolvedValueOnce(badCompletion)
        .mockResolvedValueOnce(goodCompletion);

      const fakeClient: OpenAIClientLike = {
        chat: { completions: { create: mockCreate } },
      };

      const provider = createOpenRouterProvider({
        apiKey: 'test-key',
        model: 'test-model',
        client: fakeClient,
      });

      const schema = z.object({ score: z.number() });
      const res = await provider.complete({
        purpose: 'scoring',
        messages: [{ role: 'user', content: 'Score this' }],
        responseSchema: schema,
      });

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(res.output).toEqual({ score: 100 });
      expect(res.usage).toEqual({ inputTokens: 35, outputTokens: 11 });
    });

    it('throws clear error when validation fails after retry', async () => {
      const badCompletion: OpenAI.ChatCompletion = {
        id: 'comp_bad',
        created: Date.now(),
        model: 'test-model',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            logprobs: null,
            message: {
              role: 'assistant',
              content: 'invalid json text',
              refusal: null,
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const mockCreate = vi.fn().mockResolvedValue(badCompletion);
      const fakeClient: OpenAIClientLike = {
        chat: { completions: { create: mockCreate } },
      };

      const provider = createOpenRouterProvider({
        apiKey: 'test-key',
        model: 'test-model',
        client: fakeClient,
      });

      const schema = z.object({ score: z.number() });
      await expect(
        provider.complete({
          purpose: 'test-failure',
          messages: [{ role: 'user', content: 'Test' }],
          responseSchema: schema,
        })
      ).rejects.toThrow("Validation failed for purpose 'test-failure' after retry");

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('re-throws when OpenAI client encounters a network/API error', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Connection timeout'));
      const fakeClient: OpenAIClientLike = {
        chat: { completions: { create: mockCreate } },
      };

      const provider = createOpenRouterProvider({
        apiKey: 'test-key',
        model: 'test-model',
        client: fakeClient,
      });

      await expect(
        provider.complete({
          purpose: 'test-network-error',
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow('Connection timeout');
    });

    it('fails loudly without retry when finish_reason is error', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorCompletion: OpenAI.ChatCompletion = {
        id: 'comp_err',
        created: Date.now(),
        model: 'test-model',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            // Cast to test upstream error finish_reason returned by OpenRouter
            finish_reason: 'error' as unknown as 'stop',
            logprobs: null,
            message: {
              role: 'assistant',
              content: null,
              refusal: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'update_field', arguments: '{"fieldPath": "rent.amount", "value": ' },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
      };

      const mockCreate = vi.fn().mockResolvedValue(errorCompletion);
      const fakeClient: OpenAIClientLike = {
        chat: { completions: { create: mockCreate } },
      };

      const provider = createOpenRouterProvider({
        apiKey: 'test-key',
        model: 'test-model',
        client: fakeClient,
      });

      await expect(
        provider.complete({
          purpose: 'lease-correction',
          messages: [{ role: 'user', content: 'rent is 8500' }],
        })
      ).rejects.toThrow("OpenRouter test-model failed for 'lease-correction': finish_reason=error");

      // Verify no retry happened
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Verify call line logged with result error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^model lease-correction test-model 12\/8 tok \d+ms error$/)
      );

      consoleSpy.mockRestore();
    });

    it('fails loudly without retry when response has no choices', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const emptyCompletion: OpenAI.ChatCompletion = {
        id: 'comp_empty',
        created: Date.now(),
        model: 'test-model',
        object: 'chat.completion',
        choices: [],
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
      };

      const mockCreate = vi.fn().mockResolvedValue(emptyCompletion);
      const fakeClient: OpenAIClientLike = {
        chat: { completions: { create: mockCreate } },
      };

      const provider = createOpenRouterProvider({
        apiKey: 'test-key',
        model: 'test-model',
        client: fakeClient,
      });

      await expect(
        provider.complete({
          purpose: 'lease-correction',
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow("OpenRouter test-model failed for 'lease-correction': finish_reason=no_choice");

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^model lease-correction test-model 5\/0 tok \d+ms error$/)
      );

      consoleSpy.mockRestore();
    });
  });
});
