import type { CompletionRequest, CompletionResult, ToolCall } from './types.ts';

export interface ExpectedWorkOrder {
  photoFilenames: string[];
  workOrder: Record<string, unknown> | undefined;
}

function result<T>(params: { text?: string; toolCalls?: ToolCall[] }): CompletionResult<T> {
  return {
    text: params.text ?? null,
    toolCalls: params.toolCalls ?? [],
    output: null,
    model: 'stub',
    usage: { inputTokens: 0, outputTokens: 0 },
  };
}

function callsMade(req: CompletionRequest): { name: string; content: string }[] {
  const calls: { name: string; content: string }[] = [];
  for (const msg of req.messages) {
    if (msg.role !== 'tool') continue;
    const call = req.messages
      .flatMap((m) => (m.role === 'assistant' && m.toolCalls ? m.toolCalls : []))
      .find((c) => c.id === msg.toolCallId);
    if (call) {
      calls.push({ name: call.name, content: msg.content });
    }
  }
  return calls;
}

function toResponsibility(text: unknown, hasLease: boolean): string {
  if (!hasLease || typeof text !== 'string') return 'unknown';
  if (text.startsWith('landlord')) return 'landlord';
  if (text.startsWith('tenant')) return 'tenant';
  if (text.startsWith('split')) return 'split';
  return 'unknown';
}

// Scripted agent for runs without an API key: read the lease, then draft from the photo fixture in expected.json
export function stubWorkOrder<T>(req: CompletionRequest<T>, fixtures: ExpectedWorkOrder[]): CompletionResult<T> {
  const calls = callsMade(req);
  const leaseCall = calls.find((c) => c.name === 'get_unit_lease');
  const draftCall = calls.find((c) => c.name === 'draft_work_order');

  if (draftCall) {
    return result({ text: draftCall.content === 'Draft saved' ? 'Drafted a work order from the photos.' : `I couldn't draft it: ${draftCall.content}` });
  }
  if (!leaseCall) {
    return result({ toolCalls: [{ id: 'call_get_unit_lease', name: 'get_unit_lease', args: {} }] });
  }

  const system = req.messages.find((m) => m.role === 'system')?.content ?? '';
  const fixture = fixtures.find((f) => f.photoFilenames.some((name) => system.includes(`- ${name}:`)));
  const expected = fixture?.workOrder;
  if (!expected || expected['expected'] !== true) {
    return result({
      toolCalls: [
        { id: 'call_ask_user', name: 'ask_user', args: { question: 'I can’t tell what needs repairing; please send a clearer photo of the problem.' } },
      ],
    });
  }

  // A typed correction like "make it high" changes the severity, so the redraft path can be exercised
  const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')?.content.toLowerCase() ?? '';
  const severityWord = lastUser.match(/\b(low|medium|high)\b/)?.[1];
  const fixtureSeverity = String(expected['severity'] ?? 'medium');
  const severity = severityWord ?? (['low', 'medium', 'high'].includes(fixtureSeverity) ? fixtureSeverity : 'medium');
  const titleWords = Array.isArray(expected['titleContains']) ? expected['titleContains'].map(String) : ['Repair'];
  const hasLease = !leaseCall.content.includes('"lease":null');

  return result({
    toolCalls: [
      {
        id: 'call_draft_work_order',
        name: 'draft_work_order',
        args: {
          title: titleWords.join(' '),
          description: 'Stub draft from the photo findings.',
          category: String(expected['category'] ?? 'general'),
          severity,
          urgent: expected['urgent'] === true,
          responsibility: toResponsibility(expected['responsibility'], hasLease),
          responsibilityReason: hasLease ? 'Stub: taken from the sample ground truth.' : 'No confirmed lease on file.',
        },
      },
    ],
  });
}
