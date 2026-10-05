import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { runAgentTurn } from './agentLoop.ts';
import { createStubProvider } from './modelProvider/stubProvider.ts';
import { defineTool } from './toolRegistry.ts';
import { askUserTool } from './askUserTool.ts';
import type { ModelProvider } from './modelProvider/types.ts';

describe('agentLoop', () => {
  it('runs lease correction with stub provider and update_field tool', async () => {
    const provider = createStubProvider();
    const updateFieldMock = vi.fn().mockResolvedValue({ updated: true });

    const updateFieldTool = defineTool({
      name: 'update_field',
      description: 'Updates a lease field',
      args: z.object({
        fieldPath: z.string(),
        value: z.union([z.string(), z.number()]),
      }),
      handler: updateFieldMock,
    });

    const result = await runAgentTurn({
      provider,
      purpose: 'lease-correction',
      messages: [{ role: 'user', content: 'rent is 8500' }],
      tools: [updateFieldTool],
    });

    expect(updateFieldMock).toHaveBeenCalledTimes(1);
    expect(updateFieldMock).toHaveBeenCalledWith({
      fieldPath: 'rent.amount',
      value: '8500',
    });

    expect(result.askedUser).toBe(false);
    expect(result.reply).toBe('Updated rent.amount to 8500.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('update_field');
    expect(result.toolCalls[0]?.ok).toBe(true);

    expect(result.messages).toHaveLength(4);
    expect(result.messages[0]?.role).toBe('user');
    expect(result.messages[1]?.role).toBe('assistant');
    expect(result.messages[2]?.role).toBe('tool');
    expect(result.messages[3]?.role).toBe('assistant');
  });

  it('stops and returns question when ask_user is called and ensures all tool calls have tool messages', async () => {
    const provider = createStubProvider();
    const updateFieldMock = vi.fn();

    const updateFieldTool = defineTool({
      name: 'update_field',
      description: 'Updates a lease field',
      args: z.object({
        fieldPath: z.string(),
        value: z.union([z.string(), z.number()]),
      }),
      handler: updateFieldMock,
    });

    const result = await runAgentTurn({
      provider,
      purpose: 'lease-correction',
      messages: [{ role: 'user', content: 'change it' }],
      tools: [updateFieldTool, askUserTool],
    });

    expect(updateFieldMock).not.toHaveBeenCalled();
    expect(result.askedUser).toBe(true);
    expect(result.reply).toBe('Which field should I change, and to what value?');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('ask_user');

    // Verify transcript structure: assistant message tool_calls must have matching tool messages
    const assistantMessage = result.messages.find((m) => m.role === 'assistant' && 'toolCalls' in m && m.toolCalls);
    expect(assistantMessage).toBeDefined();
    if (assistantMessage && 'toolCalls' in assistantMessage && assistantMessage.toolCalls) {
      for (const tc of assistantMessage.toolCalls) {
        const matchingToolMsg = result.messages.find((m) => m.role === 'tool' && m.toolCallId === tc.id);
        expect(matchingToolMsg).toBeDefined();
      }
    }
  });

  it('executes all tool calls in order and creates tool messages for every call id when multiple calls are returned', async () => {
    const multiCallProvider: ModelProvider = {
      name: 'stub',
      complete: async () => ({
        text: null,
        toolCalls: [
          { id: 'call_1', name: 'log_action', args: { message: 'first' } },
          { id: 'call_2', name: 'ask_user', args: { question: 'Clarify please?' } },
        ],
        output: null,
        model: 'stub',
      }),
    };

    const actionMock = vi.fn().mockResolvedValue('logged');
    const logTool = defineTool({
      name: 'log_action',
      description: 'Logs action',
      args: z.object({ message: z.string() }),
      handler: actionMock,
    });

    const result = await runAgentTurn({
      provider: multiCallProvider,
      purpose: 'multi-call',
      messages: [{ role: 'user', content: 'hello' }],
      tools: [logTool, askUserTool],
    });

    expect(actionMock).toHaveBeenCalledWith({ message: 'first' });
    expect(result.askedUser).toBe(true);
    expect(result.reply).toBe('Clarify please?');

    // Both call_1 and call_2 must have tool messages
    const toolMsg1 = result.messages.find((m) => m.role === 'tool' && m.toolCallId === 'call_1');
    const toolMsg2 = result.messages.find((m) => m.role === 'tool' && m.toolCallId === 'call_2');
    expect(toolMsg1).toBeDefined();
    expect(toolMsg2).toBeDefined();
  });

  it('handles invalid args to ask_user as a tool error and does not end turn on failed ask_user', async () => {
    let turnCount = 0;
    const provider: ModelProvider = {
      name: 'stub',
      complete: async () => {
        turnCount++;
        if (turnCount === 1) {
          return {
            text: null,
            // Empty string fails question.min(1)
            toolCalls: [{ id: 'call_bad_ask', name: 'ask_user', args: { question: '' } }],
            output: null,
            model: 'stub',
          };
        }
        return {
          text: 'Handled error',
          toolCalls: [],
          output: null,
          model: 'stub',
        };
      },
    };

    const result = await runAgentTurn({
      provider,
      purpose: 'test-bad-ask',
      messages: [{ role: 'user', content: 'test' }],
      tools: [askUserTool],
    });

    expect(result.askedUser).toBe(false);
    expect(result.reply).toBe('Handled error');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('ask_user');
    expect(result.toolCalls[0]?.ok).toBe(false);
  });

  it('stops and logs step limit reached when loop exceeds maxSteps', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let callCount = 0;
    const loopingProvider: ModelProvider = {
      name: 'stub',
      complete: async () => {
        callCount++;
        return {
          text: 'Looping...',
          toolCalls: [
            {
              id: `call_${callCount}`,
              name: 'dummy_tool',
              args: { step: callCount },
            },
          ],
          output: null,
          model: 'stub',
        };
      },
    };

    const dummyTool = defineTool({
      name: 'dummy_tool',
      description: 'Dummy tool for looping test',
      args: z.object({ step: z.number() }),
      handler: async (args) => ({ processedStep: args.step }),
    });

    const result = await runAgentTurn({
      provider: loopingProvider,
      purpose: 'test-loop',
      messages: [{ role: 'user', content: 'start loop' }],
      tools: [dummyTool],
      maxSteps: 3,
    });

    expect(callCount).toBe(3);
    expect(result.reply).toBe("I couldn't finish that in 3 steps; try rephrasing, or use the cards.");
    expect(result.askedUser).toBe(false);
    expect(result.toolCalls).toHaveLength(3);
    expect(consoleSpy).toHaveBeenCalledWith('agent test-loop step limit reached (3)');
    consoleSpy.mockRestore();
  });

  it('feeds tool error back to model when tool execution fails', async () => {
    let turnCount = 0;
    const testProvider: ModelProvider = {
      name: 'stub',
      complete: async (req) => {
        turnCount++;
        if (turnCount === 1) {
          return {
            text: null,
            toolCalls: [{ id: 'call_err', name: 'failing_tool', args: { num: -1 } }],
            output: null,
            model: 'stub',
          };
        }
        const lastMsg = req.messages[req.messages.length - 1];
        return {
          text: `Recovered from: ${lastMsg?.content}`,
          toolCalls: [],
          output: null,
          model: 'stub',
        };
      },
    };

    const failingTool = defineTool({
      name: 'failing_tool',
      description: 'Tool that throws error on negative numbers',
      args: z.object({ num: z.number().nonnegative() }),
      handler: async () => 'ok',
    });

    const result = await runAgentTurn({
      provider: testProvider,
      purpose: 'test-error',
      messages: [{ role: 'user', content: 'run failing tool' }],
      tools: [failingTool],
    });

    expect(result.askedUser).toBe(false);
    expect(result.reply).toContain('Recovered from: Invalid arguments for tool');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.ok).toBe(false);
  });

  it('tracks last model and sums input/output tokens over multiple steps', async () => {
    let callCount = 0;
    const testProvider: ModelProvider = {
      name: 'stub',
      async complete() {
        callCount++;
        if (callCount === 1) {
          return {
            text: null,
            toolCalls: [{ id: 'step_1', name: 'dummy_tool', args: {} }],
            output: null,
            model: 'model-step-1',
            usage: { inputTokens: 100, outputTokens: 20 },
          };
        }
        return {
          text: 'Finished dummy work',
          toolCalls: [],
          output: null,
          model: 'model-step-2',
          usage: { inputTokens: 150, outputTokens: 30 },
        };
      },
    };

    const dummyTool = defineTool({
      name: 'dummy_tool',
      description: 'Dummy tool',
      args: z.object({}),
      handler: async () => ({ done: true }),
    });

    const result = await runAgentTurn({
      provider: testProvider,
      purpose: 'test-usage',
      messages: [{ role: 'user', content: 'do work' }],
      tools: [dummyTool],
    });

    expect(result.model).toBe('model-step-2');
    expect(result.usage).toEqual({
      inputTokens: 250,
      outputTokens: 50,
    });
  });
});
