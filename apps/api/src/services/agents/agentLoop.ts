import type { ChatMessage, ModelProvider } from './modelProvider/types.js';
import { runTool, toToolSpecs, type Tool } from './toolRegistry.js';

export type ToolCallLog =
  | { name: string; args: unknown; ok: true; result: unknown; ms: number }
  | { name: string; args: unknown; ok: false; error: string; ms: number };

export interface AgentTurnOptions {
  provider: ModelProvider;
  purpose: string;
  messages: ChatMessage[];
  tools?: readonly Tool[];
  maxSteps?: number;
}

export interface AgentTurnResult {
  reply: string;
  askedUser: boolean;
  messages: ChatMessage[];
  toolCalls: ToolCallLog[];
}

export async function runAgentTurn(options: AgentTurnOptions): Promise<AgentTurnResult> {
  const maxSteps = options.maxSteps ?? 6;
  const transcript: ChatMessage[] = [...options.messages];
  const toolCallLogs: ToolCallLog[] = [];
  const toolSpecs = options.tools ? toToolSpecs(options.tools) : undefined;
  const hasAskUserTool = options.tools ? options.tools.some((t) => t.name === 'ask_user') : false;

  for (let step = 0; step < maxSteps; step++) {
    const completion = await options.provider.complete({
      purpose: options.purpose,
      messages: transcript,
      tools: toolSpecs,
    });

    if (completion.toolCalls.length === 0) {
      const reply = completion.text ?? '';
      transcript.push({ role: 'assistant', content: reply });
      return {
        reply,
        askedUser: false,
        messages: transcript,
        toolCalls: toolCallLogs,
      };
    }

    transcript.push({
      role: 'assistant',
      content: completion.text ?? '',
      toolCalls: completion.toolCalls,
    });

    let askedUserQuestion: string | null = null;

    // OpenAI and OpenRouter reject subsequent turns unless every tool_call id has a corresponding tool result message
    for (const call of completion.toolCalls) {
      const start = performance.now();
      const result = await runTool(options.tools ?? [], call);
      const ms = Math.round(performance.now() - start);

      const argsSummary = JSON.stringify(call.args).slice(0, 120);
      console.log(`tool ${call.name} ${result.ok ? 'ok' : 'error'} ${ms}ms ${argsSummary}`);

      if (result.ok) {
        toolCallLogs.push({
          name: call.name,
          args: call.args,
          ok: true,
          result: result.result,
          ms,
        });
        const content = typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
        transcript.push({
          role: 'tool',
          toolCallId: call.id,
          content,
        });

        // Only honour ask_user if explicitly registered and validated; invalid args produce an error result for the model
        if (call.name === 'ask_user' && hasAskUserTool && typeof result.result === 'string') {
          askedUserQuestion = result.result;
        }
      } else {
        toolCallLogs.push({
          name: call.name,
          args: call.args,
          ok: false,
          error: result.error,
          ms,
        });
        transcript.push({
          role: 'tool',
          toolCallId: call.id,
          content: result.error,
        });
      }
    }

    if (askedUserQuestion !== null) {
      return {
        reply: askedUserQuestion,
        askedUser: true,
        messages: transcript,
        toolCalls: toolCallLogs,
      };
    }
  }

  console.log(`agent ${options.purpose} step limit reached (${maxSteps})`);

  // Preserves audit trail and avoids 500 crashes while cleanly communicating the boundary hit to callers
  return {
    reply: `Step limit reached (${maxSteps} steps).`,
    askedUser: false,
    messages: transcript,
    toolCalls: toolCallLogs,
  };
}
