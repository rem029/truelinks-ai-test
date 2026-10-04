# 03 — Model provider & agent runtime

Goal: agents depend on an interface, not a vendor. Runs with no key.

## Phase 1 — Interface + stub
### Tasks
- [x] `ModelProvider { complete({messages, tools?, responseSchema?, images?}) }` — one primitive for structured output, tool calls and vision
- [x] `StubProvider`: scripted responses keyed by sample file (`data/sample-leases/expected.json`, `data/sample-photos/expected.json`); simple parser for typed corrections ("rent is 8500")
- [x] Select provider from env (`OPENROUTER_API_KEY` unset → stub)
### Results
- `services/agents/modelProvider/`: `types.ts` (`ChatMessage`, `ToolCall`, `ToolSpec`, `ImageInput`, `CompletionRequest<T>`, `CompletionResult<T>`, `ModelProvider`), `stubProvider.ts`, `parseCorrection.ts`, `openRouterProvider.ts`, `index.ts` (`createModelProvider({apiKey?, model})`). The request carries a `purpose` label, used in logs and for the stub's routing.
- Stub, routed by `purpose`:
  - `photo-analysis` returns `{photos:[{filename, condition, equipment, damages}]}` from `data/sample-photos/expected.json`. The file is checked with Zod and fails loudly if it's malformed; an unknown photo comes back as `undeterminable`.
  - `lease-correction` calls `update_field` when `parseCorrection` recognises the message, and `ask_user` otherwise. After a tool result, it replies with a summary.
  - Any other purpose throws a clear error.
- **Follow-up for 04:** the stub doesn't have lease extraction yet. `sample-leases/expected.json` only holds rule outcomes, so 04 phase 2 adds per-lease extraction fixtures under a `lease-extraction` purpose.
- `parseCorrection` works from a table: rent amount, deposit, term in months, start and expiry dates (ISO only), tenant and landlord names. Vague words (like "high" or "wrong") or more than one match give `null`, so the agent asks instead of guessing.
- `env.ts` gained `OPENROUTER_API_KEY` (an empty value means none) and `OPENROUTER_MODEL` (default `xiaomi/mimo-v2.6-pro`). `/api/health` now returns `modelProvider: stub|openrouter`, from the shared `ModelProviderName`.

## Phase 2 — Agent loop + tools
### Tasks
- [x] Tool registry: name, Zod args, handler; args validated, errors returned to the model
- [x] Loop: model → tool calls → results → model, max ~6 steps; ends on `ask_user` or final reply
- [x] Log each tool call (name, args, result, ms) against the message
### Results
- `toolRegistry.ts`: `defineTool({name, description, args, handler})` returns one uniform `Tool` whose `run(rawArgs)` does the Zod check and catches handler errors. `runTool` reports an unknown tool, bad arguments or a thrown error as `{ok:false, error}`, which goes back to the model. No `any` types.
- `askUserTool.ts`: `ask_user` is a real tool with arguments `{question: string (min 1)}`. The loop honours it only when it's registered.
- `agentLoop.ts` `runAgentTurn({provider, purpose, messages, tools, maxSteps=6})` returns `{reply, askedUser, messages, toolCalls: ToolCallLog[]}`.
  - Every tool call gets a `tool` result message, including `ask_user`. Without them, OpenAI and OpenRouter reject the next request.
  - When the step limit is hit, the loop returns a "Step limit reached" reply and logs a line. It doesn't throw, so the transcript of what already happened is kept.
- Log lines: `tool <name> <ok|error> <ms>ms <args, up to 120 chars>` and `agent <purpose> step limit reached (n)`. Task 04 stores `ToolCallLog[]` against the message.

## Phase 3 — OpenRouter
### Tasks
- [x] OpenAI SDK with OpenRouter base URL; tool calling, JSON-schema output, image input
- [x] One retry on invalid JSON, then clear error
- [x] Log model, tokens, latency per call
### Results
- `openai` ^7.27.0 (approved).
  - Tools and `response_format` use `z.toJSONSchema` with `$schema` stripped and `strict: false`. Zod's optional and nullable fields aren't strict-mode compatible on many OpenRouter models, and we validate with Zod anyway.
  - Images are sent as base64 data URLs on the last user message. Images with no user message throw.
  - A surrounding ```json fence is stripped before `JSON.parse`.
  - At most two attempts when a `responseSchema` is set, then `Validation failed for '<purpose>' after retry: …`.
  - `finish_reason: error` or no choice fails at once with no retry.
- Log line: `model <purpose> <model> <in>/<out> tok <ms>ms <ok|retry|error>`. No content or key is logged.
- Tests use an injected fake client, so there's no network.
- **Live check** (`xiaomi/mimo-v2.6-pro`):
  - "rent is 8500" → `update_field` → final reply.
  - "change it" → `ask_user`.
  - The photo `issue-04-move-in-ok-1.jpg` passed the schema, with 4k input tokens in about 5s.
- **Found live:** a tool argument typed `string | number` makes mimo fail upstream (`finish_reason: error`, truncated args). We now fail loudly on that, and tool schemas must use one type per field. **For 04:** `update_field` should take a single type, or one tool per field type.
- **Model quality notes for 04 prompts:**
  - mimo rated the move-in photo `worn`; the expected value is `new`.
  - It wrote rent as "$8,500" instead of QAR.
  - The human reviews both, and the prompts should state the currency and the condition definitions.

## Seed / test
- Nothing new to seed. The stub reads the existing `data/sample-photos/expected.json`.
- typecheck clean. Tests: 114 in 16 files (up from 35). After a dev restart, `/api/health` returns `{"status":"ok","modelProvider":"openrouter"}` with the key set and `stub` without it.
